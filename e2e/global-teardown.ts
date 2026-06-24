import { copyFileSync, existsSync, rmSync } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const ENV = path.join(ROOT, ".env");
const ENV_BACKUP = path.join(ROOT, ".env.e2e-backup");

// Restore the developer's original .env (back to the local dev database).
export default async function globalTeardown() {
  if (existsSync(ENV_BACKUP)) {
    copyFileSync(ENV_BACKUP, ENV);
    rmSync(ENV_BACKUP);
  }
}
