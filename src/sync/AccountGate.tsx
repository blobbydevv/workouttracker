import type { Session } from "@supabase/supabase-js";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { db } from "../db/db";
import { ensureSeeded } from "../domain/onboarding";
import { sync } from ".";
import Login from "./Login";
import { SupabaseBackend, supabase } from "./supabase";

type Phase = { k: "loading" } | { k: "signedOut" } | { k: "recovery" } | { k: "choose"; session: Session } | { k: "bootstrapping" } | { k: "error"; message: string; session: Session } | { k: "ready" };

const linkedKey = (uid: string) => `sync-linked:${uid}`;
const getLS = (k: string) => {
  try {
    return localStorage.getItem(k);
  } catch {
    return null;
  }
};
const setLS = (k: string, v: string | null) => {
  try {
    if (v == null) localStorage.removeItem(k);
    else localStorage.setItem(k, v);
  } catch {
    /* storage blocked */
  }
};

/** Requires sign-in, links this device to the account once, then keeps it in sync. */
export function AccountGate({ children }: { children: ReactNode }) {
  const [phase, setPhase] = useState<Phase>({ k: "loading" });
  const startedFor = useRef<string | null>(null);

  useEffect(() => {
    const sb = supabase();
    let cancelled = false;
    const handle = (session: Session | null, event?: string) => {
      if (cancelled) return;
      if (event === "PASSWORD_RECOVERY") return setPhase({ k: "recovery" });
      if (!session) {
        startedFor.current = null;
        sync.stop();
        return setPhase({ k: "signedOut" });
      }
      if (startedFor.current === session.user.id) return;
      startedFor.current = session.user.id;
      void link(session);
    };
    sb.auth.getSession().then(({ data }) => handle(data.session));
    const { data: sub } = sb.auth.onAuthStateChange((event, session) => {
      // Defer: supabase-js warns against awaiting its calls inside this callback.
      setTimeout(() => handle(session, event), 0);
    });
    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, []);

  async function link(session: Session, choice?: "account" | "device") {
    const uid = session.user.id;
    if (getLS(linkedKey(uid))) return start(session);
    setPhase({ k: "bootstrapping" });
    try {
      const sb = supabase();
      const { count, error } = await sb.from("sync_rows").select("pk", { count: "exact", head: true }).eq("tbl", "profiles").eq("deleted", false);
      if (error) throw new Error(error.message);
      const accountHasData = (count ?? 0) > 0;
      const deviceHasData = Boolean(await db.profiles.get("me"));
      sync.userId = uid;
      if (accountHasData && deviceHasData && !choice) return setPhase({ k: "choose", session });
      if (accountHasData && choice !== "device") {
        // Replace this device's data with the account's.
        await sync.resetLocalFromAccount();
      } else {
        // Upload everything already on this device.
        await sync.markAll();
      }
      setLS(linkedKey(uid), "1");
      await start(session, true);
    } catch (e) {
      startedFor.current = null;
      setPhase({ k: "error", message: e instanceof Error ? e.message : String(e), session });
    }
  }

  async function start(session: Session, waitForFirstSync = false) {
    const backend = new SupabaseBackend(supabase(), session.user.id);
    sync.start(backend, session.user.id);
    if (waitForFirstSync) {
      setPhase({ k: "bootstrapping" });
      await sync.syncNow();
      await ensureSeeded();
      if (sync.status.state === "error") throw new Error(sync.status.error ?? "Sync failed");
    }
    setPhase({ k: "ready" });
  }

  // Keep in sync: realtime pushes, focus, reconnect and a slow interval.
  useEffect(() => {
    if (phase.k !== "ready" || !sync.userId) return;
    const backend = new SupabaseBackend(supabase(), sync.userId);
    const channel = backend.watch(() => sync.schedule(300));
    const kick = () => {
      if (document.visibilityState === "visible") void sync.syncNow();
    };
    window.addEventListener("online", kick);
    document.addEventListener("visibilitychange", kick);
    const iv = setInterval(kick, 30_000);
    return () => {
      void supabase().removeChannel(channel);
      window.removeEventListener("online", kick);
      document.removeEventListener("visibilitychange", kick);
      clearInterval(iv);
    };
  }, [phase.k]);

  if (phase.k === "loading" || phase.k === "bootstrapping")
    return (
      <div className="empty" role="status" style={{ paddingTop: 120 }}>
        <span className="spinner" />
        <div className="faint">{phase.k === "bootstrapping" ? "Syncing your account…" : "Loading…"}</div>
      </div>
    );
  if (phase.k === "signedOut") return <Login mode="signin" />;
  if (phase.k === "recovery") return <Login mode="newPassword" onDone={() => setPhase({ k: "loading" })} />;
  if (phase.k === "error")
    return (
      <div className="screen" style={{ paddingTop: 80 }}>
        <h1 style={{ fontSize: 22 }}>Couldn't sync your account</h1>
        <div className="notice error" role="alert">{phase.message}</div>
        <p className="muted">Check your connection and try again.</p>
        <button className="btn block" onClick={() => { startedFor.current = phase.session.user.id; void link(phase.session); }}>Try again</button>
        <button className="btn block ghost" onClick={() => supabase().auth.signOut()}>Sign out</button>
      </div>
    );
  if (phase.k === "choose")
    return (
      <div className="screen" style={{ paddingTop: 60 }}>
        <h1 style={{ fontSize: 22 }}>This device already has data</h1>
        <p className="muted">Your account also has data from another device. Which should this device use?</p>
        <div className="list" style={{ gap: 10 }}>
          <button className="btn block" onClick={() => link(phase.session, "account")}>Use my account's data</button>
          <button className="btn block secondary" onClick={() => link(phase.session, "device")}>Merge this device's data into my account</button>
        </div>
        <p className="faint" style={{ marginTop: 12 }}>“Use my account's data” replaces what's on this device. Merging keeps both; where the same record exists on both, the newest edit wins.</p>
      </div>
    );
  return <>{children}</>;
}

/** Signs out: uploads anything pending, then removes this account's data from the device. */
export async function signOut() {
  const uid = sync.userId;
  try {
    await Promise.race([sync.syncNow(), new Promise((r) => setTimeout(r, 5000))]);
  } catch {
    /* best effort */
  }
  sync.stop();
  await sync.clearLocal();
  sync.forgetDevice(uid);
  if (uid) setLS(linkedKey(uid), null);
  await supabase().auth.signOut();
  location.assign(import.meta.env.BASE_URL);
}
