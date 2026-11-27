import { describe, expect, test } from "bun:test"
import {
  DURATION_MAX,
  DURATION_MIN,
  EASING_PRESETS,
  PATTERNS,
  PERSONALITIES,
  createLabState,
  getDefaults,
  parseDuration,
  parseEasing,
  reduceLab,
} from "./lab"

describe("personality × pattern defaults", () => {
  for (const personality of PERSONALITIES) {
    for (const pattern of PATTERNS) {
      test(`${personality} + ${pattern}`, () => {
        const defaults = getDefaults(personality, pattern)
        expect(Number.isFinite(defaults.durationMs)).toBe(true)
        expect(defaults.durationMs).toBeGreaterThan(0)
        expect(defaults.durationMs).toBeLessThanOrEqual(DURATION_MAX)
        const easing = parseEasing(defaults.easingValue)
        expect(easing).not.toBeNull()
        expect(easing?.value).toBe(defaults.easingValue)
        expect(defaults.easingId.length).toBeGreaterThan(0)
        expect(defaults.why.trim().length).toBeGreaterThan(0)
        expect(defaults.why).toContain(String(defaults.durationMs))
        expect(Number.isFinite(defaults.staggerMs)).toBe(true)
      })
    }
  }

  test("dashboard stagger stays under a 500ms budget", () => {
    for (const personality of PERSONALITIES) {
      const defaults = getDefaults(personality, "staggered-dashboard")
      expect(defaults.staggerMs * 3).toBeLessThan(500)
    }
  })
})

describe("edits apply on the next play", () => {
  test("duration and easing stay on the previous play until Play", () => {
    let state = createLabState("playful", "card-entrance")
    state = reduceLab(state, { type: "play" })
    expect(state.play?.durationMs).toBe(280)
    expect(state.play?.easingValue).toBe(
      "cubic-bezier(0.175, 0.885, 0.32, 1.275)",
    )

    state = reduceLab(state, { type: "edit-duration", value: "900" })
    state = reduceLab(state, {
      type: "edit-easing",
      value: "cubic-bezier(0.45, 0.05, 0.55, 0.95)",
    })
    expect(state.play?.durationMs).toBe(280)
    expect(state.play?.easingId).toBe("ease-out-back")

    state = reduceLab(state, { type: "play" })
    expect(state.error).toBeNull()
    expect(state.play?.durationMs).toBe(900)
    expect(state.play?.easingId).toBe("sine-in-out")
    expect(state.play?.easingValue).toBe(
      "cubic-bezier(0.45, 0.05, 0.55, 0.95)",
    )
    expect(state.play?.id).toBe(2)
  })

  test("invalid edits are rejected and do not replace the last play", () => {
    let state = createLabState("sharp", "loading-success")
    state = reduceLab(state, { type: "play" })
    const played = state.play
    expect(played?.durationMs).toBe(160)

    state = reduceLab(state, { type: "edit-duration", value: "Infinity" })
    state = reduceLab(state, { type: "play" })
    expect(state.play).toEqual(played)
    expect(state.error).toContain("finite")

    state = reduceLab(state, { type: "edit-duration", value: "200" })
    state = reduceLab(state, { type: "edit-easing", value: "not-a-curve" })
    state = reduceLab(state, { type: "play" })
    expect(state.play).toEqual(played)
    expect(state.error).toContain("cubic-bezier")
  })

  test("duration bounds and named curves", () => {
    expect(parseDuration("")).toBeNull()
    expect(parseDuration("-20")).toBeNull()
    expect(parseDuration("0")).toBeNull()
    expect(parseDuration(String(DURATION_MIN - 1))).toBeNull()
    expect(parseDuration(String(DURATION_MAX + 1))).toBeNull()
    expect(parseDuration(String(DURATION_MIN))).toBe(DURATION_MIN)
    expect(parseDuration("1200.4")).toBe(1200)
    expect(parseEasing("")).toBeNull()
    expect(parseEasing("cubic-bezier(2, 0, 0, 1)")).toBeNull()
    expect(parseEasing("ease-in")?.value).toBe("ease-in")
    for (const preset of EASING_PRESETS) {
      expect(parseEasing(preset.label)?.value).toBe(preset.value)
      expect(parseEasing(preset.value)?.id).toBe(preset.id)
    }
  })

  test("switching personality loads that pair's defaults", () => {
    let state = createLabState("playful", "card-entrance")
    state = reduceLab(state, { type: "edit-duration", value: "900" })
    state = reduceLab(state, { type: "play" })
    state = reduceLab(state, { type: "set-personality", personality: "calm" })
    const calm = getDefaults("calm", "card-entrance")
    expect(state.draft.durationText).toBe(String(calm.durationMs))
    expect(state.draft.easingText).toBe(calm.easingValue)
    expect(state.play).toBeNull()
    expect(state.error).toBeNull()
  })
})
