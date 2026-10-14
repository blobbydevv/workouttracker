import { useLiveQuery } from "dexie-react-hooks";
import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ExercisePicker } from "../components/ExercisePicker";
import { Icon } from "../components/Icon";
import { Confirm, Loading, NumberInput, Sheet, Unverified, fmt } from "../components/ui";
import { db } from "../db/db";
import type { ExerciseDef, SessionItemSnapshot, SetRecord, SetType, WorkoutSession } from "../db/types";
import { longDate } from "../domain/dates";
import { groupItems } from "../domain/items";
import { progressionCue, type Cue } from "../domain/progression";
import {
  addSet,
  adjustRest,
  deleteSet,
  discardSession,
  finishSession,
  lastPerformance,
  previousWeekSets,
  removeItemInSession,
  resolveRest,
  restKeyForExercise,
  restKeyForSuperset,
  saveRestPref,
  startRest,
  stopRest,
  supersetInSession,
  swapExerciseInSession,
  unsupersetInSession,
  updateSet,
} from "../domain/workout";
import { mmss, requestNotifications, restDoneAlert } from "../lib/alerts";
import { fromDisplay, toDisplay, useProfile } from "../lib/hooks";

const SET_TYPE_LABEL: Record<SetType, string> = { normal: "", warmup: "W", dropset: "D", deload: "DL" };
const REST_OPTIONS = Array.from({ length: 20 }, (_, i) => 15 * (i + 2)); // 0:30 … 5:15

export default function Session() {
  const { id } = useParams();
  const nav = useNavigate();
  const profile = useProfile();
  const session = useLiveQuery(async () => (await db.sessions.get(id!)) ?? null, [id]);
  const sets = useLiveQuery(() => db.sets.where("sessionId").equals(id!).toArray(), [id]);
  const defs = useLiveQuery(async () => new Map((await db.exercises.toArray()).map((e) => [e.id, e])), []);
  const extras = useLiveQuery(async () => {
    if (!session) return null;
    const cues = new Map<string, Cue>();
    const last = new Map<string, SetRecord[]>();
    for (const it of session.items) {
      cues.set(it.id, progressionCue({ weighted: it.weighted, repMin: it.repMin, repMax: it.repMax, previousWeekSets: await previousWeekSets(it.exerciseId, session.weekStart) }));
      last.set(it.id, await lastPerformance(it.exerciseId, session.id));
    }
    return { cues, last };
  }, [session?.id, session?.items.map((i) => i.exerciseId).join()]);

  const [now, setNow] = useState(Date.now());
  const [itemMenu, setItemMenu] = useState<SessionItemSnapshot | null>(null);
  const [setMenu, setSetMenu] = useState<SetRecord | null>(null);
  const [swapFor, setSwapFor] = useState<SessionItemSnapshot | null>(null);
  const [pairFor, setPairFor] = useState<SessionItemSnapshot | null>(null);
  const [restEdit, setRestEdit] = useState<{ key: string; title: string; members: ExerciseDef[] } | null>(null);
  const [restInfo, setRestInfo] = useState<{ sec: number; overridden: boolean; defaultSec: number } | null>(null);
  const [confirm, setConfirm] = useState<"finish" | "discard" | null>(null);
  const alerted = useRef<number | null>(null);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(t);
  }, []);

  // Rest completion: fires once per timer, also after returning to the app.
  useEffect(() => {
    const r = session?.rest;
    if (!r) return;
    if (now >= r.endsAt && alerted.current !== r.endsAt) {
      alerted.current = r.endsAt;
      restDoneAlert();
      stopRest(session.id);
    }
  }, [now, session]);

  useEffect(() => {
    if (restEdit) resolveRest(restEdit.key, restEdit.members).then(setRestInfo);
  }, [restEdit]);

  if (session === undefined || !sets || !defs || !profile) return <Loading />;
  if (session === null) return <div className="screen"><div className="empty">Workout not found. <Link to="/workout">Back to Workout</Link></div></div>;
  const s: WorkoutSession = session;
  const units = profile.units;
  const groups = groupItems(s.items);
  const elapsed = Math.floor(((s.finishedAt ?? now) - s.startedAt) / 1000);
  const doneCount = sets.filter((x) => x.done).length;

  const keyForGroup = (g: (typeof groups)[number]) => (g.supersetId && g.items.length > 1 ? restKeyForSuperset(s.templateId, g.supersetId) : restKeyForExercise(g.items[0].exerciseId));
  const membersOf = (g: (typeof groups)[number]) => g.items.map((i) => defs.get(i.exerciseId)).filter(Boolean) as ExerciseDef[];

  async function toggleDone(set: SetRecord, g: (typeof groups)[number]) {
    const done = !set.done;
    const patch: Partial<SetRecord> = { done };
    // Completing an empty set copies the previous performance as a starting point.
    if (done && set.reps == null) {
      const prev = extras?.last.get(set.itemId)?.[set.index];
      if (prev) Object.assign(patch, { reps: prev.reps, weight: set.weight ?? prev.weight });
    }
    await updateSet(set.id!, patch);
    if (!done || s.status === "completed") return;
    // In a superset, rest starts after the last exercise in the round.
    const isLastInGroup = g.items.at(-1)!.id === set.itemId;
    if (g.items.length > 1 && !isLastInGroup) return;
    const r = await resolveRest(keyForGroup(g), membersOf(g));
    await startRest(s.id, keyForGroup(g), r.sec);
  }

  const restLeft = s.rest ? (s.rest.endsAt - now) / 1000 : 0;

  return (
    <div className="screen no-tabbar">
      <header className="header">
        <button className="icon-btn" aria-label="Back" onClick={() => nav(-1)}><Icon name="back" /></button>
        <div className="grow">
          <div style={{ fontWeight: 700 }}>{s.name}</div>
          <div className="faint">
            {longDate(s.date)} · {s.status === "completed" ? `Completed · ${mmss(elapsed)}` : <span aria-label="Elapsed time">{mmss(elapsed)}</span>}
          </div>
        </div>
        <button className="icon-btn" aria-label="Workout options" onClick={() => setConfirm("discard")}><Icon name="more" /></button>
      </header>

      {groups.map((g, gi) => {
        const isSs = !!g.supersetId && g.items.length > 1;
        return (
          <section key={gi} className={`ex-card ${isSs ? "superset" : ""}`} aria-label={isSs ? "Superset" : g.items[0].exerciseName}>
            {isSs && (
              <div className="row between" style={{ padding: "8px 12px 0" }}>
                <span className="badge accent">Superset</span>
                <button className="btn ghost small" onClick={() => setRestEdit({ key: keyForGroup(g), title: "Superset rest", members: membersOf(g) })}><Icon name="timer" size={16} />Rest</button>
              </div>
            )}
            {g.items.map((it) => {
              const mySets = sets.filter((x) => x.itemId === it.id).sort((a, b) => a.index - b.index);
              const cue = extras?.cues.get(it.id);
              const last = extras?.last.get(it.id) ?? [];
              return (
                <div key={it.id} style={{ paddingBottom: 8 }}>
                  <div className="ex-head">
                    <div className="grow">
                      <h4>{it.exerciseName}</h4>
                      <div className="faint">{it.repMin}–{it.repMax} reps</div>
                    </div>
                    {!isSs && (
                      <button className="icon-btn" aria-label={`Rest timer for ${it.exerciseName}`} onClick={() => setRestEdit({ key: restKeyForExercise(it.exerciseId), title: `${it.exerciseName} rest`, members: membersOf({ items: [it] }) })}>
                        <Icon name="timer" />
                      </button>
                    )}
                    <Link className="icon-btn" to={`/progress/exercise/${it.exerciseId}`} aria-label={`Progress graph for ${it.exerciseName}`}><Icon name="chart" /></Link>
                    <button className="icon-btn" aria-label={`Options for ${it.exerciseName}`} onClick={() => setItemMenu(it)}><Icon name="more" /></button>
                  </div>
                  {cue && cue.kind !== "none" && <div className="cue" role="note"><Icon name="chart" size={14} />{cue.label}</div>}
                  <div className="set-grid head">
                    <span>Set</span><span>Previous</span><span>{units}</span><span>Reps</span><span />
                  </div>
                  {mySets.map((set) => {
                    const prev = last[set.index];
                    return (
                      <div key={set.id} className={`set-grid ${set.done ? "done" : ""}`}>
                        <button className="set-idx" aria-label={`Set ${set.index + 1} options`} onClick={() => setSetMenu(set)}>{SET_TYPE_LABEL[set.type] || set.index + 1}</button>
                        <span className="faint" style={{ textAlign: "center" }}>{prev ? `${fmt(toDisplay(prev.weight, units), 1)}×${prev.reps}` : "–"}</span>
                        <NumberInput label={`Set ${set.index + 1} weight`} value={toDisplay(set.weight, units)} placeholder={prev ? fmt(toDisplay(prev.weight, units), 1) : "0"} onChange={(v) => updateSet(set.id!, { weight: fromDisplay(v, units) })} />
                        <NumberInput label={`Set ${set.index + 1} reps`} inputMode="numeric" value={set.reps} placeholder={prev ? String(prev.reps) : String(it.repMin)} onChange={(v) => updateSet(set.id!, { reps: v == null ? null : Math.round(v) })} />
                        <button className={`set-done ${set.done ? "on" : ""}`} aria-pressed={set.done} aria-label={`Complete set ${set.index + 1}`} onClick={() => toggleDone(set, g)}>
                          <Icon name="check" size={18} />
                        </button>
                      </div>
                    );
                  })}
                  <button className="btn ghost small" style={{ marginLeft: 8 }} onClick={() => addSet(s.id, it.id, it.exerciseId)}><Icon name="plus" size={16} />Add Set</button>
                </div>
              );
            })}
          </section>
        );
      })}

      {s.rest && restLeft > 0 && (
        <div className="rest-bar" role="timer" aria-label="Rest timer">
          <Icon name="timer" />
          <span className="time">{mmss(restLeft)}</span>
          <button onClick={() => adjustRest(s.id, -15)} aria-label="Subtract 15 seconds">−15</button>
          <button onClick={() => adjustRest(s.id, 15)} aria-label="Add 15 seconds">+15</button>
          <button onClick={() => stopRest(s.id)}>Skip</button>
        </div>
      )}

      <div className="bottom-bar">
        {s.status === "completed" ? (
          <button className="btn block" onClick={() => nav("/workout")}>Done</button>
        ) : (
          <button className="btn block" onClick={() => setConfirm("finish")}>Finish Workout · {doneCount} {doneCount === 1 ? "set" : "sets"}</button>
        )}
      </div>

      <Sheet open={!!itemMenu} onClose={() => setItemMenu(null)} title={itemMenu?.exerciseName}>
        {itemMenu && (
          <>
            <button className="menu-item" onClick={() => { setSwapFor(itemMenu); setItemMenu(null); }}><Icon name="swap" />Swap Exercise</button>
            <button className="menu-item" onClick={() => { setPairFor(itemMenu); setItemMenu(null); }}><Icon name="link" />Superset With</button>
            {itemMenu.supersetId && s.items.filter((i) => i.supersetId === itemMenu.supersetId).length > 1 && (
              <button className="menu-item" onClick={() => { unsupersetInSession(s, itemMenu.id); setItemMenu(null); }}><Icon name="link" />Remove from Superset</button>
            )}
            <button className="menu-item" onClick={() => { const it = itemMenu; setItemMenu(null); setRestEdit({ key: restKeyForExercise(it.exerciseId), title: `${it.exerciseName} rest`, members: membersOf({ items: [it] }) }); }}><Icon name="timer" />Rest Timer</button>
            <button className="menu-item" onClick={() => nav(`/progress/exercise/${itemMenu.exerciseId}`)}><Icon name="chart" />Exercise History</button>
            <button className="menu-item danger" onClick={() => { removeItemInSession(s, itemMenu.id); setItemMenu(null); }}><Icon name="trash" />Remove from this workout</button>
          </>
        )}
      </Sheet>

      <Sheet open={!!setMenu} onClose={() => setSetMenu(null)} title={setMenu ? `Set ${setMenu.index + 1}` : ""}>
        {setMenu && (
          <>
            {(["normal", "warmup", "dropset", "deload"] as SetType[]).map((t) => (
              <button key={t} className="menu-item" aria-pressed={setMenu.type === t} onClick={() => { updateSet(setMenu.id!, { type: t }); setSetMenu(null); }}>
                {setMenu.type === t ? <Icon name="check" /> : <span style={{ width: 22 }} />}
                {{ normal: "Working set", warmup: "Warmup set", dropset: "Dropset", deload: "Deload set" }[t]}
              </button>
            ))}
            <button className="menu-item danger" onClick={() => { deleteSet(setMenu.id!); setSetMenu(null); }}><Icon name="trash" />Delete Set</button>
          </>
        )}
      </Sheet>

      <Sheet open={!!pairFor} onClose={() => setPairFor(null)} title="Superset With">
        <div className="list">
          {pairFor && s.items.filter((i) => i.id !== pairFor.id && (!pairFor.supersetId || i.supersetId !== pairFor.supersetId)).map((i) => (
            <button key={i.id} className="list-item" onClick={() => { supersetInSession(s, pairFor.id, i.id); setPairFor(null); }}>
              <div className="grow">{i.exerciseName}</div>
            </button>
          ))}
        </div>
      </Sheet>

      <Sheet open={!!restEdit} onClose={() => { setRestEdit(null); setRestInfo(null); }} title={restEdit?.title}>
        {restEdit && restInfo && (
          <>
            <p className="faint">Default {mmss(restInfo.defaultSec)}{restInfo.overridden ? ` · your saved time ${mmss(restInfo.sec)}` : ""}</p>
            <div className="chips" role="listbox" aria-label="Rest duration">
              {REST_OPTIONS.map((sec) => (
                <button
                  key={sec}
                  className="chip"
                  role="option"
                  aria-selected={restInfo.sec === sec}
                  aria-pressed={restInfo.sec === sec}
                  onClick={async () => {
                    await saveRestPref(restEdit.key, sec);
                    setRestInfo({ ...restInfo, sec, overridden: true });
                    if (s.rest?.key === restEdit.key) await startRest(s.id, restEdit.key, Math.max(0, sec - (s.rest.durationSec - restLeft)));
                  }}
                >
                  {mmss(sec)}
                </button>
              ))}
            </div>
            {restInfo.sec < restInfo.defaultSec && <p className="small" style={{ color: "var(--warn)" }}>Shorter than the recommended minimum rest for this exercise.</p>}
            <div className="list" style={{ gap: 8, marginTop: 12 }}>
              {restInfo.overridden && (
                <button className="btn block secondary" onClick={async () => { await db.restPrefs.delete(restEdit.key); setRestInfo({ ...restInfo, sec: restInfo.defaultSec, overridden: false }); }}>Reset to default</button>
              )}
              {typeof Notification !== "undefined" && Notification.permission === "default" && (
                <button className="btn block ghost" onClick={() => requestNotifications()}>Allow rest-complete notifications</button>
              )}
            </div>
            <Unverified>Picker style, timer placement and alert sound are provisional; default rest values are placeholders, not BWS's exercise-specific defaults.</Unverified>
          </>
        )}
      </Sheet>

      <ExercisePicker open={!!swapFor} onClose={() => setSwapFor(null)} title="Swap Exercise" forExerciseId={swapFor?.exerciseId} onPick={(e) => swapExerciseInSession(s, swapFor!.id, e)} />

      <Confirm
        open={confirm === "finish"}
        title="Finish workout?"
        body={doneCount === 0 ? "No sets are marked complete." : `${doneCount} sets completed.`}
        confirmLabel="Finish Workout"
        onClose={() => setConfirm(null)}
        onConfirm={async () => { await finishSession(s.id); }}
      />
      <Confirm
        open={confirm === "discard"}
        title="Discard workout?"
        body="All sets logged in this session will be deleted."
        confirmLabel="Discard Workout"
        danger
        onClose={() => setConfirm(null)}
        onConfirm={async () => { await discardSession(s.id); nav("/workout", { replace: true }); }}
      />
    </div>
  );
}
