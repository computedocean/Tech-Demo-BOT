import { placeBetween } from "./geometry.ts"
import { nodeById, spliceHop, withRoutedPaths } from "./graph.ts"
import type { ArchEdge, ArchNode, ArchPath, Diagram, EditResult, Failure } from "./types.ts"

export const EDIT_SUGGESTIONS = ["add a Redis cache", "add authentication"]

const UNRECOGNIZED =
  "This studio does not recognize that edit. Supported follow-ups are “add a Redis cache” and “add authentication”."

function fail(error: string): Failure {
  return { ok: false, error, suggestions: EDIT_SUGGESTIONS }
}

function normalize(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ")
}

type EditKind = "redis" | "auth"

export function matchEdit(input: string): EditKind | "empty" | "ambiguous" | "unknown" {
  const text = normalize(input)
  if (!text) return "empty"
  const redis = /\b(redis|cache)\b/.test(text) && /\b(add|insert|put|include)\b/.test(text)
  const auth = /\b(auth|authentication|login|sign in)\b/.test(text) && /\b(add|insert|put|include)\b/.test(text)
  if (redis && auth) return "ambiguous"
  if (redis) return "redis"
  if (auth) return "auth"
  return "unknown"
}

function databaseEdge(diagram: Diagram): ArchEdge | undefined {
  const databases = new Set(diagram.nodes.filter((node) => node.kind === "database").map((node) => node.id))
  return diagram.edges.find((edge) => databases.has(edge.to))
}

function addRedis(diagram: Diagram): EditResult {
  if (diagram.nodes.some((node) => node.kind === "cache" || /redis/i.test(node.name))) {
    return fail("This diagram already includes a Redis cache.")
  }
  const inbound = databaseEdge(diagram)
  if (!inbound) {
    return fail("A Redis cache needs a database that something already connects to.")
  }
  const source = nodeById(diagram, inbound.from)
  const target = nodeById(diagram, inbound.to)
  if (!source || !target) return fail("A Redis cache needs a database that something already connects to.")

  const at = placeBetween(source, target, diagram.nodes)
  const redis: ArchNode = {
    id: `${diagram.id}-redis`,
    name: "Redis",
    role: "Cache",
    kind: "cache",
    detail: "Keeps a short-lived copy of hot reads. A miss falls through to the database.",
    x: at.x,
    y: at.y,
  }
  const lookup: ArchEdge = {
    id: `${diagram.id}-redis-lookup`,
    from: source.id,
    to: redis.id,
    label: "lookup",
  }
  const miss: ArchEdge = {
    id: `${diagram.id}-redis-miss`,
    from: redis.id,
    to: target.id,
    label: "miss",
  }
  const edges = diagram.edges.filter((edge) => edge.id !== inbound.id).concat(lookup, miss)
  const paths: ArchPath[] = diagram.paths.map((path) => ({
    ...path,
    nodeIds: spliceHop(path.nodeIds, source.id, target.id, redis.id),
    edgeIds: [],
  }))
  paths.push(
    {
      id: `${diagram.id}-cache-miss`,
      name: "Cache miss",
      description: `A lookup misses in Redis and falls through to ${target.name}.`,
      nodeIds: [source.id, redis.id, target.id],
      edgeIds: [],
    },
    {
      id: `${diagram.id}-cache-hit`,
      name: "Cache hit",
      description: `${source.name} is served from Redis and does not read ${target.name}.`,
      nodeIds: [source.id, redis.id],
      edgeIds: [],
    },
  )
  const routed = withRoutedPaths(paths, edges)
  if (!routed) return fail("A Redis cache could not be placed on a directed route.")
  return {
    ok: true,
    note: `Added Redis on the path from ${source.name} to ${target.name}.`,
    diagram: {
      ...diagram,
      nodes: [...diagram.nodes, redis],
      edges,
      paths: routed,
    },
  }
}

function entryEdge(diagram: Diagram): ArchEdge | undefined {
  const client = diagram.nodes.find((node) => node.kind === "client")
  if (client) {
    const edge = diagram.edges.find((item) => item.from === client.id)
    if (edge) return edge
  }
  const sinks = new Set(diagram.edges.map((edge) => edge.to))
  const entry = diagram.nodes.find((node) => !sinks.has(node.id))
  if (!entry) return undefined
  return diagram.edges.find((edge) => edge.from === entry.id)
}

function addAuth(diagram: Diagram): EditResult {
  if (diagram.nodes.some((node) => node.kind === "auth")) {
    return fail("This diagram already includes authentication.")
  }
  const outbound = entryEdge(diagram)
  if (!outbound) return fail("Add authentication needs an entry point that already calls another node.")
  const source = nodeById(diagram, outbound.from)
  const target = nodeById(diagram, outbound.to)
  if (!source || !target) return fail("Add authentication needs an entry point that already calls another node.")

  const at = placeBetween(source, target, diagram.nodes)
  const auth: ArchNode = {
    id: `${diagram.id}-auth`,
    name: "Auth",
    role: "Session gate",
    kind: "auth",
    detail: "Checks the caller and issues a session before the request continues.",
    x: at.x,
    y: at.y,
  }
  const signIn: ArchEdge = {
    id: `${diagram.id}-auth-signin`,
    from: source.id,
    to: auth.id,
    label: "sign in",
  }
  const session: ArchEdge = {
    id: `${diagram.id}-auth-session`,
    from: auth.id,
    to: target.id,
    label: "session",
  }
  const edges = [...diagram.edges, signIn, session]
  const paths: ArchPath[] = [
    ...diagram.paths.map((path) => ({ ...path })),
    {
      id: `${diagram.id}-sign-in`,
      name: "Sign in",
      description: `${source.name} signs in, then continues to ${target.name} with a session.`,
      nodeIds: [source.id, auth.id, target.id],
      edgeIds: [],
    },
  ]
  const routed = withRoutedPaths(paths, edges)
  if (!routed) return fail("Authentication could not be placed on a directed route.")
  return {
    ok: true,
    note: `Added Auth between ${source.name} and ${target.name}.`,
    diagram: {
      ...diagram,
      nodes: [...diagram.nodes, auth],
      edges,
      paths: routed,
    },
  }
}

export function applyEdit(diagram: Diagram, input: string): EditResult {
  const kind = matchEdit(input)
  if (kind === "empty") return fail("Enter a follow-up edit.")
  if (kind === "ambiguous") {
    return fail("Apply one follow-up at a time. Supported follow-ups are “add a Redis cache” and “add authentication”.")
  }
  if (kind === "unknown") return fail(UNRECOGNIZED)
  const current = structuredClone(diagram)
  return kind === "redis" ? addRedis(current) : addAuth(current)
}
