import { useLayoutEffect, useRef } from "react"
import gsap from "gsap"
import { sceneGlyphs } from "./glyphs.ts"
import "./stage.css"
import { buildTimeline } from "./timeline.ts"
import type { SceneTokens } from "./types.ts"

type StageProps = {
  tokens: SceneTokens
  time: number
}

export function Stage({ tokens, time }: StageProps) {
  const rootRef = useRef<HTMLDivElement>(null)
  const tlRef = useRef<gsap.core.Timeline | null>(null)
  const timeRef = useRef(time)
  timeRef.current = time
  const glyphs = sceneGlyphs(tokens.headline)

  useLayoutEffect(() => {
    const root = rootRef.current
    if (!root) return

    const context = gsap.context(() => {
      const timeline = buildTimeline(root, tokens)
      timeline.seek(timeRef.current)
      tlRef.current = timeline
    }, root)

    return () => {
      context.revert()
      tlRef.current = null
    }
  }, [tokens])

  useLayoutEffect(() => {
    tlRef.current?.seek(time)
  }, [time])

  return (
    <div
      ref={rootRef}
      className="stage"
      style={{
        ["--ink" as string]: tokens.ink,
        ["--paper" as string]: tokens.paper,
        ["--signal" as string]: tokens.signal,
      }}
    >
      <svg className="stage-ring" data-ring viewBox="0 0 120 120" aria-hidden="true">
        <circle
          data-ring-shape
          cx="60"
          cy="60"
          r="52"
          fill="none"
          stroke={tokens.signal}
          strokeWidth="2.4"
          strokeLinecap="round"
        />
      </svg>
      <div className="stage-skyline" aria-hidden="true">
        <span className="stage-bar stage-bar-a" data-bar />
        <span className="stage-bar stage-bar-b" data-bar />
        <span className="stage-bar stage-bar-c" data-bar />
      </div>
      <div className="stage-ground" data-ground />
      <div className="stage-copy">
        <span className="stage-kicker" data-kicker>
          {tokens.kicker}
        </span>
        <span className="stage-rule" data-rule />
        <h2 className="stage-headline" aria-label={tokens.headline || "Untitled"}>
          {glyphs.map((glyph) => (
            <span key={glyph.key} className="stage-char" data-char>
              {glyph.char}
            </span>
          ))}
        </h2>
        <p className="stage-body" data-body>
          {tokens.body || "\u00A0"}
        </p>
      </div>
    </div>
  )
}
