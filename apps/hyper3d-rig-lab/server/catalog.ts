import type { AnimationPreset } from "../shared/types.ts"

const inPlace = {
  kind: "in_place" as const,
  alignment: "duplicate" as const,
  period_frames: 30,
  displacement: [0, 0, 0] as [number, number, number],
}

function preset(
  animation_id: string,
  category: string,
  display_name: string,
  content_description: string,
  frames: number,
  duration_seconds: number,
  loop: AnimationPreset["loop"] = inPlace,
): AnimationPreset {
  return {
    animation_id,
    category,
    display_name,
    content_description,
    frames,
    duration_seconds,
    loop,
  }
}

/**
 * Local stand-in for GET /rigging_animations. Ids prefixed with demo_ are
 * fixtures for this lab. human_000017 and canine_000002 match the public
 * documentation examples and are not a copy of the live catalog.
 */
export const MOCK_ANIMATIONS: AnimationPreset[] = [
  preset("demo_idle", "human", "Idle", "Quiet standing pose", 60, 2),
  preset("demo_walk", "human", "Walk", "Forward walk cycle", 36, 1.2),
  preset("demo_wave", "human", "Wave", "Raise one arm and wave", 48, 1.6),
  preset(
    "human_000017",
    "human",
    "flare",
    "Breakdance flare spin",
    31,
    1,
  ),
  preset("demo_turn", "human", "Turn", "Slow turn in place", 45, 1.5),
  preset(
    "canine_000002",
    "canine",
    "run",
    "Galloping at full speed",
    24,
    0.7666666666666667,
  ),
  preset("demo_perch", "bird", "Perch", "Fold the wings and settle", 40, 1.3),
  preset("demo_glide", "bird", "Glide", "Hold the wings open", 50, 1.7, {
    kind: "travel",
    alignment: "next",
    period_frames: 49,
    displacement: [0, 0, 1.2],
  }),
]

export const MOCK_CATEGORIES = [
  "human",
  "canine",
  "bird",
  "fish",
  "heavyhooved",
  "leanhooved",
  "lizard",
  "rodentia",
  "seaturtle",
] as const

export function filterMockAnimations(category: string | null): AnimationPreset[] {
  if (!category) return MOCK_ANIMATIONS
  if (!MOCK_CATEGORIES.includes(category as (typeof MOCK_CATEGORIES)[number])) return []
  return MOCK_ANIMATIONS.filter((item) => item.category === category)
}
