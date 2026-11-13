import type { SceneTokens } from "./types.ts"

export type Beats = {
  duration: number
  delay: number
  stagger: number
  ringStart: number
  ringDur: number
  barsStart: number
  barDur: number
  groundStart: number
  groundDur: number
  kickerStart: number
  kickerDur: number
  ruleStart: number
  ruleDur: number
  headlineStart: number
  charDur: number
  charStagger: number
  bodyStart: number
  bodyDur: number
  ease: string
}

export function gsapEase(ease: SceneTokens["ease"]): string {
  if (ease === "back.out") return "back.out(1.7)"
  return ease
}

export function computeBeats(tokens: SceneTokens, glyphCount: number): Beats {
  const duration = clamp(tokens.duration, 3, 12)
  const delay = clamp(tokens.delay, 0, duration * 0.45)
  const stagger = clamp(tokens.stagger, 0, 0.3)
  const span = Math.max(0.8, duration - delay)
  const count = Math.max(1, glyphCount)

  const ringStart = delay
  const ringDur = span * 0.34
  const barsStart = delay + span * 0.08
  const barDur = Math.min(span * 0.28, Math.max(0.28, span * 0.42 - stagger * 2))
  const groundStart = delay + span * 0.05
  const groundDur = Math.max(0.35, span * 0.22)
  const kickerStart = delay + span * 0.3
  const kickerDur = Math.max(0.25, span * 0.12)
  const ruleStart = kickerStart
  const ruleDur = Math.max(0.3, span * 0.18)
  const headlineStart = delay + span * 0.4
  const charDur = Math.min(0.55, Math.max(0.22, span * 0.12))
  const bodyDur = Math.max(0.3, span * 0.14)
  const room = duration - bodyDur - 0.12 - headlineStart - charDur
  const charStagger =
    count <= 1 ? 0 : Math.min(stagger, Math.max(0, room / (count - 1)))
  const headlineEnd = headlineStart + charDur + charStagger * (count - 1)
  const bodyStart = clamp(
    headlineEnd - charDur * 0.35,
    headlineStart + 0.05,
    Math.max(headlineStart + 0.05, duration - bodyDur),
  )

  return {
    duration,
    delay,
    stagger,
    ringStart,
    ringDur,
    barsStart,
    barDur,
    groundStart,
    groundDur,
    kickerStart,
    kickerDur,
    ruleStart,
    ruleDur,
    headlineStart,
    charDur,
    charStagger,
    bodyStart,
    bodyDur,
    ease: gsapEase(tokens.ease),
  }
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}
