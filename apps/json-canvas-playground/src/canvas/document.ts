import type {
  CanvasEdge,
  CanvasFile,
  CanvasNode,
  End,
  NodeType,
  Side,
} from './types.ts'
import { canonicalizeEdge, canonicalizeNode } from './validate.ts'

export type StackMove = 'forward' | 'backward' | 'front' | 'back'

const DEFAULT_SIZE: Record<NodeType, { width: number; height: number }> = {
  text: { width: 240, height: 140 },
  file: { width: 220, height: 100 },
  link: { width: 240, height: 88 },
  group: { width: 420, height: 280 },
}

export function defaultSize(type: NodeType): { width: number; height: number } {
  return DEFAULT_SIZE[type]
}

export function usedIds(doc: CanvasFile): Set<string> {
  const ids = new Set<string>()
  for (const node of doc.nodes ?? []) ids.add(node.id)
  for (const edge of doc.edges ?? []) ids.add(edge.id)
  return ids
}

export function newId(used: Iterable<string>): string {
  const taken = new Set(used)
  let id = ''
  do {
    id = crypto.randomUUID().replaceAll('-', '').slice(0, 16)
  } while (taken.has(id))
  return id
}

export function createNode(type: NodeType, x: number, y: number, used: Iterable<string>): CanvasNode {
  const id = newId(used)
  const { width, height } = DEFAULT_SIZE[type]
  if (type === 'text') {
    return canonicalizeNode({ id, type, text: 'New note', x, y, width, height })
  }
  if (type === 'file') {
    return canonicalizeNode({ id, type, file: 'notes.md', x, y, width, height })
  }
  if (type === 'link') {
    return canonicalizeNode({
      id,
      type,
      url: 'https://jsoncanvas.org/spec/1.0/',
      x,
      y,
      width,
      height,
    })
  }
  return canonicalizeNode({ id, type, label: 'Group', x, y, width, height })
}

export function assemble(
  nodes: CanvasNode[] | undefined,
  edges: CanvasEdge[] | undefined,
): CanvasFile {
  const doc: CanvasFile = {}
  if (nodes) doc.nodes = nodes
  if (edges) doc.edges = edges
  return doc
}

export function addNode(doc: CanvasFile, node: CanvasNode): CanvasFile {
  return assemble([...(doc.nodes ?? []), canonicalizeNode(node)], doc.edges)
}

export function replaceNode(doc: CanvasFile, id: string, node: CanvasNode): CanvasFile {
  const nodes = (doc.nodes ?? []).map((current) =>
    current.id === id ? canonicalizeNode(node) : current,
  )
  return assemble(doc.nodes ? nodes : undefined, doc.edges)
}

export function removeNode(doc: CanvasFile, id: string): CanvasFile {
  const nodes = (doc.nodes ?? []).filter((node) => node.id !== id)
  const edges = doc.edges?.filter((edge) => edge.fromNode !== id && edge.toNode !== id)
  return assemble(doc.nodes ? nodes : undefined, edges)
}

export function moveNode(doc: CanvasFile, id: string, move: StackMove): CanvasFile {
  const nodes = [...(doc.nodes ?? [])]
  const index = nodes.findIndex((node) => node.id === id)
  const node = nodes[index]
  if (index < 0 || !node) return doc
  nodes.splice(index, 1)
  const target =
    move === 'back'
      ? 0
      : move === 'backward'
        ? Math.max(0, index - 1)
        : move === 'forward'
          ? Math.min(nodes.length, index + 1)
          : nodes.length
  nodes.splice(target, 0, node)
  return assemble(nodes, doc.edges)
}

export function addEdge(doc: CanvasFile, edge: CanvasEdge): CanvasFile {
  return assemble(doc.nodes, [...(doc.edges ?? []), canonicalizeEdge(edge)])
}

export function replaceEdge(doc: CanvasFile, id: string, edge: CanvasEdge): CanvasFile {
  const edges = (doc.edges ?? []).map((current) =>
    current.id === id ? canonicalizeEdge(edge) : current,
  )
  return assemble(doc.nodes, doc.edges ? edges : undefined)
}

export function removeEdge(doc: CanvasFile, id: string): CanvasFile {
  const edges = (doc.edges ?? []).filter((edge) => edge.id !== id)
  return assemble(doc.nodes, doc.edges ? edges : undefined)
}

export function setSide(edge: CanvasEdge, key: 'fromSide' | 'toSide', value: Side | ''): CanvasEdge {
  const next: CanvasEdge = { ...edge }
  if (value === '') delete next[key]
  else next[key] = value
  return canonicalizeEdge(next)
}

export function setEnd(edge: CanvasEdge, key: 'fromEnd' | 'toEnd', value: End): CanvasEdge {
  const next: CanvasEdge = { ...edge }
  const defaultValue = key === 'fromEnd' ? 'none' : 'arrow'
  if (value === defaultValue) delete next[key]
  else next[key] = value
  return canonicalizeEdge(next)
}

export function effectiveEnd(edge: CanvasEdge, key: 'fromEnd' | 'toEnd'): End {
  return edge[key] ?? (key === 'fromEnd' ? 'none' : 'arrow')
}

export function inferSides(
  from: CanvasNode,
  to: CanvasNode,
): { fromSide: Side; toSide: Side } {
  const dx = to.x + to.width / 2 - (from.x + from.width / 2)
  const dy = to.y + to.height / 2 - (from.y + from.height / 2)
  if (Math.abs(dx) >= Math.abs(dy)) {
    return dx >= 0
      ? { fromSide: 'right', toSide: 'left' }
      : { fromSide: 'left', toSide: 'right' }
  }
  return dy >= 0
    ? { fromSide: 'bottom', toSide: 'top' }
    : { fromSide: 'top', toSide: 'bottom' }
}
