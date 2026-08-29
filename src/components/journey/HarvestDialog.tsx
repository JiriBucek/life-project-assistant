"use client";

import { useState, useTransition } from "react";
import * as actions from "@/lib/actions";
import { Button, SatisfactionScale } from "@/components/ui";
import type { ProjectDetail } from "@/lib/data";

/**
 * The harvest — the closing ritual of a completed journey. Opens over a
 * blurred page with a one-time burst of flying stars, shows the values the
 * project served, asks whether the journey brought some of them into the
 * user's life, and then gently offers to re-rate the connected life areas —
 * the moment completion finally touches the map.
 */
export function HarvestDialog({
  project,
  onClose,
}: {
  project: ProjectDetail;
  onClose: () => void;
}) {
  const [, startTransition] = useTransition();
  const [step, setStep] = useState<"ask" | "rate">("ask");

  // The areas this project served, via its values (deduplicated).
  const areas = Array.from(
    new Map(
      project.values
        .flatMap((v) => (v.area ? [v.area] : []))
        .map((a) => [a.id, a]),
    ).values(),
  );
  // Local mirror so the dots respond instantly while the save runs.
  const [ratings, setRatings] = useState<Record<string, number>>(() =>
    Object.fromEntries(areas.map((a) => [a.id, a.satisfaction])),
  );

  const answer = (brought: boolean) => {
    startTransition(() => void actions.recordHarvest(project.id, brought));
    setStep("rate");
  };

  const rate = (areaId: string, satisfaction: number) => {
    setRatings((r) => ({ ...r, [areaId]: satisfaction }));
    startTransition(() => void actions.updateArea(areaId, { satisfaction }));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-[var(--scrim)] backdrop-blur-[3px]" />
      <StarBurst />
      <div
        data-testid="harvest-dialog"
        className="ellie-rise relative w-full max-w-md rounded-2xl border border-line bg-paper-raised p-6 text-center shadow-xl"
      >
        {step === "ask" ? (
          <>
            <div aria-hidden className="text-3xl text-gold">
              ✦
            </div>
            <h2 className="mt-2 font-serif text-2xl font-medium text-ink">
              This project journey is complete!
            </h2>
            <p className="mt-4 text-sm text-ink-soft">
              Your reason for working on this project was:
            </p>
            {project.values.length > 0 ? (
              <div className="mt-2 flex flex-wrap justify-center gap-2">
                {project.values.map((v) => (
                  <span
                    key={v.id}
                    className="rounded-full bg-sage-tint/70 px-3 py-1 text-sm text-sage-deep"
                    title={v.area?.name}
                  >
                    {v.name}
                  </span>
                ))}
              </div>
            ) : (
              <p className="mt-2 text-sm italic text-ink">
                “{project.whyStatement}”
              </p>
            )}
            <p className="mt-5 font-medium text-ink">
              Did the journey bring some of it into your life?
            </p>
            <div className="mt-3 flex justify-center gap-2">
              <Button onClick={() => answer(true)}>Yes</Button>
              <Button variant="soft" onClick={() => answer(false)}>
                No
              </Button>
            </div>
            <button
              onClick={onClose}
              className="mt-4 text-xs text-ink-faint transition hover:text-ink"
            >
              Not now
            </button>
          </>
        ) : (
          <>
            {areas.length > 0 ? (
              <>
                <div className="space-y-5 text-left">
                  {areas.map((area) => (
                    <div key={area.id}>
                      <p className="text-sm text-ink">
                        How does{" "}
                        <span className="font-serif font-medium">
                          {area.name}
                        </span>{" "}
                        feel now?
                      </p>
                      <div className="mt-1.5">
                        <SatisfactionScale
                          value={ratings[area.id]}
                          onChange={(satisfaction) => rate(area.id, satisfaction)}
                        />
                      </div>
                    </div>
                  ))}
                </div>
                <p className="mt-5 text-xs text-ink-faint">
                  Your rating is reflected on your Life Map.
                </p>
              </>
            ) : (
              <p className="text-sm text-ink-soft">
                Beautifully done. Rest a moment before the next wish appears.
              </p>
            )}
            <div className="mt-4">
              <Button onClick={onClose}>Done</Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/**
 * A one-time celebration: ~two dozen stars fly outward from the dialog's
 * centre. Paths are derived from the star's index (not Math.random) so the
 * server and client always render the same burst — no hydration mismatch.
 */
function StarBurst() {
  const COLORS = ["#f0d800", "#cdb43e", "#b9c7f8", "#ffffff"];
  const stars = Array.from({ length: 26 }, (_, i) => {
    const rand = (salt: number) =>
      (((i + 1) * 9301 + salt * 49297) % 233280) / 233280;
    const angle = (i / 26) * Math.PI * 2 + rand(1) * 0.5;
    const distance = 130 + rand(2) * 240;
    return {
      dx: `${Math.round(Math.cos(angle) * distance)}px`,
      dy: `${Math.round(Math.sin(angle) * distance * 0.75)}px`,
      s: (0.7 + rand(3) * 1.1).toFixed(2),
      rot: `${Math.round(rand(4) * 320 - 160)}deg`,
      dur: `${(1.5 + rand(5) * 1.4).toFixed(2)}s`,
      delay: `${(rand(6) * 0.5).toFixed(2)}s`,
      color: COLORS[i % COLORS.length],
      size: 13 + Math.round(rand(7) * 15),
    };
  });

  return (
    <div aria-hidden className="absolute inset-0 overflow-hidden">
      {stars.map((star, i) => (
        <span
          key={i}
          className="harvest-star"
          style={
            {
              "--dx": star.dx,
              "--dy": star.dy,
              "--s": star.s,
              "--rot": star.rot,
              "--dur": star.dur,
              "--delay": star.delay,
              color: star.color,
              fontSize: `${star.size}px`,
              textShadow: "0 0 10px currentColor",
            } as React.CSSProperties
          }
        >
          ✦
        </span>
      ))}
    </div>
  );
}
