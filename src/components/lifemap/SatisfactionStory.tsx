"use client";

import type { ReactNode } from "react";
import type { LifeMapArea, LifeMapProject } from "@/lib/data";
import { toUTCDay } from "@/lib/timeline";

// Chart-tuned categorical palette derived from the brand hues, validated for
// colorblind separation and surface contrast (fixed order, assigned by area
// order — color follows the entity, never its rank). Areas beyond six share
// the neutral so hues are never cycled.
const SERIES = ["#4038c0", "#c34811", "#1f8a70", "#7b8ce0", "#9a4d8f", "#8a7420"];
const OVERFLOW = "#8a8378";
const seriesColor = (i: number) => SERIES[i] ?? OVERFLOW;

// Plot geometry (SVG user units). Both charts of a pair share it exactly, so
// their month columns line up to the pixel.
const W = 660;
const PLOT_H = 96;
const M = { top: 10, right: 14, bottom: 8, left: 34 };
const LABEL_H = 20; // extra bottom space on the chart that carries month labels

/** Months as a single index so ranges and diffs are plain arithmetic. */
const monthIndex = (value: Date | string) => {
  const d = toUTCDay(value);
  return d.getUTCFullYear() * 12 + d.getUTCMonth();
};
const monthLabel = (idx: number) => {
  const d = new Date(Date.UTC(Math.floor(idx / 12), idx % 12, 1));
  return `${d.toLocaleDateString("en-US", {
    month: "short",
    timeZone: "UTC",
  })} ’${String(d.getUTCFullYear() % 100).padStart(2, "0")}`;
};

type MonthPoint = {
  idx: number;
  value: number; // plotted value (avg rating, or % complete)
  tooltip: string;
};

/** Monthly averages of an area's ratings, one point per month with data. */
function satisfactionByMonth(area: LifeMapArea): MonthPoint[] {
  const byMonth = new Map<number, number[]>();
  for (const e of area.satisfactionHistory) {
    const idx = monthIndex(e.createdAt);
    (byMonth.get(idx) ?? byMonth.set(idx, []).get(idx)!).push(e.value);
  }
  return [...byMonth.entries()]
    .map(([idx, values]) => {
      const avg =
        Math.round(
          (values.reduce((s, v) => s + v, 0) / values.length) * 10,
        ) / 10;
      return {
        idx,
        value: avg,
        tooltip: `${area.name} · avg ${avg}/10 · ${monthLabel(idx)} (${
          values.length
        } rating${values.length === 1 ? "" : "s"})`,
      };
    })
    .sort((a, b) => a.idx - b.idx);
}

/**
 * The area's completion share at each month's end: of all tasks that existed
 * by then (across every project connected to the area), how many were done.
 * A share — rather than a raw count — so areas with big and small plans read
 * on the same scale, and so adding new tasks visibly dips the line: the plan
 * grew, and there is more to do again.
 */
function progressByMonth(
  area: LifeMapArea,
  projects: LifeMapProject[],
  lastIdx: number,
): MonthPoint[] {
  const tasks = projects
    .filter((p) => p.areaIds.includes(area.id))
    .flatMap((p) => p.taskDates);
  if (tasks.length === 0) return [];

  const firstIdx = Math.min(...tasks.map((t) => monthIndex(t.createdAt)));
  const points: MonthPoint[] = [];
  for (let idx = firstIdx; idx <= lastIdx; idx++) {
    const total = tasks.filter((t) => monthIndex(t.createdAt) <= idx).length;
    if (total === 0) continue;
    const done = tasks.filter(
      (t) => t.completedAt !== null && monthIndex(t.completedAt) <= idx,
    ).length;
    const share = Math.round((done / total) * 100);
    points.push({
      idx,
      value: share,
      tooltip: `${area.name} · ${share}% complete (${done}/${total} tasks) · ${monthLabel(idx)}`,
    });
  }
  return points;
}

/** Month-over-month change of the two latest points, or null if under two. */
function trendDelta(points: MonthPoint[]): number | null {
  if (points.length < 2) return null;
  const last = points[points.length - 1];
  const prev = points[points.length - 2];
  return Math.round((last.value - prev.value) * 10) / 10;
}

/** ▲ +1.5 / ▼ −0.5 / → no change — one glance, one direction. */
function TrendChip({ delta, unit }: { delta: number | null; unit: string }) {
  if (delta === null) {
    return (
      <span className="shrink-0 text-xs text-ink-faint">
        — needs two months
      </span>
    );
  }
  const cls =
    delta > 0 ? "text-sage-deep" : delta < 0 ? "text-clay" : "text-ink-faint";
  const arrow = delta > 0 ? "▲" : delta < 0 ? "▼" : "→";
  const label =
    delta === 0
      ? "no change"
      : `${delta > 0 ? "+" : "−"}${Math.abs(delta)} ${
          Math.abs(delta) === 1 ? unit.replace(/s$/, "") : unit
        }`;
  return (
    <span className={`shrink-0 text-xs font-medium tabular-nums ${cls}`}>
      {arrow} {label}
      <span className="ml-1 font-normal text-ink-faint">vs last month</span>
    </span>
  );
}

/**
 * One line over shared month columns. Every chart in the story gets the same
 * width, margins, and month range, so satisfaction and progress align exactly.
 */
function MonthChart({
  points,
  months,
  color,
  yMax,
  yTicks,
  showMonthLabels,
  ariaLabel,
}: {
  points: MonthPoint[];
  months: number[]; // full month-index axis, oldest → newest
  color: string;
  yMax: number;
  yTicks: number[];
  showMonthLabels: boolean;
  ariaLabel: string;
}) {
  const H = M.top + PLOT_H + M.bottom + (showMonthLabels ? LABEL_H : 0);
  const PW = W - M.left - M.right;
  const x = (idx: number) =>
    M.left + ((months.indexOf(idx) + 0.5) / months.length) * PW;
  const y = (v: number) => M.top + (1 - v / yMax) * PLOT_H;

  // Label roughly eight months at most, thinning evenly from the newest.
  const labelEvery = Math.ceil(months.length / 8);
  const labelled = months.filter(
    (_, i) => (months.length - 1 - i) % labelEvery === 0,
  );

  const d = points
    .map((p, i) => `${i === 0 ? "M" : "L"} ${x(p.idx).toFixed(1)} ${y(p.value).toFixed(1)}`)
    .join(" ");

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="mt-2 h-auto w-full"
      role="img"
      aria-label={ariaLabel}
    >
      {yTicks.map((v) => (
        <g key={v}>
          <line
            x1={M.left}
            x2={M.left + PW}
            y1={y(v)}
            y2={y(v)}
            stroke="var(--line)"
            strokeWidth={1}
          />
          <text
            x={M.left - 7}
            y={y(v) + 3.5}
            textAnchor="end"
            fontSize={10}
            fill="var(--ink-faint)"
          >
            {v}
          </text>
        </g>
      ))}

      {showMonthLabels &&
        labelled.map((idx) => (
          <text
            key={idx}
            x={x(idx)}
            y={H - 7}
            textAnchor="middle"
            fontSize={10}
            letterSpacing="0.08em"
            fill="var(--ink-faint)"
          >
            {monthLabel(idx).toUpperCase()}
          </text>
        ))}

      {points.length > 0 && (
        <path
          d={d}
          fill="none"
          stroke={color}
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      )}
      {points.map((p) => (
        <g key={p.idx}>
          <circle
            cx={x(p.idx)}
            cy={y(p.value)}
            r={3.5}
            fill={color}
            stroke="var(--paper-raised)"
            strokeWidth={1.5}
          />
          {/* Generous invisible hit target with a tooltip */}
          <circle cx={x(p.idx)} cy={y(p.value)} r={10} fill="transparent">
            <title>{p.tooltip}</title>
          </circle>
        </g>
      ))}
    </svg>
  );
}

/** Header row of one chart: name, how it's calculated, and the trend. */
function ChartHeading({
  title,
  question,
  method,
  trend,
}: {
  title: string;
  question: string;
  method: string;
  trend: ReactNode;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <div>
        <div className="text-[11px] font-medium uppercase tracking-wide text-ink-soft">
          {title}
        </div>
        <p className="mt-0.5 text-xs text-ink-faint">
          <span className="italic">{question}</span> {method}
        </p>
      </div>
      {trend}
    </div>
  );
}

/**
 * "How it's changed" — for every life area, two aligned monthly lines: how
 * satisfied you felt (average rating) above how much you actually moved
 * (share of connected tasks completed). Progress vs Satisfaction, read
 * together on the same months.
 */
export function SatisfactionStory({
  open,
  areas,
  projects,
  onClose,
}: {
  open: boolean;
  areas: LifeMapArea[];
  projects: LifeMapProject[];
  onClose: () => void;
}) {
  if (!open) return null;

  // One shared month axis for the whole story — every chart of every area
  // covers the same range, so the eye can travel straight down.
  const nowIdx = monthIndex(new Date());
  const perArea = areas.map((a, i) => ({
    area: a,
    color: seriesColor(i),
    satisfaction: satisfactionByMonth(a),
    progress: progressByMonth(a, projects, nowIdx),
  }));
  const firstIdx = Math.min(
    nowIdx - 2, // never fewer than three months of horizon
    ...perArea.flatMap(({ satisfaction, progress }) =>
      [...satisfaction, ...progress].map((p) => p.idx),
    ),
  );
  const months = Array.from(
    { length: nowIdx - firstIdx + 1 },
    (_, i) => firstIdx + i,
  );

  return (
    // Full-screen on phones, a centered card from md up.
    <div className="fixed inset-0 z-50 flex items-center justify-center md:p-4">
      <div
        className="absolute inset-0 bg-ink/20 backdrop-blur-[2px]"
        onClick={onClose}
      />
      <div
        data-testid="satisfaction-story"
        className="ellie-rise relative flex h-full w-full flex-col overflow-y-auto bg-paper-raised p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] shadow-xl md:h-auto md:max-h-[92vh] md:max-w-3xl md:rounded-2xl md:border md:border-line md:p-6 md:pb-6"
      >
        <button
          aria-label="Close chart"
          onClick={onClose}
          className="absolute right-4 top-4 p-1 text-ink-faint transition hover:text-ink"
        >
          ✕
        </button>
        <h2 className="font-serif text-xl font-medium text-ink">
          How it’s changed
        </h2>
        <p className="mt-1 text-sm text-ink-soft">
          Each life area tells two stories, month by month: how fulfilled you
          felt, and how much you actually moved. Read them together — progress
          that satisfaction never follows, or the other way round, is worth a
          closer look.
        </p>

        {perArea.length === 0 && (
          <p className="mt-6 text-sm text-ink-faint">
            No life areas yet — add one on the map to start the story.
          </p>
        )}

        {perArea.map(({ area, color, satisfaction, progress }) => (
          <section
            key={area.id}
            className="mt-6 border-t border-line pt-5 first-of-type:mt-5"
          >
            <h3 className="flex items-center gap-2 font-serif text-lg font-medium text-ink">
              <span
                aria-hidden
                className="h-2.5 w-2.5 rounded-sm"
                style={{ backgroundColor: color }}
              />
              {area.name}
            </h3>

            <div className="mt-3">
              <ChartHeading
                title={`${area.name} Satisfaction`}
                question="How fulfilled do I feel in this area?"
                method="Each dot is the average of that month’s ratings, on your 1–10 scale."
                trend={
                  <TrendChip delta={trendDelta(satisfaction)} unit="points" />
                }
              />
              {satisfaction.length > 0 ? (
                <MonthChart
                  points={satisfaction}
                  months={months}
                  color={color}
                  yMax={10}
                  yTicks={[5, 10]}
                  showMonthLabels={progress.length === 0}
                  ariaLabel={`Monthly average satisfaction for ${area.name}`}
                />
              ) : (
                <p className="mt-2 rounded-lg bg-paper px-3 py-2 text-xs text-ink-faint">
                  No ratings yet — rate this area on the map to start its line.
                </p>
              )}
            </div>

            <div className="mt-4">
              <ChartHeading
                title={`${area.name} Progress`}
                question="How much am I moving forward in this area?"
                method="The share of tasks completed — across all projects connected to this area — by each month’s end. New tasks lower the share: the plan grew."
                trend={<TrendChip delta={trendDelta(progress)} unit="pts" />}
              />
              {progress.length > 0 ? (
                <MonthChart
                  points={progress}
                  months={months}
                  color={color}
                  yMax={100}
                  yTicks={[50, 100]}
                  showMonthLabels
                  ariaLabel={`Monthly task completion share for ${area.name}`}
                />
              ) : (
                <p className="mt-2 rounded-lg bg-paper px-3 py-2 text-xs text-ink-faint">
                  No tasks here yet — connect a project to this area and tick
                  off tasks to see movement.
                </p>
              )}
            </div>
          </section>
        ))}

        <p className="mt-5 text-xs text-ink-faint">
          Every rating and every completed task adds to these lines — the story
          writes itself.
        </p>
      </div>
    </div>
  );
}
