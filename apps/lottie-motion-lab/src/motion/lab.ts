export const PERSONALITIES = ["playful", "calm", "sharp"] as const
export const PATTERNS = [
  "card-entrance",
  "loading-success",
  "staggered-dashboard",
] as const

export type Personality = (typeof PERSONALITIES)[number]
export type Pattern = (typeof PATTERNS)[number]
export type Outcome = "success" | "error"

export const DURATION_MIN = 40
export const DURATION_MAX = 2000

export type EasingPreset = {
  id: string
  label: string
  value: string
}

/** Curves named in the published easing tables. Stored as CSS timing functions. */
export const EASING_PRESETS: readonly EasingPreset[] = [
  {
    id: "ease-out-back",
    label: "ease-out-back",
    value: "cubic-bezier(0.175, 0.885, 0.32, 1.275)",
  },
  {
    id: "sine-in-out",
    label: "sine-in-out",
    value: "cubic-bezier(0.45, 0.05, 0.55, 0.95)",
  },
  {
    id: "ease-out",
    label: "ease-out",
    value: "cubic-bezier(0.2, 0, 0, 1)",
  },
  {
    id: "ease-in-out",
    label: "ease-in-out",
    value: "cubic-bezier(0.42, 0, 0.58, 1)",
  },
  {
    id: "linear",
    label: "linear",
    value: "linear",
  },
]

export type MotionDefaults = {
  personality: Personality
  pattern: Pattern
  durationMs: number
  easingId: string
  easingLabel: string
  easingValue: string
  staggerMs: number
  intent: string
  why: string
}

const SIGNATURE: Record<
  Personality,
  { easingId: string; staggerMs: number; intent: string }
> = {
  playful: {
    easingId: "ease-out-back",
    staggerMs: 60,
    intent: "Bouncy, with about 10–20% overshoot.",
  },
  calm: {
    easingId: "sine-in-out",
    staggerMs: 80,
    intent: "Slow and flowing, on a sine curve.",
  },
  sharp: {
    easingId: "ease-out",
    staggerMs: 30,
    intent: "Urgent and straight. A strong ease-out, no flourish.",
  },
}

/**
 * One finite duration per personality × pattern.
 * Playful stays near 150–400ms, calm in the 500–1000ms sine range,
 * sharp inside the 100–200ms urgency range.
 */
const DURATIONS: Record<Personality, Record<Pattern, number>> = {
  playful: {
    "card-entrance": 280,
    "loading-success": 360,
    "staggered-dashboard": 250,
  },
  calm: {
    "card-entrance": 640,
    "loading-success": 800,
    "staggered-dashboard": 720,
  },
  sharp: {
    "card-entrance": 180,
    "loading-success": 160,
    "staggered-dashboard": 140,
  },
}

const WHY: Record<Personality, Record<Pattern, string>> = {
  playful: {
    "card-entrance":
      "Card entrances need a short spatial move, around 200–350ms. Playful timing uses 280ms and ease-out-back so the card rises, overshoots slightly, and settles. The shadow follows a beat later.",
    "loading-success":
      "Success feedback wants a scale pop, about 300–400ms. Playful timing uses 360ms and ease-out-back. The spinner stays linear; the check then overshoots a little and settles.",
    "staggered-dashboard":
      "Widgets enter in reading order at 250ms with ease-out-back, staggered 60ms. The hero leads, and the cascade stays under a 500ms delay budget.",
  },
  calm: {
    "card-entrance":
      "Calm motion sits in the 500–1000ms sine range. This card uses 640ms and sine-in-out, with a short arc, so the arrival feels like a breath.",
    "loading-success":
      "A calm confirmation avoids bounce. 800ms of sine-in-out lets the spinner hand off to a check that eases in and settles.",
    "staggered-dashboard":
      "Each widget travels for 720ms on sine-in-out. An 80ms stagger overlaps the wave and keeps the delay budget under 500ms.",
  },
  sharp: {
    "card-entrance":
      "Urgency stays inside 100–200ms with a strong ease-out and a straight path. 180ms is enough to see the card arrive, with no bounce.",
    "loading-success":
      "Sharp feedback uses 160ms and ease-out. Loading stays linear and brief; the check lands and stops.",
    "staggered-dashboard":
      "Sharp widgets use 140ms and ease-out, with a 30ms stagger. Straight entrances keep the board readable without a long build.",
  },
}

export const CHECKLIST = [
  "Intent",
  "Personality",
  "Property",
  "Duration",
  "Easing",
  "Hero",
  "Layers",
  "1/3 rule",
] as const

export const PERSONALITY_LABEL: Record<Personality, string> = {
  playful: "Playful",
  calm: "Calm",
  sharp: "Sharp",
}

export const PATTERN_LABEL: Record<Pattern, string> = {
  "card-entrance": "Card entrance",
  "loading-success": "Loading → success",
  "staggered-dashboard": "Staggered dashboard",
}

export const PATTERN_HINT: Record<Pattern, string> = {
  "card-entrance": "Position and opacity, with a late shadow.",
  "loading-success": "Linear spinner, then a settling check. Error is a firm shake.",
  "staggered-dashboard": "Hero first, then the rest in reading order.",
}

function presetById(id: string): EasingPreset {
  const preset = EASING_PRESETS.find((item) => item.id === id)
  if (!preset) {
    throw new Error(`Unknown easing preset: ${id}`)
  }
  return preset
}

export function getDefaults(
  personality: Personality,
  pattern: Pattern,
): MotionDefaults {
  const signature = SIGNATURE[personality]
  const easing = presetById(signature.easingId)
  const durationMs = DURATIONS[personality][pattern]
  return {
    personality,
    pattern,
    durationMs,
    easingId: easing.id,
    easingLabel: easing.label,
    easingValue: easing.value,
    staggerMs: signature.staggerMs,
    intent: signature.intent,
    why: WHY[personality][pattern],
  }
}

export function parseDuration(raw: string): number | null {
  const trimmed = raw.trim()
  if (!/^\d+(\.\d+)?$/.test(trimmed)) return null
  const value = Number(trimmed)
  if (!Number.isFinite(value)) return null
  if (value < DURATION_MIN || value > DURATION_MAX) return null
  return Math.round(value)
}

const BEZIER =
  /^cubic-bezier\(\s*(-?\d*\.?\d+)\s*,\s*(-?\d*\.?\d+)\s*,\s*(-?\d*\.?\d+)\s*,\s*(-?\d*\.?\d+)\s*\)$/

const CSS_KEYWORDS = new Set(["linear", "ease", "ease-in", "ease-out", "ease-in-out"])

function compact(value: string): string {
  return value.trim().replace(/\s+/g, "")
}

export function parseEasing(raw: string): { id: string; value: string } | null {
  const trimmed = raw.trim()
  if (!trimmed) return null

  const byLabel = EASING_PRESETS.find((item) => item.label === trimmed)
  if (byLabel) return { id: byLabel.id, value: byLabel.value }

  const byValue = EASING_PRESETS.find((item) => compact(item.value) === compact(trimmed))
  if (byValue) return { id: byValue.id, value: byValue.value }

  if (CSS_KEYWORDS.has(trimmed)) {
    return { id: "custom", value: trimmed }
  }

  const match = BEZIER.exec(trimmed)
  if (!match) return null
  const numbers = match.slice(1).map(Number)
  if (numbers.some((value) => !Number.isFinite(value))) return null
  const [x1, y1, x2, y2] = numbers
  if (x1 < 0 || x1 > 1 || x2 < 0 || x2 > 1) return null
  if (y1 < -2 || y1 > 3 || y2 < -2 || y2 > 3) return null
  const value = `cubic-bezier(${x1}, ${y1}, ${x2}, ${y2})`
  const known = EASING_PRESETS.find((item) => compact(item.value) === compact(value))
  return { id: known?.id ?? "custom", value: known?.value ?? value }
}

export type Draft = {
  durationText: string
  easingText: string
}

export type ActivePlay = {
  id: number
  personality: Personality
  pattern: Pattern
  durationMs: number
  easingId: string
  easingValue: string
  staggerMs: number
  outcome: Outcome
}

export type LabState = {
  personality: Personality
  pattern: Pattern
  outcome: Outcome
  draft: Draft
  play: ActivePlay | null
  error: string | null
  nextId: number
}

export type LabAction =
  | { type: "set-personality"; personality: Personality }
  | { type: "set-pattern"; pattern: Pattern }
  | { type: "set-outcome"; outcome: Outcome }
  | { type: "edit-duration"; value: string }
  | { type: "edit-easing"; value: string }
  | { type: "play" }

export function createLabState(
  personality: Personality = "playful",
  pattern: Pattern = "card-entrance",
): LabState {
  const defaults = getDefaults(personality, pattern)
  return {
    personality,
    pattern,
    outcome: "success",
    draft: {
      durationText: String(defaults.durationMs),
      easingText: defaults.easingValue,
    },
    play: null,
    error: null,
    nextId: 1,
  }
}

export function draftFromDefaults(
  personality: Personality,
  pattern: Pattern,
): Draft {
  const defaults = getDefaults(personality, pattern)
  return {
    durationText: String(defaults.durationMs),
    easingText: defaults.easingValue,
  }
}

export function resolveDraft(
  state: Pick<LabState, "personality" | "pattern" | "outcome" | "draft">,
): { ok: true; play: Omit<ActivePlay, "id"> } | { ok: false; error: string } {
  const durationMs = parseDuration(state.draft.durationText)
  const easing = parseEasing(state.draft.easingText)
  const problems: string[] = []
  if (durationMs === null) {
    problems.push(
      `Duration must be a finite number from ${DURATION_MIN} to ${DURATION_MAX} ms.`,
    )
  }
  if (easing === null) {
    problems.push(
      "Easing must be a named curve or cubic-bezier(x1, y1, x2, y2).",
    )
  }
  if (durationMs === null || easing === null) {
    return { ok: false, error: problems.join(" ") }
  }
  const defaults = getDefaults(state.personality, state.pattern)
  return {
    ok: true,
    play: {
      personality: state.personality,
      pattern: state.pattern,
      durationMs,
      easingId: easing.id,
      easingValue: easing.value,
      staggerMs: defaults.staggerMs,
      outcome: state.pattern === "loading-success" ? state.outcome : "success",
    },
  }
}

export function reduceLab(state: LabState, action: LabAction): LabState {
  switch (action.type) {
    case "set-personality":
      return {
        ...state,
        personality: action.personality,
        draft: draftFromDefaults(action.personality, state.pattern),
        play: null,
        error: null,
      }
    case "set-pattern":
      return {
        ...state,
        pattern: action.pattern,
        outcome: "success",
        draft: draftFromDefaults(state.personality, action.pattern),
        play: null,
        error: null,
      }
    case "set-outcome":
      return { ...state, outcome: action.outcome }
    case "edit-duration":
      return {
        ...state,
        draft: { ...state.draft, durationText: action.value },
        error: null,
      }
    case "edit-easing":
      return {
        ...state,
        draft: { ...state.draft, easingText: action.value },
        error: null,
      }
    case "play": {
      const resolved = resolveDraft(state)
      if (!resolved.ok) {
        return { ...state, error: resolved.error }
      }
      return {
        ...state,
        error: null,
        nextId: state.nextId + 1,
        play: { ...resolved.play, id: state.nextId },
      }
    }
    default: {
      const unreachable: never = action
      return unreachable
    }
  }
}
