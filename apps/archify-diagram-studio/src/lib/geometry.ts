import type { ArchNode } from "./types.ts"

export const NODE_W = 188
export const NODE_H = 92

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

export function overlaps(point: { x: number; y: number }, nodes: ArchNode[]): boolean {
  return nodes.some((node) => {
    return Math.abs(node.x - point.x) < NODE_W + 16 && Math.abs(node.y - point.y) < NODE_H + 16
  })
}

export function placeBetween(source: ArchNode, target: ArchNode, nodes: ArchNode[]): { x: number; y: number } {
  const midX = (source.x + target.x) / 2
  const above = Math.min(source.y, target.y) - 156
  const below = Math.max(source.y, target.y) + 148
  const candidates = [
    { x: midX, y: above },
    { x: midX, y: below },
    { x: Math.max(source.x, target.x) + 28, y: above },
    { x: Math.min(source.x, target.x) - 28, y: below },
  ]
  for (const candidate of candidates) {
    const point = { x: Math.round(candidate.x), y: Math.round(Math.max(28, candidate.y)) }
    if (!overlaps(point, nodes)) return point
  }
  return { x: Math.round(midX), y: Math.round(Math.max(28, above)) }
}
