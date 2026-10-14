import { expect, test } from "@playwright/test";

// Netlify's toolbar on private sites wraps history methods and its wrapper can
// throw ("l is not a function"). The app must keep working either way.
const brokenWrapper = `
  let l;
  for (const m of ["pushState", "replaceState"]) {
    const orig = history[m];
    history[m] = function (...a) { const r = orig.apply(this, a); l(m, a); return r; };
  }`;

test("survives a throwing history wrapper installed before the app", async ({ page }) => {
  await page.addInitScript(brokenWrapper);
  await page.goto("/");
  await expect(page.getByText("What's your main goal?")).toBeVisible();
  await page.reload();
  await expect(page.getByText("What's your main goal?")).toBeVisible();
});

test("survives a throwing wrapper installed after load, and in-app navigation still works", async ({ page }) => {
  await page.addInitScript(`addEventListener("load", () => setTimeout(() => { ${brokenWrapper} }, 0));`);
  await page.goto("/");
  await expect(page.getByText("What's your main goal?")).toBeVisible();
  await page.waitForTimeout(300);
  await page.evaluate(() => history.pushState({}, "", "/onboarding?x=1"));
  expect(page.url()).toContain("/onboarding?x=1");
  await expect(page.getByText("What's your main goal?")).toBeVisible();
});
