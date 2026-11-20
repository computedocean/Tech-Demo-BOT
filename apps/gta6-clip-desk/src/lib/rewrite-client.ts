import {
  buildRewriteRequest,
  type CaptionRewriteBody,
} from '../domain/rewrite-request.ts'

export type ServerRewrite =
  | { enabled: false; message: string }
  | { enabled: true; hook: string; caption: string; hashtags: string[] }

export async function requestServerRewrite(input: CaptionRewriteBody): Promise<ServerRewrite> {
  try {
    const response = await fetch('/api/caption-rewrite', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(buildRewriteRequest(input)),
    })
    const payload = (await response.json()) as {
      enabled?: boolean
      hook?: unknown
      caption?: unknown
      hashtags?: unknown
      error?: string
    }
    if (
      payload.enabled === true &&
      typeof payload.hook === 'string' &&
      typeof payload.caption === 'string' &&
      Array.isArray(payload.hashtags)
    ) {
      return {
        enabled: true,
        hook: payload.hook,
        caption: payload.caption,
        hashtags: payload.hashtags.filter((tag): tag is string => typeof tag === 'string'),
      }
    }
    return {
      enabled: false,
      message: 'Server rewrite is off. Offline templates do not need a key.',
    }
  } catch {
    return {
      enabled: false,
      message: 'Server rewrite is off. Offline templates do not need a key.',
    }
  }
}
