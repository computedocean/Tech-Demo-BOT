import { ArrowDown, ArrowUp, ChevronsDown, ChevronsUp, Trash2 } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { PRESET_COLORS } from '@/canvas/colors.ts'
import {
  effectiveEnd,
  moveNode,
  removeEdge,
  removeNode,
  replaceEdge,
  replaceNode,
  setEnd,
  setSide,
} from '@/canvas/document.ts'
import type { CanvasFile, CanvasNode, End, Side } from '@/canvas/types.ts'
import { ENDS, PRESET_COLOR_IDS, SIDES } from '@/canvas/types.ts'
import { Button } from '@/components/ui/button.tsx'
import { Input } from '@/components/ui/input.tsx'
import { Label } from '@/components/ui/label.tsx'
import { Textarea } from '@/components/ui/textarea.tsx'

export type Selection = { kind: 'node' | 'edge'; id: string }

const FIELD = 'h-8 text-sm'

export function Inspector({
  doc,
  selection,
  locked,
  onDoc,
}: {
  doc: CanvasFile
  selection: Selection | null
  locked: boolean
  onDoc: (doc: CanvasFile) => void
}) {
  const node = selection?.kind === 'node' ? doc.nodes?.find((item) => item.id === selection.id) : undefined
  const edge = selection?.kind === 'edge' ? doc.edges?.find((item) => item.id === selection.id) : undefined

  if (!node && !edge) {
    return (
      <div className="flex flex-col gap-2 text-sm text-muted-foreground">
        <p>Select a node or an edge.</p>
        <p>Drag a handle to connect two nodes. Scroll to zoom, and drag the background to pan.</p>
      </div>
    )
  }

  if (node) {
    const index = doc.nodes?.findIndex((item) => item.id === node.id) ?? 0
    const count = doc.nodes?.length ?? 0
    return (
      <div className="flex flex-col gap-3">
        <Header
          title={node.type}
          id={node.id}
          onDelete={() => onDoc(removeNode(doc, node.id))}
          disabled={locked}
        />
        <div className="flex flex-col gap-1.5">
          <Label>Stack position</Label>
          <p className="text-xs text-muted-foreground">
            {index + 1} of {count}. Earlier nodes paint underneath.
          </p>
          <div className="grid grid-cols-2 gap-1.5">
            <StackButton label="To back" icon={<ChevronsDown />} disabled={locked || index === 0} onClick={() => onDoc(moveNode(doc, node.id, 'back'))} />
            <StackButton label="Lower" icon={<ArrowDown />} disabled={locked || index === 0} onClick={() => onDoc(moveNode(doc, node.id, 'backward'))} />
            <StackButton label="Raise" icon={<ArrowUp />} disabled={locked || index === count - 1} onClick={() => onDoc(moveNode(doc, node.id, 'forward'))} />
            <StackButton label="To front" icon={<ChevronsUp />} disabled={locked || index === count - 1} onClick={() => onDoc(moveNode(doc, node.id, 'front'))} />
          </div>
        </div>
        <NodeFields
          node={node}
          disabled={locked}
          onChange={(next) => onDoc(replaceNode(doc, node.id, next))}
        />
        <GeometryFields
          x={node.x}
          y={node.y}
          width={node.width}
          height={node.height}
          disabled={locked}
          onChange={(patch) => onDoc(replaceNode(doc, node.id, { ...node, ...patch }))}
        />
        <ColorField
          value={node.color}
          disabled={locked}
          onChange={(color) => {
            const next = { ...node }
            if (color === undefined) delete next.color
            else next.color = color
            onDoc(replaceNode(doc, node.id, next))
          }}
        />
      </div>
    )
  }

  if (!edge) return null
  return (
    <div className="flex flex-col gap-3">
      <Header
        title="edge"
        id={edge.id}
        onDelete={() => onDoc(removeEdge(doc, edge.id))}
        disabled={locked}
      />
      <div className="grid grid-cols-2 gap-2">
        <NodeSelect
          label="From"
          value={edge.fromNode}
          nodes={doc.nodes ?? []}
          disabled={locked}
          onChange={(fromNode) => onDoc(replaceEdge(doc, edge.id, { ...edge, fromNode }))}
        />
        <NodeSelect
          label="To"
          value={edge.toNode}
          nodes={doc.nodes ?? []}
          disabled={locked}
          onChange={(toNode) => onDoc(replaceEdge(doc, edge.id, { ...edge, toNode }))}
        />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <SideSelect
          label="From side"
          value={edge.fromSide ?? ''}
          disabled={locked}
          onChange={(value) => onDoc(replaceEdge(doc, edge.id, setSide(edge, 'fromSide', value)))}
        />
        <SideSelect
          label="To side"
          value={edge.toSide ?? ''}
          disabled={locked}
          onChange={(value) => onDoc(replaceEdge(doc, edge.id, setSide(edge, 'toSide', value)))}
        />
      </div>
      <p className="text-[11px] text-muted-foreground">
        A blank side is omitted. The canvas then attaches the line to the nearest side.
      </p>
      <div className="grid grid-cols-2 gap-2">
        <EndSelect
          label="From end"
          value={effectiveEnd(edge, 'fromEnd')}
          disabled={locked}
          onChange={(value) => onDoc(replaceEdge(doc, edge.id, setEnd(edge, 'fromEnd', value)))}
        />
        <EndSelect
          label="To end"
          value={effectiveEnd(edge, 'toEnd')}
          disabled={locked}
          onChange={(value) => onDoc(replaceEdge(doc, edge.id, setEnd(edge, 'toEnd', value)))}
        />
      </div>
      <p className="text-[11px] text-muted-foreground">
        {edge.fromEnd === undefined
          ? 'fromEnd omitted — the spec default is none.'
          : `fromEnd is "${edge.fromEnd}" in the JSON.`}
        {' '}
        {edge.toEnd === undefined
          ? 'toEnd omitted — the spec default is arrow.'
          : `toEnd is "${edge.toEnd}" in the JSON.`}
      </p>
      <StringField
        label="Label"
        value={edge.label ?? ''}
        disabled={locked}
        onChange={(label) => {
          const next = { ...edge }
          if (label === '') delete next.label
          else next.label = label
          onDoc(replaceEdge(doc, edge.id, next))
        }}
      />
      <ColorField
        value={edge.color}
        disabled={locked}
        onChange={(color) => {
          const next = { ...edge }
          if (color === undefined) delete next.color
          else next.color = color
          onDoc(replaceEdge(doc, edge.id, next))
        }}
      />
    </div>
  )
}

function Header({
  title,
  id,
  disabled,
  onDelete,
}: {
  title: string
  id: string
  disabled: boolean
  onDelete: () => void
}) {
  return (
    <div className="flex items-start justify-between gap-2">
      <div>
        <p className="text-sm font-medium capitalize">{title}</p>
        <p className="font-mono text-[11px] text-muted-foreground">{id}</p>
      </div>
      <Button type="button" variant="destructive" size="sm" disabled={disabled} onClick={onDelete}>
        <Trash2 />
        Delete
      </Button>
    </div>
  )
}

function StackButton({
  label,
  icon,
  disabled,
  onClick,
}: {
  label: string
  icon: ReactNode
  disabled: boolean
  onClick: () => void
}) {
  return (
    <Button type="button" variant="outline" size="sm" disabled={disabled} onClick={onClick}>
      {icon}
      {label}
    </Button>
  )
}

function NodeFields({
  node,
  disabled,
  onChange,
}: {
  node: CanvasNode
  disabled: boolean
  onChange: (node: CanvasNode) => void
}) {
  if (node.type === 'text') {
    return (
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="node-text">Markdown</Label>
        <Textarea
          id="node-text"
          value={node.text}
          disabled={disabled}
          className="field-sizing-fixed min-h-24 text-sm"
          onChange={(event) => onChange({ ...node, text: event.target.value })}
        />
      </div>
    )
  }
  if (node.type === 'file') {
    return (
      <div className="flex flex-col gap-2">
        <StringField
          id="node-file"
          label="File path"
          value={node.file}
          disabled={disabled}
          onChange={(file) => {
            if (file === '') return
            onChange({ ...node, file })
          }}
        />
        <StringField
          id="node-subpath"
          label="Subpath"
          value={node.subpath ?? ''}
          disabled={disabled}
          placeholder="#heading"
          onChange={(subpath) => {
            const next = { ...node }
            if (subpath === '') delete next.subpath
            else next.subpath = subpath.startsWith('#') ? subpath : `#${subpath}`
            onChange(next)
          }}
        />
        <p className="text-[11px] text-muted-foreground">Subpaths start with #. The file is not opened.</p>
      </div>
    )
  }
  if (node.type === 'link') {
    return (
      <StringField
        id="node-url"
        label="URL"
        value={node.url}
        disabled={disabled}
        onChange={(url) => {
          if (url === '') return
          onChange({ ...node, url })
        }}
      />
    )
  }
  return (
    <div className="flex flex-col gap-2">
      <StringField
        id="node-label"
        label="Label"
        value={node.label ?? ''}
        disabled={disabled}
        onChange={(label) => {
          const next = { ...node }
          if (label === '') delete next.label
          else next.label = label
          onChange(next)
        }}
      />
      <StringField
        id="node-background"
        label="Background path"
        value={node.background ?? ''}
        disabled={disabled}
        onChange={(background) => {
          const next = { ...node }
          if (background === '') {
            delete next.background
            delete next.backgroundStyle
          } else {
            next.background = background
          }
          onChange(next)
        }}
      />
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="node-bg-style">Background style</Label>
        <select
          id="node-bg-style"
          className="h-8 rounded-md border border-input bg-background px-2 text-sm"
          value={node.backgroundStyle ?? ''}
          disabled={disabled}
          onChange={(event) => {
            const next = { ...node }
            const value = event.target.value
            if (value === 'cover' || value === 'ratio' || value === 'repeat') next.backgroundStyle = value
            else delete next.backgroundStyle
            onChange(next)
          }}
        >
          <option value="">Omitted</option>
          <option value="cover">cover</option>
          <option value="ratio">ratio</option>
          <option value="repeat">repeat</option>
        </select>
      </div>
      <p className="text-[11px] text-muted-foreground">Background images are stored as paths and never fetched.</p>
    </div>
  )
}

function GeometryFields({
  x,
  y,
  width,
  height,
  disabled,
  onChange,
}: {
  x: number
  y: number
  width: number
  height: number
  disabled: boolean
  onChange: (patch: { x: number; y: number; width: number; height: number }) => void
}) {
  return (
    <div className="grid grid-cols-4 gap-1.5">
      <NumberField label="X" value={x} disabled={disabled} onChange={(next) => onChange({ x: next, y, width, height })} />
      <NumberField label="Y" value={y} disabled={disabled} onChange={(next) => onChange({ x, y: next, width, height })} />
      <NumberField label="W" value={width} disabled={disabled} onChange={(next) => onChange({ x, y, width: next, height })} />
      <NumberField label="H" value={height} disabled={disabled} onChange={(next) => onChange({ x, y, width, height: next })} />
    </div>
  )
}

function NumberField({
  label,
  value,
  disabled,
  onChange,
}: {
  label: string
  value: number
  disabled: boolean
  onChange: (value: number) => void
}) {
  const [text, setText] = useState(String(value))
  const [source, setSource] = useState(value)
  if (source !== value) {
    setSource(value)
    setText(String(value))
  }
  return (
    <div className="flex flex-col gap-1">
      <Label className="text-[11px] text-muted-foreground">{label}</Label>
      <Input
        className={FIELD}
        value={text}
        disabled={disabled}
        inputMode="numeric"
        aria-label={label}
        onChange={(event) => {
          const next = event.target.value
          setText(next)
          if (/^-?\d+$/.test(next)) onChange(Number(next))
        }}
      />
    </div>
  )
}

function StringField({
  id,
  label,
  value,
  disabled,
  placeholder,
  onChange,
}: {
  id?: string
  label: string
  value: string
  disabled: boolean
  placeholder?: string
  onChange: (value: string) => void
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        className={FIELD}
        value={value}
        disabled={disabled}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  )
}

function ColorField({
  value,
  disabled,
  onChange,
}: {
  value: string | undefined
  disabled: boolean
  onChange: (color: string | undefined) => void
}) {
  const [hex, setHex] = useState(value?.startsWith('#') ? value : '')
  const [source, setSource] = useState(value)
  if (source !== value) {
    setSource(value)
    setHex(value?.startsWith('#') ? value : '')
  }

  return (
    <div className="flex flex-col gap-1.5">
      <Label>Color</Label>
      <div className="flex flex-wrap items-center gap-1">
        <button
          type="button"
          disabled={disabled}
          aria-label="Clear color"
          aria-pressed={value === undefined}
          className="h-6 rounded-md border px-1.5 text-[11px] disabled:opacity-50"
          onClick={() => onChange(undefined)}
        >
          None
        </button>
        {PRESET_COLOR_IDS.map((id) => (
          <button
            key={id}
            type="button"
            disabled={disabled}
            aria-label={`${PRESET_COLORS[id].name} preset ${id}`}
            aria-pressed={value === id}
            title={`${id} ${PRESET_COLORS[id].name}`}
            className="size-6 rounded-md border disabled:opacity-50"
            style={{
              backgroundColor: PRESET_COLORS[id].hex,
              outline: value === id ? '2px solid var(--foreground)' : undefined,
              outlineOffset: 1,
            }}
            onClick={() => onChange(id)}
          />
        ))}
      </div>
      <Input
        className={`${FIELD} font-mono`}
        value={hex}
        disabled={disabled}
        placeholder="#RRGGBB"
        aria-label="Hex color"
        onChange={(event) => {
          const next = event.target.value.trim()
          setHex(next)
          const withHash = next.startsWith('#') ? next : `#${next}`
          if (/^#[0-9A-Fa-f]{6}$/.test(withHash)) onChange(withHash)
        }}
      />
      <p className="text-[11px] text-muted-foreground">
        {value === undefined ? 'color omitted' : `color "${value}"`}
      </p>
    </div>
  )
}

function SideSelect({
  label,
  value,
  disabled,
  onChange,
}: {
  label: string
  value: Side | ''
  disabled: boolean
  onChange: (value: Side | '') => void
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label>{label}</Label>
      <select
        className="h-8 rounded-md border border-input bg-background px-2 text-sm"
        value={value}
        disabled={disabled}
        aria-label={label}
        onChange={(event) => {
          const next = event.target.value
          if (next === '' || SIDES.includes(next as Side)) onChange(next as Side | '')
        }}
      >
        <option value="">Auto</option>
        {SIDES.map((side) => (
          <option key={side} value={side}>
            {side}
          </option>
        ))}
      </select>
    </div>
  )
}

function EndSelect({
  label,
  value,
  disabled,
  onChange,
}: {
  label: string
  value: End
  disabled: boolean
  onChange: (value: End) => void
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label>{label}</Label>
      <select
        className="h-8 rounded-md border border-input bg-background px-2 text-sm"
        value={value}
        disabled={disabled}
        aria-label={label}
        onChange={(event) => {
          const next = event.target.value
          if (next === 'none' || next === 'arrow') onChange(next)
        }}
      >
        {ENDS.map((end) => (
          <option key={end} value={end}>
            {end}
          </option>
        ))}
      </select>
    </div>
  )
}

function NodeSelect({
  label,
  value,
  nodes,
  disabled,
  onChange,
}: {
  label: string
  value: string
  nodes: CanvasNode[]
  disabled: boolean
  onChange: (id: string) => void
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label>{label}</Label>
      <select
        className="h-8 rounded-md border border-input bg-background px-2 text-sm"
        value={value}
        disabled={disabled}
        aria-label={label}
        onChange={(event) => onChange(event.target.value)}
      >
        {nodes.map((node) => (
          <option key={node.id} value={node.id}>
            {node.id}
          </option>
        ))}
      </select>
    </div>
  )
}
