import {
  Background,
  Controls,
  Handle,
  Position,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
  type Edge,
  type Node,
  type NodeProps,
} from "@xyflow/react";
import { useEffect, useMemo } from "react";
import "@xyflow/react/dist/style.css";
import type { AttackPath, Graph } from "@/domain/types.ts";
import { cn } from "@/lib/utils";

interface DeskData extends Record<string, unknown> {
  label: string;
  kind: string;
  tierZero: boolean;
  onPath: boolean;
}

function DeskNode({ data }: NodeProps<Node<DeskData, "desk">>) {
  return (
    <div
      className={cn(
        "w-[158px] rounded-lg border bg-card px-2 py-1.5 shadow-sm",
        data.tierZero ? "border-amber-500 bg-amber-50" : "border-border",
        data.onPath && "ring-2 ring-orange-600",
      )}
    >
      <div className="text-[9px] font-medium tracking-wide text-muted-foreground uppercase">
        {data.tierZero ? "Tier Zero · " : ""}
        {data.kind}
      </div>
      <div className="truncate text-xs font-medium">{data.label}</div>
      <Handle type="target" position={Position.Left} className="size-1 border-0 bg-transparent" />
      <Handle type="source" position={Position.Right} className="size-1 border-0 bg-transparent" />
    </div>
  );
}

const nodeTypes = { desk: DeskNode };

const KIND_LABEL: Record<string, string> = {
  user: "User",
  group: "Group",
  computer: "Computer",
  domain: "Domain",
  "entra-user": "Entra user",
  "entra-group": "Entra group",
  tenant: "Tenant",
};

interface PathGraphProps {
  graph: Graph;
  removed: ReadonlySet<string>;
  baselinePaths: AttackPath[];
  activePaths: AttackPath[];
  highlighted: AttackPath | null;
  highlightClosed: boolean;
}

function edgesOn(paths: readonly AttackPath[]): Set<string> {
  const ids = new Set<string>();
  for (const path of paths) for (const id of path.edgeIds) ids.add(id);
  return ids;
}

function GraphCanvas({
  graph,
  removed,
  baselinePaths,
  activePaths,
  highlighted,
  highlightClosed,
}: PathGraphProps) {
  const { fitView } = useReactFlow();
  const baselineEdges = useMemo(() => edgesOn(baselinePaths), [baselinePaths]);
  const activeEdges = useMemo(() => edgesOn(activePaths), [activePaths]);
  const highlightEdges = useMemo(() => new Set(highlighted?.edgeIds ?? []), [highlighted]);
  const highlightNodes = useMemo(() => new Set(highlighted?.nodeIds ?? []), [highlighted]);

  const nodes: Node<DeskData, "desk">[] = graph.nodes.map((item) => {
    const onPath = highlightNodes.has(item.id) && !highlightClosed;
    return {
      id: item.id,
      type: "desk",
      position: { x: item.x, y: item.y },
      data: {
        label: item.name,
        kind: KIND_LABEL[item.kind] ?? item.kind,
        tierZero: item.tierZero,
        onPath,
      },
      style: { opacity: onPath || item.tierZero ? 1 : 0.28 },
      draggable: false,
      connectable: false,
    };
  });

  const flowEdges: Edge[] = graph.edges.map((item) => {
    const onHighlight = highlightEdges.has(item.id);
    const closed = baselineEdges.has(item.id) && !activeEdges.has(item.id);
    const structural = item.kind === "MemberOf" || item.kind === "SyncedTo";
    return {
      id: item.id,
      source: item.source,
      target: item.target,
      type: "smoothstep",
      label: onHighlight ? item.kind : undefined,
      hidden: removed.has(item.id) || (structural && !onHighlight),
      animated: onHighlight && !highlightClosed,
      style: {
        stroke: onHighlight && !highlightClosed ? "#c2410c" : "#64748b",
        strokeWidth: onHighlight && !highlightClosed ? 2.75 : 1.15,
        opacity: onHighlight && !highlightClosed ? 1 : closed ? 0.12 : 0.22,
      },
      labelStyle: { fontSize: 10, fill: "#9a3412", fontWeight: 600 },
    };
  });

  const focusKey = `${graph.id}:${highlighted?.id ?? "all"}:${highlightClosed ? "closed" : "open"}`;

  useEffect(() => {
    const ids =
      highlighted && highlighted.nodeIds.length > 0
        ? highlighted.nodeIds
        : graph.nodes.filter((item) => item.tierZero).map((item) => item.id);
    const timer = window.setTimeout(() => {
      void fitView({
        nodes: nodes.filter((node) => ids.includes(node.id)),
        padding: 0.4,
        duration: 220,
      });
    }, 40);
    return () => window.clearTimeout(timer);
    // Refit when the selected path or snapshot changes, not on every node identity.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusKey, fitView]);

  return (
    <ReactFlow
      nodes={nodes}
      edges={flowEdges}
      nodeTypes={nodeTypes}
      fitView
      minZoom={0.15}
      maxZoom={1.5}
      nodesDraggable={false}
      nodesConnectable={false}
      elementsSelectable={false}
      panOnScroll
      proOptions={{ hideAttribution: false }}
    >
      <Background gap={18} color="#e7e5e4" />
      <Controls showInteractive={false} position="bottom-right" />
    </ReactFlow>
  );
}

export function PathGraph(props: PathGraphProps) {
  return (
    <div className="path-graph relative h-full min-h-0" data-testid="path-graph">
      <div className="pointer-events-none absolute bottom-3 left-3 z-10 flex gap-1 text-[10px]">
        <span className="rounded-full border border-amber-500 bg-amber-50 px-2 py-0.5">Tier Zero</span>
        <span className="rounded-full bg-orange-600 px-2 py-0.5 text-white">Highlighted path</span>
        <span className="rounded-full bg-slate-200 px-2 py-0.5 text-slate-600">Closed</span>
      </div>
      {props.highlightClosed ? (
        <p className="absolute bottom-3 left-3 z-10 rounded-md bg-card px-2 py-1 text-xs font-medium ring-1 ring-foreground/10">
          This path is closed by a selected fix.
        </p>
      ) : null}
      <ReactFlowProvider>
        <div className="h-full w-full">
          <GraphCanvas {...props} />
        </div>
      </ReactFlowProvider>
    </div>
  );
}
