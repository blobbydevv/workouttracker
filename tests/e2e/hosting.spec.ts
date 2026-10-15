import { expect, signUp, test } from "./fixtures";

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
  await signUp(page);
  await expect(page.getByText("What's your main goal?")).toBeVisible();
  await page.reload();
  await expect(page.getByText("What's your main goal?")).toBeVisible();
});

test("survives a throwing wrapper installed after load, and in-app navigation still works", async ({ page }) => {
  await page.addInitScript(`addEventListener("load", () => setTimeout(() => { ${brokenWrapper} }, 0));`);
  await signUp(page);
  await expect(page.getByText("What's your main goal?")).toBeVisible();
  await page.waitForTimeout(300);
  await page.evaluate(() => history.pushState({}, "", "/onboarding?x=1"));
  expect(page.url()).toContain("/onboarding?x=1");
  await expect(page.getByText("What's your main goal?")).toBeVisible();
});

test("shows an update banner when a newer version is published, and Update reloads", async ({ page }) => {
  const fs = await import("node:fs");
  const file = "dist/version.json";
  const original = fs.readFileSync(file, "utf8");
  try {
    await signUp(page);
    await expect(page.getByText("What's your main goal?")).toBeVisible();
    await expect(page.getByText("A new version is available.")).toHaveCount(0);
    fs.writeFileSync(file, JSON.stringify({ build: "newer-build" }));
    // The app re-checks when you come back to the tab.
    await page.evaluate(() => document.dispatchEvent(new Event("visibilitychange")));
    await expect(page.getByText("A new version is available.")).toBeVisible();
    await page.screenshot({ path: "docs/screenshots/update-banner.png" });
    await page.getByRole("button", { name: "Update" }).click();
    await page.waitForLoadState("load");
    await expect(page.getByText("What's your main goal?")).toBeVisible();
  } finally {
    fs.writeFileSync(file, original);
  }
});
