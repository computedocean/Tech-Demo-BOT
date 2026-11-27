export type NodeKind =
  | "client"
  | "service"
  | "database"
  | "cache"
  | "queue"
  | "worker"
  | "auth"
  | "bus"

export type TemplateId = "web" | "queue" | "auth" | "event"

export type ArchNode = {
  id: string
  name: string
  role: string
  kind: NodeKind
  detail: string
  x: number
  y: number
}

export type ArchEdge = {
  id: string
  from: string
  to: string
  label: string
}

export type ArchPath = {
  id: string
  name: string
  description: string
  nodeIds: string[]
  edgeIds: string[]
}

export type Diagram = {
  id: string
  title: string
  summary: string
  templateId: TemplateId
  nodes: ArchNode[]
  edges: ArchEdge[]
  paths: ArchPath[]
}

export type Failure = {
  ok: false
  error: string
  suggestions: string[]
}

export type GenerateResult = { ok: true; diagram: Diagram } | Failure

export type EditResult = { ok: true; diagram: Diagram; note: string } | Failure

export type Highlight = {
  pathId: string | null
  nodeIds: string[]
  edgeIds: string[]
}

export type HighlightResult = { ok: true; highlight: Highlight } | { ok: false; error: string }

export type StudioSuccess = {
  ok: true
  diagram: Diagram
  usedLlm: boolean
  note: string
}

export type StudioFailure = Failure & { usedLlm: false }

export type StudioResult = StudioSuccess | StudioFailure
