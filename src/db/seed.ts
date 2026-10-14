// Stand-in content. The real exercise library, tutorial videos, food database
// and lessons are licensed BWS content that this repository does not have
// (see docs/PARITY.md "Content gaps"). Everything here is a generic placeholder
// so the flows can be exercised end to end.
import type { ExerciseDef, Food, TemplateItem, WorkoutTemplate } from "./types";

const ex = (
  id: string,
  name: string,
  muscle: string,
  equipment: string,
  weighted: boolean,
  defaultRestSec: number,
  locations: ExerciseDef["locations"],
  alternatives: string[],
): ExerciseDef => ({ id, name, muscle, equipment, weighted, defaultRestSec, locations, alternatives });

export const SEED_EXERCISES: ExerciseDef[] = [
  ex("bench", "Barbell Bench Press", "Chest", "Barbell", true, 150, ["gym"], ["db-bench", "machine-press", "pushup"]),
  ex("db-bench", "Dumbbell Bench Press", "Chest", "Dumbbell", true, 120, ["gym", "home"], ["bench", "machine-press", "pushup"]),
  ex("incline-db", "Incline Dumbbell Press", "Chest", "Dumbbell", true, 120, ["gym", "home"], ["db-bench", "pushup"]),
  ex("machine-press", "Machine Chest Press", "Chest", "Machine", true, 120, ["gym"], ["bench", "db-bench"]),
  ex("cable-fly", "Cable Fly", "Chest", "Cable", true, 90, ["gym"], ["db-fly"]),
  ex("db-fly", "Dumbbell Fly", "Chest", "Dumbbell", true, 90, ["gym", "home"], ["cable-fly"]),
  ex("pushup", "Push-Up", "Chest", "Bodyweight", false, 90, ["gym", "home"], ["db-bench"]),
  ex("pulldown", "Lat Pulldown", "Back", "Cable", true, 120, ["gym"], ["pullup", "db-row"]),
  ex("pullup", "Pull-Up", "Back", "Bodyweight", false, 120, ["gym", "home"], ["pulldown"]),
  ex("cable-row", "Seated Cable Row", "Back", "Cable", true, 120, ["gym"], ["db-row", "chest-row"]),
  ex("db-row", "One-Arm Dumbbell Row", "Back", "Dumbbell", true, 90, ["gym", "home"], ["cable-row", "chest-row"]),
  ex("chest-row", "Chest-Supported Row", "Back", "Dumbbell", true, 90, ["gym", "home"], ["db-row", "cable-row"]),
  ex("ohp", "Seated Dumbbell Shoulder Press", "Shoulders", "Dumbbell", true, 120, ["gym", "home"], ["machine-shoulder"]),
  ex("machine-shoulder", "Machine Shoulder Press", "Shoulders", "Machine", true, 120, ["gym"], ["ohp"]),
  ex("lat-raise", "Dumbbell Lateral Raise", "Shoulders", "Dumbbell", true, 60, ["gym", "home"], ["cable-lat-raise"]),
  ex("cable-lat-raise", "Cable Lateral Raise", "Shoulders", "Cable", true, 60, ["gym"], ["lat-raise"]),
  ex("rear-delt", "Reverse Pec Deck", "Shoulders", "Machine", true, 60, ["gym"], ["db-rear-delt"]),
  ex("db-rear-delt", "Bent-Over Rear Delt Raise", "Shoulders", "Dumbbell", true, 60, ["gym", "home"], ["rear-delt"]),
  ex("db-curl", "Dumbbell Curl", "Biceps", "Dumbbell", true, 60, ["gym", "home"], ["cable-curl", "hammer-curl"]),
  ex("cable-curl", "Cable Curl", "Biceps", "Cable", true, 60, ["gym"], ["db-curl"]),
  ex("hammer-curl", "Hammer Curl", "Biceps", "Dumbbell", true, 60, ["gym", "home"], ["db-curl"]),
  ex("pushdown", "Cable Triceps Pushdown", "Triceps", "Cable", true, 60, ["gym"], ["oh-ext", "bench-dip"]),
  ex("oh-ext", "Overhead Dumbbell Extension", "Triceps", "Dumbbell", true, 60, ["gym", "home"], ["pushdown"]),
  ex("bench-dip", "Bench Dip", "Triceps", "Bodyweight", false, 60, ["gym", "home"], ["pushdown"]),
  ex("squat", "Barbell Back Squat", "Quads", "Barbell", true, 180, ["gym"], ["goblet-squat", "leg-press"]),
  ex("goblet-squat", "Goblet Squat", "Quads", "Dumbbell", true, 120, ["gym", "home"], ["squat", "leg-press"]),
  ex("leg-press", "Leg Press", "Quads", "Machine", true, 150, ["gym"], ["squat", "goblet-squat"]),
  ex("split-squat", "Bulgarian Split Squat", "Quads", "Dumbbell", true, 90, ["gym", "home"], ["lunge"]),
  ex("lunge", "Walking Lunge", "Quads", "Dumbbell", true, 90, ["gym", "home"], ["split-squat"]),
  ex("leg-ext", "Leg Extension", "Quads", "Machine", true, 60, ["gym"], ["split-squat"]),
  ex("rdl", "Romanian Deadlift", "Hamstrings", "Barbell", true, 150, ["gym"], ["db-rdl"]),
  ex("db-rdl", "Dumbbell Romanian Deadlift", "Hamstrings", "Dumbbell", true, 120, ["gym", "home"], ["rdl"]),
  ex("leg-curl", "Seated Leg Curl", "Hamstrings", "Machine", true, 60, ["gym"], ["db-rdl"]),
  ex("hip-thrust", "Barbell Hip Thrust", "Glutes", "Barbell", true, 120, ["gym"], ["glute-bridge"]),
  ex("glute-bridge", "Glute Bridge", "Glutes", "Bodyweight", false, 60, ["gym", "home"], ["hip-thrust"]),
  ex("calf-raise", "Standing Calf Raise", "Calves", "Machine", true, 60, ["gym"], ["db-calf"]),
  ex("db-calf", "Dumbbell Calf Raise", "Calves", "Dumbbell", true, 60, ["gym", "home"], ["calf-raise"]),
  ex("crunch", "Cable Crunch", "Abs", "Cable", true, 60, ["gym"], ["plank"]),
  ex("plank", "Plank", "Abs", "Bodyweight", false, 60, ["gym", "home"], ["crunch"]),
];

const item = (id: string, exerciseId: string, sets: number, repMin: number, repMax: number, supersetId?: string): TemplateItem => ({
  id,
  exerciseId,
  sets,
  repMin,
  repMax,
  ...(supersetId ? { supersetId } : {}),
});

/**
 * Provisional split templates. NOT the BWS workout generator, whose algorithm
 * is undisclosed. Chosen transparently by days/week and location.
 */
export function provisionalTemplates(location: "gym" | "home"): Record<string, Omit<WorkoutTemplate, "createdAt" | "inLibrary">> {
  const gym = location === "gym";
  return {
    upperA: {
      id: "upperA",
      name: "Upper A",
      items: [
        item("u1", gym ? "bench" : "db-bench", 3, 6, 10),
        item("u2", gym ? "cable-row" : "db-row", 3, 8, 12),
        item("u3", "ohp", 3, 8, 12),
        item("u4", gym ? "pulldown" : "chest-row", 3, 8, 12),
        item("u5", "db-curl", 2, 10, 15, "ssA"),
        item("u6", gym ? "pushdown" : "oh-ext", 2, 10, 15, "ssA"),
      ],
    },
    lowerA: {
      id: "lowerA",
      name: "Lower A",
      items: [
        item("l1", gym ? "squat" : "goblet-squat", 3, 6, 10),
        item("l2", gym ? "rdl" : "db-rdl", 3, 8, 12),
        item("l3", "split-squat", 2, 8, 12),
        item("l4", gym ? "leg-curl" : "glute-bridge", 3, 10, 15),
        item("l5", gym ? "calf-raise" : "db-calf", 3, 10, 15),
      ],
    },
    upperB: {
      id: "upperB",
      name: "Upper B",
      items: [
        item("v1", "incline-db", 3, 8, 12),
        item("v2", gym ? "pulldown" : "db-row", 3, 8, 12),
        item("v3", gym ? "machine-press" : "pushup", 2, 8, 12),
        item("v4", "chest-row", 3, 10, 12),
        item("v5", "lat-raise", 3, 12, 20, "ssB"),
        item("v6", "db-rear-delt", 3, 12, 20, "ssB"),
      ],
    },
    lowerB: {
      id: "lowerB",
      name: "Lower B",
      items: [
        item("w1", gym ? "leg-press" : "goblet-squat", 3, 8, 12),
        item("w2", gym ? "hip-thrust" : "glute-bridge", 3, 8, 12),
        item("w3", "lunge", 2, 10, 12),
        item("w4", gym ? "leg-ext" : "split-squat", 2, 10, 15),
        item("w5", gym ? "crunch" : "plank", 3, 10, 15),
      ],
    },
    fullA: {
      id: "fullA",
      name: "Full Body A",
      items: [
        item("f1", gym ? "squat" : "goblet-squat", 3, 6, 10),
        item("f2", gym ? "bench" : "db-bench", 3, 6, 10),
        item("f3", gym ? "cable-row" : "db-row", 3, 8, 12),
        item("f4", "lat-raise", 2, 12, 20),
      ],
    },
    fullB: {
      id: "fullB",
      name: "Full Body B",
      items: [
        item("g1", gym ? "rdl" : "db-rdl", 3, 8, 12),
        item("g2", "ohp", 3, 8, 12),
        item("g3", gym ? "pulldown" : "chest-row", 3, 8, 12),
        item("g4", "split-squat", 2, 8, 12),
      ],
    },
  };
}

/** Day layouts (7 slots from week start). null = rest day. */
export function provisionalLayout(daysPerWeek: number): Array<string | null> {
  switch (daysPerWeek) {
    case 2:
      return [null, "fullA", null, null, "fullB", null, null];
    case 3:
      return [null, "fullA", null, "fullB", null, "fullA", null];
    case 4:
      return [null, "upperA", "lowerA", null, "upperB", "lowerB", null];
    case 5:
      return [null, "upperA", "lowerA", "fullA", "upperB", "lowerB", null];
    default:
      return [null, "upperA", "lowerA", "upperB", "lowerB", "fullA", "fullB"];
  }
}

const food = (id: string, name: string, servingLabel: string, kcal: number, protein: number, carbs: number, fat: number): Food => ({
  id,
  name,
  servingLabel,
  kcal,
  protein,
  carbs,
  fat,
  custom: false,
  source: "seed",
});

// Approximate generic values for development only; not the BWS database.
export const SEED_FOODS: Food[] = [
  food("chicken-breast", "Chicken breast, cooked", "100 g", 165, 31, 0, 3.6),
  food("white-rice", "White rice, cooked", "100 g", 130, 2.7, 28, 0.3),
  food("egg", "Egg, whole", "1 large (50 g)", 72, 6.3, 0.4, 4.8),
  food("oats", "Rolled oats", "40 g", 150, 5, 27, 2.6),
  food("banana", "Banana", "1 medium (118 g)", 105, 1.3, 27, 0.4),
  food("greek-yogurt", "Greek yogurt, nonfat", "170 g", 100, 17, 6, 0.7),
  food("whey", "Whey protein powder", "1 scoop (30 g)", 120, 24, 3, 1.5),
  food("milk", "Milk, semi-skimmed", "250 ml", 125, 8.5, 12, 4.5),
  food("bread", "Wholemeal bread", "1 slice (36 g)", 90, 4, 15, 1.2),
  food("peanut-butter", "Peanut butter", "1 tbsp (16 g)", 94, 4, 3.2, 8),
  food("salmon", "Salmon, cooked", "100 g", 206, 22, 0, 12),
  food("broccoli", "Broccoli, cooked", "100 g", 35, 2.4, 7, 0.4),
  food("olive-oil", "Olive oil", "1 tbsp (14 g)", 119, 0, 0, 13.5),
  food("potato", "Potato, baked", "100 g", 93, 2.5, 21, 0.1),
  food("apple", "Apple", "1 medium (182 g)", 95, 0.5, 25, 0.3),
  food("beef-mince", "Beef mince 5% fat, cooked", "100 g", 170, 26, 0, 7),
  food("pasta", "Pasta, cooked", "100 g", 158, 5.8, 31, 0.9),
  food("cheddar", "Cheddar cheese", "30 g", 121, 7.5, 0.4, 10),
  food("almonds", "Almonds", "28 g", 164, 6, 6, 14),
  food("tuna", "Tuna, canned in water", "1 can drained (120 g)", 132, 29, 0, 1),
];
