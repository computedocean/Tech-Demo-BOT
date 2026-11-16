import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  proposedStep,
  scriptComplete,
  transcript,
  type StandInState,
} from "@/lib/stand-in"

export function StandInPanel({
  state,
  onPropose,
  onAccept,
  onDismiss,
}: {
  state: StandInState
  onPropose: () => void
  onAccept: () => void
  onDismiss: () => void
}) {
  const pending = proposedStep(state)
  const lines = transcript(state)
  const done = scriptComplete(state)

  return (
    <Card data-testid="stand-in">
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div className="flex flex-col gap-1">
            <CardTitle>Supercomputer stand-in</CardTitle>
            <CardDescription>
              A fixed script proposes the next step. Accept and dismiss stay in this lab.
            </CardDescription>
          </div>
          <Badge variant="outline">Scripted</Badge>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <ol className="flex max-h-48 flex-col gap-2 overflow-auto" data-testid="transcript">
          {lines.map((line, index) => (
            <li
              key={`${line.role}-${index}`}
              className={
                line.role === "stand-in"
                  ? "rounded-lg bg-muted px-3 py-2 text-sm"
                  : "rounded-lg px-3 py-2 text-sm"
              }
            >
              <span className="mr-2 text-xs tracking-wide text-muted-foreground uppercase">
                {line.role === "stand-in" ? "Stand-in" : "You"}
              </span>
              {line.text}
            </li>
          ))}
        </ol>

        {pending ? (
          <div className="flex flex-col gap-3 rounded-lg border p-3" data-testid="proposal">
            <div>
              <p className="text-xs tracking-wide text-muted-foreground uppercase">Proposed step</p>
              <p className="mt-1 text-sm font-medium">{pending.title}</p>
              <p className="mt-1 text-sm text-muted-foreground">{pending.detail}</p>
            </div>
            <div className="flex gap-2">
              <Button type="button" data-testid="accept-step" onClick={onAccept}>
                Accept
              </Button>
              <Button type="button" variant="outline" data-testid="dismiss-step" onClick={onDismiss}>
                Dismiss
              </Button>
            </div>
          </div>
        ) : (
          <Button
            type="button"
            variant="secondary"
            data-testid="propose-step"
            onClick={onPropose}
            disabled={done}
          >
            {done ? "Script complete" : "Propose a step"}
          </Button>
        )}
      </CardContent>
    </Card>
  )
}
