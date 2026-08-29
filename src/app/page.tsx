import { AppHeader } from "@/components/AppHeader";
import { CosmosMode } from "@/components/lifemap/CosmosMode";
import { LifeMap } from "@/components/lifemap/LifeMap";
import { getLifeMap } from "@/lib/data";

export const dynamic = "force-dynamic";

// The map is the home screen and gets every pixel below the header. On phones
// the bottom padding clears the fixed tab bar (plus the device's safe area).
// `?focus=<areaId>` (used by the Statistics page's "Worth noticing" links)
// opens the map centered on that life area.
export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ focus?: string }>;
}) {
  const [{ areas, projects }, { focus }] = await Promise.all([
    getLifeMap(),
    searchParams,
  ]);

  return (
    <CosmosMode>
      <AppHeader />
      <LifeMap areas={areas} projects={projects} focusAreaId={focus} />
    </CosmosMode>
  );
}
