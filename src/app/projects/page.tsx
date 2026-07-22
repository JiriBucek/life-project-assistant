import { AppHeader } from "@/components/AppHeader";
import { ProjectsTimeline } from "@/components/projects/ProjectsTimeline";
import { getLifeMap } from "@/lib/data";

export const dynamic = "force-dynamic";

// The Projects screen: every journey on one shared timeline, full page. On
// phones the bottom padding clears the fixed tab bar (plus the safe area).
export default async function ProjectsPage() {
  const { projects } = await getLifeMap();

  return (
    <div className="flex min-h-dvh flex-col pb-[calc(3.5rem+env(safe-area-inset-bottom))] md:pb-0">
      <AppHeader />
      <ProjectsTimeline projects={projects} />
    </div>
  );
}
