import { routeEdgeIds } from "./graph.ts"
import type { Diagram, Highlight, HighlightResult } from "./types.ts"

export function clearHighlight(): Highlight {
  return { pathId: null, nodeIds: [], edgeIds: [] }
}

export function highlightPath(diagram: Diagram, pathId: string): HighlightResult {
  const path = diagram.paths.find((item) => item.id === pathId)
  if (!path) return { ok: false, error: "This diagram has no path with that id." }
  const edgeIds = routeEdgeIds(path.nodeIds, diagram.edges)
  if (!edgeIds) return { ok: false, error: "That path is not a directed route on this diagram." }
  return {
    ok: true,
    highlight: { pathId: path.id, nodeIds: [...path.nodeIds], edgeIds },
  }
}
