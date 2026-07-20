import { prisma } from "@/lib/prisma";
import { computePortfolioSummary } from "@/lib/portfolio";

export type ProgressStat = { total: number; done: number; pct: number };

function pct(done: number, total: number): ProgressStat {
  return { total, done, pct: total === 0 ? 0 : Math.round((done / total) * 100) };
}

export async function getLifeMap() {
  const [areas, projects] = await Promise.all([
    prisma.lifeArea.findMany({
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
      orderBy: { createdAt: "asc" },
      include: {
        values: { select: { id: true, name: true, areaId: true } },
        initiatives: {
          include: { epics: { select: { isComplete: true, updatedAt: true } } },
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
    const epics = p.initiatives.flatMap((i) => i.epics);
    const done = epics.filter((e) => e.isComplete).length;
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
        ...epics.map((e) => e.updatedAt.getTime()),
        ...p.reflections.map((r) => r.createdAt.getTime()),
      ),
    );
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
      progress: pct(done, epics.length),
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

export async function getProject(id: string) {
  const project = await prisma.project.findUnique({
    where: { id },
    include: {
      values: {
        select: { id: true, name: true, area: { select: { name: true } } },
      },
      initiatives: {
        orderBy: { startDay: "asc" },
        include: { epics: { orderBy: { order: "asc" } } },
      },
      // Chronological order (oldest first) — reads as the project's journey.
      reflections: { orderBy: { createdAt: "asc" } },
    },
  });
  if (!project) return null;

  const initiatives = project.initiatives.map((i) => {
    const done = i.epics.filter((e) => e.isComplete).length;
    return { ...i, progress: pct(done, i.epics.length) };
  });

  const allEpics = project.initiatives.flatMap((i) => i.epics);
  const progress = pct(
    allEpics.filter((e) => e.isComplete).length,
    allEpics.length,
  );

  return { ...project, initiatives, progress };
}

export type ProjectDetail = NonNullable<Awaited<ReturnType<typeof getProject>>>;
