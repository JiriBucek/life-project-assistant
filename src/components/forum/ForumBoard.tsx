"use client";

/**
 * The Forum — the community's room. Two columns: experiences (what people
 * liked and missed, readable by all) and ideas for LUMA (votable, best first).
 * Posts appear anonymous unless their author chose to sign them; the admin's
 * replies render as LUMA, the sun-headed figure, never as a personal account.
 */

import { useOptimistic, useState, useTransition } from "react";
import * as actions from "@/lib/forum-actions";
import { Button } from "@/components/ui";
import { EllieAvatar } from "@/components/EllieAvatar";
import type { ForumData, ForumPostView, ForumReplyView } from "@/lib/forum-data";

const fmtDate = (d: Date | string) =>
  new Date(d).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });

export function ForumBoard({ experiences, ideas, me }: ForumData) {
  const [composer, setComposer] = useState<null | "experience" | "idea">(null);

  return (
    <main className="mx-auto w-full max-w-[1200px] flex-1 px-4 py-8 md:px-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-4">
          <EllieAvatar className="mt-1 hidden h-14 w-14 shrink-0 sm:block" />
          <div>
            <h1 className="font-serif text-2xl font-medium text-ink">
              Community Forum
            </h1>
            <p className="mt-1 max-w-xl text-sm text-ink-soft">
              Come in, make yourself at home! ✦ This is where we all meet —
              swap stories, wish out loud, cheer each other on. Everything on
              the table is yours: say what you loved, what you missed, and
              what LUMA should learn next. Sign your words or stay a friendly
              mystery — both are welcome here.
            </p>
          </div>
        </div>
        {me.canWrite && (
          <Button onClick={() => setComposer("experience")}>Feedback</Button>
        )}
      </div>

      {!me.canWrite && (
        <p className="mt-3 rounded-xl border border-line bg-paper-raised px-4 py-2.5 text-sm text-ink-soft">
          The shared demo account can listen in, but joining the conversation
          belongs to members.
        </p>
      )}

      <div className="mt-7 grid grid-cols-1 gap-8 md:grid-cols-2">
        {/* Left — experiences: readable by everyone, no voting */}
        <section>
          <h2 className="font-serif text-xl font-medium text-ink">
            Experiences
          </h2>
          <p className="mb-4 mt-0.5 text-xs text-ink-faint">
            Stories from the road — what felt wonderful, what felt missing.
            Every word helps LUMA grow.
          </p>
          {experiences.length === 0 ? (
            <EmptyColumn text="The room is quiet — be the first voice in it. How has LUMA felt to you?" />
          ) : (
            <div className="space-y-4">
              {experiences.map((p) => (
                <PostCard key={p.id} post={p} me={me} votable={false} />
              ))}
            </div>
          )}
        </section>

        {/* Right — ideas: the community votes, the best rise */}
        <section>
          <h2 className="font-serif text-xl font-medium text-ink">
            Ideas for LUMA
          </h2>
          <p className="mb-4 mt-0.5 text-xs text-ink-faint">
            Wish out loud! Vote ▲ for what should come true next — the
            community’s favorites rise to the top.
          </p>
          {ideas.length === 0 ? (
            <EmptyColumn text="No wishes yet — make the first one. Someone out there will vote for it." />
          ) : (
            <div className="space-y-4">
              {ideas.map((p) => (
                <PostCard key={p.id} post={p} me={me} votable />
              ))}
            </div>
          )}
        </section>
      </div>

      {composer && (
        <Composer initialKind={composer} onClose={() => setComposer(null)} />
      )}
    </main>
  );
}

function EmptyColumn({ text }: { text: string }) {
  return (
    <div className="rounded-xl border border-dashed border-line-strong bg-paper-raised p-8 text-center text-sm text-ink-soft">
      {text}
    </div>
  );
}

// ---------------------------------------------------------------------------
// One post — body, signature, votes (ideas), replies, and LUMA's presence
// ---------------------------------------------------------------------------

function PostCard({
  post,
  me,
  votable,
}: {
  post: ForumPostView;
  me: ForumData["me"];
  votable: boolean;
}) {
  const [, startTransition] = useTransition();
  const run = (fn: () => Promise<unknown>) =>
    startTransition(async () => void (await fn().catch(console.error)));
  const [replyOpen, setReplyOpen] = useState(false);

  return (
    <article className="rounded-xl border border-line bg-paper-raised p-4">
      {post.status && (
        <div className="mb-2">
          {post.status === "implemented" ? (
            <span className="rounded-full border border-gold/40 bg-gold-tint/60 px-2.5 py-0.5 text-xs font-medium text-ink">
              ✦ Implemented
            </span>
          ) : (
            <span className="rounded-full bg-sky-tint px-2.5 py-0.5 text-xs font-medium text-sky-deep">
              Planned
            </span>
          )}
        </div>
      )}

      <p className="whitespace-pre-wrap text-sm leading-relaxed text-ink">
        {post.body}
      </p>
      <p className="mt-2 text-xs text-ink-faint">
        — {post.displayName ?? "Anonymous"} · {fmtDate(post.createdAt)}
        {me.isAdmin && post.authorEmail && (
          <span className="text-ink-faint/70"> · {post.authorEmail}</span>
        )}
      </p>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {votable && <IdeaVotes post={post} canVote={me.canWrite} />}
        {me.canWrite && (
          <button
            onClick={() => setReplyOpen((o) => !o)}
            className="rounded-full px-2.5 py-1 text-xs font-medium text-ink-soft transition hover:bg-line/60 hover:text-ink"
          >
            Reply
          </button>
        )}
        {me.isAdmin && votable && (
          <span className="flex items-center gap-1.5 text-xs">
            <AdminAction
              label={post.status === "planned" ? "Unmark planned" : "Mark planned"}
              onClick={() =>
                run(() =>
                  actions.setIdeaStatus(
                    post.id,
                    post.status === "planned" ? null : "planned",
                  ),
                )
              }
            />
            <AdminAction
              label={
                post.status === "implemented"
                  ? "Unmark implemented"
                  : "Mark implemented ✦"
              }
              onClick={() =>
                run(() =>
                  actions.setIdeaStatus(
                    post.id,
                    post.status === "implemented" ? null : "implemented",
                  ),
                )
              }
            />
          </span>
        )}
        {me.isAdmin && (
          <AdminAction
            label="Delete"
            danger
            onClick={() => run(() => actions.deleteForumPost(post.id))}
          />
        )}
      </div>

      {post.replies.length > 0 && (
        <div className="mt-3 space-y-2.5 border-t border-line pt-3">
          {post.replies.map((r) => (
            <Reply key={r.id} reply={r} me={me} />
          ))}
        </div>
      )}

      {replyOpen && (
        <ReplyForm
          postId={post.id}
          isLuma={me.isAdmin}
          onDone={() => setReplyOpen(false)}
        />
      )}
    </article>
  );
}

function AdminAction({
  label,
  onClick,
  danger = false,
}: {
  label: string;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full px-2.5 py-1 text-xs font-medium transition ${
        danger
          ? "text-ink-faint hover:text-[#b15a4a]"
          : "text-ink-soft hover:bg-line/60 hover:text-ink"
      }`}
    >
      {label}
    </button>
  );
}

/** Like / dislike, one vote per member, instant on screen. */
function IdeaVotes({
  post,
  canVote,
}: {
  post: ForumPostView;
  canVote: boolean;
}) {
  const [, startTransition] = useTransition();
  const [view, setView] = useOptimistic({
    myVote: post.myVote,
    likes: post.likes,
    dislikes: post.dislikes,
  });

  const cast = (v: 1 | -1) => {
    const next = view.myVote === v ? 0 : v;
    startTransition(async () => {
      setView({
        myVote: next,
        likes: post.likes - (post.myVote === 1 ? 1 : 0) + (next === 1 ? 1 : 0),
        dislikes:
          post.dislikes - (post.myVote === -1 ? 1 : 0) + (next === -1 ? 1 : 0),
      });
      await actions.voteOnIdea(post.id, next).catch(console.error);
    });
  };

  return (
    <span className="flex items-center gap-1.5">
      <button
        onClick={() => cast(1)}
        disabled={!canVote}
        aria-pressed={view.myVote === 1}
        aria-label="Like this idea"
        className={`flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium transition disabled:opacity-50 ${
          view.myVote === 1
            ? "border-sage bg-sage-tint text-sage-deep"
            : "border-line-strong text-ink-soft hover:border-sage hover:text-ink"
        }`}
      >
        ▲ {view.likes}
      </button>
      <button
        onClick={() => cast(-1)}
        disabled={!canVote}
        aria-pressed={view.myVote === -1}
        aria-label="Dislike this idea"
        className={`flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium transition disabled:opacity-50 ${
          view.myVote === -1
            ? "border-clay bg-clay-tint/60 text-ink"
            : "border-line-strong text-ink-soft hover:border-clay hover:text-ink"
        }`}
      >
        ▼ {view.dislikes}
      </button>
    </span>
  );
}

function Reply({ reply, me }: { reply: ForumReplyView; me: ForumData["me"] }) {
  const [, startTransition] = useTransition();
  return (
    <div className="group/reply flex items-start gap-2.5">
      {reply.isLuma ? (
        <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center">
          <EllieAvatar className="h-7 w-7" />
        </span>
      ) : (
        <span
          aria-hidden
          className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-line-strong"
        />
      )}
      <div className="min-w-0 flex-1">
        <p className="text-xs">
          <span
            className={
              reply.isLuma
                ? "font-semibold text-sage-deep"
                : "font-medium text-ink-soft"
            }
          >
            {reply.isLuma ? "LUMA" : (reply.displayName ?? "Anonymous")}
          </span>{" "}
          <span className="text-ink-faint">· {fmtDate(reply.createdAt)}</span>
          {me.isAdmin && !reply.isLuma && reply.authorEmail && (
            <span className="text-ink-faint/70"> · {reply.authorEmail}</span>
          )}
        </p>
        <p className="mt-0.5 whitespace-pre-wrap text-sm leading-relaxed text-ink">
          {reply.body}
        </p>
      </div>
      {me.isAdmin && (
        <button
          onClick={() =>
            startTransition(
              async () =>
                void (await actions.deleteForumReply(reply.id).catch(console.error)),
            )
          }
          aria-label="Delete reply"
          className="text-ink-faint opacity-0 transition hover:text-[#b15a4a] group-hover/reply:opacity-100"
        >
          ✕
        </button>
      )}
    </div>
  );
}

function ReplyForm({
  postId,
  isLuma,
  onDone,
}: {
  postId: string;
  isLuma: boolean;
  onDone: () => void;
}) {
  const [, startTransition] = useTransition();
  const [body, setBody] = useState("");
  const [name, setName] = useState("");

  const send = () => {
    if (!body.trim()) return;
    const text = body;
    const signature = name;
    setBody("");
    onDone();
    startTransition(
      async () =>
        void (await actions
          .replyToForumPost(postId, text, signature)
          .catch(console.error)),
    );
  };

  return (
    <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-line pt-3">
      <input
        autoFocus
        value={body}
        onChange={(e) => setBody(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") send();
          if (e.key === "Escape") onDone();
        }}
        placeholder={isLuma ? "Reply as LUMA…" : "Write a reply…"}
        className="min-w-0 flex-1 rounded-lg border border-line-strong bg-paper px-3 py-1.5 text-sm text-ink placeholder:text-ink-faint focus:border-sage focus:outline-none"
      />
      {!isLuma && (
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Sign as (optional)"
          className="w-36 rounded-lg border border-line-strong bg-paper px-3 py-1.5 text-sm text-ink placeholder:text-ink-faint focus:border-sage focus:outline-none"
        />
      )}
      <Button variant="soft" disabled={!body.trim()} onClick={send}>
        Send
      </Button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// The composer — the "Feedback" door
// ---------------------------------------------------------------------------

function Composer({
  initialKind,
  onClose,
}: {
  initialKind: "experience" | "idea";
  onClose: () => void;
}) {
  const [, startTransition] = useTransition();
  const [kind, setKind] = useState<"experience" | "idea">(initialKind);
  const [body, setBody] = useState("");
  const [name, setName] = useState("");

  const post = () => {
    if (!body.trim()) return;
    const input = { kind, body, displayName: name };
    onClose();
    startTransition(
      async () =>
        void (await actions.createForumPost(input).catch(console.error)),
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-[var(--scrim)] backdrop-blur-[3px]"
        onClick={onClose}
      />
      <div className="ellie-rise relative w-full max-w-lg rounded-2xl border border-line bg-paper-raised p-6 shadow-xl">
        <h2 className="font-serif text-xl font-medium text-ink">
          So glad you have something to say ✦
        </h2>

        <div className="mt-3 flex gap-1.5">
          {(
            [
              ["experience", "My experience"],
              ["idea", "An idea for LUMA"],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              onClick={() => setKind(value)}
              aria-pressed={kind === value}
              className={`rounded-full border px-3.5 py-1.5 text-sm font-medium transition ${
                kind === value
                  ? "border-sage bg-sage-tint text-sage-deep"
                  : "border-line-strong text-ink-soft hover:text-ink"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <textarea
          autoFocus
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={5}
          placeholder={
            kind === "experience"
              ? "Tell us how it felt — the parts you loved, the parts you missed…"
              : "Wish out loud — what should LUMA learn to do?"
          }
          className="mt-3 w-full resize-y rounded-xl border border-line-strong bg-paper px-3.5 py-2.5 text-sm text-ink placeholder:text-ink-faint focus:border-sage focus:outline-none"
        />

        <label className="mt-2 block">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-ink-faint">
            Sign as (optional)
          </span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Anonymous"
            className="mt-0.5 w-56 rounded-lg border border-line-strong bg-paper px-3 py-1.5 text-sm text-ink placeholder:text-ink-faint focus:border-sage focus:outline-none"
          />
        </label>

        <p className="mt-3 text-xs text-ink-faint">
          Post as yourself or as a friendly mystery — your account stays
          hidden either way; only the LUMA team can see who’s behind the
          words.
        </p>

        <div className="mt-4 flex justify-end gap-2">
          <Button variant="soft" onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={!body.trim()} onClick={post}>
            Post {kind === "idea" ? "idea" : "experience"}
          </Button>
        </div>
      </div>
    </div>
  );
}
