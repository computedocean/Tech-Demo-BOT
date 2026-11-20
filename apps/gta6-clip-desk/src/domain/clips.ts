export const CLIP_TAGS = ['chase', 'stunt', 'night', 'funny', 'city', 'cruise'] as const

export type ClipTag = (typeof CLIP_TAGS)[number]

export type ClipOrigin = 'bundled' | 'upload'

export type ClipRecord = {
  id: string
  title: string
  tags: string[]
  durationSec: number
  src: string
  origin: ClipOrigin
  license: string
}

export const PLACEHOLDER_LICENSE =
  'Original synthetic placeholder. Generated with ffmpeg lavfi color sources and overlay. No recorded footage and no game assets. CC0 1.0.'

export const BUNDLED_CLIPS: readonly ClipRecord[] = [
  {
    id: 'harbor-cruise',
    title: 'Harbor cruise',
    tags: ['night', 'cruise', 'city'],
    durationSec: 6,
    src: '/clips/harbor-cruise.mp4',
    origin: 'bundled',
    license: PLACEHOLDER_LICENSE,
  },
  {
    id: 'rooftop-hop',
    title: 'Rooftop hop',
    tags: ['stunt', 'funny'],
    durationSec: 6,
    src: '/clips/rooftop-hop.mp4',
    origin: 'bundled',
    license: PLACEHOLDER_LICENSE,
  },
  {
    id: 'lane-chase',
    title: 'Lane chase',
    tags: ['chase', 'city'],
    durationSec: 6,
    src: '/clips/lane-chase.mp4',
    origin: 'bundled',
    license: PLACEHOLDER_LICENSE,
  },
  {
    id: 'grid-pass',
    title: 'Grid pass',
    tags: ['night', 'city'],
    durationSec: 6,
    src: '/clips/grid-pass.mp4',
    origin: 'bundled',
    license: PLACEHOLDER_LICENSE,
  },
]

export function filterClips<T extends { tags: readonly string[] }>(
  clips: readonly T[],
  tag: string,
): T[] {
  if (tag === 'all' || tag.trim() === '') return [...clips]
  const needle = tag.trim().toLowerCase()
  return clips.filter((clip) => clip.tags.some((item) => item.toLowerCase() === needle))
}

export function toggleTag(tags: readonly string[], tag: string): string[] {
  const needle = tag.trim().toLowerCase()
  if (!needle) return [...tags]
  const exists = tags.some((item) => item.toLowerCase() === needle)
  if (exists) return tags.filter((item) => item.toLowerCase() !== needle)
  return [...tags, tag.trim()]
}
