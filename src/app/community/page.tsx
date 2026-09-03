import { AppHeader } from "@/components/AppHeader";
import { ForumBoard } from "@/components/forum/ForumBoard";
import { getForum } from "@/lib/forum-data";

export const dynamic = "force-dynamic";

// The Forum: members only (getForum redirects the signed-out to /login).
// Bottom padding clears the phone tab bar, as on every page.
export default async function ForumPage() {
  const forum = await getForum();

  return (
    <div className="flex min-h-dvh flex-col pb-[calc(3.5rem+env(safe-area-inset-bottom))] md:pb-0">
      <AppHeader />
      <ForumBoard {...forum} />
    </div>
  );
}
