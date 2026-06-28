import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  // In production builds we only want to seed a brand-new database, never
  // overwrite real data on redeploys. Locally, `npm run db:seed` resets fully.
  if (process.env.SEED_ONLY_IF_EMPTY) {
    const existing = await prisma.lifeArea.count();
    if (existing > 0) {
      console.log("Database already has data — skipping seed.");
      return;
    }
  }

  // Clean slate so re-seeding is idempotent.
  await prisma.reflection.deleteMany();
  await prisma.epic.deleteMany();
  await prisma.initiative.deleteMany();
  await prisma.project.deleteMany();
  await prisma.value.deleteMany();
  await prisma.lifeArea.deleteMany();

  // --- Life Areas with Values ---
  const health = await prisma.lifeArea.create({
    data: {
      name: "Health & Energy",
      satisfaction: 6,
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
    "Seeded Ellie Life Project Assistant with sample Life Map and project journey.",
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
