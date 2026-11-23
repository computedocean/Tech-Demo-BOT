import { DEFAULT_HOOK_BANK, renderHookPattern, type HookTemplate } from './hooks.ts'

export type CaptionVariant = {
  id: string
  label: string
  hook: string
  caption: string
  hashtags: string[]
}

const TAG_LINES: Record<string, string> = {
  chase: 'Two plain shapes share one lane.',
  stunt: 'One hop, then the landing.',
  night: 'Lights low and blocks tall.',
  funny: 'The timing is the whole joke.',
  city: 'A synthetic skyline and a plain vehicle.',
  cruise: 'Hold the line along the water.',
  upload: 'This file stays in the browser.',
}

function leadTag(tags: readonly string[]): string {
  return tags.find((tag) => tag.trim())?.trim().toLowerCase() ?? 'city'
}

function unique(values: string[]): string[] {
  const seen = new Set<string>()
  const result: string[] = []
  for (const value of values) {
    const key = value.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    result.push(value)
  }
  return result
}

export function hashtagsFor(tags: readonly string[], variantIndex: number): string[] {
  const topical = ['#ClipDesk', '#OpenWorld', '#GTA6']
  const fromTags = tags
    .map((tag) => tag.trim())
    .filter(Boolean)
    .map((tag) => `#${tag.slice(0, 1).toUpperCase()}${tag.slice(1).toLowerCase()}Cut`)
  const rotated = variantIndex % 2 === 0 ? [...topical, ...fromTags] : [...fromTags, ...topical]
  return unique(rotated).slice(0, 6)
}

function captionBody(index: number, title: string, line: string, tagList: string): string {
  const bodies = [
    `${line} ${title} is the vertical cut.`,
    `${line} Tags on this cut: ${tagList}.`,
    `${line} No voiceover on the placeholder.`,
    line,
  ]
  return bodies[index % bodies.length] ?? line
}

export function generateCaptionVariants(input: {
  title: string
  tags: readonly string[]
  hooks?: readonly HookTemplate[]
}): CaptionVariant[] {
  const title = input.title.trim() || 'Untitled cut'
  const tags = input.tags.map((tag) => tag.trim()).filter(Boolean)
  const lead = leadTag(tags)
  const line = TAG_LINES[lead] ?? TAG_LINES.city
  const tagList = tags.length > 0 ? tags.join(', ') : 'untagged'
  const hooks = input.hooks && input.hooks.length > 0 ? input.hooks : DEFAULT_HOOK_BANK

  return hooks.map((hook, index) => ({
    id: hook.id,
    label: hook.label,
    hook: renderHookPattern(hook.pattern, title),
    caption: captionBody(index, title, line, tagList),
    hashtags: hashtagsFor(tags, index),
  }))
}

export function parseHashtagInput(value: string): string[] {
  return unique(
    value
      .split(/[\s,]+/)
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => (part.startsWith('#') ? part : `#${part}`)),
  )
}
