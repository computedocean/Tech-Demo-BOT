import { Badge } from '@/components/ui/badge.tsx'
import { Button } from '@/components/ui/button.tsx'
import { Input } from '@/components/ui/input.tsx'
import type { Plan, StepFlag } from '@/domain/types.ts'

const LOCKED = new Set(['--compact', '--accurate', '--srt', '--normalize', '--no-normalize', '--mode'])

type StepListProps = {
  plan: Plan
  flagError: string | null
  onFlag: (stepId: string, name: string, value: string) => void
  onRemove: (stepId: string) => void
  onMove: (stepId: string, direction: -1 | 1) => void
}

export function StepList({ plan, flagError, onFlag, onRemove, onMove }: StepListProps) {
  return (
    <section className="flex flex-col gap-3" data-testid="step-list">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h2 className="text-base font-medium">Tool calls</h2>
          <p className="text-xs text-muted-foreground">
            Edit a flag and the ffmpeg line updates. Removing a step drops it from the run.
          </p>
        </div>
        <Badge variant="outline">{plan.steps.length} steps</Badge>
      </div>
      {flagError ? (
        <p className="text-sm text-destructive" role="alert">
          {flagError}
        </p>
      ) : null}
      <ol className="flex flex-col gap-3">
        {plan.steps.map((step, index) => (
          <li key={step.id} className="rounded-xl bg-card p-3 ring-1 ring-foreground/10" data-testid={`step-${step.tool}`}>
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <Badge>{index + 1}</Badge>
              <span className="font-mono text-sm font-medium">{step.tool}</span>
              <span className="text-sm text-muted-foreground">{step.summary}</span>
              <span className="ml-auto flex gap-1">
                <Button type="button" size="sm" variant="ghost" onClick={() => onMove(step.id, -1)} disabled={index === 0}>
                  Up
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => onMove(step.id, 1)}
                  disabled={index === plan.steps.length - 1}
                >
                  Down
                </Button>
                <Button type="button" size="sm" variant="ghost" onClick={() => onRemove(step.id)}>
                  Remove
                </Button>
              </span>
            </div>
            <p className="font-mono text-xs" data-testid="tool-line">
              {step.toolLine}
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {step.flags.map((item) => (
                <FlagField key={`${step.id}-${item.name}`} stepId={step.id} flag={item} onFlag={onFlag} />
              ))}
            </div>
            {step.commands.map((command) => (
              <pre
                key={command}
                data-testid="ffmpeg-command"
                className="mt-2 overflow-x-auto rounded-md bg-muted p-2 font-mono text-[11px] leading-relaxed whitespace-pre-wrap break-all"
              >
                {command}
              </pre>
            ))}
            <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{step.note}</p>
          </li>
        ))}
      </ol>
    </section>
  )
}

function FlagField({
  stepId,
  flag,
  onFlag,
}: {
  stepId: string
  flag: StepFlag
  onFlag: (stepId: string, name: string, value: string) => void
}) {
  if (flag.value === '' || LOCKED.has(flag.name)) {
    return (
      <span className="rounded-md bg-muted px-2 py-1 font-mono text-[11px] text-muted-foreground">
        {flag.name}
        {flag.value ? ` ${flag.value}` : ''}
      </span>
    )
  }
  return (
    <label className="flex items-center gap-1 text-[11px] text-muted-foreground">
      <span className="font-mono">{flag.name}</span>
      <Input
        className="h-7 w-24 font-mono text-xs"
        value={flag.value}
        aria-label={`${flag.name} for ${stepId}`}
        onChange={(event) => onFlag(stepId, flag.name, event.target.value)}
      />
    </label>
  )
}
