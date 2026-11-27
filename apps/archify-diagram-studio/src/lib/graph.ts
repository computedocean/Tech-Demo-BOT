import type { ArchEdge, ArchNode, ArchPath, Diagram } from "./types.ts"

export function nodeById(diagram: Diagram, id: string): ArchNode | undefined {
  return diagram.nodes.find((node) => node.id === id)
}

export function edgeBetween(edges: ArchEdge[], from: string, to: string): ArchEdge | undefined {
  return edges.find((edge) => edge.from === from && edge.to === to)
}

export function routeEdgeIds(nodeIds: string[], edges: ArchEdge[]): string[] | null {
  if (nodeIds.length < 2) return null
  const ids: string[] = []
  for (let index = 0; index < nodeIds.length - 1; index += 1) {
    const from = nodeIds[index]
    const to = nodeIds[index + 1]
    if (!from || !to) return null
    const edge = edgeBetween(edges, from, to)
    if (!edge) return null
    ids.push(edge.id)
  }
  return ids
}

export function withRoutedPaths(paths: ArchPath[], edges: ArchEdge[]): ArchPath[] | null {
  const next: ArchPath[] = []
  for (const path of paths) {
    const edgeIds = routeEdgeIds(path.nodeIds, edges)
    if (!edgeIds) return null
    next.push({ ...path, edgeIds })
  }
  return next
}

export function spliceHop(nodeIds: string[], from: string, to: string, inserted: string): string[] {
  const next = [...nodeIds]
  for (let index = 0; index < next.length - 1; index += 1) {
    if (next[index] === from && next[index + 1] === to) {
      next.splice(index + 1, 0, inserted)
      index += 1
    }
  }
  return next
}

function unique(ids: string[]): boolean {
  return new Set(ids).size === ids.length
}

export function assertDiagram(diagram: Diagram): void {
  if (!diagram.id || !diagram.title || !diagram.summary) {
    throw new Error("Diagram is missing its title.")
  }
  if (!unique(diagram.nodes.map((node) => node.id))) throw new Error("Node ids must be unique.")
  if (!unique(diagram.edges.map((edge) => edge.id))) throw new Error("Edge ids must be unique.")
  if (!unique(diagram.paths.map((path) => path.id))) throw new Error("Path ids must be unique.")
  const nodeIds = new Set(diagram.nodes.map((node) => node.id))
  for (const node of diagram.nodes) {
    if (!node.name.trim() || !node.role.trim() || !node.detail.trim()) {
      throw new Error(`Node ${node.id} is missing copy.`)
    }
    if (!Number.isFinite(node.x) || !Number.isFinite(node.y)) {
      throw new Error(`Node ${node.id} has a bad position.`)
    }
  }
  for (const edge of diagram.edges) {
    if (!nodeIds.has(edge.from) || !nodeIds.has(edge.to) || edge.from === edge.to) {
      throw new Error(`Edge ${edge.id} is not a directed link between two nodes.`)
    }
    if (!edge.label.trim()) throw new Error(`Edge ${edge.id} is missing a label.`)
  }
  if (diagram.paths.length === 0) throw new Error("Diagram needs a highlightable path.")
  for (const path of diagram.paths) {
    if (path.nodeIds.length < 2 || !path.name.trim() || !path.description.trim()) {
      throw new Error(`Path ${path.id} is incomplete.`)
    }
    if (path.nodeIds.some((id) => !nodeIds.has(id))) {
      throw new Error(`Path ${path.id} names a missing node.`)
    }
    const edgeIds = routeEdgeIds(path.nodeIds, diagram.edges)
    if (!edgeIds) throw new Error(`Path ${path.id} is not a directed route.`)
    if (edgeIds.join("|") !== path.edgeIds.join("|")) {
      throw new Error(`Path ${path.id} does not match its edges.`)
    }
  }
}

export function connections(
  diagram: Diagram,
  nodeId: string,
): { direction: "to" | "from"; label: string; other: ArchNode }[] {
  const rows: { direction: "to" | "from"; label: string; other: ArchNode }[] = []
  for (const edge of diagram.edges) {
    if (edge.from === nodeId) {
      const other = nodeById(diagram, edge.to)
      if (other) rows.push({ direction: "to", label: edge.label, other })
    } else if (edge.to === nodeId) {
      const other = nodeById(diagram, edge.from)
      if (other) rows.push({ direction: "from", label: edge.label, other })
    }
  }
  return rows
}
