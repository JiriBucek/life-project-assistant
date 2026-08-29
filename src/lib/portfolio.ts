// Pure portfolio-summary math, shared by the server loader (lib/data.ts) and
// the client's optimistic recompute (components/lifemap/LifeMap.tsx) so the
// "Your life, at a glance" panel always agrees with itself.

export const STALE_AFTER_DAYS = 14;
export const CLOSING_WITHIN_DAYS = 30;
const DAY_MS = 86_400_000;

type AreaLike = { id: string; name: string; satisfaction: number };
type ProjectLike = {
  id: string;
  name: string;
  progress: { total: number; done: number };
  initiatives: { progress: { total: number } }[];
  targetDate: Date;
  lastActivityAt: Date;
};

/**
 * The one definition of a finished journey, shared by every surface (harvest,
 * map badge, roadmap, this summary): every planned phase is fulfilled — each
 * initiative holds at least one task, and every task everywhere is done.
 * All-tasks-done alone is not enough: a phase still waiting to be broken into
 * tasks means the journey is still underway.
 */
export const isProjectComplete = (p: {
  progress: { total: number; done: number };
  initiatives: { progress: { total: number } }[];
}) =>
  p.progress.total > 0 &&
  p.progress.done === p.progress.total &&
  p.initiatives.every((i) => i.progress.total > 0);

const isComplete = isProjectComplete;

export function computePortfolioSummary(
  areas: AreaLike[],
  projects: ProjectLike[],
) {
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
          .map((a) => ({
            id: a.id,
            name: a.name,
            satisfaction: a.satisfaction,
          }));

  const now = Date.now();

  // Quiet projects — untouched anywhere in their tree for STALE_AFTER_DAYS.
  // Fully complete projects rest by design and aren't nagged about.
  const staleProjects = projects
    .filter((p) => !isComplete(p))
    .filter(
      (p) =>
        now - new Date(p.lastActivityAt).getTime() > STALE_AFTER_DAYS * DAY_MS,
    )
    .map((p) => ({ id: p.id, name: p.name }));

  // Projects whose Target Completion Date is coming up and aren't done yet.
  const closingProjects = projects
    .filter((p) => {
      if (isComplete(p)) return false;
      const untilTarget = new Date(p.targetDate).getTime() - now;
      return untilTarget >= 0 && untilTarget <= CLOSING_WITHIN_DAYS * DAY_MS;
    })
    .map((p) => ({ id: p.id, name: p.name }));

  return {
    areaCount: areas.length,
    projectCount: projects.length,
    avgSatisfaction,
    needsAttention,
    staleProjects,
    closingProjects,
  };
}
