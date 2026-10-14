import type { ISODate } from "../db/types";

export function toISO(d: Date): ISODate {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function fromISO(s: ISODate): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function today(now: Date = new Date()): ISODate {
  return toISO(now);
}

export function addDays(s: ISODate, n: number): ISODate {
  const d = fromISO(s);
  d.setDate(d.getDate() + n);
  return toISO(d);
}

export function weekStartOf(s: ISODate, weekStartsOn: 0 | 1): ISODate {
  const d = fromISO(s);
  const diff = (d.getDay() - weekStartsOn + 7) % 7;
  d.setDate(d.getDate() - diff);
  return toISO(d);
}

export function weekDays(weekStart: ISODate): ISODate[] {
  return Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
}

export function daysBetween(a: ISODate, b: ISODate): number {
  return Math.round((fromISO(b).getTime() - fromISO(a).getTime()) / 86_400_000);
}

/** Month grid (weeks × 7) covering the month containing `s`. */
export function monthGrid(s: ISODate, weekStartsOn: 0 | 1): ISODate[][] {
  const d = fromISO(s);
  const first = toISO(new Date(d.getFullYear(), d.getMonth(), 1));
  const last = toISO(new Date(d.getFullYear(), d.getMonth() + 1, 0));
  const rows: ISODate[][] = [];
  let cursor = weekStartOf(first, weekStartsOn);
  while (cursor <= last) {
    rows.push(weekDays(cursor));
    cursor = addDays(cursor, 7);
  }
  return rows;
}

const DAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

export const dayShort = (s: ISODate) => DAY_SHORT[fromISO(s).getDay()];
export const dayNum = (s: ISODate) => fromISO(s).getDate();
export const monthLabel = (s: ISODate) => {
  const d = fromISO(s);
  return `${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
};
export const longDate = (s: ISODate) => {
  const d = fromISO(s);
  return `${DAY_SHORT[d.getDay()]}, ${d.getDate()} ${MONTHS[d.getMonth()].slice(0, 3)}`;
};
