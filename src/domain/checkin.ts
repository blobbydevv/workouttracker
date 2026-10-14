// Nutrition Check-In.
// Documented (support articles): reports average-weight change for the week,
// whether the pace is too fast / too slow / on track against the Weight
// Pacer, average daily calories; any logged day counts; a completed check-in
// cannot be reopened for at least 7 days.
// UNDISCLOSED (parity gap): the calorie-adjustment formula, its 90-day
// recency weighting and the confidence level. This module computes the
// documented observations only; the new calorie target is chosen by the user.
import { db } from "../db/db";
import type { ISODate, NutritionTarget, WeighIn } from "../db/types";
import { addDays, daysBetween } from "./dates";
import { sumEntries } from "./nutrition";

export const CHECKIN_LOCK_DAYS = 7;

export async function currentTarget(date: ISODate): Promise<NutritionTarget | undefined> {
  const all = await db.targets.where("effectiveDate").belowOrEqual(date).toArray();
  return all.sort((a, b) => (a.effectiveDate === b.effectiveDate ? a.createdAt - b.createdAt : a.effectiveDate < b.effectiveDate ? -1 : 1)).at(-1);
}

export function average(xs: number[]): number | null {
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null;
}

export function windowAvg(weighins: WeighIn[], from: ISODate, to: ISODate): number | null {
  return average(weighins.filter((w) => w.date >= from && w.date <= to).map((w) => w.weightKg));
}

/**
 * Pace classification against the pacer. The tolerance band is NOT documented;
 * PACE_TOLERANCE is a provisional, visibly-labelled assumption.
 */
export const PACE_TOLERANCE = 0.15; // % body weight per week
export type Pace = "too_fast" | "too_slow" | "on_track";
export function classifyPace(rate: number, pacer: number): Pace {
  const diff = rate - pacer;
  if (Math.abs(diff) <= PACE_TOLERANCE) return "on_track";
  // "Too fast" = moving further in the pacer's direction than intended.
  if (pacer < 0) return diff < 0 ? "too_fast" : "too_slow";
  if (pacer > 0) return diff > 0 ? "too_fast" : "too_slow";
  return Math.abs(rate) > PACE_TOLERANCE ? "too_fast" : "on_track";
}

export interface CheckInSummary {
  avgWeightKg: number | null;
  prevAvgWeightKg: number | null;
  ratePctPerWeek: number | null;
  pace: Pace | null;
  avgCalories: number | null;
  daysLogged: number;
}

export async function summarize(date: ISODate, pacer: number): Promise<CheckInSummary> {
  const weekFrom = addDays(date, -6);
  const prevFrom = addDays(date, -13);
  const prevTo = addDays(date, -7);
  const weighins = await db.weighins.where("date").between(prevFrom, date, true, true).toArray();
  const avgWeightKg = windowAvg(weighins, weekFrom, date);
  const prevAvgWeightKg = windowAvg(weighins, prevFrom, prevTo);
  const ratePctPerWeek = avgWeightKg != null && prevAvgWeightKg != null ? ((avgWeightKg - prevAvgWeightKg) / prevAvgWeightKg) * 100 : null;
  const entries = await db.foodLog.where("date").between(weekFrom, date, true, true).toArray();
  const days = [...new Set(entries.map((e) => e.date))];
  const avgCalories = average(days.map((d) => sumEntries(entries.filter((e) => e.date === d)).kcal));
  return {
    avgWeightKg,
    prevAvgWeightKg,
    ratePctPerWeek,
    pace: ratePctPerWeek == null ? null : classifyPace(ratePctPerWeek, pacer),
    avgCalories,
    daysLogged: days.length,
  };
}

export async function checkinAvailability(date: ISODate): Promise<{ available: boolean; nextDate?: ISODate }> {
  const last = (await db.checkins.orderBy("date").toArray()).at(-1);
  if (!last) return { available: true };
  const nextDate = addDays(last.date, CHECKIN_LOCK_DAYS);
  return daysBetween(last.date, date) >= CHECKIN_LOCK_DAYS ? { available: true } : { available: false, nextDate };
}

export async function submitCheckIn(date: ISODate, pacer: number, newCalories: number): Promise<void> {
  const { available } = await checkinAvailability(date);
  if (!available) throw new Error("Check-in is locked for 7 days after the last one.");
  const prev = await currentTarget(date);
  if (!prev) throw new Error("No nutrition target to adjust.");
  const s = await summarize(date, pacer);
  // Keep protein & fat grams; carbs absorb the calorie change (assumption, labelled in UI).
  const carbs = Math.max(0, Math.round((newCalories - prev.protein * 4 - prev.fat * 9) / 4));
  await db.transaction("rw", db.checkins, db.targets, async () => {
    await db.checkins.add({
      date,
      avgWeightKg: s.avgWeightKg,
      prevAvgWeightKg: s.prevAvgWeightKg,
      ratePctPerWeek: s.ratePctPerWeek,
      pacerPctPerWeek: pacer,
      avgCalories: s.avgCalories,
      daysLogged: s.daysLogged,
      previousCalories: prev.calories,
      newCalories,
      createdAt: Date.now(),
    });
    await db.targets.add({ effectiveDate: date, calories: newCalories, protein: prev.protein, carbs, fat: prev.fat, source: "checkin", createdAt: Date.now() });
  });
}
