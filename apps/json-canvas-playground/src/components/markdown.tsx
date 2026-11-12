import type { ReactNode } from 'react'

const INLINE =
  /(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`|\[[^\]]+\]\([^)\s]+\))/g

function inline(text: string): ReactNode[] {
  const nodes: React.ReactNode[] = []
  let last = 0
  for (const match of text.matchAll(INLINE)) {
    const index = match.index ?? 0
    if (index > last) nodes.push(text.slice(last, index))
    const token = match[0]
    if (token.startsWith('**')) {
      nodes.push(<strong key={index}>{token.slice(2, -2)}</strong>)
    } else if (token.startsWith('`')) {
      nodes.push(
        <code key={index} className="rounded bg-muted px-1 py-0.5 font-mono text-[0.92em]">
          {token.slice(1, -1)}
        </code>,
      )
    } else if (token.startsWith('[')) {
      const label = token.slice(1, token.indexOf(']'))
      const url = token.slice(token.indexOf('(') + 1, -1)
      nodes.push(
        <span key={index} title={url} className="underline decoration-dotted underline-offset-2">
          {label}
        </span>,
      )
    } else {
      nodes.push(<em key={index}>{token.slice(1, -1)}</em>)
    }
    last = index + token.length
  }
  if (last < text.length) nodes.push(text.slice(last))
  return nodes
}

export function MarkdownText({ text }: { text: string }) {
  return (
    <div className="space-y-1 text-sm leading-snug">
      {text.split('\n').map((line, index) => {
        if (line.trim() === '') return <div key={index} className="h-1" />
        const heading = /^(#{1,3})\s+(.*)$/.exec(line)
        if (heading) {
          const level = heading[1]?.length ?? 1
          return (
            <div key={index} className={level === 1 ? 'text-base font-semibold' : 'text-sm font-semibold'}>
              {inline(heading[2] ?? '')}
            </div>
          )
        }
        const item = /^[-*]\s+(.*)$/.exec(line)
        if (item) {
          return (
            <div key={index} className="flex gap-1.5">
              <span aria-hidden="true" className="text-muted-foreground">
                ·
              </span>
              <span>{inline(item[1] ?? '')}</span>
            </div>
          )
        }
        return <p key={index}>{inline(line)}</p>
      })}
    </div>
  )
}
