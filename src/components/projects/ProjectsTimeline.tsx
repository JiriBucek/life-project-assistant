"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { LifeMapProject } from "@/lib/data";
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
const MONTHS_H = 30;
const ROW_H = 44;
const ROW_GAP = 10;
const NAME_COL = "15rem";

/**
 * The Projects page: every project as a bar on one shared time axis, names in
 * a column on the left. Desktop keeps the full picture plus drag-to-reschedule;
 * phones get calm tappable cards with the same information (rescheduling lives
 * inside the project there, where dates are edited precisely).
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

  // +18px at the bottom reserves room for the "today" tag under its line.
  const trackHeight = MONTHS_H + sorted.length * (ROW_H + ROW_GAP) + 18;

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
            {sorted.map((p) => (
              <div
                key={p.id}
                className="flex flex-col justify-center"
                style={{ height: ROW_H, marginBottom: ROW_GAP }}
              >
                <Link
                  href={`/projects/${p.id}?from=projects`}
                  className="truncate font-serif text-[15px] font-medium text-ink transition hover:text-sage-deep"
                >
                  {p.name}
                </Link>
                <div className="truncate text-xs text-ink-faint">
                  {formatDay(p.startDate)} → {formatDay(p.targetDate, true)}
                </div>
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

            {sorted.map((p, row) => {
              const shiftDays = shift?.id === p.id ? shift.days : 0;
              const start = addDays(p.startDate, shiftDays);
              const end = addDays(p.targetDate, shiftDays);
              const left = pct(start);
              const width = Math.max(pct(end) - left, 1.5);
              return (
                <div
                  key={p.id}
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
                    top: MONTHS_H + row * (ROW_H + ROW_GAP),
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
          Drag a bar to reschedule a whole project · click it to step inside
        </p>
      </div>

      {/* Phone: the same information as calm, tappable cards */}
      <div className="mt-5 space-y-3 md:hidden">
        {sorted.map((p) => {
          const left = pct(p.startDate);
          const width = Math.max(pct(p.targetDate) - left, 2);
          return (
            <Link
              key={p.id}
              href={`/projects/${p.id}?from=projects`}
              className="block rounded-xl border border-line bg-paper-raised p-4 shadow-sm transition active:bg-paper"
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
