import { db, uid } from "../db/db";
import { DIET_PLANS, dietTargets, type Body } from "../db/diets";
import { WORKOUT_PLANS, planTemplateItems } from "../db/programs";
import type { ExerciseDef, WorkoutSession } from "../db/types";
import { today, weekStartOf } from "./dates";
import { PROGRAM_ID } from "./onboarding";
import { saveLayoutFrom } from "./schedule";
import { snapshotItems, startOrResume } from "./workout";

/** Switch to a workout plan from this week on. Past weeks and sessions are untouched. */
export async function applyWorkoutPlan(planId: string, weekStartsOn: 0 | 1) {
  const plan = WORKOUT_PLANS.find((p) => p.id === planId);
  if (!plan) throw new Error("Unknown plan");
  const now = Date.now();
  await db.templates.bulkPut(
    Object.entries(plan.days).map(([key, day]) => ({ id: `${plan.id}-${key}`, name: day.name, items: planTemplateItems(day), inLibrary: false, createdAt: now })),
  );
  // Plans are written Monday-first; rotate for weeks that start on Sunday.
  const monFirst = plan.week.map((k) => ({ templateId: k ? `${plan.id}-${k}` : null }));
  const slots = weekStartsOn === 0 ? [monFirst[6], ...monFirst.slice(0, 6)] : monFirst;
  await saveLayoutFrom(PROGRAM_ID, weekStartOf(today(), weekStartsOn), slots);
  await db.programs.put({ id: PROGRAM_ID, name: plan.name, createdAt: now, source: "provisional-template" });
  await db.profiles.update("me", { workoutPlanId: plan.id });
}

export async function currentBody(): Promise<Body | null> {
  const a = (await db.assessments.orderBy("createdAt").toArray()).at(-1);
  if (!a) return null;
  const w = (await db.weighins.orderBy("date").toArray()).at(-1);
  return { sex: a.sex, age: a.age, heightCm: a.heightCm, weightKg: w?.weightKg ?? a.weightKg, activity: a.activity };
}

/** Switch diet plan: new targets from today (history keeps old ones) and a new Weight Pacer. */
export async function applyDietPlan(planId: string) {
  const plan = DIET_PLANS.find((p) => p.id === planId);
  if (!plan) throw new Error("Unknown diet plan");
  const body = await currentBody();
  if (!body) throw new Error("Finish setting up your profile first.");
  const t = dietTargets(plan, body);
  await db.targets.add({ effectiveDate: today(), calories: t.calories, protein: t.protein, carbs: t.carbs, fat: t.fat, source: "manual", createdAt: Date.now() });
  await db.profiles.update("me", { weightPacerPctPerWeek: plan.pacer, dietPlanId: plan.id });
}

/**
 * Start (or continue) a free-form workout for today, optionally with an
 * exercise already added. Used for logging lifts outside the plan.
 */
export async function startQuickWorkout(weekStartsOn: 0 | 1, ex?: ExerciseDef): Promise<WorkoutSession> {
  const id = `quick-${uid()}`;
  await db.templates.put({ id, name: "Quick Workout", items: [], inLibrary: false, createdAt: Date.now() });
  const s = await startOrResume(today(), id, weekStartsOn);
  if (ex) await addExerciseToSession(s.id, ex);
  return (await db.sessions.get(s.id))!;
}

/** Append an exercise (3 empty sets) to a session — and to its template if it's a quick workout. */
export async function addExerciseToSession(sessionId: string, ex: ExerciseDef) {
  await db.transaction("rw", db.sessions, db.sets, db.templates, db.exercises, async () => {
    const s = await db.sessions.get(sessionId);
    if (!s) throw new Error("Workout not found");
    const item = { id: `x${uid()}`, exerciseId: ex.id, sets: 3, repMin: 8, repMax: 12 };
    const [snap] = await snapshotItems([item]);
    await db.sessions.update(sessionId, { items: [...s.items, snap] });
    await db.sets.bulkAdd(
      Array.from({ length: item.sets }, (_, index) => ({ sessionId, itemId: item.id, exerciseId: ex.id, index, type: "normal" as const, weight: null, reps: null, done: false })),
    );
    if (s.templateId.startsWith("quick-")) {
      const tpl = await db.templates.get(s.templateId);
      if (tpl) await db.templates.update(tpl.id, { items: [...tpl.items, item] });
    }
  });
}

/** Create a custom exercise (shows up everywhere exercises can be picked). */
export async function createCustomExercise(name: string, muscle: string, weighted: boolean): Promise<ExerciseDef> {
  const ex: ExerciseDef = { id: `custom-${uid()}`, name: name.trim(), muscle, equipment: weighted ? "Weights" : "Bodyweight", weighted, defaultRestSec: 90, locations: ["gym", "home"], alternatives: [], custom: true };
  await db.exercises.add(ex);
  return ex;
}
