import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { DISCLOSURE } from "@/lib/samples"
import type { GenerateResult } from "@/lib/generate"
import { MediaPreview } from "@/components/media-preview"

export function StagePanel({ result }: { result: GenerateResult | null }) {
  return (
    <Card data-testid="stage">
      <CardHeader>
        <CardTitle>Latest take</CardTitle>
        <CardDescription>
          {DISCLOSURE}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {result == null ? (
          <div className="flex aspect-video items-center justify-center rounded-lg border border-dashed px-6 text-center text-sm text-muted-foreground">
            Run Generate. Image, video, and audio each return a bundled sample file.
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <div className="overflow-hidden rounded-lg bg-black ring-1 ring-foreground/10">
              <MediaPreview asset={result.asset} />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge data-testid="sample-badge">{result.badge}</Badge>
              <Badge variant="outline">{result.mode}</Badge>
              <Badge variant="secondary">{result.asset.kind}</Badge>
            </div>
            <dl className="grid gap-2 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Model</dt>
                <dd>{result.modelName}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">File</dt>
                <dd>{result.asset.title}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Prompt</dt>
                <dd className="mt-1">{result.prompt}</dd>
              </div>
            </dl>
            <p className="text-xs text-muted-foreground">
              {result.asset.license} · {result.asset.source}{" "}
              <a className="underline underline-offset-2" href="/samples/SOURCE.md">
                Source and license
              </a>
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
