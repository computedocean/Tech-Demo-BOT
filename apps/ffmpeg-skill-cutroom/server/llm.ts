export type LlmEnv = {
  CUTROOM_LLM_API_KEY?: string
  CUTROOM_LLM_BASE_URL?: string
  CUTROOM_LLM_MODEL?: string
}

export type LlmStatus = {
  enabled: boolean
  model: string | null
}

/** Optional rewrite. Off unless a server-only key, base URL, and model are all set. */
export function llmConfig(env: LlmEnv = process.env): LlmStatus {
  const apiKey = env.CUTROOM_LLM_API_KEY?.trim() ?? ''
  const baseUrl = env.CUTROOM_LLM_BASE_URL?.trim() ?? ''
  const model = env.CUTROOM_LLM_MODEL?.trim() ?? ''
  const enabled = apiKey.length > 0 && baseUrl.length > 0 && model.length > 0
  return { enabled, model: enabled ? model : null }
}

export type RewriteResult = {
  enabled: boolean
  message: string
}

export async function rewritePlan(prompt: string, env: LlmEnv = process.env): Promise<RewriteResult> {
  const status = llmConfig(env)
  if (!status.enabled) {
    return {
      enabled: false,
      message: 'Optional LLM rewrite is off. The deterministic plan is unchanged.',
    }
  }
  const base = env.CUTROOM_LLM_BASE_URL?.trim() ?? ''
  const key = env.CUTROOM_LLM_API_KEY?.trim() ?? ''
  const model = status.model ?? ''
  const response = await fetch(`${base.replace(/\/$/, '')}/chat/completions`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        {
          role: 'user',
          content: `Rewrite this edit request as one short sentence. Do not add tools or flags.\n\n${prompt}`,
        },
      ],
    }),
  })
  if (!response.ok) {
    return { enabled: true, message: 'The LLM rewrite failed. The deterministic plan is unchanged.' }
  }
  return {
    enabled: true,
    message: 'The server rewrote the wording. Review the step list before running it.',
  }
}
