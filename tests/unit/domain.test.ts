import { beforeEach, describe, expect, it } from "vitest";
import { useDatabase } from "../../src/db/db";
import { addDays, monthGrid, weekStartOf } from "../../src/domain/dates";
import { groupItems, removeFromSuperset, supersetWith } from "../../src/domain/items";
import { progressionCue } from "../../src/domain/progression";
import { canLogWeek, moveSlot, saveLayoutFrom, versionForWeek, weekStatus } from "../../src/domain/schedule";
import { classifyPace, checkinAvailability, submitCheckIn, summarize, currentTarget } from "../../src/domain/checkin";
import { sumEntries } from "../../src/domain/nutrition";
import { completeOnboarding } from "../../src/domain/onboarding";
import { startOrResume, finishSession, updateSet, previousWeekSets } from "../../src/domain/workout";
import type { TemplateItem } from "../../src/db/types";

let n = 0;
beforeEach(() => {
  useDatabase(`test-${++n}`);
});

describe("progression cues (documented rules)", () => {
  const base = { weighted: true, repMin: 8, repMax: 12 };
  it("ceiling reached -> increase weight", () => {
    expect(progressionCue({ ...base, previousWeekSets: [{ weight: 50, reps: 12, done: true }, { weight: 50, reps: 12, done: true }] }).kind).toBe("increase");
  });
  it("within range -> add reps", () => {
    expect(progressionCue({ ...base, previousWeekSets: [{ weight: 50, reps: 12, done: true }, { weight: 50, reps: 10, done: true }] }).kind).toBe("add_reps");
  });
  it("below minimum -> decrease weight", () => {
    expect(progressionCue({ ...base, previousWeekSets: [{ weight: 50, reps: 9, done: true }, { weight: 50, reps: 6, done: true }] }).kind).toBe("decrease");
  });
  it("bodyweight -> no cue", () => {
    expect(progressionCue({ ...base, weighted: false, previousWeekSets: [{ weight: 0, reps: 20, done: true }] })).toEqual({ kind: "none", reason: "bodyweight" });
  });
  it("no previous week -> no cue", () => {
    expect(progressionCue({ ...base, previousWeekSets: null }).kind).toBe("none");
  });
});

describe("dates", () => {
  it("week start honours Sunday/Monday setting", () => {
    expect(weekStartOf("2026-10-14", 1)).toBe("2026-10-12");
    expect(weekStartOf("2026-10-14", 0)).toBe("2026-10-11");
  });
  it("month grid covers whole month", () => {
    const g = monthGrid("2026-10-14", 1);
    expect(g.flat()).toContain("2026-10-01");
    expect(g.flat()).toContain("2026-10-31");
    expect(g.every((r) => r.length === 7)).toBe(true);
  });
});

describe("supersets", () => {
  const items: TemplateItem[] = [
    { id: "a", exerciseId: "x", sets: 3, repMin: 8, repMax: 12 },
    { id: "b", exerciseId: "y", sets: 3, repMin: 8, repMax: 12 },
    { id: "c", exerciseId: "z", sets: 3, repMin: 8, repMax: 12 },
  ];
  it("Superset With pairs and moves partner adjacent", () => {
    const next = supersetWith(items, "a", "c", () => "S");
    expect(next.map((i) => i.id)).toEqual(["a", "c", "b"]);
    expect(groupItems(next).map((g) => g.items.length)).toEqual([2, 1]);
  });
  it("removing a member breaks that pairing; lone member ungrouped", () => {
    const paired = supersetWith(items, "a", "c", () => "S");
    const next = removeFromSuperset(paired, "c");
    expect(next.every((i) => !i.supersetId)).toBe(true);
  });
  it("removing one of three keeps the rest grouped", () => {
    let next = supersetWith(items, "a", "b", () => "S");
    next = supersetWith(next, "a", "c", () => "T");
    next = removeFromSuperset(next, "b");
    expect(next.filter((i) => i.supersetId === "S").map((i) => i.id)).toEqual(["a", "c"]);
  });
});

describe("schedule versions", () => {
  it("edits propagate to future weeks but not past weeks", async () => {
    const w0 = "2026-10-05";
    const w1 = "2026-10-12";
    const slots = (t: string | null) => Array.from({ length: 7 }, () => ({ templateId: t }));
    await saveLayoutFrom("p", w0, slots("A"));
    await saveLayoutFrom("p", w1, slots("B"));
    expect((await versionForWeek("p", w0))!.slots[0].templateId).toBe("A");
    expect((await versionForWeek("p", addDays(w1, 21)))!.slots[0].templateId).toBe("B");
  });
  it("drag swaps two days", () => {
    const s = [{ templateId: "A" }, { templateId: null }, { templateId: "B" }];
    expect(moveSlot(s, 0, 1).map((x) => x.templateId)).toEqual([null, "A", "B"]);
  });
  it("future weeks cannot be logged", () => {
    expect(canLogWeek(weekStatus("2026-10-19", "2026-10-12"))).toBe(false);
    expect(canLogWeek(weekStatus("2026-10-05", "2026-10-12"))).toBe(true);
  });
});

describe("check-in", () => {
  it("classifies pace against pacer", () => {
    expect(classifyPace(-0.5, -0.5)).toBe("on_track");
    expect(classifyPace(-1.2, -0.5)).toBe("too_fast");
    expect(classifyPace(0.1, -0.5)).toBe("too_slow");
  });
  it("submitting creates new target and locks for 7 days", async () => {
    await completeOnboarding(
      { experience: "beginner", goal: "lose_fat", location: "gym", daysPerWeek: 3, priorityMuscles: [], sex: "male", age: 30, heightCm: 180, weightKg: 80, activity: "light" },
      "T",
      "kg",
      1,
    );
    const { db } = await import("../../src/db/db");
    const { today } = await import("../../src/domain/dates");
    const d = today();
    await db.weighins.bulkAdd([
      { date: addDays(d, -12), weightKg: 81, createdAt: 0 },
      { date: addDays(d, -4), weightKg: 80, createdAt: 0 },
    ]);
    const s = await summarize(d, -0.5);
    expect(s.ratePctPerWeek).not.toBeNull();
    await submitCheckIn(d, -0.5, 2000);
    expect((await currentTarget(d))!.calories).toBe(2000);
    expect((await checkinAvailability(addDays(d, 3))).available).toBe(false);
    expect((await checkinAvailability(addDays(d, 7))).available).toBe(true);
  });
});

describe("sessions", () => {
  it("resumes the same session and feeds next week's progression", async () => {
    await completeOnboarding(
      { experience: "beginner", goal: "build_muscle", location: "gym", daysPerWeek: 3, priorityMuscles: [], sex: "female", age: 28, heightCm: 165, weightKg: 60, activity: "moderate" },
      "T",
      "kg",
      1,
    );
    const { db } = await import("../../src/db/db");
    const s1 = await startOrResume("2026-10-06", "fullA", 1);
    const again = await startOrResume("2026-10-06", "fullA", 1);
    expect(again.id).toBe(s1.id);
    const sets = await db.sets.where("sessionId").equals(s1.id).toArray();
    const first = sets.filter((s) => s.itemId === s1.items[0].id);
    for (const s of first) await updateSet(s.id!, { weight: 60, reps: 10, done: true });
    await finishSession(s1.id);
    const prev = await previousWeekSets(s1.items[0].exerciseId, "2026-10-12");
    expect(prev!.filter((p) => p.done)).toHaveLength(first.length);
  });
});

describe("nutrition totals", () => {
  it("sums servings x per-serving macros", () => {
    const t = sumEntries([
      { date: "d", slot: "lunch", kind: "food", name: "x", servings: 2, servingLabel: "", perServing: { kcal: 100, protein: 10, carbs: 5, fat: 2 }, createdAt: 0 },
      { date: "d", slot: "dinner", kind: "quick", name: "y", servings: 1, servingLabel: "", perServing: { kcal: 50, protein: 0, carbs: 10, fat: 0 }, createdAt: 0 },
    ]);
    expect(t).toEqual({ kcal: 250, protein: 20, carbs: 20, fat: 4 });
  });
});

describe("exercise progress", () => {
  it("takes the heaviest working set per workout, oldest first, ignoring warmups", async () => {
    const { exerciseProgress } = await import("../../src/domain/workout");
    const { niceTicks } = await import("../../src/components/ProgressChart");
    const s = (id: string, date: string) => ({ id, date, weekStart: date, templateId: "t", name: "W", items: [], status: "completed" as const, startedAt: 0 });
    const set = (sessionId: string, weight: number, reps: number, type: "normal" | "warmup" = "normal") => ({ sessionId, itemId: "i", exerciseId: "bench", index: 0, type, weight, reps, done: true });
    const p = exerciseProgress([
      { session: s("b", "2026-10-08"), sets: [set("b", 40, 12, "warmup"), set("b", 62.5, 8), set("b", 62.5, 9), set("b", 60, 10)] },
      { session: s("a", "2026-10-01"), sets: [set("a", 60, 8), set("a", 60, 7)] },
    ]);
    expect(p.map((x) => [x.date, x.topWeight, x.topReps, x.totalReps])).toEqual([
      ["2026-10-01", 60, 8, 15],
      ["2026-10-08", 62.5, 9, 27],
    ]);
    expect(niceTicks(60, 62.5)).toEqual([60, 61, 62, 63]);
  });
});

describe("plan libraries", () => {
  it("every workout plan uses real exercises, a valid week and consecutive supersets", async () => {
    const { WORKOUT_PLANS } = await import("../../src/db/programs");
    const { SEED_EXERCISES } = await import("../../src/db/seed");
    const ids = new Set(SEED_EXERCISES.map((e) => e.id));
    expect(WORKOUT_PLANS.length).toBeGreaterThanOrEqual(10);
    for (const p of WORKOUT_PLANS) {
      expect(p.week).toHaveLength(7);
      expect(p.week.filter(Boolean)).toHaveLength(p.daysPerWeek);
      for (const k of p.week) if (k) expect(p.days[k], `${p.id}.${k}`).toBeTruthy();
      for (const [key, d] of Object.entries(p.days)) {
        for (const [ex, sets, lo, hi] of d.items) {
          expect(ids.has(ex), `${p.id}/${key}: ${ex}`).toBe(true);
          expect(sets).toBeGreaterThan(0);
          expect(lo).toBeLessThanOrEqual(hi);
        }
        // Superset members must be next to each other to group on screen.
        const ss = d.items.map((i) => i[4]);
        ss.forEach((g, i) => { if (g && ss.indexOf(g) !== i) expect(ss[i - 1], `${p.id}/${key}`).toBe(g); });
      }
    }
  });
  it("diet targets add up and respect a safe minimum", async () => {
    const { DIET_PLANS, dietTargets } = await import("../../src/db/diets");
    expect(DIET_PLANS.length).toBeGreaterThanOrEqual(10);
    const body = { sex: "male" as const, age: 30, heightCm: 180, weightKg: 80, activity: "light" as const };
    for (const d of DIET_PLANS) {
      const t = dietTargets(d, body);
      expect(Math.abs(t.protein * 4 + t.carbs * 4 + t.fat * 9 - t.calories)).toBeLessThan(15);
      expect(t.calories).toBeGreaterThanOrEqual(1500);
    }
    const keto = dietTargets(DIET_PLANS.find((d) => d.id === "keto")!, body);
    expect(keto.carbs).toBe(40);
    const bulk = dietTargets(DIET_PLANS.find((d) => d.id === "lean-bulk")!, body);
    expect(bulk.calories).toBeGreaterThan(bulk.maintenance);
  });
});
