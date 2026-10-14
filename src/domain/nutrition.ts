import type { Food, FoodLogEntry, Macros, Meal, MealSlot } from "../db/types";

export const SLOTS: MealSlot[] = ["breakfast", "lunch", "dinner", "snacks"];
export const SLOT_LABEL: Record<MealSlot, string> = {
  breakfast: "Breakfast",
  lunch: "Lunch",
  dinner: "Dinner",
  snacks: "Snacks",
};

export const ZERO: Macros = { kcal: 0, protein: 0, carbs: 0, fat: 0 };

export function add(a: Macros, b: Macros, k = 1): Macros {
  return {
    kcal: a.kcal + b.kcal * k,
    protein: a.protein + b.protein * k,
    carbs: a.carbs + b.carbs * k,
    fat: a.fat + b.fat * k,
  };
}

export const entryMacros = (e: FoodLogEntry): Macros => add(ZERO, e.perServing, e.servings);

export function sumEntries(entries: FoodLogEntry[]): Macros {
  return entries.reduce((acc, e) => add(acc, e.perServing, e.servings), ZERO);
}

export function bySlot(entries: FoodLogEntry[]): Record<MealSlot, FoodLogEntry[]> {
  const out: Record<MealSlot, FoodLogEntry[]> = { breakfast: [], lunch: [], dinner: [], snacks: [] };
  for (const e of entries) out[e.slot].push(e);
  return out;
}

export function mealTotals(meal: Meal, foods: Map<string, Food>): { total: Macros; missing: string[] } {
  let total = ZERO;
  const missing: string[] = [];
  for (const ing of meal.ingredients) {
    const f = foods.get(ing.foodId);
    if (!f) {
      missing.push(ing.foodId);
      continue;
    }
    total = add(total, f, ing.servings);
  }
  return { total, missing };
}

export const round = (n: number) => Math.round(n);

/** Calories implied by macros (4/4/9). Used to validate custom food input. */
export const kcalFromMacros = (p: number, c: number, f: number) => p * 4 + c * 4 + f * 9;
