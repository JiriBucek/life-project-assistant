/**
 * Carry data across the Epic → Task model rename, instead of letting
 * `prisma db push` drop it.
 *
 * Prisma cannot tell a renamed model from a deleted one: when Epic became
 * Task, `db push --accept-data-loss` dropped the production "Epic" table —
 * rows and all — and created an empty "Task" table. This script runs in the
 * production build BEFORE `db push`. If it finds an old "Epic" table (for
 * example after the database is restored from a point-in-time backup), it
 * adopts it: renames the table and its constraints to what the current
 * schema expects, adds the completedAt column, and backfills it — so the
 * push that follows sees a database already in the right shape and touches
 * nothing.
 *
 * It never deletes anything. If both "Epic" and "Task" exist it stops the
 * build and asks for a human decision, because either choice would silently
 * discard the other table. It is idempotent and Postgres-only by nature;
 * anywhere without an "Epic" table (every healthy deploy from now on) it
 * logs one line and does nothing.
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function tableExists(name: string): Promise<boolean> {
  const rows = await prisma.$queryRawUnsafe<{ found: string | null }[]>(
    `SELECT to_regclass('public."${name}"')::text AS found`,
  );
  return rows[0]?.found != null;
}

async function main() {
  // Local SQLite dev has nothing to adopt (the rename there was done by
  // hand); anything else that goes wrong past this point — a connection
  // failure included — must fail the build, never silently skip.
  if (!(process.env.DATABASE_URL ?? "").startsWith("postgres")) {
    console.log("[adopt] not a Postgres database — nothing to do.");
    return;
  }
  if (!(await tableExists("Epic"))) {
    console.log('[adopt] no old "Epic" table — nothing to adopt.');
    return;
  }

  if (await tableExists("Task")) {
    throw new Error(
      'both "Epic" and "Task" tables exist. Adopting one would silently ' +
        "discard the other, so this needs a human: move or remove one of " +
        "them by hand, then deploy again.",
    );
  }

  await prisma.$executeRawUnsafe(`ALTER TABLE "Epic" RENAME TO "Task"`);
  // Constraint names carry the old table name; rename them too so the
  // following `db push` finds nothing to reconcile. Names can drift, so each
  // rename is best-effort — `db push` fixes any that are missed.
  const renames = [
    `ALTER TABLE "Task" RENAME CONSTRAINT "Epic_pkey" TO "Task_pkey"`,
    `ALTER TABLE "Task" RENAME CONSTRAINT "Epic_initiativeId_fkey" TO "Task_initiativeId_fkey"`,
  ];
  for (const sql of renames) {
    await prisma.$executeRawUnsafe(sql).catch(() => {});
  }

  // The rename landed together with the completedAt column — add and
  // backfill it here so the push has nothing destructive left to do.
  await prisma.$executeRawUnsafe(
    `ALTER TABLE "Task" ADD COLUMN IF NOT EXISTS "completedAt" TIMESTAMP(3)`,
  );
  const backfilled = await prisma.$executeRawUnsafe(
    `UPDATE "Task" SET "completedAt" = "updatedAt" WHERE "isComplete" = true AND "completedAt" IS NULL`,
  );

  const [{ count }] = await prisma.$queryRawUnsafe<{ count: bigint }[]>(
    `SELECT COUNT(*)::bigint AS count FROM "Task"`,
  );
  console.log(
    `[adopt] "Epic" is now "Task": ${count} task(s) carried over, ` +
      `${backfilled} completion date(s) backfilled.`,
  );
}

main()
  .catch((error) => {
    console.error(`[adopt] ${error.message ?? error}`);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
