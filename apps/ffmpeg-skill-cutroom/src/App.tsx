import { useEffect, useMemo, useRef, useState } from 'react'
import { Badge } from '@/components/ui/badge.tsx'
import { Button } from '@/components/ui/button.tsx'
import { Label } from '@/components/ui/label.tsx'
import { Textarea } from '@/components/ui/textarea.tsx'
import { DeskFooter } from '@/components/footer.tsx'
import { StepList } from '@/components/step-list.tsx'
import { applyExportPreset, bundledContext, moveStep, planEdit, plannedFacts, removeStep, updateFlag } from '@/domain/plan.ts'
import { BUNDLED_SAMPLE, PROXY_NOTE } from '@/domain/sample.ts'
import { EXAMPLE_PROMPT, type ExportPresetName, type MediaFacts, type Plan } from '@/domain/types.ts'

type Doctor = {
  ffmpeg: boolean
  ffprobe: boolean
  llm: boolean
  mode: 'local' | 'dry-run'
}

type ProbeView = {
  skipped: boolean
  note: string | null
  duration: number | null
  width: number | null
  height: number | null
  hasAudio: boolean
  fps: string | null
  size: number | null
}

type Clip =
  | { kind: 'sample'; name: string; url: string }
  | { kind: 'upload'; id: string; name: string; url: string; ext: string }

type RunResponse = {
  ok: boolean
  mode: 'dry-run' | 'local'
  reason: string
  error: string | null
  outputUrl: string | null
  steps: Array<{
    id: string
    toolLine: string
    summary: string
    note: string
    commands: string[]
  }>
}

const EMPTY_FACTS: MediaFacts = { duration: null, width: null, height: null, hasAudio: true }

export default function App() {
  const fileRef = useRef<HTMLInputElement>(null)
  const [doctor, setDoctor] = useState<Doctor | null>(null)
  const [clip, setClip] = useState<Clip | null>(null)
  const [probe, setProbe] = useState<ProbeView | null>(null)
  const [prompt, setPrompt] = useState('')
  const [plan, setPlan] = useState<Plan | null>(null)
  const [flagError, setFlagError] = useState<string | null>(null)
  const [dryRun, setDryRun] = useState(false)
  const [status, setStatus] = useState<string | null>(null)
  const [running, setRunning] = useState(false)
  const [outputUrl, setOutputUrl] = useState<string | null>(null)
  const [runMode, setRunMode] = useState<'dry-run' | 'local' | null>(null)
  const [llmNote, setLlmNote] = useState<string | null>(null)
  const [dragging, setDragging] = useState(false)

  useEffect(() => {
    void fetch('/api/doctor')
      .then((response) => response.json() as Promise<Doctor>)
      .then((body) => {
        setDoctor(body)
        if (!body.ffmpeg) setDryRun(true)
      })
      .catch(() => {
        setDoctor({ ffmpeg: false, ffprobe: false, llm: false, mode: 'dry-run' })
        setDryRun(true)
      })
  }, [])

  const ffmpegReady = doctor?.ffmpeg === true
  const forcedDry = !ffmpegReady
  const facts = useMemo(() => factsFromProbe(probe), [probe])
  const preview = plan ? plannedFacts(plan) : null

  async function loadProbe(next: Clip) {
    const query =
      next.kind === 'sample'
        ? '/api/probe?source=sample'
        : `/api/probe?source=upload&id=${next.id}&ext=${next.ext}`
    const response = await fetch(query)
    const body = (await response.json()) as {
      skipped?: boolean
      note?: string | null
      probe?: ProbeView | null
    }
    if (body.probe) {
      setProbe({
        skipped: false,
        note: null,
        duration: body.probe.duration,
        width: body.probe.width,
        height: body.probe.height,
        hasAudio: body.probe.hasAudio,
        fps: body.probe.fps,
        size: body.probe.size,
      })
      return
    }
    setProbe({
      skipped: true,
      note: body.note ?? 'probe skipped — dry-run mode',
      ...EMPTY_FACTS,
      fps: null,
      size: null,
    })
  }

  function chooseSample() {
    const next: Clip = { kind: 'sample', name: BUNDLED_SAMPLE.label, url: BUNDLED_SAMPLE.publicUrl }
    setClip(next)
    setPlan(null)
    setOutputUrl(null)
    setRunMode(null)
    setStatus(null)
    void loadProbe(next)
  }

  async function takeFile(file: File) {
    const url = URL.createObjectURL(file)
    setStatus('Saving the clip on this machine…')
    const response = await fetch('/api/inbox', {
      method: 'POST',
      headers: { 'x-filename': file.name },
      body: file,
    })
    const body = (await response.json()) as { id?: string; name?: string; ext?: string; error?: string }
    if (!response.ok || !body.id || !body.ext) {
      setStatus(body.error ?? 'Could not keep that file locally.')
      return
    }
    const next: Clip = { kind: 'upload', id: body.id, name: body.name ?? file.name, url, ext: body.ext }
    setClip(next)
    setPlan(null)
    setOutputUrl(null)
    setRunMode(null)
    setStatus(null)
    await loadProbe(next)
  }

  function buildPlan(text: string) {
    if (!clip) {
      setStatus('Choose the synthetic sample or a clip first.')
      return
    }
    const ctx =
      clip.kind === 'sample'
        ? bundledContext()
        : {
            source: 'upload.mp4',
            bundled: false,
            facts: facts ?? EMPTY_FACTS,
            levels: null,
          }
    let next: Plan
    try {
      next = planEdit(text, ctx)
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Could not plan that edit.')
      return
    }
    setPlan(next)
    setFlagError(null)
    setOutputUrl(null)
    setRunMode(null)
    setStatus(null)
  }

  function editFlag(stepId: string, name: string, value: string) {
    if (!plan) return
    try {
      setPlan(updateFlag(plan, stepId, name, value))
      setFlagError(null)
    } catch (error) {
      setFlagError(error instanceof Error ? error.message : 'That flag is not valid.')
    }
  }

  async function runPlan() {
    if (!plan || !clip) return
    setRunning(true)
    setStatus(forcedDry || dryRun ? 'Preparing a dry-run…' : 'Running ffmpeg locally…')
    setOutputUrl(null)
    try {
      const response = await fetch('/api/run', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          prompt,
          dryRun: forcedDry || dryRun,
          source: clip.kind === 'sample' ? { kind: 'sample' } : { kind: 'upload', id: clip.id },
          steps: plan.steps.map((step) => ({ id: step.id, tool: step.tool, flags: step.flags })),
        }),
      })
      const body = (await response.json()) as RunResponse
      setRunMode(body.mode)
      setStatus(body.error ? `${body.reason}: ${body.error}` : body.reason)
      setOutputUrl(body.outputUrl)
      if (body.steps?.length) {
        setPlan({
          ...plan,
          steps: plan.steps.map((step) => {
            const updated = body.steps.find((item) => item.id === step.id)
            if (!updated) return step
            return {
              ...step,
              toolLine: updated.toolLine,
              summary: updated.summary,
              note: updated.note,
              commands: updated.commands,
            }
          }),
        })
      }
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'The run failed.')
    } finally {
      setRunning(false)
    }
  }

  async function askLlm() {
    const response = await fetch('/api/llm-rewrite', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ prompt }),
    })
    const body = (await response.json()) as { message?: string }
    setLlmNote(body.message ?? 'Optional LLM rewrite is off.')
  }

  function retarget(preset: ExportPresetName) {
    if (!plan) {
      setStatus('Plan an edit before choosing a delivery preset.')
      return
    }
    setPlan(applyExportPreset(plan, preset))
    setStatus(`Added export --preset ${preset} and check --platform ${preset}. The preview still shows the last encode.`)
  }

  return (
    <div className="min-h-screen">
      <header className="border-b border-foreground/10 bg-card/80">
        <div className="mx-auto flex max-w-6xl flex-wrap items-end justify-between gap-3 px-4 py-4">
          <div>
            <p className="text-[11px] tracking-[0.16em] text-muted-foreground uppercase">Independent demo</p>
            <h1 className="text-2xl font-medium tracking-tight">Cut room</h1>
            <p className="max-w-xl text-sm text-muted-foreground">
              A plain-English edit becomes ffmpeg-skill tool calls and the ffmpeg commands this subset runs.
            </p>
          </div>
          <Badge data-testid="doctor" variant={ffmpegReady ? 'secondary' : 'outline'}>
            {doctor === null ? 'Checking ffmpeg…' : ffmpegReady ? 'ffmpeg on PATH' : 'Dry-run — ffmpeg missing'}
          </Badge>
        </div>
      </header>

      <main className="mx-auto grid max-w-6xl gap-6 px-4 py-6 lg:grid-cols-[340px_minmax(0,1fr)]">
        <div className="flex flex-col gap-4">
          <section className="rounded-xl bg-card p-4 ring-1 ring-foreground/10">
            <h2 className="text-sm font-medium">Clip</h2>
            <div
              className={`mt-3 rounded-lg border border-dashed px-3 py-6 text-center text-sm ${dragging ? 'border-foreground bg-muted' : 'border-foreground/20'}`}
              onDragOver={(event) => {
                event.preventDefault()
                setDragging(true)
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={(event) => {
                event.preventDefault()
                setDragging(false)
                const file = event.dataTransfer.files[0]
                if (file) void takeFile(file)
              }}
            >
              Drop a short clip, or pick one below.
              <p className="mt-1 text-xs text-muted-foreground">It stays on this machine.</p>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button type="button" data-testid="use-sample" onClick={chooseSample}>
                Use synthetic sample
              </Button>
              <Button type="button" variant="outline" onClick={() => fileRef.current?.click()}>
                Choose file
              </Button>
              <input
                ref={fileRef}
                className="hidden"
                type="file"
                accept="video/mp4,video/quicktime,video/webm,video/x-matroska"
                onChange={(event) => {
                  const file = event.target.files?.[0]
                  if (file) void takeFile(file)
                }}
              />
            </div>
            <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
              The bundled sample is a synthetic test pattern (ffmpeg testsrc2 and sine), not a recording.
            </p>
            {clip ? (
              <p className="mt-2 text-sm" data-testid="clip-name">
                {clip.name}
              </p>
            ) : null}
            {probe ? (
              <p className="mt-1 text-xs text-muted-foreground" data-testid="probe">
                {probe.skipped
                  ? probe.note
                  : `${formatSeconds(probe.duration)} · ${probe.width ?? '—'}×${probe.height ?? '—'} · ${formatFps(probe.fps)} · ${probe.hasAudio ? 'audio' : 'no audio'} · ${formatSize(probe.size)}`}
              </p>
            ) : null}
          </section>

          <section className="rounded-xl bg-card p-4 ring-1 ring-foreground/10">
            <Label htmlFor="edit-prompt">Edit</Label>
            <Textarea
              id="edit-prompt"
              data-testid="prompt"
              className="mt-2 min-h-24"
              value={prompt}
              placeholder={EXAMPLE_PROMPT}
              onChange={(event) => setPrompt(event.target.value)}
            />
            <button
              type="button"
              data-testid="example-chip"
              className="mt-2 text-left text-xs text-muted-foreground underline-offset-2 hover:underline"
              onClick={() => setPrompt(EXAMPLE_PROMPT)}
            >
              {EXAMPLE_PROMPT}
            </button>
            <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{PROXY_NOTE}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button type="button" data-testid="plan-button" onClick={() => buildPlan(prompt || EXAMPLE_PROMPT)}>
                Plan edit
              </Button>
              <Button type="button" variant="outline" data-testid="run-button" disabled={!plan || running} onClick={() => void runPlan()}>
                {forcedDry || dryRun ? 'Dry-run plan' : 'Run locally'}
              </Button>
            </div>
            <label className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
              <input
                data-testid="dry-run-toggle"
                type="checkbox"
                checked={forcedDry || dryRun}
                disabled={forcedDry}
                onChange={(event) => setDryRun(event.target.checked)}
              />
              Dry-run only (show commands, write no media)
            </label>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button type="button" size="sm" variant="outline" data-testid="export-shorts" onClick={() => retarget('shorts')}>
                Shorts
              </Button>
              <Button type="button" size="sm" variant="outline" data-testid="export-reels" onClick={() => retarget('reels')}>
                Reels
              </Button>
              <Button type="button" size="sm" variant="outline" data-testid="export-x" onClick={() => retarget('x')}>
                X
              </Button>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              Presets add <span className="font-mono">export --preset shorts|reels|x</span> and a matching check.
              Nothing is uploaded.
            </p>
            <Button type="button" variant="ghost" size="sm" className="mt-2 px-0" onClick={() => void askLlm()}>
              {doctor?.llm ? 'Rewrite wording on the server' : 'LLM rewrite is off'}
            </Button>
            {llmNote ? <p className="text-xs text-muted-foreground">{llmNote}</p> : null}
            {status ? (
              <p className="mt-2 text-sm" data-testid="run-status">
                {status}
              </p>
            ) : null}
          </section>
        </div>

        <div className="flex flex-col gap-6">
          {plan ? (
            <StepList
              plan={plan}
              flagError={flagError}
              onFlag={editFlag}
              onRemove={(id) => {
                setPlan(removeStep(plan, id))
                setOutputUrl(null)
              }}
              onMove={(id, direction) => {
                setPlan(moveStep(plan, id, direction))
                setOutputUrl(null)
              }}
            />
          ) : (
            <section className="rounded-xl bg-card p-6 text-sm text-muted-foreground ring-1 ring-foreground/10">
              Plan an edit to see the tool calls and the ffmpeg commands under each one.
            </section>
          )}

          <section className="grid gap-4 md:grid-cols-2" data-testid="preview">
            <div>
              <h2 className="mb-2 text-sm font-medium">Before</h2>
              {clip ? (
                <video
                  key={clip.url}
                  data-testid="preview-source"
                  className="aspect-video w-full rounded-lg bg-black"
                  controls
                  playsInline
                  preload="auto"
                  src={clip.url}
                />
              ) : (
                <div className="flex aspect-video items-center justify-center rounded-lg bg-muted text-xs text-muted-foreground">
                  No clip yet
                </div>
              )}
            </div>
            <div>
              <h2 className="mb-2 text-sm font-medium">After</h2>
              {outputUrl && runMode === 'local' ? (
                <video
                  key={outputUrl}
                  data-testid="preview-output"
                  className={
                    preview?.preset === 'x'
                      ? 'aspect-video w-full rounded-lg bg-black'
                      : 'mx-auto aspect-[9/16] w-full max-w-[240px] rounded-lg bg-black'
                  }
                  controls
                  playsInline
                  preload="auto"
                  src={outputUrl}
                />
              ) : (
                <div
                  data-testid="dry-run-plan"
                  className="flex min-h-40 flex-col justify-center gap-1 rounded-lg bg-muted px-4 py-5 text-sm"
                >
                  <p className="font-medium">
                    {runMode === 'dry-run' ? 'Dry-run — no media written' : 'Planned output'}
                  </p>
                  <p className="text-xs leading-relaxed text-muted-foreground">
                    {preview
                      ? `${preview.captions ? 'Captions burned' : 'No captions'} · ${preview.aspect ?? 'source aspect'} · ${preview.duration ?? '—'}s · ${preview.loudness ?? 'loudness unchanged'}${preview.preset ? ` · ${preview.preset}` : ''}`
                      : 'Run the plan, or dry-run it, to fill this in. This is not a rendered file.'}
                  </p>
                </div>
              )}
              {outputUrl && runMode === 'local' ? (
                <a className="mt-2 inline-block text-xs underline" href={outputUrl} download>
                  Download the local file
                </a>
              ) : null}
            </div>
          </section>
        </div>
      </main>
      <DeskFooter />
    </div>
  )
}

function factsFromProbe(probe: ProbeView | null): MediaFacts | null {
  if (!probe || probe.skipped) return null
  return {
    duration: probe.duration,
    width: probe.width,
    height: probe.height,
    hasAudio: probe.hasAudio,
  }
}

function formatSeconds(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return 'duration unknown'
  return `${value.toFixed(2)}s`
}

function formatFps(value: string | null): string {
  if (!value) return 'fps unknown'
  const [num, den] = value.split('/')
  const n = Number(num)
  const d = Number(den ?? 1)
  if (!Number.isFinite(n) || !Number.isFinite(d) || d === 0) return value
  const fps = n / d
  return `${Number.isInteger(fps) ? fps : fps.toFixed(2)} fps`
}

function formatSize(value: number | null): string {
  if (value === null) return 'size unknown'
  if (value < 1024 * 1024) return `${Math.max(1, Math.round(value / 1024))} KB`
  return `${(value / (1024 * 1024)).toFixed(1)} MB`
}
