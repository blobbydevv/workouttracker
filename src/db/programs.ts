// Workout plan library. Each plan is a weekly layout (Monday first) of workout
// days built from the built-in exercises. Descriptions summarise widely used
// training approaches; volume guidance follows the common evidence-based range
// of roughly 10–20 hard sets per muscle per week for growth.
import type { TemplateItem } from "./types";

export type PlanTag = "muscle" | "strength" | "intense" | "beginner" | "home" | "fatloss" | "athletic" | "busy";

export interface PlanDay {
  name: string;
  items: Array<[exerciseId: string, sets: number, repMin: number, repMax: number, superset?: string]>;
}

export interface WorkoutPlan {
  id: string;
  name: string;
  tagline: string;
  tags: PlanTag[];
  badge?: string;
  level: "Beginner" | "Intermediate" | "Advanced" | "All levels";
  daysPerWeek: number;
  minutes: string;
  intensity: 1 | 2 | 3 | 4 | 5;
  location: "Gym" | "Home" | "Gym or home";
  bestFor: string;
  description: string;
  howItWorks: string[];
  /** Seven entries, Monday → Sunday: a day key or null for rest. */
  week: Array<string | null>;
  days: Record<string, PlanDay>;
}

export const TAG_LABEL: Record<PlanTag, string> = {
  muscle: "Build muscle",
  strength: "Strength",
  intense: "Most intense",
  beginner: "Beginner",
  home: "Home / no gym",
  fatloss: "Fat loss",
  athletic: "Athletic",
  busy: "Short on time",
};

export const WORKOUT_PLANS: WorkoutPlan[] = [
  {
    id: "ppl",
    name: "Push / Pull / Legs",
    tagline: "The classic high-volume bodybuilding split",
    tags: ["muscle", "intense"],
    badge: "Fastest muscle gain",
    level: "Intermediate",
    daysPerWeek: 6,
    minutes: "60–75 min",
    intensity: 4,
    location: "Gym",
    bestFor: "Building muscle as fast as possible if you can train 6 days a week.",
    description:
      "Pushing muscles (chest, shoulders, triceps), pulling muscles (back, biceps) and legs each get their own day, and the cycle runs twice a week. Every muscle is trained twice weekly with plenty of hard sets — the combination research links to the most growth.",
    howItWorks: [
      "Each muscle hits roughly 12–20 hard sets per week, split over two sessions.",
      "Heavy compound lifts first (6–10 reps), then isolation work for the pump (10–20 reps).",
      "Add reps until you hit the top of the range, then add weight.",
      "Needs good recovery: sleep 7–9 h and eat enough protein.",
    ],
    week: ["push", "pull", "legs", "push2", "pull2", "legs2", null],
    days: {
      push: { name: "Push A", items: [["bench", 4, 6, 8], ["incline-db", 3, 8, 10], ["ohp", 3, 8, 10], ["cable-fly", 3, 10, 15], ["lat-raise", 4, 12, 20], ["pushdown", 3, 10, 15]] },
      pull: { name: "Pull A", items: [["deadlift", 3, 4, 6], ["pulldown", 3, 8, 12], ["cable-row", 3, 8, 12], ["face-pull", 3, 12, 20], ["db-curl", 3, 10, 12], ["hammer-curl", 2, 10, 15]] },
      legs: { name: "Legs A", items: [["squat", 4, 6, 8], ["rdl", 3, 8, 10], ["leg-press", 3, 10, 12], ["leg-curl", 3, 10, 15], ["calf-raise", 4, 10, 15], ["hanging-leg-raise", 3, 10, 15]] },
      push2: { name: "Push B", items: [["incline-bench", 4, 6, 8], ["db-bench", 3, 8, 12], ["arnold-press", 3, 8, 12], ["chest-dip", 3, 8, 12], ["cable-lat-raise", 3, 12, 20], ["skullcrusher", 3, 10, 12]] },
      pull2: { name: "Pull B", items: [["pullup", 4, 6, 10], ["barbell-row", 4, 6, 10], ["chest-row", 3, 10, 12], ["rear-delt", 3, 12, 20], ["preacher-curl", 3, 10, 12], ["shrug", 3, 10, 15]] },
      legs2: { name: "Legs B", items: [["front-squat", 3, 6, 8], ["hip-thrust", 3, 8, 12], ["split-squat", 3, 8, 12], ["lying-leg-curl", 3, 10, 15], ["leg-ext", 3, 12, 15], ["seated-calf", 4, 12, 20]] },
    },
  },
  {
    id: "upper-lower",
    name: "Upper / Lower",
    tagline: "Four days, every muscle twice a week",
    tags: ["muscle", "strength"],
    badge: "Best all-rounder",
    level: "All levels",
    daysPerWeek: 4,
    minutes: "60 min",
    intensity: 3,
    location: "Gym",
    bestFor: "Steady muscle and strength gains with recovery days built in. The best balance of results vs. time for most people.",
    description:
      "Alternate upper-body and lower-body days, four times a week. You get the same twice-a-week frequency as Push/Pull/Legs with two fewer sessions, which makes it easier to recover from and stick to.",
    howItWorks: [
      "Day A of each pair is heavier (6–10 reps); day B uses more volume (8–15 reps).",
      "About 10–16 hard sets per muscle per week.",
      "Rest days fall mid-week and at the weekend.",
    ],
    week: ["upperA", "lowerA", null, "upperB", "lowerB", null, null],
    days: {
      upperA: { name: "Upper A (heavy)", items: [["bench", 4, 6, 8], ["barbell-row", 4, 6, 8], ["barbell-ohp", 3, 6, 10], ["pulldown", 3, 8, 12], ["db-curl", 2, 10, 15, "ss1"], ["pushdown", 2, 10, 15, "ss1"]] },
      lowerA: { name: "Lower A (heavy)", items: [["squat", 4, 5, 8], ["rdl", 3, 6, 10], ["leg-press", 3, 10, 12], ["leg-curl", 3, 10, 15], ["calf-raise", 4, 8, 12]] },
      upperB: { name: "Upper B (volume)", items: [["incline-db", 4, 8, 12], ["cable-row", 4, 8, 12], ["ohp", 3, 10, 12], ["chinup", 3, 6, 12], ["lat-raise", 3, 12, 20, "ss2"], ["face-pull", 3, 12, 20, "ss2"], ["hammer-curl", 2, 10, 15]] },
      lowerB: { name: "Lower B (volume)", items: [["deadlift", 3, 4, 6], ["split-squat", 3, 8, 12], ["hip-thrust", 3, 8, 12], ["leg-ext", 3, 12, 15], ["seated-calf", 3, 12, 20], ["ab-wheel", 3, 8, 15]] },
    },
  },
  {
    id: "full-body-beginner",
    name: "Beginner Full Body",
    tagline: "Learn the big lifts, gain fast",
    tags: ["beginner", "muscle", "strength"],
    badge: "Best for beginners",
    level: "Beginner",
    daysPerWeek: 3,
    minutes: "45–60 min",
    intensity: 2,
    location: "Gym",
    bestFor: "Your first 6–12 months of lifting. New lifters grow fastest from practising the main lifts often.",
    description:
      "Three whole-body sessions a week on non-consecutive days. Each workout covers a squat, a press, a pull and a hinge, so you practise every movement pattern several times a week while it's still new.",
    howItWorks: [
      "Workouts A and B alternate (A–B–A this week).",
      "Moderate volume: 2–3 hard sets per exercise.",
      "Add a little weight whenever you complete all sets at the top of the range.",
    ],
    week: ["A", null, "B", null, "A", null, null],
    days: {
      A: { name: "Full Body A", items: [["squat", 3, 6, 10], ["bench", 3, 6, 10], ["cable-row", 3, 8, 12], ["lat-raise", 2, 12, 15], ["plank", 2, 30, 60]] },
      B: { name: "Full Body B", items: [["rdl", 3, 8, 10], ["ohp", 3, 8, 12], ["pulldown", 3, 8, 12], ["leg-press", 2, 10, 15], ["db-curl", 2, 10, 15]] },
    },
  },
  {
    id: "phul",
    name: "Power + Hypertrophy (PHUL)",
    tagline: "Two heavy days, two bodybuilding days",
    tags: ["strength", "muscle"],
    level: "Intermediate",
    daysPerWeek: 4,
    minutes: "60–75 min",
    intensity: 4,
    location: "Gym",
    bestFor: "Getting both stronger and bigger at the same time.",
    description:
      "Power Hypertrophy Upper Lower: the first upper and lower days are heavy (3–6 reps on the big lifts), the second pair is classic bodybuilding work (8–15 reps). You train strength and size in the same week.",
    howItWorks: [
      "Power days: long rests (2–3 min), heavy compound lifts.",
      "Hypertrophy days: shorter rests, more isolation and pump work.",
      "Track your top sets on power days — they're your strength measure.",
    ],
    week: ["upPow", "loPow", null, "upHyp", "loHyp", null, null],
    days: {
      upPow: { name: "Upper Power", items: [["bench", 4, 3, 5], ["barbell-row", 4, 3, 5], ["barbell-ohp", 3, 5, 8], ["pullup", 3, 5, 8], ["close-bench", 2, 6, 10], ["preacher-curl", 2, 6, 10]] },
      loPow: { name: "Lower Power", items: [["squat", 4, 3, 5], ["deadlift", 3, 3, 5], ["leg-press", 3, 10, 15], ["leg-curl", 3, 6, 10], ["calf-raise", 4, 6, 10]] },
      upHyp: { name: "Upper Hypertrophy", items: [["incline-db", 4, 8, 12], ["cable-fly", 3, 12, 15], ["cable-row", 4, 8, 12], ["pulldown", 3, 10, 12], ["lat-raise", 3, 12, 20], ["db-curl", 3, 10, 15, "arms"], ["pushdown", 3, 10, 15, "arms"]] },
      loHyp: { name: "Lower Hypertrophy", items: [["front-squat", 3, 8, 12], ["split-squat", 3, 10, 12], ["leg-ext", 3, 12, 15], ["lying-leg-curl", 3, 12, 15], ["seated-calf", 4, 12, 20]] },
    },
  },
  {
    id: "bro-split",
    name: "Bodybuilding Bro Split",
    tagline: "One muscle group a day, maximum pump",
    tags: ["muscle"],
    level: "Intermediate",
    daysPerWeek: 5,
    minutes: "60 min",
    intensity: 3,
    location: "Gym",
    bestFor: "Experienced lifters who love focused, high-pump sessions and want lots of exercise variety per muscle.",
    description:
      "Chest, back, shoulders, legs and arms each get a dedicated day. Every muscle is hit hard once a week with lots of sets and angles. Research suggests twice-a-week is slightly better for growth, so this suits enjoyment and variety more than speed.",
    howItWorks: [
      "15–20 sets for the day's muscle, using 4–5 exercises.",
      "Mostly 8–15 reps, finishing with drop sets if you like.",
      "Arms also get indirect work on chest and back days.",
    ],
    week: ["chest", "back", "shoulders", "legs", "arms", null, null],
    days: {
      chest: { name: "Chest", items: [["bench", 4, 6, 10], ["incline-db", 4, 8, 12], ["decline-bench", 3, 8, 12], ["cable-fly", 3, 12, 15], ["chest-dip", 3, 8, 15]] },
      back: { name: "Back", items: [["deadlift", 3, 4, 6], ["pullup", 4, 6, 10], ["barbell-row", 4, 8, 10], ["pulldown", 3, 10, 12], ["db-row", 3, 10, 12]] },
      shoulders: { name: "Shoulders", items: [["barbell-ohp", 4, 6, 10], ["arnold-press", 3, 8, 12], ["lat-raise", 4, 12, 20], ["rear-delt", 3, 12, 20], ["shrug", 3, 10, 15]] },
      legs: { name: "Legs", items: [["squat", 4, 6, 10], ["leg-press", 3, 10, 15], ["rdl", 3, 8, 12], ["leg-ext", 3, 12, 15], ["leg-curl", 3, 10, 15], ["calf-raise", 4, 10, 15]] },
      arms: { name: "Arms", items: [["close-bench", 3, 6, 10], ["preacher-curl", 3, 8, 12], ["skullcrusher", 3, 8, 12, "a1"], ["db-curl", 3, 10, 12, "a1"], ["pushdown", 3, 12, 15, "a2"], ["hammer-curl", 3, 12, 15, "a2"]] },
    },
  },
  {
    id: "arnold",
    name: "Arnold Split",
    tagline: "Golden-era volume: six days, antagonist pairs",
    tags: ["muscle", "intense"],
    level: "Advanced",
    daysPerWeek: 6,
    minutes: "75–90 min",
    intensity: 5,
    location: "Gym",
    bestFor: "Advanced lifters chasing maximum size who can recover from very high volume.",
    description:
      "Made famous by Arnold Schwarzenegger: chest & back together, shoulders & arms together, then legs — each twice a week. Pairing opposing muscles lets you superset them for huge volume in less time.",
    howItWorks: [
      "Chest and back exercises are supersetted back-to-back.",
      "Very high volume (often 20+ sets per muscle per week) — not for beginners.",
      "Take a lighter week every 5–6 weeks to recover.",
    ],
    week: ["cb", "sa", "legs", "cb", "sa", "legs", null],
    days: {
      cb: { name: "Chest & Back", items: [["bench", 4, 6, 10, "p1"], ["pullup", 4, 6, 10, "p1"], ["incline-db", 3, 8, 12, "p2"], ["barbell-row", 3, 8, 12, "p2"], ["cable-fly", 3, 12, 15, "p3"], ["pulldown", 3, 10, 12, "p3"]] },
      sa: { name: "Shoulders & Arms", items: [["barbell-ohp", 4, 6, 10], ["lat-raise", 4, 12, 20], ["rear-delt", 3, 12, 20], ["preacher-curl", 3, 8, 12, "p4"], ["skullcrusher", 3, 8, 12, "p4"], ["hammer-curl", 3, 10, 15, "p5"], ["pushdown", 3, 10, 15, "p5"]] },
      legs: { name: "Legs", items: [["squat", 4, 6, 10], ["leg-press", 3, 10, 15], ["rdl", 3, 8, 12], ["leg-ext", 3, 12, 15], ["leg-curl", 3, 12, 15], ["calf-raise", 5, 10, 20], ["hanging-leg-raise", 3, 10, 15]] },
    },
  },
  {
    id: "strength-5x5",
    name: "5×5 Strength",
    tagline: "Three barbell lifts, five heavy sets of five",
    tags: ["strength", "beginner"],
    badge: "Fastest strength gain",
    level: "Beginner",
    daysPerWeek: 3,
    minutes: "45–60 min",
    intensity: 3,
    location: "Gym",
    bestFor: "Getting strong quickly on the squat, bench, deadlift and overhead press.",
    description:
      "The simplest strength program there is: three exercises per workout, five sets of five reps, adding a little weight every session. Builds a strong foundation and some muscle, especially for newer lifters.",
    howItWorks: [
      "Workouts A and B alternate (A–B–A this week).",
      "Squat every session; deadlift is one heavy set of five.",
      "Add 2.5 kg to upper-body lifts and 5 kg to lower-body lifts each time you complete 5×5.",
      "Rest 3–5 minutes between heavy sets.",
    ],
    week: ["A", null, "B", null, "A", null, null],
    days: {
      A: { name: "5×5 Workout A", items: [["squat", 5, 5, 5], ["bench", 5, 5, 5], ["barbell-row", 5, 5, 5]] },
      B: { name: "5×5 Workout B", items: [["squat", 5, 5, 5], ["barbell-ohp", 5, 5, 5], ["deadlift", 1, 5, 5]] },
    },
  },
  {
    id: "powerbuilding",
    name: "Powerbuilding",
    tagline: "Powerlifting strength with bodybuilding size",
    tags: ["strength", "muscle", "intense"],
    level: "Intermediate",
    daysPerWeek: 4,
    minutes: "75 min",
    intensity: 4,
    location: "Gym",
    bestFor: "Lifters who want big numbers on squat, bench and deadlift and a muscular look.",
    description:
      "Each day is built around one main lift done heavy (3–5 reps), followed by bodybuilding accessories for size. Strength from powerlifting, aesthetics from bodybuilding.",
    howItWorks: [
      "Main lift: heavy sets of 3–5 with long rests.",
      "Accessories: 8–15 reps to build muscle around the main lift.",
      "Day 4 adds upper-body volume for shoulders and arms.",
    ],
    week: ["sq", "bp", null, "dl", "up", null, null],
    days: {
      sq: { name: "Squat Day", items: [["squat", 5, 3, 5], ["front-squat", 3, 6, 8], ["leg-press", 3, 10, 12], ["leg-curl", 3, 10, 15], ["calf-raise", 4, 10, 15]] },
      bp: { name: "Bench Day", items: [["bench", 5, 3, 5], ["incline-db", 3, 8, 12], ["barbell-row", 4, 6, 10], ["chest-dip", 3, 8, 12], ["face-pull", 3, 12, 20]] },
      dl: { name: "Deadlift Day", items: [["deadlift", 4, 2, 5], ["good-morning", 3, 6, 10], ["pullup", 4, 6, 10], ["hip-thrust", 3, 8, 12], ["hanging-leg-raise", 3, 10, 15]] },
      up: { name: "Upper Volume", items: [["barbell-ohp", 4, 5, 8], ["close-bench", 3, 6, 10], ["cable-row", 3, 10, 12], ["lat-raise", 4, 12, 20], ["db-curl", 3, 10, 12, "ss"], ["pushdown", 3, 10, 12, "ss"]] },
    },
  },
  {
    id: "gvt",
    name: "German Volume Training (10×10)",
    tagline: "Ten sets of ten — the toughest volume block",
    tags: ["intense", "muscle"],
    badge: "Most intense",
    level: "Advanced",
    daysPerWeek: 4,
    minutes: "60 min",
    intensity: 5,
    location: "Gym",
    bestFor: "A brutal 4–6 week block to shock your muscles into growing when you've stalled.",
    description:
      "Pick one big lift per muscle and do 10 sets of 10 with the same weight (about 60% of your max), resting only 60–90 seconds. Opposing muscles are supersetted. Extremely demanding — run it for a few weeks, then switch back to a normal plan.",
    howItWorks: [
      "Start at a weight you could lift ~20 times; it will feel heavy by set 7.",
      "Keep the weight the same for all 10 sets; increase it once you get 10×10.",
      "Accessory work is just 3 sets afterwards.",
      "Limit to 4–6 weeks; eat in a calorie surplus.",
    ],
    week: ["cb", "legs", null, "arms", "cb2", null, null],
    days: {
      cb: { name: "Chest & Back 10×10", items: [["db-bench", 10, 10, 10, "g1"], ["chest-row", 10, 10, 10, "g1"], ["cable-fly", 3, 10, 12, "g2"], ["pulldown", 3, 10, 12, "g2"]] },
      legs: { name: "Legs & Abs 10×10", items: [["squat", 10, 10, 10], ["leg-curl", 10, 10, 10], ["calf-raise", 3, 15, 20], ["hanging-leg-raise", 3, 10, 15]] },
      arms: { name: "Arms & Shoulders 10×10", items: [["tri-dip", 10, 10, 10, "g3"], ["hammer-curl", 10, 10, 10, "g3"], ["lat-raise", 3, 10, 12, "g4"], ["rear-delt", 3, 10, 12, "g4"]] },
      cb2: { name: "Chest & Back 10×10 (B)", items: [["incline-db", 10, 10, 10, "g5"], ["cable-row", 10, 10, 10, "g5"], ["chest-dip", 3, 10, 12, "g6"], ["face-pull", 3, 12, 15, "g6"]] },
    },
  },
  {
    id: "hit",
    name: "High-Intensity Training (HIT)",
    tagline: "One all-out set to failure per exercise",
    tags: ["intense", "busy", "muscle"],
    level: "Intermediate",
    daysPerWeek: 3,
    minutes: "30–40 min",
    intensity: 5,
    location: "Gym",
    bestFor: "People short on time who are willing to push every set to true muscular failure.",
    description:
      "Inspired by Mike Mentzer's \"Heavy Duty\": after warming up, do just 1–2 sets per exercise, each taken to the point where you can't do another rep. Very short workouts, very hard effort, plenty of rest between sessions.",
    howItWorks: [
      "Warm up, then 1–2 working sets to failure (6–10 reps).",
      "Control the weight: 2–3 s down, no bouncing.",
      "Rest at least a day between sessions; progress weight every workout you can.",
    ],
    week: ["A", null, "B", null, "A", null, null],
    days: {
      A: { name: "HIT A", items: [["leg-press", 2, 6, 10], ["leg-curl", 1, 6, 10], ["pulldown", 2, 6, 10], ["db-bench", 2, 6, 10], ["lat-raise", 1, 8, 12], ["db-curl", 1, 6, 10]] },
      B: { name: "HIT B", items: [["squat", 1, 6, 10], ["rdl", 1, 6, 10], ["cable-row", 2, 6, 10], ["incline-db", 2, 6, 10], ["machine-shoulder", 1, 6, 10], ["tri-dip", 1, 6, 12]] },
    },
  },
  {
    id: "calisthenics",
    name: "Calisthenics (Bodyweight)",
    tagline: "No equipment beyond a pull-up bar",
    tags: ["home", "beginner", "athletic"],
    badge: "No gym needed",
    level: "All levels",
    daysPerWeek: 4,
    minutes: "45 min",
    intensity: 3,
    location: "Home",
    bestFor: "Training at home or in a park — builds real-world strength, control and a lean, muscular build.",
    description:
      "Push-ups, pull-ups, dips, squats and core work. You make exercises harder by slowing down, adding reps, or moving to tougher variations (e.g. push-up → close-grip → plyometric).",
    howItWorks: [
      "Upper days alternate pushing and pulling; lower days add jumps for power.",
      "When you reach the top of the rep range easily, switch to a harder variation.",
      "A pull-up bar (or sturdy table for inverted rows) is the only kit needed.",
    ],
    week: ["upper", "lower", null, "upper2", "lower2", null, null],
    days: {
      upper: { name: "Upper A", items: [["pullup", 4, 5, 10], ["pushup", 4, 10, 20], ["inverted-row", 3, 8, 15], ["chest-dip", 3, 6, 12], ["plank", 3, 30, 60]] },
      lower: { name: "Lower A", items: [["bw-squat", 4, 15, 25], ["split-squat", 3, 8, 12], ["sl-glute-bridge", 3, 10, 15], ["jump-squat", 3, 8, 12], ["side-plank", 3, 30, 45]] },
      upper2: { name: "Upper B", items: [["chinup", 4, 5, 10], ["close-pushup", 3, 8, 15], ["handstand-pushup", 3, 3, 8], ["tri-dip", 3, 8, 12], ["hanging-leg-raise", 3, 8, 12]] },
      lower2: { name: "Lower B", items: [["lunge", 3, 10, 15], ["step-up", 3, 10, 12], ["glute-bridge", 3, 15, 20], ["box-jump", 3, 5, 8], ["mountain-climber", 3, 20, 30]] },
    },
  },
  {
    id: "home-dumbbell",
    name: "Home Dumbbell Builder",
    tagline: "Upper / lower with just a pair of dumbbells",
    tags: ["home", "muscle"],
    level: "All levels",
    daysPerWeek: 4,
    minutes: "45–60 min",
    intensity: 3,
    location: "Home",
    bestFor: "Building muscle at home with adjustable dumbbells and a bench (or the floor).",
    description:
      "A full upper/lower plan using only dumbbells and bodyweight. Higher reps make lighter weights effective — muscle grows across a wide rep range as long as sets are close to failure.",
    howItWorks: [
      "Sets of 8–20 reps taken within 1–2 reps of failure.",
      "Slow lowering (3 seconds) makes light weights harder.",
      "Each muscle trained twice a week.",
    ],
    week: ["upper", "lower", null, "upper2", "lower2", null, null],
    days: {
      upper: { name: "DB Upper A", items: [["db-bench", 4, 8, 12], ["db-row", 4, 8, 12], ["ohp", 3, 8, 12], ["db-fly", 3, 12, 15], ["db-curl", 3, 10, 15, "s1"], ["oh-ext", 3, 10, 15, "s1"]] },
      lower: { name: "DB Lower A", items: [["goblet-squat", 4, 10, 15], ["db-rdl", 4, 8, 12], ["split-squat", 3, 8, 12], ["db-calf", 4, 12, 20], ["plank", 3, 30, 60]] },
      upper2: { name: "DB Upper B", items: [["db-floor-press", 4, 8, 12], ["chest-row", 4, 10, 12], ["arnold-press", 3, 8, 12], ["lat-raise", 3, 12, 20], ["hammer-curl", 3, 10, 15], ["close-pushup", 3, 10, 20]] },
      lower2: { name: "DB Lower B", items: [["step-up", 4, 10, 12], ["glute-bridge", 4, 12, 20], ["lunge", 3, 10, 12], ["db-rdl", 3, 10, 15], ["russian-twist", 3, 15, 20]] },
    },
  },
  {
    id: "glutes-legs",
    name: "Glutes & Legs Focus",
    tagline: "Lower-body priority with upper-body maintenance",
    tags: ["muscle"],
    level: "All levels",
    daysPerWeek: 4,
    minutes: "60 min",
    intensity: 3,
    location: "Gym",
    bestFor: "Growing glutes and legs fastest while keeping the upper body in shape.",
    description:
      "Two lower-body days built around hip thrusts, squats and hinges, plus two lighter upper days. Glutes get about 16–20 hard sets a week from several angles.",
    howItWorks: [
      "Hip thrusts and Romanian deadlifts are the main glute builders.",
      "Abduction and kickbacks finish the glutes from different angles.",
      "Upper days keep your back, chest and shoulders progressing.",
    ],
    week: ["g1", "u1", null, "g2", "u2", null, null],
    days: {
      g1: { name: "Glutes & Quads", items: [["hip-thrust", 4, 8, 12], ["squat", 3, 6, 10], ["split-squat", 3, 8, 12], ["hip-abduction", 3, 12, 20], ["leg-ext", 3, 12, 15]] },
      u1: { name: "Upper A", items: [["pulldown", 3, 8, 12], ["db-bench", 3, 8, 12], ["cable-row", 3, 10, 12], ["lat-raise", 3, 12, 20], ["plank", 3, 30, 60]] },
      g2: { name: "Glutes & Hamstrings", items: [["rdl", 4, 6, 10], ["hip-thrust", 3, 10, 15], ["step-up", 3, 10, 12], ["lying-leg-curl", 3, 10, 15], ["cable-kickback", 3, 12, 20]] },
      u2: { name: "Upper B", items: [["ohp", 3, 8, 12], ["chest-row", 3, 10, 12], ["pushup", 3, 10, 20], ["face-pull", 3, 12, 20], ["hanging-leg-raise", 3, 8, 15]] },
    },
  },
  {
    id: "fat-loss",
    name: "Fat-Loss Strength & Circuits",
    tagline: "Keep your muscle while burning fat",
    tags: ["fatloss", "intense"],
    badge: "Best for fat loss",
    level: "All levels",
    daysPerWeek: 4,
    minutes: "45 min",
    intensity: 4,
    location: "Gym",
    bestFor: "Losing fat while keeping (or building) muscle — pair it with a calorie deficit.",
    description:
      "Two full-body strength days protect your muscle while dieting; two circuit days keep your heart rate high and burn extra calories. Your diet does most of the fat loss — this plan makes sure the weight you lose is fat, not muscle.",
    howItWorks: [
      "Strength days: keep the weights heavy (6–10 reps) even in a deficit.",
      "Circuit days: move between exercises in a group with minimal rest, then rest 2 minutes.",
      "Walk daily for extra calorie burn without hurting recovery.",
    ],
    week: ["s1", "c1", null, "s2", "c2", null, null],
    days: {
      s1: { name: "Strength A", items: [["squat", 3, 6, 10], ["bench", 3, 6, 10], ["barbell-row", 3, 8, 10], ["rdl", 2, 8, 10]] },
      c1: { name: "Circuit A", items: [["kb-swing", 3, 15, 20, "c"], ["pushup", 3, 10, 20, "c"], ["goblet-squat", 3, 12, 15, "c"], ["mountain-climber", 3, 20, 30, "c"], ["rower", 3, 10, 15]] },
      s2: { name: "Strength B", items: [["deadlift", 3, 4, 6], ["ohp", 3, 8, 10], ["pullup", 3, 5, 10], ["leg-press", 2, 10, 12]] },
      c2: { name: "Circuit B", items: [["jump-squat", 3, 10, 15, "d"], ["db-row", 3, 10, 12, "d"], ["star-jump", 3, 20, 30, "d"], ["lunge", 3, 10, 12, "d"], ["farmer-walk", 3, 30, 40]] },
    },
  },
  {
    id: "minimalist",
    name: "Minimalist 2-Day",
    tagline: "Two efficient full-body workouts a week",
    tags: ["busy", "beginner"],
    level: "All levels",
    daysPerWeek: 2,
    minutes: "45 min",
    intensity: 3,
    location: "Gym or home",
    bestFor: "Busy weeks, maintaining your gains, or getting back into training.",
    description:
      "Just two sessions covering every major muscle with the most effective lifts. Research shows you can keep — and even slowly build — muscle on surprisingly little training if every set counts.",
    howItWorks: [
      "Push every set to within 1–2 reps of failure.",
      "Supersets keep each session under 45 minutes.",
      "Ideal on Monday and Thursday so you recover in between.",
    ],
    week: ["A", null, null, "B", null, null, null],
    days: {
      A: { name: "Minimalist A", items: [["goblet-squat", 3, 8, 12], ["db-bench", 3, 8, 12, "m1"], ["db-row", 3, 8, 12, "m1"], ["db-rdl", 2, 8, 12], ["plank", 2, 30, 60]] },
      B: { name: "Minimalist B", items: [["split-squat", 3, 8, 12], ["ohp", 3, 8, 12, "m2"], ["pullup", 3, 5, 10, "m2"], ["glute-bridge", 2, 12, 15], ["db-curl", 2, 10, 15]] },
    },
  },
  {
    id: "athletic",
    name: "Athletic Performance",
    tagline: "Power, strength and conditioning for sport",
    tags: ["athletic", "strength"],
    level: "Intermediate",
    daysPerWeek: 3,
    minutes: "60 min",
    intensity: 4,
    location: "Gym",
    bestFor: "Jumping higher, sprinting faster and being strong and fit for sport.",
    description:
      "One day of explosive power work, one day of heavy strength, one day of conditioning. Trains the qualities athletes need rather than just muscle size.",
    howItWorks: [
      "Power exercises: low reps, full rest, move as fast as possible.",
      "Strength day: heavy compound lifts at 3–6 reps.",
      "Conditioning day: loaded carries, sled and intervals.",
    ],
    week: ["power", null, "strength", null, "condition", null, null],
    days: {
      power: { name: "Power", items: [["power-clean", 5, 3, 3], ["box-jump", 4, 3, 5], ["push-press", 4, 3, 5], ["plyo-pushup", 3, 5, 8], ["kb-swing", 3, 10, 15]] },
      strength: { name: "Strength", items: [["squat", 4, 3, 6], ["bench", 4, 3, 6], ["deadlift", 3, 3, 5], ["pullup", 3, 5, 8], ["side-plank", 3, 30, 45]] },
      condition: { name: "Conditioning", items: [["sled-push", 5, 1, 1], ["farmer-walk", 4, 30, 40], ["kb-high-pull", 3, 10, 15, "k"], ["mountain-climber", 3, 20, 30, "k"], ["rower", 5, 10, 15]] },
    },
  },
];

export function planTemplateItems(day: PlanDay): TemplateItem[] {
  return day.items.map(([exerciseId, sets, repMin, repMax, superset], i) => ({
    id: `i${i}`,
    exerciseId,
    sets,
    repMin,
    repMax,
    ...(superset ? { supersetId: superset } : {}),
  }));
}
