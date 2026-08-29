"use client";

import {
  useCallback,
  useMemo,
  useOptimistic,
  useRef,
  useState,
  useTransition,
} from "react";
import ReactFlow, {
  Background,
  BackgroundVariant,
  ConnectionMode,
  Controls,
  ReactFlowProvider,
  applyNodeChanges,
  type Connection,
  type Edge,
  type Node,
  type NodeChange,
  type OnConnectStartParams,
} from "reactflow";
import "reactflow/dist/style.css";

import type { LifeMapArea, LifeMapProject } from "@/lib/data";
import { computeGlow } from "@/lib/glow";
import { openJourneyGuide } from "@/components/HowItWorks";
import { ValueConnectSheet } from "./ValueConnectSheet";
import * as actions from "@/lib/actions";
import { Button } from "@/components/ui";
import { LifeMapProvider, type LifeMapHandlers } from "./context";
import { AreaNode } from "./AreaNode";
import { ProjectNode } from "./ProjectNode";
import { ProjectDialog, type ProjectDraft } from "./ProjectDialog";

const nodeTypes = { area: AreaNode, project: ProjectNode };

// ---------------------------------------------------------------------------
// Optimistic state
//
// Server actions revalidate `/`, which re-runs the whole page loader and streams
// fresh data back — a round-trip that's imperceptible on local SQLite but adds
// real latency in production (cold start + DB round-trips). To keep the canvas
// feeling instant, we mirror each mutation locally with `useOptimistic`: the UI
// updates immediately, then snaps to the authoritative server data when the
// revalidated payload arrives (which also replaces any temporary ids).
// ---------------------------------------------------------------------------

type LifeMapState = { areas: LifeMapArea[]; projects: LifeMapProject[] };

type LifeMapAction =
  | { type: "createArea"; area: LifeMapArea }
  | { type: "updateArea"; id: string; data: { name?: string; satisfaction?: number } }
  | { type: "deleteArea"; id: string }
  | { type: "createValue"; areaId: string; value: LifeMapArea["values"][number] }
  | { type: "updateValue"; id: string; name: string }
  | { type: "deleteValue"; id: string }
  | { type: "createProject"; project: LifeMapProject }
  | {
      type: "updateProject";
      id: string;
      data: { name?: string; whyStatement?: string; valueIds?: string[] };
    }
  | { type: "deleteProject"; id: string };

// Resolve value ids to the lightweight {id, name, areaId} shape projects carry.
function resolveValues(
  areas: LifeMapArea[],
  valueIds: string[],
): LifeMapProject["values"] {
  const map = new Map<string, LifeMapProject["values"][number]>();
  for (const a of areas)
    for (const v of a.values) map.set(v.id, { id: v.id, name: v.name, areaId: v.areaId });
  return valueIds.map((id) => map.get(id)).filter(Boolean) as LifeMapProject["values"];
}

// Recompute the fields the server derives (project↔area links, per-area project
// counts) so badges and edges stay correct after an optimistic relation change.
function withDerived(state: LifeMapState): LifeMapState {
  const projects = state.projects.map((p) => ({
    ...p,
    valueIds: p.values.map((v) => v.id),
    areaIds: Array.from(
      new Set(p.values.map((v) => v.areaId).filter(Boolean)),
    ) as string[],
  }));
  const countByArea = new Map<string, number>();
  for (const p of projects)
    for (const areaId of p.areaIds)
      countByArea.set(areaId, (countByArea.get(areaId) ?? 0) + 1);
  const areas = state.areas.map((a) => ({
    ...a,
    projectCount: countByArea.get(a.id) ?? 0,
  }));
  return { areas, projects };
}

function lifeMapReducer(
  state: LifeMapState,
  action: LifeMapAction,
): LifeMapState {
  switch (action.type) {
    case "createArea":
      return withDerived({ ...state, areas: [...state.areas, action.area] });

    case "updateArea":
      return withDerived({
        ...state,
        areas: state.areas.map((a) => {
          if (a.id !== action.id) return a;
          const name = action.data.name?.trim();
          const next = { ...a };
          if (name) next.name = name; // never clear a name to empty
          if (action.data.satisfaction !== undefined)
            next.satisfaction = Math.min(
              10,
              Math.max(1, Math.round(action.data.satisfaction)),
            );
          return next;
        }),
      });

    case "deleteArea": {
      const dead = new Set(
        state.areas.find((a) => a.id === action.id)?.values.map((v) => v.id),
      );
      return withDerived({
        areas: state.areas.filter((a) => a.id !== action.id),
        // Cascade: the area's values vanish, so drop them from projects too.
        projects: state.projects.map((p) => ({
          ...p,
          values: p.values.filter((v) => !dead.has(v.id)),
        })),
      });
    }

    case "createValue":
      return withDerived({
        ...state,
        areas: state.areas.map((a) =>
          a.id === action.areaId
            ? { ...a, values: [...a.values, action.value] }
            : a,
        ),
      });

    case "updateValue":
      return withDerived({
        areas: state.areas.map((a) => ({
          ...a,
          values: a.values.map((v) =>
            v.id === action.id ? { ...v, name: action.name } : v,
          ),
        })),
        projects: state.projects.map((p) => ({
          ...p,
          values: p.values.map((v) =>
            v.id === action.id ? { ...v, name: action.name } : v,
          ),
        })),
      });

    case "deleteValue":
      return withDerived({
        areas: state.areas.map((a) => ({
          ...a,
          values: a.values.filter((v) => v.id !== action.id),
        })),
        projects: state.projects.map((p) => ({
          ...p,
          values: p.values.filter((v) => v.id !== action.id),
        })),
      });

    case "createProject":
      return withDerived({ ...state, projects: [...state.projects, action.project] });

    case "updateProject":
      return withDerived({
        ...state,
        projects: state.projects.map((p) => {
          if (p.id !== action.id) return p;
          const next = { ...p };
          const name = action.data.name?.trim();
          const why = action.data.whyStatement?.trim();
          if (name) next.name = name;
          if (why) next.whyStatement = why;
          if (action.data.valueIds)
            next.values = resolveValues(state.areas, action.data.valueIds);
          return next;
        }),
      });

    case "deleteProject":
      return withDerived({
        ...state,
        projects: state.projects.filter((p) => p.id !== action.id),
      });
  }
}


export function LifeMap(props: {
  areas: LifeMapArea[];
  projects: LifeMapProject[];
  focusAreaId?: string;
}) {
  return (
    <ReactFlowProvider>
      <LifeMapInner {...props} />
    </ReactFlowProvider>
  );
}

function LifeMapInner({
  areas: serverAreas,
  projects: serverProjects,
  focusAreaId,
}: {
  areas: LifeMapArea[];
  projects: LifeMapProject[];
  focusAreaId?: string;
}) {
  const [pending, startTransition] = useTransition();
  const [newAreaName, setNewAreaName] = useState("");
  const [areaPrompt, setAreaPrompt] = useState(false);
  const [dialog, setDialog] = useState<{ open: boolean; draft?: ProjectDraft }>({
    open: false,
  });
  // The value a connection drag started from (used to drop onto a whole
  // project) plus where it started, so a mere tap can be told apart from a drag.
  const connectFrom = useRef<{ valueId: string; x: number; y: number } | null>(
    null,
  );
  const [connectingFromValue, setConnectingFromValue] = useState(false);
  // A tapped value opens the connect sheet — the touch path to linking.
  const [sheetValueId, setSheetValueId] = useState<string | null>(null);

  // Optimistic mirror of the server data — see the reducer above. The base must
  // be a stable reference: useOptimistic re-runs the reducer whenever the base
  // identity changes, and a fresh object each render would loop forever against
  // the render-phase node sync below.
  const base = useMemo(
    () => ({ areas: serverAreas, projects: serverProjects }),
    [serverAreas, serverProjects],
  );
  const [optimistic, applyOptimistic] = useOptimistic<LifeMapState, LifeMapAction>(
    base,
    lifeMapReducer,
  );
  const { areas, projects } = optimistic;

  // Counter for temporary client ids, replaced by real ones on revalidation.
  const tmpId = useRef(0);

  // Arriving from a "Worth noticing" link (`/?focus=<areaId>`): open the map
  // on that area instead of the whole-map fitView, then glide in. Captured
  // once on arrival — not on every data revalidation. The card is w-72
  // (288px); the offsets aim at roughly its middle.
  const focusArea = useRef(
    focusAreaId ? serverAreas.find((a) => a.id === focusAreaId) : undefined,
  ).current;

  // Apply the optimistic action immediately, then run the server mutation. If
  // the action throws, the transition settles without a new base and the
  // optimistic change is discarded (reverting the UI).
  const mutate = useCallback(
    (action: LifeMapAction, fn: () => Promise<unknown>) =>
      startTransition(async () => {
        applyOptimistic(action);
        try {
          await fn();
        } catch (err) {
          console.error(err);
        }
      }),
    [applyOptimistic],
  );

  const handlers: LifeMapHandlers = useMemo(
    () => ({
      pending,
      connecting: connectingFromValue,
      updateArea: (id, data) =>
        mutate({ type: "updateArea", id, data }, () =>
          actions.updateArea(id, data),
        ),
      deleteArea: (id) =>
        mutate({ type: "deleteArea", id }, () => actions.deleteArea(id)),
      createValue: (areaId, name) => {
        const trimmed = name.trim();
        if (!trimmed) return;
        const value = {
          id: `tmp-${++tmpId.current}`,
          name: trimmed,
          areaId,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        mutate({ type: "createValue", areaId, value }, () =>
          actions.createValue(areaId, name),
        );
      },
      updateValue: (id, name) => {
        const trimmed = name.trim();
        if (!trimmed) return;
        mutate({ type: "updateValue", id, name: trimmed }, () =>
          actions.updateValue(id, name),
        );
      },
      deleteValue: (id) =>
        mutate({ type: "deleteValue", id }, () => actions.deleteValue(id)),
      deleteProject: (id) =>
        mutate({ type: "deleteProject", id }, () => actions.deleteProject(id)),
      disconnectValue: (projectId, valueId) => {
        const p = projects.find((pr) => pr.id === projectId);
        if (!p) return;
        const valueIds = p.valueIds.filter((v) => v !== valueId);
        mutate({ type: "updateProject", id: projectId, data: { valueIds } }, () =>
          actions.updateProject(projectId, { valueIds }),
        );
      },
      editProject: (id) => {
        const p = projects.find((pr) => pr.id === id);
        if (!p) return;
        setDialog({
          open: true,
          draft: {
            id: p.id,
            name: p.name,
            whyStatement: p.whyStatement,
            valueIds: p.valueIds,
          },
        });
      },
    }),
    [pending, connectingFromValue, projects, mutate],
  );

  // Build React Flow nodes from server data. Each area carries its glow (the
  // satisfaction layer) plus its values' glow, so the card can shine.
  const buildNodes = useCallback((): Node[] => {
    const { areaGlow, valueGlow } = computeGlow(areas, projects);
    const areaNodes: Node[] = areas.map((a) => ({
      id: a.id,
      type: "area",
      position: { x: a.x, y: a.y },
      data: {
        ...a,
        glow: areaGlow.get(a.id) ?? 0,
        valueGlow: Object.fromEntries(
          a.values.map((v) => [v.id, valueGlow.get(v.id) ?? 0]),
        ),
      },
      draggable: true,
    }));
    const projectNodes: Node[] = projects.map((p) => ({
      id: p.id,
      type: "project",
      position: { x: p.x, y: p.y },
      data: p,
      draggable: true,
    }));
    return [...areaNodes, ...projectNodes];
  }, [areas, projects]);

  // Rebuild nodes when the underlying data actually changes, while leaving local
  // drag interactions untouched between updates (render-phase sync pattern).
  //
  // Gate on a content signature rather than reference identity: while an
  // optimistic transition is pending, React re-runs the reducer on every render,
  // producing fresh array references with identical content. Comparing refs
  // would loop forever; the signature stays stable until the data truly changes.
  const dataKey = useMemo(
    () => JSON.stringify({ areas, projects }),
    [areas, projects],
  );
  const [nodes, setNodes] = useState<Node[]>(buildNodes);
  const [syncedKey, setSyncedKey] = useState(dataKey);
  if (syncedKey !== dataKey) {
    setSyncedKey(dataKey);
    setNodes(buildNodes());
  }

  // Edges: project → each connected value (value handle lives on its area node).
  const edges: Edge[] = useMemo(() => {
    const valueToArea = new Map<string, string>();
    areas.forEach((a) => a.values.forEach((v) => valueToArea.set(v.id, a.id)));
    const result: Edge[] = [];
    for (const p of projects) {
      for (const valueId of p.valueIds) {
        const areaId = valueToArea.get(valueId);
        if (!areaId) continue;
        result.push({
          id: `${p.id}:${valueId}`,
          source: p.id,
          sourceHandle: "out",
          target: areaId,
          targetHandle: valueId,
          style: { stroke: "var(--gold)", strokeWidth: 1.75 },
          animated: false,
        });
      }
    }
    return result;
  }, [areas, projects]);

  const onNodesChange = useCallback(
    (changes: NodeChange[]) => setNodes((nds) => applyNodeChanges(changes, nds)),
    [],
  );

  const onNodeDragStop = useCallback((_: unknown, node: Node) => {
    const { x, y } = node.position;
    if (node.type === "area") actions.moveArea(node.id, x, y);
    else actions.moveProject(node.id, x, y);
  }, []);

  const linkValueToProject = useCallback(
    (projectId: string, valueId: string) => {
      const project = projects.find((p) => p.id === projectId);
      if (!project || project.valueIds.includes(valueId)) return;
      const valueIds = [...project.valueIds, valueId];
      mutate({ type: "updateProject", id: project.id, data: { valueIds } }, () =>
        actions.updateProject(project.id, { valueIds }),
      );
    },
    [projects, mutate],
  );

  // Drag from a project handle onto a value handle → connect them.
  const onConnect = useCallback(
    (c: Connection) => {
      // project (source) → value (targetHandle)
      if (c.source && c.targetHandle && projects.some((p) => p.id === c.source)) {
        linkValueToProject(c.source, c.targetHandle);
        return;
      }
      // value (sourceHandle) → project (target), via loose connection mode
      if (c.target && c.sourceHandle && projects.some((p) => p.id === c.target)) {
        linkValueToProject(c.target, c.sourceHandle);
      }
    },
    [projects, linkValueToProject],
  );

  // Track which value a connection drag begins from, so the user can release
  // anywhere over a project card (not just on its dot) to connect.
  const onConnectStart = useCallback(
    (event: unknown, params: OnConnectStartParams) => {
      if (params.handleId && params.handleId !== "out") {
        const e = event as { touches?: TouchList; clientX?: number; clientY?: number };
        const pt = e.touches?.[0] ?? e;
        connectFrom.current = {
          valueId: params.handleId,
          x: pt.clientX ?? 0,
          y: pt.clientY ?? 0,
        };
        setConnectingFromValue(true);
      }
    },
    [],
  );

  const onConnectEnd = useCallback(
    (event: MouseEvent | TouchEvent) => {
      const from = connectFrom.current;
      connectFrom.current = null;
      setConnectingFromValue(false);
      if (!from) return;

      const point = "changedTouches" in event ? event.changedTouches[0] : event;

      // A tap (barely any movement) on a value's dot opens the connect sheet
      // instead — dragging a wire is precise mouse work, so touch gets a list.
      if (Math.hypot(point.clientX - from.x, point.clientY - from.y) < 8) {
        setSheetValueId(from.valueId);
        return;
      }

      const el = document.elementFromPoint(point.clientX, point.clientY);
      const nodeEl = el?.closest(".react-flow__node");
      const dropId = nodeEl?.getAttribute("data-id");
      if (dropId && projects.some((p) => p.id === dropId)) {
        linkValueToProject(dropId, from.valueId);
      }
    },
    [projects, linkValueToProject],
  );

  const onEdgeClick = useCallback(
    (_: React.MouseEvent, edge: Edge) => {
      const [projectId, valueId] = edge.id.split(":");
      handlers.disconnectValue(projectId, valueId);
    },
    [handlers],
  );

  function submitDialog(draft: ProjectDraft) {
    if (draft.id) {
      const data = {
        name: draft.name,
        whyStatement: draft.whyStatement,
        valueIds: draft.valueIds,
      };
      mutate({ type: "updateProject", id: draft.id, data }, () =>
        actions.updateProject(draft.id!, data),
      );
    } else {
      const project: LifeMapProject = {
        id: `tmp-${++tmpId.current}`,
        name: draft.name,
        whyStatement: draft.whyStatement,
        x: 540,
        y: 120 + projects.length * 200,
        valueIds: draft.valueIds,
        values: resolveValues(areas, draft.valueIds),
        areaIds: [],
        // Mirror the server defaults (84-day journey, active right now) so the
        // summary panel doesn't mis-flag the project before revalidation.
        startDate: new Date(),
        targetDate: new Date(Date.now() + 84 * 86_400_000),
        lastActivityAt: new Date(),
        initiatives: [], // a brand-new project has no journey yet
        progress: { total: 0, done: 0, pct: 0 },
        taskDates: [],
      };
      mutate({ type: "createProject", project }, () =>
        actions.createProject({
          name: draft.name,
          whyStatement: draft.whyStatement,
          valueIds: draft.valueIds,
        }),
      );
    }
    setDialog({ open: false });
  }

  function addArea() {
    const name = newAreaName.trim();
    if (!name) return;
    const order = areas.length;
    const area: LifeMapArea = {
      id: `tmp-${++tmpId.current}`,
      name,
      satisfaction: 5,
      x: 80,
      y: 40 + order * 420,
      order,
      values: [],
      satisfactionHistory: [{ value: 5, createdAt: new Date() }],
      projectCount: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    mutate({ type: "createArea", area }, () => actions.createArea(name));
    setNewAreaName("");
    setAreaPrompt(false);
  }

  const empty = areas.length === 0 && projects.length === 0;

  return (
    <LifeMapProvider value={handlers}>
      <div className="relative flex-1">
        {/* Top overlay band — shares the header/hero content container so the
            toolbar aligns with the welcome text's edges. */}
        <div className="pointer-events-none absolute inset-x-0 top-4 z-10">
          <div className="mx-auto flex w-full max-w-[1400px] items-start justify-between px-6">
            {/* Floating toolbar — actions first, the map key beneath */}
            <div className="pointer-events-auto">
              <div className="flex items-center gap-2 rounded-full border border-line bg-paper-raised/90 p-1.5 shadow-sm backdrop-blur sm:pl-3.5">
                <span className="hidden text-sm text-ink-soft sm:inline">
                  Start anywhere:
                </span>
                <Button
                  variant="soft"
                  onClick={() => setAreaPrompt((open) => !open)}
                >
                  + Life area
                </Button>
                <Button onClick={() => setDialog({ open: true })}>
                  + Project
                </Button>
              </div>
              {areaPrompt && (
                <div className="mt-2 w-72 rounded-xl border border-line bg-paper-raised p-3 shadow-sm">
                  <div className="mb-1.5 text-xs text-ink-faint">
                    A part of life you care about — Health, Family, Craft…
                  </div>
                  <input
                    autoFocus
                    value={newAreaName}
                    onChange={(e) => setNewAreaName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") addArea();
                      if (e.key === "Escape") {
                        setAreaPrompt(false);
                        setNewAreaName("");
                      }
                    }}
                    placeholder="Name a life area…"
                    className="w-full rounded-lg border border-line-strong bg-transparent px-2.5 py-1.5 text-sm text-ink placeholder:text-ink-faint focus:border-sage focus:outline-none"
                  />
                </div>
              )}
              {/* Map key — teaches the three shapes at a glance */}
              <div className="mt-2 inline-flex items-center gap-3 rounded-full border border-line bg-paper-raised/80 px-3 py-1 text-[11px] text-ink-soft shadow-sm backdrop-blur">
                <span className="flex items-center gap-1.5">
                  <span aria-hidden className="h-2 w-2 rounded-full bg-sky" />
                  Life area
                </span>
                <span className="flex items-center gap-1">
                  <span aria-hidden className="text-gold">
                    ✦
                  </span>
                  Value
                </span>
                <span className="flex items-center gap-1">
                  <span aria-hidden className="text-periwinkle-deep">
                    ▸
                  </span>
                  Project
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Hint — mouse users drag the wire; fingers tap the dot instead */}
        <div className="pointer-events-none absolute bottom-4 left-1/2 z-10 -translate-x-1/2 whitespace-nowrap rounded-full bg-ink/5 px-4 py-1.5 text-xs text-ink-soft">
          <span className="pointer-coarse:hidden">
            Drag from a value’s dot onto a project to connect them · click a
            line to disconnect
          </span>
          <span className="hidden pointer-coarse:inline">
            Tap a value’s ✦ dot to link it to a project
          </span>
        </div>

        {empty && (
          <EmptyState
            onAddArea={() => setAreaPrompt(true)}
            onAddProject={() => setDialog({ open: true })}
            onShowGuide={openJourneyGuide}
          />
        )}

        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          onNodesChange={onNodesChange}
          onNodeDragStop={onNodeDragStop}
          onConnect={onConnect}
          onConnectStart={onConnectStart}
          onConnectEnd={onConnectEnd}
          connectionMode={ConnectionMode.Loose}
          onEdgeClick={onEdgeClick}
          fitView={!focusArea}
          fitViewOptions={{ padding: 0.25, maxZoom: 1 }}
          onInit={(instance) => {
            if (focusArea)
              instance.setCenter(focusArea.x + 144, focusArea.y + 110, {
                zoom: 1,
                duration: 700,
              });
          }}
          minZoom={0.3}
          maxZoom={1.5}
          proOptions={{ hideAttribution: true }}
          className="bg-paper"
        >
          <Background
            variant={BackgroundVariant.Dots}
            gap={28}
            size={1}
            color="var(--line-strong)"
          />
          <Controls
            showInteractive={false}
            className="!border-line !shadow-sm [&_button]:!border-line [&_button]:!bg-paper-raised [&_button]:!text-ink-soft"
          />
        </ReactFlow>

        <ProjectDialog
          open={dialog.open}
          areas={areas}
          initial={dialog.draft}
          onClose={() => setDialog({ open: false })}
          onSubmit={submitDialog}
        />

        {sheetValueId &&
          (() => {
            const value = areas
              .flatMap((a) => a.values)
              .find((v) => v.id === sheetValueId);
            if (!value) return null;
            return (
              <ValueConnectSheet
                valueName={value.name}
                valueId={value.id}
                projects={projects}
                onToggle={(projectId) => {
                  const p = projects.find((pr) => pr.id === projectId);
                  if (!p) return;
                  if (p.valueIds.includes(value.id))
                    handlers.disconnectValue(projectId, value.id);
                  else linkValueToProject(projectId, value.id);
                }}
                onClose={() => setSheetValueId(null)}
              />
            );
          })()}
      </div>
    </LifeMapProvider>
  );
}

function EmptyState({
  onAddArea,
  onAddProject,
  onShowGuide,
}: {
  onAddArea: () => void;
  onAddProject: () => void;
  onShowGuide: () => void;
}) {
  return (
    <div className="pointer-events-none absolute inset-0 z-[5] flex items-center justify-center">
      <div className="max-w-xl px-6 text-center">
        <p className="font-serif text-xl text-ink">
          Where would you like to begin today?
        </p>
        <p className="mt-1.5 text-sm text-ink-soft">
          There is no right place to begin — only the one that feels right to
          you.
        </p>
        <button
          onClick={onShowGuide}
          className="pointer-events-auto mt-2 text-sm font-medium text-sage-deep transition hover:text-ink"
        >
          <span aria-hidden className="text-clay">
            ✦
          </span>{" "}
          New here? See how the journey works
        </button>

        <div className="pointer-events-auto mt-6 grid gap-3 text-left sm:grid-cols-2">
          <button
            onClick={onAddArea}
            className="group rounded-xl border border-line bg-paper-raised p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-sky hover:shadow-md"
          >
            <div className="mb-2 h-1.5 w-8 rounded-full bg-sky" />
            <div className="font-serif text-lg font-medium text-ink">
              Map a life area
            </div>
            <p className="mt-1 text-sm text-ink-soft">
              Health, Relationships, Craft… note how satisfied you feel and
              name the values that matter there.
            </p>
          </button>
          <button
            onClick={onAddProject}
            className="group rounded-xl border border-line bg-paper-raised p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-periwinkle hover:shadow-md"
          >
            <div className="mb-2 h-1.5 w-8 rounded-full bg-periwinkle" />
            <div className="font-serif text-lg font-medium text-ink">
              Start a project
            </div>
            <p className="mt-1 text-sm text-ink-soft">
              Something you want to make happen. Connect it to your life map
              whenever you’re ready — or let it stand on its own.
            </p>
          </button>
        </div>

        <p className="mt-5 text-sm text-ink-faint">
          Everything can be added, linked, and rearranged later — this map
          grows with you.
        </p>
      </div>
    </div>
  );
}
