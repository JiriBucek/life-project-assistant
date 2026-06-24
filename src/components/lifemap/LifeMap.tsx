"use client";

import { useCallback, useMemo, useRef, useState, useTransition } from "react";
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
  areas,
  projects,
  summary,
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

  const run = useCallback(
    (fn: () => Promise<unknown> | unknown) => startTransition(() => void fn()),
    [],
  );

  const handlers: LifeMapHandlers = useMemo(
    () => ({
      pending,
      connecting: connectingFromValue,
      updateArea: (id, data) => run(() => actions.updateArea(id, data)),
      deleteArea: (id) => run(() => actions.deleteArea(id)),
      createValue: (areaId, name) => run(() => actions.createValue(areaId, name)),
      updateValue: (id, name) => run(() => actions.updateValue(id, name)),
      deleteValue: (id) => run(() => actions.deleteValue(id)),
      deleteProject: (id) => run(() => actions.deleteProject(id)),
      disconnectValue: (projectId, valueId) => {
        const p = projects.find((pr) => pr.id === projectId);
        if (!p) return;
        run(() =>
          actions.updateProject(projectId, {
            valueIds: p.valueIds.filter((v) => v !== valueId),
          }),
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
    [pending, connectingFromValue, projects, run],
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
      run(() =>
        actions.updateProject(project.id, {
          valueIds: [...project.valueIds, valueId],
        }),
      );
    },
    [projects, run],
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
      run(() =>
        actions.updateProject(draft.id!, {
          name: draft.name,
          whyStatement: draft.whyStatement,
          valueIds: draft.valueIds,
        }),
      );
    } else {
      run(() =>
        actions.createProject({
          name: draft.name,
          whyStatement: draft.whyStatement,
          valueIds: draft.valueIds,
        }),
      );
    }
    setDialog({ open: false });
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
              if (e.key === "Enter" && newAreaName.trim()) {
                run(() => actions.createArea(newAreaName));
                setNewAreaName("");
              }
            }}
            placeholder="Name a life area…"
            className="w-44 bg-transparent text-sm text-ink placeholder:text-ink-faint focus:outline-none"
          />
          <Button
            variant="soft"
            disabled={!newAreaName.trim()}
            onClick={() => {
              if (newAreaName.trim()) {
                run(() => actions.createArea(newAreaName));
                setNewAreaName("");
              }
            }}
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
