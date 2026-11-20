import { applyEdit } from "./edit.ts"
import { generateDiagram, generatePreset } from "./generate.ts"
import { isTemplateId } from "./presets.ts"
import type { Diagram, StudioResult, TemplateId } from "./types.ts"

export const TEMPLATE_NOTE = "Offline template. Optional rewrite is off."

export type StudioRequest =
  | { action: "generate"; prompt: string }
  | { action: "preset"; presetId: TemplateId }
  | { action: "edit"; edit: string; diagram: Diagram }

export function runLocal(request: StudioRequest): StudioResult {
  if (request.action === "preset") {
    return {
      ok: true,
      diagram: generatePreset(request.presetId),
      usedLlm: false,
      note: TEMPLATE_NOTE,
    }
  }
  if (request.action === "generate") {
    const result = generateDiagram(request.prompt)
    if (!result.ok) return { ...result, usedLlm: false }
    return { ok: true, diagram: result.diagram, usedLlm: false, note: TEMPLATE_NOTE }
  }
  const result = applyEdit(request.diagram, request.edit)
  if (!result.ok) return { ...result, usedLlm: false }
  return { ok: true, diagram: result.diagram, usedLlm: false, note: result.note }
}

export async function requestStudio(request: StudioRequest): Promise<StudioResult> {
  try {
    const response = await fetch("/api/diagram", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(request),
    })
    const data = (await response.json()) as StudioResult
    if (!data || typeof data !== "object" || typeof data.ok !== "boolean") return runLocal(request)
    return data
  } catch {
    return runLocal(request)
  }
}

export function presetRequest(presetId: string): StudioRequest | null {
  if (!isTemplateId(presetId)) return null
  return { action: "preset", presetId }
}
