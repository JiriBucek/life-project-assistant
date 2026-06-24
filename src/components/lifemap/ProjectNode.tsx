"use client";

import { Handle, Position, type NodeProps } from "reactflow";
import { useRouter } from "next/navigation";
import { useLifeMap } from "./context";
import type { LifeMapProject } from "@/lib/data";

export type ProjectNodeData = LifeMapProject;

export function ProjectNode({ data }: NodeProps<ProjectNodeData>) {
  const h = useLifeMap();
  const router = useRouter();

  return (
    <div
      className={`ellie-rise group/proj w-80 rounded-xl border bg-paper-raised shadow-[0_1px_3px_rgba(47,44,40,0.06)] transition-all ${
        h.connecting
          ? "border-sage ring-2 ring-sage/40"
          : "border-clay/30"
      }`}
    >
      {/* Source handle: drag from here onto a value to connect */}
      <Handle
        type="source"
        position={Position.Left}
        id="out"
        className="!h-3.5 !w-3.5 !border-2 !border-paper-raised !bg-clay"
        style={{ left: -7 }}
      />

      <div className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-clay">
            Project
          </div>
          <div className="flex items-center gap-2 opacity-0 transition group-hover/proj:opacity-100">
            <button
              onClick={() => h.editProject(data.id)}
              className="text-ink-faint hover:text-ink"
              title="Edit project"
            >
              ✎
            </button>
            <button
              onClick={() => h.deleteProject(data.id)}
              className="text-ink-faint hover:text-[#b15a4a]"
              title="Delete project"
            >
              ✕
            </button>
          </div>
        </div>

        <button
          onClick={() => router.push(`/projects/${data.id}`)}
          className="mt-0.5 block text-left font-serif text-lg font-medium text-ink hover:text-sage-deep"
        >
          {data.name}
        </button>

        <p className="mt-1.5 text-sm italic leading-snug text-ink-soft">
          “{data.whyStatement}”
        </p>

        {/* Progress */}
        <div className="mt-3">
          <div className="mb-1 flex items-center justify-between text-[11px] text-ink-faint">
            <span>Progress</span>
            <span className="tabular-nums">{data.progress.pct}%</span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-line">
            <div
              className="h-full rounded-full bg-sage transition-all"
              style={{ width: `${data.progress.pct}%` }}
            />
          </div>
        </div>

        <div className="mt-3 flex items-center justify-between">
          <span className="text-xs text-ink-faint">
            {data.valueIds.length === 0
              ? "Not yet connected to a value"
              : `${data.valueIds.length} value${data.valueIds.length > 1 ? "s" : ""} connected`}
          </span>
          <button
            onClick={() => router.push(`/projects/${data.id}`)}
            className="text-xs font-medium text-sage-deep hover:underline"
          >
            Open journey →
          </button>
        </div>
      </div>
    </div>
  );
}
