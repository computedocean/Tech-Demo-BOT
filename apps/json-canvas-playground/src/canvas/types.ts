/** JSON Canvas 1.0 — https://jsoncanvas.org/spec/1.0/ */

export const NODE_TYPES = ['text', 'file', 'link', 'group'] as const
export const SIDES = ['top', 'right', 'bottom', 'left'] as const
export const ENDS = ['none', 'arrow'] as const
export const BACKGROUND_STYLES = ['cover', 'ratio', 'repeat'] as const
export const PRESET_COLOR_IDS = ['1', '2', '3', '4', '5', '6'] as const

export type NodeType = (typeof NODE_TYPES)[number]
export type Side = (typeof SIDES)[number]
export type End = (typeof ENDS)[number]
export type BackgroundStyle = (typeof BACKGROUND_STYLES)[number]
export type PresetColorId = (typeof PRESET_COLOR_IDS)[number]

interface NodeBase {
  id: string
  x: number
  y: number
  width: number
  height: number
  color?: string
}

export interface TextNode extends NodeBase {
  type: 'text'
  text: string
}

export interface FileNode extends NodeBase {
  type: 'file'
  file: string
  subpath?: string
}

export interface LinkNode extends NodeBase {
  type: 'link'
  url: string
}

export interface GroupNode extends NodeBase {
  type: 'group'
  label?: string
  background?: string
  backgroundStyle?: BackgroundStyle
}

export type CanvasNode = TextNode | FileNode | LinkNode | GroupNode

export interface CanvasEdge {
  id: string
  fromNode: string
  fromSide?: Side
  fromEnd?: End
  toNode: string
  toSide?: Side
  toEnd?: End
  color?: string
  label?: string
}

export interface CanvasFile {
  nodes?: CanvasNode[]
  edges?: CanvasEdge[]
}

export interface ValidationError {
  path: string
  message: string
}

export type ValidationResult =
  | { ok: true; value: CanvasFile }
  | { ok: false; errors: ValidationError[] }
