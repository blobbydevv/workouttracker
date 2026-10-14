import { useLiveQuery } from "dexie-react-hooks";
import { db } from "../db/db";
import type { Profile, Units } from "../db/types";
import { today, weekStartOf } from "../domain/dates";

export function useProfile(): Profile | undefined | null {
  // null = loaded but missing (not onboarded); undefined = still loading
  return useLiveQuery(async () => (await db.profiles.get("me")) ?? null, []);
}

const LB = 2.20462;
export const toDisplay = (kg: number | null | undefined, u: Units) => (kg == null ? null : u === "lb" ? Math.round(kg * LB * 10) / 10 : Math.round(kg * 10) / 10);
export const fromDisplay = (v: number | null, u: Units) => (v == null ? null : u === "lb" ? v / LB : v);

export function useCurrentWeekStart(p: Profile | null | undefined) {
  return weekStartOf(today(), p?.weekStartsOn ?? 1);
}
