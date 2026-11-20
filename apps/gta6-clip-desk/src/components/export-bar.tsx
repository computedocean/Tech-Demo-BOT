import { Download } from 'lucide-react'
import { useState } from 'react'
import type { ClipRecord } from '../domain/clips.ts'
import type { ClipDraft } from '../domain/desk.ts'
import { queueToCsv, queueToJson } from '../domain/export.ts'
import type { QueueItem } from '../domain/queue.ts'
import { burnCaptionPreview } from '../lib/burn-overlay.ts'
import { downloadBlob, downloadText } from '../lib/download.ts'
import { Button } from './ui/button.tsx'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card.tsx'

type ExportBarProps = {
  queue: QueueItem[]
  clip: ClipRecord
  draft: ClipDraft
  onNotice: (notice: string) => void
}

export function ExportBar({ queue, clip, draft, onNotice }: ExportBarProps) {
  const [burning, setBurning] = useState(false)

  async function burn() {
    setBurning(true)
    try {
      const blob = await burnCaptionPreview({
        src: clip.src,
        trimIn: draft.trimIn,
        trimOut: draft.trimOut,
        hook: draft.hook,
        caption: draft.caption,
      })
      downloadBlob('clip-desk-preview.webm', blob)
      onNotice('Saved a local caption-overlay preview. Nothing was posted.')
    } catch (error) {
      onNotice(error instanceof Error ? error.message : 'Could not burn the preview.')
    } finally {
      setBurning(false)
    }
  }

  return (
    <Card data-testid="export-bar">
      <CardHeader>
        <CardTitle>Export</CardTitle>
        <CardDescription>
          Download the queue, or burn this cut with the caption drawn on a canvas. The file stays on this machine.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        <Button
          type="button"
          variant="secondary"
          data-testid="export-json"
          onClick={() => {
            downloadText('clip-desk-queue.json', queueToJson(queue), 'application/json')
            onNotice('Downloaded the queue as JSON.')
          }}
        >
          <Download />
          Queue JSON
        </Button>
        <Button
          type="button"
          variant="secondary"
          data-testid="export-csv"
          onClick={() => {
            downloadText('clip-desk-queue.csv', queueToCsv(queue), 'text/csv')
            onNotice('Downloaded the queue as CSV.')
          }}
        >
          <Download />
          Queue CSV
        </Button>
        <Button type="button" data-testid="export-burn" disabled={burning} onClick={() => void burn()}>
          {burning ? 'Burning preview…' : 'Burn caption preview'}
        </Button>
        <p className="text-xs text-muted-foreground">
          Canvas and MediaRecorder draw the overlay. ffmpeg.wasm is not used.
        </p>
      </CardContent>
    </Card>
  )
}
