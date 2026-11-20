export type StudioKind = "image" | "video" | "audio"

export type SampleAsset = {
  id: string
  kind: StudioKind
  title: string
  src: string
  file: string
  mime: string
  durationSeconds: number | null
  alt: string
  license: string
  source: string
}

export type MockModel = {
  id: string
  name: string
  kind: StudioKind
}

export type PromptPreset = {
  id: string
  label: string
  prompt: string
  kind: StudioKind
}

export const MOCK_BADGE = "mock / sample file"

export const DISCLOSURE =
  "Bundled sample. The lab packed this file in advance. It is not live model output."

export const SAMPLE_LICENSE = "CC0 1.0"

export const SAMPLE_SOURCE =
  "Original synthetic media created for this lab. See public/samples/SOURCE.md."

export const SAMPLES: Record<StudioKind, SampleAsset> = {
  image: {
    id: "harbor-still",
    kind: "image",
    title: "Harbor still",
    src: "/samples/harbor-still.png",
    file: "public/samples/harbor-still.png",
    mime: "image/png",
    durationSeconds: null,
    alt: "Synthetic sample still of a geometric harbor, labeled SAMPLE",
    license: SAMPLE_LICENSE,
    source: SAMPLE_SOURCE,
  },
  video: {
    id: "harbor-reel",
    kind: "video",
    title: "Harbor reel",
    src: "/samples/harbor-reel.mp4",
    file: "public/samples/harbor-reel.mp4",
    mime: "video/mp4",
    durationSeconds: 2,
    alt: "Two-second synthetic sample reel derived from the harbor still",
    license: SAMPLE_LICENSE,
    source: SAMPLE_SOURCE,
  },
  audio: {
    id: "harbor-tone",
    kind: "audio",
    title: "Harbor tone",
    src: "/samples/harbor-tone.wav",
    file: "public/samples/harbor-tone.wav",
    mime: "audio/wav",
    durationSeconds: 2,
    alt: "Two-second synthesized sample tone",
    license: SAMPLE_LICENSE,
    source: SAMPLE_SOURCE,
  },
}

export const MODELS: MockModel[] = [
  { id: "sample-still", name: "Sample Still", kind: "image" },
  { id: "sample-still-soft", name: "Sample Still Soft", kind: "image" },
  { id: "sample-reel", name: "Sample Reel", kind: "video" },
  { id: "sample-tone", name: "Sample Tone", kind: "audio" },
]

export const PRESETS: PromptPreset[] = [
  {
    id: "harbor",
    label: "Harbor at dusk",
    prompt: "Geometric harbor at dusk, flat color, film still",
    kind: "image",
  },
  {
    id: "slip",
    label: "Empty slip",
    prompt: "Quiet slip and a low sun, graphic still",
    kind: "image",
  },
  {
    id: "push",
    label: "Slow push",
    prompt: "Slow push across the harbor, two seconds",
    kind: "video",
  },
  {
    id: "hold",
    label: "Locked hold",
    prompt: "Locked hold on the pier, two seconds",
    kind: "video",
  },
  {
    id: "tone",
    label: "Room tone",
    prompt: "Soft two-note room tone, two seconds",
    kind: "audio",
  },
  {
    id: "fifth",
    label: "Distant fifth",
    prompt: "Quiet fifth, two seconds, no melody",
    kind: "audio",
  },
]

export function isStudioKind(value: string): value is StudioKind {
  return value === "image" || value === "video" || value === "audio"
}

export function modelsFor(kind: StudioKind): MockModel[] {
  return MODELS.filter((model) => model.kind === kind)
}

export function presetsFor(kind: StudioKind): PromptPreset[] {
  return PRESETS.filter((preset) => preset.kind === kind)
}

export function sampleFor(kind: StudioKind): SampleAsset {
  return SAMPLES[kind]
}
