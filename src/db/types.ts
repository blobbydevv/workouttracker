// Persistent data model. Every derived figure (daily totals, PRs, weekly
// averages) is computed from these records at read time, never stored.

export type ISODate = string; // "YYYY-MM-DD" in the user's local calendar

export type Units = "kg" | "lb";
export type Goal = "lose_fat" | "build_muscle" | "recomp" | "maintain";
export type Experience = "beginner" | "intermediate" | "advanced";
export type Location = "gym" | "home";
export type MealSlot = "breakfast" | "lunch" | "dinner" | "snacks";
export type SetType = "normal" | "warmup" | "dropset" | "deload";

export interface Profile {
  id: "me";
  name: string;
  units: Units;
  weekStartsOn: 0 | 1; // 0 = Sunday, 1 = Monday (support article: configurable)
  /** Target rate of weight change, % of body weight per week (negative = loss). */
  weightPacerPctPerWeek: number;
  stepGoal: number;
  /** Food Log gear-menu setting: show carbohydrate and fat per meal. */
  showCarbsFats: boolean;
  weighInReminder: boolean;
  workoutPlanId?: string;
  dietPlanId?: string;
  onboardedAt?: number;
  createdAt: number;
}

export interface Assessment {
  id?: number;
  createdAt: number;
  experience: Experience;
  goal: Goal;
  location: Location;
  daysPerWeek: number;
  priorityMuscles: string[];
  sex: "female" | "male" | "unspecified";
  age: number;
  heightCm: number;
  weightKg: number;
  activity: "sedentary" | "light" | "moderate" | "very";
}

/** Nutrition targets, versioned by effective date so history stays truthful. */
export interface NutritionTarget {
  id?: number;
  effectiveDate: ISODate;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  source: "onboarding" | "manual" | "checkin";
  createdAt: number;
}

export interface ExerciseDef {
  id: string;
  name: string;
  muscle: string;
  equipment: string;
  /** Externally weighted: eligible for progression cues (support article). */
  weighted: boolean;
  defaultRestSec: number;
  locations: Location[];
  alternatives: string[];
  custom?: boolean;
}

export interface TemplateItem {
  id: string; // stable within a template
  exerciseId: string;
  sets: number;
  repMin: number;
  repMax: number;
  /** Items sharing a supersetId are performed back-to-back. */
  supersetId?: string;
}

export interface WorkoutTemplate {
  id: string;
  name: string;
  items: TemplateItem[];
  /** Saved to the Workout Library (support article: "save to Workout Library"). */
  inLibrary: boolean;
  createdAt: number;
}

/**
 * A program version holds the weekly slot layout. Edits to a week create a
 * new version effective from that week, so the change propagates to all
 * future weeks while earlier weeks keep the layout they were trained with.
 */
export interface ProgramVersion {
  id?: number;
  programId: string;
  effectiveWeekStart: ISODate;
  /** Seven entries in display order starting at the week's first day. */
  slots: Array<{ templateId: string | null; label?: string }>;
  createdAt: number;
}

export interface Program {
  id: string;
  name: string;
  createdAt: number;
  source: "provisional-template" | "custom";
}

export interface RestPref {
  /** "ex:<exerciseId>" or "ss:<templateId>:<supersetId>" */
  key: string;
  restSec: number;
  updatedAt: number;
}

export interface SessionItemSnapshot extends TemplateItem {
  exerciseName: string;
  weighted: boolean;
}

export interface WorkoutSession {
  id: string;
  date: ISODate;
  weekStart: ISODate;
  templateId: string;
  /** Copied at start so later template edits never rewrite history. */
  name: string;
  items: SessionItemSnapshot[];
  status: "in_progress" | "completed";
  startedAt: number;
  finishedAt?: number;
  rest?: { endsAt: number; durationSec: number; key: string } | null;
}

export interface SetRecord {
  id?: number;
  sessionId: string;
  itemId: string;
  exerciseId: string;
  index: number;
  type: SetType;
  weight: number | null; // kg internally
  reps: number | null;
  done: boolean;
  completedAt?: number;
}

export interface Food {
  id: string;
  name: string;
  brand?: string;
  servingLabel: string;
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  barcode?: string;
  custom: boolean;
  source: "seed" | "custom" | "openfoodfacts" | "ai-estimate";
}

export interface MealIngredient {
  foodId: string;
  servings: number;
}

export interface Meal {
  id: string;
  name: string;
  ingredients: MealIngredient[];
  createdAt: number;
}

export interface Recipe {
  id: string;
  name: string;
  servings: number;
  ingredients: MealIngredient[];
  sourceUrl?: string;
  createdAt: number;
}

export interface Macros {
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
}

export interface FoodLogEntry {
  id?: number;
  date: ISODate;
  slot: MealSlot;
  kind: "food" | "meal" | "quick";
  refId?: string;
  name: string;
  servings: number;
  servingLabel: string;
  /** Macros for ONE serving, snapshotted at log time. */
  perServing: Macros;
  createdAt: number;
}

export interface CheckIn {
  id?: number;
  date: ISODate;
  avgWeightKg: number | null;
  prevAvgWeightKg: number | null;
  ratePctPerWeek: number | null;
  pacerPctPerWeek: number;
  avgCalories: number | null;
  daysLogged: number;
  previousCalories: number;
  newCalories: number;
  createdAt: number;
}

export interface WeighIn {
  id?: number;
  date: ISODate;
  weightKg: number;
  createdAt: number;
}

export interface ProgressPhoto {
  id?: number;
  date: ISODate;
  blob: Blob;
  createdAt: number;
}

export interface StepsRecord {
  date: ISODate;
  steps: number;
  source: "manual";
}

export interface LessonProgress {
  lessonId: string;
  completedAt: number;
}

export interface Chat {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
}

export interface ChatMessage {
  id?: number;
  chatId: string;
  role: "user" | "assistant";
  content: string;
  createdAt: number;
  error?: boolean;
}

export interface Entitlement {
  id: "membership";
  status: "unverified" | "active" | "inactive";
  checkedAt: number;
  note: string;
}
