import { Upload, X } from 'lucide-react'
import { useRef } from 'react'
import { CLIP_TAGS, type ClipRecord } from '../domain/clips.ts'
import { Badge } from './ui/badge.tsx'
import { Button } from './ui/button.tsx'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card.tsx'

type ClipLibraryProps = {
  clips: ClipRecord[]
  selectedId: string
  tagFilter: string
  onFilter: (tag: string) => void
  onSelect: (clipId: string) => void
  onUpload: (file: File) => void
  onRemove: (clipId: string) => void
}

export function ClipLibrary({
  clips,
  selectedId,
  tagFilter,
  onFilter,
  onSelect,
  onUpload,
  onRemove,
}: ClipLibraryProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const filters = ['all', ...CLIP_TAGS]

  return (
    <Card className="h-full" data-testid="clip-library">
      <CardHeader>
        <CardTitle>Library</CardTitle>
        <CardDescription>
          Pick a synthetic placeholder or add a short video. Uploads stay in this browser.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filter by tag">
          {filters.map((tag) => (
            <Button
              key={tag}
              type="button"
              size="xs"
              variant={tagFilter === tag ? 'default' : 'outline'}
              aria-pressed={tagFilter === tag}
              data-testid={`filter-${tag}`}
              onClick={() => onFilter(tag)}
            >
              {tag === 'all' ? 'All' : tag}
            </Button>
          ))}
        </div>
        <Button type="button" variant="secondary" onClick={() => inputRef.current?.click()}>
          <Upload />
          Upload a short video
        </Button>
        <input
          ref={inputRef}
          className="sr-only"
          type="file"
          accept="video/mp4,video/webm,video/quicktime,video/*"
          data-testid="upload-input"
          onChange={(event) => {
            const file = event.target.files?.[0]
            event.target.value = ''
            if (file) onUpload(file)
          }}
        />
        <ul className="flex flex-col gap-2">
          {clips.length === 0 ? (
            <li className="text-sm text-muted-foreground">No clips for this tag.</li>
          ) : (
            clips.map((clip) => {
              const selected = clip.id === selectedId
              return (
                <li key={clip.id}>
                  <div
                    className={`rounded-lg border p-2 ${selected ? 'border-primary bg-primary/10' : 'border-border'}`}
                  >
                    <button
                      type="button"
                      className="flex w-full items-start justify-between gap-2 text-left"
                      data-testid={`clip-card-${clip.id}`}
                      aria-pressed={selected}
                      onClick={() => onSelect(clip.id)}
                    >
                      <span>
                        <span className="block text-sm font-medium">{clip.title}</span>
                        <span className="text-xs text-muted-foreground">
                          {clip.durationSec.toFixed(1)}s · {clip.origin === 'bundled' ? 'Placeholder' : 'On this device'}
                        </span>
                      </span>
                    </button>
                    <div className="mt-2 flex flex-wrap items-center gap-1">
                      {clip.tags.map((tag) => (
                        <Badge key={tag} variant="outline">
                          {tag}
                        </Badge>
                      ))}
                      {clip.origin === 'upload' ? (
                        <Button
                          type="button"
                          size="xs"
                          variant="ghost"
                          className="ml-auto"
                          aria-label={`Remove ${clip.title}`}
                          onClick={() => onRemove(clip.id)}
                        >
                          <X />
                          Remove
                        </Button>
                      ) : null}
                    </div>
                  </div>
                </li>
              )
            })
          )}
        </ul>
        <p className="text-xs leading-relaxed text-muted-foreground">
          Bundled clips are original synthetic graphics (CC0), rendered with ffmpeg. They are not game footage.
        </p>
      </CardContent>
    </Card>
  )
}
