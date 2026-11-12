import {
  BaseEdge,
  EdgeLabelRenderer,
  type Edge,
  type EdgeProps,
  getSmoothStepPath,
} from '@xyflow/react'
import { DEFAULT_EDGE_COLOR } from '@/canvas/colors.ts'
import type { FlowEdgeData } from '@/canvas/flow.ts'

export function CanvasEdgeView(props: EdgeProps<Edge<FlowEdgeData>>) {
  const [path, labelX, labelY] = getSmoothStepPath({
    sourceX: props.sourceX,
    sourceY: props.sourceY,
    sourcePosition: props.sourcePosition,
    targetX: props.targetX,
    targetY: props.targetY,
    targetPosition: props.targetPosition,
    borderRadius: 8,
  })
  const color = props.data?.color ?? DEFAULT_EDGE_COLOR
  const label = props.data?.label

  return (
    <>
      <BaseEdge
        id={props.id}
        path={path}
        interactionWidth={20}
        markerStart={props.markerStart}
        markerEnd={props.markerEnd}
        style={{ stroke: color, strokeWidth: props.selected ? 2.5 : 1.6 }}
      />
      {label ? (
        <EdgeLabelRenderer>
          <div
            style={{
              transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
              borderColor: color,
            }}
            className="nodrag nopan absolute rounded-full border bg-background px-1.5 py-0.5 text-[11px] font-medium shadow-sm"
          >
            {label}
          </div>
        </EdgeLabelRenderer>
      ) : null}
    </>
  )
}
