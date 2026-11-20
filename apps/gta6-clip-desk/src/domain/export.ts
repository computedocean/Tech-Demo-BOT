import type { QueueItem } from './queue.ts'

export const EXPORT_FIELDS = [
  'clipId',
  'title',
  'tags',
  'trimIn',
  'trimOut',
  'caption',
  'hook',
  'hashtags',
  'slot',
] as const

export type ExportRow = {
  clipId: string
  title: string
  tags: string[]
  trimIn: number
  trimOut: number
  caption: string
  hook: string
  hashtags: string[]
  slot: string
}

export function toExportRow(item: QueueItem): ExportRow {
  return {
    clipId: item.clipId,
    title: item.title,
    tags: [...item.tags],
    trimIn: item.trimIn,
    trimOut: item.trimOut,
    caption: item.caption,
    hook: item.hook,
    hashtags: [...item.hashtags],
    slot: item.slot,
  }
}

export function queueToJson(items: readonly QueueItem[]): string {
  return `${JSON.stringify(items.map(toExportRow), null, 2)}\n`
}

function csvCell(value: string | number): string {
  const text = String(value)
  if (/[",\n\r]/.test(text)) return `"${text.replaceAll('"', '""')}"`
  return text
}

export function queueToCsv(items: readonly QueueItem[]): string {
  const header = EXPORT_FIELDS.join(',')
  const lines = items.map((item) => {
    const row = toExportRow(item)
    return [
      csvCell(row.clipId),
      csvCell(row.title),
      csvCell(row.tags.join('|')),
      csvCell(row.trimIn),
      csvCell(row.trimOut),
      csvCell(row.caption),
      csvCell(row.hook),
      csvCell(row.hashtags.join('|')),
      csvCell(row.slot),
    ].join(',')
  })
  return [header, ...lines].join('\n') + '\n'
}
