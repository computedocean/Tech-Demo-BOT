import { Handle, NodeResizer, Position, type NodeProps } from '@xyflow/react'
import { FileText, Link } from 'lucide-react'
import { useContext, type ReactNode } from 'react'
import { CanvasLockContext } from './canvas-lock.ts'
import { DEFAULT_NODE_COLOR, resolveColor } from '@/canvas/colors.ts'
import { cn } from '@/lib/utils.ts'
import { MarkdownText } from './markdown.tsx'

const SIDES = [
  ['top', Position.Top],
  ['right', Position.Right],
  ['bottom', Position.Bottom],
  ['left', Position.Left],
] as const

function SideHandles() {
  return (
    <>
      {SIDES.map(([id, position]) => (
        <Handle
          key={id}
          id={id}
          type="source"
          position={position}
          isConnectable
          className="!border-foreground !bg-background"
        />
      ))}
    </>
  )
}

function NodeFrame({
  selected,
  color,
  minWidth,
  minHeight,
  dashed,
  fill,
  children,
}: {
  selected?: boolean
  color: string
  minWidth: number
  minHeight: number
  dashed?: boolean
  fill?: string
  children: ReactNode
}) {
  const locked = useContext(CanvasLockContext)
  return (
    <div className="relative h-full w-full">
      <NodeResizer
        isVisible={Boolean(selected) && !locked}
        minWidth={minWidth}
        minHeight={minHeight}
        color={color}
      />
      <SideHandles />
      <div
        className={cn(
          'h-full w-full overflow-hidden border bg-card text-card-foreground shadow-sm',
          dashed ? 'rounded-lg border-dashed' : 'rounded-md',
          selected && 'ring-2 ring-primary/40',
        )}
        style={{ borderColor: color, backgroundColor: fill }}
      >
        {children}
      </div>
    </div>
  )
}

function nodeColor(data: Record<string, unknown>): string {
  return resolveColor(typeof data.color === 'string' ? data.color : undefined, DEFAULT_NODE_COLOR)
}

export function TextNodeView({ data, selected }: NodeProps) {
  const color = nodeColor(data)
  return (
    <NodeFrame selected={selected} color={color} minWidth={120} minHeight={64}>
      <div className="h-full overflow-auto p-3">
        <MarkdownText text={typeof data.text === 'string' ? data.text : ''} />
      </div>
    </NodeFrame>
  )
}

export function FileNodeView({ data, selected }: NodeProps) {
  const color = nodeColor(data)
  const file = typeof data.file === 'string' ? data.file : ''
  const subpath = typeof data.subpath === 'string' ? data.subpath : ''
  return (
    <NodeFrame selected={selected} color={color} minWidth={140} minHeight={72}>
      <div className="flex h-full flex-col gap-1 p-3">
        <div className="flex items-center gap-1.5 text-[10px] font-medium tracking-wider text-muted-foreground uppercase">
          <FileText className="size-3" />
          File
        </div>
        <div className="truncate text-sm font-medium">{file}</div>
        {subpath ? <div className="truncate font-mono text-xs text-muted-foreground">{subpath}</div> : null}
        <div className="mt-auto text-[10px] text-muted-foreground">Path only · not opened</div>
      </div>
    </NodeFrame>
  )
}

export function LinkNodeView({ data, selected }: NodeProps) {
  const color = nodeColor(data)
  const url = typeof data.url === 'string' ? data.url : ''
  return (
    <NodeFrame selected={selected} color={color} minWidth={140} minHeight={64}>
      <div className="flex h-full flex-col gap-1 p-3">
        <div className="flex items-center gap-1.5 text-[10px] font-medium tracking-wider text-muted-foreground uppercase">
          <Link className="size-3" />
          Link
        </div>
        <div className="text-sm font-medium break-all">{url}</div>
        <div className="mt-auto text-[10px] text-muted-foreground">URL only · not fetched</div>
      </div>
    </NodeFrame>
  )
}

export function GroupNodeView({ data, selected }: NodeProps) {
  const color = nodeColor(data)
  const label = typeof data.label === 'string' ? data.label : ''
  const background = typeof data.background === 'string' ? data.background : ''
  const backgroundStyle = typeof data.backgroundStyle === 'string' ? data.backgroundStyle : ''
  return (
    <NodeFrame
      selected={selected}
      color={color}
      minWidth={180}
      minHeight={120}
      dashed
      fill={`color-mix(in srgb, ${color} 10%, transparent)`}
    >
      <div className="relative flex h-full flex-col">
        <div
          className="flex items-center justify-between gap-2 border-b border-dashed px-2.5 py-1"
          style={{ borderColor: color }}
        >
          <span className="truncate text-xs font-medium">{label || 'Group'}</span>
          <span className="text-[10px] tracking-wide text-muted-foreground uppercase">Group</span>
        </div>
        {background ? (
          <div className="pointer-events-none relative min-h-8 flex-1">
            {backgroundStyle === 'repeat' ? (
              <div
                className="absolute inset-0 opacity-50"
                style={{
                  backgroundImage:
                    'repeating-linear-gradient(45deg, transparent, transparent 7px, currentColor 7px, currentColor 8px)',
                }}
              />
            ) : null}
            {backgroundStyle === 'cover' ? (
              <div className="absolute inset-0 bg-[color-mix(in_srgb,currentColor_16%,transparent)]" />
            ) : null}
            {backgroundStyle === 'ratio' ? (
              <div className="absolute inset-3 border border-dashed border-current opacity-50" />
            ) : null}
            <div className="absolute right-2 bottom-2 max-w-[90%] truncate rounded bg-background/90 px-1.5 py-0.5 text-[10px] text-muted-foreground">
              {backgroundStyle || 'background'} · {background} · not loaded
            </div>
          </div>
        ) : (
          <div className="flex-1" />
        )}
      </div>
    </NodeFrame>
  )
}
