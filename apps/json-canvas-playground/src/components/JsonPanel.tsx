import type { ValidationError } from '@/canvas/types.ts'
import { Badge } from '@/components/ui/badge.tsx'
import { Button } from '@/components/ui/button.tsx'
import { Textarea } from '@/components/ui/textarea.tsx'

export function JsonPanel({
  text,
  errors,
  onChange,
  onFocus,
  onBlur,
  onRevert,
  onRejectSample,
}: {
  text: string
  errors: ValidationError[]
  onChange: (text: string) => void
  onFocus: () => void
  onBlur: () => void
  onRevert: () => void
  onRejectSample: () => void
}) {
  const valid = errors.length === 0
  return (
    <section className="flex h-full min-h-0 flex-col">
      <div className="flex items-center gap-2 border-b px-3 py-2">
        <h2 className="text-sm font-medium">JSON</h2>
        <Badge variant={valid ? 'secondary' : 'destructive'}>{valid ? 'Valid' : `${errors.length} errors`}</Badge>
        <div className="ml-auto flex items-center gap-1">
          <Button type="button" variant="ghost" size="xs" onClick={onRejectSample}>
            Reject sample
          </Button>
          <Button type="button" variant="outline" size="xs" onClick={onRevert} disabled={valid}>
            Revert
          </Button>
        </div>
      </div>
      <Textarea
        value={text}
        spellCheck={false}
        aria-label="JSON Canvas document"
        onChange={(event) => onChange(event.target.value)}
        onFocus={onFocus}
        onBlur={onBlur}
        className="field-sizing-fixed min-h-0 flex-1 resize-none rounded-none border-0 font-mono text-xs leading-relaxed shadow-none focus-visible:ring-0"
      />
      <div className="max-h-40 overflow-auto border-t px-3 py-2">
        {valid ? (
          <p className="text-[11px] text-muted-foreground">
            Live both ways. Canvas edits rewrite this JSON. Valid edits update the canvas immediately.
            Optional defaults stay omitted: fromEnd none, toEnd arrow.
          </p>
        ) : (
          <ul className="flex flex-col gap-1 text-[11px]">
            {errors.slice(0, 12).map((error) => (
              <li key={`${error.path}:${error.message}`}>
                <span className="font-mono text-destructive">{error.path}</span>{' '}
                <span className="text-muted-foreground">{error.message}</span>
              </li>
            ))}
            {errors.length > 12 ? (
              <li className="text-muted-foreground">{errors.length - 12} more</li>
            ) : null}
          </ul>
        )}
      </div>
    </section>
  )
}
