import {
  Background,
  ConnectionMode,
  Controls,
  MiniMap,
  ReactFlow,
  applyEdgeChanges as applyRfEdgeChanges,
  applyNodeChanges as applyRfNodeChanges,
  useReactFlow,
  type Connection,
  type Edge,
  type EdgeChange,
  type Node,
  type NodeChange,
} from '@xyflow/react'
import { useCallback, useEffect, useRef, useState } from 'react'
import {
  applyEdgeChanges,
  applyNodeChanges,
  toFlowEdges,
  toFlowNodes,
  type FlowEdgeData,
  type FlowNodeData,
} from '@/canvas/flow.ts'
import type { CanvasFile } from '@/canvas/types.ts'
import { CanvasEdgeView } from './CanvasEdge.tsx'
import { CanvasLockContext } from './canvas-lock.ts'
import type { Selection } from './Inspector.tsx'
import { FileNodeView, GroupNodeView, LinkNodeView, TextNodeView } from './nodes.tsx'

const nodeTypes = {
  text: TextNodeView,
  file: FileNodeView,
  link: LinkNodeView,
  group: GroupNodeView,
}

const edgeTypes = {
  canvas: CanvasEdgeView,
}

function FitOnLoad({ fitKey }: { fitKey: string }) {
  const { fitView } = useReactFlow()
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      void fitView({ padding: 0.2, duration: 180 })
    })
    return () => cancelAnimationFrame(frame)
  }, [fitKey, fitView])
  return null
}

function projectNodeChange(change: NodeChange): boolean {
  if (change.type === 'remove') return true
  if (change.type === 'position') return change.position !== undefined
  if (change.type === 'dimensions') return typeof change.resizing === 'boolean' && change.dimensions !== undefined
  return false
}

export function CanvasStage({
  doc,
  selection,
  fitKey,
  locked,
  holdDraft,
  onMutate,
  onSelect,
  onConnect,
}: {
  doc: CanvasFile
  selection: Selection | null
  fitKey: string
  locked: boolean
  holdDraft: boolean
  onMutate: (updater: (current: CanvasFile) => CanvasFile) => void
  onSelect: (selection: Selection | null) => void
  onConnect: (connection: Connection) => void
}) {
  const [nodes, setNodes] = useState<Node<FlowNodeData>[]>(() => toFlowNodes(doc, null))
  const [edges, setEdges] = useState<Edge<FlowEdgeData>[]>(() => toFlowEdges(doc, null))
  const skipSync = useRef(false)
  const selectionRef = useRef(selection)

  useEffect(() => {
    selectionRef.current = selection
  }, [selection])

  useEffect(() => {
    if (skipSync.current) {
      skipSync.current = false
      return
    }
    const current = selectionRef.current
    setNodes(toFlowNodes(doc, current?.kind === 'node' ? current.id : null))
    setEdges(toFlowEdges(doc, current?.kind === 'edge' ? current.id : null))
  }, [doc])

  const handleNodes = useCallback(
    (changes: NodeChange<Node<FlowNodeData>>[]) => {
      setNodes((current) => applyRfNodeChanges(changes, current))
      const projected = changes.filter(projectNodeChange)
      if (projected.length === 0) return
      onMutate((current) => {
        const next = applyNodeChanges(current, projected)
        if (!next) return current
        skipSync.current = true
        return next
      })
    },
    [onMutate],
  )

  const handleEdges = useCallback(
    (changes: EdgeChange<Edge<FlowEdgeData>>[]) => {
      setEdges((current) => applyRfEdgeChanges(changes, current))
      const projected = changes.filter((change) => change.type === 'remove')
      if (projected.length === 0) return
      onMutate((current) => {
        const next = applyEdgeChanges(current, projected)
        if (!next) return current
        skipSync.current = true
        return next
      })
    },
    [onMutate],
  )

  return (
    <div id="canvas-stage" className="canvas-stage relative h-full min-h-0">
      <CanvasLockContext.Provider value={locked}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={handleNodes}
          onEdgesChange={handleEdges}
          onConnect={onConnect}
          onNodeClick={(_, node) => onSelect({ kind: 'node', id: node.id })}
          onEdgeClick={(_, edge) => onSelect({ kind: 'edge', id: edge.id })}
          onPaneClick={() => onSelect(null)}
          onNodeDragStart={(_, node) => onSelect({ kind: 'node', id: node.id })}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          connectionMode={ConnectionMode.Loose}
          connectionRadius={32}
          elevateNodesOnSelect={false}
          zIndexMode="manual"
          nodesDraggable={!locked}
          nodesConnectable={!locked}
          elementsSelectable={!locked}
          edgesReconnectable={false}
          deleteKeyCode={locked ? null : ['Backspace', 'Delete']}
          selectionOnDrag={false}
          panOnDrag
          zoomOnScroll
          zoomOnDoubleClick={false}
          minZoom={0.15}
          maxZoom={2.5}
          fitView
          colorMode="light"
          proOptions={{ hideAttribution: false }}
          defaultEdgeOptions={{ type: 'canvas' }}
        >
          <FitOnLoad fitKey={fitKey} />
          <Background gap={22} size={1.4} color="#d6d3d1" />
          <Controls showInteractive={false} />
          <MiniMap pannable zoomable maskColor="rgb(28 25 23 / 8%)" className="!bg-background" />
        </ReactFlow>
      </CanvasLockContext.Provider>
      {holdDraft ? (
        <div className="pointer-events-none absolute top-3 left-1/2 z-10 max-w-md -translate-x-1/2 rounded-md border bg-background px-3 py-1.5 text-center text-xs shadow-sm">
          Showing the last valid canvas. Fix the JSON or revert.
        </div>
      ) : null}
    </div>
  )
}
