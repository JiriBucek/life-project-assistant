import { PrismaClient } from "@prisma/client";
import { hashPassword, normalizeEmail } from "../src/lib/password";

const prisma = new PrismaClient();

/**
 * The sample life map belongs to a demo account, since every life area and
 * project now needs an owner. Override with SEED_EMAIL / SEED_PASSWORD to seed
 * a different account — useful for giving a new invitee something to look at.
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
  // Deleting its areas and projects cascades to values, initiatives, epics
  // and reflections, so those need no separate pass.
  await prisma.project.deleteMany({ where: { userId: user.id } });
  await prisma.lifeArea.deleteMany({ where: { userId: user.id } });

  // --- Life Areas with Values ---
  const health = await prisma.lifeArea.create({
    data: {
      name: "Health & Energy",
      satisfaction: 6,
      userId: user.id,
      x: 80,
      y: 40,
      order: 0,
      values: {
        create: [{ name: "Vitality" }, { name: "Discipline" }],
      },
    },
    include: { values: true },
  });

  const growth = await prisma.lifeArea.create({
    data: {
      name: "Personal Growth",
      satisfaction: 7,
      userId: user.id,
      x: 80,
      y: 460,
      order: 1,
      values: {
        create: [{ name: "Mastery" }, { name: "Curiosity" }],
      },
    },
    include: { values: true },
  });

  const relationships = await prisma.lifeArea.create({
    data: {
      name: "Relationships",
      satisfaction: 5,
      userId: user.id,
      x: 80,
      y: 880,
      order: 2,
      values: {
        create: [{ name: "Connection" }, { name: "Presence" }],
      },
    },
    include: { values: true },
  });

  // --- A sample Project connected to values across two areas ---
  const project = await prisma.project.create({
    data: {
      name: "Run a half marathon",
      whyStatement:
        "To prove to myself that consistency compounds — and feel strong and alive again.",
      userId: user.id,
      // A ~4.5-month journey — long enough that the timeline shows months.
      startDate: new Date("2026-06-01T00:00:00.000Z"),
      targetDate: new Date("2026-10-15T00:00:00.000Z"),
      x: 560,
      y: 320,
      values: {
        connect: [
          { id: health.values[0].id }, // Vitality
          { id: health.values[1].id }, // Discipline
          { id: growth.values[0].id }, // Mastery
        ],
      },
    },
  });

  // --- Initiatives on the timeline ---
  const base = await prisma.initiative.create({
    data: {
      title: "Build an aerobic base",
      projectId: project.id,
      startDay: 0,
      duration: 28,
      lane: 0,
      epics: {
        create: [
          { title: "Run 3x/week easy", order: 0, isComplete: true },
          { title: "Reach 5km continuous", order: 1, isComplete: true },
          { title: "Reach 10km continuous", order: 2 },
        ],
      },
    },
  });

  await prisma.initiative.create({
    data: {
      title: "Speed & strength",
      projectId: project.id,
      startDay: 24,
      duration: 28,
      lane: 1,
      epics: {
        create: [
          { title: "Weekly interval session", order: 0 },
          { title: "Twice-weekly strength", order: 1 },
        ],
      },
    },
  });

  await prisma.initiative.create({
    data: {
      title: "Race prep & taper",
      projectId: project.id,
      startDay: 56,
      duration: 21,
      lane: 0,
      epics: {
        create: [
          { title: "Long run up to 18km", order: 0 },
          { title: "Plan race-day logistics", order: 1 },
        ],
      },
    },
  });

  // Avoid unused-var lint on `relationships` / `base`.
  void relationships;
  void base;

  console.log(
    `Seeded a sample Life Map and project journey for ${SEED_EMAIL}.\n` +
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
