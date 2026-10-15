// Account sync: every local write is recorded in an outbox and pushed as a
// row of public.sync_rows (one row per local record, last write wins). Rows
// changed on other devices are pulled and applied locally. Works offline: the
// outbox survives reloads and flushes when the connection returns.
import type { Table, Transaction } from "dexie";
import type { AppDB } from "../db/db";

export interface RemoteRow {
  tbl: string;
  pk: string;
  data: unknown;
  deleted: boolean;
  updated_at?: string;
}

export interface SyncBackend {
  push(rows: RemoteRow[]): Promise<void>;
  /** Rows with updated_at >= since (or all when null), oldest first. */
  pull(since: string | null): Promise<RemoteRow[]>;
}

/** Tables kept in the account. Photos are device-only (they need file storage). */
export const SYNCED_TABLES = [
  "profiles", "assessments", "targets", "programs", "programVersions", "templates", "exercises",
  "restPrefs", "sessions", "sets", "foods", "meals", "recipes", "foodLog", "checkins", "weighins",
  "steps", "lessonProgress", "chats", "chatMessages", "entitlements",
] as const;

const REMOTE = "__remote";
const PULL_OVERLAP_MS = 2 * 60_000; // re-read a little history so slow commits aren't missed

type Change = { tbl: string; pk: string; deleted: boolean; v: number };
export type SyncStatus = { state: "idle" | "syncing" | "offline" | "error"; lastSyncedAt: number | null; pending: number; error?: string };

/** Ids for auto-increment tables that can't collide across devices. */
let lastId = 0;
export function globalId(): number {
  const id = Date.now() * 1000 + Math.floor(Math.random() * 1000);
  lastId = id > lastId ? id : lastId + 1;
  return lastId;
}

export class SyncEngine {
  private outbox = new Map<string, Change>();
  private version = 0;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private running: Promise<void> | null = null;
  private listeners = new Set<(s: SyncStatus) => void>();
  status: SyncStatus = { state: "idle", lastSyncedAt: null, pending: 0 };
  backend: SyncBackend | null = null;
  userId: string | null = null;

  constructor(private db: AppDB, private storage: Pick<Storage, "getItem" | "setItem" | "removeItem"> | null = safeStorage()) {
    this.loadOutbox();
    for (const name of SYNCED_TABLES) this.hook(name);
    // Auto-increment tables get globally unique ids (sync between devices).
    for (const t of this.db.tables) {
      if (!t.schema.primKey.auto) continue;
      t.hook("creating", function (primKey, obj) {
        if (primKey !== undefined) return;
        const id = globalId();
        (obj as Record<string, unknown>)[t.schema.primKey.keyPath as string] = id;
        return id;
      });
    }
  }

  // ---------- change capture ----------

  private hook(name: string) {
    // Dexie's hook typings don't model `this.onsuccess`; the runtime contract is documented.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const table = this.db.table(name) as any;
    const isRemote = (tx: Transaction) => Boolean((tx as unknown as Record<string, unknown>)[REMOTE]);
    const mark = (pk: unknown, deleted: boolean) => this.mark(name, pk, deleted);
    table.hook("creating", function (this: { onsuccess?: (k: unknown) => void }, _pk: unknown, _obj: unknown, tx: Transaction) {
      if (isRemote(tx)) return;
      this.onsuccess = (key) => mark(key, false);
    });
    table.hook("updating", function (this: { onsuccess?: () => void }, _mods: unknown, pk: unknown, _obj: unknown, tx: Transaction) {
      if (isRemote(tx)) return;
      this.onsuccess = () => mark(pk, false);
    });
    table.hook("deleting", function (this: { onsuccess?: () => void }, pk: unknown, _obj: unknown, tx: Transaction) {
      if (isRemote(tx)) return;
      this.onsuccess = () => mark(pk, true);
    });
  }

  private mark(tbl: string, pk: unknown, deleted: boolean) {
    const key = `${tbl}\u0000${String(pk)}`;
    this.outbox.set(key, { tbl, pk: String(pk), deleted, v: ++this.version });
    this.saveOutbox();
    this.emit({ pending: this.outbox.size });
    this.schedule();
  }

  /** Queue every local record (first sign-in on a device whose data should go up). */
  async markAll() {
    for (const name of SYNCED_TABLES) {
      const keys = await this.db.table(name).toCollection().primaryKeys();
      for (const k of keys) this.outbox.set(`${name}\u0000${String(k)}`, { tbl: name, pk: String(k), deleted: false, v: ++this.version });
    }
    this.saveOutbox();
    this.emit({ pending: this.outbox.size });
  }

  hasPending() {
    return this.outbox.size > 0;
  }

  // ---------- push / pull ----------

  schedule(delay = 1200) {
    if (!this.backend) return;
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => void this.syncNow(), delay);
  }

  /** Push pending changes, then pull remote ones. Concurrent calls share one run. */
  syncNow(): Promise<void> {
    if (!this.backend) return Promise.resolve();
    if (this.running) return this.running.then(() => this.syncNow());
    this.running = this.run().finally(() => {
      this.running = null;
    });
    return this.running;
  }

  private async run() {
    if (typeof navigator !== "undefined" && navigator.onLine === false) {
      this.emit({ state: "offline" });
      return;
    }
    this.emit({ state: "syncing", error: undefined });
    try {
      await this.push();
      await this.pull();
      this.emit({ state: "idle", lastSyncedAt: Date.now(), pending: this.outbox.size });
    } catch (e) {
      const offline = typeof navigator !== "undefined" && navigator.onLine === false;
      this.emit({ state: offline ? "offline" : "error", error: e instanceof Error ? e.message : String(e), pending: this.outbox.size });
      // Retry with backoff while there is work left.
      if (this.outbox.size) this.schedule(15_000);
    }
  }

  private async push() {
    const batch = [...this.outbox.values()];
    for (let i = 0; i < batch.length; i += 200) {
      const chunk = batch.slice(i, i + 200);
      const rows: RemoteRow[] = [];
      for (const c of chunk) {
        const table = this.db.table(c.tbl);
        const data = c.deleted ? null : await table.get(this.typedKey(table, c.pk));
        rows.push({ tbl: c.tbl, pk: c.pk, data: data ?? null, deleted: c.deleted || data == null });
      }
      await this.backend!.push(rows);
      for (const c of chunk) {
        const key = `${c.tbl}\u0000${c.pk}`;
        // Only clear if not changed again while pushing.
        if (this.outbox.get(key)?.v === c.v) this.outbox.delete(key);
      }
      this.saveOutbox();
    }
  }

  private async pull() {
    const cursorKey = `sync-cursor:${this.userId}`;
    const cursor = this.storage?.getItem(cursorKey) ?? null;
    const since = cursor ? new Date(new Date(cursor).getTime() - PULL_OVERLAP_MS).toISOString() : null;
    const rows = await this.backend!.pull(since);
    if (rows.length) await this.apply(rows);
    const newest = rows.reduce<string | null>((m, r) => (r.updated_at && (!m || r.updated_at > m) ? r.updated_at : m), cursor);
    if (newest) this.storage?.setItem(cursorKey, newest);
  }

  /** Apply remote rows locally; local changes still waiting to upload win. */
  async apply(rows: RemoteRow[]) {
    const known = new Set<string>(SYNCED_TABLES);
    const tables = [...new Set(rows.map((r) => r.tbl))].filter((t) => known.has(t)).map((t) => this.db.table(t));
    if (!tables.length) return;
    await this.db.transaction("rw", tables, async (tx) => {
      (tx as unknown as Record<string, unknown>)[REMOTE] = true;
      for (const r of rows) {
        if (!known.has(r.tbl) || this.outbox.has(`${r.tbl}\u0000${r.pk}`)) continue;
        const table = this.db.table(r.tbl);
        const key = this.typedKey(table, r.pk);
        const local = await table.get(key);
        // Skip no-op writes: re-applying identical rows would wake every live query.
        if (r.deleted || r.data == null) {
          if (local !== undefined) await table.delete(key);
        } else if (local === undefined || stableJson(local) !== stableJson(r.data)) {
          await table.put(r.data);
        }
      }
    });
  }

  private typedKey(table: Table, pk: string): string | number {
    return table.schema.primKey.auto ? Number(pk) : pk;
  }

  // ---------- account lifecycle ----------

  start(backend: SyncBackend, userId: string) {
    this.backend = backend;
    this.userId = userId;
    this.schedule(0);
  }

  stop() {
    if (this.timer) clearTimeout(this.timer);
    this.backend = null;
    this.userId = null;
  }

  /** Replace this device's data with the account's (fresh pull from the beginning). */
  async resetLocalFromAccount() {
    this.outbox.clear();
    this.saveOutbox();
    this.storage?.removeItem(`sync-cursor:${this.userId}`);
    await this.clearLocal();
  }

  async clearLocal() {
    await this.db.transaction("rw", this.db.tables, async (tx) => {
      (tx as unknown as Record<string, unknown>)[REMOTE] = true;
      await Promise.all(this.db.tables.map((t) => t.clear()));
    });
  }

  forgetDevice(userId: string | null) {
    this.outbox.clear();
    this.saveOutbox();
    if (userId) this.storage?.removeItem(`sync-cursor:${userId}`);
  }

  // ---------- status ----------

  subscribe(fn: (s: SyncStatus) => void) {
    this.listeners.add(fn);
    fn(this.status);
    return () => {
      this.listeners.delete(fn);
    };
  }

  private emit(patch: Partial<SyncStatus>) {
    this.status = { ...this.status, pending: this.outbox.size, ...patch };
    this.listeners.forEach((l) => l(this.status));
  }

  private loadOutbox() {
    try {
      const raw = this.storage?.getItem("sync-outbox");
      if (raw) for (const c of JSON.parse(raw) as Change[]) this.outbox.set(`${c.tbl}\u0000${c.pk}`, c);
      this.version = Math.max(0, ...[...this.outbox.values()].map((c) => c.v));
    } catch {
      /* corrupt outbox: start empty */
    }
  }

  private saveOutbox() {
    try {
      this.storage?.setItem("sync-outbox", JSON.stringify([...this.outbox.values()]));
    } catch {
      /* storage full or blocked: changes still sync this session */
    }
  }
}

/** JSON with sorted keys (Postgres jsonb doesn't keep key order). */
export function stableJson(v: unknown): string {
  return JSON.stringify(v, (_k, val) =>
    val && typeof val === "object" && !Array.isArray(val) ? Object.fromEntries(Object.entries(val).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))) : val,
  );
}

function safeStorage(): Storage | null {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null;
  }
}

