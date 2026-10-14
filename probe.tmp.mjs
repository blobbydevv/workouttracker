import { chromium } from "@playwright/test";
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const ctx = await b.newContext({ viewport: { width: 1919, height: 1000 } });
// Newer Chrome: scroll methods return a Promise.
await ctx.addInitScript(`
  for (const [o, m] of [[window, "scrollTo"], [window, "scroll"], [window, "scrollBy"], [Element.prototype, "scrollIntoView"], [Element.prototype, "scrollTo"]]) {
    const orig = o[m]; o[m] = function (...a) { orig.apply(this, a); return Promise.resolve(); };
  }`);
const p = await ctx.newPage();
await p.goto("http://localhost:8787/");
await p.waitForTimeout(1500);
console.log(p.url(), JSON.stringify((await p.locator("body").innerText()).slice(0, 60)));
await b.close();
