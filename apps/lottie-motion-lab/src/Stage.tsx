import type { CSSProperties } from "react"
import { Check } from "lucide-react"
import type { ActivePlay, Pattern, Personality } from "@/motion/lab"

type StageProps = {
  personality: Personality
  pattern: Pattern
  play: ActivePlay | null
  draftDuration: string
  draftEasing: string
}

const TILES = [
  { label: "Hours saved", value: "12.4", note: "Hero" },
  { label: "Open loops", value: "3", note: "Queue" },
  { label: "On time", value: "96%", note: "This week" },
  { label: "Notes", value: "8", note: "Unread" },
]

export function Stage({
  personality,
  pattern,
  play,
  draftDuration,
  draftEasing,
}: StageProps) {
  const running =
    play !== null && play.pattern === pattern && play.personality === personality
  const style = running
    ? ({
        "--lab-duration": `${play.durationMs}ms`,
        "--lab-easing": play.easingValue,
        "--lab-stagger": `${play.staggerMs}ms`,
      } as CSSProperties)
    : undefined

  return (
    <section
      className={`lab-stage relative flex h-full min-h-[420px] flex-col overflow-hidden rounded-xl bg-muted ring-1 ring-foreground/10${running ? " lab-play" : ""}`}
      data-testid="stage"
      data-personality={personality}
      data-pattern={pattern}
      data-playing={running ? "true" : "false"}
      data-outcome={running ? play.outcome : "success"}
      style={style}
      aria-label="Motion preview"
    >
      <div className="lab-wash" aria-hidden="true" />
      <div className="relative flex min-h-[340px] flex-1 items-center justify-center px-6 py-10">
        <div key={running ? play.id : "rest"} className="flex w-full justify-center">
          {pattern === "card-entrance" ? <CardScene /> : null}
          {pattern === "loading-success" ? (
            <ButtonScene outcome={running ? play.outcome : "success"} />
          ) : null}
          {pattern === "staggered-dashboard" ? (
            <DashboardScene running={running} staggerMs={running ? play.staggerMs : 0} />
          ) : null}
        </div>
      </div>
      <div className="relative border-t border-border bg-card/80 px-4 py-3">
        <div className="flex flex-col gap-1 text-xs text-muted-foreground">
          <p>
            Draft{" "}
            <span className="font-mono text-foreground" data-testid="draft-duration">
              {draftDuration || "—"}ms
            </span>
            <span className="mx-1">·</span>
            <span className="font-mono text-foreground" data-testid="draft-easing">
              {draftEasing || "—"}
            </span>
          </p>
          <p>
            Last play{" "}
            <span className="font-mono text-foreground" data-testid="played-duration">
              {play ? `${play.durationMs}ms` : "none"}
            </span>
            {play ? (
              <>
                <span className="mx-1">·</span>
                <span className="font-mono text-foreground" data-testid="played-easing">
                  {play.easingValue}
                </span>
              </>
            ) : null}
          </p>
        </div>
        <div
          className="lab-meter"
          aria-hidden="true"
          key={running ? `meter-${play.id}` : "meter-rest"}
        >
          <div className="lab-meter-fill" />
        </div>
      </div>
    </section>
  )
}

function CardScene() {
  return (
    <div className="relative w-[min(100%,340px)]">
      <div className="lab-card-shadow" aria-hidden="true" />
      <article className="lab-card">
        <p className="text-xs tracking-[0.14em] text-muted-foreground uppercase">
          Field note
        </p>
        <h2 className="mt-2 font-heading text-xl font-medium tracking-tight">
          Arrive, then settle
        </h2>
        <p className="lab-card-copy mt-2 text-sm text-muted-foreground">
          Position plus opacity. The shadow is the secondary layer, a beat late.
        </p>
      </article>
    </div>
  )
}

function ButtonScene({ outcome }: { outcome: "success" | "error" }) {
  const done = outcome === "error" ? "Couldn’t save" : "Saved"
  return (
    <div className="lab-action" data-outcome={outcome} role="img" aria-label="Button preview">
      <span className="lab-spinner" aria-hidden="true" />
      <span className="lab-label lab-label-idle">Save changes</span>
      <span className="lab-label lab-label-loading">Saving</span>
      <Check className="lab-check" strokeWidth={2.5} aria-hidden="true" />
      <span className="lab-label lab-label-done">{done}</span>
    </div>
  )
}

function DashboardScene({
  running,
  staggerMs,
}: {
  running: boolean
  staggerMs: number
}) {
  return (
    <div className="grid w-full max-w-lg grid-cols-2 gap-3">
      {TILES.map((tile, index) => (
        <article
          key={tile.label}
          className={`lab-widget${index === 0 ? " col-span-2" : ""}`}
          style={
            running
              ? { animationDelay: `${index * staggerMs}ms` }
              : undefined
          }
        >
          <p className="text-xs text-muted-foreground">{tile.label}</p>
          <p className="mt-1 font-heading text-2xl font-medium tracking-tight">
            {tile.value}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">{tile.note}</p>
          {index === 0 ? (
            <div className="lab-bars" aria-hidden="true">
              <span />
              <span />
              <span />
              <span />
              <span />
            </div>
          ) : null}
        </article>
      ))}
    </div>
  )
}
