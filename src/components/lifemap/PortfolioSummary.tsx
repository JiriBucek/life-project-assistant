"use client";

import { useState } from "react";
import type { PortfolioSummary as Summary } from "@/lib/data";
import { satisfactionColor } from "@/components/ui";

export function PortfolioSummary({
  summary,
  onShowStory,
}: {
  summary: Summary;
  onShowStory: () => void;
}) {
  const [open, setOpen] = useState(true);

  if (summary.areaCount === 0) return null;

  return (
    <div className="pointer-events-auto hidden w-64 overflow-hidden rounded-2xl border border-line bg-paper-raised/95 shadow-sm backdrop-blur md:block">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between px-4 py-3 text-left"
      >
        <span className="font-serif text-base font-medium text-ink">
          Your life, at a glance
        </span>
        <span className="text-ink-faint">{open ? "–" : "+"}</span>
      </button>

      {open && (
        <div className="space-y-3 px-4 pb-4">
          <div className="flex items-center justify-between text-sm">
            <span className="text-ink-soft">Life areas</span>
            <span className="tabular-nums text-ink">{summary.areaCount}</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-ink-soft">Active projects</span>
            <span className="tabular-nums text-ink">{summary.projectCount}</span>
          </div>

          <div>
            <div className="mb-1 flex items-center justify-between text-sm">
              <span className="text-ink-soft">Avg. satisfaction</span>
              <span className="tabular-nums text-ink">
                {summary.avgSatisfaction.toFixed(1)}/10
              </span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-line">
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${(summary.avgSatisfaction / 10) * 100}%`,
                  backgroundColor: satisfactionColor(
                    Math.round(summary.avgSatisfaction),
                  ),
                }}
              />
            </div>
            <button
              onClick={onShowStory}
              className="mt-1.5 text-xs font-medium text-sage-deep transition hover:text-ink"
            >
              see how it’s changed →
            </button>
          </div>

          <div className="rounded-lg bg-clay-tint/60 px-3 py-2 text-sm">
            <div className="text-[11px] uppercase tracking-wide text-clay">
              Worth noticing
            </div>
            <div className="space-y-1">
              {summary.needsAttention.map((area, i) => (
                <div key={`${area.name}-${i}`} className="text-ink">
                  {area.name}{" "}
                  <span className="text-ink-faint">
                    ({area.satisfaction}/10)
                  </span>
                </div>
              ))}
              {/* Project signals stay visible with a dash when quiet, so the
                  user learns these are watched even before they ever fire. */}
              {summary.staleProjects.length === 0 ? (
                <div className="text-ink-faint">
                  A project with no recent activity: –
                </div>
              ) : (
                summary.staleProjects.map((name) => (
                  <div key={`stale-${name}`} className="text-ink">
                    <span className="text-ink-faint">
                      A project with no recent activity:
                    </span>{" "}
                    {name}
                  </div>
                ))
              )}
              {summary.closingProjects.length === 0 ? (
                <div className="text-ink-faint">
                  Approaching project closure: –
                </div>
              ) : (
                summary.closingProjects.map((name) => (
                  <div key={`closing-${name}`} className="text-ink">
                    <span className="text-ink-faint">
                      Approaching project closure:
                    </span>{" "}
                    {name}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
