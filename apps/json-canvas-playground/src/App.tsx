import { ReactFlowProvider, useReactFlow, type Connection } from '@xyflow/react'
import { Download, FileText, Frame, Link, Type, Upload } from 'lucide-react'
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import {
  addEdge,
  addNode,
  createNode,
  defaultSize,
  newId,
  usedIds,
} from '@/canvas/document.ts'
import {
  EXAMPLE_IDS,
  EXAMPLE_LABELS,
  examples,
  mindMap,
  rejectedSample,
  type ExampleId,
} from '@/canvas/examples.ts'
import { isSide } from '@/canvas/flow.ts'
import type { CanvasEdge, CanvasFile, NodeType } from '@/canvas/types.ts'
import { parseCanvas, stringifyCanvas } from '@/canvas/validate.ts'
import { CanvasStage } from '@/components/CanvasStage.tsx'
import { Inspector, type Selection } from '@/components/Inspector.tsx'
import { JsonPanel } from '@/components/JsonPanel.tsx'
import { Badge } from '@/components/ui/badge.tsx'
import { Button } from '@/components/ui/button.tsx'
import { Separator } from '@/components/ui/separator.tsx'

const ADD_TOOLS: { type: NodeType; label: string; icon: ReactNode }[] = [
  { type: 'text', label: 'Text', icon: <Type /> },
  { type: 'file', label: 'File', icon: <FileText /> },
  { type: 'link', label: 'Link', icon: <Link /> },
  { type: 'group', label: 'Group', icon: <Frame /> },
]

export default function App() {
  return (
    <ReactFlowProvider>
      <Playground />
    </ReactFlowProvider>
  )
}

function Playground() {
  const { screenToFlowPosition } = useReactFlow()
  const [doc, setDoc] = useState<CanvasFile>(mindMap)
  const [draft, setDraft] = useState<string | null>(null)
  const [jsonFocused, setJsonFocused] = useState(false)
  const [selection, setSelection] = useState<Selection | null>(null)
  const [fileName, setFileName] = useState('mind-map')
  const [fitKey, setFitKey] = useState('mind-map')
  const fileInput = useRef<HTMLInputElement>(null)
  const lockRef = useRef(false)
  const draftRef = useRef<string | null>(null)

  const canonical = useMemo(() => stringifyCanvas(doc), [doc])
  const jsonText = draft ?? canonical
  const parsed = useMemo(() => parseCanvas(jsonText), [jsonText])
  const errors = parsed.ok ? [] : parsed.errors
  const invalid = !parsed.ok
  const locked = jsonFocused || invalid
  const activeSelection =
    selection &&
    (selection.kind === 'node'
      ? doc.nodes?.some((node) => node.id === selection.id)
      : doc.edges?.some((edge) => edge.id === selection.id))
      ? selection
      : null

  useEffect(() => {
    lockRef.current = locked
  }, [locked])

  function mutate(updater: (current: CanvasFile) => CanvasFile) {
    if (lockRef.current) return
    setDoc((current) => updater(current))
  }

  function onJsonChange(text: string) {
    draftRef.current = text
    setDraft(text)
    const result = parseCanvas(text)
    if (result.ok) setDoc(result.value)
  }

  function loadExample(id: ExampleId) {
    const next = examples[id]
    draftRef.current = null
    lockRef.current = false
    setDoc(next)
    setDraft(null)
    setJsonFocused(false)
    setSelection(null)
    setFileName(id)
    setFitKey(`${id}-${Date.now()}`)
  }

  function addNodeOf(type: NodeType) {
    if (lockRef.current) return
    const stage = document.getElementById('canvas-stage')
    const rect = stage?.getBoundingClientRect()
    const center = rect
      ? screenToFlowPosition({
          x: rect.left + rect.width / 2,
          y: rect.top + rect.height / 2,
        })
      : { x: 80, y: 80 }
    const size = defaultSize(type)
    const node = createNode(
      type,
      Math.round(center.x - size.width / 2),
      Math.round(center.y - size.height / 2),
      usedIds(doc),
    )
    setSelection({ kind: 'node', id: node.id })
    setDoc(addNode(doc, node))
  }

  function connect(connection: Connection) {
    if (lockRef.current || !connection.source || !connection.target) return
    const edge: CanvasEdge = {
      id: newId(usedIds(doc)),
      fromNode: connection.source,
      toNode: connection.target,
    }
    if (isSide(connection.sourceHandle)) edge.fromSide = connection.sourceHandle
    if (isSide(connection.targetHandle)) edge.toSide = connection.targetHandle
    setSelection({ kind: 'edge', id: edge.id })
    setDoc(addEdge(doc, edge))
  }

  function exportFile() {
    if (invalid) return
    const blob = new Blob([canonical], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `${fileName}.canvas`
    anchor.click()
    URL.revokeObjectURL(url)
  }

  function importFile(file: File) {
    const reader = new FileReader()
    reader.onload = () => {
      const text = typeof reader.result === 'string' ? reader.result : ''
      const result = parseCanvas(text)
      if (result.ok) {
        draftRef.current = null
        lockRef.current = false
        setDoc(result.value)
        setDraft(null)
        setJsonFocused(false)
        setSelection(null)
        setFileName(file.name.replace(/\.canvas$|\.json$/i, '') || 'canvas')
        setFitKey(`import-${Date.now()}`)
      } else {
        draftRef.current = text
        lockRef.current = true
        setDraft(text)
      }
    }
    reader.readAsText(file)
  }

  function onSelect(next: Selection | null) {
    setSelection((current) => {
      if (current?.kind === next?.kind && current?.id === next?.id) return current
      if (!current && !next) return current
      return next
    })
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="flex shrink-0 flex-wrap items-center gap-3 border-b px-3 py-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h1 className="text-sm font-semibold tracking-tight">JSON Canvas</h1>
            <Badge variant="outline">1.0</Badge>
          </div>
          <p className="text-[11px] text-muted-foreground">
            Independent playground for the{' '}
            <a className="underline underline-offset-2" href="https://jsoncanvas.org/spec/1.0/">
              jsoncanvas.org
            </a>{' '}
            spec. Not affiliated with Obsidian.
          </p>
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-1.5">
          {EXAMPLE_IDS.map((id) => (
            <Button
              key={id}
              type="button"
              size="sm"
              variant={fileName === id ? 'secondary' : 'outline'}
              onClick={() => loadExample(id)}
            >
              {EXAMPLE_LABELS[id]}
            </Button>
          ))}
          <Button type="button" size="sm" variant="outline" onClick={() => fileInput.current?.click()}>
            <Upload />
            Import
          </Button>
          <Button type="button" size="sm" onClick={exportFile} disabled={invalid}>
            <Download />
            Export
          </Button>
          <input
            ref={fileInput}
            type="file"
            accept=".canvas,.json,application/json"
            className="sr-only"
            onChange={(event) => {
              const file = event.target.files?.[0]
              event.target.value = ''
              if (file) importFile(file)
            }}
          />
        </div>
      </header>
      <div className="grid min-h-0 flex-1 grid-cols-[260px_minmax(0,1fr)_minmax(320px,400px)] grid-rows-1">
        <aside className="h-full min-h-0 overflow-auto border-r">
          <div className="flex flex-col gap-4 p-3">
            <div className="flex flex-col gap-2">
              <h2 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Add</h2>
              <div className="grid grid-cols-2 gap-1.5">
                {ADD_TOOLS.map((tool) => (
                  <Button
                    key={tool.type}
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={locked}
                    onClick={() => addNodeOf(tool.type)}
                  >
                    {tool.icon}
                    {tool.label}
                  </Button>
                ))}
              </div>
            </div>
            <Separator />
            <Inspector
              doc={doc}
              selection={activeSelection}
              locked={locked}
              onDoc={(next) => {
                if (lockRef.current) return
                setDoc(next)
              }}
            />
          </div>
        </aside>
        <CanvasStage
          doc={doc}
          selection={activeSelection}
          fitKey={fitKey}
          locked={locked}
          holdDraft={invalid}
          onMutate={mutate}
          onSelect={onSelect}
          onConnect={connect}
        />
        <aside className="h-full min-h-0 border-l">
          <JsonPanel
            text={jsonText}
            errors={errors}
            onChange={onJsonChange}
            onFocus={() => {
              const next = draftRef.current ?? canonical
              draftRef.current = next
              lockRef.current = true
              setDraft(next)
              setJsonFocused(true)
            }}
            onBlur={() => {
              const text = draftRef.current
              const stillInvalid = text !== null && !parseCanvas(text).ok
              lockRef.current = stillInvalid
              setJsonFocused(false)
              if (!stillInvalid) {
                draftRef.current = null
                setDraft(null)
              }
            }}
            onRevert={() => {
              draftRef.current = null
              lockRef.current = false
              setDraft(null)
              setJsonFocused(false)
            }}
            onRejectSample={() => {
              draftRef.current = rejectedSample
              lockRef.current = true
              setDraft(rejectedSample)
            }}
          />
        </aside>
      </div>
    </div>
  )
}
