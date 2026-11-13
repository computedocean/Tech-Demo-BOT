import { useCallback, useEffect, useRef, useState } from "react"
import { summarizeJobs } from "../shared/jobs.ts"
import type { AnimationPreset, JobView, LabMode } from "../shared/types.ts"
import { Viewer } from "@/components/viewer"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { downloadRig, fetchAnimations, fetchMode, fetchStatus, submitRig, wait } from "@/lib/api"

const CATEGORIES = ["all", "human", "canine", "bird"] as const
const DOCS = "https://docs.hyper3d.ai/en/api-specification/rigging"

export default function App() {
  const [mode, setMode] = useState<LabMode | null>(null)
  const [animations, setAnimations] = useState<AnimationPreset[]>([])
  const [category, setCategory] = useState<(typeof CATEGORIES)[number]>("all")
  const [modelFile, setModelFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [resultUrl, setResultUrl] = useState<string | null>(null)
  const [boneTemplate, setBoneTemplate] = useState<"auto" | "custom">("auto")
  const [prompt, setPrompt] = useState("A biped with two arms, two legs, and a head.")
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [selected, setSelected] = useState<string[]>(["demo_walk"])
  const [inPlace, setInPlace] = useState(true)
  const [jobs, setJobs] = useState<JobView[]>([])
  const [polls, setPolls] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [clips, setClips] = useState<string[]>([])
  const [clip, setClip] = useState("")
  const [playing, setPlaying] = useState(false)
  const [showBones, setShowBones] = useState(false)
  const [resetKey, setResetKey] = useState(0)
  const [dragging, setDragging] = useState(false)
  const runRef = useRef(0)
  const resultUrlRef = useRef<string | null>(null)

  useEffect(() => {
    void fetchMode()
      .then((payload) => setMode(payload.mode))
      .catch((cause: unknown) => setError(cause instanceof Error ? cause.message : "Could not read the lab mode."))
  }, [])

  useEffect(() => {
    void fetchAnimations(category)
      .then((payload) => setAnimations(payload.animations))
      .catch((cause: unknown) => setError(cause instanceof Error ? cause.message : "Could not load animation presets."))
  }, [category])

  useEffect(() => {
    if (!modelFile) {
      setPreviewUrl(null)
      return
    }
    const url = URL.createObjectURL(modelFile)
    setPreviewUrl(url)
    setResultUrl(null)
    resultUrlRef.current = null
    setClips([])
    setClip("")
    setPlaying(false)
    return () => URL.revokeObjectURL(url)
  }, [modelFile])

  useEffect(() => {
    return () => {
      if (resultUrlRef.current) URL.revokeObjectURL(resultUrlRef.current)
    }
  }, [])

  const onClips = useCallback((names: string[]) => {
    setClips(names)
    setClip((current) => (current && names.includes(current) ? current : (names[0] ?? "")))
  }, [])

  function takeModel(file: File | null) {
    if (!file) return
    if (!file.name.toLowerCase().endsWith(".glb")) {
      setError("Upload a .glb model.")
      return
    }
    setError(null)
    setJobs([])
    setPolls(0)
    setModelFile(file)
  }

  async function loadSample() {
    const response = await fetch("/samples/unrigged-figure.glb")
    if (!response.ok) {
      setError("The sample mesh could not be loaded.")
      return
    }
    const blob = await response.blob()
    takeModel(new File([blob], "unrigged-figure.glb", { type: "model/gltf-binary" }))
  }

  function togglePreset(id: string) {
    setSelected((current) => {
      if (current.includes(id)) {
        const next = current.filter((item) => item !== id)
        if (next.length === 0) setInPlace(false)
        return next
      }
      if (current.length >= 10) return current
      return [...current, id]
    })
  }

  async function onRig() {
    if (!modelFile || busy) return
    if (boneTemplate === "custom" && !prompt.trim()) {
      setError("Enter a skeleton prompt.")
      return
    }
    const run = ++runRef.current
    setBusy(true)
    setError(null)
    setJobs([])
    setPolls(0)
    setPlaying(false)
    if (resultUrlRef.current) URL.revokeObjectURL(resultUrlRef.current)
    resultUrlRef.current = null
    setResultUrl(null)
    try {
      const form = new FormData()
      form.append("model", modelFile, modelFile.name)
      form.append("bone_template", boneTemplate)
      if (boneTemplate === "custom") form.append("skeleton_description", prompt.trim())
      for (const id of selected) form.append("animation_preset", id)
      if (inPlace && selected.length > 0) form.append("in_place", "true")
      if (imageFile) form.append("image", imageFile, imageFile.name)
      const accepted = await submitRig(form)
      if (run !== runRef.current) return
      setJobs(accepted.jobs)
      const started = Date.now()
      while (Date.now() - started < 21 * 60 * 1000) {
        await wait(400)
        if (run !== runRef.current) return
        const status = await fetchStatus(accepted.subscription_key)
        if (run !== runRef.current) return
        setPolls((count) => count + 1)
        setJobs(status.jobs)
        if (status.error) throw new Error(status.message || status.error)
        if (summarizeJobs(status.jobs) === "Failed") throw new Error(status.message || "A rigging job failed.")
        if (status.ready) {
          const blob = await downloadRig(accepted.uuid)
          if (run !== runRef.current) return
          const url = URL.createObjectURL(blob)
          resultUrlRef.current = url
          setResultUrl(url)
          setPlaying(true)
          setShowBones(true)
          return
        }
      }
      throw new Error("Rigging exceeded the wait deadline.")
    } catch (cause) {
      if (run !== runRef.current) return
      setError(cause instanceof Error ? cause.message : "Rigging failed.")
    } finally {
      if (run === runRef.current) setBusy(false)
    }
  }

  const phase = jobs.length === 0 ? (busy ? "Submitting" : "Idle") : summarizeJobs(jobs)
  const viewUrl = resultUrl ?? previewUrl
  const viewLabel = resultUrl ? "Rigged result" : modelFile ? "Unrigged preview" : "Viewer"
  const promptMissing = boneTemplate === "custom" && !prompt.trim()

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-4">
          <div>
            <p className="text-xs tracking-wide text-muted-foreground uppercase">Single-user lab</p>
            <h1 className="text-xl font-semibold tracking-tight">Hyper3D Rigging Lab</h1>
          </div>
          {mode === "mock" ? (
            <Badge variant="secondary" data-testid="mock-badge">
              Mock mode
            </Badge>
          ) : null}
          {mode === "live" ? <Badge>Live mode</Badge> : null}
        </div>
      </header>
      <main className="mx-auto grid max-w-6xl gap-6 px-6 py-6 lg:grid-cols-[22rem_minmax(0,1fr)]">
        <section className="flex flex-col gap-4">
          <div
            className={`rounded-xl border border-dashed px-4 py-6 text-center ${dragging ? "border-foreground bg-muted" : "border-border bg-muted/40"}`}
            onDragOver={(event) => {
              event.preventDefault()
              setDragging(true)
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(event) => {
              event.preventDefault()
              setDragging(false)
              takeModel(event.dataTransfer.files[0] ?? null)
            }}
          >
            <p className="text-sm font-medium">Drop a GLB</p>
            <p className="mt-1 text-xs text-muted-foreground">One character mesh. The lab does not send a Rodin asset id.</p>
            <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
              <Label className="cursor-pointer rounded-lg border bg-background px-2.5 py-1.5 text-sm">
                Browse
                <input
                  className="sr-only"
                  type="file"
                  accept=".glb,model/gltf-binary"
                  onChange={(event) => takeModel(event.target.files?.[0] ?? null)}
                />
              </Label>
              <Button type="button" variant="outline" size="sm" onClick={() => void loadSample()}>
                Load sample
              </Button>
            </div>
            {modelFile ? <p className="mt-3 text-xs text-muted-foreground">{modelFile.name}</p> : null}
          </div>

          <div className="flex flex-col gap-2">
            <Label>Skeleton</Label>
            <div className="grid grid-cols-2 gap-2">
              <Button type="button" variant={boneTemplate === "auto" ? "default" : "outline"} onClick={() => setBoneTemplate("auto")}>
                Auto
              </Button>
              <Button type="button" variant={boneTemplate === "custom" ? "default" : "outline"} onClick={() => setBoneTemplate("custom")}>
                Prompt
              </Button>
            </div>
            <Textarea
              value={prompt}
              disabled={boneTemplate !== "custom"}
              onChange={(event) => setPrompt(event.target.value)}
              placeholder="Describe the body structure and limbs."
              aria-label="Skeleton prompt"
            />
            <p className="text-xs text-muted-foreground">
              {boneTemplate === "auto" ? "Sends bone_template=auto." : "Sends bone_template=custom and skeleton_description."}
            </p>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="reference-image">Reference image (optional)</Label>
            <input
              id="reference-image"
              className="text-sm"
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={(event) => setImageFile(event.target.files?.[0] ?? null)}
            />
          </div>

          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <Label>Animation presets</Label>
              <span className="text-xs text-muted-foreground">{selected.length} of 10</span>
            </div>
            <div className="flex flex-wrap gap-1">
              {CATEGORIES.map((item) => (
                <Button key={item} type="button" size="xs" variant={category === item ? "default" : "outline"} onClick={() => setCategory(item)}>
                  {item}
                </Button>
              ))}
            </div>
            <ScrollArea className="h-52 rounded-lg border">
              <ul className="flex flex-col gap-1 p-2">
                {animations.map((item) => {
                  const checked = selected.includes(item.animation_id)
                  return (
                    <li key={item.animation_id}>
                      <label className="flex cursor-pointer items-start gap-2 rounded-lg px-2 py-1.5 hover:bg-muted">
                        <input
                          className="mt-1"
                          type="checkbox"
                          checked={checked}
                          disabled={!checked && selected.length >= 10}
                          onChange={() => togglePreset(item.animation_id)}
                        />
                        <span>
                          <span className="block text-sm font-medium">{item.display_name}</span>
                          <span className="block text-xs text-muted-foreground">
                            {item.category} · {item.animation_id} · {item.duration_seconds.toFixed(1)}s
                          </span>
                        </span>
                      </label>
                    </li>
                  )
                })}
              </ul>
            </ScrollArea>
            <div className="flex items-center justify-between">
              <Label htmlFor="in-place">In place</Label>
              <Switch
                id="in-place"
                checked={inPlace}
                disabled={selected.length === 0}
                onCheckedChange={(checked) => setInPlace(checked)}
              />
            </div>
          </div>

          <Button type="button" onClick={() => void onRig()} disabled={!modelFile || busy || promptMissing}>
            {busy ? "Rigging…" : "Rig model"}
          </Button>
          <p className="text-xs text-muted-foreground">
            {mode === "live"
              ? "A live submit costs 0.5 credits."
              : "Mock mode stays on this machine and does not call Hyper3D."}
          </p>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
        </section>

        <section className="flex flex-col gap-4">
          <Viewer
            url={viewUrl}
            label={viewLabel}
            clip={clip}
            clips={clips}
            playing={playing}
            showBones={showBones}
            resetKey={resetKey}
            onClips={onClips}
            onClip={setClip}
            onPlaying={setPlaying}
            onShowBones={setShowBones}
            onReset={() => setResetKey((value) => value + 1)}
          />
          <div className="rounded-xl bg-card px-4 py-4 ring-1 ring-foreground/10" aria-live="polite">
            <div className="flex items-baseline justify-between gap-3">
              <div>
                <p className="text-xs tracking-wide text-muted-foreground uppercase">Status</p>
                <p className="text-2xl font-semibold tracking-tight">{phase}</p>
              </div>
              <p className="text-sm text-muted-foreground">Polls: {polls}</p>
            </div>
            {jobs.length === 0 ? (
              <p className="mt-3 text-sm text-muted-foreground">Submit a model to watch Waiting, Generating, and Done.</p>
            ) : (
              <ul className="mt-3 flex flex-col gap-2">
                {jobs.map((job, index) => (
                  <li key={job.uuid} className="flex items-center justify-between gap-3 text-sm">
                    <span>{job.name ?? `Job ${index + 1}`}</span>
                    <span className="flex items-center gap-2">
                      {typeof job.queue_length === "number" ? (
                        <span className="text-xs text-muted-foreground">Queue {job.queue_length}</span>
                      ) : null}
                      <Badge variant={job.status === "Failed" ? "destructive" : job.status === "Done" ? "default" : "secondary"}>
                        {job.status}
                      </Badge>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      </main>
      <footer className="border-t">
        <div className="mx-auto flex max-w-6xl flex-col gap-1 px-6 py-4 text-sm text-muted-foreground">
          <p>This is an independent demo of a public API, not affiliated with Deemos or Hyper3D.</p>
          <p>
            <a className="underline underline-offset-4" href={DOCS} target="_blank" rel="noreferrer">
              Rigging API docs
            </a>
            . Live submits cost 0.5 credits. The mock rig is an original MIT-licensed sample, not a Hyper3D marketing model.
          </p>
        </div>
      </footer>
    </div>
  )
}
