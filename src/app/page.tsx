import { AppHeader } from "@/components/AppHeader";
import { LifeMap } from "@/components/lifemap/LifeMap";
import { getLifeMap } from "@/lib/data";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const { areas, projects, summary } = await getLifeMap();

  return (
    <div className="flex h-screen flex-col">
      <AppHeader />
      <LifeMap areas={areas} projects={projects} summary={summary} />
    </div>
  );
}
