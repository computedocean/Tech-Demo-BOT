import { useEffect, useMemo, useRef, useState, type FormEvent } from "react"
import { Info, Pause, Play } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { Slider } from "@/components/ui/slider"
import { Textarea } from "@/components/ui/textarea"
import { sceneModule, tokensCss } from "./exportScene.ts"
import { Stage } from "./Stage.tsx"
import {
  EASES,
  REBUILD_NOTICE,
  defaultTokens,
  isEaseName,
  sampleSource,
  type PlaybackSource,
  type SceneTokens,
} from "./types.ts"

const DIRECT_MEDIA = /\.(mp4|webm|ogg)(?:$|[?#])/i

export function Studio() {
  const [tokens, setTokens] = useState<SceneTokens>(defaultTokens)
  const [source, setSource] = useState<PlaybackSource>(sampleSource)
  const [link, setLink] = useState("")
  const [notice, setNotice] = useState<string | null>(null)
  const [dragging, setDragging] = useState(false)
  const [videoFailed, setVideoFailed] = useState(false)
  const [preview, setPreview] = useState<"js" | "css">("js")
  const [copied, setCopied] = useState<"js" | "css" | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const sourceRef = useRef(source)
  sourceRef.current = source

  const clock = useSharedClock(tokens.duration, source.src)
  const sceneJs = useMemo(() => sceneModule(tokens), [tokens])
  const sceneCss = useMemo(() => tokensCss(tokens), [tokens])
  const delayMax = Math.min(2.5, tokens.duration * 0.45)

  useEffect(() => {
    return () => {
      const current = sourceRef.current
      if (current.kind === "file") URL.revokeObjectURL(current.src)
    }
  }, [])

  const toggleRef = useRef(clock.toggle)
  toggleRef.current = clock.toggle

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.code !== "Space") return
      const target = event.target
      if (!(target instanceof HTMLElement)) return
      const tag = target.tagName
      if (tag === "INPUT" || tag === "TEXTAREA" || target.isContentEditable) return
      event.preventDefault()
      toggleRef.current()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [])

  function replaceSource(next: PlaybackSource) {
    const current = sourceRef.current
    if (current.kind === "file" && current.src !== next.src) {
      URL.revokeObjectURL(current.src)
    }
    setVideoFailed(false)
    clock.setVideoReady(false)
    setSource(next)
  }

  function patch(partial: Partial<SceneTokens>) {
    setTokens((current) => {
      const next = { ...current, ...partial }
      if (partial.duration !== undefined) {
        next.delay = Math.min(next.delay, next.duration * 0.45)
      }
      return next
    })
  }

  function resetStudio() {
    setTokens(defaultTokens)
    replaceSource(sampleSource())
    setLink("")
    setNotice(null)
    clock.restartAt(defaultTokens.duration)
  }

  function loadFile(file: File | undefined) {
    if (!file) return
    const looksLikeVideo =
      file.type.startsWith("video/") || /\.(mp4|webm|ogg|mov)$/i.test(file.name)
    if (!looksLikeVideo) {
      setNotice(
        "That file is not a video. The original side is still the bundled Northline clip. " +
          REBUILD_NOTICE,
      )
      return
    }
    replaceSource({
      kind: "file",
      src: URL.createObjectURL(file),
      label: file.name,
    })
    setNotice(REBUILD_NOTICE)
  }

  function loadLink(event: FormEvent) {
    event.preventDefault()
    const url = link.trim()
    if (!url) return
    if (!/^https?:\/\//i.test(url)) {
      setNotice(
        "Paste a full http(s) link. Live reconstruction needs the official MotionClone Windows app and a Codex / ChatGPT login.",
      )
      return
    }
    if (!DIRECT_MEDIA.test(url)) {
      setNotice(
        "YouTube, X, and Vimeo links are not downloaded here. " + REBUILD_NOTICE,
      )
      return
    }
    replaceSource({ kind: "url", src: url, label: "Direct link" })
    setNotice(REBUILD_NOTICE)
  }

  function onVideoError() {
    if (sourceRef.current.kind === "sample") {
      setVideoFailed(true)
      return
    }
    setNotice(
      "The browser could not play that clip. " + REBUILD_NOTICE + " Restored the bundled sample.",
    )
    replaceSource(sampleSource())
  }

  async function copyText(kind: "js" | "css") {
    const text = kind === "js" ? sceneJs : sceneCss
    try {
      await navigator.clipboard.writeText(text)
      setCopied(kind)
      window.setTimeout(() => setCopied(null), 1400)
    } catch {
      setNotice("Clipboard write was blocked. Use the download buttons instead.")
    }
  }

  return (
    <div className="studio-shell">
      <div className="mx-auto flex w-full max-w-[1180px] flex-col gap-3 px-4 py-3">
        <header className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-[10px] font-medium tracking-[0.22em] text-[#6f675c] uppercase">
              Remix studio
            </p>
            <h1 className="mt-1 font-[family-name:var(--font-serif)] text-[1.7rem] leading-none tracking-tight text-[#1c1915]">
              Northline
            </h1>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <p className="max-w-sm text-right text-xs leading-snug text-[#5c564c]">
              Original title clip beside a seekable rebuild. Edit text, color, and timing, then export the scene.
            </p>
            <Button type="button" variant="outline" size="sm" onClick={resetStudio}>
              Reset
            </Button>
          </div>
        </header>

        <div className="flex flex-wrap items-center gap-2">
          <div
            className={`flex min-w-64 flex-1 items-center gap-2 rounded-xl border border-dashed bg-card px-2.5 py-1.5 ${
              dragging ? "border-[#1c1915] bg-white" : "border-[#c9c1b4]"
            }`}
            onDragOver={(event) => {
              event.preventDefault()
              setDragging(true)
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(event) => {
              event.preventDefault()
              setDragging(false)
              loadFile(event.dataTransfer.files[0])
            }}
          >
            <input
              ref={fileRef}
              type="file"
              accept="video/*"
              className="sr-only"
              onChange={(event) => {
                loadFile(event.target.files?.[0])
                event.target.value = ""
              }}
            />
            <Button type="button" variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
              Choose clip
            </Button>
            <span className="text-xs text-muted-foreground">or drop a video</span>
          </div>
          <form onSubmit={loadLink} className="flex min-w-72 flex-[1.4] gap-2">
            <Label htmlFor="source-link" className="sr-only">
              Video link
            </Label>
            <Input
              id="source-link"
              value={link}
              onChange={(event) => setLink(event.target.value)}
              placeholder="Paste a direct .mp4, .webm, or .ogg link"
            />
            <Button type="submit" variant="secondary" size="sm">
              Load link
            </Button>
          </form>
        </div>

        {notice ? (
          <Alert>
            <Info />
            <AlertTitle>Rebuild stays on the bundled scene</AlertTitle>
            <AlertDescription>{notice}</AlertDescription>
          </Alert>
        ) : null}

        <div className="grid gap-3 md:grid-cols-2">
          <section className="overflow-hidden rounded-xl bg-[#141210] ring-1 ring-black/10">
            <div className="flex items-center justify-between px-3 py-1.5 text-[10px] font-medium tracking-[0.16em] text-[#d9d0c3] uppercase">
              <span>Original</span>
              <span className="tracking-normal text-[#b7ae9f] normal-case">{source.label}</span>
            </div>
            <div className="relative aspect-video">
              <video
                key={source.src}
                ref={clock.videoRef}
                className="h-full w-full object-cover"
                src={source.src}
                muted
                playsInline
                preload="auto"
                onLoadedMetadata={() => clock.setVideoReady(true)}
                onError={onVideoError}
              />
              {videoFailed ? (
                <p className="absolute inset-0 grid place-items-center px-6 text-center text-xs text-[#f4efe4]/80">
                  The bundled sample could not be read.
                </p>
              ) : null}
            </div>
          </section>
          <section className="overflow-hidden rounded-xl bg-[#141210] ring-1 ring-black/10">
            <div className="flex items-center justify-between px-3 py-1.5 text-[10px] font-medium tracking-[0.16em] text-[#d9d0c3] uppercase">
              <span>Rebuild</span>
              <Badge variant="secondary" className="tracking-normal normal-case">
                Live edit
              </Badge>
            </div>
            <div className="aspect-video">
              <Stage tokens={tokens} time={clock.time} />
            </div>
          </section>
        </div>

        <div className="rounded-xl bg-card px-3 py-2.5 ring-1 ring-foreground/10">
          <div className="mb-2 flex items-center justify-between gap-3">
            <p className="text-[10px] font-medium tracking-[0.16em] text-[#6f675c] uppercase">
              Shared clock
            </p>
            <p className="text-[11px] text-muted-foreground">
              Seeks the original and the rebuild together
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Button type="button" size="sm" onClick={clock.toggle} aria-pressed={clock.playing}>
              {clock.playing ? <Pause /> : <Play />}
              {clock.playing ? "Pause" : "Play"}
            </Button>
            <span className="w-14 font-mono text-xs tabular-nums">{formatClock(clock.time)}</span>
            <Slider
              aria-label="Shared clock"
              className="flex-1"
              min={0}
              max={tokens.duration}
              step={0.01}
              value={[Math.min(clock.time, tokens.duration)]}
              onValueChange={(value) => {
                const next = value[0]
                if (next === undefined) return
                clock.scrub(next)
              }}
            />
            <span className="w-14 text-right font-mono text-xs tabular-nums">
              {formatClock(tokens.duration)}
            </span>
          </div>
        </div>

        <div className="grid gap-3 lg:grid-cols-3">
          <Card size="sm">
            <CardHeader>
              <CardTitle>Text</CardTitle>
              <CardDescription>Updates the rebuild immediately.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3">
              <div className="grid gap-1.5">
                <Label htmlFor="headline">Headline</Label>
                <Input
                  id="headline"
                  value={tokens.headline}
                  maxLength={42}
                  onChange={(event) => patch({ headline: event.target.value })}
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="body">Body</Label>
                <Textarea
                  id="body"
                  value={tokens.body}
                  maxLength={140}
                  rows={3}
                  onChange={(event) => patch({ body: event.target.value })}
                />
              </div>
            </CardContent>
          </Card>

          <Card size="sm">
            <CardHeader>
              <CardTitle>Color and timing</CardTitle>
              <CardDescription>Ink, paper, and signal, plus the clock.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3">
              <div className="grid gap-2">
                <ColorField label="Ink" value={tokens.ink} onChange={(ink) => patch({ ink })} />
                <ColorField label="Paper" value={tokens.paper} onChange={(paper) => patch({ paper })} />
                <ColorField
                  label="Signal"
                  value={tokens.signal}
                  onChange={(signal) => patch({ signal })}
                />
              </div>
              <Separator />
              <SliderField
                label="Duration"
                min={3}
                max={12}
                step={0.1}
                value={tokens.duration}
                suffix="s"
                onChange={(duration) => patch({ duration })}
              />
              <SliderField
                label="Delay"
                min={0}
                max={delayMax}
                step={0.05}
                value={Math.min(tokens.delay, delayMax)}
                suffix="s"
                onChange={(delay) => patch({ delay })}
              />
              <SliderField
                label="Stagger"
                min={0}
                max={0.3}
                step={0.01}
                value={tokens.stagger}
                suffix="s"
                onChange={(stagger) => patch({ stagger })}
              />
              <div className="grid gap-1.5">
                <Label htmlFor="easing">Easing</Label>
                <Select
                  value={tokens.ease}
                  onValueChange={(value) => {
                    if (isEaseName(value)) patch({ ease: value })
                  }}
                >
                  <SelectTrigger id="easing" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {EASES.map((ease) => (
                      <SelectItem key={ease.value} value={ease.value}>
                        {ease.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          <Card size="sm">
            <CardHeader>
              <CardTitle>Export</CardTitle>
              <CardDescription>Scene module and tokens for the current rebuild.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-2">
              <div className="flex flex-wrap gap-1.5">
                <Button
                  type="button"
                  size="sm"
                  variant={preview === "js" ? "default" : "outline"}
                  onClick={() => setPreview("js")}
                >
                  scene.js
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={preview === "css" ? "default" : "outline"}
                  onClick={() => setPreview("css")}
                >
                  tokens.css
                </Button>
              </div>
              <pre className="max-h-36 overflow-auto rounded-lg bg-[#1c1915] p-2.5 font-mono text-[10px] leading-relaxed text-[#f4efe4]">
                {preview === "js" ? sceneJs : sceneCss}
              </pre>
              <div className="flex flex-wrap gap-1.5">
                <Button type="button" size="sm" variant="secondary" onClick={() => void copyText(preview)}>
                  {copied === preview ? "Copied" : "Copy"}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => downloadText("northline-scene.js", sceneJs, "text/javascript")}
                >
                  Download scene.js
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => downloadText("northline-tokens.css", sceneCss, "text/css")}
                >
                  Download tokens.css
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        <footer className="pb-2 text-[11px] leading-relaxed text-[#6b645a]">
          Workflow inspired by{" "}
          <a className="underline decoration-[#b7ae9f] underline-offset-2" href="https://motionclone.lol">
            MotionClone
          </a>{" "}
          (
          <a
            className="underline decoration-[#b7ae9f] underline-offset-2"
            href="https://github.com/blixvip/MotionClone"
          >
            repo
          </a>
          ). This demo does not include MotionClone source, assets, or branding. The clip and the
          rebuild are original, and the app runs with no API key.
        </footer>
      </div>
    </div>
  )
}

function ColorField({
  label,
  value,
  onChange,
}: {
  label: string
  value: string
  onChange: (value: string) => void
}) {
  const [draft, setDraft] = useState(value)

  useEffect(() => {
    setDraft(value)
  }, [value])

  return (
    <label className="flex items-center gap-2 rounded-lg border border-border bg-background px-2 py-1">
      <input
        type="color"
        value={/^#[0-9a-fA-F]{6}$/.test(draft) ? draft : value}
        aria-label={label}
        onChange={(event) => {
          setDraft(event.target.value)
          onChange(event.target.value)
        }}
        className="studio-color"
      />
      <span className="w-12 text-xs font-medium">{label}</span>
      <Input
        aria-label={`${label} hex`}
        value={draft}
        spellCheck={false}
        onChange={(event) => {
          const next = event.target.value
          setDraft(next)
          if (/^#[0-9a-fA-F]{6}$/.test(next)) onChange(next)
        }}
        className="ml-auto h-7 w-[5.6rem] px-1.5 font-mono text-[11px]"
      />
    </label>
  )
}

function SliderField({
  label,
  value,
  min,
  max,
  step,
  suffix,
  onChange,
}: {
  label: string
  value: number
  min: number
  max: number
  step: number
  suffix: string
  onChange: (value: number) => void
}) {
  return (
    <div className="grid gap-1.5">
      <div className="flex items-center justify-between gap-3 text-xs">
        <Label>{label}</Label>
        <span className="font-mono text-muted-foreground tabular-nums">
          {value.toFixed(2)}
          {suffix}
        </span>
      </div>
      <Slider
        aria-label={label}
        min={min}
        max={Math.max(min, max)}
        step={step}
        value={[Math.min(Math.max(value, min), Math.max(min, max))]}
        onValueChange={(next) => {
          const resolved = next[0]
          if (resolved === undefined) return
          onChange(resolved)
        }}
      />
    </div>
  )
}

function useSharedClock(duration: number, sourceKey: string) {
  const [time, setTime] = useState(duration)
  const [playing, setPlaying] = useState(false)
  const [videoReady, setVideoReady] = useState(false)
  const videoRef = useRef<HTMLVideoElement>(null)
  const timeRef = useRef(time)
  const playingRef = useRef(playing)
  const durationRef = useRef(duration)
  timeRef.current = time
  playingRef.current = playing
  durationRef.current = duration

  useEffect(() => {
    setVideoReady(false)
  }, [sourceKey])

  useEffect(() => {
    setTime((current) => Math.min(current, duration))
  }, [duration])

  useEffect(() => {
    if (!playing) {
      videoRef.current?.pause()
      return
    }

    const video = videoRef.current
    let frame = 0
    let last = performance.now()
    let mode: "pending" | "video" | "clock" = "clock"
    const limit = duration

    if (video && videoReady && Number.isFinite(video.duration) && video.duration > 0 && limit > 0) {
      mode = "pending"
      video.playbackRate = video.duration / limit
      const target = (timeRef.current / limit) * video.duration
      if (Math.abs(video.currentTime - target) > 0.04) {
        video.currentTime = Math.min(video.duration, Math.max(0, target))
      }
      void video.play().then(
        () => {
          mode = "video"
        },
        () => {
          mode = "clock"
        },
      )
    }

    const tick = (now: number) => {
      if (!playingRef.current) return
      const node = videoRef.current
      if (mode === "pending") {
        frame = requestAnimationFrame(tick)
        return
      }
      if (mode === "video" && node && Number.isFinite(node.duration) && node.duration > 0) {
        if (node.ended || node.currentTime >= node.duration - 0.02) {
          setTime(limit)
          setPlaying(false)
          node.pause()
          return
        }
        setTime((node.currentTime / node.duration) * limit)
      } else {
        const dt = Math.min(0.05, (now - last) / 1000)
        last = now
        setTime((current) => {
          const next = current + dt
          if (next >= limit - 0.001) {
            setPlaying(false)
            return limit
          }
          return next
        })
      }
      frame = requestAnimationFrame(tick)
    }

    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [playing, videoReady, duration])

  useEffect(() => {
    if (playing) return
    const video = videoRef.current
    if (!video || !videoReady || !Number.isFinite(video.duration) || video.duration <= 0) return
    const target = (Math.min(time, duration) / duration) * video.duration
    if (Math.abs(video.currentTime - target) > 0.03) {
      video.currentTime = Math.min(video.duration, Math.max(0, target))
    }
  }, [time, playing, duration, videoReady])

  function toggle() {
    if (playingRef.current) {
      setPlaying(false)
      return
    }
    if (timeRef.current >= durationRef.current - 0.03) {
      setTime(0)
    }
    setPlaying(true)
  }

  function scrub(next: number) {
    setPlaying(false)
    setTime(Math.min(durationRef.current, Math.max(0, next)))
  }

  function restartAt(next: number) {
    setPlaying(false)
    setTime(next)
  }

  return {
    time,
    playing,
    videoRef,
    setVideoReady,
    toggle,
    scrub,
    restartAt,
  }
}

function formatClock(seconds: number) {
  const safe = Number.isFinite(seconds) ? Math.max(0, seconds) : 0
  const minutes = Math.floor(safe / 60)
  const remain = safe - minutes * 60
  return `${minutes}:${remain.toFixed(2).padStart(5, "0")}`
}

function downloadText(filename: string, contents: string, mime: string) {
  const blob = new Blob([contents], { type: mime })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement("a")
  anchor.href = url
  anchor.download = filename
  document.body.append(anchor)
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL(url)
}
