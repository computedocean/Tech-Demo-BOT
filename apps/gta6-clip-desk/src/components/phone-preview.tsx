import { useEffect, useRef } from 'react'
import type { ClipRecord } from '../domain/clips.ts'
import type { ClipDraft } from '../domain/desk.ts'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card.tsx'

type PhonePreviewProps = {
  clip: ClipRecord
  draft: ClipDraft
}

export function PhonePreview({ clip, draft }: PhonePreviewProps) {
  const videoRef = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    const video = videoRef.current
    if (!video) return
    let frame = 0
    let stopped = false
    const tick = () => {
      if (stopped) return
      if (video.readyState >= 2 && (video.currentTime >= draft.trimOut - 0.05 || video.currentTime < draft.trimIn)) {
        video.currentTime = draft.trimIn
      }
      frame = requestAnimationFrame(tick)
    }
    const start = () => {
      video.currentTime = draft.trimIn
      void video.play().catch(() => undefined)
    }
    video.addEventListener('loadeddata', start)
    if (video.readyState >= 2) start()
    frame = requestAnimationFrame(tick)
    return () => {
      stopped = true
      cancelAnimationFrame(frame)
      video.removeEventListener('loadeddata', start)
      video.pause()
    }
  }, [clip.src, draft.trimIn, draft.trimOut])

  return (
    <Card data-testid="preview-card">
      <CardHeader>
        <CardTitle>Vertical preview</CardTitle>
        <CardDescription>
          <span data-testid="preview-aspect">9:16</span> overlay on the trimmed range. Safe-area type sits clear of the edges.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex justify-center">
        <div
          data-testid="preview-frame"
          className="relative aspect-[9/16] w-full max-w-[240px] overflow-hidden rounded-[1.4rem] bg-black shadow-xl ring-1 ring-foreground/15"
        >
          <video
            ref={videoRef}
            className="absolute inset-0 h-full w-full object-cover"
            src={clip.src}
            muted
            playsInline
            preload="auto"
            data-testid="preview-video"
          />
          <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/45 to-transparent px-[8%] pt-16 pb-[10%] text-white">
            <p data-testid="preview-hook" className="text-[11px] font-medium tracking-wide text-[#ead9bc]">
              {draft.hook}
            </p>
            <p data-testid="preview-caption" className="mt-1 text-sm leading-snug font-semibold">
              {draft.caption}
            </p>
            <p data-testid="preview-hashtags" className="mt-2 truncate text-[10px] text-white/80">
              {draft.hashtags.join(' ')}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
