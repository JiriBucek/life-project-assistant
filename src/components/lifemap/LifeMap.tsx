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

import type { LifeMapArea, LifeMapProject, PortfolioSummary as Summary } from "@/lib/data";
import * as actions from "@/lib/actions";
import { Button } from "@/components/ui";
import { LifeMapProvider, type LifeMapHandlers } from "./context";
import { AreaNode } from "./AreaNode";
import { ProjectNode } from "./ProjectNode";
import { ProjectDialog, type ProjectDraft } from "./ProjectDialog";
import { PortfolioSummary } from "./PortfolioSummary";

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

function computeSummary(
  areas: LifeMapArea[],
  projects: LifeMapProject[],
): Summary {
  const avgSatisfaction =
    areas.length === 0
      ? 0
      : Math.round(
          (areas.reduce((s, a) => s + a.satisfaction, 0) / areas.length) * 10,
        ) / 10;
  const needsAttention =
    areas.length === 0
      ? null
      : areas.reduce((low, a) => (a.satisfaction < low.satisfaction ? a : low));
  return {
    areaCount: areas.length,
    projectCount: projects.length,
    avgSatisfaction,
    needsAttention: needsAttention
      ? { name: needsAttention.name, satisfaction: needsAttention.satisfaction }
      : null,
  };
}

export function LifeMap(props: {
  areas: LifeMapArea[];
  projects: LifeMapProject[];
  summary: Summary;
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
}: {
  areas: LifeMapArea[];
  projects: LifeMapProject[];
  summary: Summary;
}) {
  const [pending, startTransition] = useTransition();
  const [newAreaName, setNewAreaName] = useState("");
  const [dialog, setDialog] = useState<{ open: boolean; draft?: ProjectDraft }>({
    open: false,
  });
  // The value a connection drag started from (used to drop onto a whole project).
  const connectFrom = useRef<{ valueId: string } | null>(null);
  const [connectingFromValue, setConnectingFromValue] = useState(false);

  // Optimistic mirror of the server data — see the reducer above.
  const [optimistic, applyOptimistic] = useOptimistic<LifeMapState, LifeMapAction>(
    { areas: serverAreas, projects: serverProjects },
    lifeMapReducer,
  );
  const { areas, projects } = optimistic;
  const summary = useMemo(
    () => computeSummary(areas, projects),
    [areas, projects],
  );

  // Counter for temporary client ids, replaced by real ones on revalidation.
  const tmpId = useRef(0);

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

  // Build React Flow nodes from server data.
  const buildNodes = useCallback((): Node[] => {
    const areaNodes: Node[] = areas.map((a) => ({
      id: a.id,
      type: "area",
      position: { x: a.x, y: a.y },
      data: a,
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

  // Rebuild nodes whenever fresh server data arrives, while leaving local drag
  // interactions untouched between server updates (render-phase sync pattern).
  const [nodes, setNodes] = useState<Node[]>(buildNodes);
  const [prevData, setPrevData] = useState({ areas, projects });
  if (prevData.areas !== areas || prevData.projects !== projects) {
    setPrevData({ areas, projects });
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
          style: { stroke: "var(--sage)", strokeWidth: 1.5 },
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
    (_: unknown, params: OnConnectStartParams) => {
      if (params.handleId && params.handleId !== "out") {
        connectFrom.current = { valueId: params.handleId };
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
        progress: { total: 0, done: 0, pct: 0 },
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
      projectCount: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    mutate({ type: "createArea", area }, () => actions.createArea(name));
    setNewAreaName("");
  }

  const empty = areas.length === 0 && projects.length === 0;

  return (
    <LifeMapProvider value={handlers}>
      <div className="relative flex-1">
        {/* Floating toolbar */}
        <div className="absolute left-4 top-4 z-10 flex items-center gap-2 rounded-full border border-line bg-paper-raised/90 p-1.5 pl-3 shadow-sm backdrop-blur">
          <input
            value={newAreaName}
            onChange={(e) => setNewAreaName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") addArea();
            }}
            placeholder="Name a life area…"
            className="w-44 bg-transparent text-sm text-ink placeholder:text-ink-faint focus:outline-none"
          />
          <Button
            variant="soft"
            disabled={!newAreaName.trim()}
            onClick={addArea}
          >
            + Area
          </Button>
          <Button onClick={() => setDialog({ open: true })}>+ Project</Button>
        </div>

        <PortfolioSummary summary={summary} />

        {/* Hint */}
        <div className="pointer-events-none absolute bottom-4 left-1/2 z-10 -translate-x-1/2 rounded-full bg-ink/5 px-4 py-1.5 text-xs text-ink-soft">
          Drag from a value’s dot onto a project to connect them · click a line to
          disconnect
        </div>

        {empty && <EmptyState onAddArea={() => {}} />}

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
          fitView
          fitViewOptions={{ padding: 0.25, maxZoom: 1 }}
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
      </div>
    </LifeMapProvider>
  );
}

function EmptyState({ onAddArea }: { onAddArea: () => void }) {
  void onAddArea;
  return (
    <div className="pointer-events-none absolute inset-0 z-[5] flex items-center justify-center">
      <div className="max-w-md text-center">
        <h2 className="font-serif text-2xl font-medium text-ink">
          This is your life map.
        </h2>
        <p className="mt-2 text-ink-soft">
          Begin with a life area — like Health, Relationships, or Craft. Rate how
          satisfied you feel there, name the values that matter, then connect the
          projects that serve them.
        </p>
        <p className="mt-4 text-sm text-ink-faint">
          Start by naming a life area in the top-left.
        </p>
      </div>
    </div>
  );
}
