import { existsSync } from "node:fs";
import { defineConfig, devices } from "@playwright/test";

// Real Chrome when the machine has it; Playwright's bundled Chromium
// otherwise, so the suite still runs on machines without Chrome installed.
const channel = existsSync("/opt/google/chrome/chrome") ? "chrome" : undefined;

// E2E runs against an isolated dev server + SQLite test database so it never
// touches local seed data. Isolation is pure environment: DATABASE_URL points
// the test server at prisma/test.db (process env wins over `.env`, which is
// never modified), and NEXT_DIST_DIR gives it its own build dir + lockfile so
// it can boot alongside a normal dev server on another port.
// Exported so the auth helper can attach session cookies to the right origin.
export const PORT = 3100;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: [["list"]],
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "retain-on-failure",
    channel,
  },
  projects: [
    {
      name: "chrome",
      use: {
        ...devices["Desktop Chrome"],
        channel,
        // The default 1280×720 leaves too little canvas below the welcome
        // hero + always-open projects timeline; use a realistic laptop height.
        viewport: { width: 1280, height: 900 },
      },
    },
  ],
  globalTeardown: "./e2e/global-teardown.ts",
  webServer: {
    command: `node e2e/prepare-db.mjs && next dev -p ${PORT}`,
    url: `http://localhost:${PORT}`,
    timeout: 120_000,
    reuseExistingServer: false,
    env: {
      DATABASE_URL: "file:./test.db",
      NEXT_DIST_DIR: ".next-e2e",
      // Force Google sign-in into its "not switched on" state so the tests
      // are deterministic even on a machine that has real keys configured.
      GOOGLE_CLIENT_ID: "",
      GOOGLE_CLIENT_SECRET: "",
    },
  },
});
