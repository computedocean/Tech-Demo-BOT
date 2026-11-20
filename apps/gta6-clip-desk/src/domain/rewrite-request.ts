export type CaptionRewriteBody = {
  title: string
  tags: string[]
  hook: string
  caption: string
  hashtags: string[]
}

export function buildRewriteRequest(input: CaptionRewriteBody): CaptionRewriteBody {
  return {
    title: input.title,
    tags: [...input.tags],
    hook: input.hook,
    caption: input.caption,
    hashtags: [...input.hashtags],
  }
}
