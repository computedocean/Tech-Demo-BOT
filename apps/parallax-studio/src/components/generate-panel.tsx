import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import {
  isStudioKind,
  modelsFor,
  presetsFor,
  type StudioKind,
} from "@/lib/samples"

const KINDS: { id: StudioKind; label: string }[] = [
  { id: "image", label: "Image" },
  { id: "video", label: "Video" },
  { id: "audio", label: "Audio" },
]

export function GeneratePanel({
  kind,
  modelName,
  prompt,
  onKind,
  onModel,
  onPrompt,
  onGenerate,
}: {
  kind: StudioKind
  modelName: string
  prompt: string
  onKind: (kind: StudioKind) => void
  onModel: (modelName: string) => void
  onPrompt: (prompt: string) => void
  onGenerate: () => void
}) {
  const models = modelsFor(kind)
  const presets = presetsFor(kind)

  return (
    <Card>
      <CardHeader>
        <CardTitle>Generate</CardTitle>
        <CardDescription>
          Pick a studio, a mock model, and a prompt. The result is a bundled sample.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <Tabs
          value={kind}
          onValueChange={(value) => {
            if (typeof value === "string" && isStudioKind(value)) onKind(value)
          }}
        >
          <TabsList className="w-full">
            {KINDS.map((item) => (
              <TabsTrigger key={item.id} value={item.id} className="flex-1">
                {item.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium" htmlFor="mock-model">
            Mock model
          </label>
          <Select
            value={modelName}
            items={models.map((model) => ({ value: model.name, label: model.name }))}
            onValueChange={(value) => {
              if (typeof value === "string") onModel(value)
            }}
          >
            <SelectTrigger id="mock-model" className="w-full" aria-label="Mock model">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {models.map((model) => (
                <SelectItem key={model.id} value={model.name}>
                  {model.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium" htmlFor="prompt">
            Prompt
          </label>
          <Textarea
            id="prompt"
            value={prompt}
            onChange={(event) => onPrompt(event.target.value)}
            rows={3}
          />
          <div className="flex flex-wrap gap-2">
            {presets.map((preset) => {
              const active = prompt === preset.prompt
              return (
                <Button
                  key={preset.id}
                  type="button"
                  size="sm"
                  variant={active ? "secondary" : "outline"}
                  aria-pressed={active}
                  onClick={() => onPrompt(preset.prompt)}
                >
                  {preset.label}
                </Button>
              )
            })}
          </div>
        </div>

        <div className="flex items-center justify-between gap-3">
          <Badge variant="outline">Mock mode</Badge>
          <Button type="button" data-testid="generate" onClick={onGenerate}>
            Generate
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
