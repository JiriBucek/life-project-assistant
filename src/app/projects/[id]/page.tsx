import Link from "next/link";
import { notFound } from "next/navigation";
import { AppHeader } from "@/components/AppHeader";
import { ProjectJourney } from "@/components/journey/ProjectJourney";
import { getProject } from "@/lib/data";

export const dynamic = "force-dynamic";

export default async function ProjectPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const project = await getProject(id);
  if (!project) notFound();

  // Where you came from (?from=map|projects) decides where "back" leads; a
  // shared link without the marker lands on the Projects side.
  const back =
    query.from === "map"
      ? { href: "/", label: "Back to life map" }
      : { href: "/projects", label: "Back to projects" };

  return (
    <div className="flex min-h-dvh flex-col pb-[calc(3.5rem+env(safe-area-inset-bottom))] md:pb-0">
      <AppHeader />
      <div className="mx-auto w-full max-w-[1200px] px-4 pt-5 md:px-6">
        <Link
          href={back.href}
          className="text-sm font-medium text-ink-soft transition hover:text-ink"
        >
          ← {back.label}
        </Link>
      </div>
      <ProjectJourney
        project={project}
        backHref={back.href}
        backLabel={back.label}
      />
    </div>
  );
}
