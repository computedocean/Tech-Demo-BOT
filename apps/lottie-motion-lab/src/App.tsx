import { useReducer } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import {
  CHECKLIST,
  EASING_PRESETS,
  PATTERNS,
  PATTERN_HINT,
  PATTERN_LABEL,
  PERSONALITIES,
  PERSONALITY_LABEL,
  createLabState,
  getDefaults,
  parseEasing,
  reduceLab,
  type Outcome,
} from "@/motion/lab"
import { Stage } from "@/Stage"

const EASING_ITEMS = [
  ...EASING_PRESETS.map((preset) => ({ value: preset.id, label: preset.label })),
  { value: "custom", label: "Custom curve" },
]

export default function App() {
  const [state, dispatch] = useReducer(reduceLab, undefined, () =>
    createLabState(),
  )
  const defaults = getDefaults(state.personality, state.pattern)
  const matched = parseEasing(state.draft.easingText)
  const presetId =
    matched && EASING_PRESETS.some((preset) => preset.id === matched.id)
      ? matched.id
      : "custom"

  return (
    <div className="min-h-svh bg-background text-foreground">
      <main className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-4 py-4 md:px-6 md:py-5">
        <header className="flex flex-col gap-3">
          <p className="text-xs tracking-[0.16em] text-muted-foreground uppercase">
            Timing bench
          </p>
          <div className="flex flex-col gap-2">
            <h1 className="font-heading text-3xl font-medium tracking-tight">
              Lottie motion lab
            </h1>
            <p className="max-w-2xl text-sm text-muted-foreground">
              Pick a personality and a pattern. Duration and easing stay
              visible, and they take effect the next time you play.
            </p>
          </div>
          <ul className="flex flex-wrap gap-1.5" aria-label="Motion checklist">
            {CHECKLIST.map((step) => (
              <li key={step}>
                <Badge variant="outline">{step}</Badge>
              </li>
            ))}
          </ul>
        </header>

        <div className="grid items-stretch gap-4 lg:grid-cols-[380px_minmax(0,1fr)]">
          <Card size="sm">
            <CardHeader>
              <CardTitle>Setup</CardTitle>
              <CardDescription>
                Defaults follow the personality. Edits wait for Play.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <fieldset className="flex flex-col gap-2">
                <legend className="text-sm font-medium">Personality</legend>
                <div className="grid grid-cols-3 gap-1.5">
                  {PERSONALITIES.map((personality) => (
                    <Button
                      key={personality}
                      type="button"
                      size="sm"
                      variant={
                        state.personality === personality ? "default" : "outline"
                      }
                      aria-pressed={state.personality === personality}
                      data-testid={`personality-${personality}`}
                      onClick={() =>
                        dispatch({ type: "set-personality", personality })
                      }
                    >
                      {PERSONALITY_LABEL[personality]}
                    </Button>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">{defaults.intent}</p>
              </fieldset>

              <fieldset className="flex flex-col gap-2">
                <legend className="text-sm font-medium">Pattern</legend>
                <div className="flex flex-col gap-1.5">
                  {PATTERNS.map((pattern) => (
                    <Button
                      key={pattern}
                      type="button"
                      size="sm"
                      variant={state.pattern === pattern ? "default" : "outline"}
                      aria-pressed={state.pattern === pattern}
                      data-testid={`pattern-${pattern}`}
                      className="justify-start"
                      onClick={() => dispatch({ type: "set-pattern", pattern })}
                    >
                      {PATTERN_LABEL[pattern]}
                    </Button>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">
                  {PATTERN_HINT[state.pattern]}
                </p>
              </fieldset>

              {state.pattern === "loading-success" ? (
                <OutcomePicker
                  outcome={state.outcome}
                  onChange={(outcome) =>
                    dispatch({ type: "set-outcome", outcome })
                  }
                />
              ) : null}

              <Separator />

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="duration">Duration (ms)</Label>
                <Input
                  id="duration"
                  data-testid="duration-input"
                  inputMode="numeric"
                  autoComplete="off"
                  value={state.draft.durationText}
                  aria-invalid={state.error?.includes("Duration") ?? false}
                  onChange={(event) =>
                    dispatch({
                      type: "edit-duration",
                      value: event.target.value,
                    })
                  }
                  onKeyDown={(event) => {
                    if (event.key === "Enter") dispatch({ type: "play" })
                  }}
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="easing-preset">Easing</Label>
                <Select
                  items={EASING_ITEMS}
                  value={presetId}
                  onValueChange={(value) => {
                    if (!value || value === "custom") return
                    const preset = EASING_PRESETS.find((item) => item.id === value)
                    if (!preset) return
                    dispatch({ type: "edit-easing", value: preset.value })
                  }}
                >
                  <SelectTrigger id="easing-preset" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {EASING_PRESETS.map((preset) => (
                      <SelectItem key={preset.id} value={preset.id}>
                        {preset.label}
                      </SelectItem>
                    ))}
                    <SelectItem value="custom">Custom curve</SelectItem>
                  </SelectContent>
                </Select>
                <Input
                  id="easing"
                  data-testid="easing-input"
                  className="font-mono text-xs"
                  autoComplete="off"
                  spellCheck={false}
                  aria-label="Easing value"
                  value={state.draft.easingText}
                  aria-invalid={state.error?.includes("Easing") ?? false}
                  onChange={(event) =>
                    dispatch({ type: "edit-easing", value: event.target.value })
                  }
                  onKeyDown={(event) => {
                    if (event.key === "Enter") dispatch({ type: "play" })
                  }}
                />
              </div>

              <Button
                type="button"
                data-testid="play-button"
                onClick={() => dispatch({ type: "play" })}
              >
                {state.play ? "Replay" : "Play"}
              </Button>
              {state.error ? (
                <p role="alert" className="text-xs text-destructive" data-testid="timing-error">
                  {state.error}
                </p>
              ) : (
                <p className="text-xs text-muted-foreground">
                  {state.pattern === "staggered-dashboard"
                    ? `Stagger ${defaults.staggerMs}ms comes from the personality.`
                    : "These values are used the next time you press Play."}
                </p>
              )}

              <div className="flex flex-col gap-1">
                <h2 className="text-sm font-medium">Why this timing</h2>
                <p className="text-sm text-muted-foreground" data-testid="why-note">
                  {defaults.why}
                </p>
              </div>
            </CardContent>
          </Card>

          <Stage
            personality={state.personality}
            pattern={state.pattern}
            play={state.play}
            draftDuration={state.draft.durationText}
            draftEasing={state.draft.easingText}
          />
        </div>

        <footer className="text-xs leading-relaxed text-muted-foreground">
          Independent demo. Not an official LottieFiles product and not a skill
          runner. Motion timing is hand-implemented from{" "}
          <a
            className="underline underline-offset-2"
            href="https://github.com/LottieFiles/motion-design-skill"
          >
            motion-design-skill
          </a>
          , MIT.
        </footer>
      </main>
    </div>
  )
}

function OutcomePicker({
  outcome,
  onChange,
}: {
  outcome: Outcome
  onChange: (outcome: Outcome) => void
}) {
  const options: { id: Outcome; label: string }[] = [
    { id: "success", label: "Success" },
    { id: "error", label: "Error" },
  ]
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="text-sm font-medium">Button ending</legend>
      <div className="grid grid-cols-2 gap-1.5">
        {options.map((option) => (
          <Button
            key={option.id}
            type="button"
            size="sm"
            variant={outcome === option.id ? "default" : "outline"}
            aria-pressed={outcome === option.id}
            data-testid={`outcome-${option.id}`}
            onClick={() => onChange(option.id)}
          >
            {option.label}
          </Button>
        ))}
      </div>
    </fieldset>
  )
}
