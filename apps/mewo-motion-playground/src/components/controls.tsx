import type { ReactNode } from "react"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Slider } from "@/components/ui/slider"
import { Switch } from "@/components/ui/switch"

export function DemoSection({
  id,
  index,
  title,
  command,
  summary,
  stage,
  controls,
}: {
  id: string
  index: string
  title: string
  command: string
  summary: string
  stage: ReactNode
  controls: ReactNode
}) {
  return (
    <section id={id} className="scroll-mt-8 border-t border-border py-12">
      <div className="mb-6 flex flex-col gap-2">
        <p className="font-mono text-xs text-muted-foreground">{index}</p>
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <h2 className="text-2xl font-medium tracking-tight">{title}</h2>
          <code className="font-mono text-xs text-muted-foreground">{command}</code>
        </div>
        <p className="max-w-2xl text-sm text-muted-foreground">{summary}</p>
      </div>
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_17.5rem]">
        <div className="min-w-0">{stage}</div>
        <div className="grid gap-4 rounded-xl bg-card p-4 text-card-foreground ring-1 ring-foreground/10">
          <p className="text-xs font-medium text-muted-foreground">Props</p>
          {controls}
        </div>
      </div>
    </section>
  )
}

export function NumberSlider({
  id,
  label,
  value,
  min,
  max,
  step,
  onChange,
  format,
}: {
  id: string
  label: string
  value: number
  min: number
  max: number
  step: number
  onChange: (value: number) => void
  format?: (value: number) => string
}) {
  const text = (format ?? ((next: number) => next.toFixed(2)))(value)
  return (
    <div className="grid gap-2">
      <div className="flex items-baseline justify-between gap-3">
        <Label htmlFor={id}>{label}</Label>
        <span className="font-mono text-xs text-muted-foreground">{text}</span>
      </div>
      <Slider
        id={id}
        min={min}
        max={max}
        step={step}
        value={[value]}
        onValueChange={(next) => {
          const resolved = Array.isArray(next) ? next[0] : next
          if (typeof resolved === "number") onChange(resolved)
        }}
      />
    </div>
  )
}

export function Choice<T extends string>({
  label,
  value,
  onChange,
  options,
}: {
  label: string
  value: T
  onChange: (value: T) => void
  options: { value: T; label: string }[]
}) {
  return (
    <div className="grid gap-2">
      <Label>{label}</Label>
      <Select
        value={value}
        onValueChange={(next) => {
          if (typeof next !== "string") return
          const match = options.find((option) => option.value === next)
          if (match) onChange(match.value)
        }}
      >
        <SelectTrigger className="w-full">
          <SelectValue>
            {(current: string | null) =>
              options.find((option) => option.value === current)?.label ?? current
            }
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}

export function ToggleField({
  id,
  label,
  checked,
  onCheckedChange,
}: {
  id: string
  label: string
  checked: boolean
  onCheckedChange: (checked: boolean) => void
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <Label htmlFor={id}>{label}</Label>
      <Switch id={id} checked={checked} onCheckedChange={onCheckedChange} />
    </div>
  )
}
