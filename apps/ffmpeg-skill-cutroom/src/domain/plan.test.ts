import { describe, expect, test } from 'bun:test'
import { mkdtempSync, readdirSync, readFileSync, rmSync, statSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { loudestWindow } from './energy.ts'
import { planEdit, applyExportPreset, EXAMPLE_PROMPT } from './plan.ts'
import { executePlan } from './run.ts'
import { findUnsafeDestination } from './safety.ts'
import { BUNDLED_LEVELS } from './sample.ts'
import { llmConfig } from '../../server/llm.ts'

const root = process.cwd()

function walk(dir: string, found: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry)
    if (entry === 'node_modules' || entry === 'dist' || entry === '.cutroom') continue
    const info = statSync(full)
    if (info.isDirectory()) walk(full, found)
    else found.push(full)
  }
  return found
}

describe('example prompt', () => {
  const plan = planEdit(EXAMPLE_PROMPT)

  test('parses offline into trim, caption burn, 9:16, and loudness', () => {
    const cut = plan.steps.find((step) => step.tool === 'cut')
    const caption = plan.steps.find((step) => step.tool === 'caption')
    const fit = plan.steps.find((step) => step.tool === 'fit')
    const loudness = plan.steps.find((step) => step.tool === 'loudness')
    const probe = plan.steps.find((step) => step.tool === 'probe')
    expect(probe?.toolLine.startsWith('probe')).toBe(true)
    expect(plan.steps.findIndex((step) => step.tool === 'probe')).toBeLessThan(
      plan.steps.findIndex((step) => step.tool === 'cut'),
    )
    expect(cut?.toolLine).toContain('cut')
    expect(cut?.toolLine).toContain('--start')
    expect(cut?.toolLine).toContain('--duration')
    expect(cut?.toolLine).toContain('15')
    expect(cut?.toolLine).toContain('--accurate')
    expect(caption?.toolLine).toContain('caption')
    expect(caption?.toolLine).toContain('--mode')
    expect(caption?.toolLine).toContain('burn')
    expect(fit?.toolLine).toContain('fit')
    expect(fit?.toolLine).toContain('--aspect')
    expect(fit?.toolLine).toContain('9:16')
    expect(fit?.toolLine).toContain('--fit')
    expect(fit?.toolLine).toContain('crop')
    expect(loudness?.toolLine).toContain('loudness')
    expect(loudness?.toolLine).toContain('-I')
    expect(loudness?.toolLine).toContain('-14')
    expect(loudness?.toolLine).toContain('--tp')
    expect(loudness?.toolLine).toContain('-1')
    expect(plan.steps.find((step) => step.tool === 'scenes')?.toolLine).toContain('--rank-by audio')
  })

  test('exposes real ffmpeg command strings', () => {
    const cut = plan.steps.find((step) => step.tool === 'cut')
    const caption = plan.steps.find((step) => step.tool === 'caption')
    const fit = plan.steps.find((step) => step.tool === 'fit')
    const loudness = plan.steps.find((step) => step.tool === 'loudness')
    expect(cut?.commands.join('\n')).toMatch(/^ffmpeg\b/)
    expect(cut?.commands.join('\n')).toMatch(/-ss 5\b/)
    expect(cut?.commands.join('\n')).toMatch(/-t 15\b/)
    expect(cut?.argv[0]?.[0]).toBe('ffmpeg')
    expect(caption?.commands.join('\n')).toMatch(/subtitles=filename=/)
    expect(fit?.commands.join('\n')).toMatch(/crop=202:360:218:0/)
    expect(loudness?.commands.join('\n')).toMatch(/loudnorm=I=-14:TP=-1:LRA=11/)
    for (const step of [cut, caption, fit, loudness]) {
      expect(step?.commands.length).toBeGreaterThan(0)
      expect(step?.argv.every((argv) => argv[0] === 'ffmpeg' || argv[0] === 'ffprobe')).toBe(true)
    }
  })
})

describe('export presets', () => {
  const plan = planEdit(EXAMPLE_PROMPT)

  test('Shorts, Reels, and X map to export --preset', () => {
    for (const preset of ['shorts', 'reels', 'x'] as const) {
      const next = applyExportPreset(plan, preset)
      const exp = next.steps.find((step) => step.tool === 'export')
      const check = next.steps.find((step) => step.tool === 'check')
      expect(exp?.toolLine).toContain(`export --preset ${preset}`)
      expect(check?.toolLine).toContain(`check --platform ${preset}`)
      expect(exp?.commands.join('\n')).toMatch(/^ffmpeg\b/)
      expect(next.steps.filter((step) => step.tool === 'export')).toHaveLength(1)
    }
  })
})

describe('run safety', () => {
  test('dry-run with ffmpeg missing returns the plan and writes no media', async () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'cutroom-'))
    try {
      const plan = planEdit(EXAMPLE_PROMPT)
      let spawned = false
      const result = await executePlan({
        plan,
        outputDir: dir,
        srtPath: 'public/sample/captions.srt',
        dryRun: true,
        ffmpegAvailable: false,
        declaredInputs: [plan.source],
        spawn: async () => {
          spawned = true
          return { code: 0, stdout: '', stderr: '' }
        },
      })
      expect(spawned).toBe(false)
      expect(result.ok).toBe(true)
      expect(result.mode).toBe('dry-run')
      expect(result.wroteMedia).toEqual([])
      expect(result.steps.some((step) => step.commands.some((line) => line.includes('loudnorm=')))).toBe(
        true,
      )
      expect(readdirSync(dir)).toEqual([])
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  test('a destination equal to a declared input is refused', async () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'cutroom-'))
    const source = path.join(dir, 'cut.mp4')
    try {
      const direct = findUnsafeDestination([source], [source])
      expect(direct).toEqual({ destination: source, input: source })
      expect(findUnsafeDestination([path.join(dir, 'other.mp4')], [source])).toBeNull()

      const plan = planEdit(EXAMPLE_PROMPT)
      plan.source = source
      let spawned = false
      const result = await executePlan({
        plan,
        outputDir: dir,
        srtPath: path.join(dir, 'captions.srt'),
        dryRun: false,
        ffmpegAvailable: true,
        declaredInputs: [source],
        spawn: async () => {
          spawned = true
          return { code: 0, stdout: '', stderr: '' }
        },
      })
      expect(spawned).toBe(false)
      expect(result.ok).toBe(false)
      expect(result.refused?.destination).toBe(source)
      expect(result.wroteMedia).toEqual([])
      expect(readdirSync(dir)).toEqual([])
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })
})

describe('best N seconds', () => {
  test('is deterministic on the bundled sample', () => {
    const first = loudestWindow(BUNDLED_LEVELS, 15)
    const second = loudestWindow(BUNDLED_LEVELS, 15)
    expect(second).toEqual(first)
    expect(first.start).toBe(5)
    expect(first.end).toBe(20)
    expect(first.seconds).toBe(15)
    const plan = planEdit(EXAMPLE_PROMPT)
    expect(plan.best).toMatchObject({ start: 5, end: 20, seconds: 15, rankBy: 'audio' })
    expect(planEdit(EXAMPLE_PROMPT).best).toEqual(plan.best)
    const tied = loudestWindow([1, 1, 1, 1], 2)
    expect(tied.start).toBe(0)
  })
})

describe('secrets', () => {
  test('optional LLM is off by default and client source has no API keys', () => {
    expect(llmConfig({}).enabled).toBe(false)
    expect(
      llmConfig({
        CUTROOM_LLM_API_KEY: '',
        CUTROOM_LLM_BASE_URL: 'http://127.0.0.1:9',
        CUTROOM_LLM_MODEL: 'local',
      }).enabled,
    ).toBe(false)
    expect(
      llmConfig({
        CUTROOM_LLM_API_KEY: 'present',
        CUTROOM_LLM_BASE_URL: 'http://127.0.0.1:9',
        CUTROOM_LLM_MODEL: 'local',
      }).enabled,
    ).toBe(true)

    const clientFiles = walk(path.join(root, 'src')).filter(
      (file) => !file.endsWith('.test.ts') && /\.(ts|tsx|css|js|jsx)$/.test(file),
    )
    const client = clientFiles.map((file) => readFileSync(file, 'utf8')).join('\n')
    expect(client).not.toMatch(/VITE_/)
    expect(client).not.toMatch(/CUTROOM_LLM/)
    expect(client).not.toMatch(/sk-[A-Za-z0-9]{8,}/)
    expect(client).not.toMatch(/process\.env/)
    expect(client).not.toMatch(/from ['"][^'"]*server\//)

    const llm = readFileSync(path.join(root, 'server/llm.ts'), 'utf8')
    expect(llm).not.toMatch(/VITE_/)
    const ffmpeg = readFileSync(path.join(root, 'server/ffmpeg.ts'), 'utf8')
    expect(ffmpeg).toContain('shell: false')
    expect(ffmpeg).not.toContain('shell: true')
    const example = readFileSync(path.join(root, '.env.example'), 'utf8')
    expect(example).not.toMatch(/VITE_/)
    expect(example).toMatch(/CUTROOM_LLM_API_KEY=\s*$/m)
  })
})
