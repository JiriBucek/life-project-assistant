// Runs as the first step of the e2e webServer command, BEFORE `next dev` boots,
// so the dev server reads a .env that already points at the isolated test DB.
import { execSync } from "node:child_process";
import { copyFileSync, existsSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const ENV = path.join(ROOT, ".env");
const ENV_BACKUP = path.join(ROOT, ".env.e2e-backup");
const TEST_DB = path.join(ROOT, "prisma", "test.db");

// Back up the developer's .env once, then point it at the test database.
if (existsSync(ENV) && !existsSync(ENV_BACKUP)) copyFileSync(ENV, ENV_BACKUP);
writeFileSync(ENV, 'DATABASE_URL="file:./test.db"\n');

// Fresh, empty database every run (the spec's "completely new user").
for (const f of [TEST_DB, `${TEST_DB}-journal`]) {
  if (existsSync(f)) rmSync(f);
}

execSync("npx prisma db push --skip-generate --accept-data-loss", {
  stdio: "inherit",
  cwd: ROOT,
});

console.log("[e2e] test database ready at prisma/test.db");
