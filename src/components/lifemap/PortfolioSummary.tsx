"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import type { PortfolioSummary as Summary } from "@/lib/data";
import { satisfactionColor } from "@/components/ui";

/**
 * "Your life, at a glance" — the map page's statistics. On desktop it floats
 * over the map as a collapsible panel; on phones (where a floating panel would
 * cover half the map) it shrinks to a chip that slides the same summary up
 * from the bottom.
 */
export function PortfolioSummary({
  summary,
  onShowStory,
}: {
  summary: Summary;
  onShowStory: () => void;
}) {
  const [open, setOpen] = useState(true);
  const [sheet, setSheet] = useState(false);

  if (summary.areaCount === 0) return null;

  return (
    <>
      {/* Desktop: floating collapsible panel */}
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
        {open && <SummaryBody summary={summary} onShowStory={onShowStory} />}
      </div>

      {/* Phone: a small chip; the same summary opens as a bottom sheet */}
      <button
        onClick={() => setSheet(true)}
        className="pointer-events-auto rounded-full border border-line bg-paper-raised/95 px-3 py-1.5 text-xs font-medium text-ink-soft shadow-sm backdrop-blur md:hidden"
      >
        At a glance
      </button>
      {/* Portalled to <body> so the map's overlay band (its own stacking
          context) can't trap or mis-layer the sheet. */}
      {sheet &&
        createPortal(
          <div className="pointer-events-auto fixed inset-0 z-50 md:hidden">
          <div
            className="absolute inset-0 bg-ink/20 backdrop-blur-[2px]"
            onClick={() => setSheet(false)}
          />
          <div className="ellie-rise absolute inset-x-0 bottom-0 max-h-[75dvh] overflow-y-auto rounded-t-2xl border-t border-line bg-paper-raised pb-[env(safe-area-inset-bottom)] shadow-xl">
            <div className="flex items-center justify-between px-4 py-3">
              <span className="font-serif text-base font-medium text-ink">
                Your life, at a glance
              </span>
              <button
                aria-label="Close summary"
                onClick={() => setSheet(false)}
                className="p-1 text-ink-faint transition hover:text-ink"
              >
                ✕
              </button>
            </div>
            <SummaryBody
              summary={summary}
              onShowStory={() => {
                setSheet(false);
                onShowStory();
              }}
            />
          </div>
        </div>,
          document.body,
        )}
    </>
  );
}

function SummaryBody({
  summary,
  onShowStory,
}: {
  summary: Summary;
  onShowStory: () => void;
}) {
  return (
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
              <span className="text-ink-faint">({area.satisfaction}/10)</span>
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
            <div className="text-ink-faint">Approaching project closure: –</div>
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
  );
}
