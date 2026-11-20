import { batchFill, type CinemaBoard } from "./cinema"
import { generateMock, type GenerateResult } from "./generate"
import { modelsFor, presetsFor, type StudioKind } from "./samples"

export type StandInAction =
  | { type: "generate"; kind: StudioKind; modelName: string; prompt: string }
  | { type: "batch-fill" }

export type StandInStep = {
  id: string
  title: string
  detail: string
  action: StandInAction
}

export const STAND_IN_SCRIPT: StandInStep[] = [
  {
    id: "propose-still",
    title: "Generate a harbor still",
    detail: "Use Sample Still and the bundled harbor file.",
    action: {
      type: "generate",
      kind: "image",
      modelName: modelsFor("image")[0].name,
      prompt: presetsFor("image")[0].prompt,
    },
  },
  {
    id: "propose-reel",
    title: "Cut a two-second reel",
    detail: "Use Sample Reel and the bundled harbor clip.",
    action: {
      type: "generate",
      kind: "video",
      modelName: modelsFor("video")[0].name,
      prompt: presetsFor("video")[0].prompt,
    },
  },
  {
    id: "propose-batch",
    title: "Batch-fill the Cinema storyboard",
    detail: "Fill each waiting shot from the matching bundled sample.",
    action: { type: "batch-fill" },
  },
]

export type StepStatus = "hidden" | "proposed" | "accepted" | "dismissed"

export type StandInDecision = "accepted" | "dismissed"

export type StandInState = {
  statuses: Record<string, StepStatus>
  log: { stepId: string; decision: StandInDecision }[]
  callsModel: false
}

export type TranscriptLine = {
  role: "stand-in" | "user"
  text: string
}

export function initialStandIn(): StandInState {
  return {
    statuses: Object.fromEntries(
      STAND_IN_SCRIPT.map((step) => [step.id, "hidden" as const]),
    ),
    log: [],
    callsModel: false,
  }
}

export function proposedStep(state: StandInState): StandInStep | null {
  return STAND_IN_SCRIPT.find((step) => state.statuses[step.id] === "proposed") ?? null
}

export function proposeNext(state: StandInState): StandInState {
  if (proposedStep(state)) return state
  const next = STAND_IN_SCRIPT.find((step) => state.statuses[step.id] === "hidden")
  if (!next) return state
  return {
    ...state,
    callsModel: false,
    statuses: { ...state.statuses, [next.id]: "proposed" },
  }
}

function decide(
  state: StandInState,
  stepId: string,
  decision: StandInDecision,
): StandInState {
  if (state.statuses[stepId] !== "proposed") return state
  return {
    ...state,
    callsModel: false,
    statuses: { ...state.statuses, [stepId]: decision },
    log: [...state.log, { stepId, decision }],
  }
}

export function acceptStep(state: StandInState, stepId: string): StandInState {
  return decide(state, stepId, "accepted")
}

export function dismissStep(state: StandInState, stepId: string): StandInState {
  return decide(state, stepId, "dismissed")
}

export function applyStandInAction(
  action: StandInAction,
  board: CinemaBoard,
): { board: CinemaBoard; generation: GenerateResult | null } {
  if (action.type === "batch-fill") {
    return { board: batchFill(board), generation: null }
  }
  return {
    board,
    generation: generateMock({
      kind: action.kind,
      modelName: action.modelName,
      prompt: action.prompt,
    }),
  }
}

export function resolveStep(
  state: StandInState,
  board: CinemaBoard,
  stepId: string,
  decision: StandInDecision,
): { state: StandInState; board: CinemaBoard; generation: GenerateResult | null } {
  const step = STAND_IN_SCRIPT.find((item) => item.id === stepId)
  if (!step || state.statuses[stepId] !== "proposed") {
    return { state, board, generation: null }
  }
  if (decision === "dismissed") {
    return { state: dismissStep(state, stepId), board, generation: null }
  }
  const applied = applyStandInAction(step.action, board)
  return {
    state: acceptStep(state, stepId),
    board: applied.board,
    generation: applied.generation,
  }
}

export function transcript(state: StandInState): TranscriptLine[] {
  const lines: TranscriptLine[] = [
    {
      role: "stand-in",
      text: "Scripted stand-in. I propose steps from a fixed list inside this lab.",
    },
  ]
  for (const step of STAND_IN_SCRIPT) {
    const status = state.statuses[step.id]
    if (status === "hidden" || status == null) continue
    lines.push({
      role: "stand-in",
      text: `Proposed: ${step.title}. ${step.detail}`,
    })
    if (status === "accepted") {
      lines.push({ role: "user", text: `Accepted “${step.title}”.` })
    }
    if (status === "dismissed") {
      lines.push({ role: "user", text: `Dismissed “${step.title}”.` })
    }
  }
  return lines
}

export function scriptComplete(state: StandInState): boolean {
  return STAND_IN_SCRIPT.every((step) => {
    const status = state.statuses[step.id]
    return status === "accepted" || status === "dismissed"
  })
}
