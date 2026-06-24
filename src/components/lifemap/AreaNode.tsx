"use client";

import { Handle, Position, type NodeProps } from "reactflow";
import { useState } from "react";
import { InlineEdit, SatisfactionScale, satisfactionColor } from "@/components/ui";
import { useLifeMap } from "./context";
import type { LifeMapArea } from "@/lib/data";

export type AreaNodeData = LifeMapArea;

export function AreaNode({ data }: NodeProps<AreaNodeData>) {
  const h = useLifeMap();
  const [adding, setAdding] = useState("");

  return (
    <div className="ellie-rise w-72 rounded-xl border border-line bg-paper-raised shadow-[0_1px_3px_rgba(47,44,40,0.06)]">
      {/* Accent edge tinted by satisfaction */}
      <div
        className="h-1.5 w-full rounded-t-xl"
        style={{ backgroundColor: satisfactionColor(data.satisfaction) }}
      />
      <div className="group/area p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-ink-faint">
            Life area
          </div>
          <button
            onClick={() => h.deleteArea(data.id)}
            className="text-ink-faint opacity-0 transition hover:text-[#b15a4a] group-hover/area:opacity-100"
            title="Delete area"
          >
            ✕
          </button>
        </div>

        <div className="flex items-baseline justify-between gap-2">
          <InlineEdit
            value={data.name}
            onCommit={(name) => h.updateArea(data.id, { name })}
            className="font-serif text-lg font-medium text-ink"
          />
          {data.projectCount > 0 && (
            <span
              className="shrink-0 rounded-full bg-clay-tint px-2 py-0.5 text-[11px] font-medium text-clay"
              title="Projects contributing to this area"
            >
              {data.projectCount} project{data.projectCount > 1 ? "s" : ""}
            </span>
          )}
        </div>

        <div className="mt-3">
          <div className="mb-1.5 text-[11px] text-ink-faint">Satisfaction</div>
          <SatisfactionScale
            value={data.satisfaction}
            onChange={(satisfaction) => h.updateArea(data.id, { satisfaction })}
          />
        </div>

        <div className="mt-4">
          <div className="mb-1.5 text-[11px] text-ink-faint">Values</div>
          <div className="flex flex-col gap-1">
            {data.values.map((v) => (
              <div
                key={v.id}
                className="group/val relative flex items-center justify-between rounded-lg bg-sage-tint/60 py-1 pl-2.5 pr-3 text-sm text-sage-deep"
              >
                <InlineEdit
                  value={v.name}
                  onCommit={(name) => h.updateValue(v.id, name)}
                  className="font-medium"
                />
                <button
                  onClick={() => h.deleteValue(v.id)}
                  className="text-sage-deep/50 opacity-0 transition hover:text-[#b15a4a] group-hover/val:opacity-100"
                  title="Delete value"
                >
                  ✕
                </button>
                {/* Connection point for projects */}
                <Handle
                  type="target"
                  position={Position.Right}
                  id={v.id}
                  className="!h-3 !w-3 !border-2 !border-paper-raised !bg-sage"
                  style={{ right: -6 }}
                />
              </div>
            ))}
          </div>

          <input
            value={adding}
            onChange={(e) => setAdding(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && adding.trim()) {
                h.createValue(data.id, adding);
                setAdding("");
              }
            }}
            placeholder="+ add a value"
            className="mt-1.5 w-full rounded-lg border border-dashed border-line-strong bg-transparent px-2.5 py-1 text-sm text-ink placeholder:text-ink-faint focus:border-sage focus:outline-none"
          />
        </div>
      </div>
    </div>
  );
}
