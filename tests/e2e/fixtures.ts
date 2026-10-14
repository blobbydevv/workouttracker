import { test as base, expect, type Page } from "@playwright/test";
import { SupabaseMock } from "./supabaseMock";

/** Every test gets a fresh stand-in Supabase project, routed into its browser context. */
export const test = base.extend<{ supa: SupabaseMock }>({
  supa: async ({}, use) => {
    await use(new SupabaseMock());
  },
  context: async ({ context, supa }, use) => {
    // Current Chrome returns Promises from scroll methods; emulate it everywhere.
    await context.addInitScript(SCROLL_PROMISES);
    await supa.install(context);
    await use(context);
  },
});
export { expect };

export const SCROLL_PROMISES = `for (const [o, m] of [[window, "scrollTo"], [window, "scroll"], [window, "scrollBy"], [Element.prototype, "scrollIntoView"], [Element.prototype, "scrollTo"]]) { const f = o[m]; o[m] = function (...a) { f.apply(this, a); return Promise.resolve(); }; }`;

export async function signUp(page: Page, email = "alex@example.com", password = "correct-horse-1") {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
  await page.getByRole("button", { name: "New here? Create an account" }).click();
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Create account" }).click();
}

export async function signIn(page: Page, email = "alex@example.com", password = "correct-horse-1") {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
}
