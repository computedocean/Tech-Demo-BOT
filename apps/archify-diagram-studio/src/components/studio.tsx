import { useState, type FormEvent } from "react"
import { DiagramCanvas } from "@/components/diagram-canvas.tsx"
import { Button } from "@/components/ui/button.tsx"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card.tsx"
import { Input } from "@/components/ui/input.tsx"
import { Label } from "@/components/ui/label.tsx"
import { Textarea } from "@/components/ui/textarea.tsx"
import { requestStudio } from "@/lib/api.ts"
import { EDIT_SUGGESTIONS } from "@/lib/edit.ts"
import { clearHighlight, highlightPath } from "@/lib/highlight.ts"
import { PRESETS } from "@/lib/presets.ts"
import type { Diagram, Highlight, TemplateId } from "@/lib/types.ts"

export function Studio() {
  const [prompt, setPrompt] = useState("")
  const [edit, setEdit] = useState("")
  const [diagram, setDiagram] = useState<Diagram | null>(null)
  const [highlight, setHighlight] = useState<Highlight>(clearHighlight())
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [suggestions, setSuggestions] = useState<string[]>([])
  const [note, setNote] = useState("Templates are the default. Optional rewrite is off.")
  const [usedLlm, setUsedLlm] = useState(false)
  const [pending, setPending] = useState(false)

  function showFailure(message: string, nextSuggestions: string[]) {
    setError(message)
    setSuggestions(nextSuggestions)
  }

  async function commit(request: Parameters<typeof requestStudio>[0], kind: "generate" | "edit") {
    setPending(true)
    try {
      const result = await requestStudio(request)
      if (!result.ok) {
        showFailure(result.error, result.suggestions)
        return
      }
      setDiagram(result.diagram)
      setError(null)
      setSuggestions([])
      setNote(result.note)
      setUsedLlm(result.usedLlm)
      setHighlight(clearHighlight())
      if (kind === "generate") {
        setSelectedId(null)
      } else if (selectedId && !result.diagram.nodes.some((node) => node.id === selectedId)) {
        setSelectedId(null)
      }
    } finally {
      setPending(false)
    }
  }

  function onGenerate(event: FormEvent) {
    event.preventDefault()
    void commit({ action: "generate", prompt }, "generate")
  }

  function onPreset(id: TemplateId) {
    const preset = PRESETS.find((item) => item.id === id)
    if (preset) setPrompt(preset.label)
    void commit({ action: "preset", presetId: id }, "generate")
  }

  function onEdit(event: FormEvent) {
    event.preventDefault()
    if (!diagram) {
      showFailure("Generate a diagram before applying an edit.", EDIT_SUGGESTIONS)
      return
    }
    void commit({ action: "edit", edit, diagram }, "edit")
  }

  function applyPhrase(phrase: string) {
    setEdit(phrase)
    if (!diagram) {
      showFailure("Generate a diagram before applying an edit.", EDIT_SUGGESTIONS)
      return
    }
    void commit({ action: "edit", edit: phrase, diagram }, "edit")
  }

  function onHighlight(pathId: string) {
    if (!diagram) return
    const result = highlightPath(diagram, pathId)
    if (!result.ok) {
      showFailure(result.error, [])
      return
    }
    setError(null)
    setSuggestions([])
    setHighlight(result.highlight)
  }

  return (
    <div className="flex min-h-svh flex-col bg-background text-foreground">
      <header className="flex flex-wrap items-end justify-between gap-4 border-b border-border px-5 py-4">
        <div>
          <p className="text-[11px] font-medium tracking-[0.18em] text-muted-foreground uppercase">Diagram studio</p>
          <h1 className="font-display text-3xl leading-tight">Walk a system before you build it.</h1>
        </div>
        <p className="max-w-md text-sm leading-relaxed text-muted-foreground">
          Describe a small system or pick a preset. Pan and zoom the diagram, open a node, highlight a path, then edit it in place.
        </p>
      </header>
      <div className="grid min-h-0 flex-1 lg:grid-cols-[22rem_minmax(0,1fr)]">
        <aside className="flex flex-col gap-3 overflow-auto border-b border-border p-4 lg:max-h-[calc(100svh-8.75rem)] lg:border-r lg:border-b-0">
          <Card size="sm">
            <CardHeader>
              <CardTitle>System</CardTitle>
              <CardDescription>A short description, or one of the presets.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <form className="flex flex-col gap-3" onSubmit={onGenerate}>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="system-description">System description</Label>
                  <Textarea
                    id="system-description"
                    value={prompt}
                    onChange={(event) => setPrompt(event.target.value)}
                    placeholder="A web app with an API and a database"
                    rows={3}
                  />
                </div>
                <Button type="submit" disabled={pending}>
                  Generate diagram
                </Button>
              </form>
              <div className="flex flex-col gap-2">
                {PRESETS.map((preset) => (
                  <Button
                    key={preset.id}
                    type="button"
                    variant={diagram?.templateId === preset.id ? "secondary" : "outline"}
                    className="h-auto justify-start py-2 text-left whitespace-normal"
                    disabled={pending}
                    onClick={() => onPreset(preset.id)}
                  >
                    {preset.label}
                  </Button>
                ))}
              </div>
            </CardContent>
          </Card>
          <Card size="sm">
            <CardHeader>
              <CardTitle>Follow-up</CardTitle>
              <CardDescription>Edits add nodes and edges on the current diagram.</CardDescription>
            </CardHeader>
            <CardContent>
              <form className="flex flex-col gap-3" onSubmit={onEdit}>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="follow-up">Follow-up edit</Label>
                  <Input
                    id="follow-up"
                    value={edit}
                    onChange={(event) => setEdit(event.target.value)}
                    placeholder="add a Redis cache"
                  />
                </div>
                <Button type="submit" disabled={pending || !diagram}>
                  Apply edit
                </Button>
                <div className="flex flex-wrap gap-2">
                  {EDIT_SUGGESTIONS.map((phrase) => (
                    <Button
                      key={phrase}
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={pending || !diagram}
                      onClick={() => applyPhrase(phrase)}
                    >
                      {phrase}
                    </Button>
                  ))}
                </div>
              </form>
            </CardContent>
          </Card>
          <Card size="sm">
            <CardHeader>
              <CardTitle>Paths</CardTitle>
              <CardDescription>Highlight follows a directed route. Clear it when you are done.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-2">
              {diagram ? (
                diagram.paths.map((path) => (
                  <Button
                    key={path.id}
                    type="button"
                    size="sm"
                    variant={highlight.pathId === path.id ? "default" : "outline"}
                    aria-pressed={highlight.pathId === path.id}
                    className="h-auto justify-start py-1.5 text-left whitespace-normal"
                    onClick={() => onHighlight(path.id)}
                  >
                    Highlight {path.name}
                  </Button>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">Paths show up with the diagram.</p>
              )}
              <Button type="button" size="sm" variant="ghost" disabled={!highlight.pathId} onClick={() => setHighlight(clearHighlight())}>
                Clear highlight
              </Button>
            </CardContent>
          </Card>
          {error ? (
            <div role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              <p>{error}</p>
              {suggestions.length > 0 ? (
                <ul className="mt-2 list-disc pl-4 text-foreground">
                  {suggestions.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              ) : null}
            </div>
          ) : null}
          <div className="flex flex-col gap-1 px-1 text-xs text-muted-foreground">
            <p data-testid="status">{note}</p>
            {usedLlm ? (
              <p data-testid="llm-mode">Server rewrite adjusted the wording.</p>
            ) : note.toLowerCase().includes("off") ? null : (
              <p data-testid="llm-mode">Optional rewrite is off.</p>
            )}
          </div>
        </aside>
        <main className="min-h-[36rem] min-w-0">
          <DiagramCanvas
            diagram={diagram}
            highlight={highlight}
            selectedId={selectedId}
            onSelect={setSelectedId}
            onEscape={() => {
              setSelectedId(null)
              setHighlight(clearHighlight())
            }}
          />
        </main>
      </div>
      <footer className="border-t border-border px-5 py-3 text-xs leading-relaxed text-muted-foreground">
        <p>
          Independent demo. Not affiliated with Archify. Not an official skill or hosted service. Archify is Apache-2.0.
        </p>
        <p className="mt-1">
          <a className="underline underline-offset-2" href="https://github.com/tt-a1i/archify">
            github.com/tt-a1i/archify
          </a>
          {" · "}
          <a className="underline underline-offset-2" href="https://github.com/tt-a1i/archify/blob/main/LICENSE">
            Apache-2.0 license
          </a>
          {" · "}
          <a className="underline underline-offset-2" href="https://archify.si">
            archify.si
          </a>
        </p>
      </footer>
    </div>
  )
}
