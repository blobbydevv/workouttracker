import { useLiveQuery } from "dexie-react-hooks";
import { useEffect, useRef, useState } from "react";
import { Icon } from "../components/Icon";
import { Header, Loading, Sheet, useOnline } from "../components/ui";
import { db, uid } from "../db/db";
import { addDays, longDate, today, weekStartOf } from "../domain/dates";
import { currentTarget } from "../domain/checkin";
import { sumEntries } from "../domain/nutrition";
import { PROGRAM_ID } from "../domain/onboarding";
import { weekPlan } from "../domain/schedule";
import { coachReply } from "../lib/api";
import { useProfile } from "../lib/hooks";

/** Personal data the assistant receives. Shown to the user before sending. */
async function buildContext() {
  const p = await db.profiles.get("me");
  const a = (await db.assessments.orderBy("createdAt").toArray()).at(-1);
  const t = await currentTarget(today());
  const from = addDays(today(), -6);
  const entries = await db.foodLog.where("date").between(from, today(), true, true).toArray();
  const days = [...new Set(entries.map((e) => e.date))].sort();
  const weighins = (await db.weighins.orderBy("date").toArray()).slice(-14).map((w) => ({ date: w.date, kg: Math.round(w.weightKg * 10) / 10 }));
  const ws = weekStartOf(today(), p?.weekStartsOn ?? 1);
  const plan = await weekPlan(PROGRAM_ID, ws);
  const templates = new Map((await db.templates.toArray()).map((x) => [x.id, x.name]));
  const sessions = (await db.sessions.orderBy("date").toArray()).slice(-5);
  return {
    today: today(),
    goal: a?.goal,
    experience: a?.experience,
    location: a?.location,
    weightPacerPctPerWeek: p?.weightPacerPctPerWeek,
    targets: t && { calories: t.calories, protein: t.protein, carbs: t.carbs, fat: t.fat },
    nutritionLast7Days: days.map((d) => ({ date: d, ...roundMacros(sumEntries(entries.filter((e) => e.date === d))) })),
    weighins,
    thisWeek: plan.map((d) => ({ date: d.date, workout: d.templateId ? templates.get(d.templateId) : "Rest" })),
    recentWorkouts: sessions.map((s) => ({ date: s.date, name: s.name, status: s.status })),
  };
}
const roundMacros = (m: { kcal: number; protein: number; carbs: number; fat: number }) => ({ kcal: Math.round(m.kcal), protein: Math.round(m.protein), carbs: Math.round(m.carbs), fat: Math.round(m.fat) });

export default function Coach() {
  const profile = useProfile();
  const online = useOnline();
  const [chatId, setChatId] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState(false);
  const [showCtx, setShowCtx] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  const chats = useLiveQuery(() => db.chats.orderBy("updatedAt").reverse().toArray(), []);
  useEffect(() => {
    if (chats && chatId == null && chats[0]) setChatId(chats[0].id);
  }, [chats]);
  const messages = useLiveQuery(async () => (chatId ? (await db.chatMessages.where("chatId").equals(chatId).sortBy("createdAt")) : []), [chatId]);
  const ctx = useLiveQuery(buildContext, []);
  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [messages?.length, busy]);

  if (!profile || !chats || !messages) return <Loading />;

  async function send(content: string) {
    setError(null);
    let id = chatId;
    if (!id) {
      id = uid();
      await db.chats.add({ id, title: content.slice(0, 40), createdAt: Date.now(), updatedAt: Date.now() });
      setChatId(id);
    }
    await db.chatMessages.add({ chatId: id, role: "user", content, createdAt: Date.now() });
    await reply(id);
  }

  async function reply(id: string) {
    setBusy(true);
    try {
      const all = await db.chatMessages.where("chatId").equals(id).sortBy("createdAt");
      const r = await coachReply(all.filter((m) => !m.error).map((m) => ({ role: m.role, content: m.content })), await buildContext());
      await db.chatMessages.add({ chatId: id, role: "assistant", content: r.reply, createdAt: Date.now() });
      await db.chats.update(id, { updatedAt: Date.now() });
    } catch (e) {
      setError(e instanceof Error ? e.message : "The coach couldn't respond.");
    } finally {
      setBusy(false);
    }
  }

  const lastIsUser = messages.at(-1)?.role === "user";

  return (
    <div className="screen no-tabbar" style={{ paddingBottom: 140 }}>
      <Header
        title="AI Coach"
        back
        right={
          <>
            <button className="icon-btn" aria-label="Conversation history" onClick={() => setHistory(true)}><Icon name="more" /></button>
            <button className="icon-btn" aria-label="New conversation" onClick={() => { setChatId(null); setError(null); }}><Icon name="plus" /></button>
          </>
        }
      />
      <div className="notice" style={{ marginBottom: 10 }}>
        Independent assistant powered by Claude — not the original BWS coach. It sees your goal, targets, last 7 days of food totals, recent weigh-ins and workouts.{" "}
        <button className="btn ghost small" onClick={() => setShowCtx(true)}>See exactly what's shared</button>
      </div>
      {messages.length === 0 && <div className="empty">Ask about your training, nutrition or progress.</div>}
      {messages.map((m) => (
        <div key={m.id} className={`bubble ${m.role}`}>{m.content}</div>
      ))}
      {busy && <div className="bubble assistant" role="status"><span className="spinner" /></div>}
      {error && (
        <div className="notice error" role="alert">
          {error}{" "}
          {lastIsUser && chatId && <button className="btn ghost small" onClick={() => reply(chatId)}>Retry</button>}
        </div>
      )}
      <div ref={endRef} />
      <form
        className="composer"
        onSubmit={(e) => {
          e.preventDefault();
          const t = text.trim();
          if (!t || busy) return;
          setText("");
          send(t);
        }}
      >
        <input className="input grow" aria-label="Message the coach" placeholder={online ? "Message" : "Offline"} value={text} onChange={(e) => setText(e.target.value)} disabled={!online} />
        <button className="btn" disabled={!text.trim() || busy || !online}>Send</button>
      </form>

      <Sheet open={history} onClose={() => setHistory(false)} title="Conversations">
        <div className="list">
          {chats.length === 0 && <div className="empty">No conversations yet.</div>}
          {chats.map((c) => (
            <div key={c.id} className="list-item">
              <button className="grow" style={{ border: 0, background: "none", textAlign: "left", padding: 0 }} onClick={() => { setChatId(c.id); setHistory(false); }}>
                <div className="ellipsis" style={{ fontWeight: c.id === chatId ? 700 : 400 }}>{c.title}</div>
                <div className="faint">{longDate(new Date(c.updatedAt).toISOString().slice(0, 10))}</div>
              </button>
              <button className="icon-btn" aria-label={`Delete ${c.title}`} onClick={async () => { await db.chatMessages.where("chatId").equals(c.id).delete(); await db.chats.delete(c.id); if (c.id === chatId) setChatId(null); }}><Icon name="trash" /></button>
            </div>
          ))}
        </div>
      </Sheet>
      <Sheet open={showCtx} onClose={() => setShowCtx(false)} title="Data shared with the coach">
        <pre className="small" style={{ whiteSpace: "pre-wrap", background: "var(--surface-2)", padding: 10, borderRadius: 8 }}>{JSON.stringify(ctx, null, 2)}</pre>
      </Sheet>
    </div>
  );
}
