import { defineConfig } from "@playwright/test";

// Viewport fixed at 390x844 so implementation captures can later be diffed
// against reference captures at identical dimensions.
export default defineConfig({
  testDir: "tests/e2e",
  timeout: 60_000,
  fullyParallel: false,
  workers: 1,
  reporter: [["list"]],
  use: {
    baseURL: "http://localhost:8787",
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    hasTouch: true,
    launchOptions: { executablePath: process.env.PW_CHROMIUM ?? "/opt/pw-browsers/chromium" },
  },
  webServer: {
    command: "npm run build && env -u ANTHROPIC_API_KEY -u ANTHROPIC_AUTH_TOKEN node server/coach-server.mjs",
    url: "http://localhost:8787/api/health",
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
