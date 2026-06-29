import { prisma } from "@/lib/prisma";

export type ProgressStat = { total: number; done: number; pct: number };

function pct(done: number, total: number): ProgressStat {
  return { total, done, pct: total === 0 ? 0 : Math.round((done / total) * 100) };
}

export async function getLifeMap() {
  const [areas, projects] = await Promise.all([
    prisma.lifeArea.findMany({
      orderBy: { order: "asc" },
      include: { values: { orderBy: { createdAt: "asc" } } },
    }),
    prisma.project.findMany({
      orderBy: { createdAt: "asc" },
      include: {
        values: { select: { id: true, name: true, areaId: true } },
        initiatives: { include: { epics: { select: { isComplete: true } } } },
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
    return {
      id: p.id,
      name: p.name,
      whyStatement: p.whyStatement,
      x: p.x,
      y: p.y,
      valueIds: p.values.map((v) => v.id),
      values: p.values,
      areaIds,
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

  // Bird's-eye portfolio summary.
  const avgSatisfaction =
    areas.length === 0
      ? 0
      : Math.round(
          (areas.reduce((s, a) => s + a.satisfaction, 0) / areas.length) * 10,
        ) / 10;
  // Every area tied at the lowest satisfaction — so when several areas are
  // equally low, all of them surface, not just an arbitrary one.
  const minSatisfaction =
    areas.length === 0 ? null : Math.min(...areas.map((a) => a.satisfaction));
  const needsAttention =
    minSatisfaction === null
      ? []
      : areas
          .filter((a) => a.satisfaction === minSatisfaction)
          .map((a) => ({ name: a.name, satisfaction: a.satisfaction }));

  const summary = {
    areaCount: areas.length,
    projectCount: projectsWithProgress.length,
    avgSatisfaction,
    needsAttention,
  };

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
