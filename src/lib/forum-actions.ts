"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { ifOwned } from "@/lib/scope";
import { canWrite, isAdmin } from "@/lib/forum";

// Gentle guardrails, not walls — a post is a note, not an essay.
const MAX_BODY = 2000;
const MAX_NAME = 40;

/** The signature the author chose; empty (or whitespace) reads as Anonymous. */
function cleanName(name?: string | null): string | null {
  const trimmed = (name ?? "").trim().slice(0, MAX_NAME);
  return trimmed.length > 0 ? trimmed : null;
}

export async function createForumPost(input: {
  kind: "experience" | "idea";
  body: string;
  displayName?: string;
}) {
  const user = await requireUser();
  if (!canWrite(user)) return;
  const body = input.body.trim().slice(0, MAX_BODY);
  if (!body) return;
  await prisma.forumPost.create({
    data: {
      kind: input.kind === "idea" ? "idea" : "experience",
      body,
      displayName: cleanName(input.displayName),
      userId: user.id,
    },
  });
  revalidatePath("/community");
}

/** +1 likes, -1 dislikes, 0 takes the vote back. Ideas only, one per person. */
export async function voteOnIdea(postId: string, value: 1 | -1 | 0) {
  const user = await requireUser();
  if (!canWrite(user)) return;
  const post = await prisma.forumPost.findUnique({
    where: { id: postId },
    select: { kind: true },
  });
  if (post?.kind !== "idea") return;
  if (value === 0) {
    await prisma.forumVote.deleteMany({ where: { postId, userId: user.id } });
  } else {
    await prisma.forumVote.upsert({
      where: { postId_userId: { postId, userId: user.id } },
      create: { postId, userId: user.id, value },
      update: { value },
    });
  }
  revalidatePath("/community");
}

export async function replyToForumPost(
  postId: string,
  body: string,
  displayName?: string,
) {
  const user = await requireUser();
  if (!canWrite(user)) return;
  const trimmed = body.trim().slice(0, MAX_BODY);
  if (!trimmed) return;
  const admin = isAdmin(user);
  // A vanished post is a no-op, not an error.
  const post = await prisma.forumPost.findUnique({
    where: { id: postId },
    select: { id: true },
  });
  if (!post) return;
  await prisma.forumReply.create({
    data: {
      postId,
      body: trimmed,
      userId: user.id,
      isLuma: admin,
      // LUMA signs as LUMA — a chosen name would only be confusing there.
      displayName: admin ? null : cleanName(displayName),
    },
  });
  revalidatePath("/community");
}

/** LUMA's stamp on an idea — "planned", "implemented", or taken back. */
export async function setIdeaStatus(
  postId: string,
  status: "planned" | "implemented" | null,
) {
  const user = await requireUser();
  if (!isAdmin(user)) return;
  await ifOwned(
    prisma.forumPost.update({ where: { id: postId, kind: "idea" }, data: { status } }),
  );
  revalidatePath("/community");
}

export async function deleteForumPost(postId: string) {
  const user = await requireUser();
  if (!isAdmin(user)) return;
  await ifOwned(prisma.forumPost.delete({ where: { id: postId } }));
  revalidatePath("/community");
}

export async function deleteForumReply(replyId: string) {
  const user = await requireUser();
  if (!isAdmin(user)) return;
  await ifOwned(prisma.forumReply.delete({ where: { id: replyId } }));
  revalidatePath("/community");
}
