// Runs as the first step of the e2e webServer command, BEFORE `next dev` boots.
// The test database is selected purely via the DATABASE_URL environment
// variable (set here for the schema push, and by playwright.config.ts for the
// dev server) — `.env` is never touched, so a dev server running against the
// real database keeps working while tests run.
import { execSync } from "node:child_process";
import { existsSync, rmSync } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const TEST_DB = path.join(ROOT, "prisma", "test.db");
const TEST_DB_URL = "file:./test.db"; // relative to prisma/schema.prisma

// Fresh, empty database every run (the spec's "completely new user").
for (const f of [TEST_DB, `${TEST_DB}-journal`]) {
  if (existsSync(f)) rmSync(f);
}

execSync("npx prisma db push --skip-generate --accept-data-loss", {
  stdio: "inherit",
  cwd: ROOT,
  env: { ...process.env, DATABASE_URL: TEST_DB_URL },
});

console.log("[e2e] test database ready at prisma/test.db");
