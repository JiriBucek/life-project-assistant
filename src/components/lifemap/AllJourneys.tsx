"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { LifeMapProject } from "@/lib/data";
import * as actions from "@/lib/actions";
import {
  addDays,
  dayDiff,
  formatDay,
  toDateInputValue,
  toUTCDay,
} from "@/lib/timeline";
import { useTodayUTC } from "@/lib/useTodayUTC";

// Drawer geometry: month labels on top, then stacked lanes of project bars.
const LANE_TOP = 30;
const LANE_HEIGHT = 40;
const LANE_GAP = 8;

/**
 * "All journeys" — a collapsible band at the bottom of the Life Map showing
 * every project as a bar on one shared timeline. Overlapping projects stack
 * into lanes, so the stack height over "today" reads as current load.
 *
 * Three interactions only: see, drag a bar to reschedule (slides the whole
 * project, keeping its length), click a bar to open its journey.
 */
export function AllJourneys({ projects }: { projects: LifeMapProject[] }) {
  const router = useRouter();
  const today = useTodayUTC();
  // Visible by default; the header button tucks it away when the user wants
  // the map to have the whole page.
  const [open, setOpen] = useState(true);
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

  const done = shift?.until != null &&
    projects.some(
      (p) => p.id === shift.id && toDateInputValue(p.startDate) === shift.until,
    );
  if (done) setShift(null); // render-phase clear once the server caught up

  if (projects.length === 0) return null;

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

  // ---- month gridlines (pinned locale, like the journey timeline) ----
  const months: { left: number; label: string }[] = [];
  let cursor = new Date(
    Date.UTC(rangeStart.getUTCFullYear(), rangeStart.getUTCMonth() + 1, 1),
  );
  while (cursor.getTime() <= rangeEnd.getTime()) {
    months.push({
      left: pct(cursor),
      // Every label carries its year, e.g. "Jun ’26" — the user asked to
      // always see which year a month belongs to.
      label: `${cursor.toLocaleDateString("en-US", {
        month: "short",
        timeZone: "UTC",
      })} ’${String(cursor.getUTCFullYear() % 100).padStart(2, "0")}`,
    });
    cursor = new Date(
      Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth() + 1, 1),
    );
  }

  // ---- lanes: first free row whose last bar ended before this one starts ----
  const sorted = [...projects].sort(
    (a, b) => toUTCDay(a.startDate).getTime() - toUTCDay(b.startDate).getTime(),
  );
  const laneEnds: number[] = [];
  const laneOf = new Map<string, number>();
  for (const p of sorted) {
    const s = toUTCDay(p.startDate).getTime();
    const e = toUTCDay(p.targetDate).getTime();
    let lane = laneEnds.findIndex((end) => end < s);
    if (lane === -1) {
      lane = laneEnds.length;
      laneEnds.push(e);
    } else {
      laneEnds[lane] = e;
    }
    laneOf.set(p.id, lane);
  }
  const laneCount = laneEnds.length;

  const runningToday = today
    ? projects.filter(
        (p) =>
          toUTCDay(p.startDate).getTime() <= today.getTime() &&
          today.getTime() <= toUTCDay(p.targetDate).getTime(),
      ).length
    : null;

  // ---- drag handlers ----
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
      if (!p.id.startsWith("tmp-")) router.push(`/projects/${p.id}`);
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
  const trackHeight = LANE_TOP + laneCount * (LANE_HEIGHT + LANE_GAP) + 18;

  return (
    <div className="border-t border-line bg-paper-raised/95 backdrop-blur">
      <div className="mx-auto w-full max-w-[1400px] px-6">
        <button
          onClick={() => setOpen((o) => !o)}
          title={open ? "Hide the timeline" : "Show the timeline"}
          className="flex w-full items-center gap-2 py-2 text-left"
        >
          <span aria-hidden className="text-xs text-ink-faint">
            {open ? "▾" : "▸"}
          </span>
          <span className="font-serif text-sm font-medium text-ink">
            All projects
          </span>
          {runningToday !== null && (
            <span className="text-sm font-medium text-periwinkle-deep">
              · {runningToday} running today
            </span>
          )}
          <span className="ml-auto hidden text-xs text-ink-faint sm:block">
            {open
              ? "drag a bar to reschedule · click a bar to open the project · click here to hide"
              : "click to show the timeline"}
          </span>
        </button>

        {open && (
        <div className="pb-4">
            <div
              ref={trackRef}
              className="relative"
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

              {projects.map((p) => {
                const shiftDays = shift?.id === p.id ? shift.days : 0;
                const start = addDays(p.startDate, shiftDays);
                const end = addDays(p.targetDate, shiftDays);
                const left = pct(start);
                const width = Math.max(pct(end) - left, 1.5);
                const lane = laneOf.get(p.id) ?? 0;
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
                      top: LANE_TOP + lane * (LANE_HEIGHT + LANE_GAP),
                      height: LANE_HEIGHT,
                    }}
                  >
                    <div
                      aria-hidden
                      className="absolute inset-y-0 left-0 rounded-l-full bg-periwinkle/55"
                      style={{ width: `${p.progress.pct}%` }}
                    />
                    <span className="relative">{p.name}</span>
                    <span className="relative ml-auto pl-3 text-xs font-medium text-ink-soft">
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

            {runningToday !== null && (
              <div className="mt-4 inline-block rounded-full bg-gold-tint px-3.5 py-1 text-xs text-ink-soft">
                Right now the road holds{" "}
                <b>
                  {runningToday} project{runningToday === 1 ? "" : "s"} at once
                </b>{" "}
                — the stack height shows your load at any moment.
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
