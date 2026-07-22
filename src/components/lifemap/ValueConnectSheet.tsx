"use client";

import type { LifeMapProject } from "@/lib/data";

/**
 * The touch-friendly way to link a value to projects: tapping a value's ✦ dot
 * opens this sheet (dragging a wire is lovely with a mouse, unkind to
 * fingers). Each row toggles the connection, so it handles disconnecting too.
 * Slides up from the bottom on phones; a small centered card on desktop.
 */
export function ValueConnectSheet({
  valueName,
  valueId,
  projects,
  onToggle,
  onClose,
}: {
  valueName: string;
  valueId: string;
  projects: LifeMapProject[];
  onToggle: (projectId: string) => void;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50">
      <div
        className="absolute inset-0 bg-ink/20 backdrop-blur-[2px]"
        onClick={onClose}
      />
      <div
        data-testid="value-connect-sheet"
        className="ellie-rise absolute inset-x-0 bottom-0 max-h-[75dvh] overflow-y-auto rounded-t-2xl border-t border-line bg-paper-raised pb-[calc(1rem+env(safe-area-inset-bottom))] shadow-xl md:inset-x-auto md:bottom-auto md:left-1/2 md:top-1/2 md:w-96 md:-translate-x-1/2 md:-translate-y-1/2 md:rounded-2xl md:border md:pb-4"
      >
        <div className="flex items-start justify-between gap-3 px-5 pt-4">
          <div>
            <div className="flex items-center gap-1.5 font-serif text-base font-medium text-ink">
              <span aria-hidden className="text-[11px] text-gold">
                ✦
              </span>
              {valueName}
            </div>
            <p className="mt-0.5 text-xs text-ink-soft">
              Choose the projects this value guides.
            </p>
          </div>
          <button
            aria-label="Close"
            onClick={onClose}
            className="p-1 text-ink-faint transition hover:text-ink"
          >
            ✕
          </button>
        </div>

        <div className="mt-3 px-3">
          {projects.length === 0 ? (
            <p className="px-2 pb-3 text-sm text-ink-faint">
              No projects yet — create one first, then connect it here.
            </p>
          ) : (
            projects.map((p) => {
              const on = p.valueIds.includes(valueId);
              return (
                <button
                  key={p.id}
                  onClick={() => onToggle(p.id)}
                  className="flex w-full items-center gap-3 rounded-xl px-2 py-2.5 text-left transition hover:bg-paper"
                >
                  <span
                    aria-hidden
                    className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition ${
                      on
                        ? "border-sage bg-sage text-white"
                        : "border-line-strong"
                    }`}
                  >
                    {on && <span className="text-xs leading-none">✓</span>}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-ink">
                      {p.name}
                    </span>
                    <span className="block truncate text-xs text-ink-faint">
                      {on ? "Connected" : "Not connected"}
                    </span>
                  </span>
                </button>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
