import { Pause, Play } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import type { ClipRecord } from '../domain/clips.ts'
import type { ClipDraft } from '../domain/desk.ts'
import { Button } from './ui/button.tsx'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card.tsx'
import { Label } from './ui/label.tsx'

function formatSeconds(value: number): string {
  const safe = Math.max(0, value)
  const minutes = Math.floor(safe / 60)
  const seconds = safe - minutes * 60
  return `${minutes}:${seconds.toFixed(1).padStart(4, '0')}`
}

type TrimPanelProps = {
  clip: ClipRecord
  draft: ClipDraft
  onTrim: (trimIn: number, trimOut: number) => void
}

export function TrimPanel({ clip, draft, onTrim }: TrimPanelProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [playing, setPlaying] = useState(false)
  const [playhead, setPlayhead] = useState(draft.trimIn)
  const duration = clip.durationSec

  useEffect(() => {
    const video = videoRef.current
    if (!video) return
    const seek = () => {
      if (video.currentTime < draft.trimIn || video.currentTime > draft.trimOut) {
        video.currentTime = draft.trimIn
      }
    }
    video.addEventListener('loadedmetadata', seek)
    seek()
    return () => video.removeEventListener('loadedmetadata', seek)
  }, [clip.src, draft.trimIn, draft.trimOut])

  useEffect(() => {
    const video = videoRef.current
    if (!video || !playing) return
    let frame = 0
    const tick = () => {
      if (video.currentTime >= draft.trimOut - 0.04) {
        video.currentTime = draft.trimIn
      }
      setPlayhead(video.currentTime)
      frame = requestAnimationFrame(tick)
    }
    void video.play().catch(() => setPlaying(false))
    frame = requestAnimationFrame(tick)
    return () => {
      cancelAnimationFrame(frame)
      video.pause()
    }
  }, [playing, draft.trimIn, draft.trimOut, clip.src])

  function changeIn(value: number) {
    if (!Number.isFinite(value)) return
    const trimIn = Math.min(Math.max(0, value), Math.max(0, draft.trimOut - 0.1))
    onTrim(trimIn, draft.trimOut)
  }

  function changeOut(value: number) {
    if (!Number.isFinite(value)) return
    const trimOut = Math.max(Math.min(duration, value), Math.min(duration, draft.trimIn + 0.1))
    onTrim(draft.trimIn, trimOut)
  }

  return (
    <Card data-testid="trim-panel">
      <CardHeader>
        <CardTitle>Trim</CardTitle>
        <CardDescription>
          Set the in and out points. Playback stays inside that range. No server encode.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4 sm:grid-cols-[168px_minmax(0,1fr)]">
        <div className="overflow-hidden rounded-xl bg-black">
          <video
            ref={videoRef}
            data-testid="trim-player"
            className="aspect-[9/16] w-full bg-black object-cover"
            src={clip.src}
            playsInline
            preload="metadata"
            onTimeUpdate={(event) => setPlayhead(event.currentTarget.currentTime)}
          />
        </div>
        <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            size="sm"
            data-testid="play-toggle"
            aria-pressed={playing}
            onClick={() => setPlaying((value) => !value)}
          >
            {playing ? <Pause /> : <Play />}
            {playing ? 'Pause' : 'Play range'}
          </Button>
          <p className="text-sm text-muted-foreground" data-testid="playhead">
            {formatSeconds(draft.trimIn)} – {formatSeconds(draft.trimOut)} · now {formatSeconds(playhead)}
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Label className="flex-col items-stretch gap-1.5 text-xs text-muted-foreground">
            In
            <input
              data-testid="trim-in"
              className="accent-primary"
              type="range"
              min={0}
              max={duration}
              step={0.1}
              value={draft.trimIn}
              onChange={(event) => changeIn(Number(event.target.value))}
            />
            <input
              aria-label="In point seconds"
              className="h-8 rounded-lg border border-input bg-transparent px-2 text-sm text-foreground"
              type="number"
              min={0}
              max={duration}
              step={0.1}
              value={draft.trimIn}
              onChange={(event) => changeIn(Number(event.target.value))}
            />
          </Label>
          <Label className="flex-col items-stretch gap-1.5 text-xs text-muted-foreground">
            Out
            <input
              data-testid="trim-out"
              className="accent-primary"
              type="range"
              min={0}
              max={duration}
              step={0.1}
              value={draft.trimOut}
              onChange={(event) => changeOut(Number(event.target.value))}
            />
            <input
              aria-label="Out point seconds"
              className="h-8 rounded-lg border border-input bg-transparent px-2 text-sm text-foreground"
              type="number"
              min={0}
              max={duration}
              step={0.1}
              value={draft.trimOut}
              onChange={(event) => changeOut(Number(event.target.value))}
            />
          </Label>
        </div>
        </div>
      </CardContent>
    </Card>
  )
}
