"use client";

/**
 * The tasks inside one initiative — the steps that make it real, in the order
 * the user wants to walk them. Each row can be completed, renamed, deleted, and
 * dragged (by its grip) to change which step comes first.
 */

import { useOptimistic, useRef, useState, useTransition } from "react";
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

export type TaskRowData = {
  id: string;
  title: string;
  isComplete: boolean;
};

// Optimistic mirror of the rows — same pattern as the Life Map. Every mutation
// is applied locally the moment it happens; the revalidated server data then
// replaces the whole list (swapping temporary ids for real ones).
type TaskAction =
  | { type: "create"; task: TaskRowData }
  | { type: "toggle"; id: string; isComplete: boolean }
  | { type: "rename"; id: string; title: string }
  | { type: "delete"; id: string }
  | { type: "reorder"; next: TaskRowData[] };

function taskReducer(state: TaskRowData[], action: TaskAction): TaskRowData[] {
  switch (action.type) {
    case "create":
      return [...state, action.task];
    case "toggle":
      return state.map((t) =>
        t.id === action.id ? { ...t, isComplete: action.isComplete } : t,
      );
    case "rename":
      return state.map((t) =>
        t.id === action.id ? { ...t, title: action.title } : t,
      );
    case "delete":
      return state.filter((t) => t.id !== action.id);
    case "reorder":
      return action.next;
  }
}

export function TaskList({
  initiativeId,
  tasks,
}: {
  initiativeId: string;
  tasks: TaskRowData[];
}) {
  const [, startTransition] = useTransition();
  const [newTask, setNewTask] = useState("");
  const [failed, setFailed] = useState(false);

  const [order, applyOptimistic] = useOptimistic(tasks, taskReducer);
  // Counter for temporary client ids, replaced by real ones on revalidation.
  const tmpId = useRef(0);

  // Apply the change locally right away, then run the server action. If it
  // throws, the transition settles without fresh data — the list snaps back to
  // what the server last confirmed — and a note says so instead of the change
  // just silently not happening.
  const mutate = (action: TaskAction, fn: () => Promise<unknown>) =>
    startTransition(async () => {
      setFailed(false);
      applyOptimistic(action);
      try {
        await fn();
      } catch (err) {
        console.error(err);
        setFailed(true);
      }
    });

  // A grip only starts a drag after a few pixels of movement, so tapping it (or
  // clicking anything else in the row) still behaves like a plain click.
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const label = (id: string | number) =>
    order.find((e) => e.id === id)?.title ?? "This task";
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
    mutate({ type: "reorder", next }, () =>
      actions.reorderTasks(
        initiativeId,
        next.map((e) => e.id),
      ),
    );
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
            {order.map((task) => (
              <TaskRow
                key={task.id}
                task={task}
                // A row still carrying its temporary id isn't saved yet — it
                // rests (faded, inert) for the moment rather than accepting
                // edits the server couldn't attach to anything.
                saving={task.id.startsWith("tmp-")}
                onToggle={() =>
                  mutate(
                    { type: "toggle", id: task.id, isComplete: !task.isComplete },
                    () => actions.toggleTask(task.id, !task.isComplete),
                  )
                }
                onRename={(title) =>
                  mutate({ type: "rename", id: task.id, title }, () =>
                    actions.updateTask(task.id, title),
                  )
                }
                onDelete={() =>
                  mutate({ type: "delete", id: task.id }, () =>
                    actions.deleteTask(task.id),
                  )
                }
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      <input
        value={newTask}
        onChange={(e) => setNewTask(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && newTask.trim()) {
            const title = newTask.trim();
            mutate(
              {
                type: "create",
                task: { id: `tmp-${++tmpId.current}`, title, isComplete: false },
              },
              () => actions.createTask(initiativeId, title),
            );
            setNewTask("");
          }
        }}
        placeholder="+ add a task"
        className="mt-2 w-full rounded-lg border border-dashed border-line-strong bg-transparent px-3 py-1.5 text-sm text-ink placeholder:text-ink-faint focus:border-sage focus:outline-none"
      />

      {failed && (
        <p role="status" className="mt-2 text-xs text-clay">
          That change didn’t save — the connection may have hiccuped. It’s safe
          to try again.
        </p>
      )}

      {order.length > 1 && (
        <p className="mt-2 text-xs text-ink-faint">
          Drag a step by its handle to change what comes first.
        </p>
      )}
    </>
  );
}

function TaskRow({
  task,
  saving,
  onToggle,
  onRename,
  onDelete,
}: {
  task: TaskRowData;
  saving?: boolean;
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
  } = useSortable({ id: task.id });

  return (
    <div
      ref={setNodeRef}
      data-testid="task-row"
      style={{
        // Vertical list — only the y offset matters, so no transform helper is needed.
        transform: transform ? `translate3d(0, ${transform.y}px, 0)` : undefined,
        transition: transition ?? undefined,
      }}
      className={`group/task flex items-center gap-2 rounded-lg px-1.5 py-1.5 ${
        isDragging
          ? "relative z-10 bg-paper shadow-md ring-1 ring-sage/40"
          : "hover:bg-paper"
      }${saving ? " pointer-events-none opacity-60" : ""}`}
    >
      <button
        ref={setActivatorNodeRef}
        {...attributes}
        {...listeners}
        aria-label={`Reorder ${task.title}`}
        title="Drag to reorder"
        className="shrink-0 cursor-grab touch-none rounded text-ink-faint opacity-40 transition hover:text-ink-soft focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-sage group-hover/task:opacity-100 active:cursor-grabbing"
      >
        <GripIcon />
      </button>

      <button
        onClick={onToggle}
        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition ${
          task.isComplete
            ? "border-sage bg-sage text-white"
            : "border-line-strong hover:border-sage"
        }`}
        aria-label="Toggle complete"
      >
        {task.isComplete && <span className="text-xs leading-none">✓</span>}
      </button>

      <div
        className={`flex-1 text-sm ${
          task.isComplete ? "text-ink-faint line-through" : "text-ink"
        }`}
      >
        <InlineEdit value={task.title} onCommit={onRename} />
      </div>

      <button
        onClick={onDelete}
        className="text-ink-faint opacity-0 transition hover:text-[#b15a4a] group-hover/task:opacity-100"
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
