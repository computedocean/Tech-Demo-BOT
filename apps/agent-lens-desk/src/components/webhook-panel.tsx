import { useState } from "react"
import { Badge } from "@/components/ui/badge.tsx"
import { Button } from "@/components/ui/button.tsx"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card.tsx"
import { ScrollArea } from "@/components/ui/scroll-area.tsx"

type Inbox = {
  ok: boolean
  message: string
  packet?: unknown
}

export function WebhookPanel() {
  const [body, setBody] = useState("")
  const [inbox, setInbox] = useState<Inbox | null>(null)
  const [busy, setBusy] = useState(false)

  async function post(path: string, raw: string) {
    setBusy(true)
    try {
      const response = await fetch(path, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: raw,
      })
      const payload = (await response.json()) as Inbox
      setInbox(payload)
    } catch {
      setInbox({ ok: false, message: "The local webhook did not respond. The chart desk still runs without it." })
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-2">
          <CardTitle>Local webhook</CardTitle>
          <Badge variant="outline">POST /webhook</Badge>
        </div>
        <p className="text-xs text-muted-foreground">
          Accepts a TradingView-style JSON body with schema ai-agent-lens/v1. The desk is complete if nothing is posted.
          Wrong schemas are rejected. No broker is called.
        </p>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="flex flex-wrap gap-2">
          <Button type="button" size="sm" disabled={busy} onClick={() => void post("/webhook/replay", "{}")}>
            Replay bundled sample
          </Button>
          <Button type="button" size="sm" variant="outline" disabled={busy || body.trim() === ""} onClick={() => void post("/webhook", body)}>
            Post JSON
          </Button>
        </div>
        <textarea
          value={body}
          onChange={(event) => setBody(event.target.value)}
          spellCheck={false}
          aria-label="Webhook JSON body"
          placeholder='{"schema":"ai-agent-lens/v1", ...}'
          className="min-h-24 w-full rounded-lg border bg-background px-3 py-2 font-mono text-xs outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
        />
        {inbox ? (
          <div className="flex flex-col gap-2">
            <p className={inbox.ok ? "text-sm" : "text-sm text-destructive"} data-testid="webhook-message">
              {inbox.message}
            </p>
            {inbox.packet ? (
              <ScrollArea className="h-36 rounded-lg border bg-muted/40">
                <pre className="p-3 font-mono text-[11px] leading-relaxed" data-testid="webhook-packet">
                  {JSON.stringify(inbox.packet, null, 2)}
                </pre>
              </ScrollArea>
            ) : null}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">Inbox is empty. Replay uses the upstream MIT sample packet.</p>
        )}
      </CardContent>
    </Card>
  )
}
