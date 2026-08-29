"use client";

import { Handle, Position, type NodeProps } from "reactflow";
import { useRouter } from "next/navigation";
import { useLifeMap } from "./context";
import type { LifeMapProject } from "@/lib/data";
import { isProjectComplete } from "@/lib/portfolio";

export type ProjectNodeData = LifeMapProject;

export function ProjectNode({ data }: NodeProps<ProjectNodeData>) {
  const h = useLifeMap();
  const router = useRouter();
  const complete = isProjectComplete(data);

  return (
    <div
      className={`ellie-rise group/proj relative w-80 rounded-lg border bg-paper-raised shadow-[0_2px_6px_rgba(47,44,40,0.09)] transition-all ${
        h.connecting
          ? "border-gold ring-2 ring-gold/40"
          : complete
            ? "border-gold/60"
            : "border-periwinkle"
      }`}
      // A finished journey shines at full strength — the same citrus light the
      // life areas earn, turned all the way up. Static, like every glow here.
      style={
        complete
          ? {
              boxShadow:
                "0 2px 6px rgba(47,44,40,0.09), 0 0 14px 4px rgba(240, 216, 0, 0.8), 0 0 68px 14px rgba(240, 216, 0, 0.5)",
            }
          : undefined
      }
    >
      {/* Periwinkle spine — the project silhouette: crisp card, strong left edge */}
      <div
        aria-hidden
        className="absolute left-0 top-0 h-full w-1.5 rounded-l-lg bg-periwinkle"
      />

      {/* Source handle: drag from here onto a value to connect */}
      <Handle
        type="source"
        position={Position.Left}
        id="out"
        className="!h-3.5 !w-3.5 !border-2 !border-paper-raised !bg-periwinkle-deep pointer-coarse:h-5! pointer-coarse:w-5!"
        style={{ left: -7 }}
      />

      <div className="p-4 pl-5">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wider text-periwinkle-deep">
            <span aria-hidden>▸</span> Project
            {complete && (
              <span className="ml-1 flex items-center gap-1 rounded-full bg-gold-tint px-2 py-0.5 text-[10px] font-semibold text-gold-deep">
                ✦ Complete
              </span>
            )}
          </div>
          {/* Hover-revealed on mouse; always visible on touch (no hover there) */}
          <div className="flex items-center gap-2 opacity-0 transition group-hover/proj:opacity-100 pointer-coarse:opacity-100">
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
          onClick={() => router.push(`/projects/${data.id}?from=map`)}
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
              className="h-full rounded-full bg-periwinkle-deep transition-all"
              style={{ width: `${data.progress.pct}%` }}
            />
          </div>
        </div>

        <div className="mt-3 flex items-center justify-between">
          <span className="text-xs text-ink-faint">
            {data.valueIds.length === 0 ? (
              "Not yet connected to a value"
            ) : (
              <>
                <span aria-hidden className="text-gold">
                  ✦{" "}
                </span>
                {`${data.valueIds.length} value${data.valueIds.length > 1 ? "s" : ""} connected`}
              </>
            )}
          </span>
          <button
            onClick={() => router.push(`/projects/${data.id}?from=map`)}
            className="text-xs font-medium text-sage-deep hover:underline"
          >
            Open journey →
          </button>
        </div>
      </div>
    </div>
  );
}
