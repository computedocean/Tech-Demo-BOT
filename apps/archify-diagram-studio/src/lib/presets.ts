import { assertDiagram, withRoutedPaths } from "./graph.ts"
import type { ArchEdge, ArchNode, ArchPath, Diagram, TemplateId } from "./types.ts"

export type Preset = {
  id: TemplateId
  label: string
}

export const PRESETS: Preset[] = [
  { id: "web", label: "Web app with API and database" },
  { id: "queue", label: "Queue and worker pipeline" },
  { id: "auth", label: "Auth-gated notes service" },
  { id: "event", label: "Event-driven order flow" },
]

export const PROMPT_SUGGESTIONS = PRESETS.map((preset) => preset.label)

export const PLAIN_PROMPTS: Record<TemplateId, string> = {
  web: "a todo app with an API and a database",
  queue: "simple queue and worker pipeline for image jobs",
  auth: "login gated notes service",
  event: "event-driven order flow for checkout",
}

function diagram(input: {
  id: string
  title: string
  summary: string
  templateId: TemplateId
  nodes: ArchNode[]
  edges: ArchEdge[]
  paths: Array<Omit<ArchPath, "edgeIds"> & { edgeIds?: string[] }>
}): Diagram {
  const paths = withRoutedPaths(
    input.paths.map((path) => ({ ...path, edgeIds: path.edgeIds ?? [] })),
    input.edges,
  )
  if (!paths) throw new Error(`Preset ${input.id} has a path that is not directed.`)
  const next: Diagram = { ...input, paths }
  assertDiagram(next)
  return next
}

export function isTemplateId(value: string): value is TemplateId {
  return PRESETS.some((preset) => preset.id === value)
}

export function createPresetDiagram(id: TemplateId): Diagram {
  switch (id) {
    case "web":
      return diagram({
        id: "web",
        templateId: "web",
        title: "Web app",
        summary: "A browser talks to one HTTP API, and the API reads and writes Postgres.",
        nodes: [
          {
            id: "web-browser",
            name: "Browser",
            role: "Client",
            kind: "client",
            detail: "The page the person is using. It sends HTTPS requests and renders what the API returns.",
            x: 72,
            y: 248,
          },
          {
            id: "web-api",
            name: "API",
            role: "HTTP service",
            kind: "service",
            detail: "Accepts the request, checks the payload, and reads or writes the system of record.",
            x: 420,
            y: 248,
          },
          {
            id: "web-db",
            name: "Postgres",
            role: "System of record",
            kind: "database",
            detail: "Stores the durable rows. The API is the only node that issues SQL.",
            x: 768,
            y: 248,
          },
        ],
        edges: [
          { id: "web-https", from: "web-browser", to: "web-api", label: "HTTPS" },
          { id: "web-sql", from: "web-api", to: "web-db", label: "SQL" },
        ],
        paths: [
          {
            id: "web-read",
            name: "Read request",
            description: "A page read goes from the browser through the API into Postgres.",
            nodeIds: ["web-browser", "web-api", "web-db"],
          },
        ],
      })
    case "queue":
      return diagram({
        id: "queue",
        templateId: "queue",
        title: "Queue pipeline",
        summary: "A producer enqueues jobs. A worker pulls them and writes the durable record.",
        nodes: [
          {
            id: "queue-producer",
            name: "Producer",
            role: "Job source",
            kind: "service",
            detail: "Turns a user action into a job and returns before the slow work finishes.",
            x: 48,
            y: 248,
          },
          {
            id: "queue-queue",
            name: "Queue",
            role: "Buffer",
            kind: "queue",
            detail: "Holds jobs until a worker is free. Delivery is at least once.",
            x: 360,
            y: 248,
          },
          {
            id: "queue-worker",
            name: "Worker",
            role: "Consumer",
            kind: "worker",
            detail: "Pulls one job, does the work, and writes the outcome. Failures go back on the queue.",
            x: 672,
            y: 112,
          },
          {
            id: "queue-store",
            name: "Store",
            role: "Durable records",
            kind: "database",
            detail: "The record the worker writes after the job succeeds.",
            x: 672,
            y: 392,
          },
        ],
        edges: [
          { id: "queue-enqueue", from: "queue-producer", to: "queue-queue", label: "enqueue" },
          { id: "queue-deliver", from: "queue-queue", to: "queue-worker", label: "deliver" },
          { id: "queue-write", from: "queue-worker", to: "queue-store", label: "write" },
        ],
        paths: [
          {
            id: "queue-job",
            name: "Job path",
            description: "A job is enqueued, delivered to a worker, and written to the store.",
            nodeIds: ["queue-producer", "queue-queue", "queue-worker", "queue-store"],
          },
        ],
      })
    case "auth":
      return diagram({
        id: "auth",
        templateId: "auth",
        title: "Auth-gated notes",
        summary: "Callers sign in first. The notes API accepts a session, then reads the private store.",
        nodes: [
          {
            id: "auth-client",
            name: "Client",
            role: "Caller",
            kind: "client",
            detail: "The app the person is signed into. It keeps the session and calls the notes API.",
            x: 48,
            y: 260,
          },
          {
            id: "auth-auth",
            name: "Auth",
            role: "Session gate",
            kind: "auth",
            detail: "Checks credentials and issues a session. Downstream services trust that session.",
            x: 372,
            y: 96,
          },
          {
            id: "auth-api",
            name: "Notes API",
            role: "Authorized service",
            kind: "service",
            detail: "Refuses a request without a session, then reads or writes that caller's notes.",
            x: 372,
            y: 400,
          },
          {
            id: "auth-db",
            name: "Notes DB",
            role: "Private notes",
            kind: "database",
            detail: "Rows are scoped to the signed-in caller. The API is the only reader.",
            x: 736,
            y: 400,
          },
        ],
        edges: [
          { id: "auth-signin", from: "auth-client", to: "auth-auth", label: "sign in" },
          { id: "auth-session", from: "auth-auth", to: "auth-api", label: "session" },
          { id: "auth-request", from: "auth-client", to: "auth-api", label: "request" },
          { id: "auth-read", from: "auth-api", to: "auth-db", label: "read" },
        ],
        paths: [
          {
            id: "auth-authorized",
            name: "Authorized read",
            description: "The caller signs in, continues with a session, and the API reads the notes.",
            nodeIds: ["auth-client", "auth-auth", "auth-api", "auth-db"],
          },
        ],
      })
    case "event":
      return diagram({
        id: "event",
        templateId: "event",
        title: "Event-driven orders",
        summary: "Checkout publishes OrderPlaced. Inventory subscribes, then reserves a row in the order store.",
        nodes: [
          {
            id: "event-checkout",
            name: "Checkout",
            role: "Order entry",
            kind: "service",
            detail: "Takes the order and publishes one event. It does not update inventory itself.",
            x: 48,
            y: 248,
          },
          {
            id: "event-bus",
            name: "Event bus",
            role: "OrderPlaced",
            kind: "bus",
            detail: "Carries OrderPlaced to subscribers. Checkout does not wait for inventory.",
            x: 392,
            y: 248,
          },
          {
            id: "event-inventory",
            name: "Inventory",
            role: "Subscriber",
            kind: "worker",
            detail: "Handles OrderPlaced by reserving stock and recording the reservation.",
            x: 736,
            y: 104,
          },
          {
            id: "event-orders",
            name: "Orders DB",
            role: "Order record",
            kind: "database",
            detail: "The reservation and order row written after the event is handled.",
            x: 736,
            y: 392,
          },
        ],
        edges: [
          { id: "event-publish", from: "event-checkout", to: "event-bus", label: "OrderPlaced" },
          { id: "event-subscribe", from: "event-bus", to: "event-inventory", label: "subscribe" },
          { id: "event-reserve", from: "event-inventory", to: "event-orders", label: "reserve" },
        ],
        paths: [
          {
            id: "event-placed",
            name: "Order placed",
            description: "Checkout publishes OrderPlaced, inventory handles it, and the order row is reserved.",
            nodeIds: ["event-checkout", "event-bus", "event-inventory", "event-orders"],
          },
        ],
      })
  }
}
