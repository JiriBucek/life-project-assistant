import { notFound } from "next/navigation";
import { AppHeader } from "@/components/AppHeader";
import { ProjectJourney } from "@/components/journey/ProjectJourney";
import { getProject } from "@/lib/data";

export const dynamic = "force-dynamic";

export default async function ProjectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const project = await getProject(id);
  if (!project) notFound();

  return (
    <div className="flex min-h-screen flex-col">
      <AppHeader crumb={[{ label: "Life map", href: "/" }, { label: project.name }]} />
      <ProjectJourney project={project} />
    </div>
  );
}
