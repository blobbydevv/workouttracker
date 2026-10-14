// Pure operations on an ordered list of exercise items (template or session).
import type { TemplateItem } from "../db/types";

export interface Group<T extends TemplateItem> {
  supersetId?: string;
  items: T[];
}

/** Consecutive items sharing a supersetId render as one grouped card. */
export function groupItems<T extends TemplateItem>(items: T[]): Group<T>[] {
  const groups: Group<T>[] = [];
  for (const it of items) {
    const last = groups.at(-1);
    if (it.supersetId && last && last.supersetId === it.supersetId) last.items.push(it);
    else groups.push({ supersetId: it.supersetId, items: [it] });
  }
  return groups;
}

/** Pair `itemId` with `partnerId`; the partner moves directly after the item's group. */
export function supersetWith<T extends TemplateItem>(items: T[], itemId: string, partnerId: string, newId: () => string): T[] {
  const a = items.find((i) => i.id === itemId);
  const b = items.find((i) => i.id === partnerId);
  if (!a || !b || a === b) return items;
  if (a.supersetId && a.supersetId === b.supersetId) return items;
  const sid = a.supersetId ?? newId();
  // Leaving b's previous group may orphan a single member.
  let next = removeFromSuperset(items, partnerId).map((i) => (i.id === itemId ? { ...i, supersetId: sid } : i));
  const moved = { ...next.find((i) => i.id === partnerId)!, supersetId: sid };
  next = next.filter((i) => i.id !== partnerId);
  let insertAt = next.length;
  for (let k = next.length - 1; k >= 0; k--) {
    if (next[k].supersetId === sid) {
      insertAt = k + 1;
      break;
    }
  }
  next.splice(insertAt, 0, moved);
  return next;
}

/** Removing a member breaks that portion of the pairing; a lone remainder is ungrouped. */
export function removeFromSuperset<T extends TemplateItem>(items: T[], itemId: string): T[] {
  const target = items.find((i) => i.id === itemId);
  if (!target?.supersetId) return items;
  const sid = target.supersetId;
  let next = items.map((i) => (i.id === itemId ? stripSs(i) : i));
  const remaining = next.filter((i) => i.supersetId === sid);
  if (remaining.length === 1) next = next.map((i) => (i.supersetId === sid ? stripSs(i) : i));
  return next;
}

function stripSs<T extends TemplateItem>(i: T): T {
  const copy = { ...i };
  delete copy.supersetId;
  return copy;
}

export function replaceExercise<T extends TemplateItem>(items: T[], itemId: string, patch: Partial<T>): T[] {
  return items.map((i) => (i.id === itemId ? { ...i, ...patch } : i));
}

export function removeItem<T extends TemplateItem>(items: T[], itemId: string): T[] {
  return removeFromSuperset(items, itemId).filter((i) => i.id !== itemId);
}
