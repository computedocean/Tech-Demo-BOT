import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react"
import { Minus, Plus } from "lucide-react"
import { Button } from "@/components/ui/button.tsx"
import { NODE_H, NODE_W, clamp } from "@/lib/geometry.ts"
import { connections, nodeById } from "@/lib/graph.ts"
import type { ArchNode, Diagram, Highlight, NodeKind } from "@/lib/types.ts"

const KIND_LABEL: Record<NodeKind, string> = {
  client: "Client",
  service: "Service",
  database: "Database",
  cache: "Cache",
  queue: "Queue",
  worker: "Worker",
  auth: "Auth",
  bus: "Bus",
}

const KIND_INK: Record<NodeKind, string> = {
  client: "#3c4654",
  service: "#1d4e73",
  database: "#3c5a42",
  cache: "#8d4e2e",
  queue: "#5b3e68",
  worker: "#1c5c56",
  auth: "#6d3144",
  bus: "#3a4d78",
}

const HIGHLIGHT = "#c45c26"
const INK = "#1c2430"
const PAPER = "#fbf8f2"
const MUTED = "#5e584e"

type View = { x: number; y: number; scale: number }

type Drag = {
  pointerId: number
  x: number
  y: number
  vx: number
  vy: number
  moved: boolean
}

function center(node: ArchNode): { x: number; y: number } {
  return { x: node.x + NODE_W / 2, y: node.y + NODE_H / 2 }
}

function borderPoint(node: ArchNode, towardX: number, towardY: number): { x: number; y: number } {
  const origin = center(node)
  const dx = towardX - origin.x
  const dy = towardY - origin.y
  if (dx === 0 && dy === 0) return origin
  const scaleX = dx === 0 ? Number.POSITIVE_INFINITY : NODE_W / 2 / Math.abs(dx)
  const scaleY = dy === 0 ? Number.POSITIVE_INFINITY : NODE_H / 2 / Math.abs(dy)
  const scale = Math.min(scaleX, scaleY)
  return { x: origin.x + dx * scale, y: origin.y + dy * scale }
}

function cubicPoint(p0: number, p1: number, p2: number, p3: number): number {
  return 0.125 * p0 + 0.375 * p1 + 0.375 * p2 + 0.125 * p3
}

function fitView(nodes: ArchNode[], width: number, height: number): View {
  const minX = Math.min(...nodes.map((node) => node.x)) - 48
  const minY = Math.min(...nodes.map((node) => node.y)) - 48
  const maxX = Math.max(...nodes.map((node) => node.x + NODE_W)) + 48
  const maxY = Math.max(...nodes.map((node) => node.y + NODE_H)) + 48
  const boundsW = Math.max(1, maxX - minX)
  const boundsH = Math.max(1, maxY - minY)
  const scale = clamp(Math.min(width / boundsW, height / boundsH), 0.4, 1.25)
  return {
    scale,
    x: (width - boundsW * scale) / 2 - minX * scale,
    y: (height - boundsH * scale) / 2 - minY * scale,
  }
}

export function DiagramCanvas({
  diagram,
  highlight,
  selectedId,
  onSelect,
  onEscape,
}: {
  diagram: Diagram | null
  highlight: Highlight
  selectedId: string | null
  onSelect: (id: string | null) => void
  onEscape: () => void
}) {
  const svgRef = useRef<SVGSVGElement | null>(null)
  const viewRef = useRef<View>({ x: 48, y: 48, scale: 1 })
  const dragRef = useRef<Drag | null>(null)
  const [view, setView] = useState<View>({ x: 48, y: 48, scale: 1 })
  const [dragging, setDragging] = useState(false)

  function commitView(next: View) {
    viewRef.current = next
    setView(next)
  }

  function fit() {
    const svg = svgRef.current
    if (!svg || !diagram || diagram.nodes.length === 0) return
    const bounds = svg.getBoundingClientRect()
    if (bounds.width < 40 || bounds.height < 40) return
    commitView(fitView(diagram.nodes, bounds.width, bounds.height))
  }

  useLayoutEffect(() => {
    if (!diagram) return
    const frame = requestAnimationFrame(() => fit())
    return () => cancelAnimationFrame(frame)
    // Fit when the graph structure changes. Pan and zoom stay under the user after that.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [diagram?.id, diagram?.nodes.length, diagram?.edges.length])

  useEffect(() => {
    const svg = svgRef.current
    if (!svg) return
    const onWheel = (event: WheelEvent) => {
      event.preventDefault()
      const rect = svg.getBoundingClientRect()
      const px = event.clientX - rect.left
      const py = event.clientY - rect.top
      const current = viewRef.current
      const factor = event.deltaY < 0 ? 1.08 : 0.92
      const next = clamp(current.scale * factor, 0.4, 2.5)
      const ratio = next / current.scale
      const nextView = {
        scale: next,
        x: px - (px - current.x) * ratio,
        y: py - (py - current.y) * ratio,
      }
      viewRef.current = nextView
      setView(nextView)
    }
    svg.addEventListener("wheel", onWheel, { passive: false })
    return () => svg.removeEventListener("wheel", onWheel)
  }, [diagram?.id])

  function zoomBy(factor: number) {
    const svg = svgRef.current
    const current = viewRef.current
    const bounds = svg?.getBoundingClientRect()
    const px = (bounds?.width ?? 0) / 2
    const py = (bounds?.height ?? 0) / 2
    const next = clamp(current.scale * factor, 0.4, 2.5)
    const ratio = next / current.scale
    const nextView = {
      scale: next,
      x: px - (px - current.x) * ratio,
      y: py - (py - current.y) * ratio,
    }
    commitView(nextView)
  }

  function onKeyDown(event: ReactKeyboardEvent<HTMLElement>) {
    if (event.key === "ArrowLeft") {
      event.preventDefault()
      commitView({ ...viewRef.current, x: viewRef.current.x + 48 })
    } else if (event.key === "ArrowRight") {
      event.preventDefault()
      commitView({ ...viewRef.current, x: viewRef.current.x - 48 })
    } else if (event.key === "ArrowUp") {
      event.preventDefault()
      commitView({ ...viewRef.current, y: viewRef.current.y + 48 })
    } else if (event.key === "ArrowDown") {
      event.preventDefault()
      commitView({ ...viewRef.current, y: viewRef.current.y - 48 })
    } else if (event.key === "+" || event.key === "=") {
      event.preventDefault()
      zoomBy(1.12)
    } else if (event.key === "-" || event.key === "_") {
      event.preventDefault()
      zoomBy(1 / 1.12)
    } else if (event.key === "0") {
      event.preventDefault()
      fit()
    } else if (event.key === "Escape") {
      event.preventDefault()
      onEscape()
    }
  }

  const highlighted = highlight.pathId !== null
  const activePath = diagram?.paths.find((path) => path.id === highlight.pathId) ?? null
  const selected = diagram && selectedId ? nodeById(diagram, selectedId) : undefined

  return (
    <section
      aria-label="Architecture diagram"
      tabIndex={0}
      onKeyDown={onKeyDown}
      className="flex h-full min-h-[32rem] flex-col outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
    >
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-2.5">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{diagram ? diagram.title : "No diagram yet"}</p>
          <p className="text-xs text-muted-foreground">
            {diagram
              ? `${diagram.nodes.length} nodes · ${diagram.edges.length} edges`
              : "Drag empty space to pan. Scroll or use the keys to zoom."}
          </p>
        </div>
        <div className="flex items-center gap-1">
          <Button type="button" size="icon" variant="outline" aria-label="Zoom out" onClick={() => zoomBy(1 / 1.15)}>
            <Minus />
          </Button>
          <span data-testid="zoom-level" className="w-12 text-center text-xs tabular-nums text-muted-foreground">
            {Math.round(view.scale * 100)}%
          </span>
          <Button type="button" size="icon" variant="outline" aria-label="Zoom in" onClick={() => zoomBy(1.15)}>
            <Plus />
          </Button>
          <Button type="button" size="sm" variant="outline" onClick={fit}>
            Fit diagram
          </Button>
          <Button type="button" size="sm" variant="ghost" onClick={() => commitView({ x: 48, y: 36, scale: 1 })}>
            Reset view
          </Button>
        </div>
      </div>
      {activePath ? (
        <div data-testid="highlighted-path" className="border-b border-[#e4cbb6] bg-[#f6e6d8] px-4 py-2 text-sm text-[#6a3b22]">
          <span className="font-medium">Highlighting {activePath.name}.</span> {activePath.description}
        </div>
      ) : null}
      <div className="relative min-h-0 flex-1">
        {diagram ? (
          <svg
            ref={svgRef}
            data-testid="canvas"
            className="studio-canvas h-full w-full touch-none"
            style={{ cursor: dragging ? "grabbing" : "grab" }}
            onPointerDown={(event) => {
              const target = event.target as Element
              if (target.closest("[data-node]")) return
              dragRef.current = {
                pointerId: event.pointerId,
                x: event.clientX,
                y: event.clientY,
                vx: viewRef.current.x,
                vy: viewRef.current.y,
                moved: false,
              }
              setDragging(true)
              event.currentTarget.setPointerCapture(event.pointerId)
            }}
            onPointerMove={(event) => {
              const drag = dragRef.current
              if (!drag || drag.pointerId !== event.pointerId) return
              const dx = event.clientX - drag.x
              const dy = event.clientY - drag.y
              if (Math.hypot(dx, dy) > 3) drag.moved = true
              const nextView = { x: drag.vx + dx, y: drag.vy + dy, scale: viewRef.current.scale }
              viewRef.current = nextView
              setView(nextView)
            }}
            onPointerUp={(event) => {
              const drag = dragRef.current
              dragRef.current = null
              setDragging(false)
              if (!drag || drag.pointerId !== event.pointerId || drag.moved) return
              onSelect(null)
            }}
            onPointerCancel={() => {
              dragRef.current = null
              setDragging(false)
            }}
          >
            <defs>
              <marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
                <path d="M 0 1.2 L 9 5 L 0 8.8 Z" fill="#5c564c" />
              </marker>
              <marker id="arrow-hot" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
                <path d="M 0 1.2 L 9 5 L 0 8.8 Z" fill={HIGHLIGHT} />
              </marker>
            </defs>
            <g transform={`translate(${view.x} ${view.y}) scale(${view.scale})`}>
              {diagram.edges.map((edge) => {
                const from = nodeById(diagram, edge.from)
                const to = nodeById(diagram, edge.to)
                if (!from || !to) return null
                const fromCenter = center(from)
                const toCenter = center(to)
                const start = borderPoint(from, toCenter.x, toCenter.y)
                const end = borderPoint(to, fromCenter.x, fromCenter.y)
                const c1x = start.x + (end.x - start.x) * 0.5
                const c2x = end.x - (end.x - start.x) * 0.5
                const hot = highlight.edgeIds.includes(edge.id)
                const midX = cubicPoint(start.x, c1x, c2x, end.x)
                const midY = cubicPoint(start.y, start.y, end.y, end.y)
                return (
                  <g key={edge.id} opacity={highlighted && !hot ? 0.28 : 1}>
                    <path
                      d={`M ${start.x} ${start.y} C ${c1x} ${start.y}, ${c2x} ${end.y}, ${end.x} ${end.y}`}
                      fill="none"
                      stroke={hot ? HIGHLIGHT : "#6d675c"}
                      strokeWidth={hot ? 2.6 : 1.4}
                      markerEnd={hot ? "url(#arrow-hot)" : "url(#arrow)"}
                    />
                    <text
                      x={midX}
                      y={midY - 8}
                      textAnchor="middle"
                      fontSize="12"
                      fill={hot ? HIGHLIGHT : MUTED}
                      stroke="#ebe4d4"
                      strokeWidth="4"
                      paintOrder="stroke"
                      style={{ fontFamily: "Geist Variable, sans-serif" }}
                    >
                      {edge.label}
                    </text>
                  </g>
                )
              })}
              {diagram.nodes.map((node) => {
                const hot = highlight.nodeIds.includes(node.id)
                const selectedNode = node.id === selectedId
                const ink = KIND_INK[node.kind]
                return (
                  <g
                    key={node.id}
                    data-node={node.id}
                    role="button"
                    tabIndex={0}
                    aria-label={node.name}
                    aria-pressed={selectedNode}
                    transform={`translate(${node.x} ${node.y})`}
                    opacity={highlighted && !hot ? 0.38 : 1}
                    style={{ cursor: "pointer" }}
                    onPointerDown={(event) => event.stopPropagation()}
                    onClick={(event) => {
                      event.stopPropagation()
                      onSelect(node.id)
                    }}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault()
                        event.stopPropagation()
                        onSelect(node.id)
                      }
                    }}
                  >
                    <rect
                      width={NODE_W}
                      height={NODE_H}
                      rx="12"
                      fill={PAPER}
                      stroke={hot ? HIGHLIGHT : selectedNode ? INK : "#d5cec2"}
                      strokeWidth={hot || selectedNode ? 2.4 : 1.2}
                    />
                    <rect width={NODE_W} height="7" rx="3" fill={ink} />
                    <text x="16" y="32" fill={ink} fontSize="10" style={{ letterSpacing: "0.14em", fontFamily: "Geist Variable, sans-serif" }}>
                      {KIND_LABEL[node.kind].toUpperCase()}
                    </text>
                    <text x="16" y="54" fill={INK} fontSize="16" fontWeight="650" style={{ fontFamily: "Geist Variable, sans-serif" }}>
                      {node.name}
                    </text>
                    <text x="16" y="74" fill={MUTED} fontSize="12" style={{ fontFamily: "Geist Variable, sans-serif" }}>
                      {node.role}
                    </text>
                  </g>
                )
              })}
            </g>
          </svg>
        ) : (
          <div className="studio-canvas flex h-full items-center justify-center px-8 text-center">
            <div className="max-w-md">
              <p className="font-display text-3xl text-foreground">Nothing drawn yet</p>
              <p className="mt-2 text-sm text-muted-foreground">
                Pick a preset or describe a system. Pan, zoom, and later edits stay on this diagram.
              </p>
            </div>
          </div>
        )}
        {diagram && selected ? (
          <aside
            data-testid="node-details"
            aria-label="Node details"
            className="absolute top-3 right-3 w-[min(20rem,calc(100%-1.5rem))] rounded-xl bg-card/95 p-4 shadow-lg ring-1 ring-foreground/10 backdrop-blur-sm"
          >
            <p className="text-[11px] font-medium tracking-[0.14em] text-muted-foreground uppercase">
              {KIND_LABEL[selected.kind]}
            </p>
            <h2 className="mt-1 font-display text-2xl leading-none">{selected.name}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{selected.role}</p>
            <p className="mt-3 text-sm leading-relaxed">{selected.detail}</p>
            <h3 className="mt-4 text-xs font-medium tracking-[0.12em] text-muted-foreground uppercase">Connections</h3>
            <ul className="mt-2 space-y-1 text-sm">
              {connections(diagram, selected.id).length === 0 ? <li>No connections.</li> : null}
              {connections(diagram, selected.id).map((row) => (
                <li key={`${row.direction}-${row.other.id}-${row.label}`}>
                  {row.direction === "to" ? "To" : "From"} {row.other.name}
                  <span className="text-muted-foreground"> · {row.label}</span>
                </li>
              ))}
            </ul>
          </aside>
        ) : null}
      </div>
    </section>
  )
}
