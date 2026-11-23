import { mkdirSync } from 'node:fs'
import path from 'node:path'
import { compile, toolLine, writesMedia } from './commands.ts'
import { findUnsafeDestination, type DestinationRefusal } from './safety.ts'
import type { MediaFacts, Plan, Step, ToolName } from './types.ts'

export type SpawnResult = {
  code: number
  stdout: string
  stderr: string
}

export type SpawnFn = (argv: string[]) => Promise<SpawnResult>

export type RunOutcome = {
  ok: boolean
  mode: 'dry-run' | 'local'
  reason: string
  steps: Step[]
  wroteMedia: string[]
  refused: DestinationRefusal | null
  error: string | null
}

function fileName(tool: ToolName, flags: Step['flags'], used: Map<string, number>): string {
  const preset = flags.find((item) => item.name === '--preset')?.value
  const base = tool === 'export' && preset ? `export-${preset}` : tool
  const seen = used.get(base) ?? 0
  used.set(base, seen + 1)
  return seen === 0 ? `${base}.mp4` : `${base}-${seen + 1}.mp4`
}

export function materializePlan(plan: Plan, outputDir: string, srtPath: string): {
  steps: Step[]
  destinations: string[]
} {
  let current = plan.source
  let facts: MediaFacts = { ...plan.facts }
  const used = new Map<string, number>()
  const steps: Step[] = []
  const destinations: string[] = []
  for (const step of plan.steps) {
    const media = writesMedia(step.tool)
    const output = media ? path.join(outputDir, fileName(step.tool, step.flags, used)) : ''
    const compiled = compile(step.tool, step.flags, {
      input: current,
      output,
      srt: srtPath,
      facts,
    })
    steps.push({
      ...step,
      flags: step.flags.map((item) => ({ ...item })),
      toolLine: toolLine(step.tool, step.flags),
      summary: compiled.summary,
      note: compiled.note,
      commands: compiled.commands,
      argv: compiled.argv,
      writesMedia: compiled.writesMedia,
    })
    if (media) {
      destinations.push(output)
      current = output
    }
    facts = compiled.next
  }
  return { steps, destinations }
}

export async function executePlan(options: {
  plan: Plan
  outputDir: string
  srtPath: string
  dryRun: boolean
  ffmpegAvailable: boolean
  declaredInputs: readonly string[]
  spawn?: SpawnFn
}): Promise<RunOutcome> {
  let materialized: { steps: Step[]; destinations: string[] }
  try {
    materialized = materializePlan(options.plan, options.outputDir, options.srtPath)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Could not build the plan'
    return {
      ok: false,
      mode: 'dry-run',
      reason: message,
      steps: options.plan.steps,
      wroteMedia: [],
      refused: null,
      error: message,
    }
  }

  const refused = findUnsafeDestination(materialized.destinations, [
    ...options.declaredInputs,
    options.plan.source,
    options.srtPath,
  ])
  if (refused) {
    return {
      ok: false,
      mode: options.dryRun || !options.ffmpegAvailable ? 'dry-run' : 'local',
      reason: 'Refused a destination that matches a declared input. The source is left untouched.',
      steps: materialized.steps,
      wroteMedia: [],
      refused,
      error: 'destination matches a declared input',
    }
  }

  if (options.dryRun || !options.ffmpegAvailable) {
    return {
      ok: true,
      mode: 'dry-run',
      reason: options.ffmpegAvailable
        ? 'Dry-run is on. Commands are shown and no media is written.'
        : 'ffmpeg is not on PATH. Dry-run only: the plan and commands are shown, and no media is written.',
      steps: materialized.steps,
      wroteMedia: [],
      refused: null,
      error: null,
    }
  }

  if (!options.spawn) {
    return {
      ok: false,
      mode: 'local',
      reason: 'No local runner was provided.',
      steps: materialized.steps,
      wroteMedia: [],
      refused: null,
      error: 'missing spawn',
    }
  }

  mkdirSync(options.outputDir, { recursive: true })
  const wroteMedia: string[] = []
  for (const step of materialized.steps) {
    for (const argv of step.argv) {
      const result = await options.spawn(argv)
      if (result.code !== 0) {
        const tail = result.stderr.trim().split('\n').slice(-8).join('\n')
        return {
          ok: false,
          mode: 'local',
          reason: `${step.tool} failed`,
          steps: materialized.steps,
          wroteMedia,
          refused: null,
          error: tail || `${step.tool} exited ${result.code}`,
        }
      }
    }
    if (step.writesMedia) {
      const output = step.argv[0]?.at(-1)
      if (output) wroteMedia.push(output)
    }
  }

  return {
    ok: true,
    mode: 'local',
    reason: 'Local encode finished. The source file was not overwritten.',
    steps: materialized.steps,
    wroteMedia,
    refused: null,
    error: null,
  }
}
