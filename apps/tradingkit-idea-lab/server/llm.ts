import { findSubsetViolations } from "../src/lib/subset.ts"

export type RewriteResult = {
  pine: string
  usedLlm: boolean
  note: string
}

function stripFence(text: string): string {
  const trimmed = text.trim()
  const fenced = trimmed.match(/^```[a-zA-Z0-9]*\s*([\s\S]*?)\s*```$/)
  return fenced?.[1]?.trim() ?? trimmed
}

export function acceptRewrite(candidate: string, fallback: string): RewriteResult {
  const cleaned = stripFence(candidate)
  if (!cleaned.includes("//@version=6") || !/\bstrategy\s*\(/.test(cleaned)) {
    return {
      pine: fallback,
      usedLlm: false,
      note: "LLM rewrite was not a v6 strategy. Kept the offline template.",
    }
  }
  const violations = findSubsetViolations(cleaned)
  if (violations.length > 0) {
    return {
      pine: fallback,
      usedLlm: false,
      note: "LLM rewrite left the supported subset. Kept the offline template.",
    }
  }
  return {
    pine: cleaned,
    usedLlm: true,
    note: "Server rewrite applied to the script text. The equity curve still uses the offline rules. This is not a TradingKit compile.",
  }
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

export function llmKeyPresent(): boolean {
  return Boolean(process.env.TRADINGKIT_IDEA_LAB_LLM_KEY || process.env.OPENAI_API_KEY)
}

/**
 * Optional rewrite. The key is read only from the server environment.
 * Nothing in the returned object includes the key.
 */
export async function maybeRewritePine(idea: string, pine: string): Promise<RewriteResult> {
  const key = process.env.TRADINGKIT_IDEA_LAB_LLM_KEY || process.env.OPENAI_API_KEY
  if (!key) {
    return {
      pine,
      usedLlm: false,
      note: "Offline template. No server LLM key is set.",
    }
  }
  try {
    const model = process.env.TRADINGKIT_IDEA_LAB_LLM_MODEL || "gpt-4o-mini"
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
              "Edit the Pine Script v6 strategy for clarity. Keep the first line as //@version=6 and keep a strategy() declaration. Do not add request.security, arrays, maps, matrices, strategy.order, or order cancels. Return only the script.",
          },
          { role: "user", content: `Idea: ${idea}\n\n${pine}` },
        ],
      }),
    })
    if (!response.ok) {
      return { pine, usedLlm: false, note: "LLM rewrite unavailable. Kept the offline template." }
    }
    const content = readMessageContent(await response.json())
    if (!content) {
      return { pine, usedLlm: false, note: "LLM rewrite returned nothing usable. Kept the offline template." }
    }
    return acceptRewrite(content, pine)
  } catch {
    return { pine, usedLlm: false, note: "LLM rewrite failed. Kept the offline template." }
  }
}
