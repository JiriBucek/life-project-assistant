import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { canWrite, isAdmin } from "@/lib/forum";

/**
 * The forum, as one signed-in member sees it. Author identities are loaded
 * here (the admin needs them, and "my vote" needs to be found) but they are
 * stripped from the view before it leaves the server — a regular member's
 * browser never receives who wrote or voted for anything.
 */
export async function getForum() {
  const user = await requireUser();
  const admin = isAdmin(user);

  const posts = await prisma.forumPost.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      votes: { select: { userId: true, value: true } },
      replies: {
        orderBy: { createdAt: "asc" },
        include: { author: { select: { email: true } } },
      },
      author: { select: { email: true } },
    },
  });

  const view = posts.map((p) => {
    const likes = p.votes.filter((v) => v.value > 0).length;
    const dislikes = p.votes.length - likes;
    return {
      id: p.id,
      kind: p.kind as "experience" | "idea",
      body: p.body,
      displayName: p.displayName,
      status: p.status as "planned" | "implemented" | null,
      createdAt: p.createdAt,
      likes,
      dislikes,
      score: likes - dislikes,
      myVote: p.votes.find((v) => v.userId === user.id)?.value ?? 0,
      // Only the admin's browser ever receives an author identity.
      authorEmail: admin ? (p.author?.email ?? null) : null,
      replies: p.replies.map((r) => ({
        id: r.id,
        body: r.body,
        displayName: r.displayName,
        isLuma: r.isLuma,
        createdAt: r.createdAt,
        authorEmail: admin ? (r.author?.email ?? null) : null,
      })),
    };
  });

  return {
    experiences: view.filter((p) => p.kind === "experience"),
    // The community's priorities: best-scored ideas first, newest breaking ties.
    ideas: view
      .filter((p) => p.kind === "idea")
      .sort(
        (a, b) =>
          b.score - a.score || b.createdAt.getTime() - a.createdAt.getTime(),
      ),
    me: { isAdmin: admin, canWrite: canWrite(user) },
  };
}

export type ForumData = Awaited<ReturnType<typeof getForum>>;
export type ForumPostView = ForumData["ideas"][number];
export type ForumReplyView = ForumPostView["replies"][number];
