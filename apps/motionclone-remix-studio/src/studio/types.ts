export const EASES = [
  { value: "power2.out", label: "Soft out" },
  { value: "power3.inOut", label: "Smooth in-out" },
  { value: "expo.out", label: "Expo out" },
  { value: "back.out", label: "Overshoot" },
  { value: "none", label: "Linear" },
] as const

export type EaseName = (typeof EASES)[number]["value"]

export type SceneTokens = {
  headline: string
  body: string
  kicker: string
  ink: string
  paper: string
  signal: string
  duration: number
  delay: number
  stagger: number
  ease: EaseName
}

/** Sample clip length. The bundled mp4 is rendered at this duration. */
export const SAMPLE_DURATION = 6.5

export const defaultTokens: SceneTokens = {
  headline: "Northline",
  body: "Typography, shape, and a shared clock.",
  kicker: "Field note",
  ink: "#1c1915",
  paper: "#f4efe4",
  signal: "#d86a3a",
  duration: SAMPLE_DURATION,
  delay: 0.25,
  stagger: 0.09,
  ease: "power3.inOut",
}

export const SAMPLE_VIDEO = "/samples/northline.mp4"

export const REBUILD_NOTICE =
  "Playing that clip on the original side only. Live reconstruction needs the official MotionClone Windows app and a Codex / ChatGPT login. The editable rebuild stays the bundled Northline scene."

export type PlaybackSource = {
  kind: "sample" | "file" | "url"
  src: string
  label: string
}

export function sampleSource(): PlaybackSource {
  return { kind: "sample", src: SAMPLE_VIDEO, label: "Bundled sample" }
}

export function isEaseName(value: string): value is EaseName {
  return EASES.some((item) => item.value === value)
}
