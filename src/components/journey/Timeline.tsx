"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { updateInitiative } from "@/lib/actions";
import type { ProgressStat } from "@/lib/data";
import {
  addDays,
  buildGridlines,
  dayDiff,
  formatDay,
  pickScale,
} from "@/lib/timeline";
import { useTodayUTC } from "@/lib/useTodayUTC";

export type TimelineInitiative = {
  id: string;
  title: string;
  startDay: number;
  duration: number;
  lane: number;
  progress: ProgressStat;
};

const ROW_H = 64;
const LANES = 3;
const HEADER_H = 34;

type DragKind = "move" | "resize";

export function Timeline({
  startDate,
  totalDays,
  initiatives,
  selectedId,
  onSelect,
}: {
  /** Project Start Date as an ISO string — day 0 of the timeline. */
  startDate: string;
  /** Project span in days (Start → Target Completion Date). */
  totalDays: number;
  initiatives: TimelineInitiative[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  // Local mirror so drag/resize feels instant; committed to the server on release.
  const [local, setLocal] = useState(initiatives);
  const [draggingId, setDraggingId] = useState<string | null>(null);

  // Re-sync from the server whenever fresh initiative data arrives (render-phase)
  // — but never mid-drag, or an unrelated parent re-render (or a previous
  // commit's revalidation) would yank the bar back to its server position.
  const [prevInitiatives, setPrevInitiatives] = useState(initiatives);
  if (initiatives !== prevInitiatives && draggingId === null) {
    setPrevInitiatives(initiatives);
    setLocal(initiatives);
  }

  // "Today" is client-only (null during SSR) to keep hydration clean.
  const today = useTodayUTC();
  const todayOffset = today === null ? null : dayDiff(startDate, today);

  const scale = useMemo(() => pickScale(totalDays), [totalDays]);
  const { pxPerDay } = scale;

  // Render at least the full timeframe, but extend to show any initiative that
  // currently spills past the Target so the user can still see and drag it back.
  const maxEnd = local.reduce((m, i) => Math.max(m, i.startDay + i.duration), 0);
  const renderDays = Math.max(totalDays, maxEnd);
  const width = renderDays * pxPerDay + 8;

  const gridlines = useMemo(
    () => buildGridlines(startDate, totalDays, scale),
    [startDate, totalDays, scale],
  );

  const targetX = totalDays * pxPerDay;
  const overflowing = renderDays > totalDays;

  // Tear down an in-flight drag if the component unmounts mid-gesture (e.g. the
  // last initiative is deleted while dragging) so the window listeners can't leak.
  const teardownRef = useRef<(() => void) | null>(null);
  useEffect(() => () => teardownRef.current?.(), []);

  // Start a drag/resize. Initiatives are clamped to the project's timeframe:
  // they cannot begin before the Start Date or run past the Target.
  function startDrag(
    e: React.PointerEvent,
    kind: DragKind,
    item: TimelineInitiative,
  ) {
    const startX = e.clientX;
    const startY = e.clientY;
    let latest = item;

    const onMove = (ev: PointerEvent) => {
      const dDays = Math.round((ev.clientX - startX) / pxPerDay);
      setLocal((cur) =>
        cur.map((i) => {
          if (i.id !== item.id) return i;
          if (kind === "move") {
            const dLane = Math.round((ev.clientY - startY) / ROW_H);
            const maxStart = Math.max(0, totalDays - item.duration);
            latest = {
              ...i,
              startDay: Math.min(maxStart, Math.max(0, item.startDay + dDays)),
              lane: Math.min(LANES - 1, Math.max(0, item.lane + dLane)),
            };
          } else {
            const maxDuration = Math.max(1, totalDays - item.startDay);
            latest = {
              ...i,
              duration: Math.min(maxDuration, Math.max(1, item.duration + dDays)),
            };
          }
          return latest;
        }),
      );
    };

    const teardown = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
      teardownRef.current = null;
    };

    const onUp = () => {
      teardown();
      setDraggingId(null);
      const changed =
        latest.startDay !== item.startDay ||
        latest.duration !== item.duration ||
        latest.lane !== item.lane;
      if (changed) {
        updateInitiative(latest.id, {
          startDay: latest.startDay,
          duration: latest.duration,
          lane: latest.lane,
        });
      }
    };

    teardownRef.current = teardown;
    setDraggingId(item.id);
    window.addEventListener("pointermove", onMove);
    // Listen for pointercancel too: a release outside the window or an OS
    // gesture won't always fire pointerup, which would otherwise leave the
    // pointermove handler attached ("sticky drag").
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-line bg-paper-raised p-4">
      <div
        className="relative select-none"
        style={{ width, height: HEADER_H + LANES * ROW_H }}
      >
        {/* Region beyond the Target Completion Date — gently set apart, never alarming */}
        {overflowing && (
          <div
            className="absolute top-0 bottom-0 rounded-r-md"
            style={{
              left: targetX,
              right: 0,
              background:
                "repeating-linear-gradient(45deg, var(--clay-tint) 0 6px, transparent 6px 12px)",
              opacity: 0.5,
            }}
          />
        )}

        {/* Date gridlines + labels (weeks for short journeys, months for long ones) */}
        {gridlines.map((g) => (
          <div
            key={g.dayOffset}
            className={`absolute top-0 bottom-0 border-l ${
              g.major ? "border-line-strong" : "border-line"
            }`}
            style={{ left: g.dayOffset * pxPerDay }}
          >
            <span
              className={`absolute top-0 left-1.5 whitespace-nowrap text-[11px] ${
                g.major ? "font-medium text-ink-soft" : "text-ink-faint"
              }`}
            >
              {g.label}
            </span>
          </div>
        ))}

        {/* Start & Target boundaries — the two ends of the journey */}
        <Boundary x={0} label="Start" date={formatDay(startDate)} align="left" />
        <Boundary
          x={targetX}
          label="Target"
          date={formatDay(addDays(startDate, totalDays))}
          align="right"
          accent
        />

        {/* Today — "where am I in this journey?" */}
        {todayOffset !== null &&
          todayOffset >= 0 &&
          todayOffset <= renderDays && (
            <div
              className="absolute top-0 bottom-0 z-10 border-l-2 border-dashed"
              style={{ left: todayOffset * pxPerDay, borderColor: "var(--sky)" }}
            >
              <span
                className="absolute left-1 rounded px-1 text-[10px] font-medium text-white"
                style={{ top: 16, backgroundColor: "var(--sky)" }}
              >
                Today
              </span>
            </div>
          )}

        {/* Initiative bars */}
        {local.map((i) => {
          const selected = i.id === selectedId;
          const dragging = i.id === draggingId;
          const start = addDays(startDate, i.startDay);
          const end = addDays(startDate, i.startDay + i.duration);
          const outOfBounds = i.startDay + i.duration > totalDays || i.startDay < 0;
          return (
            <div
              key={i.id}
              data-testid="initiative-bar"
              onPointerDown={(e) => {
                onSelect(i.id);
                startDrag(e, "move", i);
              }}
              title={`${i.title} · ${formatDay(start)} – ${formatDay(end, true)}`}
              className={`absolute z-[5] flex cursor-grab flex-col justify-center rounded-lg px-3 active:cursor-grabbing ${
                selected
                  ? "ring-2 ring-sage ring-offset-1 ring-offset-paper-raised"
                  : ""
              } ${dragging ? "shadow-md" : ""}`}
              style={{
                left: i.startDay * pxPerDay,
                top: HEADER_H + i.lane * ROW_H + 8,
                width: Math.max(i.duration * pxPerDay, 60),
                height: ROW_H - 16,
                backgroundColor: outOfBounds
                  ? "var(--clay-tint)"
                  : "var(--sage-tint)",
                border: `1px solid ${
                  outOfBounds ? "var(--clay)" : "var(--sage)"
                }`,
              }}
            >
              <div
                className={`truncate text-sm font-medium ${
                  outOfBounds ? "text-[#a85c44]" : "text-sage-deep"
                }`}
              >
                {i.title}
              </div>
              <div className="flex items-center gap-2">
                <div className="h-1 flex-1 overflow-hidden rounded-full bg-paper-raised/70">
                  <div
                    className="h-full rounded-full bg-sage"
                    style={{ width: `${i.progress.pct}%` }}
                  />
                </div>
                <span className="text-[10px] tabular-nums text-sage-deep/80">
                  {i.duration}d
                </span>
              </div>

              {/* Resize handle */}
              <div
                onPointerDown={(e) => {
                  e.stopPropagation();
                  startDrag(e, "resize", i);
                }}
                className="absolute right-0 top-0 h-full w-2.5 cursor-ew-resize rounded-r-lg hover:bg-sage/30"
                title="Drag to resize"
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Boundary({
  x,
  label,
  date,
  align,
  accent,
}: {
  x: number;
  label: string;
  date: string;
  align: "left" | "right";
  accent?: boolean;
}) {
  return (
    <div
      className="absolute top-0 bottom-0 z-[1] border-l-2"
      style={{
        left: x,
        borderColor: accent ? "var(--sage-deep)" : "var(--line-strong)",
      }}
    >
      <span
        className={`absolute bottom-1 whitespace-nowrap text-[10px] font-semibold uppercase tracking-wide ${
          align === "right" ? "right-1 text-right" : "left-1"
        } ${accent ? "text-sage-deep" : "text-ink-faint"}`}
      >
        {label}
        <span className="block font-normal normal-case tracking-normal text-ink-faint">
          {date}
        </span>
      </span>
    </div>
  );
}
