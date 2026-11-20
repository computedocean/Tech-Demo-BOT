import { Sparkles } from 'lucide-react'
import { useState } from 'react'
import { generateCaptionVariants, parseHashtagInput } from '../domain/captions.ts'
import { CLIP_TAGS } from '../domain/clips.ts'
import type { ClipDraft } from '../domain/desk.ts'
import type { DeskAction } from '../domain/desk.ts'
import { requestServerRewrite } from '../lib/rewrite-client.ts'
import { Badge } from './ui/badge.tsx'
import { Button } from './ui/button.tsx'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card.tsx'
import { Input } from './ui/input.tsx'
import { Label } from './ui/label.tsx'
import { Textarea } from './ui/textarea.tsx'

type CaptionPanelProps = {
  draft: ClipDraft
  dispatch: (action: DeskAction) => void
}

export function CaptionPanel({ draft, dispatch }: CaptionPanelProps) {
  const [pending, setPending] = useState(false)
  const variants = generateCaptionVariants({ title: draft.title, tags: draft.tags })

  async function rewrite() {
    setPending(true)
    const result = await requestServerRewrite({
      title: draft.title,
      tags: draft.tags,
      hook: draft.hook,
      caption: draft.caption,
      hashtags: draft.hashtags,
    })
    setPending(false)
    if (!result.enabled) {
      dispatch({ type: 'setNotice', notice: result.message })
      return
    }
    dispatch({
      type: 'applyServerCopy',
      hook: result.hook,
      caption: result.caption,
      hashtags: result.hashtags,
    })
  }

  return (
    <Card data-testid="caption-panel">
      <CardHeader>
        <CardTitle>Caption</CardTitle>
        <CardDescription>
          Offline templates from the title and tags. Edit any variant. Server rewrite is optional and off by default.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <Label className="flex-col items-stretch gap-1.5">
          Title
          <Input
            data-testid="clip-title"
            value={draft.title}
            onChange={(event) => dispatch({ type: 'setTitle', title: event.target.value })}
          />
        </Label>
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Tags on this cut">
          {CLIP_TAGS.map((tag) => {
            const active = draft.tags.some((item) => item.toLowerCase() === tag)
            return (
              <Button
                key={tag}
                type="button"
                size="xs"
                variant={active ? 'default' : 'outline'}
                aria-pressed={active}
                data-testid={`tag-${tag}`}
                onClick={() => dispatch({ type: 'toggleTag', tag })}
              >
                {tag}
              </Button>
            )
          })}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            data-testid="generate-captions"
            onClick={() => dispatch({ type: 'regenerate' })}
          >
            <Sparkles />
            Generate mock captions
          </Button>
          <Button type="button" variant="outline" disabled={pending} onClick={() => void rewrite()}>
            {pending ? 'Checking server…' : 'Server rewrite'}
          </Button>
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          {variants.map((variant) => (
            <button
              key={variant.id}
              type="button"
              data-testid={`variant-${variant.id}`}
              aria-pressed={draft.variantId === variant.id}
              className={`rounded-lg border p-2 text-left text-sm ${draft.variantId === variant.id ? 'border-primary bg-primary/10' : 'border-border hover:bg-muted/40'}`}
              onClick={() => dispatch({ type: 'applyVariant', variantId: variant.id })}
            >
              <span className="mb-1 flex items-center gap-2">
                <Badge variant="secondary">{variant.label}</Badge>
              </span>
              <span className="line-clamp-2 text-muted-foreground">{variant.hook}</span>
            </button>
          ))}
        </div>
        <Label className="flex-col items-stretch gap-1.5">
          Hook
          <Input
            data-testid="hook-text"
            value={draft.hook}
            onChange={(event) => dispatch({ type: 'setHook', hook: event.target.value })}
          />
        </Label>
        <Label className="flex-col items-stretch gap-1.5">
          Caption
          <Textarea
            data-testid="caption-text"
            value={draft.caption}
            rows={3}
            onChange={(event) => dispatch({ type: 'setCaption', caption: event.target.value })}
          />
        </Label>
        <Label className="flex-col items-stretch gap-1.5">
          Hashtags
          <Input
            data-testid="hashtags-text"
            value={draft.hashtags.join(' ')}
            onChange={(event) =>
              dispatch({ type: 'setHashtags', hashtags: parseHashtagInput(event.target.value) })
            }
          />
        </Label>
      </CardContent>
    </Card>
  )
}
