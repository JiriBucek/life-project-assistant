import { PrismaClient } from "@prisma/client";
import { hashPassword, normalizeEmail } from "../src/lib/password";
import { buildSampleMap } from "./sample-map";

const prisma = new PrismaClient();

/**
 * The sample life map belongs to a demo account, since every life area and
 * project now needs an owner. Override with SEED_EMAIL / SEED_PASSWORD to seed
 * a different account — useful for giving a new invitee something to look at.
 *
 * The data itself lives in sample-map.ts, shared with the hosted showcase
 * account (`npm run db:showcase`) so there is only ever one example to maintain.
 */
const SEED_EMAIL = normalizeEmail(process.env.SEED_EMAIL ?? "demo@luma.local");
const SEED_PASSWORD = process.env.SEED_PASSWORD ?? "demo-password";

async function main() {
  // In production builds we only want to seed a brand-new database, never
  // overwrite real data on redeploys. Locally, `npm run db:seed` resets the
  // demo account only — other people's maps are never touched.
  if (process.env.SEED_ONLY_IF_EMPTY) {
    const existing = await prisma.lifeArea.count();
    if (existing > 0) {
      console.log("Database already has data — skipping seed.");
      return;
    }
  }

  const user = await prisma.user.upsert({
    where: { email: SEED_EMAIL },
    update: {},
    create: {
      email: SEED_EMAIL,
      name: "Demo",
      passwordHash: await hashPassword(SEED_PASSWORD),
    },
  });

  // Clean slate so re-seeding is idempotent — scoped to the demo account.
  // Deleting its areas and projects cascades to values, initiatives, tasks
  // and reflections, so those need no separate pass.
  await prisma.project.deleteMany({ where: { userId: user.id } });
  await prisma.lifeArea.deleteMany({ where: { userId: user.id } });

  const { areas, projects } = await buildSampleMap(prisma, user.id);

  console.log(
    `Seeded ${areas} life areas and ${projects} projects for ${SEED_EMAIL}.\n` +
      `Sign in with ${SEED_EMAIL} / ${SEED_PASSWORD}`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
