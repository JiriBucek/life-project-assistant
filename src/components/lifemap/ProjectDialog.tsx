"use client";

import { useState } from "react";
import { Button } from "@/components/ui";
import type { LifeMapArea } from "@/lib/data";

export type ProjectDraft = {
  id?: string;
  name: string;
  whyStatement: string;
  valueIds: string[];
};

export function ProjectDialog({
  open,
  areas,
  initial,
  onClose,
  onSubmit,
}: {
  open: boolean;
  areas: LifeMapArea[];
  initial?: ProjectDraft;
  onClose: () => void;
  onSubmit: (draft: ProjectDraft) => void;
}) {
  const [name, setName] = useState("");
  const [why, setWhy] = useState("");
  const [valueIds, setValueIds] = useState<string[]>([]);

  // Seed the form from `initial` each time the dialog opens (render-phase pattern).
  const [wasOpen, setWasOpen] = useState(false);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setName(initial?.name ?? "");
      setWhy(initial?.whyStatement ?? "");
      setValueIds(initial?.valueIds ?? []);
    }
  }

  if (!open) return null;

  const hasValues = areas.some((a) => a.values.length > 0);
  const canSave = name.trim() && why.trim();

  function toggle(id: string) {
    setValueIds((cur) =>
      cur.includes(id) ? cur.filter((v) => v !== id) : [...cur, id],
    );
  }

  return (
    // Full-screen on phones (small centered cards are cramped once the
    // keyboard rises); a centered card from md up.
    <div className="fixed inset-0 z-50 flex items-center justify-center md:p-4">
      <div
        className="absolute inset-0 bg-[var(--scrim)] backdrop-blur-[2px]"
        onClick={onClose}
      />
      <div
        data-testid="project-dialog"
        className="ellie-rise relative flex h-full w-full flex-col bg-paper-raised shadow-xl md:h-auto md:max-h-[92vh] md:max-w-lg md:rounded-2xl md:border md:border-line"
      >
        <div className="p-5 pb-0 md:p-6 md:pb-0">
          <h2 className="font-serif text-xl font-medium text-ink">
            {initial?.id ? "Edit project" : "Begin a project"}
          </h2>
          <p className="mt-1 text-sm text-ink-soft">
            Start with the meaning. What are you reaching for, and why does it
            matter?
          </p>
        </div>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-5 pt-4 md:p-6 md:pt-5">
          <label className="block">
            <span className="text-sm font-medium text-ink">Project name</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
              placeholder="e.g. Run a half marathon"
              className="mt-1 w-full rounded-lg border border-line-strong bg-paper px-3 py-2 text-ink outline-none focus:border-sage"
            />
          </label>

          <label className="block">
            <span className="text-sm font-medium text-ink">
              Why does this matter to you?
            </span>
            <textarea
              value={why}
              onChange={(e) => setWhy(e.target.value)}
              rows={3}
              placeholder="The benefit you're really after…"
              className="mt-1 w-full resize-none rounded-lg border border-line-strong bg-paper px-3 py-2 text-ink outline-none focus:border-sage"
            />
          </label>

          <div>
            <span className="text-sm font-medium text-ink">
              Connect to your values
            </span>
            {!hasValues ? (
              <p className="mt-1 text-sm text-ink-faint">
                Add some values to your life areas first — then you can link this
                project to what it serves.
              </p>
            ) : (
              <div className="mt-2 max-h-44 space-y-3 overflow-y-auto pr-1">
                {areas
                  .filter((a) => a.values.length > 0)
                  .map((area) => (
                    <div key={area.id}>
                      <div className="text-xs uppercase tracking-wide text-ink-faint">
                        {area.name}
                      </div>
                      <div className="mt-1 flex flex-wrap gap-1.5">
                        {area.values.map((v) => {
                          const on = valueIds.includes(v.id);
                          return (
                            <button
                              key={v.id}
                              type="button"
                              onClick={() => toggle(v.id)}
                              className={`rounded-full px-3 py-1 text-sm transition ${
                                on
                                  ? "bg-gold-deep text-white"
                                  : "bg-gold-tint/60 text-gold-deep hover:bg-gold-tint"
                              }`}
                            >
                              <span aria-hidden className="mr-1 text-[10px]">
                                ✦
                              </span>
                              {v.name}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </div>
        </div>

        <div className="flex justify-end gap-2 border-t border-line p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] md:border-0 md:p-6 md:pb-6 md:pt-0">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            disabled={!canSave}
            onClick={() =>
              onSubmit({ id: initial?.id, name, whyStatement: why, valueIds })
            }
          >
            {initial?.id ? "Save changes" : "Create project"}
          </Button>
        </div>
      </div>
    </div>
  );
}
