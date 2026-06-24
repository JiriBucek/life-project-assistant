"use client";

import { useMemo, useState } from "react";
import { updateInitiative } from "@/lib/actions";
import type { ProgressStat } from "@/lib/data";

export type TimelineInitiative = {
  id: string;
  title: string;
  startDay: number;
  duration: number;
  lane: number;
  progress: ProgressStat;
};

const PX_PER_DAY = 13;
const ROW_H = 64;
const LANES = 3;
const HEADER_H = 28;

type DragKind = "move" | "resize";

export function Timeline({
  initiatives,
  selectedId,
  onSelect,
}: {
  initiatives: TimelineInitiative[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  // Local mirror so drag/resize feels instant; committed to the server on release.
  const [local, setLocal] = useState(initiatives);
  const [draggingId, setDraggingId] = useState<string | null>(null);

  // Re-sync from the server whenever fresh initiative data arrives (render-phase).
  const [prevInitiatives, setPrevInitiatives] = useState(initiatives);
  if (initiatives !== prevInitiatives) {
    setPrevInitiatives(initiatives);
    setLocal(initiatives);
  }

  const horizonDays = useMemo(() => {
    const maxEnd = local.reduce((m, i) => Math.max(m, i.startDay + i.duration), 0);
    return Math.max(77, Math.ceil((maxEnd + 14) / 7) * 7);
  }, [local]);

  const weeks = Math.ceil(horizonDays / 7);
  const width = horizonDays * PX_PER_DAY;

  // Start a drag/resize: listeners are attached once and torn down on release,
  // and we only persist if the bar actually moved (a plain click just selects).
  function startDrag(
    e: React.PointerEvent,
    kind: DragKind,
    item: TimelineInitiative,
  ) {
    const startX = e.clientX;
    const startY = e.clientY;
    let latest = item;

    const onMove = (ev: PointerEvent) => {
      const dDays = Math.round((ev.clientX - startX) / PX_PER_DAY);
      setLocal((cur) =>
        cur.map((i) => {
          if (i.id !== item.id) return i;
          if (kind === "move") {
            const dLane = Math.round((ev.clientY - startY) / ROW_H);
            latest = {
              ...i,
              startDay: Math.max(0, item.startDay + dDays),
              lane: Math.min(LANES - 1, Math.max(0, item.lane + dLane)),
            };
          } else {
            latest = { ...i, duration: Math.max(1, item.duration + dDays) };
          }
          return latest;
        }),
      );
    };

    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
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

    setDraggingId(item.id);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp, { once: true });
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-line bg-paper-raised p-4">
      <div
        className="relative select-none"
        style={{ width, height: HEADER_H + LANES * ROW_H }}
      >
        {/* Week gridlines + labels */}
        {Array.from({ length: weeks + 1 }, (_, w) => (
          <div
            key={w}
            className="absolute top-0 bottom-0 border-l border-line"
            style={{ left: w * 7 * PX_PER_DAY }}
          >
            {w < weeks && (
              <span className="absolute top-0 left-1.5 text-[11px] text-ink-faint">
                Week {w + 1}
              </span>
            )}
          </div>
        ))}

        {/* Lane backgrounds */}
        {Array.from({ length: LANES }, (_, l) => (
          <div
            key={l}
            className="absolute left-0 right-0"
            style={{ top: HEADER_H + l * ROW_H, height: ROW_H }}
          />
        ))}

        {/* Initiative bars */}
        {local.map((i) => {
          const selected = i.id === selectedId;
          const dragging = i.id === draggingId;
          return (
            <div
              key={i.id}
              onPointerDown={(e) => {
                onSelect(i.id);
                startDrag(e, "move", i);
              }}
              className={`absolute flex cursor-grab flex-col justify-center rounded-lg px-3 active:cursor-grabbing ${
                selected
                  ? "ring-2 ring-sage ring-offset-1 ring-offset-paper-raised"
                  : ""
              } ${dragging ? "shadow-md" : ""}`}
              style={{
                left: i.startDay * PX_PER_DAY,
                top: HEADER_H + i.lane * ROW_H + 8,
                width: Math.max(i.duration * PX_PER_DAY, 60),
                height: ROW_H - 16,
                backgroundColor: "var(--sage-tint)",
                border: "1px solid var(--sage)",
              }}
            >
              <div className="truncate text-sm font-medium text-sage-deep">
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
