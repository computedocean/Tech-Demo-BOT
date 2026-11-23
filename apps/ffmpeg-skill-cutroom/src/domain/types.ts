export const EXAMPLE_PROMPT =
  'trim to best 15s, burn captions, reframe 9:16, normalize loudness'

export type ToolName =
  | 'probe'
  | 'scenes'
  | 'cut'
  | 'caption'
  | 'fit'
  | 'loudness'
  | 'export'
  | 'check'

export type StepFlag = {
  name: string
  value: string
}

export type MediaFacts = {
  duration: number | null
  width: number | null
  height: number | null
  hasAudio: boolean
}

export type BestWindow = {
  start: number
  end: number
  seconds: number
  rankBy: 'audio' | 'duration'
  reason: string
}

export type Step = {
  id: string
  tool: ToolName
  summary: string
  flags: StepFlag[]
  toolLine: string
  commands: string[]
  argv: string[][]
  writesMedia: boolean
  note: string
}

export type Plan = {
  prompt: string
  source: string
  bundled: boolean
  facts: MediaFacts
  levels: number[] | null
  steps: Step[]
  best: BestWindow | null
  proxyNote: string
}

export type PlanContext = {
  source: string
  bundled: boolean
  facts: MediaFacts
  levels: number[] | null
}

export type ExportPresetName = 'shorts' | 'reels' | 'x'
