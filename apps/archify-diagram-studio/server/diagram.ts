import { applyEdit } from "../src/lib/edit.ts"
import { generateDiagram, generatePreset } from "../src/lib/generate.ts"
import { isTemplateId, PROMPT_SUGGESTIONS } from "../src/lib/presets.ts"
import type { Diagram, StudioResult } from "../src/lib/types.ts"
import { maybeRewriteDiagram } from "./llm.ts"

function isDiagram(value: unknown): value is Diagram {
  if (!value || typeof value !== "object") return false
  const diagram = value as Diagram
  return (
    typeof diagram.id === "string" &&
    typeof diagram.title === "string" &&
    Array.isArray(diagram.nodes) &&
    Array.isArray(diagram.edges) &&
    Array.isArray(diagram.paths)
  )
}

function publicNote(note: string, usedLlm: boolean): string {
  if (!usedLlm) return note
  const base = note.replace("Offline template. Optional rewrite is off.", "").trim()
  return `${base} Server rewrite adjusted the wording.`.trim()
}

async function withCopy(diagram: Diagram, instruction: string, note: string): Promise<StudioResult> {
  const rewrite = await maybeRewriteDiagram(diagram, instruction)
  return {
    ok: true,
    diagram: rewrite.diagram,
    usedLlm: rewrite.usedLlm,
    note: publicNote(note, rewrite.usedLlm),
  }
}

export async function handleDiagramBody(body: unknown): Promise<StudioResult> {
  if (!body || typeof body !== "object") {
    return { ok: false, error: "Could not read that request.", suggestions: PROMPT_SUGGESTIONS, usedLlm: false }
  }
  const action = (body as { action?: unknown }).action
  if (action === "preset") {
    const presetId = (body as { presetId?: unknown }).presetId
    if (typeof presetId !== "string" || !isTemplateId(presetId)) {
      return {
        ok: false,
        error: "That preset is not available.",
        suggestions: PROMPT_SUGGESTIONS,
        usedLlm: false,
      }
    }
    const diagram = generatePreset(presetId)
    return withCopy(diagram, diagram.title, "Offline template. Optional rewrite is off.")
  }
  if (action === "generate") {
    const prompt = (body as { prompt?: unknown }).prompt
    const result = generateDiagram(typeof prompt === "string" ? prompt : "")
    if (!result.ok) return { ...result, usedLlm: false }
    return withCopy(result.diagram, typeof prompt === "string" ? prompt : result.diagram.title, "Offline template. Optional rewrite is off.")
  }
  if (action === "edit") {
    const edit = (body as { edit?: unknown }).edit
    const diagram = (body as { diagram?: unknown }).diagram
    if (!isDiagram(diagram)) {
      return { ok: false, error: "Generate a diagram before applying an edit.", suggestions: [], usedLlm: false }
    }
    const result = applyEdit(diagram, typeof edit === "string" ? edit : "")
    if (!result.ok) return { ...result, usedLlm: false }
    return withCopy(result.diagram, typeof edit === "string" ? edit : result.note, result.note)
  }
  return { ok: false, error: "Could not read that request.", suggestions: PROMPT_SUGGESTIONS, usedLlm: false }
}
