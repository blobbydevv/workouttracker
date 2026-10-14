import { db } from "../db/db";
import type { ISODate, ProgramVersion } from "../db/types";
import { addDays, weekDays } from "./dates";

export type Slot = ProgramVersion["slots"][number];

/** The program version in force for a given week (latest effective <= weekStart). */
export async function versionForWeek(programId: string, weekStart: ISODate): Promise<ProgramVersion | undefined> {
  const versions = await db.programVersions
    .where("[programId+effectiveWeekStart]")
    .between([programId, ""], [programId, weekStart], true, true)
    .toArray();
  return versions.sort((a, b) => (a.effectiveWeekStart < b.effectiveWeekStart ? -1 : a.effectiveWeekStart > b.effectiveWeekStart ? 1 : (a.id ?? 0) - (b.id ?? 0))).at(-1);
}

/**
 * Write a new layout effective from `weekStart`. Future weeks inherit it via
 * versionForWeek; weeks before `weekStart` keep their earlier version. Any
 * later versions are rebased so the edit propagates forward (documented:
 * "additions, deletions and swaps propagate to future weeks").
 */
export async function saveLayoutFrom(programId: string, weekStart: ISODate, slots: Slot[]): Promise<void> {
  await db.transaction("rw", db.programVersions, async () => {
    const later = await db.programVersions
      .where("[programId+effectiveWeekStart]")
      .between([programId, addDays(weekStart, 1)], [programId, "￿"], true, true)
      .toArray();
    await db.programVersions.bulkDelete(later.map((v) => v.id!));
    const same = await db.programVersions.where({ programId, effectiveWeekStart: weekStart }).toArray();
    await db.programVersions.bulkDelete(same.map((v) => v.id!));
    await db.programVersions.add({ programId, effectiveWeekStart: weekStart, slots, createdAt: Date.now() });
  });
}

export function moveSlot(slots: Slot[], from: number, to: number): Slot[] {
  const next = slots.slice();
  // Dragging a day onto another day swaps their contents (days are fixed calendar positions).
  [next[from], next[to]] = [next[to], next[from]];
  return next;
}

export type WeekStatus = "past" | "current" | "future";
export function weekStatus(weekStart: ISODate, currentWeekStart: ISODate): WeekStatus {
  if (weekStart === currentWeekStart) return "current";
  return weekStart < currentWeekStart ? "past" : "future";
}

/** Documented: current and previous weeks can be completed; future weeks cannot. */
export const canLogWeek = (s: WeekStatus) => s !== "future";

export interface DayPlan {
  date: ISODate;
  templateId: string | null;
  label?: string;
}

export async function weekPlan(programId: string, weekStart: ISODate): Promise<DayPlan[]> {
  const v = await versionForWeek(programId, weekStart);
  return weekDays(weekStart).map((date, i) => ({
    date,
    templateId: v?.slots[i]?.templateId ?? null,
    label: v?.slots[i]?.label,
  }));
}

/** Simple adjacency check used for the documented "scheduling conflict" warning. */
export function hasBackToBack(muscleSets: Array<Set<string> | null>): number[] {
  const flagged: number[] = [];
  for (let i = 1; i < muscleSets.length; i++) {
    const a = muscleSets[i - 1];
    const b = muscleSets[i];
    if (!a || !b) continue;
    const overlap = [...a].filter((m) => b.has(m));
    if (overlap.length >= 2) flagged.push(i);
  }
  return flagged;
}
