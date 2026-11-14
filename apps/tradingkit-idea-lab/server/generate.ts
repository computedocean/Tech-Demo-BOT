import { parseIdea } from "../src/lib/parse-idea.ts"
import { maybeRewritePine } from "./llm.ts"

export async function generateFromIdea(idea: string) {
  const parsed = parseIdea(idea)
  if (!parsed.ok) {
    return {
      ok: false as const,
      error: parsed.error,
      suggestions: parsed.suggestions,
    }
  }
  const rewritten = await maybeRewritePine(idea, parsed.pine)
  return {
    ok: true as const,
    pine: rewritten.pine,
    usedLlm: rewritten.usedLlm,
    note: rewritten.note,
  }
}
