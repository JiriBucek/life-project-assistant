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
    <div
      className="ellie-rise w-72 rounded-2xl border border-sky/40 shadow-[0_1px_3px_rgba(47,44,40,0.06)]"
      style={{
        backgroundColor:
          "color-mix(in srgb, var(--sky-tint) 55%, var(--paper-raised))",
      }}
    >
      {/* Accent edge tinted by satisfaction */}
      <div
        className="h-1.5 w-full rounded-t-2xl"
        style={{ backgroundColor: satisfactionColor(data.satisfaction) }}
      />
      <div className="group/area p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-sky-deep">
            <span aria-hidden className="h-2 w-2 rounded-full bg-sky" />
            Life area
          </div>
          <button
            onClick={() => h.deleteArea(data.id)}
            className="text-ink-faint opacity-0 transition hover:text-[#b15a4a] group-hover/area:opacity-100 pointer-coarse:opacity-100"
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
              className="shrink-0 rounded-full bg-periwinkle-tint px-2 py-0.5 text-[11px] font-medium text-periwinkle-deep"
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
          <div className="mb-1.5 flex items-center gap-1 text-[11px] text-ink-faint">
            <span aria-hidden className="text-[10px] text-gold">
              ✦
            </span>
            Values
          </div>
          <div className="flex flex-col gap-1">
            {data.values.map((v) => (
              <div
                key={v.id}
                className="group/val relative flex items-center rounded-full border border-gold/25 bg-gold-tint/80 py-1 pl-3 pr-3 text-sm text-gold-deep"
              >
                <span aria-hidden className="mr-1.5 text-[10px] text-gold">
                  ✦
                </span>
                <InlineEdit
                  value={v.name}
                  onCommit={(name) => h.updateValue(v.id, name)}
                  className="flex-1 font-medium"
                />
                <button
                  onClick={() => h.deleteValue(v.id)}
                  className="text-gold-deep/50 opacity-0 transition hover:text-[#b15a4a] group-hover/val:opacity-100 pointer-coarse:opacity-100"
                  title="Delete value"
                >
                  ✕
                </button>
                {/* Connection point for projects — drag it with a mouse, or
                    tap it on touch to pick projects from a list. Grows a bit
                    on touch screens so fingers can find it. */}
                <Handle
                  type="target"
                  position={Position.Right}
                  id={v.id}
                  className="!h-3 !w-3 !border-2 !border-paper-raised !bg-gold pointer-coarse:h-5! pointer-coarse:w-5!"
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
            className="mt-1.5 w-full rounded-full border border-dashed border-line-strong bg-transparent px-3 py-1 text-sm text-ink placeholder:text-ink-faint focus:border-gold focus:outline-none"
          />
        </div>
      </div>
    </div>
  );
}
