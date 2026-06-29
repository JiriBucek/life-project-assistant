"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import * as actions from "@/lib/actions";
import { Button, InlineEdit } from "@/components/ui";
import type { ProjectDetail } from "@/lib/data";
import {
  addDays,
  dayDiff,
  durationDays,
  fromDateInputValue,
  humanDuration,
  toDateInputValue,
} from "@/lib/timeline";
import { Timeline } from "./Timeline";
import { ReflectionPanel } from "./ReflectionPanel";

export function ProjectJourney({ project }: { project: ProjectDetail }) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const run = (fn: () => unknown) => startTransition(() => void fn());

  const [selectedId, setSelectedId] = useState<string | null>(
    project.initiatives[0]?.id ?? null,
  );
  const [newInitiative, setNewInitiative] = useState("");
  const [newEpic, setNewEpic] = useState("");

  const selected =
    project.initiatives.find((i) => i.id === selectedId) ??
    project.initiatives[0] ??
    null;

  // The project's timeframe, in the units the timeline math speaks (whole days
  // from the Start Date). Everything below derives from these two dates.
  const startISO = toDateInputValue(project.startDate);
  const targetISO = toDateInputValue(project.targetDate);
  const totalDays = durationDays(project.startDate, project.targetDate);

  // Any initiative whose end now reaches past the Target — surfaced gently so
  // the user can adapt rather than treated as a failure.
  const overdue = project.initiatives.filter(
    (i) => i.startDay + i.duration > totalDays,
  );

  // Stable identity for the timeline's bars so unrelated re-renders (typing an
  // initiative name, a transition settling) don't reset the Timeline's local
  // drag mirror.
  const timelineInitiatives = useMemo(
    () =>
      project.initiatives.map((i) => ({
        id: i.id,
        title: i.title,
        startDay: i.startDay,
        duration: i.duration,
        lane: i.lane,
        progress: i.progress,
      })),
    [project.initiatives],
  );

  function bringInside() {
    for (const i of overdue) {
      const duration = Math.max(1, Math.min(i.duration, totalDays));
      const startDay = Math.max(0, Math.min(i.startDay, totalDays - duration));
      run(() => actions.updateInitiative(i.id, { startDay, duration }));
    }
  }

  return (
    <div className="mx-auto w-full max-w-[1200px] px-6 py-8">
      {/* Hero */}
      <div className="ellie-rise">
        <div className="text-[11px] font-semibold uppercase tracking-wider text-ink-faint">
          Project
        </div>
        <h1>
          <InlineEdit
            value={project.name}
            onCommit={(name) =>
              run(() => actions.updateProject(project.id, { name }))
            }
            className="font-serif text-3xl font-semibold text-ink"
          />
        </h1>
        <div className="mt-2 max-w-2xl text-lg italic leading-snug text-ink-soft">
          “
          <InlineEdit
            value={project.whyStatement}
            onCommit={(whyStatement) =>
              run(() => actions.updateProject(project.id, { whyStatement }))
            }
            multiline
          />
          ”
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          {project.values.map((v) => (
            <span
              key={v.id}
              className="rounded-full bg-sage-tint/70 px-3 py-1 text-sm text-sage-deep"
              title={v.area?.name}
            >
              {v.name}
            </span>
          ))}
          {project.values.length === 0 && (
            <span className="text-sm text-ink-faint">
              No values connected yet — link some on the Life Map.
            </span>
          )}
        </div>

        {/* Overall progress */}
        <div className="mt-5 flex items-center gap-4">
          <div className="h-2 w-64 overflow-hidden rounded-full bg-line">
            <div
              className="h-full rounded-full bg-sage transition-all"
              style={{ width: `${project.progress.pct}%` }}
            />
          </div>
          <span className="text-sm text-ink-soft">
            {project.progress.total === 0
              ? "No epics yet — add initiatives and epics below."
              : `${project.progress.done} of ${project.progress.total} epics complete · ${project.progress.pct}%`}
          </span>
        </div>
      </div>

      {/* Timeframe — the journey's beginning, intended outcome, and where you are now */}
      <section className="mt-7 rounded-xl border border-line bg-paper-raised p-5">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="flex flex-wrap items-end gap-5">
            <DateField
              label="Start date"
              value={startISO}
              max={targetISO}
              onCommit={(startDate) =>
                run(() => actions.updateProjectDates(project.id, { startDate }))
              }
            />
            <span className="pb-2 text-ink-faint">→</span>
            <DateField
              label="Target completion"
              value={targetISO}
              min={startISO}
              onCommit={(targetDate) =>
                run(() => actions.updateProjectDates(project.id, { targetDate }))
              }
            />
            <div className="pb-1">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-ink-faint">
                Journey
              </div>
              <div className="text-sm text-ink-soft">
                {humanDuration(totalDays)}
              </div>
            </div>
          </div>
        </div>
        <p className="mt-3 text-xs text-ink-faint">
          The target is an intention, not a deadline — move it whenever life
          changes. The timeline below adapts to fit.
        </p>
      </section>

      {/* Timeline */}
      <section className="mt-7">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-serif text-xl font-medium text-ink">The journey</h2>
          <div className="flex items-center gap-2">
            <input
              value={newInitiative}
              onChange={(e) => setNewInitiative(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && newInitiative.trim()) {
                  run(() => actions.createInitiative(project.id, newInitiative));
                  setNewInitiative("");
                }
              }}
              placeholder="Name an initiative…"
              className="w-52 rounded-full border border-line-strong bg-paper-raised px-3.5 py-1.5 text-sm text-ink placeholder:text-ink-faint focus:border-sage focus:outline-none"
            />
            <Button
              disabled={!newInitiative.trim()}
              onClick={() => {
                if (newInitiative.trim()) {
                  run(() => actions.createInitiative(project.id, newInitiative));
                  setNewInitiative("");
                }
              }}
            >
              + Initiative
            </Button>
          </div>
        </div>

        {/* Gentle nudge when phases reach past the Target — adapt, don't fail */}
        {overdue.length > 0 && (
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-clay/40 bg-clay-tint/50 px-4 py-3">
            <p className="text-sm text-[#8a5238]">
              {overdue.length === 1
                ? "1 initiative now reaches past your target date."
                : `${overdue.length} initiatives now reach past your target date.`}{" "}
              <span className="text-[#a06a4f]">
                Extend the timeframe above, or tuck them back inside.
              </span>
            </p>
            <Button variant="soft" onClick={bringInside}>
              Bring inside the timeframe
            </Button>
          </div>
        )}

        {project.initiatives.length === 0 ? (
          <div className="rounded-xl border border-dashed border-line-strong bg-paper-raised p-10 text-center text-ink-soft">
            Add your first initiative — a meaningful phase of this journey. Then
            drag it along the timeline and break it into epics below.
          </div>
        ) : (
          <Timeline
            startDate={startISO}
            totalDays={totalDays}
            initiatives={timelineInitiatives}
            selectedId={selected?.id ?? null}
            onSelect={setSelectedId}
          />
        )}
      </section>

      {/* Detail: selected initiative's epics + reflections */}
      <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-[1.4fr_1fr]">
        <section>
          {selected ? (
            <div className="rounded-xl border border-line bg-paper-raised p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-wider text-ink-faint">
                    Initiative
                  </div>
                  <InlineEdit
                    value={selected.title}
                    onCommit={(title) =>
                      run(() => actions.updateInitiative(selected.id, { title }))
                    }
                    className="font-serif text-lg font-medium text-ink"
                  />
                </div>
                <button
                  onClick={() => {
                    run(() => actions.deleteInitiative(selected.id));
                    setSelectedId(null);
                  }}
                  className="text-sm text-ink-faint hover:text-[#b15a4a]"
                >
                  Delete
                </button>
              </div>

              {/* Initiative dates — drag the bar, or set them precisely here */}
              <InitiativeDates
                project={project}
                selected={selected}
                startISO={startISO}
                targetISO={targetISO}
                onUpdate={(data) =>
                  run(() => actions.updateInitiative(selected.id, data))
                }
              />

              <div className="mt-4 space-y-1.5">
                {selected.epics.map((epic) => (
                  <div
                    key={epic.id}
                    className="group/epic flex items-center gap-3 rounded-lg px-2 py-1.5 hover:bg-paper"
                  >
                    <button
                      onClick={() =>
                        run(() => actions.toggleEpic(epic.id, !epic.isComplete))
                      }
                      className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition ${
                        epic.isComplete
                          ? "border-sage bg-sage text-white"
                          : "border-line-strong hover:border-sage"
                      }`}
                      aria-label="Toggle complete"
                    >
                      {epic.isComplete && (
                        <span className="text-xs leading-none">✓</span>
                      )}
                    </button>
                    <div
                      className={`flex-1 text-sm ${
                        epic.isComplete
                          ? "text-ink-faint line-through"
                          : "text-ink"
                      }`}
                    >
                      <InlineEdit
                        value={epic.title}
                        onCommit={(title) =>
                          run(() => actions.updateEpic(epic.id, title))
                        }
                      />
                    </div>
                    <button
                      onClick={() => run(() => actions.deleteEpic(epic.id))}
                      className="text-ink-faint opacity-0 transition hover:text-[#b15a4a] group-hover/epic:opacity-100"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>

              <input
                value={newEpic}
                onChange={(e) => setNewEpic(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && newEpic.trim()) {
                    run(() => actions.createEpic(selected.id, newEpic));
                    setNewEpic("");
                  }
                }}
                placeholder="+ add an epic"
                className="mt-2 w-full rounded-lg border border-dashed border-line-strong bg-transparent px-3 py-1.5 text-sm text-ink placeholder:text-ink-faint focus:border-sage focus:outline-none"
              />
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-line-strong bg-paper-raised p-10 text-center text-ink-soft">
              Select an initiative on the timeline to plan its epics.
            </div>
          )}
        </section>

        <ReflectionPanel
          projectId={project.id}
          reflections={project.reflections}
        />
      </div>

      <div className="mt-10">
        <Button variant="ghost" onClick={() => router.push("/")}>
          ← Back to life map
        </Button>
      </div>
    </div>
  );
}

/** Precise Start/End editing for the selected initiative. Each field moves its
 *  own endpoint and keeps the other fixed (so a long initiative can always be
 *  repositioned), and the input bounds can never invert — even when an
 *  initiative currently overflows the timeframe. */
function InitiativeDates({
  project,
  selected,
  startISO,
  targetISO,
  onUpdate,
}: {
  project: ProjectDetail;
  selected: ProjectDetail["initiatives"][number];
  startISO: string;
  targetISO: string;
  onUpdate: (data: { startDay?: number; duration?: number }) => void;
}) {
  const initStart = selected.startDay;
  const initEnd = selected.startDay + selected.duration;
  const startValue = toDateInputValue(addDays(project.startDate, initStart));
  const endValue = toDateInputValue(addDays(project.startDate, initEnd));
  // Start can move from the project start up to the day before its own end;
  // end can move from the day after its start out to (at least) the Target.
  const startMax = toDateInputValue(addDays(project.startDate, initEnd - 1));
  const endMin = toDateInputValue(addDays(project.startDate, initStart + 1));
  const endMax = endValue > targetISO ? endValue : targetISO;

  return (
    <div className="mt-3 flex flex-wrap items-end gap-4 border-b border-line pb-4">
      <DateField
        label="Starts"
        value={startValue}
        min={startISO}
        max={startMax}
        onCommit={(value) => {
          const offset = dayDiff(project.startDate, fromDateInputValue(value));
          const startDay = Math.max(0, Math.min(offset, initEnd - 1));
          // Keep the End fixed → recompute duration.
          onUpdate({ startDay, duration: initEnd - startDay });
        }}
      />
      <span className="pb-2 text-ink-faint">→</span>
      <DateField
        label="Ends"
        value={endValue}
        min={endMin}
        max={endMax}
        onCommit={(value) => {
          const endOffset = dayDiff(project.startDate, fromDateInputValue(value));
          // Keep the Start fixed → recompute duration (permissive; may overflow
          // the Target, which the banner then offers to tuck back in).
          onUpdate({ duration: Math.max(1, endOffset - initStart) });
        }}
      />
      <span className="pb-1.5 text-xs text-ink-faint">
        {humanDuration(selected.duration)}
      </span>
    </div>
  );
}

/** A labelled native date picker that commits on change. */
function DateField({
  label,
  value,
  min,
  max,
  onCommit,
}: {
  label: string;
  value: string;
  min?: string;
  max?: string;
  onCommit: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="text-[11px] font-semibold uppercase tracking-wider text-ink-faint">
        {label}
      </span>
      <input
        type="date"
        value={value}
        min={min}
        max={max}
        onChange={(e) => {
          if (e.target.value) onCommit(e.target.value);
        }}
        className="mt-0.5 block rounded-lg border border-line-strong bg-paper px-2.5 py-1.5 text-sm text-ink outline-none focus:border-sage"
      />
    </label>
  );
}
