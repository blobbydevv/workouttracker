import { db, uid } from "../db/db";
import type { ExerciseDef, ISODate, SessionItemSnapshot, SetRecord, SetType, TemplateItem, WorkoutSession } from "../db/types";
import { addDays, weekStartOf } from "./dates";
import { replaceExercise, removeFromSuperset, removeItem, supersetWith } from "./items";
import type { PrevSet } from "./progression";

export async function findSession(date: ISODate, templateId: string): Promise<WorkoutSession | undefined> {
  return (await db.sessions.where("date").equals(date).toArray()).find((s) => s.templateId === templateId);
}

export async function snapshotItems(items: TemplateItem[]): Promise<SessionItemSnapshot[]> {
  const defs = await db.exercises.bulkGet(items.map((i) => i.exerciseId));
  return items.map((i, k) => ({ ...i, exerciseName: defs[k]?.name ?? "Unknown exercise", weighted: defs[k]?.weighted ?? true }));
}

/** Starts a new session or returns the existing one for that day (Resume Workout). */
export async function startOrResume(date: ISODate, templateId: string, weekStartsOn: 0 | 1): Promise<WorkoutSession> {
  const existing = await findSession(date, templateId);
  if (existing) return existing;
  const tpl = await db.templates.get(templateId);
  if (!tpl) throw new Error("Workout not found");
  const session: WorkoutSession = {
    id: uid(),
    date,
    weekStart: weekStartOf(date, weekStartsOn),
    templateId,
    name: tpl.name,
    items: await snapshotItems(tpl.items),
    status: "in_progress",
    startedAt: Date.now(),
    rest: null,
  };
  const sets: SetRecord[] = session.items.flatMap((it) =>
    Array.from({ length: it.sets }, (_, index) => ({
      sessionId: session.id,
      itemId: it.id,
      exerciseId: it.exerciseId,
      index,
      type: "normal" as SetType,
      weight: null,
      reps: null,
      done: false,
    })),
  );
  await db.transaction("rw", db.sessions, db.sets, async () => {
    await db.sessions.add(session);
    await db.sets.bulkAdd(sets);
  });
  return session;
}

export async function activeSession(): Promise<WorkoutSession | undefined> {
  return db.sessions.where("status").equals("in_progress").first();
}

/** Sets performed for an exercise in the week before `weekStart` (progression input). */
export async function previousWeekSets(exerciseId: string, weekStart: ISODate): Promise<PrevSet[] | null> {
  const prevStart = addDays(weekStart, -7);
  const sessions = await db.sessions.where("weekStart").equals(prevStart).toArray();
  if (sessions.length === 0) return null;
  const ids = new Set(sessions.map((s) => s.id));
  const sets = (await db.sets.where("exerciseId").equals(exerciseId).toArray()).filter((s) => ids.has(s.sessionId) && s.type !== "warmup");
  return sets.length ? sets : null;
}

/** Most recent completed sets for an exercise before this session (shown as "previous"). */
export async function lastPerformance(exerciseId: string, beforeSessionId: string): Promise<SetRecord[]> {
  const all = await db.sets.where("exerciseId").equals(exerciseId).toArray();
  const sessionIds = [...new Set(all.map((s) => s.sessionId))].filter((id) => id !== beforeSessionId);
  const sessions = (await db.sessions.bulkGet(sessionIds)).filter(Boolean) as WorkoutSession[];
  const latest = sessions.sort((a, b) => b.startedAt - a.startedAt)[0];
  if (!latest) return [];
  return all.filter((s) => s.sessionId === latest.id && s.done).sort((a, b) => a.index - b.index);
}

export async function updateSet(id: number, patch: Partial<SetRecord>): Promise<void> {
  if (patch.done) patch.completedAt = Date.now();
  await db.sets.update(id, patch);
}

export async function addSet(sessionId: string, itemId: string, exerciseId: string): Promise<void> {
  const sets = await db.sets.where("[sessionId+itemId]").equals([sessionId, itemId]).toArray();
  await db.sets.add({ sessionId, itemId, exerciseId, index: sets.length, type: "normal", weight: null, reps: null, done: false });
}

export async function deleteSet(id: number): Promise<void> {
  const s = await db.sets.get(id);
  if (!s) return;
  await db.sets.delete(id);
  const rest = (await db.sets.where("[sessionId+itemId]").equals([s.sessionId, s.itemId]).toArray()).sort((a, b) => a.index - b.index);
  await Promise.all(rest.map((r, i) => db.sets.update(r.id!, { index: i })));
}

// ---------- rest timer ----------

export const restKeyForExercise = (exerciseId: string) => `ex:${exerciseId}`;
export const restKeyForSuperset = (templateId: string, supersetId: string) => `ss:${templateId}:${supersetId}`;

/** Saved override, else the exercise default (superset default: longest member default — assumption). */
export async function resolveRest(key: string, members: ExerciseDef[]): Promise<{ sec: number; overridden: boolean; defaultSec: number }> {
  const defaultSec = Math.max(...members.map((m) => m.defaultRestSec), 60);
  const pref = await db.restPrefs.get(key);
  return pref ? { sec: pref.restSec, overridden: true, defaultSec } : { sec: defaultSec, overridden: false, defaultSec };
}

export async function saveRestPref(key: string, restSec: number): Promise<void> {
  await db.restPrefs.put({ key, restSec, updatedAt: Date.now() });
}

export async function startRest(sessionId: string, key: string, durationSec: number): Promise<void> {
  await db.sessions.update(sessionId, { rest: { endsAt: Date.now() + durationSec * 1000, durationSec, key } });
}

export async function adjustRest(sessionId: string, deltaSec: number): Promise<void> {
  const s = await db.sessions.get(sessionId);
  if (!s?.rest) return;
  await db.sessions.update(sessionId, { rest: { ...s.rest, endsAt: s.rest.endsAt + deltaSec * 1000, durationSec: s.rest.durationSec + deltaSec } });
}

export async function stopRest(sessionId: string): Promise<void> {
  await db.sessions.update(sessionId, { rest: null });
}

// ---------- structure edits (session + template) ----------

async function editBoth(session: WorkoutSession, fn: <T extends TemplateItem>(items: T[]) => T[], alsoTemplate: boolean) {
  await db.transaction("rw", db.sessions, db.templates, async () => {
    await db.sessions.update(session.id, { items: fn(session.items) });
    if (alsoTemplate) {
      const tpl = await db.templates.get(session.templateId);
      if (tpl) await db.templates.update(tpl.id, { items: fn(tpl.items) });
    }
  });
}

export async function swapExerciseInSession(session: WorkoutSession, itemId: string, ex: ExerciseDef, alsoTemplate = true) {
  await db.transaction("rw", db.sessions, db.templates, db.sets, async () => {
    await db.sessions.update(session.id, {
      items: session.items.map((i) => (i.id === itemId ? { ...i, exerciseId: ex.id, exerciseName: ex.name, weighted: ex.weighted } : i)),
    });
    if (alsoTemplate) {
      const tpl = await db.templates.get(session.templateId);
      if (tpl) await db.templates.update(tpl.id, { items: replaceExercise(tpl.items, itemId, { exerciseId: ex.id }) });
    }
    // Unlogged sets follow the new exercise; logged sets keep their history.
    const sets = await db.sets.where("[sessionId+itemId]").equals([session.id, itemId]).toArray();
    await Promise.all(sets.filter((s) => !s.done).map((s) => db.sets.update(s.id!, { exerciseId: ex.id })));
  });
}

export async function supersetInSession(session: WorkoutSession, itemId: string, partnerId: string) {
  await editBoth(session, (items) => supersetWith(items, itemId, partnerId, uid), true);
}

export async function unsupersetInSession(session: WorkoutSession, itemId: string) {
  await editBoth(session, (items) => removeFromSuperset(items, itemId), true);
}

export async function removeItemInSession(session: WorkoutSession, itemId: string) {
  await editBoth(session, (items) => removeItem(items, itemId), false);
  await db.sets.where("[sessionId+itemId]").equals([session.id, itemId]).delete();
}

export async function finishSession(sessionId: string): Promise<void> {
  await db.sessions.update(sessionId, { status: "completed", finishedAt: Date.now(), rest: null });
}

export async function discardSession(sessionId: string): Promise<void> {
  await db.transaction("rw", db.sessions, db.sets, async () => {
    await db.sets.where("sessionId").equals(sessionId).delete();
    await db.sessions.delete(sessionId);
  });
}

// ---------- history & PRs (derived) ----------

export const e1rm = (w: number, r: number) => (r <= 1 ? w : w * (1 + r / 30)); // Epley, display only

export interface ExerciseHistoryRow {
  session: WorkoutSession;
  sets: SetRecord[];
}

export async function exerciseHistory(exerciseId: string): Promise<ExerciseHistoryRow[]> {
  const sets = (await db.sets.where("exerciseId").equals(exerciseId).toArray()).filter((s) => s.done);
  const ids = [...new Set(sets.map((s) => s.sessionId))];
  const sessions = (await db.sessions.bulkGet(ids)).filter(Boolean) as WorkoutSession[];
  return sessions
    .sort((a, b) => (a.date < b.date ? 1 : -1))
    .map((session) => ({ session, sets: sets.filter((s) => s.sessionId === session.id).sort((a, b) => a.index - b.index) }));
}

export function personalRecords(rows: ExerciseHistoryRow[]) {
  let heaviest: SetRecord | null = null;
  let best1rm: { set: SetRecord; value: number } | null = null;
  let mostReps: SetRecord | null = null;
  for (const r of rows)
    for (const s of r.sets) {
      if (s.type === "warmup" || s.weight == null || s.reps == null) continue;
      if (!heaviest || s.weight > (heaviest.weight ?? 0)) heaviest = s;
      if (!mostReps || s.reps > (mostReps.reps ?? 0)) mostReps = s;
      const v = e1rm(s.weight, s.reps);
      if (!best1rm || v > best1rm.value) best1rm = { set: s, value: v };
    }
  return { heaviest, best1rm, mostReps };
}

export interface ProgressEntry {
  date: string;
  sessionId: string;
  topWeight: number; // kg, heaviest working set
  topReps: number; // reps on that heaviest set
  totalReps: number; // all working-set reps that session
  bestE1rm: number;
}

/**
 * One entry per workout for an exercise, oldest first. Warmups and sets
 * without weight/reps are ignored. The "top set" is the heaviest working
 * set (ties: more reps).
 */
export function exerciseProgress(rows: ExerciseHistoryRow[]): ProgressEntry[] {
  const out: ProgressEntry[] = [];
  for (const r of rows) {
    const work = r.sets.filter((s) => s.type !== "warmup" && s.weight != null && s.reps != null && s.reps > 0);
    if (!work.length) continue;
    const top = work.reduce((a, s) => (s.weight! > a.weight! || (s.weight === a.weight && s.reps! > a.reps!) ? s : a));
    out.push({
      date: r.session.date,
      sessionId: r.session.id,
      topWeight: top.weight!,
      topReps: top.reps!,
      totalReps: work.reduce((a, s) => a + s.reps!, 0),
      bestE1rm: Math.max(...work.map((s) => e1rm(s.weight!, s.reps!))),
    });
  }
  return out.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
}
