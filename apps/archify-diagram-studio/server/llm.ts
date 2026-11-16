import type { Diagram } from "../src/lib/types.ts"

export type RewriteOutcome = {
  diagram: Diagram
  usedLlm: boolean
  note: string
}

type RewritePayload = {
  summary?: unknown
  nodes?: unknown
}

function keyFromEnv(): string | undefined {
  const named = process.env.ARCHIFY_DIAGRAM_LLM_KEY
  const openai = process.env.OPENAI_API_KEY
  const value = named || openai
  return value && value.trim() ? value.trim() : undefined
}

export function llmKeyPresent(): boolean {
  return Boolean(keyFromEnv())
}

function stripFence(text: string): string {
  const trimmed = text.trim()
  const fenced = trimmed.match(/^```[a-zA-Z0-9]*\s*([\s\S]*?)\s*```$/)
  return fenced?.[1]?.trim() ?? trimmed
}

function readMessageContent(data: unknown): string | null {
  if (!data || typeof data !== "object") return null
  const choices = (data as { choices?: unknown }).choices
  if (!Array.isArray(choices)) return null
  const first = choices[0]
  if (!first || typeof first !== "object") return null
  const message = (first as { message?: unknown }).message
  if (!message || typeof message !== "object") return null
  const content = (message as { content?: unknown }).content
  return typeof content === "string" ? content : null
}

export function acceptRewrite(diagram: Diagram, raw: string): RewriteOutcome {
  let payload: RewritePayload
  try {
    payload = JSON.parse(stripFence(raw)) as RewritePayload
  } catch {
    return { diagram, usedLlm: false, note: "Rewrite was not usable. Kept the offline template." }
  }
  if (typeof payload.summary !== "string" || !payload.summary.trim() || !Array.isArray(payload.nodes)) {
    return { diagram, usedLlm: false, note: "Rewrite was not usable. Kept the offline template." }
  }
  const details = new Map<string, string>()
  for (const item of payload.nodes) {
    if (!item || typeof item !== "object") {
      return { diagram, usedLlm: false, note: "Rewrite was not usable. Kept the offline template." }
    }
    const id = (item as { id?: unknown }).id
    const detail = (item as { detail?: unknown }).detail
    if (typeof id !== "string" || typeof detail !== "string" || !detail.trim()) {
      return { diagram, usedLlm: false, note: "Rewrite was not usable. Kept the offline template." }
    }
    details.set(id, detail.trim())
  }
  const known = new Set(diagram.nodes.map((node) => node.id))
  for (const id of details.keys()) {
    if (!known.has(id)) {
      return { diagram, usedLlm: false, note: "Rewrite was not usable. Kept the offline template." }
    }
  }
  if (details.size !== diagram.nodes.length) {
    return { diagram, usedLlm: false, note: "Rewrite was not usable. Kept the offline template." }
  }
  return {
    usedLlm: true,
    note: "Server rewrite adjusted the wording. The graph is still the offline template.",
    diagram: {
      ...diagram,
      summary: payload.summary.trim(),
      nodes: diagram.nodes.map((node) => ({ ...node, detail: details.get(node.id) ?? node.detail })),
    },
  }
}

/**
 * Optional wording rewrite. The key is read only here, on the server.
 * Returned objects never include the key.
 */
export async function maybeRewriteDiagram(diagram: Diagram, instruction: string): Promise<RewriteOutcome> {
  const key = keyFromEnv()
  if (!key) {
    return { diagram, usedLlm: false, note: "Offline template. Optional rewrite is off." }
  }
  try {
    const model = process.env.ARCHIFY_DIAGRAM_LLM_MODEL || "gpt-4o-mini"
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        model,
        temperature: 0,
        messages: [
          {
            role: "system",
            content:
              "Rewrite only the summary and each node detail. Keep every id. Return JSON {\"summary\":string,\"nodes\":[{\"id\":string,\"detail\":string}]} and nothing else.",
          },
          {
            role: "user",
            content: JSON.stringify({
              instruction,
              summary: diagram.summary,
              nodes: diagram.nodes.map((node) => ({ id: node.id, name: node.name, detail: node.detail })),
            }),
          },
        ],
      }),
      signal: AbortSignal.timeout(8000),
    })
    if (!response.ok) {
      return { diagram, usedLlm: false, note: "Rewrite unavailable. Kept the offline template." }
    }
    const content = readMessageContent(await response.json())
    if (!content) {
      return { diagram, usedLlm: false, note: "Rewrite returned nothing usable. Kept the offline template." }
    }
    return acceptRewrite(diagram, content)
  } catch {
    return { diagram, usedLlm: false, note: "Rewrite failed. Kept the offline template." }
  }
}
