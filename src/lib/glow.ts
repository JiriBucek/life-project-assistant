// The satisfaction layer: how brightly a life area or value shines right now.
//
// Glow only ever adds. The map's normal look is the baseline for a resting
// card; a higher satisfaction rating and recent movement add light. Nothing
// is ever dimmed or greyed out — this tool doesn't scold.

export const GLOW_WINDOW_DAYS = 30;
// Enough recent completions to be "fully lit" — small on purpose, so modest,
// steady movement reaches full shine without grinding.
const AREA_FULL_TASKS = 5;
const VALUE_FULL_TASKS = 3;
const DAY_MS = 86_400_000;

type ProjectLike = {
  areaIds: string[];
  valueIds: string[];
  taskDates: { completedAt: Date | string | null }[];
};
type AreaLike = { id: string; satisfaction: number };

const recentDone = (p: ProjectLike, now: number) =>
  p.taskDates.filter(
    (t) =>
      t.completedAt !== null &&
      now - new Date(t.completedAt).getTime() <= GLOW_WINDOW_DAYS * DAY_MS,
  ).length;

/**
 * Per-area and per-value glow, both 0–1.
 *
 * An area shines from whichever is stronger: how it's rated today, or the
 * tasks completed in its connected projects over the last month — so a 10/10
 * area reaches full brightness on the rating alone, matching the shine of a
 * completed project. A value shines purely from movement in the projects
 * serving it — values light up when acted on.
 */
export function computeGlow(
  areas: AreaLike[],
  projects: ProjectLike[],
  now: number = Date.now(),
) {
  const done = projects.map((p) => recentDone(p, now));

  const areaGlow = new Map<string, number>();
  for (const a of areas) {
    const moved = projects.reduce(
      (sum, p, i) => sum + (p.areaIds.includes(a.id) ? done[i] : 0),
      0,
    );
    areaGlow.set(
      a.id,
      Math.max(a.satisfaction / 10, Math.min(1, moved / AREA_FULL_TASKS)),
    );
  }

  const valueGlow = new Map<string, number>();
  for (const [i, p] of projects.entries()) {
    for (const valueId of p.valueIds) {
      valueGlow.set(
        valueId,
        Math.min(1, (valueGlow.get(valueId) ?? 0) + done[i] / VALUE_FULL_TASKS),
      );
    }
  }

  return { areaGlow, valueGlow };
}
