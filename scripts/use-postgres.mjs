// Rewrites the Prisma datasource to PostgreSQL for production builds (Vercel).
//
// Local development keeps using SQLite (the committed schema). This script runs
// only inside `vercel-build`, in Vercel's ephemeral build checkout — it never
// changes your local schema. Idempotent: running it twice is a no-op.
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const schemaPath = path.resolve(process.cwd(), "prisma", "schema.prisma");
const schema = readFileSync(schemaPath, "utf8");

const postgresDatasource = `datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL")
  directUrl = env("DIRECT_URL")
}`;

if (schema.includes('provider  = "postgresql"')) {
  console.log("[use-postgres] schema already PostgreSQL — nothing to do");
  process.exit(0);
}

// Replace the whole `datasource db { ... }` block.
const next = schema.replace(/datasource db \{[\s\S]*?\}/, postgresDatasource);

if (next === schema) {
  console.error("[use-postgres] could not find a datasource block to replace");
  process.exit(1);
}

writeFileSync(schemaPath, next);
console.log("[use-postgres] datasource switched to PostgreSQL");
