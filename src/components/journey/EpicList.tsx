"use client";

/**
 * The epics inside one initiative — the steps that make it real, in the order
 * the user wants to walk them. Each row can be completed, renamed, deleted, and
 * dragged (by its grip) to change which step comes first.
 */

import { useOptimistic, useState, useTransition } from "react";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type Announcements,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  restrictToParentElement,
  restrictToVerticalAxis,
} from "@dnd-kit/modifiers";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import * as actions from "@/lib/actions";
import { InlineEdit } from "@/components/ui";

export type EpicRowData = {
  id: string;
  title: string;
  isComplete: boolean;
};

export function EpicList({
  initiativeId,
  epics,
}: {
  initiativeId: string;
  epics: EpicRowData[];
}) {
  const [, startTransition] = useTransition();
  const run = (fn: () => unknown) => startTransition(() => void fn());
  const [newEpic, setNewEpic] = useState("");

  // The dragged order shows instantly and holds until the server action and its
  // revalidation land — React then falls back to the persisted order, so a
  // failed reorder simply undoes itself instead of lying about where things are.
  const [order, setOrder] = useOptimistic(epics);

  // A grip only starts a drag after a few pixels of movement, so tapping it (or
  // clicking anything else in the row) still behaves like a plain click.
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const label = (id: string | number) =>
    order.find((e) => e.id === id)?.title ?? "This epic";
  const position = (id: string | number) =>
    `${order.findIndex((e) => e.id === id) + 1} of ${order.length}`;

  const announcements: Announcements = {
    onDragStart: ({ active }) => `Picked up ${label(active.id)}.`,
    onDragOver: ({ active, over }) =>
      over && over.id !== active.id
        ? `${label(active.id)} is over position ${position(over.id)}.`
        : undefined,
    onDragEnd: ({ active, over }) =>
      over
        ? `${label(active.id)} is now ${position(over.id)}.`
        : `${label(active.id)} was dropped.`,
    onDragCancel: ({ active }) =>
      `Reordering cancelled — ${label(active.id)} stayed where it was.`,
  };

  function handleDragEnd({ active, over }: DragEndEvent) {
    if (!over || active.id === over.id) return;
    const from = order.findIndex((e) => e.id === active.id);
    const to = order.findIndex((e) => e.id === over.id);
    if (from === -1 || to === -1) return;
    const next = arrayMove(order, from, to);
    startTransition(async () => {
      setOrder(next);
      await actions.reorderEpics(
        initiativeId,
        next.map((e) => e.id),
      );
    });
  }

  return (
    <>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        modifiers={[restrictToVerticalAxis, restrictToParentElement]}
        onDragEnd={handleDragEnd}
        accessibility={{ announcements }}
      >
        <SortableContext
          items={order.map((e) => e.id)}
          strategy={verticalListSortingStrategy}
        >
          <div className="mt-4 space-y-1.5">
            {order.map((epic) => (
              <EpicRow
                key={epic.id}
                epic={epic}
                onToggle={() =>
                  run(() => actions.toggleEpic(epic.id, !epic.isComplete))
                }
                onRename={(title) => run(() => actions.updateEpic(epic.id, title))}
                onDelete={() => run(() => actions.deleteEpic(epic.id))}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      <input
        value={newEpic}
        onChange={(e) => setNewEpic(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && newEpic.trim()) {
            run(() => actions.createEpic(initiativeId, newEpic));
            setNewEpic("");
          }
        }}
        placeholder="+ add an epic"
        className="mt-2 w-full rounded-lg border border-dashed border-line-strong bg-transparent px-3 py-1.5 text-sm text-ink placeholder:text-ink-faint focus:border-sage focus:outline-none"
      />

      {order.length > 1 && (
        <p className="mt-2 text-xs text-ink-faint">
          Drag a step by its handle to change what comes first.
        </p>
      )}
    </>
  );
}

function EpicRow({
  epic,
  onToggle,
  onRename,
  onDelete,
}: {
  epic: EpicRowData;
  onToggle: () => void;
  onRename: (title: string) => void;
  onDelete: () => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: epic.id });

  return (
    <div
      ref={setNodeRef}
      data-testid="epic-row"
      style={{
        // Vertical list — only the y offset matters, so no transform helper is needed.
        transform: transform ? `translate3d(0, ${transform.y}px, 0)` : undefined,
        transition: transition ?? undefined,
      }}
      className={`group/epic flex items-center gap-2 rounded-lg px-1.5 py-1.5 ${
        isDragging
          ? "relative z-10 bg-paper shadow-md ring-1 ring-sage/40"
          : "hover:bg-paper"
      }`}
    >
      <button
        ref={setActivatorNodeRef}
        {...attributes}
        {...listeners}
        aria-label={`Reorder ${epic.title}`}
        title="Drag to reorder"
        className="shrink-0 cursor-grab touch-none rounded text-ink-faint opacity-40 transition hover:text-ink-soft focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-sage group-hover/epic:opacity-100 active:cursor-grabbing"
      >
        <GripIcon />
      </button>

      <button
        onClick={onToggle}
        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition ${
          epic.isComplete
            ? "border-sage bg-sage text-white"
            : "border-line-strong hover:border-sage"
        }`}
        aria-label="Toggle complete"
      >
        {epic.isComplete && <span className="text-xs leading-none">✓</span>}
      </button>

      <div
        className={`flex-1 text-sm ${
          epic.isComplete ? "text-ink-faint line-through" : "text-ink"
        }`}
      >
        <InlineEdit value={epic.title} onCommit={onRename} />
      </div>

      <button
        onClick={onDelete}
        className="text-ink-faint opacity-0 transition hover:text-[#b15a4a] group-hover/epic:opacity-100"
      >
        ✕
      </button>
    </div>
  );
}

/** Six calm dots — the universal "hold me and drag" mark. */
function GripIcon() {
  return (
    <svg width="14" height="18" viewBox="0 0 14 18" aria-hidden focusable="false">
      {[5, 9].map((x) =>
        [5, 9, 13].map((y) => (
          <circle key={`${x}-${y}`} cx={x} cy={y} r="1.35" fill="currentColor" />
        )),
      )}
    </svg>
  );
}
