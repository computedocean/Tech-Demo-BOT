import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { assetForShot, type CinemaBoard } from "@/lib/cinema"
import { MOCK_BADGE } from "@/lib/samples"
import { MediaPreview } from "@/components/media-preview"

export function CinemaPanel({
  board,
  onBatch,
}: {
  board: CinemaBoard
  onBatch: () => void
}) {
  const filled = board.shots.filter((shot) => shot.status === "filled").length

  return (
    <Card data-testid="cinema">
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div className="flex flex-col gap-1">
            <CardTitle>Cinema</CardTitle>
            <CardDescription>
              {board.title} · {filled} of {board.shots.length} shots filled
            </CardDescription>
          </div>
          <Button type="button" size="sm" data-testid="batch-render" onClick={onBatch}>
            Batch render
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <ol className="grid gap-3 lg:grid-cols-3" data-testid="shot-list">
          {board.shots.map((shot) => {
            const asset = assetForShot(shot)
            return (
              <li
                key={shot.id}
                className="rounded-lg border p-3"
                data-shot-status={shot.status}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-xs text-muted-foreground">
                      {shot.index.toString().padStart(2, "0")}
                    </p>
                    <p className="truncate text-sm font-medium">{shot.title}</p>
                  </div>
                  <Badge variant={shot.status === "filled" ? "default" : "outline"}>
                    {shot.status === "filled" ? "Filled" : "Waiting"}
                  </Badge>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {shot.kind} · {shot.prompt}
                </p>
                {asset ? (
                  <div className="mt-2 overflow-hidden rounded-md bg-black ring-1 ring-foreground/10">
                    <MediaPreview asset={asset} compact />
                    <p className="bg-background px-2 py-1 text-xs">{MOCK_BADGE}</p>
                  </div>
                ) : null}
              </li>
            )
          })}
        </ol>
      </CardContent>
    </Card>
  )
}
