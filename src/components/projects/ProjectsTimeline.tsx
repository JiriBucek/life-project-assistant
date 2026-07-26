"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { LifeMapInitiative, LifeMapProject } from "@/lib/data";
import * as actions from "@/lib/actions";
import { CLOSING_WITHIN_DAYS } from "@/lib/portfolio";
import {
  addDays,
  dayDiff,
  formatDay,
  toDateInputValue,
  toUTCDay,
} from "@/lib/timeline";
import { useTodayUTC } from "@/lib/useTodayUTC";

// Desktop geometry: month labels on top, then one row per project. A row per
// project (instead of packed lanes) means nothing ever overlaps, no matter how
// many journeys run at once — the page simply grows downward and scrolls.
// An expanded project adds one thin sub-row per initiative beneath its bar.
const MONTHS_H = 30;
const ROW_H = 44;
const ROW_GAP = 10;
const SUB_H = 24; // an initiative's sub-row
const SUB_GAP = 6; // between sub-rows
const SUB_TOP = 6; // between a project bar and its first initiative
const NAME_COL = "15rem";

/**
 * The Projects page: every project as a bar on one shared time axis, names in
 * a column on the left. Desktop keeps the full picture plus drag-to-reschedule;
 * phones get calm tappable cards with the same information (rescheduling lives
 * inside the project there, where dates are edited precisely).
 *
 * Each project can be expanded one level — down to its initiatives — so "what
 * am I actually working on right now?" is answerable without opening a journey.
 * Expansion is per project and starts closed, keeping the default view calm.
 */
export function ProjectsTimeline({ projects }: { projects: LifeMapProject[] }) {
  const router = useRouter();
  const today = useTodayUTC();
  const trackRef = useRef<HTMLDivElement>(null);

  // A live drag offsets one bar by whole days; after release the offset is
  // kept until the server round-trip delivers the new start date, so the bar
  // never snaps back.
  const [shift, setShift] = useState<{
    id: string;
    days: number;
    until: string | null; // expected yyyy-mm-dd start; null while dragging
  } | null>(null);
  const dragRef = useRef<{
    id: string;
    startX: number;
    pxPerDay: number;
    moved: boolean;
  } | null>(null);

  // Which projects are showing their initiatives. Collapsed by default, and each
  // project opens and closes on its own.
  const [open, setOpen] = useState<ReadonlySet<string>>(new Set());
  function toggleOpen(id: string) {
    setOpen((cur) => {
      const next = new Set(cur);
      if (!next.delete(id)) next.add(id);
      return next;
    });
  }

  const done =
    shift?.until != null &&
    projects.some(
      (p) => p.id === shift.id && toDateInputValue(p.startDate) === shift.until,
    );
  if (done) setShift(null); // render-phase clear once the server caught up

  if (projects.length === 0) return <EmptyProjects />;

  const sorted = [...projects].sort(
    (a, b) => toUTCDay(a.startDate).getTime() - toUTCDay(b.startDate).getTime(),
  );

  // ---- shared time range (padded, always containing today) ----
  const times = projects.flatMap((p) => [
    toUTCDay(p.startDate).getTime(),
    toUTCDay(p.targetDate).getTime(),
  ]);
  if (today) times.push(today.getTime());
  const rangeStart = addDays(new Date(Math.min(...times)), -7);
  const rangeEnd = addDays(new Date(Math.max(...times)), 10);
  const totalDays = Math.max(1, dayDiff(rangeStart, rangeEnd));
  const pct = (d: Date | string) => (dayDiff(rangeStart, d) / totalDays) * 100;

  // ---- month gridlines (pinned locale; every label carries its year) ----
  const months: { left: number; label: string }[] = [];
  let cursor = new Date(
    Date.UTC(rangeStart.getUTCFullYear(), rangeStart.getUTCMonth() + 1, 1),
  );
  while (cursor.getTime() <= rangeEnd.getTime()) {
    months.push({
      left: pct(cursor),
      label: `${cursor.toLocaleDateString("en-US", {
        month: "short",
        timeZone: "UTC",
      })} ’${String(cursor.getUTCFullYear() % 100).padStart(2, "0")}`,
    });
    cursor = new Date(
      Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth() + 1, 1),
    );
  }

  // ---- this page's own statistics: load and horizon, not life balance ----
  const isComplete = (p: LifeMapProject) =>
    p.progress.total > 0 && p.progress.done === p.progress.total;
  const runningToday = today
    ? projects.filter(
        (p) =>
          toUTCDay(p.startDate).getTime() <= today.getTime() &&
          today.getTime() <= toUTCDay(p.targetDate).getTime(),
      ).length
    : null;
  const finishingSoon = today
    ? projects.filter((p) => {
        if (isComplete(p)) return false;
        const d = dayDiff(today, p.targetDate);
        return d >= 0 && d <= CLOSING_WITHIN_DAYS;
      }).length
    : null;

  // Days a project's whole journey is currently offset by (mid-drag, or while the
  // server catches up) — its initiatives ride along with it.
  const shiftOf = (id: string) => (shift?.id === id ? shift.days : 0);

  // ---- drag handlers (desktop bars) ----
  function onBarPointerDown(e: React.PointerEvent, p: LifeMapProject) {
    const track = trackRef.current;
    if (!track) return;
    (e.target as Element).setPointerCapture(e.pointerId);
    dragRef.current = {
      id: p.id,
      startX: e.clientX,
      pxPerDay: track.clientWidth / totalDays,
      moved: false,
    };
  }

  function onBarPointerMove(e: React.PointerEvent) {
    const d = dragRef.current;
    if (!d) return;
    const dx = e.clientX - d.startX;
    if (Math.abs(dx) > 4) d.moved = true;
    if (d.moved) {
      setShift({ id: d.id, days: Math.round(dx / d.pxPerDay), until: null });
    }
  }

  function onBarPointerUp(p: LifeMapProject) {
    const d = dragRef.current;
    dragRef.current = null;
    if (!d) return;

    if (!d.moved) {
      // A plain click: step into the journey (once the id is real).
      setShift(null);
      if (!p.id.startsWith("tmp-"))
        router.push(`/projects/${p.id}?from=projects`);
      return;
    }

    const days = shift?.id === p.id ? shift.days : 0;
    if (days === 0 || p.id.startsWith("tmp-")) {
      setShift(null);
      return;
    }
    const newStart = addDays(p.startDate, days);
    setShift({ id: p.id, days, until: toDateInputValue(newStart) });
    actions
      .updateProjectDates(p.id, { startDate: toDateInputValue(newStart) })
      .catch(() => setShift(null));
  }

  // ---- vertical layout (rows grow when a project is expanded) ----
  // The name column and the track share these numbers, so a project's bar and
  // its name always sit on exactly the same line.
  const rows: {
    project: LifeMapProject;
    expanded: boolean;
    height: number;
    top: number;
  }[] = [];
  let cursorY = MONTHS_H;
  for (const p of sorted) {
    const expanded = open.has(p.id) && p.initiatives.length > 0;
    const subs = expanded ? p.initiatives.length : 0;
    const height =
      ROW_H + (subs > 0 ? SUB_TOP + subs * SUB_H + (subs - 1) * SUB_GAP : 0);
    rows.push({ project: p, expanded, height, top: cursorY });
    cursorY += height + ROW_GAP;
  }
  // +18px at the bottom reserves room for the "today" tag under its line.
  const trackHeight = cursorY + 18;

  return (
    <div className="mx-auto w-full max-w-[1400px] flex-1 px-4 py-6 md:px-6 md:py-8">
      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-2">
        <h1 className="font-serif text-2xl font-semibold tracking-tight text-ink md:text-3xl">
          Projects
        </h1>
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="rounded-full bg-ink/5 px-3 py-1 text-ink-soft">
            {projects.length} project{projects.length === 1 ? "" : "s"}
          </span>
          {runningToday !== null && (
            <span className="rounded-full bg-periwinkle-tint px-3 py-1 font-medium text-periwinkle-deep">
              {runningToday} running today
            </span>
          )}
          {finishingSoon !== null && finishingSoon > 0 && (
            <span className="rounded-full bg-gold-tint px-3 py-1 text-ink-soft">
              {finishingSoon} finishing soon
            </span>
          )}
        </div>
      </div>

      {/* Desktop: names on the left, one shared time axis on the right */}
      <div className="mt-6 hidden md:block">
        <div className="flex">
          <div
            className="shrink-0 pr-5"
            style={{ width: NAME_COL, paddingTop: MONTHS_H }}
          >
            {rows.map(({ project: p, expanded, height }) => (
              <div
                key={p.id}
                className="flex flex-col"
                style={{ height, marginBottom: ROW_GAP }}
              >
                <div
                  className="flex min-h-0 flex-col justify-center"
                  style={{ height: ROW_H }}
                >
                  <div className="flex items-center gap-1">
                    {p.initiatives.length > 0 ? (
                      <button
                        onClick={() => toggleOpen(p.id)}
                        aria-expanded={expanded}
                        aria-label={`${expanded ? "Hide" : "Show"} the initiatives of ${p.name}`}
                        className="-ml-1 flex h-5 w-5 shrink-0 items-center justify-center rounded text-ink-faint transition hover:bg-line/60 hover:text-ink"
                      >
                        <Chevron open={expanded} />
                      </button>
                    ) : (
                      <span className="-ml-1 h-5 w-5 shrink-0" aria-hidden />
                    )}
                    <Link
                      href={`/projects/${p.id}?from=projects`}
                      className="truncate font-serif text-[15px] font-medium text-ink transition hover:text-sage-deep"
                    >
                      {p.name}
                    </Link>
                  </div>
                  <div className="truncate pl-5 text-xs text-ink-faint">
                    {p.initiatives.length === 0
                      ? `${formatDay(p.startDate)} → ${formatDay(p.targetDate, true)}`
                      : `${doneCount(p)} of ${p.initiatives.length} initiative${
                          p.initiatives.length === 1 ? "" : "s"
                        } complete`}
                  </div>
                </div>

                {expanded && (
                  <ul
                    className="flex flex-col pl-5"
                    style={{ paddingTop: SUB_TOP, gap: SUB_GAP }}
                  >
                    {p.initiatives.map((i) => {
                      const s = statusOf(i, today, shiftOf(p.id));
                      return (
                        <li
                          key={i.id}
                          className="flex items-center gap-1.5"
                          style={{ height: SUB_H }}
                        >
                          <span
                            aria-hidden
                            className={`h-1.5 w-1.5 shrink-0 rounded-full ${s.dot}`}
                          />
                          <span className="truncate text-xs text-ink-soft">
                            {i.title}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            ))}
          </div>

          <div
            ref={trackRef}
            className="relative min-w-0 flex-1"
            style={{ height: trackHeight }}
          >
            {months.map((m) => (
              <div key={`${m.label}-${m.left}`}>
                <span
                  className="absolute -translate-x-1/2 text-[10.5px] uppercase tracking-wider text-ink-faint"
                  style={{ left: `${m.left}%`, top: 0 }}
                >
                  {m.label}
                </span>
                <div
                  className="absolute w-px bg-line"
                  style={{ left: `${m.left}%`, top: 20, bottom: 22 }}
                />
              </div>
            ))}

            {rows.map(({ project: p, expanded, top }) => {
              const shiftDays = shiftOf(p.id);
              const start = addDays(p.startDate, shiftDays);
              const end = addDays(p.targetDate, shiftDays);
              const left = pct(start);
              const width = Math.max(pct(end) - left, 1.5);
              return (
                <div key={p.id}>
                  <div
                    title={`${p.name} · ${formatDay(start)} → ${formatDay(end, true)} · ${p.progress.pct}%`}
                    onPointerDown={(e) => onBarPointerDown(e, p)}
                    onPointerMove={onBarPointerMove}
                    onPointerUp={() => onBarPointerUp(p)}
                    className={`absolute flex cursor-grab touch-none select-none items-center overflow-hidden whitespace-nowrap rounded-full border-[1.5px] border-periwinkle bg-periwinkle-tint px-4 text-[13px] font-semibold text-periwinkle-deep active:cursor-grabbing ${
                      shiftDays !== 0 ? "z-10 shadow-md" : ""
                    }`}
                    style={{
                      left: `${left}%`,
                      width: `${width}%`,
                      top,
                      height: ROW_H,
                    }}
                  >
                    <div
                      aria-hidden
                      className="absolute inset-y-0 left-0 rounded-l-full bg-periwinkle/55"
                      style={{ width: `${p.progress.pct}%` }}
                    />
                    <span className="relative ml-auto text-xs font-medium text-ink-soft">
                      {p.progress.pct}%
                    </span>
                  </div>

                  {/* One level down: the project's initiatives, each on its own
                      thin line, coloured by where it stands today. */}
                  {expanded &&
                    p.initiatives.map((i, idx) => {
                      const s = statusOf(i, today, shiftDays);
                      const iStart = addDays(i.startDate, shiftDays);
                      const iEnd = addDays(i.endDate, shiftDays);
                      const iLeft = pct(iStart);
                      const iWidth = Math.max(pct(iEnd) - iLeft, 1);
                      return (
                        <div
                          key={i.id}
                          data-testid="initiative-sub-bar"
                          title={`${i.title} · ${formatDay(iStart)} → ${formatDay(iEnd, true)} · ${s.label} · ${i.progress.done}/${i.progress.total} epics`}
                          className={`absolute flex items-center overflow-hidden whitespace-nowrap rounded-full border px-2.5 text-[10px] font-medium ${s.bar}`}
                          style={{
                            left: `${iLeft}%`,
                            width: `${iWidth}%`,
                            top: top + ROW_H + SUB_TOP + idx * (SUB_H + SUB_GAP),
                            height: SUB_H,
                          }}
                        >
                          <span className="truncate">{s.label}</span>
                        </div>
                      );
                    })}
                </div>
              );
            })}

            {today && (
              <div
                className="absolute border-l-2 border-dashed border-clay"
                style={{ left: `${pct(today)}%`, top: 22, bottom: 18 }}
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="-10 -10 20 20"
                  aria-hidden
                  className="absolute -left-2 -top-4"
                >
                  <polygon
                    fill="var(--clay)"
                    points="9,0 3.7,1.5 6.4,6.4 1.5,3.7 0,9 -1.5,3.7 -6.4,6.4 -3.7,1.5 -9,0 -3.7,-1.5 -6.4,-6.4 -1.5,-3.7 0,-9 1.5,-3.7 6.4,-6.4 3.7,-1.5"
                  />
                </svg>
                <span className="absolute -left-4 top-full text-[10.5px] font-semibold tracking-wide text-clay">
                  today
                </span>
              </div>
            )}
          </div>
        </div>

        <p className="mt-2 text-xs text-ink-faint">
          Drag a bar to reschedule a whole project · click it to step inside ·
          open a project&rsquo;s arrow to see its initiatives
        </p>
      </div>

      {/* Phone: the same information as calm, tappable cards */}
      <div className="mt-5 space-y-3 md:hidden">
        {sorted.map((p) => {
          const left = pct(p.startDate);
          const width = Math.max(pct(p.targetDate) - left, 2);
          const expanded = open.has(p.id) && p.initiatives.length > 0;
          return (
            <div
              key={p.id}
              className="rounded-xl border border-line bg-paper-raised p-4 shadow-sm"
            >
              <Link
                href={`/projects/${p.id}?from=projects`}
                className="block transition active:opacity-60"
              >
                <div className="flex items-baseline justify-between gap-3">
                  <span className="truncate font-serif text-base font-medium text-ink">
                    {p.name}
                  </span>
                  <span className="shrink-0 rounded-full bg-periwinkle-tint px-2 py-0.5 text-[11px] font-semibold text-periwinkle-deep">
                    {p.progress.pct}%
                  </span>
                </div>
                {/* Where this journey sits within all journeys' shared range */}
                <div className="relative mt-3 h-2 rounded-full bg-line/70">
                  <div
                    className="absolute inset-y-0 rounded-full bg-periwinkle"
                    style={{ left: `${left}%`, width: `${width}%` }}
                  />
                  {today && (
                    <div
                      aria-hidden
                      className="absolute -inset-y-1 w-0.5 rounded-full bg-clay"
                      style={{ left: `${pct(today)}%` }}
                    />
                  )}
                </div>
                <div className="mt-2 text-xs text-ink-faint">
                  {formatDay(p.startDate)} → {formatDay(p.targetDate, true)}
                </div>
              </Link>

              {/* One level down, on demand: this project's initiatives */}
              {p.initiatives.length > 0 && (
                <>
                  <button
                    onClick={() => toggleOpen(p.id)}
                    aria-expanded={expanded}
                    aria-label={`${expanded ? "Hide" : "Show"} the initiatives of ${p.name}`}
                    className="mt-3 flex w-full items-center gap-1.5 border-t border-line pt-2.5 text-xs font-medium text-ink-soft"
                  >
                    <Chevron open={expanded} />
                    {p.initiatives.length} initiative
                    {p.initiatives.length === 1 ? "" : "s"}
                    <span className="ml-auto text-ink-faint">
                      {doneCount(p)} complete
                    </span>
                  </button>

                  {expanded && (
                    <ul className="mt-2 space-y-2">
                      {p.initiatives.map((i) => {
                        const s = statusOf(i, today, 0);
                        return (
                          <li
                            key={i.id}
                            className="flex items-center gap-2"
                            data-testid="initiative-sub-row"
                          >
                            <span
                              aria-hidden
                              className={`h-1.5 w-1.5 shrink-0 rounded-full ${s.dot}`}
                            />
                            <span className="flex-1 truncate text-xs text-ink">
                              {i.title}
                            </span>
                            <span
                              className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${s.chip}`}
                            >
                              {s.label}
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </>
              )}
            </div>
          );
        })}
        {today && (
          <p className="pt-1 text-center text-[11px] text-ink-faint">
            the <span className="font-semibold text-clay">orange mark</span> on
            each bar is today
          </p>
        )}
      </div>
    </div>
  );
}

// Where an initiative stands, said gently: finished, live right now, still to
// come, or past its window and still open (an invitation to adapt, not a scold).
type StatusStyle = {
  label: string;
  dot: string;
  bar: string;
  chip: string;
};

const DONE: StatusStyle = {
  label: "complete",
  dot: "bg-sage",
  bar: "border-sage bg-sage-tint text-sage-deep",
  chip: "bg-sage-tint text-sage-deep",
};
const ACTIVE: StatusStyle = {
  label: "in progress",
  dot: "bg-periwinkle-deep",
  bar: "border-periwinkle-deep bg-periwinkle text-periwinkle-deep",
  chip: "bg-periwinkle text-periwinkle-deep",
};
const AHEAD: StatusStyle = {
  label: "ahead",
  dot: "bg-line-strong",
  bar: "border-line-strong bg-paper text-ink-faint",
  chip: "bg-line/70 text-ink-soft",
};
const STILL_OPEN: StatusStyle = {
  label: "still open",
  dot: "bg-clay",
  bar: "border-clay bg-clay-tint text-[#8a5238]",
  chip: "bg-clay-tint text-[#8a5238]",
};

const isInitiativeDone = (i: LifeMapInitiative) =>
  i.progress.total > 0 && i.progress.done === i.progress.total;

const doneCount = (p: LifeMapProject) =>
  p.initiatives.filter(isInitiativeDone).length;

/** `today` is null until the client knows the date — then everything not already
 *  complete simply reads as "ahead", so server and first client render agree. */
function statusOf(
  i: LifeMapInitiative,
  today: Date | null,
  shiftDays: number,
): StatusStyle {
  if (isInitiativeDone(i)) return DONE;
  if (!today) return AHEAD;
  const now = today.getTime();
  if (now < addDays(i.startDate, shiftDays).getTime()) return AHEAD;
  if (now > addDays(i.endDate, shiftDays).getTime()) return STILL_OPEN;
  return ACTIVE;
}

/** A quiet disclosure arrow: right when closed, down when open. */
function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      width="10"
      height="10"
      viewBox="0 0 10 10"
      aria-hidden
      focusable="false"
      className={`shrink-0 transition-transform ${open ? "rotate-90" : ""}`}
    >
      <path
        d="M3 1.5 L7 5 L3 8.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function EmptyProjects() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-6 py-16 text-center">
      <p className="font-serif text-xl text-ink">
        No projects on the road yet.
      </p>
      <p className="mt-2 max-w-sm text-sm leading-relaxed text-ink-soft">
        Projects are born on your Life Map, close to the values they serve.
        Start one there and it will appear here on the timeline.
      </p>
      <Link
        href="/"
        className="mt-5 rounded-full bg-sage px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-sage-deep"
      >
        ← Go to your Life Map
      </Link>
    </div>
  );
}
