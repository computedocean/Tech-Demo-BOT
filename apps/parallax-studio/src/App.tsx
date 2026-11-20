import { useState } from "react"
import { Badge } from "@/components/ui/badge"
import { CinemaPanel } from "@/components/cinema-panel"
import { GeneratePanel } from "@/components/generate-panel"
import { SiteFooter } from "@/components/site-footer"
import { StagePanel } from "@/components/stage-panel"
import { StandInPanel } from "@/components/stand-in-panel"
import { batchFill, bundledStoryboard, type CinemaBoard } from "@/lib/cinema"
import { generateMock, type GenerateResult } from "@/lib/generate"
import { STUDIO_RUNTIME } from "@/lib/runtime"
import { modelsFor, presetsFor, type StudioKind } from "@/lib/samples"
import {
  initialStandIn,
  proposeNext,
  proposedStep,
  resolveStep,
  type StandInDecision,
  type StandInState,
} from "@/lib/stand-in"

export default function App() {
  const [kind, setKind] = useState<StudioKind>("image")
  const [modelName, setModelName] = useState(modelsFor("image")[0].name)
  const [prompt, setPrompt] = useState(presetsFor("image")[0].prompt)
  const [result, setResult] = useState<GenerateResult | null>(null)
  const [board, setBoard] = useState<CinemaBoard>(() => bundledStoryboard())
  const [standIn, setStandIn] = useState<StandInState>(() => initialStandIn())

  function handleKind(next: StudioKind) {
    setKind(next)
    setModelName(modelsFor(next)[0].name)
    setPrompt(presetsFor(next)[0].prompt)
  }

  function handleDecision(decision: StandInDecision) {
    const step = proposedStep(standIn)
    if (!step) return
    const next = resolveStep(standIn, board, step.id, decision)
    setStandIn(next.state)
    setBoard(next.board)
    if (next.generation) {
      setResult(next.generation)
      setKind(next.generation.asset.kind)
      setModelName(next.generation.modelName)
      setPrompt(next.generation.prompt)
    }
  }

  return (
    <div className="min-h-svh bg-muted/40">
      <header className="border-b bg-background">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 px-6 py-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs tracking-[0.16em] text-muted-foreground uppercase">
              Studio lab
            </p>
            <h1 className="text-2xl font-medium tracking-tight">Parallax studio lab</h1>
            <p className="mt-1 max-w-xl text-sm text-muted-foreground">
              Mock mode is the default. Generate, batch a Cinema shot list, and review a scripted stand-in.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge>{STUDIO_RUNTIME.mode === "mock" ? "Mock mode" : STUDIO_RUNTIME.mode}</Badge>
            <Badge variant="outline">Bundled samples</Badge>
            <Badge variant="secondary">
              {STUDIO_RUNTIME.treg === "off" ? "Treg off" : STUDIO_RUNTIME.treg}
            </Badge>
          </div>
        </div>
      </header>

      <main className="mx-auto flex max-w-6xl flex-col gap-4 px-6 py-6">
        <div className="grid items-start gap-4 lg:grid-cols-[300px_minmax(0,1fr)_320px]">
          <GeneratePanel
            kind={kind}
            modelName={modelName}
            prompt={prompt}
            onKind={handleKind}
            onModel={setModelName}
            onPrompt={setPrompt}
            onGenerate={() => setResult(generateMock({ kind, modelName, prompt }))}
          />
          <StagePanel result={result} />
          <StandInPanel
            state={standIn}
            onPropose={() => setStandIn((current) => proposeNext(current))}
            onAccept={() => handleDecision("accepted")}
            onDismiss={() => handleDecision("dismissed")}
          />
        </div>
        <CinemaPanel board={board} onBatch={() => setBoard((current) => batchFill(current))} />
      </main>
      <SiteFooter />
    </div>
  )
}
