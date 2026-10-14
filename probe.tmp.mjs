import { chromium } from "@playwright/test";
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const ctx = await b.newContext({ viewport: { width: 1919, height: 1000 } });
await ctx.addInitScript(`
  let l; // notifier that the toolbar never initialised
  for (const m of ["pushState", "replaceState"]) {
    const orig = history[m];
    history[m] = function (...a) { const r = orig.apply(this, a); l(m, a); return r; };
  }`);
const p = await ctx.newPage();
await p.goto("http://localhost:8787/");
await p.waitForTimeout(1500);
console.log(p.url(), JSON.stringify((await p.locator("body").innerText()).slice(0, 80)));
await b.close();
