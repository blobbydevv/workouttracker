// Diet plan library. Targets are computed from your estimated maintenance
// calories (Mifflin-St Jeor × activity, using your latest weigh-in).
// Ranges follow common sports-nutrition guidance (e.g. protein 1.6–2.2 g/kg
// for people who lift); they are starting points, refined by weekly check-ins.

export interface DietPlan {
  id: string;
  name: string;
  tagline: string;
  goal: "gain" | "maintain" | "lose";
  badge?: string;
  /** Calorie change vs maintenance: fraction of maintenance (e.g. -0.2) . */
  calorieDelta: number;
  proteinPerKg: number;
  /** Fat as a fraction of calories, unless fatPerKg is given. */
  fatPct: number;
  /** Hard cap on carbs (g) for low-carb styles; the rest goes to fat. */
  carbCapG?: number;
  /** Weight Pacer target, % body weight per week. */
  pacer: number;
  bestFor: string;
  description: string;
  howTo: string[];
  sampleDay: string[];
  caution?: string;
}

export const DIET_PLANS: DietPlan[] = [
  {
    id: "lean-bulk",
    name: "Lean Bulk",
    tagline: "Small surplus — muscle with minimal fat",
    goal: "gain",
    badge: "Best for muscle",
    calorieDelta: 0.1,
    proteinPerKg: 2.0,
    fatPct: 0.25,
    pacer: 0.25,
    bestFor: "Building muscle steadily while staying fairly lean.",
    description: "Eat about 10% above maintenance so you gain roughly 0.25% of your body weight per week. Enough extra energy to build muscle, not so much that you pile on fat.",
    howTo: ["Hit your protein target every day.", "Weigh in most mornings; aim for a slow, steady upward trend.", "If you gain faster than ~0.5%/week, trim 100–150 kcal."],
    sampleDay: ["Breakfast: oats with milk, whey and a banana", "Lunch: chicken, rice and vegetables", "Snack: Greek yogurt and almonds", "Dinner: salmon, potatoes and broccoli"],
  },
  {
    id: "aggressive-bulk",
    name: "Aggressive Bulk",
    tagline: "Bigger surplus for faster weight gain",
    goal: "gain",
    calorieDelta: 0.2,
    proteinPerKg: 1.8,
    fatPct: 0.25,
    pacer: 0.5,
    bestFor: "Skinny \"hardgainers\" and beginners who struggle to gain weight.",
    description: "About 20% above maintenance. You'll gain faster — a mix of muscle and some fat — which suits people who find eating enough difficult.",
    howTo: ["Add calorie-dense foods: nuts, peanut butter, olive oil, whole milk.", "Eat 4–5 times a day.", "Run it for a few months, then switch to a lean bulk or maintenance."],
    sampleDay: ["Breakfast: 3 eggs, toast with peanut butter, milk", "Lunch: beef mince pasta", "Snack: protein shake with oats and banana", "Dinner: chicken, rice, olive oil, vegetables", "Before bed: Greek yogurt"],
    caution: "Expect some fat gain; plan a short cut afterwards if you want to stay lean.",
  },
  {
    id: "maintenance",
    name: "Maintenance",
    tagline: "Hold your weight, fuel your training",
    goal: "maintain",
    calorieDelta: 0,
    proteinPerKg: 1.8,
    fatPct: 0.3,
    pacer: 0,
    bestFor: "Taking a break from dieting, maintaining results, or focusing on performance.",
    description: "Eat at your estimated maintenance. Training progress continues and you can slowly recompose if protein is high.",
    howTo: ["Keep your weekly average weight within ±0.5 kg.", "Use check-ins to fine-tune the calorie target."],
    sampleDay: ["Breakfast: Greek yogurt, oats and fruit", "Lunch: tuna wholemeal sandwich and an apple", "Dinner: chicken, potatoes and vegetables", "Snack: cheese and crackers"],
  },
  {
    id: "recomp",
    name: "Body Recomposition",
    tagline: "Lose fat and gain muscle at the same time",
    goal: "maintain",
    badge: "Lose fat + build muscle",
    calorieDelta: -0.08,
    proteinPerKg: 2.2,
    fatPct: 0.27,
    pacer: -0.15,
    bestFor: "Beginners, people returning to training, or anyone with some fat to lose who wants to build muscle too.",
    description: "A very small deficit with very high protein and hard training. Your weight changes slowly, but your waist shrinks and lifts go up.",
    howTo: ["Prioritise protein at every meal (30–50 g).", "Judge progress by measurements, photos and strength, not just the scale.", "Train every muscle at least twice a week."],
    sampleDay: ["Breakfast: egg-white omelette with toast", "Lunch: chicken salad wrap", "Snack: whey shake and fruit", "Dinner: lean beef, rice and vegetables"],
  },
  {
    id: "moderate-cut",
    name: "Moderate Cut",
    tagline: "Steady fat loss you can sustain",
    goal: "lose",
    badge: "Best for fat loss",
    calorieDelta: -0.2,
    proteinPerKg: 2.2,
    fatPct: 0.25,
    pacer: -0.5,
    bestFor: "Losing fat at a sustainable pace while keeping your muscle.",
    description: "About 20% below maintenance, aiming to lose roughly 0.5% of body weight per week. High protein and continued heavy training protect your muscle.",
    howTo: ["Keep lifting heavy — it tells your body to keep muscle.", "Fill up on vegetables, lean protein and high-volume foods.", "Walk more: aim for your daily step goal."],
    sampleDay: ["Breakfast: Greek yogurt with berries", "Lunch: chicken breast, salad and potatoes", "Snack: protein shake", "Dinner: white fish, rice and vegetables"],
  },
  {
    id: "aggressive-cut",
    name: "Aggressive Cut (Mini-cut)",
    tagline: "Fast fat loss for 2–6 weeks",
    goal: "lose",
    calorieDelta: -0.3,
    proteinPerKg: 2.4,
    fatPct: 0.22,
    pacer: -1.0,
    bestFor: "A short, sharp fat-loss phase before an event or after a bulk.",
    description: "Around 30% below maintenance. Very high protein keeps you full and protects muscle. Run it for a few weeks only, then return to maintenance.",
    howTo: ["Limit to 2–6 weeks.", "Keep training intensity high but you may reduce volume slightly.", "Expect lower energy; prioritise sleep."],
    sampleDay: ["Breakfast: egg whites and spinach", "Lunch: tuna, salad and rice cakes", "Snack: protein shake", "Dinner: chicken, broccoli and potatoes"],
    caution: "Not suitable for long periods, during pregnancy, or with a history of disordered eating.",
  },
  {
    id: "high-protein",
    name: "High-Protein",
    tagline: "Maximum fullness and muscle support",
    goal: "lose",
    calorieDelta: -0.15,
    proteinPerKg: 2.5,
    fatPct: 0.25,
    pacer: -0.4,
    bestFor: "Controlling hunger while dieting — protein is the most filling nutrient.",
    description: "A modest deficit with very high protein. Great if hunger is what usually ends your diets.",
    howTo: ["Build every meal around a protein source.", "Use lean meats, fish, eggs, Greek yogurt, cottage cheese and whey.", "Spread protein over 4 meals."],
    sampleDay: ["Breakfast: Greek yogurt, whey and berries", "Lunch: chicken and quinoa bowl", "Snack: cottage cheese", "Dinner: lean steak, vegetables and potatoes"],
  },
  {
    id: "keto",
    name: "Low-Carb / Keto",
    tagline: "Minimal carbs, higher fat",
    goal: "lose",
    calorieDelta: -0.2,
    proteinPerKg: 2.0,
    fatPct: 0.6,
    carbCapG: 40,
    pacer: -0.5,
    bestFor: "People who feel better and less hungry eating few carbs.",
    description: "Carbs are kept very low (about 40 g a day) and fat makes up most of your energy. Fat loss comes from the calorie deficit, as with any diet — choose this if it suits your appetite.",
    howTo: ["Base meals on meat, fish, eggs, cheese, nuts, olive oil and leafy vegetables.", "Expect a quick initial drop on the scale (water), then steady fat loss.", "High-intensity training may feel harder at first."],
    sampleDay: ["Breakfast: eggs, avocado and cheese", "Lunch: salmon salad with olive oil", "Snack: almonds", "Dinner: steak with buttered broccoli"],
    caution: "Talk to a doctor first if you have diabetes or take blood-pressure medication.",
  },
  {
    id: "mediterranean",
    name: "Mediterranean",
    tagline: "Heart-healthy, flexible, easy to follow",
    goal: "maintain",
    calorieDelta: -0.05,
    proteinPerKg: 1.6,
    fatPct: 0.35,
    pacer: -0.1,
    bestFor: "Long-term health and an easy, enjoyable way of eating.",
    description: "Lots of vegetables, fruit, whole grains, fish, olive oil and nuts. Consistently linked with better heart health, and easy to stick to for years.",
    howTo: ["Use olive oil as your main fat.", "Fish twice a week; legumes several times a week.", "Red meat occasionally."],
    sampleDay: ["Breakfast: Greek yogurt, honey and walnuts", "Lunch: lentil and vegetable soup with wholemeal bread", "Snack: fruit and almonds", "Dinner: grilled salmon, salad and potatoes with olive oil"],
  },
  {
    id: "plant-based",
    name: "Plant-Based High Protein",
    tagline: "Vegan-friendly muscle building",
    goal: "maintain",
    calorieDelta: 0.05,
    proteinPerKg: 2.0,
    fatPct: 0.27,
    pacer: 0.1,
    bestFor: "Vegetarians and vegans who want to build muscle.",
    description: "Hits a high protein target from plants: tofu, tempeh, seitan, lentils, beans, soy milk and plant protein powder. Slightly higher protein compensates for plant proteins being a little less efficient.",
    howTo: ["Combine sources (beans + grains) through the day.", "Use a pea/soy protein powder to hit your target easily.", "Consider vitamin B12 and vitamin D supplements."],
    sampleDay: ["Breakfast: oats with soy milk and plant protein", "Lunch: tofu stir-fry with rice", "Snack: hummus and wholemeal pitta", "Dinner: lentil chilli with quinoa"],
  },
  {
    id: "if-16-8",
    name: "Intermittent Fasting 16:8",
    tagline: "Eat within an 8-hour window",
    goal: "lose",
    calorieDelta: -0.18,
    proteinPerKg: 2.0,
    fatPct: 0.3,
    pacer: -0.5,
    bestFor: "People who prefer fewer, bigger meals and find skipping breakfast easy.",
    description: "Fast for 16 hours (including sleep) and eat your calories in an 8-hour window, e.g. 12pm–8pm. It's simply a way to make a calorie deficit easier — results match regular dieting at the same calories.",
    howTo: ["Pick a window that fits your training (eat after workouts).", "Water, black coffee and tea are fine while fasting.", "Fit 2–3 high-protein meals in the window."],
    sampleDay: ["12:00 — chicken, rice and vegetables", "16:00 — Greek yogurt, fruit and whey", "19:30 — salmon, potatoes and salad"],
  },
  {
    id: "carb-cycling",
    name: "Carb Cycling",
    tagline: "More carbs on training days, fewer on rest days",
    goal: "lose",
    calorieDelta: -0.15,
    proteinPerKg: 2.0,
    fatPct: 0.25,
    pacer: -0.4,
    bestFor: "Experienced dieters who want more energy for workouts while still losing fat.",
    description: "Your daily target here is the weekly average. On training days add ~50–80 g carbs above it; on rest days take the same amount off. Total weekly calories stay in a deficit.",
    howTo: ["Training day: target + 60 g carbs (around your workout).", "Rest day: target − 60 g carbs, a little more fat and vegetables.", "Protein stays the same every day."],
    sampleDay: ["Training day: oats pre-workout, rice and chicken after, pasta dinner", "Rest day: eggs, big salad with salmon, steak and vegetables"],
  },
];

export interface Body {
  sex: "female" | "male" | "unspecified";
  age: number;
  heightCm: number;
  weightKg: number;
  activity: "sedentary" | "light" | "moderate" | "very";
}

/** Estimated maintenance calories (Mifflin-St Jeor × activity factor). */
export function maintenanceCalories(b: Body): number {
  const s = b.sex === "male" ? 5 : b.sex === "female" ? -161 : -78;
  const bmr = 10 * b.weightKg + 6.25 * b.heightCm - 5 * b.age + s;
  const factor = { sedentary: 1.2, light: 1.375, moderate: 1.55, very: 1.725 }[b.activity];
  return bmr * factor;
}

export function dietTargets(plan: DietPlan, b: Body) {
  const maint = maintenanceCalories(b);
  const floor = b.sex === "male" ? 1500 : 1200;
  const raw = maint * (1 + plan.calorieDelta);
  const calories = Math.max(floor, Math.round(raw / 10) * 10);
  const protein = Math.round(b.weightKg * plan.proteinPerKg);
  let carbs: number;
  let fat: number;
  if (plan.carbCapG != null) {
    carbs = plan.carbCapG;
    fat = Math.max(0, Math.round((calories - protein * 4 - carbs * 4) / 9));
  } else {
    fat = Math.round((calories * plan.fatPct) / 9);
    carbs = Math.max(0, Math.round((calories - protein * 4 - fat * 9) / 4));
  }
  return { calories, protein, carbs, fat, maintenance: Math.round(maint), flooredAt: raw < floor ? floor : null };
}
