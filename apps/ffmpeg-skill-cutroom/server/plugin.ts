import { createReadStream, mkdirSync, statSync, writeFileSync } from 'node:fs'
import type { IncomingMessage, ServerResponse } from 'node:http'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import type { Connect, Plugin } from 'vite'
import { BUNDLED_FACTS, BUNDLED_LEVELS, PROXY_NOTE } from '../src/domain/sample.ts'
import { executePlan } from '../src/domain/run.ts'
import type { MediaFacts, Plan, StepFlag, ToolName } from '../src/domain/types.ts'
import { commandOnPath, runCommand } from './ffmpeg.ts'
import { llmConfig, rewritePlan } from './llm.ts'
import { probeFile } from './probe.ts'

const TOOLS = new Set<ToolName>(['probe', 'scenes', 'cut', 'caption', 'fit', 'loudness', 'export', 'check'])
const FLAG_NAMES = new Set([
  '--compact',
  '--highlights',
  '--rank-by',
  '--target',
  '--max-scene',
  '--start',
  '--duration',
  '--accurate',
  '--mode',
  '--srt',
  '--font-size',
  '--aspect',
  '--fit',
  '-I',
  '--tp',
  '--lra',
  '--preset',
  '--platform',
  '--normalize',
  '--no-normalize',
])

type RunBody = {
  prompt?: string
  dryRun?: boolean
  source?: { kind?: string; id?: string }
  steps?: Array<{ id?: string; tool?: string; flags?: Array<{ name?: string; value?: string }> }>
}

function sendJson(res: ServerResponse, status: number, body: unknown) {
  res.statusCode = status
  res.setHeader('content-type', 'application/json')
  res.end(JSON.stringify(body))
}

function readBody(req: IncomingMessage, limit: number): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    let size = 0
    req.on('data', (chunk: Buffer | string) => {
      const buf = typeof chunk === 'string' ? Buffer.from(chunk) : chunk
      size += buf.length
      if (size > limit) {
        reject(new Error('body too large'))
        req.destroy()
        return
      }
      chunks.push(buf)
    })
    req.on('end', () => resolve(Buffer.concat(chunks)))
    req.on('error', reject)
  })
}

function inside(root: string, target: string): boolean {
  const base = path.resolve(root)
  const resolved = path.resolve(target)
  return resolved === base || resolved.startsWith(`${base}${path.sep}`)
}

function safeId(value: string | undefined): string | null {
  if (!value || !/^[a-f0-9-]{36}$/i.test(value)) return null
  return value
}

function sendFile(req: IncomingMessage, res: ServerResponse, file: string) {
  const stat = statSync(file)
  const total = stat.size
  const type = file.endsWith('.webm') ? 'video/webm' : 'video/mp4'
  res.setHeader('accept-ranges', 'bytes')
  res.setHeader('content-type', type)
  res.setHeader('cache-control', 'no-store')
  const header = req.headers.range
  if (!header) {
    res.statusCode = 200
    res.setHeader('content-length', total)
    createReadStream(file).pipe(res)
    return
  }
  const match = /^bytes=(\d*)-(\d*)$/.exec(header)
  if (!match) {
    res.statusCode = 416
    res.end()
    return
  }
  const start = match[1] ? Number(match[1]) : 0
  const end = match[2] ? Number(match[2]) : total - 1
  if (!Number.isInteger(start) || !Number.isInteger(end) || start < 0 || end >= total || start > end) {
    res.statusCode = 416
    res.setHeader('content-range', `bytes */${total}`)
    res.end()
    return
  }
  res.statusCode = 206
  res.setHeader('content-range', `bytes ${start}-${end}/${total}`)
  res.setHeader('content-length', String(end - start + 1))
  createReadStream(file, { start, end }).pipe(res)
}

export function cutroomPlugin(appRoot: string): Plugin {
  const outRoot = path.join(appRoot, '.cutroom', 'out')
  const inboxRoot = path.join(appRoot, '.cutroom', 'inbox')
  const samplePath = path.join(appRoot, 'public', 'sample', 'pattern.mp4')
  const srtPath = path.join(appRoot, 'public', 'sample', 'captions.srt')

  const middleware: Connect.NextHandleFunction = async (req, res, next) => {
    const url = new URL(req.url ?? '/', 'http://127.0.0.1')
    const pathname = url.pathname
    if (!pathname.startsWith('/api/')) {
      next()
      return
    }
    try {
      if (req.method === 'GET' && pathname === '/api/doctor') {
        const ffmpeg = commandOnPath('ffmpeg')
        const ffprobe = commandOnPath('ffprobe')
        sendJson(res, 200, {
          ffmpeg,
          ffprobe,
          llm: llmConfig().enabled,
          mode: ffmpeg ? 'local' : 'dry-run',
        })
        return
      }
      if (req.method === 'GET' && pathname === '/api/probe') {
        await handleProbe(req, res, url, samplePath, inboxRoot)
        return
      }
      if (req.method === 'POST' && pathname === '/api/inbox') {
        await handleInbox(req, res, inboxRoot)
        return
      }
      if (req.method === 'POST' && pathname === '/api/run') {
        await handleRun(req, res, { appRoot, samplePath, srtPath, outRoot, inboxRoot })
        return
      }
      if (req.method === 'POST' && pathname === '/api/llm-rewrite') {
        const raw = await readBody(req, 100_000)
        const body = raw.length ? (JSON.parse(raw.toString('utf8')) as { prompt?: string }) : {}
        const result = await rewritePlan(typeof body.prompt === 'string' ? body.prompt : '')
        sendJson(res, 200, result)
        return
      }
      const media = /^\/api\/media\/(out|inbox)\/([^/]+)\/([^/]+)$/.exec(pathname)
      if (req.method === 'GET' && media) {
        const bucket = media[1] === 'out' ? outRoot : inboxRoot
        const id = safeId(media[2])
        const fileName = media[3] ?? ''
        if (!id || !/^[a-zA-Z0-9._-]+$/.test(fileName) || fileName.includes('..')) {
          sendJson(res, 400, { error: 'bad media path' })
          return
        }
        const file = path.join(bucket, id, fileName)
        if (!inside(bucket, file)) {
          sendJson(res, 400, { error: 'bad media path' })
          return
        }
        try {
          statSync(file)
        } catch {
          sendJson(res, 404, { error: 'file not found' })
          return
        }
        sendFile(req, res, file)
        return
      }
      sendJson(res, 404, { error: 'not found' })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'request failed'
      sendJson(res, 400, { error: message })
    }
  }

  return {
    name: 'cutroom-api',
    configureServer(server) {
      server.middlewares.use(middleware)
    },
    configurePreviewServer(server) {
      server.middlewares.use(middleware)
    },
  }
}

async function handleProbe(
  _req: IncomingMessage,
  res: ServerResponse,
  url: URL,
  samplePath: string,
  inboxRoot: string,
) {
  const ffmpeg = commandOnPath('ffprobe')
  if (!ffmpeg) {
    sendJson(res, 200, {
      ok: true,
      skipped: true,
      note: 'probe skipped — dry-run mode',
      probe: null,
    })
    return
  }
  const source = url.searchParams.get('source')
  let file = samplePath
  if (source === 'upload') {
    const id = safeId(url.searchParams.get('id') ?? undefined)
    if (!id) {
      sendJson(res, 400, { error: 'missing upload id' })
      return
    }
    file = path.join(inboxRoot, id, 'source')
    const ext = url.searchParams.get('ext') ?? 'mp4'
    if (!/^(mp4|mov|webm|mkv)$/.test(ext)) {
      sendJson(res, 400, { error: 'unsupported extension' })
      return
    }
    file = `${file}.${ext}`
  }
  const probe = await probeFile(file)
  if (!probe) {
    sendJson(res, 200, { ok: false, skipped: true, note: 'probe skipped — could not read the file', probe: null })
    return
  }
  sendJson(res, 200, { ok: true, skipped: false, note: null, probe })
}

async function handleInbox(req: IncomingMessage, res: ServerResponse, inboxRoot: string) {
  const header = req.headers['x-filename']
  const original = Array.isArray(header) ? header[0] : header
  const base = path.basename(original ?? 'clip.mp4')
  const ext = path.extname(base).slice(1).toLowerCase()
  if (!/^(mp4|mov|webm|mkv)$/.test(ext)) {
    sendJson(res, 400, { error: 'Choose an mp4, mov, webm, or mkv clip.' })
    return
  }
  const bytes = await readBody(req, 40 * 1024 * 1024)
  if (bytes.length < 32) {
    sendJson(res, 400, { error: 'That file is empty.' })
    return
  }
  const id = randomUUID()
  const dir = path.join(inboxRoot, id)
  mkdirSync(dir, { recursive: true })
  const stored = path.join(dir, `source.${ext}`)
  writeFileSync(stored, bytes)
  sendJson(res, 200, { id, name: base, ext })
}

async function handleRun(
  req: IncomingMessage,
  res: ServerResponse,
  paths: { appRoot: string; samplePath: string; srtPath: string; outRoot: string; inboxRoot: string },
) {
  const raw = await readBody(req, 1_000_000)
  const body = JSON.parse(raw.toString('utf8')) as RunBody
  const source = await resolveSource(body, paths.samplePath, paths.inboxRoot)
  if (!source) {
    sendJson(res, 400, { error: 'Choose the synthetic sample or a local clip first.' })
    return
  }
  const steps = sanitizeSteps(body.steps)
  if (!steps) {
    sendJson(res, 400, { error: 'The step list is not valid.' })
    return
  }
  const ffmpeg = commandOnPath('ffmpeg')
  const probed = ffmpeg ? await probeFile(source.file) : null
  const facts: MediaFacts = probed
    ? { duration: probed.duration, width: probed.width, height: probed.height, hasAudio: probed.hasAudio }
    : source.kind === 'sample'
      ? { ...BUNDLED_FACTS }
      : { duration: null, width: null, height: null, hasAudio: true }
  const plan: Plan = {
    prompt: typeof body.prompt === 'string' ? body.prompt : '',
    source: source.file,
    bundled: source.kind === 'sample',
    facts,
    levels: source.kind === 'sample' ? [...BUNDLED_LEVELS] : null,
    steps: steps.map((step) => ({
      id: step.id,
      tool: step.tool,
      summary: step.tool,
      flags: step.flags,
      toolLine: step.tool,
      commands: [],
      argv: [],
      writesMedia: false,
      note: '',
    })),
    best: null,
    proxyNote: PROXY_NOTE,
  }
  const dryRun = body.dryRun === true || !ffmpeg
  const job = randomUUID()
  const outputDir = path.join(paths.outRoot, job)
  const outcome = await executePlan({
    plan,
    outputDir,
    srtPath: paths.srtPath,
    dryRun,
    ffmpegAvailable: ffmpeg,
    declaredInputs: [source.file, paths.srtPath],
    spawn: (argv) => runCommand(argv, paths.appRoot),
  })
  const last = outcome.wroteMedia.at(-1)
  const outputUrl = last ? `/api/media/out/${job}/${path.basename(last)}` : null
  sendJson(res, outcome.ok ? 200 : 400, {
    ok: outcome.ok,
    mode: outcome.mode,
    reason: outcome.reason,
    error: outcome.error,
    refused: outcome.refused,
    outputUrl,
    wroteMedia: outcome.wroteMedia.map((file) => path.basename(file)),
    steps: outcome.steps.map((step) => ({
      id: step.id,
      tool: step.tool,
      summary: step.summary,
      note: step.note,
      toolLine: step.toolLine,
      commands: step.commands,
      flags: step.flags,
      writesMedia: step.writesMedia,
    })),
  })
}

async function resolveSource(
  body: RunBody,
  samplePath: string,
  inboxRoot: string,
): Promise<{ kind: 'sample' | 'upload'; file: string } | null> {
  if (body.source?.kind === 'sample') return { kind: 'sample', file: samplePath }
  if (body.source?.kind === 'upload') {
    const id = safeId(body.source.id)
    if (!id) return null
    for (const ext of ['mp4', 'mov', 'webm', 'mkv']) {
      const file = path.join(inboxRoot, id, `source.${ext}`)
      try {
        statSync(file)
        return { kind: 'upload', file }
      } catch {
        // try the next extension
      }
    }
  }
  return null
}

function sanitizeSteps(
  steps: RunBody['steps'],
): Array<{ id: string; tool: ToolName; flags: StepFlag[] }> | null {
  if (!Array.isArray(steps) || steps.length === 0 || steps.length > 16) return null
  const clean: Array<{ id: string; tool: ToolName; flags: StepFlag[] }> = []
  for (const step of steps) {
    if (!step || typeof step.tool !== 'string' || !TOOLS.has(step.tool as ToolName)) return null
    if (typeof step.id !== 'string' || !/^[a-z0-9-]{1,40}$/.test(step.id)) return null
    if (!Array.isArray(step.flags)) return null
    const flags: StepFlag[] = []
    for (const item of step.flags) {
      if (!item || typeof item.name !== 'string' || typeof item.value !== 'string') return null
      if (!FLAG_NAMES.has(item.name)) return null
      if (item.value.length > 80) return null
      flags.push({ name: item.name, value: item.value })
    }
    clean.push({ id: step.id, tool: step.tool as ToolName, flags })
  }
  return clean
}
