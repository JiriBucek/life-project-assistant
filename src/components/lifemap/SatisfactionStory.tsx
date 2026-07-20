"use client";

import type { LifeMapArea } from "@/lib/data";
import {
  addDays,
  dayDiff,
  formatDay,
  toDateInputValue,
  todayUTC,
  toUTCDay,
} from "@/lib/timeline";

// Chart-tuned categorical palette derived from the brand hues, validated for
// colorblind separation and surface contrast (fixed order, assigned by area
// order — color follows the entity, never its rank). Areas beyond six share
// the neutral so hues are never cycled.
const SERIES = ["#4038c0", "#c34811", "#1f8a70", "#7b8ce0", "#9a4d8f", "#8a7420"];
const OVERFLOW = "#8a8378";
const seriesColor = (i: number) => SERIES[i] ?? OVERFLOW;

// Plot geometry (SVG user units)
const W = 660;
const H = 300;
const M = { top: 14, right: 132, bottom: 30, left: 30 };
const PW = W - M.left - M.right;
const PH = H - M.top - M.bottom;

type Point = { day: Date; value: number };

/** Collapse an area's entries to one point per calendar day (last wins). */
function dailyPoints(area: LifeMapArea): Point[] {
  const byDay = new Map<string, Point>();
  for (const e of area.satisfactionHistory) {
    byDay.set(toDateInputValue(e.createdAt), {
      day: toUTCDay(e.createdAt),
      value: e.value,
    });
  }
  return [...byDay.values()].sort((a, b) => a.day.getTime() - b.day.getTime());
}

/**
 * "How it's changed" — each life area's satisfaction ratings over time as a
 * step line (a rating holds until the next one), ending at today.
 */
export function SatisfactionStory({
  open,
  areas,
  onClose,
}: {
  open: boolean;
  areas: LifeMapArea[];
  onClose: () => void;
}) {
  if (!open) return null;

  const today = todayUTC();
  const series = areas.map((a, i) => ({
    name: a.name,
    color: seriesColor(i),
    points: dailyPoints(a),
  }));
  const allPoints = series.flatMap((s) => s.points);
  const firstDay =
    allPoints.length > 0
      ? new Date(Math.min(...allPoints.map((p) => p.day.getTime())))
      : today;
  // Give the story at least a month of horizon so early days don't cramp.
  const start = addDays(firstDay, -2);
  const end = addDays(today, 2);
  const span = Math.max(30, dayDiff(start, end));

  const x = (d: Date) => M.left + (dayDiff(start, d) / span) * PW;
  const y = (v: number) => M.top + ((10 - v) / 9) * PH;

  // Month boundaries inside the visible span, labelled like the timeline.
  const months: { px: number; label: string }[] = [];
  let cursor = new Date(
    Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 1),
  );
  while (cursor.getTime() <= end.getTime()) {
    months.push({
      px: x(cursor),
      label: `${cursor.toLocaleDateString("en-US", {
        month: "short",
        timeZone: "UTC",
      })} ’${String(cursor.getUTCFullYear() % 100).padStart(2, "0")}`,
    });
    cursor = new Date(
      Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth() + 1, 1),
    );
  }

  // Direct end labels, nudged apart so names never overlap.
  const endLabels = series
    .filter((s) => s.points.length > 0)
    .map((s) => ({
      name: s.name,
      color: s.color,
      ty: y(s.points[s.points.length - 1].value),
    }))
    .sort((a, b) => a.ty - b.ty);
  for (let i = 1; i < endLabels.length; i++) {
    if (endLabels[i].ty - endLabels[i - 1].ty < 15) {
      endLabels[i].ty = endLabels[i - 1].ty + 15;
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-ink/20 backdrop-blur-[2px]"
        onClick={onClose}
      />
      <div
        data-testid="satisfaction-story"
        className="ellie-rise relative w-full max-w-3xl rounded-2xl border border-line bg-paper-raised p-6 shadow-xl"
      >
        <button
          aria-label="Close chart"
          onClick={onClose}
          className="absolute right-4 top-4 text-ink-faint transition hover:text-ink"
        >
          ✕
        </button>
        <h2 className="font-serif text-xl font-medium text-ink">
          How it’s changed
        </h2>
        <p className="mt-1 text-sm text-ink-soft">
          Your satisfaction ratings over time — one line per life area. A line
          holds its height until you rate that area again.
        </p>

        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="mt-4 h-auto w-full"
          role="img"
          aria-label="Step chart of satisfaction ratings per life area over time"
        >
          {/* Recessive grid: even satisfaction levels */}
          {[2, 4, 6, 8, 10].map((v) => (
            <line
              key={v}
              x1={M.left}
              x2={M.left + PW}
              y1={y(v)}
              y2={y(v)}
              stroke="var(--line)"
              strokeWidth={1}
            />
          ))}
          {[1, 5, 10].map((v) => (
            <text
              key={v}
              x={M.left - 8}
              y={y(v) + 3.5}
              textAnchor="end"
              fontSize={10.5}
              fill="var(--ink-faint)"
            >
              {v}
            </text>
          ))}

          {/* Month ticks */}
          {months.map((m) => (
            <g key={`${m.label}-${m.px}`}>
              <line
                x1={m.px}
                x2={m.px}
                y1={M.top}
                y2={M.top + PH}
                stroke="var(--line)"
                strokeWidth={1}
                opacity={0.6}
              />
              <text
                x={m.px}
                y={H - 10}
                textAnchor="middle"
                fontSize={10}
                letterSpacing="0.08em"
                fill="var(--ink-faint)"
              >
                {m.label.toUpperCase()}
              </text>
            </g>
          ))}
          <text
            x={x(today)}
            y={H - 10}
            textAnchor="end"
            fontSize={10}
            fontWeight={600}
            letterSpacing="0.06em"
            fill="var(--clay)"
          >
            TODAY
          </text>

          {/* One step line per area, extended to today */}
          {series.map((s) => {
            if (s.points.length === 0) return null;
            let d = `M ${x(s.points[0].day).toFixed(1)} ${y(s.points[0].value).toFixed(1)}`;
            for (let i = 1; i < s.points.length; i++) {
              d += ` H ${x(s.points[i].day).toFixed(1)} V ${y(s.points[i].value).toFixed(1)}`;
            }
            d += ` H ${x(today).toFixed(1)}`;
            return (
              <g key={s.name}>
                <path
                  d={d}
                  fill="none"
                  stroke={s.color}
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                {s.points.map((p) => (
                  <g key={p.day.getTime()}>
                    <circle
                      cx={x(p.day)}
                      cy={y(p.value)}
                      r={3.5}
                      fill={s.color}
                      stroke="var(--paper-raised)"
                      strokeWidth={1.5}
                    />
                    {/* Generous invisible hit target with a tooltip */}
                    <circle
                      cx={x(p.day)}
                      cy={y(p.value)}
                      r={10}
                      fill="transparent"
                    >
                      <title>{`${s.name} · ${p.value}/10 · ${formatDay(p.day, true)}`}</title>
                    </circle>
                  </g>
                ))}
              </g>
            );
          })}

          {/* Direct labels at the line ends */}
          {endLabels.map((l) => (
            <g key={l.name}>
              <circle cx={M.left + PW + 10} cy={l.ty} r={3} fill={l.color} />
              <text
                x={M.left + PW + 18}
                y={l.ty + 3.5}
                fontSize={11}
                fill="var(--ink-soft)"
              >
                {l.name}
              </text>
            </g>
          ))}
        </svg>

        {/* Legend (identity never rests on position alone) */}
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1">
          {series.map((s) => (
            <span
              key={s.name}
              className="flex items-center gap-1.5 text-xs text-ink-soft"
            >
              <span
                aria-hidden
                className="h-2.5 w-2.5 rounded-sm"
                style={{ backgroundColor: s.color }}
              />
              {s.name}
            </span>
          ))}
        </div>

        <p className="mt-3 text-xs text-ink-faint">
          Every time you re-rate a life area on the map, its line grows a new
          step — the story writes itself.
        </p>
      </div>
    </div>
  );
}
