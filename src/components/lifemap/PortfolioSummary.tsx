"use client";

import { useState } from "react";
import type { PortfolioSummary as Summary } from "@/lib/data";
import { satisfactionColor } from "@/components/ui";

export function PortfolioSummary({ summary }: { summary: Summary }) {
  const [open, setOpen] = useState(true);

  if (summary.areaCount === 0) return null;

  return (
    <div className="absolute right-4 top-4 z-10 hidden w-64 overflow-hidden rounded-2xl border border-line bg-paper-raised/95 shadow-sm backdrop-blur md:block">
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
          </div>

          {summary.needsAttention && (
            <div className="rounded-lg bg-clay-tint/60 px-3 py-2 text-sm">
              <div className="text-[11px] uppercase tracking-wide text-clay">
                Needs attention
              </div>
              <div className="text-ink">
                {summary.needsAttention.name}{" "}
                <span className="text-ink-faint">
                  ({summary.needsAttention.satisfaction}/10)
                </span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
