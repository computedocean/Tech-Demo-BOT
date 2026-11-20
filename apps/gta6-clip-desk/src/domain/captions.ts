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

export function generateCaptionVariants(input: {
  title: string
  tags: readonly string[]
}): CaptionVariant[] {
  const title = input.title.trim() || 'Untitled cut'
  const tags = input.tags.map((tag) => tag.trim()).filter(Boolean)
  const lead = leadTag(tags)
  const line = TAG_LINES[lead] ?? TAG_LINES.city
  const tagList = tags.length > 0 ? tags.join(', ') : 'untagged'

  return [
    {
      id: 'cold-open',
      label: 'Cold open',
      hook: `Stay for the last beat of ${title}.`,
      caption: `${line} ${title} is the vertical cut.`,
      hashtags: hashtagsFor(tags, 0),
    },
    {
      id: 'question',
      label: 'Question',
      hook: `Would you post ${title} like this?`,
      caption: `${line} Tags on this cut: ${tagList}.`,
      hashtags: hashtagsFor(tags, 1),
    },
    {
      id: 'beat',
      label: 'Beat',
      hook: `Three seconds, then ${title}.`,
      caption: `${line} No voiceover on the placeholder.`,
      hashtags: hashtagsFor(tags, 2),
    },
    {
      id: 'quiet',
      label: 'Quiet',
      hook: title,
      caption: line,
      hashtags: hashtagsFor(tags, 3),
    },
  ]
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
