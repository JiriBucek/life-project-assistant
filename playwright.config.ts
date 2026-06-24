import { defineConfig, devices } from "@playwright/test";

// E2E runs against an isolated dev server + SQLite test database so it never
// touches local seed data. The webServer command swaps `.env` to point at
// prisma/test.db and pushes the schema BEFORE `next dev` boots (so the server
// reads the right database); global-teardown restores the original `.env`.
const PORT = 3100;

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
    channel: "chrome",
  },
  projects: [
    { name: "chrome", use: { ...devices["Desktop Chrome"], channel: "chrome" } },
  ],
  globalTeardown: "./e2e/global-teardown.ts",
  webServer: {
    command: `node e2e/prepare-db.mjs && next dev -p ${PORT}`,
    url: `http://localhost:${PORT}`,
    timeout: 120_000,
    reuseExistingServer: false,
  },
});
