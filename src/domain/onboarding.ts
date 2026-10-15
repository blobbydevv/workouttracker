import { db } from "../db/db";
import { SEED_EXERCISES, SEED_FOODS, provisionalLayout, provisionalTemplates } from "../db/seed";
import type { Assessment, Profile } from "../db/types";
import { today, weekStartOf } from "./dates";
import { saveLayoutFrom } from "./schedule";

export const PROGRAM_ID = "main";

/**
 * PROVISIONAL energy estimate: Mifflin-St Jeor x activity factor. The BWS
 * TDEE and target formulas are undisclosed (parity gap), so the UI labels
 * this as an estimate the user can edit.
 */
export function provisionalTargets(a: Pick<Assessment, "sex" | "age" | "heightCm" | "weightKg" | "activity" | "goal">) {
  const s = a.sex === "male" ? 5 : a.sex === "female" ? -161 : -78;
  const bmr = 10 * a.weightKg + 6.25 * a.heightCm - 5 * a.age + s;
  const factor = { sedentary: 1.2, light: 1.375, moderate: 1.55, very: 1.725 }[a.activity];
  const adj = { lose_fat: -400, build_muscle: 250, recomp: 0, maintain: 0 }[a.goal];
  const calories = Math.round((bmr * factor + adj) / 10) * 10;
  const protein = Math.round(a.weightKg * 1.8);
  const fat = Math.round((calories * 0.27) / 9);
  const carbs = Math.max(0, Math.round((calories - protein * 4 - fat * 9) / 4));
  return { calories, protein, carbs, fat };
}

export async function ensureSeeded(): Promise<void> {
  // Add any built-in exercises this device doesn't have yet (new ones ship with updates).
  const have = new Set(await db.exercises.toCollection().primaryKeys());
  const missing = SEED_EXERCISES.filter((e) => !have.has(e.id));
  if (missing.length) await db.exercises.bulkPut(missing);
  if ((await db.foods.filter((f) => !f.custom).count()) === 0) await db.foods.bulkPut(SEED_FOODS);
  if (!(await db.entitlements.get("membership"))) {
    await db.entitlements.put({
      id: "membership",
      status: "unverified",
      checkedAt: Date.now(),
      note: "No subscription service is configured in this build.",
    });
  }
}

export async function completeOnboarding(a: Omit<Assessment, "id" | "createdAt">, name: string, units: Profile["units"], weekStartsOn: 0 | 1): Promise<void> {
  await ensureSeeded();
  const now = Date.now();
  const t = provisionalTargets(a);
  const templates = provisionalTemplates(a.location);
  const layout = provisionalLayout(a.daysPerWeek);
  const pacer = { lose_fat: -0.5, build_muscle: 0.25, recomp: 0, maintain: 0 }[a.goal];

  await db.transaction("rw", [db.profiles, db.assessments, db.targets, db.programs, db.templates, db.weighins, db.programVersions], async () => {
    await db.assessments.add({ ...a, createdAt: now });
    await db.profiles.put({
      id: "me",
      name,
      units,
      weekStartsOn,
      weightPacerPctPerWeek: pacer,
      stepGoal: 8000,
      showCarbsFats: false,
      weighInReminder: false,
      onboardedAt: now,
      createdAt: now,
    });
    await db.targets.add({ effectiveDate: today(), ...t, source: "onboarding", createdAt: now });
    await db.programs.put({ id: PROGRAM_ID, name: "My Program", createdAt: now, source: "provisional-template" });
    const used = new Set(layout.filter(Boolean) as string[]);
    await db.templates.bulkPut(
      Object.values(templates)
        .filter((tpl) => used.has(tpl.id))
        .map((tpl) => ({ ...tpl, inLibrary: false, createdAt: now })),
    );
    await db.weighins.add({ date: today(), weightKg: a.weightKg, createdAt: now });
    await saveLayoutFrom(
      PROGRAM_ID,
      weekStartOf(today(), weekStartsOn),
      layout.map((templateId) => ({ templateId })),
    );
  });
}
