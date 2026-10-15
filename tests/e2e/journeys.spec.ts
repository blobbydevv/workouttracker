import type { Page } from "@playwright/test";
import { expect, signUp, test } from "./fixtures";

const SHOTS = "docs/screenshots";
const tab = (page: Page, name: string) => page.getByRole("navigation", { name: "Main" }).getByRole("link", { name });

function localISO(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

async function onboard(page: Page) {
  await signUp(page);
  await expect(page).toHaveURL(/onboarding/);
  await page.getByRole("button", { name: "Build muscle", exact: true }).click();
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("button", { name: /Beginner/ }).click();
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("button", { name: /^Gym/ }).click();
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("radio", { name: "4 days" }).click();
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("button", { name: "Continue" }).click(); // priority muscles (optional)
  await page.getByLabel("Current weight in kg").fill("80");
  await page.getByLabel("Current weight in kg").blur();
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("button", { name: /Lightly active/ }).click();
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByLabel("First name").fill("Alex");
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByText("Your starting plan")).toBeVisible();
  await page.screenshot({ path: `${SHOTS}/onboarding-review.png` });
  await page.getByRole("button", { name: "Start my plan" }).click();
  await expect(page.getByRole("heading", { name: "Hi, Alex" })).toBeVisible();
}

/** Ensures today has a workout (adds one on a rest day) and starts it. */
async function startTodaysWorkout(page: Page) {
  await tab(page, "Workout").click();
  const row = page.locator(`[data-date="${localISO()}"]`);
  await row.waitFor(); // schedule loaded before deciding rest vs workout
  if (await row.getByText("Rest", { exact: true }).isVisible()) {
    await row.getByText("Tap to add a workout").click();
    await page.getByRole("dialog").locator(".list-item").first().click();
  }
  await row.locator("button.grow").click();
  await expect(page).toHaveURL(/\/session\//);
}

test.beforeEach(async ({ page }) => {
  // Newer Chrome returns Promises from scroll methods; emulate it on every run.
  await page.addInitScript(`for (const [o, m] of [[window, "scrollTo"], [window, "scroll"], [window, "scrollBy"], [Element.prototype, "scrollIntoView"], [Element.prototype, "scrollTo"]]) { const f = o[m]; o[m] = function (...a) { f.apply(this, a); return Promise.resolve(); }; }`);
  // HOSTILE_HISTORY=1 reruns every journey under a throwing history wrapper (as Netlify's toolbar injects).
  if (process.env.HOSTILE_HISTORY)
    await page.addInitScript(`let l; for (const m of ["pushState","replaceState"]) { const o = history[m]; history[m] = function (...a) { const r = o.apply(this, a); l(m, a); return r; }; }`);
});

test("onboarding → first workout → interruption → resume → completion → history edit updates PRs", async ({ page }) => {
  await onboard(page);
  await page.screenshot({ path: `${SHOTS}/dashboard.png` });
  await startTodaysWorkout(page);
  await expect(page.locator(".tabbar")).toHaveCount(0); // tab bar hidden during workouts

  const w = page.getByLabel("Set 1 weight").first();
  await w.fill("60");
  await w.blur();
  const r = page.getByLabel("Set 1 reps").first();
  await r.fill("10");
  await r.blur();
  await page.getByLabel("Complete set 1").first().click();
  await expect(page.getByRole("timer", { name: "Rest timer" })).toBeVisible();
  await page.screenshot({ path: `${SHOTS}/session-rest.png` });

  // Interruption: full reload (app restart) keeps the session, sets and running timer.
  const url = page.url();
  await page.reload();
  await expect(page.getByLabel("Set 1 weight").first()).toHaveValue("60");
  await expect(page.getByLabel("Set 1 reps").first()).toHaveValue("10");
  await expect(page.getByRole("timer", { name: "Rest timer" })).toBeVisible();

  // Leave, then resume from the dashboard checklist.
  await page.goto("/");
  await page.getByRole("region", { name: "Daily checklist" }).getByText("In progress — tap to resume").click();
  await page.getByRole("button", { name: "Resume Workout" }).click();
  await expect(page).toHaveURL(url);

  // Rest override from the active exercise card is saved.
  await page.getByRole("button", { name: /^Rest timer for / }).first().click();
  await page.getByRole("option", { name: "3:00" }).click();
  await expect(page.getByText(/your saved time 3:00/)).toBeVisible();
  await page.keyboard.press("Escape");

  await page.getByRole("button", { name: /Finish Workout/ }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Finish Workout" }).click();
  await expect(page.getByRole("button", { name: "Done" })).toBeVisible();

  // Historical edit → PR update.
  await page.goto("/progress?tab=workouts");
  await page.getByRole("heading", { name: "Exercise history & records" }).waitFor();
  await page.locator('a[href^="/progress/exercise/"]').first().click();
  await expect(page.getByTestId("pr-heaviest")).toHaveText("60 kg × 10");
  await page.getByRole("button", { name: /Edit set 1 from/ }).click();
  await page.getByLabel("Weight", { exact: true }).fill("65");
  await page.getByLabel("Weight", { exact: true }).blur();
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByTestId("pr-heaviest")).toHaveText("65 kg × 10");
});

test("food entry, meal creation and settings update daily totals", async ({ page }) => {
  await onboard(page);
  await tab(page, "Nutrition").click();
  await expect(page.getByTestId("kcal-eaten")).toHaveText("0");

  await page.getByRole("button", { name: "Add food to Breakfast" }).click();
  await page.getByLabel("Search foods").fill("egg");
  await page.getByRole("button", { name: /Egg, whole/ }).click();
  await page.getByLabel("Servings", { exact: true }).fill("2");
  await page.getByLabel("Servings", { exact: true }).blur();
  await page.getByRole("button", { name: "Log to Breakfast" }).click();
  await expect(page.getByTestId("kcal-eaten")).toHaveText("144");
  await expect(page.getByTestId("slot-breakfast-totals")).toHaveText("144 kcal · 13 g protein");

  // Documented flow: plus → Meals → create named meal with ingredients → totals.
  await page.getByRole("button", { name: "Add food to Lunch" }).click();
  await page.getByRole("tab", { name: "Meals" }).click();
  await page.getByRole("link", { name: "Create Meal" }).click();
  await page.getByLabel("Meal name").fill("Chicken & rice");
  for (const f of ["Chicken breast", "White rice"]) {
    await page.getByRole("button", { name: "Add Ingredient" }).click();
    await page.getByLabel("Search ingredients").fill(f);
    await page.getByRole("dialog").getByRole("button", { name: new RegExp(f) }).click();
  }
  await expect(page.getByTestId("meal-kcal")).toHaveText("295");
  await page.getByRole("button", { name: "Save Meal" }).click();
  await page.getByRole("tab", { name: "Meals" }).click();
  await page.getByRole("button", { name: /Chicken & rice/ }).click();
  await page.getByRole("button", { name: "Log to Lunch" }).click();
  await expect(page.getByTestId("kcal-eaten")).toHaveText("439");

  // Quick add.
  await page.getByRole("button", { name: "Add food to Snacks" }).click();
  await page.getByRole("tab", { name: "Quick Add" }).click();
  await page.getByLabel("kcal").fill("100");
  await page.getByLabel("kcal").blur();
  await page.getByRole("button", { name: "Log", exact: true }).click();
  await expect(page.getByTestId("kcal-eaten")).toHaveText("539");

  // Gear setting reveals carbs & fats per meal; totals stay visible.
  await expect(page.getByTestId("slot-lunch-totals")).not.toContainText("carbs");
  await page.getByRole("button", { name: "Food Log settings" }).click();
  await page.getByLabel("Show carbs and fats for each meal").check();
  await page.keyboard.press("Escape");
  await expect(page.getByTestId("slot-lunch-totals")).toContainText("carbs");
  await page.screenshot({ path: `${SHOTS}/nutrition.png`, fullPage: true });

  // Persistence across restart.
  await page.reload();
  await expect(page.getByTestId("kcal-eaten")).toHaveText("539");
});

test("check-in changes target and locks for 7 days", async ({ page }) => {
  await onboard(page);
  await page.goto("/progress?tab=weight");
  const d = new Date();
  d.setDate(d.getDate() - 8);
  await page.getByRole("button", { name: "Log" }).click();
  await page.getByLabel("Date").fill(localISO(d));
  await page.getByLabel("Weight in kg").fill("81");
  await page.getByLabel("Weight in kg").blur();
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByText("81 kg", { exact: true })).toBeVisible();
  await page.goto("/nutrition/checkin");
  await expect(page.getByTestId("rate")).not.toHaveText("–");
  await page.getByLabel("New daily calories").fill("2100");
  await page.getByLabel("New daily calories").blur();
  await page.screenshot({ path: `${SHOTS}/checkin.png`, fullPage: true });
  await page.getByRole("button", { name: "Complete Check-In" }).click();
  await expect(page).toHaveURL(/\/nutrition$/);
  await expect(page.getByText("of 2100 kcal")).toBeVisible();
  await page.goto("/nutrition/checkin");
  await expect(page.getByText(/Check-ins can't be reopened for 7 days/)).toBeVisible();
});

test("schedule edits: delete to library, add back, future weeks blocked", async ({ page }) => {
  await onboard(page);
  await tab(page, "Workout").click();
  const named = page.locator(".day-row").filter({ hasText: "Upper A" }).first();
  await named.getByRole("button", { name: /^Options for/ }).click();
  await page.getByRole("button", { name: "Delete Workout" }).click();
  await page.getByRole("button", { name: "Save to Workout Library" }).click();
  await expect(page.locator(".day-row").filter({ hasText: "Upper A" })).toHaveCount(0);
  await page.getByRole("link", { name: "Workout Library" }).click();
  await expect(page.getByText("Upper A")).toBeVisible();
  await page.goBack();
  const rest = page.locator(".day-row").filter({ hasText: "Tap to add a workout" }).first();
  await rest.getByText("Tap to add a workout").click();
  await page.getByRole("dialog").getByRole("button", { name: /Upper A/ }).click();
  await expect(page.locator(".day-row").filter({ hasText: "Upper A" })).toHaveCount(1);
  await page.screenshot({ path: `${SHOTS}/workout-tab.png`, fullPage: true });

  // Dashboard calendar expands; a future-week workout can't be started.
  await tab(page, "Dashboard").click();
  await page.getByRole("button", { name: "Expand to calendar view" }).click();
  await page.getByRole("button", { name: "Next month" }).click();
  await page.screenshot({ path: `${SHOTS}/calendar-expanded.png` });
  await page.locator(".day:has(.dot.planned)").last().click();
  await page.getByRole("region", { name: "Daily checklist" }).locator("button.list-item").filter({ hasText: /exercises/ }).click();
  await expect(page.getByText("Not available yet")).toBeVisible();
});

test("AI coach shows a not-configured state instead of a fake reply", async ({ page }) => {
  await onboard(page);
  await page.getByRole("link", { name: "AI coach" }).click();
  await page.getByLabel("Message the coach").fill("How many sets should I do?");
  await page.getByRole("button", { name: "Send" }).click();
  await expect(page.getByRole("alert")).toContainText("aren't configured");
  await expect(page.locator(".bubble.assistant")).toHaveCount(0);
});
