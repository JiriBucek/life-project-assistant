import { AppHeader } from "@/components/AppHeader";
import { LifeMap } from "@/components/lifemap/LifeMap";
import { getLifeMap } from "@/lib/data";

export const dynamic = "force-dynamic";

// The map is the home screen and gets every pixel below the header. On phones
// the bottom padding clears the fixed tab bar (plus the device's safe area).
export default async function HomePage() {
  const { areas, projects, summary } = await getLifeMap();

  return (
    <div className="flex h-dvh flex-col pb-[calc(3.5rem+env(safe-area-inset-bottom))] md:pb-0">
      <AppHeader />
      <LifeMap areas={areas} projects={projects} summary={summary} />
    </div>
  );
}
