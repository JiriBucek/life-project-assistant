"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import * as actions from "@/lib/actions";
import { Button, InlineEdit } from "@/components/ui";
import type { ProjectDetail } from "@/lib/data";
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

  return (
    <div className="mx-auto w-full max-w-[1200px] px-6 py-8">
      {/* Hero */}
      <div className="ellie-rise">
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

      {/* Timeline */}
      <section className="mt-10">
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

        {project.initiatives.length === 0 ? (
          <div className="rounded-xl border border-dashed border-line-strong bg-paper-raised p-10 text-center text-ink-soft">
            Add your first initiative — a meaningful phase of this journey. Then
            drag it along the timeline and break it into epics below.
          </div>
        ) : (
          <Timeline
            initiatives={project.initiatives.map((i) => ({
              id: i.id,
              title: i.title,
              startDay: i.startDay,
              duration: i.duration,
              lane: i.lane,
              progress: i.progress,
            }))}
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
