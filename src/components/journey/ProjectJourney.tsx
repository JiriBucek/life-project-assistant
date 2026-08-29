"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import * as actions from "@/lib/actions";
import { Button, InlineEdit } from "@/components/ui";
import type { ProjectDetail } from "@/lib/data";
import { HarvestDialog } from "./HarvestDialog";
import {
  addDays,
  dayDiff,
  durationDays,
  fromDateInputValue,
  humanDuration,
  toDateInputValue,
} from "@/lib/timeline";
import { isProjectComplete } from "@/lib/portfolio";
import { Timeline } from "./Timeline";
import { TaskList } from "./TaskList";
import { ReflectionPanel } from "./ReflectionPanel";

export function ProjectJourney({
  project,
  backHref,
  backLabel,
}: {
  project: ProjectDetail;
  // Where "back" leads — the page decides based on how the journey was entered.
  backHref: string;
  backLabel: string;
}) {
  const [, startTransition] = useTransition();
  const run = (fn: () => unknown) => startTransition(() => void fn());

  const [selectedId, setSelectedId] = useState<string | null>(
    project.initiatives[0]?.id ?? null,
  );
  const [newInitiative, setNewInitiative] = useState("");

  const selected =
    project.initiatives.find((i) => i.id === selectedId) ??
    project.initiatives[0] ??
    null;

  // The harvest: when the last task of the last phase lands (or a completed,
  // never-harvested journey is opened), offer the closing ritual. Every phase
  // must be fulfilled — see isProjectComplete. Once open it stays open on
  // its own terms — recording the answer mid-ritual must not close it — and
  // "Not now" keeps it away for the rest of the visit.
  const complete = isProjectComplete(project);
  const [harvestOpen, setHarvestOpen] = useState(false);
  const [harvestDismissed, setHarvestDismissed] = useState(false);
  useEffect(() => {
    if (complete && !project.harvestedAt && !harvestDismissed)
      setHarvestOpen(true);
  }, [complete, project.harvestedAt, harvestDismissed]);

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

  // Just the fields the task list needs, so unrelated re-renders (typing an
  // initiative name, a transition settling) never disturb an in-flight drag.
  const taskRows = useMemo(
    () =>
      (selected?.tasks ?? []).map((e) => ({
        id: e.id,
        title: e.title,
        isComplete: e.isComplete,
      })),
    [selected?.tasks],
  );

  function bringInside() {
    for (const i of overdue) {
      const duration = Math.max(1, Math.min(i.duration, totalDays));
      const startDay = Math.max(0, Math.min(i.startDay, totalDays - duration));
      run(() => actions.updateInitiative(i.id, { startDay, duration }));
    }
  }

  return (
    <div className="mx-auto w-full max-w-[1200px] px-4 py-6 md:px-6 md:py-8">
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
              ? "No tasks yet."
              : `${project.progress.done} of ${project.progress.total} tasks complete · ${project.progress.pct}%`}
          </span>
        </div>

        {/* The harvest, once gathered — the journey's closing status */}
        {project.harvestedAt && (
          <div className="mt-4 flex max-w-2xl items-start gap-3 rounded-xl border border-gold/40 bg-gold-tint/60 px-4 py-3">
            <span aria-hidden className="mt-0.5 text-xl text-gold">
              ✦
            </span>
            <div>
              <div className="text-sm font-medium text-ink">
                {project.harvestBrought
                  ? "Journey complete — it brought some of its values into your life."
                  : "Journey complete — it didn’t bring what you hoped this time, and that ending counts too."}
              </div>
              <p className="mt-0.5 text-xs text-ink-soft">
                Completed on{" "}
                {new Date(project.harvestedAt).toLocaleDateString("en-US", {
                  month: "long",
                  day: "numeric",
                  year: "numeric",
                  timeZone: "UTC",
                })}
                .
              </p>
            </div>
          </div>
        )}
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
          The target is an intention, not a deadline. Say goodbye to pressure.
        </p>
      </section>

      {/* Timeline */}
      <section className="mt-7">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
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
              placeholder="Name a phase — Preparation, Execution, Conclusion…"
              className="w-[24rem] rounded-full border border-line-strong bg-paper-raised px-3.5 py-1.5 text-sm text-ink placeholder:text-ink-faint focus:border-sage focus:outline-none"
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
              + Phase
            </Button>
          </div>
        </div>

        {/* Gentle nudge when phases reach past the Target — adapt, don't fail */}
        {overdue.length > 0 && (
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-clay/40 bg-clay-tint/50 px-4 py-3">
            <p className="text-sm text-[var(--attention-mid)]">
              {overdue.length === 1
                ? "1 phase now reaches past your target date."
                : `${overdue.length} phases now reach past your target date.`}{" "}
              <span className="text-[var(--attention-soft)]">
                Extend the timeframe above, or tuck them back inside.
              </span>
            </p>
            <Button variant="soft" onClick={bringInside}>
              Bring inside the timeframe
            </Button>
          </div>
        )}

        {project.initiatives.length === 0 ? (
          <div className="rounded-xl border border-dashed border-line-strong bg-paper-raised p-10 text-center">
            <p className="font-serif text-lg text-ink">
              How would you like this journey to unfold?
            </p>
            <p className="mx-auto mt-2 max-w-lg text-sm text-ink-soft">
              Most journeys share one simple path:{" "}
              <strong>Preparation</strong> (gather what you need) —{" "}
              <strong>Execution</strong> — <strong>Conclusion</strong> (final
              touches).
            </p>
            <p className="mx-auto mt-3 max-w-lg text-sm text-ink-soft">
              Start simple or add more phases. Make it yours.
            </p>
            <div className="mt-5">
              <Button onClick={() => run(() => actions.scaffoldJourney(project.id))}>
                Lay out Preparation → Execution → Conclusion
              </Button>
            </div>
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

      {/* Detail: selected initiative's tasks + reflections */}
      <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-[1.4fr_1fr]">
        <section>
          {selected ? (
            <div className="rounded-xl border border-line bg-paper-raised p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-wider text-ink-faint">
                    Initiative — one phase of the journey
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

              {/* Tasks, in the order the user has arranged them (drag to change) */}
              {taskRows.length === 0 && (
                <p className="mt-4 text-xs text-ink-faint">
                  The concrete steps live here — a call to make, a thing to
                  buy, a page to write. Add them as tasks and check them off as
                  this phase unfolds.
                </p>
              )}
              <TaskList
                key={selected.id}
                initiativeId={selected.id}
                tasks={taskRows}
              />
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-line-strong bg-paper-raised p-10 text-center text-ink-soft">
              Select a phase on the timeline to plan its tasks.
            </div>
          )}
        </section>

        <ReflectionPanel
          projectId={project.id}
          reflections={project.reflections}
        />
      </div>

      <div className="mt-10">
        <Link
          href={backHref}
          className="inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-medium text-ink-soft transition-colors hover:bg-line/60 hover:text-ink"
        >
          ← {backLabel}
        </Link>
      </div>

      {harvestOpen && (
        <HarvestDialog
          project={project}
          onClose={() => {
            setHarvestOpen(false);
            setHarvestDismissed(true);
          }}
        />
      )}
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
        onClick={(e) => {
          // Open the calendar wherever the field is clicked, not just on the
          // picker icon — clicking a date segment normally only focuses it.
          try {
            e.currentTarget.showPicker();
          } catch {
            // Some browsers refuse (e.g. cross-origin iframe); typing still works.
          }
        }}
        onChange={(e) => {
          if (e.target.value) onCommit(e.target.value);
        }}
        className="mt-0.5 block rounded-lg border border-line-strong bg-paper px-2.5 py-1.5 text-sm text-ink outline-none focus:border-sage"
      />
    </label>
  );
}
