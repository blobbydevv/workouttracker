import type { Page } from "@playwright/test";
import { SCROLL_PROMISES, expect, signIn, signUp, test } from "./fixtures";

const SHOTS = "docs/screenshots";
const tab = (page: Page, name: string) => page.getByRole("navigation", { name: "Main" }).getByRole("link", { name });
const localISO = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

async function quickOnboard(page: Page, name: string) {
  await expect(page).toHaveURL(/onboarding/);
  for (let i = 0; i < 5; i++) await page.getByRole("button", { name: "Continue" }).click();
  await page.getByLabel("Current weight in kg").fill("80");
  await page.getByLabel("Current weight in kg").blur();
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByLabel("First name").fill(name);
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("button", { name: "Start my plan" }).click();
  await expect(page.getByRole("heading", { name: `Hi, ${name}` })).toBeVisible();
}

async function logOneSet(page: Page, weight: string, reps: string) {
  await tab(page, "Workout").click();
  const row = page.locator(`[data-date="${localISO()}"]`);
  if (await row.getByText("Rest", { exact: true }).isVisible()) {
    await row.getByText("Tap to add a workout").click();
    await page.getByRole("dialog").locator(".list-item").first().click();
  }
  await row.locator("button.grow").click();
  await page.getByLabel("Set 1 weight").first().fill(weight);
  await page.getByLabel("Set 1 weight").first().blur();
  await page.getByLabel("Set 1 reps").first().fill(reps);
  await page.getByLabel("Set 1 reps").first().blur();
  await page.getByLabel("Complete set 1").first().click();
  await page.getByRole("button", { name: /Finish Workout/ }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Finish Workout" }).click();
  await expect(page.getByRole("button", { name: "Done" })).toBeVisible();
}

test("phone and PC share one account: data logged on one appears on the other", async ({ page, browser, supa }) => {
  // Phone: create account, onboard, log a workout.
  await signUp(page);
  await quickOnboard(page, "Alex");
  await logOneSet(page, "60", "10");
  await expect.poll(() => [...supa.rows.values()].some((r) => r.tbl === "sets" && (r.data as { done?: boolean })?.done)).toBe(true);

  // PC: separate browser profile, same account.
  const pcContext = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await pcContext.addInitScript(SCROLL_PROMISES);
  await supa.install(pcContext);
  const pc = await pcContext.newPage();
  await signIn(pc);
  await expect(pc.getByRole("heading", { name: "Hi, Alex" })).toBeVisible(); // no onboarding: profile came from the account
  await tab(pc, "Progress").click();
  await expect(pc.getByText("60 kg × 10")).toBeVisible();

  // PC logs a weigh-in; the phone picks it up on its next sync.
  await pc.goto("/progress?tab=weight");
  await pc.getByRole("button", { name: "Log" }).click();
  await pc.getByLabel("Weight in kg").fill("79.4");
  await pc.getByLabel("Weight in kg").blur();
  await pc.getByRole("button", { name: "Save" }).click();
  await expect.poll(() => [...supa.rows.values()].some((r) => r.tbl === "weighins" && (r.data as { weightKg?: number })?.weightKg === 79.4)).toBe(true);
  await page.goto("/progress?tab=weight");
  await expect(page.getByText("79.4 kg", { exact: true }).first()).toBeVisible({ timeout: 10_000 });

  // Data is isolated per account: a second user sees nothing of Alex's.
  const other = await browser.newContext();
  await supa.install(other);
  const op = await other.newPage();
  await signUp(op, "sam@example.com");
  await expect(op).toHaveURL(/onboarding/);
  await other.close();
  await pcContext.close();
});

test("sign-in errors, sign-out and staying signed in across reloads", async ({ page }) => {
  await signUp(page);
  await quickOnboard(page, "Alex");
  await page.reload();
  await expect(page.getByRole("heading", { name: "Hi, Alex" })).toBeVisible();

  await page.goto("/profile");
  await expect(page.getByTestId("sync-status")).toHaveText(/Synced/);
  await page.getByRole("button", { name: "Sign out" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Sign out" }).click();
  await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();

  await page.getByLabel("Email").fill("alex@example.com");
  await page.getByLabel("Password").fill("wrong-password");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("alert")).toHaveText("Wrong email or password.");

  await page.getByLabel("Password").fill("correct-horse-1");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("heading", { name: "Hi, Alex" })).toBeVisible(); // data restored from the account
});

test("exercise progress graphs show weight and reps over time with exact values on tap", async ({ page, supa }) => {
  await signUp(page);
  await quickOnboard(page, "Alex");
  await logOneSet(page, "70", "8");
  await expect.poll(() => [...supa.rows.values()].some((r) => r.tbl === "sets")).toBe(true);

  // Earlier workouts for the same exercise arrive from "another device".
  const set = [...supa.rows.values()].find((r) => r.tbl === "sets" && (r.data as { done?: boolean }).done)!.data as { exerciseId: string };
  const history: Array<[number, number, number]> = [[42, 60, 8], [35, 62.5, 7], [28, 62.5, 9], [21, 65, 6], [14, 65, 8], [7, 67.5, 8]];
  const rows = history.flatMap(([daysAgo, w, r], i) => {
    const d = new Date();
    d.setDate(d.getDate() - daysAgo);
    const sid = `hist-${i}`;
    return [
      { tbl: "sessions", pk: sid, data: { id: sid, date: localISO(d), weekStart: localISO(d), templateId: "x", name: "Earlier workout", items: [], status: "completed", startedAt: d.getTime() } },
      { tbl: "sets", pk: String(900 + i), data: { id: 900 + i, sessionId: sid, itemId: "i", exerciseId: set.exerciseId, index: 0, type: "normal", weight: w, reps: r, done: true } },
    ];
  });
  supa.seedRows("alex@example.com", rows);
  await page.goto("/profile");
  await page.getByRole("button", { name: "Sync now" }).click();
  await expect(page.getByTestId("sync-status")).toHaveText(/Synced/);

  await tab(page, "Progress").click();
  await page.locator('a[href*="/progress/exercise/"]').first().click();
  await expect(page.getByTestId("stat-latest")).toHaveText("70 × 8");
  await expect(page.getByTestId("stat-change")).toHaveText("+10 kg");
  const weightChart = page.getByRole("img", { name: /Top set weight/ });
  await expect(weightChart).toHaveAttribute("aria-label", /7 workouts, latest 70 kg/);
  await page.screenshot({ path: `${SHOTS}/exercise-progress.png`, fullPage: true });

  // Tap the first point → readout with exact numbers.
  const box = (await weightChart.boundingBox())!;
  await page.mouse.move(box.x + 42, box.y + box.height / 2);
  await expect(page.getByRole("status").filter({ hasText: "60 kg" })).toContainText("8 reps");
  await page.screenshot({ path: `${SHOTS}/exercise-progress-tooltip.png` });

  // Keyboard: arrow keys step through workouts.
  await weightChart.focus();
  await page.keyboard.press("Escape");
  await page.keyboard.press("ArrowLeft"); // from no selection, ← starts at the latest workout
  await expect(page.getByRole("status").filter({ hasText: "70 kg" })).toContainText("8 reps");
  await page.keyboard.press("ArrowLeft");
  await expect(page.getByRole("status").filter({ hasText: "67.5 kg" })).toBeVisible();
});
