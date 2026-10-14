import Dexie, { type Table } from "dexie";
import type {
  Assessment,
  Chat,
  ChatMessage,
  CheckIn,
  Entitlement,
  ExerciseDef,
  Food,
  FoodLogEntry,
  LessonProgress,
  Meal,
  NutritionTarget,
  Profile,
  Program,
  ProgramVersion,
  ProgressPhoto,
  Recipe,
  RestPref,
  SetRecord,
  StepsRecord,
  WeighIn,
  WorkoutSession,
  WorkoutTemplate,
} from "./types";

export class AppDB extends Dexie {
  profiles!: Table<Profile, string>;
  assessments!: Table<Assessment, number>;
  targets!: Table<NutritionTarget, number>;
  programs!: Table<Program, string>;
  programVersions!: Table<ProgramVersion, number>;
  templates!: Table<WorkoutTemplate, string>;
  exercises!: Table<ExerciseDef, string>;
  restPrefs!: Table<RestPref, string>;
  sessions!: Table<WorkoutSession, string>;
  sets!: Table<SetRecord, number>;
  foods!: Table<Food, string>;
  meals!: Table<Meal, string>;
  recipes!: Table<Recipe, string>;
  foodLog!: Table<FoodLogEntry, number>;
  checkins!: Table<CheckIn, number>;
  weighins!: Table<WeighIn, number>;
  photos!: Table<ProgressPhoto, number>;
  steps!: Table<StepsRecord, string>;
  lessonProgress!: Table<LessonProgress, string>;
  chats!: Table<Chat, string>;
  chatMessages!: Table<ChatMessage, number>;
  entitlements!: Table<Entitlement, string>;

  constructor(name = "tracker") {
    super(name);
    this.version(1).stores({
      profiles: "id",
      assessments: "++id, createdAt",
      targets: "++id, effectiveDate",
      programs: "id",
      programVersions: "++id, programId, effectiveWeekStart, [programId+effectiveWeekStart]",
      templates: "id",
      exercises: "id, muscle",
      restPrefs: "key",
      sessions: "id, date, weekStart, status, templateId",
      sets: "++id, sessionId, exerciseId, [sessionId+itemId]",
      foods: "id, name, barcode",
      meals: "id, name",
      recipes: "id, name",
      foodLog: "++id, date, [date+slot]",
      checkins: "++id, date",
      weighins: "++id, date",
      photos: "++id, date",
      steps: "date",
      lessonProgress: "lessonId",
      chats: "id, updatedAt",
      chatMessages: "++id, chatId, createdAt",
      entitlements: "id",
    });
  }
}

export let db = new AppDB();

/** Test hook: swap in an isolated database. */
export function useDatabase(name: string): AppDB {
  db = new AppDB(name);
  return db;
}

export const uid = (): string =>
  (globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`).replace(/-/g, "").slice(0, 16);
