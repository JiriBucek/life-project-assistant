"use client";

import { useState, useTransition } from "react";
import * as actions from "@/lib/actions";
import { Button } from "@/components/ui";
import type { ProjectDetail } from "@/lib/data";

export function ReflectionPanel({
  projectId,
  reflections,
}: {
  projectId: string;
  reflections: ProjectDetail["reflections"];
}) {
  const [, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [whatChanged, setWhatChanged] = useState("");
  const [why, setWhy] = useState("");
  const [nextStep, setNextStep] = useState("");

  const canSave = whatChanged.trim() || why.trim() || nextStep.trim();

  function save() {
    startTransition(() =>
      void actions.createReflection(projectId, { whatChanged, why, nextStep }),
    );
    setWhatChanged("");
    setWhy("");
    setNextStep("");
    setOpen(false);
  }

  return (
    <section className="rounded-xl border border-line bg-paper-raised p-5">
      <div className="flex items-center justify-between">
        <h3 className="font-serif text-lg font-medium text-ink">Reflections</h3>
        {!open && (
          <Button variant="soft" onClick={() => setOpen(true)}>
            + Reflect
          </Button>
        )}
      </div>
      <p className="mt-1 text-sm text-ink-soft">
        Plans change — that’s progress too. Capture what shifted and why.
      </p>

      {open && (
        <div className="mt-4 space-y-3 rounded-lg bg-paper p-3">
          <Field
            label="What changed?"
            value={whatChanged}
            onChange={setWhatChanged}
          />
          <Field label="Why?" value={why} onChange={setWhy} />
          <Field
            label="Next step?"
            value={nextStep}
            onChange={setNextStep}
          />
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button disabled={!canSave} onClick={save}>
              Save reflection
            </Button>
          </div>
        </div>
      )}

      <div className="mt-4 space-y-3">
        {reflections.length === 0 && !open && (
          <p className="text-sm text-ink-faint">No reflections yet.</p>
        )}
        {reflections.map((r) => (
          <article
            key={r.id}
            className="group/ref rounded-lg border border-line bg-paper p-3"
          >
            <div className="mb-1 flex items-center justify-between">
              <time className="text-[11px] text-ink-faint">
                {new Date(r.createdAt).toLocaleDateString(undefined, {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })}
              </time>
              <button
                onClick={() =>
                  startTransition(() => void actions.deleteReflection(r.id))
                }
                className="text-ink-faint opacity-0 transition hover:text-[#b15a4a] group-hover/ref:opacity-100"
              >
                ✕
              </button>
            </div>
            {r.whatChanged && (
              <Line label="Changed" text={r.whatChanged} />
            )}
            {r.why && <Line label="Why" text={r.why} />}
            {r.nextStep && <Line label="Next" text={r.nextStep} />}
          </article>
        ))}
      </div>
    </section>
  );
}

function Field({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-ink-soft">{label}</span>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={2}
        className="mt-1 w-full resize-none rounded-md border border-line-strong bg-paper-raised px-2.5 py-1.5 text-sm text-ink outline-none focus:border-sage"
      />
    </label>
  );
}

function Line({ label, text }: { label: string; text: string }) {
  return (
    <p className="text-sm leading-snug text-ink">
      <span className="mr-1.5 text-[11px] font-semibold uppercase tracking-wide text-ink-faint">
        {label}
      </span>
      {text}
    </p>
  );
}
