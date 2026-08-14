import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { computePortfolioSummary } from "@/lib/portfolio";
import { addDays } from "@/lib/timeline";

export type ProgressStat = { total: number; done: number; pct: number };

function pct(done: number, total: number): ProgressStat {
  return { total, done, pct: total === 0 ? 0 : Math.round((done / total) * 100) };
}

/**
 * The signed-in user's life map. The scoping happens here rather than in the
 * pages, so there is no unscoped way to ask for this data — a caller can't
 * forget to pass a user id, because it never takes one.
 */
export async function getLifeMap() {
  const user = await requireUser();

  const [areas, projects] = await Promise.all([
    prisma.lifeArea.findMany({
      where: { userId: user.id },
      // Having filtered by it, the owner id itself is of no use to the
      // browser — leave it in the database.
      omit: { userId: true },
      orderBy: { order: "asc" },
      include: {
        values: { orderBy: { createdAt: "asc" } },
        satisfactionHistory: {
          select: { value: true, createdAt: true },
          orderBy: { createdAt: "asc" },
        },
      },
    }),
    prisma.project.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "asc" },
      include: {
        values: { select: { id: true, name: true, areaId: true } },
        initiatives: {
          orderBy: { startDay: "asc" },
          include: {
            tasks: {
              select: {
                isComplete: true,
                updatedAt: true,
                createdAt: true,
                completedAt: true,
              },
            },
          },
        },
        reflections: {
          select: { createdAt: true },
          orderBy: { createdAt: "desc" },
          take: 1,
        },
      },
    }),
  ]);

  const projectsWithProgress = projects.map((p) => {
    const tasks = p.initiatives.flatMap((i) => i.tasks);
    const done = tasks.filter((e) => e.isComplete).length;
    // Which areas does this project touch (via its values)?
    const areaIds = Array.from(
      new Set(p.values.map((v) => v.areaId).filter(Boolean)),
    ) as string[];
    // Most recent touch anywhere in the project's tree — powers the
    // "no recent activity" nudge in the summary panel.
    const lastActivityAt = new Date(
      Math.max(
        p.updatedAt.getTime(),
        ...p.initiatives.map((i) => i.updatedAt.getTime()),
        ...tasks.map((e) => e.updatedAt.getTime()),
        ...p.reflections.map((r) => r.createdAt.getTime()),
      ),
    );
    // One level down for the Projects roadmap: each initiative as a real date
    // window (startDay/duration are days from the project's Start Date) with its
    // own task roll-up, so a row can show what's finished and what's live now.
    const initiatives = p.initiatives.map((i) => ({
      id: i.id,
      title: i.title,
      startDate: addDays(p.startDate, i.startDay),
      endDate: addDays(p.startDate, i.startDay + i.duration),
      progress: pct(i.tasks.filter((e) => e.isComplete).length, i.tasks.length),
    }));

    return {
      id: p.id,
      name: p.name,
      whyStatement: p.whyStatement,
      x: p.x,
      y: p.y,
      valueIds: p.values.map((v) => v.id),
      values: p.values,
      areaIds,
      startDate: p.startDate,
      targetDate: p.targetDate,
      lastActivityAt,
      initiatives,
      progress: pct(done, tasks.length),
      // Raw task dates for the per-area Progress chart: when each task entered
      // the plan and when (if ever) it was closed.
      taskDates: tasks.map((e) => ({
        createdAt: e.createdAt,
        completedAt: e.completedAt,
      })),
    };
  });

  // Per-area: how many projects contribute to it (supports the "life portfolio" view).
  const projectCountByArea = new Map<string, number>();
  for (const p of projectsWithProgress) {
    for (const areaId of p.areaIds) {
      projectCountByArea.set(areaId, (projectCountByArea.get(areaId) ?? 0) + 1);
    }
  }
  const areasWithMeta = areas.map((a) => ({
    ...a,
    projectCount: projectCountByArea.get(a.id) ?? 0,
  }));

  // Bird's-eye portfolio summary (shared math with the client recompute).
  const summary = computePortfolioSummary(areasWithMeta, projectsWithProgress);

  return { areas: areasWithMeta, projects: projectsWithProgress, summary };
}

export type PortfolioSummary = Awaited<
  ReturnType<typeof getLifeMap>
>["summary"];

export type LifeMapData = Awaited<ReturnType<typeof getLifeMap>>;
export type LifeMapArea = LifeMapData["areas"][number];
export type LifeMapProject = LifeMapData["projects"][number];
export type LifeMapInitiative = LifeMapProject["initiatives"][number];

/**
 * One project's journey — or null if it isn't the signed-in user's. Someone
 * else's project id is indistinguishable from a deleted one, so the page shows
 * its normal "not found" rather than confirming the project exists.
 */
export async function getProject(id: string) {
  const user = await requireUser();

  const project = await prisma.project.findFirst({
    where: { id, userId: user.id },
    omit: { userId: true },
    include: {
      values: {
        select: { id: true, name: true, area: { select: { name: true } } },
      },
      initiatives: {
        orderBy: { startDay: "asc" },
        include: { tasks: { orderBy: { order: "asc" } } },
      },
      // Chronological order (oldest first) — reads as the project's journey.
      reflections: { orderBy: { createdAt: "asc" } },
    },
  });
  if (!project) return null;

  const initiatives = project.initiatives.map((i) => {
    const done = i.tasks.filter((e) => e.isComplete).length;
    return { ...i, progress: pct(done, i.tasks.length) };
  });

  const allTasks = project.initiatives.flatMap((i) => i.tasks);
  const progress = pct(
    allTasks.filter((e) => e.isComplete).length,
    allTasks.length,
  );

  return { ...project, initiatives, progress };
}

export type ProjectDetail = NonNullable<Awaited<ReturnType<typeof getProject>>>;
