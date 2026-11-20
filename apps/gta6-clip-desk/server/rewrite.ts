export type RewriteEnv = {
  CLIP_DESK_LLM_API_KEY?: string
  CLIP_DESK_LLM_BASE_URL?: string
  CLIP_DESK_LLM_MODEL?: string
}

export type RewriteRequest = {
  title: string
  tags: string[]
  hook: string
  caption: string
  hashtags: string[]
}

export type RewriteResult =
  | { enabled: false; source: 'template'; error?: string }
  | {
      enabled: true
      source: 'server'
      hook: string
      caption: string
      hashtags: string[]
    }

const TEXT_LIMIT = 280

function asRequest(body: unknown): RewriteRequest | null {
  if (!body || typeof body !== 'object') return null
  const record = body as Record<string, unknown>
  if (typeof record.title !== 'string') return null
  if (typeof record.hook !== 'string') return null
  if (typeof record.caption !== 'string') return null
  if (!Array.isArray(record.tags) || !record.tags.every((tag) => typeof tag === 'string')) {
    return null
  }
  if (
    !Array.isArray(record.hashtags) ||
    !record.hashtags.every((tag) => typeof tag === 'string')
  ) {
    return null
  }
  return {
    title: record.title.slice(0, 120),
    hook: record.hook.slice(0, TEXT_LIMIT),
    caption: record.caption.slice(0, 500),
    tags: record.tags.map((tag) => tag.slice(0, 32)).slice(0, 8),
    hashtags: record.hashtags.map((tag) => tag.slice(0, 40)).slice(0, 8),
  }
}

export function isRewriteEnabled(env: RewriteEnv): boolean {
  return Boolean(env.CLIP_DESK_LLM_API_KEY?.trim())
}

export async function rewriteCaption(body: unknown, env: RewriteEnv): Promise<RewriteResult> {
  const parsed = asRequest(body)
  if (!parsed) return { enabled: false, source: 'template', error: 'Invalid request' }
  const key = env.CLIP_DESK_LLM_API_KEY?.trim()
  if (!key) return { enabled: false, source: 'template' }

  const base = (env.CLIP_DESK_LLM_BASE_URL?.trim() || 'https://api.openai.com/v1').replace(
    /\/$/,
    '',
  )
  const model = env.CLIP_DESK_LLM_MODEL?.trim() || 'gpt-4o-mini'
  try {
    const response = await fetch(`${base}/chat/completions`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        model,
        temperature: 0.4,
        messages: [
          {
            role: 'system',
            content:
              'Rewrite a short vertical-video caption pack. Return JSON with keys hook, caption, and hashtags (array of strings). Make no revenue claims and claim no brand affiliation. Keep the caption under 140 characters.',
          },
          { role: 'user', content: JSON.stringify(parsed) },
        ],
      }),
    })
    if (!response.ok) return { enabled: false, source: 'template', error: 'Rewrite unavailable' }
    const payload = (await response.json()) as {
      choices?: { message?: { content?: string } }[]
    }
    const content = payload.choices?.[0]?.message?.content ?? ''
    const jsonStart = content.indexOf('{')
    const jsonEnd = content.lastIndexOf('}')
    if (jsonStart < 0 || jsonEnd < jsonStart) {
      return { enabled: false, source: 'template', error: 'Rewrite unavailable' }
    }
    const rewritten = JSON.parse(content.slice(jsonStart, jsonEnd + 1)) as {
      hook?: unknown
      caption?: unknown
      hashtags?: unknown
    }
    if (
      typeof rewritten.hook !== 'string' ||
      typeof rewritten.caption !== 'string' ||
      !Array.isArray(rewritten.hashtags)
    ) {
      return { enabled: false, source: 'template', error: 'Rewrite unavailable' }
    }
    return {
      enabled: true,
      source: 'server',
      hook: rewritten.hook.slice(0, TEXT_LIMIT),
      caption: rewritten.caption.slice(0, 500),
      hashtags: rewritten.hashtags
        .filter((tag): tag is string => typeof tag === 'string')
        .slice(0, 8),
    }
  } catch {
    return { enabled: false, source: 'template', error: 'Rewrite unavailable' }
  }
}
