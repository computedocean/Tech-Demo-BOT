import {
  BACKGROUND_STYLES,
  ENDS,
  NODE_TYPES,
  PRESET_COLOR_IDS,
  SIDES,
  type BackgroundStyle,
  type CanvasEdge,
  type CanvasFile,
  type CanvasNode,
  type End,
  type FileNode,
  type GroupNode,
  type LinkNode,
  type Side,
  type TextNode,
  type ValidationError,
  type ValidationResult,
} from './types.ts'

const HEX_COLOR = /^#[0-9A-Fa-f]{6}$/
const PRESETS = new Set<string>(PRESET_COLOR_IDS)
const NODE_TYPE_SET = new Set<string>(NODE_TYPES)
const SIDE_SET = new Set<string>(SIDES)
const END_SET = new Set<string>(ENDS)
const BACKGROUND_SET = new Set<string>(BACKGROUND_STYLES)

const TOP_LEVEL_KEYS = new Set(['nodes', 'edges'])
const GENERIC_KEYS = ['id', 'type', 'x', 'y', 'width', 'height', 'color']
const KEYS_BY_TYPE: Record<string, Set<string>> = {
  text: new Set([...GENERIC_KEYS, 'text']),
  file: new Set([...GENERIC_KEYS, 'file', 'subpath']),
  link: new Set([...GENERIC_KEYS, 'url']),
  group: new Set([...GENERIC_KEYS, 'label', 'background', 'backgroundStyle']),
}
const ANY_NODE_KEY = new Set([
  ...GENERIC_KEYS,
  'text',
  'file',
  'subpath',
  'url',
  'label',
  'background',
  'backgroundStyle',
])
const EDGE_KEYS = new Set([
  'id',
  'fromNode',
  'fromSide',
  'fromEnd',
  'toNode',
  'toSide',
  'toEnd',
  'color',
  'label',
])

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value)
}

export function canonicalizeNode(node: CanvasNode): CanvasNode {
  if (node.type === 'text') {
    const next: TextNode = {
      id: node.id,
      type: 'text',
      text: node.text,
      x: node.x,
      y: node.y,
      width: node.width,
      height: node.height,
    }
    if (node.color !== undefined) next.color = node.color
    return next
  }
  if (node.type === 'file') {
    const next: FileNode = {
      id: node.id,
      type: 'file',
      file: node.file,
      ...(node.subpath !== undefined ? { subpath: node.subpath } : {}),
      x: node.x,
      y: node.y,
      width: node.width,
      height: node.height,
    }
    if (node.color !== undefined) next.color = node.color
    return next
  }
  if (node.type === 'link') {
    const next: LinkNode = {
      id: node.id,
      type: 'link',
      url: node.url,
      x: node.x,
      y: node.y,
      width: node.width,
      height: node.height,
    }
    if (node.color !== undefined) next.color = node.color
    return next
  }
  const next: GroupNode = {
    id: node.id,
    type: 'group',
    ...(node.label !== undefined ? { label: node.label } : {}),
    ...(node.background !== undefined ? { background: node.background } : {}),
    ...(node.backgroundStyle !== undefined ? { backgroundStyle: node.backgroundStyle } : {}),
    x: node.x,
    y: node.y,
    width: node.width,
    height: node.height,
  }
  if (node.color !== undefined) next.color = node.color
  return next
}

export function canonicalizeEdge(edge: CanvasEdge): CanvasEdge {
  const next: {
    id: string
    fromNode: string
    fromSide?: CanvasEdge['fromSide']
    fromEnd?: CanvasEdge['fromEnd']
    toNode?: string
    toSide?: CanvasEdge['toSide']
    toEnd?: CanvasEdge['toEnd']
    color?: string
    label?: string
  } = {
    id: edge.id,
    fromNode: edge.fromNode,
  }
  if (edge.fromSide !== undefined) next.fromSide = edge.fromSide
  if (edge.fromEnd !== undefined) next.fromEnd = edge.fromEnd
  next.toNode = edge.toNode
  if (edge.toSide !== undefined) next.toSide = edge.toSide
  if (edge.toEnd !== undefined) next.toEnd = edge.toEnd
  if (edge.color !== undefined) next.color = edge.color
  if (edge.label !== undefined) next.label = edge.label
  return next as CanvasEdge
}

export function stringifyCanvas(doc: CanvasFile): string {
  return `${JSON.stringify(doc, null, 2)}\n`
}

export function parseCanvas(text: string): ValidationResult {
  let data: unknown
  try {
    data = JSON.parse(text)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Invalid JSON'
    return { ok: false, errors: [{ path: '$', message }] }
  }
  return validateCanvas(data)
}

export function validateCanvas(input: unknown): ValidationResult {
  const errors: ValidationError[] = []
  if (!isRecord(input)) {
    return {
      ok: false,
      errors: [{ path: '$', message: 'Document must be a JSON object.' }],
    }
  }

  for (const key of Object.keys(input)) {
    if (!TOP_LEVEL_KEYS.has(key)) {
      errors.push({
        path: key,
        message: 'Unknown field. The spec only allows "nodes" and "edges".',
      })
    }
  }

  const nodeIds = new Set<string>()
  let nodes: CanvasNode[] | undefined
  if ('nodes' in input) {
    nodes = readNodes(input.nodes, nodeIds, errors)
  }

  let edges: CanvasEdge[] | undefined
  if ('edges' in input) {
    edges = readEdges(input.edges, nodeIds, errors)
  }

  if (errors.length > 0) return { ok: false, errors }
  const value: CanvasFile = {}
  if (nodes) value.nodes = nodes
  if (edges) value.edges = edges
  return { ok: true, value }
}

function readNodes(
  value: unknown,
  nodeIds: Set<string>,
  errors: ValidationError[],
): CanvasNode[] | undefined {
  if (!Array.isArray(value)) {
    errors.push({ path: 'nodes', message: 'Must be an array.' })
    return undefined
  }
  const nodes: CanvasNode[] = []
  for (let index = 0; index < value.length; index += 1) {
    const node = readNode(value[index], index, nodeIds, errors)
    if (node) nodes.push(node)
  }
  return nodes
}

function readNode(
  value: unknown,
  index: number,
  nodeIds: Set<string>,
  errors: ValidationError[],
): CanvasNode | null {
  const path = `nodes[${index}]`
  if (!isRecord(value)) {
    errors.push({ path, message: 'Node must be an object.' })
    return null
  }

  const id = readId(value, path, nodeIds, errors)
  const type = readNodeType(value, path, errors)
  const allowed = type ? KEYS_BY_TYPE[type] : ANY_NODE_KEY
  if (allowed) rejectUnknown(value, allowed, path, errors, type ?? undefined)

  const x = readRequiredInteger(value, 'x', path, errors)
  const y = readRequiredInteger(value, 'y', path, errors)
  const width = readRequiredInteger(value, 'width', path, errors)
  const height = readRequiredInteger(value, 'height', path, errors)
  const color = readOptionalColor(value, path, errors)

  if (!id || !type || x === undefined || y === undefined || width === undefined || height === undefined) {
    return null
  }

  const base = { id, x, y, width, height, ...(color !== undefined ? { color } : {}) }

  if (type === 'text') {
    const text = readRequiredString(value, 'text', path, errors)
    if (text === undefined) return null
    return canonicalizeNode({ ...base, type, text })
  }
  if (type === 'file') {
    const file = readRequiredString(value, 'file', path, errors)
    const subpath = readOptionalSubpath(value, path, errors)
    if (file === undefined || subpath === null) return null
    return canonicalizeNode({
      ...base,
      type,
      file,
      ...(subpath !== undefined ? { subpath } : {}),
    })
  }
  if (type === 'link') {
    const url = readRequiredString(value, 'url', path, errors)
    if (url === undefined) return null
    return canonicalizeNode({ ...base, type, url })
  }

  const label = readOptionalString(value, 'label', path, errors)
  const background = readOptionalString(value, 'background', path, errors)
  const backgroundStyle = readOptionalBackgroundStyle(value, path, errors)
  if (label === null || background === null || backgroundStyle === null) return null
  return canonicalizeNode({
    ...base,
    type: 'group',
    ...(label !== undefined ? { label } : {}),
    ...(background !== undefined ? { background } : {}),
    ...(backgroundStyle !== undefined ? { backgroundStyle } : {}),
  })
}

function readEdges(
  value: unknown,
  nodeIds: Set<string>,
  errors: ValidationError[],
): CanvasEdge[] | undefined {
  if (!Array.isArray(value)) {
    errors.push({ path: 'edges', message: 'Must be an array.' })
    return undefined
  }
  const seen = new Set<string>()
  const edges: CanvasEdge[] = []
  for (let index = 0; index < value.length; index += 1) {
    const edge = readEdge(value[index], index, seen, nodeIds, errors)
    if (edge) edges.push(edge)
  }
  return edges
}

function readEdge(
  value: unknown,
  index: number,
  seen: Set<string>,
  nodeIds: Set<string>,
  errors: ValidationError[],
): CanvasEdge | null {
  const path = `edges[${index}]`
  if (!isRecord(value)) {
    errors.push({ path, message: 'Edge must be an object.' })
    return null
  }
  rejectUnknown(value, EDGE_KEYS, path, errors)
  const id = readId(value, path, seen, errors)
  const fromNode = readRequiredString(value, 'fromNode', path, errors)
  const toNode = readRequiredString(value, 'toNode', path, errors)
  const fromSide = readOptionalSide(value, 'fromSide', path, errors)
  const toSide = readOptionalSide(value, 'toSide', path, errors)
  const fromEnd = readOptionalEnd(value, 'fromEnd', path, errors)
  const toEnd = readOptionalEnd(value, 'toEnd', path, errors)
  const color = readOptionalColor(value, path, errors)
  const label = readOptionalString(value, 'label', path, errors)

  if (fromNode !== undefined && !nodeIds.has(fromNode)) {
    errors.push({
      path: `${path}.fromNode`,
      message: `References unknown node "${fromNode}".`,
    })
  }
  if (toNode !== undefined && !nodeIds.has(toNode)) {
    errors.push({
      path: `${path}.toNode`,
      message: `References unknown node "${toNode}".`,
    })
  }

  if (
    !id ||
    fromNode === undefined ||
    toNode === undefined ||
    fromSide === null ||
    toSide === null ||
    fromEnd === null ||
    toEnd === null ||
    label === null ||
    !nodeIds.has(fromNode ?? '') ||
    !nodeIds.has(toNode ?? '')
  ) {
    return null
  }

  return canonicalizeEdge({
    id,
    fromNode,
    ...(fromSide !== undefined ? { fromSide } : {}),
    ...(fromEnd !== undefined ? { fromEnd } : {}),
    toNode,
    ...(toSide !== undefined ? { toSide } : {}),
    ...(toEnd !== undefined ? { toEnd } : {}),
    ...(color !== undefined ? { color } : {}),
    ...(label !== undefined ? { label } : {}),
  })
}

function rejectUnknown(
  value: Record<string, unknown>,
  allowed: Set<string>,
  path: string,
  errors: ValidationError[],
  type?: string,
): void {
  for (const key of Object.keys(value)) {
    if (allowed.has(key)) continue
    errors.push({
      path: `${path}.${key}`,
      message: type
        ? `Unknown field for type "${type}".`
        : 'Unknown field.',
    })
  }
}

function readId(
  value: Record<string, unknown>,
  path: string,
  seen: Set<string>,
  errors: ValidationError[],
): string | null {
  const id = readRequiredString(value, 'id', path, errors)
  if (id === undefined) return null
  if (id.length === 0) {
    errors.push({ path: `${path}.id`, message: 'Must be a non-empty string.' })
    return null
  }
  if (seen.has(id)) {
    errors.push({ path: `${path}.id`, message: `Duplicate id "${id}".` })
    return null
  }
  seen.add(id)
  return id
}

function readNodeType(
  value: Record<string, unknown>,
  path: string,
  errors: ValidationError[],
): CanvasNode['type'] | null {
  if (!('type' in value)) {
    errors.push({ path: `${path}.type`, message: 'Required.' })
    return null
  }
  const type = value.type
  if (typeof type !== 'string' || !NODE_TYPE_SET.has(type)) {
    errors.push({
      path: `${path}.type`,
      message: 'Must be "text", "file", "link", or "group".',
    })
    return null
  }
  return type as CanvasNode['type']
}

function readRequiredString(
  value: Record<string, unknown>,
  key: string,
  path: string,
  errors: ValidationError[],
): string | undefined {
  if (!(key in value)) {
    errors.push({ path: `${path}.${key}`, message: 'Required.' })
    return undefined
  }
  if (typeof value[key] !== 'string') {
    errors.push({ path: `${path}.${key}`, message: 'Must be a string.' })
    return undefined
  }
  return value[key]
}

function readOptionalString(
  value: Record<string, unknown>,
  key: string,
  path: string,
  errors: ValidationError[],
): string | undefined | null {
  if (!(key in value)) return undefined
  if (typeof value[key] !== 'string') {
    errors.push({ path: `${path}.${key}`, message: 'Must be a string.' })
    return null
  }
  return value[key]
}

function readRequiredInteger(
  value: Record<string, unknown>,
  key: string,
  path: string,
  errors: ValidationError[],
): number | undefined {
  if (!(key in value)) {
    errors.push({ path: `${path}.${key}`, message: 'Required.' })
    return undefined
  }
  if (!isInteger(value[key])) {
    errors.push({ path: `${path}.${key}`, message: 'Must be an integer.' })
    return undefined
  }
  return value[key]
}

function readOptionalColor(
  value: Record<string, unknown>,
  path: string,
  errors: ValidationError[],
): string | undefined {
  if (!('color' in value)) return undefined
  const color = value.color
  if (typeof color !== 'string' || (!PRESETS.has(color) && !HEX_COLOR.test(color))) {
    errors.push({
      path: `${path}.color`,
      message: 'Must be a preset "1"–"6" or a #RRGGBB hex color.',
    })
    return undefined
  }
  return color
}

function readOptionalSubpath(
  value: Record<string, unknown>,
  path: string,
  errors: ValidationError[],
): string | undefined | null {
  const subpath = readOptionalString(value, 'subpath', path, errors)
  if (subpath === undefined || subpath === null) return subpath
  if (!subpath.startsWith('#')) {
    errors.push({ path: `${path}.subpath`, message: 'Must start with "#".' })
    return null
  }
  return subpath
}

function readOptionalSide(
  value: Record<string, unknown>,
  key: 'fromSide' | 'toSide',
  path: string,
  errors: ValidationError[],
): Side | undefined | null {
  if (!(key in value)) return undefined
  const side = value[key]
  if (typeof side !== 'string' || !SIDE_SET.has(side)) {
    errors.push({
      path: `${path}.${key}`,
      message: 'Must be "top", "right", "bottom", or "left".',
    })
    return null
  }
  return side as Side
}

function readOptionalEnd(
  value: Record<string, unknown>,
  key: 'fromEnd' | 'toEnd',
  path: string,
  errors: ValidationError[],
): End | undefined | null {
  if (!(key in value)) return undefined
  const end = value[key]
  if (typeof end !== 'string' || !END_SET.has(end)) {
    errors.push({
      path: `${path}.${key}`,
      message: 'Must be "none" or "arrow".',
    })
    return null
  }
  return end as End
}

function readOptionalBackgroundStyle(
  value: Record<string, unknown>,
  path: string,
  errors: ValidationError[],
): BackgroundStyle | undefined | null {
  if (!('backgroundStyle' in value)) return undefined
  const style = value.backgroundStyle
  if (typeof style !== 'string' || !BACKGROUND_SET.has(style)) {
    errors.push({
      path: `${path}.backgroundStyle`,
      message: 'Must be "cover", "ratio", or "repeat".',
    })
    return null
  }
  return style as BackgroundStyle
}
