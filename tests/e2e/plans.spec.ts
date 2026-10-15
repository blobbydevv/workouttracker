import type { Page } from "@playwright/test";
import { expect, signUp, test } from "./fixtures";

const SHOTS = "docs/screenshots";
const tab = (page: Page, name: string) => page.getByRole("navigation", { name: "Main" }).getByRole("link", { name });

async function setup(page: Page) {
  await signUp(page);
  await expect(page).toHaveURL(/onboarding/);
  for (let i = 0; i < 5; i++) await page.getByRole("button", { name: "Continue" }).click();
  await page.getByLabel("Current weight in kg").fill("80");
  await page.getByLabel("Current weight in kg").blur();
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByLabel("First name").fill("Alex");
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("button", { name: "Start my plan" }).click();
  await expect(page.getByRole("heading", { name: "Hi, Alex" })).toBeVisible();
}

test("browse 10+ workout plans, filter, read details and switch plan", async ({ page }) => {
  await setup(page);
  await tab(page, "Workout").click();
  await page.getByRole("link", { name: "Workout plans" }).click();
  const cards = page.locator(".plan-card");
  await expect(cards.nth(9)).toBeVisible();
  expect(await cards.count()).toBeGreaterThanOrEqual(10);
  await page.screenshot({ path: `${SHOTS}/workout-plans.png`, fullPage: true });
  await page.getByRole("button", { name: "Most intense" }).click();
  await expect(page.getByText("German Volume Training (10×10)")).toBeVisible();
  await page.getByRole("button", { name: /^All/ }).click();

  await page.getByText("Push / Pull / Legs", { exact: true }).click();
  await expect(page.getByRole("heading", { name: "Best for" })).toBeVisible();
  await expect(page.getByText("Building muscle as fast as possible")).toBeVisible();
  await page.screenshot({ path: `${SHOTS}/workout-plan-detail.png`, fullPage: true });
  await page.getByRole("button", { name: "Start this plan" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Start plan" }).click();

  await expect(page.getByText("Current plan:")).toContainText("Push / Pull / Legs");
  await expect(page.locator(".day-row").filter({ hasText: /Push A|Pull A|Legs A|Push B|Pull B|Legs B/ })).toHaveCount(6);
});

test("pick a diet plan and the daily targets update", async ({ page }) => {
  await setup(page);
  await tab(page, "Nutrition").click();
  await page.getByRole("link", { name: /Choose a diet plan/ }).click();
  await expect(page.getByText("Lean Bulk", { exact: true })).toBeVisible();
  expect(await page.locator("a.card").count()).toBeGreaterThanOrEqual(10);
  await page.screenshot({ path: `${SHOTS}/diet-plans.png`, fullPage: true });
  await page.getByText("Lean Bulk", { exact: true }).click();
  const kcal = await page.getByRole("region", { name: "Your targets" }).locator(".stat-row b").first().innerText();
  await page.getByRole("button", { name: "Use this plan" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Use this plan" }).click();
  await expect(page.getByText(`of ${kcal} kcal`)).toBeVisible();
  await expect(page.getByText("Diet plan: Lean Bulk")).toBeVisible();
});

test("quick log any exercise outside the plan, including a custom one", async ({ page }) => {
  await setup(page);
  await tab(page, "Workout").click();
  await page.getByRole("button", { name: "Quick log" }).click();
  await expect(page.getByRole("dialog", { name: "Add Exercise" })).toBeVisible();
  await page.getByLabel("Search exercises").fill("deadlift");
  await page.getByRole("dialog").getByRole("button", { name: /^Barbell Deadlift/ }).click();
  await page.getByLabel("Set 1 weight").fill("100");
  await page.getByLabel("Set 1 weight").blur();
  await page.getByLabel("Set 1 reps").fill("5");
  await page.getByLabel("Set 1 reps").blur();
  await page.getByLabel("Complete set 1").click();

  // Add a brand-new exercise to the same workout.
  await page.getByRole("button", { name: "Add Exercise" }).click();
  await page.getByLabel("Search exercises").fill("Zercher Squat");
  await page.getByRole("button", { name: /Create a new exercise/ }).click();
  await page.getByLabel("Main muscle").selectOption("Quads");
  await page.getByRole("button", { name: "Create & add" }).click();
  await expect(page.getByRole("heading", { name: "Zercher Squat" })).toBeVisible();
  await page.screenshot({ path: `${SHOTS}/quick-log.png`, fullPage: true });
  await page.getByRole("button", { name: /Finish Workout/ }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Finish Workout" }).click();
  await page.getByRole("button", { name: "Done" }).click();

  await tab(page, "Progress").click();
  await expect(page.getByRole("link", { name: /Barbell Deadlift.*100 kg × 5/ })).toBeVisible();

  // "Log this exercise now" from an exercise's page starts a quick workout with it.
  await page.getByRole("link", { name: /Barbell Deadlift/ }).click();
  await page.getByRole("button", { name: "Log this exercise now" }).click();
  await expect(page.getByRole("heading", { name: "Barbell Deadlift" })).toBeVisible();
  await expect(page.getByText("Quick Workout")).toBeVisible();
});
