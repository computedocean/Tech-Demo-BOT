import { mockVerdict } from "../lib/verdict.ts"
import type { Packet, Verdict } from "../lib/types.ts"

/** Server-only. Never read this from client code or a VITE_ variable. */
export const LLM_ENV_NAME = "AGENT_LENS_LLM_KEY"

type Env = Record<string, string | undefined>

export function llmEnabled(env: Env = process.env): boolean {
  const value = env[LLM_ENV_NAME]
  return typeof value === "string" && value.trim().length > 0
}

export function publicLlmStatus(env: Env = process.env): { enabled: boolean } {
  return { enabled: llmEnabled(env) }
}

export type VerdictResponse = {
  verdict: Verdict
  llm: boolean
  note: string
}

/**
 * Mock rules are the default. A server key may rewrite the failure-risk sentence only.
 * The key is never copied into the returned object.
 */
export async function resolveVerdict(
  packet: Packet,
  env: Env = process.env,
  fetcher: typeof fetch = fetch,
): Promise<VerdictResponse> {
  const mock = mockVerdict(packet)
  const key = env[LLM_ENV_NAME]?.trim()
  if (!key) {
    return { verdict: mock, llm: false, note: "Mock rules. No server LLM key is set." }
  }
  try {
    const failureRisk = await rewriteFailureRisk(packet, mock, key, env, fetcher)
    if (!failureRisk || failureRisk.includes(key)) {
      return { verdict: mock, llm: false, note: "Server rewrite was discarded. Kept the mock verdict." }
    }
    return {
      verdict: { ...mock, failureRisk },
      llm: true,
      note: "Server rewrite replaced the failure-risk note only. Prices stayed on the mock rules.",
    }
  } catch {
    return { verdict: mock, llm: false, note: "Server rewrite failed. Kept the mock verdict." }
  }
}

async function rewriteFailureRisk(
  packet: Packet,
  mock: Verdict,
  key: string,
  env: Env,
  fetcher: typeof fetch,
): Promise<string | null> {
  const model = env.AGENT_LENS_LLM_MODEL?.trim() || "gpt-4o-mini"
  const response = await fetcher("https://api.openai.com/v1/chat/completions", {
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
            "You rewrite one failure-risk sentence for a paper-research desk. Reply with JSON {\"failureRisk\":\"...\"} only. Do not change the decision or any price. Do not give financial advice. Do not repeat secrets.",
        },
        {
          role: "user",
          content: JSON.stringify({
            decision: mock.decision,
            failureRisk: mock.failureRisk,
            regime: packet.regime,
            scores: packet.scores,
          }),
        },
      ],
    }),
  })
  if (!response.ok) return null
  const data: unknown = await response.json()
  const text = readMessage(data)
  if (!text) return null
  const cleaned = text.trim().replace(/^```json\s*|```$/g, "")
  const parsed: unknown = JSON.parse(cleaned)
  if (!parsed || typeof parsed !== "object") return null
  const failureRisk = (parsed as { failureRisk?: unknown }).failureRisk
  if (typeof failureRisk !== "string") return null
  const note = failureRisk.trim()
  if (note.length < 12 || note.length > 500) return null
  return note
}

function readMessage(data: unknown): string | null {
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
