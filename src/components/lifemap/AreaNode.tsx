"use client";

import { Handle, Position, type NodeProps } from "reactflow";
import { useState } from "react";
import { InlineEdit, SatisfactionScale, satisfactionColor } from "@/components/ui";
import { useLifeMap } from "./context";
import type { LifeMapArea } from "@/lib/data";

export type AreaNodeData = LifeMapArea & {
  // The satisfaction layer (0–1 each): the card's own shine, and each
  // value's, computed in LifeMap from ratings + recent task completions.
  glow: number;
  valueGlow: Record<string, number>;
};

export function AreaNode({ data }: NodeProps<AreaNodeData>) {
  const h = useLifeMap();
  const [adding, setAdding] = useState("");
  const glow = data.glow ?? 0;

  return (
    <div
      className="ellie-rise w-[22rem] rounded-2xl border border-sky/40"
      style={{
        backgroundColor:
          "color-mix(in srgb, var(--sky-tint) 55%, var(--paper-raised))",
        // Additive halo: every card keeps its resting shadow; engagement
        // widens and warms the aura. Fresh citrus yellow — complement of the
        // card's indigo, kin to the brand citron (--gold-tint), and
        // deliberately not the clay orange that means "needs attention"
        // elsewhere in the app. Static — no animation, calm by design.
        boxShadow: `0 1px 3px rgba(47,44,40,0.06), 0 0 ${(
          4 +
          10 * glow
        ).toFixed(0)}px ${(1 + 3 * glow).toFixed(1)}px rgba(240, 216, 0, ${(
          0.2 +
          0.6 * glow
        ).toFixed(3)}), 0 0 ${(8 + 60 * glow).toFixed(0)}px ${(
          2 +
          12 * glow
        ).toFixed(1)}px rgba(240, 216, 0, ${(0.08 + 0.42 * glow).toFixed(3)})`,
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
            className="font-serif text-xl font-medium text-ink"
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
            {data.values.map((v) => {
              const vGlow = data.valueGlow?.[v.id] ?? 0;
              return (
              <div
                key={v.id}
                className="group/val relative flex items-center rounded-full border border-gold/25 bg-gold-tint/80 py-1 pl-3 pr-3 text-sm text-gold-deep"
                // A value shines when the projects serving it move — acted-on
                // values literally light up. Resting chips stay as they are.
                style={
                  vGlow > 0
                    ? {
                        boxShadow: `0 0 ${(4 + 16 * vGlow).toFixed(0)}px ${(
                          1 + 3 * vGlow
                        ).toFixed(1)}px rgba(139, 122, 42, ${(
                          0.15 + 0.4 * vGlow
                        ).toFixed(3)})`,
                        borderColor: `rgba(139, 122, 42, ${(
                          0.25 + 0.45 * vGlow
                        ).toFixed(3)})`,
                      }
                    : undefined
                }
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
              );
            })}
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
