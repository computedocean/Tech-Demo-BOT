import { compile, toolLine, writesMedia } from './commands.ts'
import { loudestWindow } from './energy.ts'
import { EXPORT_PRESETS } from './presets.ts'
import { BUNDLED_FACTS, BUNDLED_LEVELS, BUNDLED_SAMPLE, PROXY_NOTE } from './sample.ts'
import type {
  BestWindow,
  ExportPresetName,
  MediaFacts,
  Plan,
  PlanContext,
  Step,
  StepFlag,
  ToolName,
} from './types.ts'
import { EXAMPLE_PROMPT } from './types.ts'

export { EXAMPLE_PROMPT }

const PLAN_DIR = '.cutroom/out/plan'

export function bundledContext(): PlanContext {
  return {
    source: BUNDLED_SAMPLE.sourcePath,
    bundled: true,
    facts: { ...BUNDLED_FACTS },
    levels: [...BUNDLED_LEVELS],
  }
}

type Intent = {
  trim: boolean
  best: boolean
  seconds: number | null
  captions: boolean
  reframe: boolean
  loudness: boolean
}

function parseIntent(prompt: string): Intent {
  const text = prompt.toLowerCase()
  const best = text.match(/best\s+(\d+(?:\.\d+)?)\s*(?:s|sec|secs|seconds)\b/)
  const trimTo = text.match(/trim(?:\s+\w+){0,4}?\s+(\d+(?:\.\d+)?)\s*(?:s|sec|secs|seconds)\b/)
  const anySeconds = text.match(/(\d+(?:\.\d+)?)\s*(?:s|sec|secs|seconds)\b/)
  const seconds = best
    ? Number(best[1])
    : trimTo
      ? Number(trimTo[1])
      : anySeconds && /trim|best|keep/.test(text)
        ? Number(anySeconds[1])
        : null
  const wantsTrim = /trim|cut to|keep the/.test(text) || best !== null || seconds !== null
  return {
    trim: wantsTrim,
    best: best !== null || /best\b/.test(text),
    seconds,
    captions: /caption|subtitle|burn/.test(text),
    reframe: /9\s*:\s*16|9\s*\/\s*16|vertical|portrait|reframe/.test(text),
    loudness: /loud|lufs|normali[sz]e|gain/.test(text),
  }
}

function flags(...pairs: Array<[string, string] | [string]>): StepFlag[] {
  return pairs.map(([name, value]) => ({ name, value: value ?? '' }))
}

function outputName(tool: ToolName, flagsForTool: readonly StepFlag[], used: Map<string, number>): string {
  const preset = flagsForTool.find((item) => item.name === '--preset')?.value
  const base = preset && tool === 'export' ? `export-${preset}` : tool
  const seen = used.get(base) ?? 0
  used.set(base, seen + 1)
  return seen === 0 ? `${base}.mp4` : `${base}-${seen + 1}.mp4`
}

export function assemble(steps: Array<Omit<Step, 'commands' | 'argv' | 'toolLine' | 'writesMedia' | 'summary' | 'note'> & {
  summary?: string
  note?: string
}>, source: string, facts: MediaFacts, srt: string, outputDir: string): Step[] {
  let current = source
  let media: MediaFacts = { ...facts }
  const used = new Map<string, number>()
  const built: Step[] = []
  for (const draft of steps) {
    const mediaOut = writesMedia(draft.tool)
    const output = mediaOut ? `${outputDir.replace(/\/$/, '')}/${outputName(draft.tool, draft.flags, used)}` : ''
    const compiled = compile(draft.tool, draft.flags, {
      input: current,
      output,
      srt,
      facts: media,
    })
    built.push({
      id: draft.id,
      tool: draft.tool,
      flags: draft.flags.map((item) => ({ ...item })),
      toolLine: toolLine(draft.tool, draft.flags),
      summary: compiled.summary,
      note: compiled.note,
      commands: compiled.commands,
      argv: compiled.argv,
      writesMedia: compiled.writesMedia,
    })
    media = compiled.next
    if (mediaOut) current = output
  }
  return built
}

function chooseWindow(intent: Intent, ctx: PlanContext): BestWindow | null {
  if (!intent.trim || intent.seconds === null) return null
  const seconds = intent.seconds
  if (intent.best && ctx.levels && ctx.levels.length > 0) {
    const window = loudestWindow(ctx.levels, seconds)
    return {
      start: window.start,
      end: window.end,
      seconds: window.seconds,
      rankBy: 'audio',
      reason:
        'Loudest contiguous window by mean power per second (scenes --rank-by audio). Not a semantic quality score.',
    }
  }
  const available = ctx.facts.duration
  const width =
    available === null ? Math.round(seconds) : Math.min(Math.round(seconds), Math.max(0, available))
  return {
    start: 0,
    end: width,
    seconds: width,
    rankBy: 'duration',
    reason:
      'No per-second energy was available, so the window is the opening duration proxy (scenes --rank-by duration), not a quality model.',
  }
}

export function planEdit(prompt: string, ctx: PlanContext = bundledContext()): Plan {
  const intent = parseIntent(prompt)
  const best = chooseWindow(intent, ctx)
  const drafts: Array<{ id: string; tool: ToolName; flags: StepFlag[] }> = [
    { id: 'probe', tool: 'probe', flags: [{ name: '--compact', value: '' }] },
  ]
  if (intent.trim && best) {
    drafts.push({
      id: 'scenes',
      tool: 'scenes',
      flags: flags(
        ['--highlights', '1'],
        ['--rank-by', best.rankBy],
        ['--target', String(best.seconds)],
        ['--max-scene', String(best.seconds)],
      ),
    })
    drafts.push({
      id: 'cut',
      tool: 'cut',
      flags: flags(['--start', String(best.start)], ['--duration', String(best.seconds)], ['--accurate']),
    })
  }
  if (intent.reframe) {
    drafts.push({
      id: 'fit',
      tool: 'fit',
      flags: flags(['--aspect', '9:16'], ['--fit', 'crop']),
    })
  }
  if (intent.captions) {
    drafts.push({
      id: 'caption',
      tool: 'caption',
      flags: flags(['--mode', 'burn'], ['--srt', 'captions.srt'], ['--font-size', '13']),
    })
  }
  if (intent.loudness) {
    drafts.push({
      id: 'loudness',
      tool: 'loudness',
      flags: flags(['-I', '-14'], ['--tp', '-1'], ['--lra', '11']),
    })
  }
  const steps = assemble(drafts, ctx.source, ctx.facts, BUNDLED_SAMPLE.captionsPath, PLAN_DIR)
  return {
    prompt,
    source: ctx.source,
    bundled: ctx.bundled,
    facts: { ...ctx.facts },
    levels: ctx.levels ? [...ctx.levels] : null,
    steps,
    best,
    proxyNote: PROXY_NOTE,
  }
}

function rechain(plan: Plan, steps: Step[]): Plan {
  const drafts = steps.map((step) => ({
    id: step.id,
    tool: step.tool,
    flags: step.flags.map((item) => ({ ...item })),
  }))
  return {
    ...plan,
    steps: assemble(drafts, plan.source, plan.facts, BUNDLED_SAMPLE.captionsPath, PLAN_DIR),
  }
}

export function updateFlag(plan: Plan, stepId: string, name: string, value: string): Plan {
  const steps = plan.steps.map((step) => {
    if (step.id !== stepId) return step
    return {
      ...step,
      flags: step.flags.map((item) => (item.name === name ? { ...item, value } : item)),
    }
  })
  return rechain(plan, steps)
}

export function removeStep(plan: Plan, stepId: string): Plan {
  return rechain(
    plan,
    plan.steps.filter((step) => step.id !== stepId),
  )
}

export function moveStep(plan: Plan, stepId: string, direction: -1 | 1): Plan {
  const index = plan.steps.findIndex((step) => step.id === stepId)
  const next = index + direction
  if (index < 0 || next < 0 || next >= plan.steps.length) return plan
  const steps = [...plan.steps]
  const [moved] = steps.splice(index, 1)
  if (!moved) return plan
  steps.splice(next, 0, moved)
  return rechain(plan, steps)
}

export function applyExportPreset(plan: Plan, preset: ExportPresetName): Plan {
  const delivery = EXPORT_PRESETS[preset]
  const kept = plan.steps.filter((step) => step.tool !== 'export' && step.tool !== 'check')
  const normalizeFlag: StepFlag = kept.some((step) => step.tool === 'loudness')
    ? { name: '--no-normalize', value: '' }
    : { name: '--normalize', value: '' }
  const drafts = [
    ...kept.map((step) => ({
      id: step.id,
      tool: step.tool,
      flags: step.flags.map((item) => ({ ...item })),
    })),
    {
      id: 'export',
      tool: 'export' as const,
      flags: [...flags(['--preset', preset], ['--fit', delivery.fit]), normalizeFlag],
    },
    {
      id: 'check',
      tool: 'check' as const,
      flags: flags(['--platform', preset]),
    },
  ]
  return {
    ...plan,
    steps: assemble(drafts, plan.source, plan.facts, BUNDLED_SAMPLE.captionsPath, PLAN_DIR),
  }
}

export type PlannedFacts = {
  duration: number | null
  aspect: string | null
  width: number | null
  height: number | null
  loudness: string | null
  preset: string | null
  captions: boolean
}

export function plannedFacts(plan: Plan): PlannedFacts {
  let duration = plan.best?.seconds ?? plan.facts.duration
  let aspect: string | null = null
  let width = plan.facts.width
  let height = plan.facts.height
  let loudness: string | null = null
  let preset: string | null = null
  let captions = false
  for (const step of plan.steps) {
    if (step.tool === 'cut') {
      const value = step.flags.find((item) => item.name === '--duration')?.value
      if (value) duration = Number(value)
    }
    if (step.tool === 'fit') {
      aspect = step.flags.find((item) => item.name === '--aspect')?.value ?? aspect
    }
    if (step.tool === 'caption') captions = true
    if (step.tool === 'loudness') {
      const lufs = step.flags.find((item) => item.name === '-I')?.value ?? '-14'
      const tp = step.flags.find((item) => item.name === '--tp')?.value ?? '-1'
      loudness = `${lufs} LUFS / ${tp} dBTP`
    }
    if (step.tool === 'export') {
      preset = step.flags.find((item) => item.name === '--preset')?.value ?? preset
      if (preset === 'shorts' || preset === 'reels' || preset === 'x') {
        width = EXPORT_PRESETS[preset].width
        height = EXPORT_PRESETS[preset].height
        aspect = `${EXPORT_PRESETS[preset].width}:${EXPORT_PRESETS[preset].height}`
      }
    }
  }
  return { duration, aspect, width, height, loudness, preset, captions }
}
