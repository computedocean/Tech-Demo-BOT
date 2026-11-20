import { createPresetDiagram, isTemplateId, PRESETS, PROMPT_SUGGESTIONS } from "./presets.ts"
import type { Diagram, Failure, GenerateResult, TemplateId } from "./types.ts"

export function normalizeText(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ")
}

function unrecognized(error: string): Failure {
  return { ok: false, error, suggestions: PROMPT_SUGGESTIONS }
}

function matchesEvent(text: string): boolean {
  return /\bevent driven\b/.test(text) || /\bevent bus\b/.test(text) || /\border placed\b/.test(text)
}

function matchesQueue(text: string): boolean {
  return /\bqueue\b/.test(text) || /\bworker\b/.test(text) || /\bjob pipeline\b/.test(text)
}

function matchesAuth(text: string): boolean {
  return (
    /\bauth\b/.test(text) ||
    /\bauthentication\b/.test(text) ||
    /\blogin\b/.test(text) ||
    /\bsign in\b/.test(text) ||
    /\bgated\b/.test(text)
  )
}

function matchesWeb(text: string): boolean {
  if (/\bweb app\b/.test(text) || /\bweb application\b/.test(text) || /\btodo\b/.test(text) || /\bcrud\b/.test(text)) {
    return true
  }
  const hasApi = /\bapi\b/.test(text)
  const hasDatabase = /\bdatabase\b/.test(text) || /\bpostgres\b/.test(text) || /\bsql\b/.test(text)
  return hasApi && hasDatabase
}

export function matchTemplate(input: string): TemplateId | null {
  const text = normalizeText(input)
  if (!text) return null
  const exact = PRESETS.find((preset) => normalizeText(preset.label) === text)
  if (exact) return exact.id
  if (matchesEvent(text)) return "event"
  if (matchesQueue(text)) return "queue"
  if (matchesAuth(text)) return "auth"
  if (matchesWeb(text)) return "web"
  return null
}

export function generatePreset(id: TemplateId): Diagram {
  return createPresetDiagram(id)
}

export function generateDiagram(input: string): GenerateResult {
  const text = normalizeText(input)
  if (!text) {
    return unrecognized("Enter a system description, or pick a preset.")
  }
  const templateId = matchTemplate(input)
  if (!templateId || !isTemplateId(templateId)) {
    return unrecognized(
      "This studio does not recognize that description. Pick a preset or mention a web app with an API and a database, a queue and worker pipeline, an auth-gated service, or an event-driven flow.",
    )
  }
  return { ok: true, diagram: createPresetDiagram(templateId) }
}
