import { AppHeader } from "@/components/AppHeader";
import { StatsDashboard } from "@/components/statistics/StatsDashboard";
import { getLifeMap } from "@/lib/data";

export const dynamic = "force-dynamic";

// The Statistics screen: the life-at-a-glance numbers and the per-area
// satisfaction/progress story, on their own page. On phones the bottom
// padding clears the fixed tab bar (plus the safe area).
export default async function StatisticsPage() {
  const { areas, projects, summary } = await getLifeMap();

  return (
    <div className="flex min-h-dvh flex-col pb-[calc(3.5rem+env(safe-area-inset-bottom))] md:pb-0">
      <AppHeader />
      <StatsDashboard areas={areas} projects={projects} summary={summary} />
    </div>
  );
}
