import { describe, expect, it } from "vitest";
import { AppDB } from "../../src/db/db";
import { SyncEngine, type RemoteRow, type SyncBackend } from "../../src/sync/engine";

/** In-memory stand-in for public.sync_rows (server-assigned updated_at). */
class MemoryBackend implements SyncBackend {
  rows = new Map<string, RemoteRow>();
  private clock = Date.parse("2026-01-01T00:00:00Z");
  async push(rows: RemoteRow[]) {
    for (const r of rows) this.rows.set(`${r.tbl}|${r.pk}`, { ...structuredClone(r), updated_at: new Date((this.clock += 1000)).toISOString() });
  }
  async pull(since: string | null) {
    return [...this.rows.values()].filter((r) => !since || r.updated_at! >= since).sort((a, b) => a.updated_at!.localeCompare(b.updated_at!));
  }
}

function memStorage() {
  const m = new Map<string, string>();
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), removeItem: (k: string) => void m.delete(k) };
}

let n = 0;
function device(backend: SyncBackend) {
  const db = new AppDB(`sync-test-${++n}`);
  const engine = new SyncEngine(db, memStorage());
  engine.start(backend, "user-1");
  return { db, engine };
}

describe("sync engine", () => {
  it("syncs creates, edits and deletes between two devices", async () => {
    const backend = new MemoryBackend();
    const phone = device(backend);
    const pc = device(backend);

    await phone.db.weighins.add({ date: "2026-10-14", weightKg: 80, createdAt: 1 });
    await phone.db.sessions.add({ id: "s1", date: "2026-10-14", weekStart: "2026-10-12", templateId: "t", name: "Upper A", items: [], status: "completed", startedAt: 1 });
    await phone.engine.syncNow();
    await pc.engine.syncNow();
    expect((await pc.db.weighins.toArray()).map((w) => w.weightKg)).toEqual([80]);
    expect((await pc.db.sessions.get("s1"))?.name).toBe("Upper A");

    await pc.db.sessions.update("s1", { name: "Upper A (edited)" });
    const wid = (await pc.db.weighins.toArray())[0].id!;
    await pc.db.weighins.delete(wid);
    await pc.engine.syncNow();
    await phone.engine.syncNow();
    expect((await phone.db.sessions.get("s1"))?.name).toBe("Upper A (edited)");
    expect(await phone.db.weighins.count()).toBe(0);
  });

  it("gives auto-increment records ids that don't collide across devices", async () => {
    const backend = new MemoryBackend();
    const a = device(backend);
    const b = device(backend);
    await a.db.sets.add({ sessionId: "s", itemId: "i", exerciseId: "bench", index: 0, type: "normal", weight: 60, reps: 8, done: true });
    await b.db.sets.add({ sessionId: "s", itemId: "i", exerciseId: "bench", index: 1, type: "normal", weight: 62.5, reps: 8, done: true });
    await a.engine.syncNow();
    await b.engine.syncNow();
    await a.engine.syncNow();
    expect(await a.db.sets.count()).toBe(2);
    expect(await b.db.sets.count()).toBe(2);
  });

  it("does not echo applied remote rows back as local changes, and local pending edits win", async () => {
    const backend = new MemoryBackend();
    const a = device(backend);
    const b = device(backend);
    await a.db.steps.put({ date: "2026-10-14", steps: 5000, source: "manual" });
    await a.engine.syncNow();
    await b.engine.syncNow();
    expect(b.engine.hasPending()).toBe(false);

    // b edits offline (not yet pushed) while a edits and pushes.
    b.engine.stop();
    await b.db.steps.put({ date: "2026-10-14", steps: 9000, source: "manual" });
    await a.db.steps.put({ date: "2026-10-14", steps: 6000, source: "manual" });
    await a.engine.syncNow();
    b.engine.start(backend, "user-1");
    await b.engine.syncNow(); // pushes 9000 first, then pulls
    await a.engine.syncNow();
    expect((await a.db.steps.get("2026-10-14"))?.steps).toBe(9000);
    expect((await b.db.steps.get("2026-10-14"))?.steps).toBe(9000);
  });

  it("first sign-in uploads everything already on the device", async () => {
    const backend = new MemoryBackend();
    const db = new AppDB(`sync-test-${++n}`);
    await db.profiles.put({ id: "me", name: "Sam", units: "kg", weekStartsOn: 1, weightPacerPctPerWeek: 0, stepGoal: 8000, showCarbsFats: false, weighInReminder: false, createdAt: 1 });
    const engine = new SyncEngine(db, memStorage());
    // Data written before the engine existed isn't in the outbox; markAll covers it.
    await engine.markAll();
    engine.start(backend, "user-1");
    await engine.syncNow();
    expect([...backend.rows.keys()]).toContain("profiles|me");
  });

  it("replacing a device with the account's data pulls everything fresh", async () => {
    const backend = new MemoryBackend();
    const a = device(backend);
    await a.db.weighins.add({ date: "2026-10-01", weightKg: 81, createdAt: 1 });
    await a.engine.syncNow();
    const b = device(backend);
    await b.db.weighins.add({ date: "2026-09-01", weightKg: 99, createdAt: 1 });
    await b.engine.resetLocalFromAccount();
    await b.engine.syncNow();
    expect((await b.db.weighins.toArray()).map((w) => w.weightKg)).toEqual([81]);
  });
});
