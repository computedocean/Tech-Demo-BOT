import { Badge } from "@/components/ui/badge.tsx"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card.tsx"
import { ScrollArea } from "@/components/ui/scroll-area.tsx"
import type { Packet } from "@/lib/types.ts"

type PacketPanelProps = {
  packet: Packet
  disclosures: string[]
}

export function PacketPanel({ packet, disclosures }: PacketPanelProps) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-2">
          <CardTitle>Closed-candle packet</CardTitle>
          <Badge variant="secondary" data-testid="packet-schema">
            {packet.schema}
          </Badge>
        </div>
        <p className="text-xs text-muted-foreground">{packet.state_code}</p>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <ScrollArea className="h-[280px] rounded-lg border bg-muted/40">
          <pre className="p-3 font-mono text-[11px] leading-relaxed" data-testid="packet-json">
            {JSON.stringify(packet, null, 2)}
          </pre>
        </ScrollArea>
        <ul className="flex flex-col gap-1 text-[11px] leading-snug text-muted-foreground">
          {disclosures.map((note) => (
            <li key={note}>{note}</li>
          ))}
        </ul>
      </CardContent>
    </Card>
  )
}
