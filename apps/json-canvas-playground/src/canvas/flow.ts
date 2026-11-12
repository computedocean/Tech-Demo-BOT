import { MarkerType, type Edge, type EdgeChange, type Node, type NodeChange } from '@xyflow/react'
import { DEFAULT_EDGE_COLOR, resolveColor } from './colors.ts'
import { assemble, effectiveEnd, inferSides } from './document.ts'
import type { CanvasFile, Side } from './types.ts'
import { canonicalizeNode } from './validate.ts'

export type FlowNodeData = {
  [key: string]: unknown
  color?: string
  text?: string
  file?: string
  subpath?: string
  url?: string
  label?: string
  background?: string
  backgroundStyle?: string
}

export type FlowEdgeData = {
  [key: string]: unknown
  label?: string
  color: string
  fromEnd: 'none' | 'arrow'
  toEnd: 'none' | 'arrow'
}

const SIDES = new Set<Side>(['top', 'right', 'bottom', 'left'])

export function isSide(value: string | null | undefined): value is Side {
  return value !== null && value !== undefined && SIDES.has(value as Side)
}

export function toFlowNodes(doc: CanvasFile, selectedId: string | null): Node<FlowNodeData>[] {
  return (doc.nodes ?? []).map((node, index) => {
    const data: FlowNodeData = {}
    if (node.color !== undefined) data.color = node.color
    if (node.type === 'text') data.text = node.text
    if (node.type === 'file') {
      data.file = node.file
      if (node.subpath !== undefined) data.subpath = node.subpath
    }
    if (node.type === 'link') data.url = node.url
    if (node.type === 'group') {
      if (node.label !== undefined) data.label = node.label
      if (node.background !== undefined) data.background = node.background
      if (node.backgroundStyle !== undefined) data.backgroundStyle = node.backgroundStyle
    }
    return {
      id: node.id,
      type: node.type,
      position: { x: node.x, y: node.y },
      width: node.width,
      height: node.height,
      zIndex: index,
      selected: selectedId === node.id,
      data,
      style: { width: node.width, height: node.height },
    }
  })
}

export function toFlowEdges(doc: CanvasFile, selectedId: string | null): Edge<FlowEdgeData>[] {
  const nodes = doc.nodes ?? []
  const byId = new Map(nodes.map((node) => [node.id, node]))
  const edges: Edge<FlowEdgeData>[] = []
  for (const edge of doc.edges ?? []) {
    const from = byId.get(edge.fromNode)
    const to = byId.get(edge.toNode)
    if (!from || !to) continue
    const inferred = inferSides(from, to)
    const fromEnd = effectiveEnd(edge, 'fromEnd')
    const toEnd = effectiveEnd(edge, 'toEnd')
    const color = resolveColor(edge.color, DEFAULT_EDGE_COLOR)
    const arrow = { type: MarkerType.ArrowClosed, color, width: 18, height: 18 }
    edges.push({
      id: edge.id,
      type: 'canvas',
      source: edge.fromNode,
      target: edge.toNode,
      sourceHandle: edge.fromSide ?? inferred.fromSide,
      targetHandle: edge.toSide ?? inferred.toSide,
      selected: selectedId === edge.id,
      ...(fromEnd === 'arrow' ? { markerStart: arrow } : {}),
      ...(toEnd === 'arrow' ? { markerEnd: arrow } : {}),
      data: {
        ...(edge.label !== undefined ? { label: edge.label } : {}),
        color,
        fromEnd,
        toEnd,
      },
    })
  }
  return edges
}

export function applyNodeChanges(doc: CanvasFile, changes: NodeChange[]): CanvasFile | null {
  let nodes = [...(doc.nodes ?? [])]
  let edges = doc.edges ? [...doc.edges] : undefined
  let changed = false

  for (const change of changes) {
    if (change.type === 'position' && change.position) {
      const index = nodes.findIndex((node) => node.id === change.id)
      const current = nodes[index]
      if (!current) continue
      const x = Math.round(change.position.x)
      const y = Math.round(change.position.y)
      if (current.x === x && current.y === y) continue
      nodes[index] = canonicalizeNode({ ...current, x, y })
      changed = true
      continue
    }
    if (change.type === 'dimensions' && change.resizing !== undefined && change.dimensions) {
      const index = nodes.findIndex((node) => node.id === change.id)
      const current = nodes[index]
      if (!current) continue
      const width = Math.round(change.dimensions.width)
      const height = Math.round(change.dimensions.height)
      if (current.width === width && current.height === height) continue
      nodes[index] = canonicalizeNode({ ...current, width, height })
      changed = true
      continue
    }
    if (change.type === 'remove') {
      const nextNodes = nodes.filter((node) => node.id !== change.id)
      if (nextNodes.length === nodes.length) continue
      nodes = nextNodes
      if (edges) {
        edges = edges.filter((edge) => edge.fromNode !== change.id && edge.toNode !== change.id)
      }
      changed = true
    }
  }

  if (!changed) return null
  return assemble(doc.nodes !== undefined ? nodes : undefined, edges)
}

export function applyEdgeChanges(doc: CanvasFile, changes: EdgeChange[]): CanvasFile | null {
  if (!doc.edges) return null
  let edges = [...doc.edges]
  let changed = false
  for (const change of changes) {
    if (change.type !== 'remove') continue
    const next = edges.filter((edge) => edge.id !== change.id)
    if (next.length === edges.length) continue
    edges = next
    changed = true
  }
  if (!changed) return null
  return assemble(doc.nodes, edges)
}
