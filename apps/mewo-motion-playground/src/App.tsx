import { useEffect, useState } from "react"
import { Moon, Sun } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Grainient, type GrainientType } from "@/components/ui/grainient"
import { ScrollMask, type ScrollMaskVariant } from "@/components/ui/scroll-mask"
import { SplitText } from "@/components/ui/split-text"
import { SpotlightCard } from "@/components/ui/spotlight-card"
import { TextShimmer } from "@/components/ui/text-shimmer"
import { Choice, DemoSection, NumberSlider, ToggleField } from "@/components/controls"

const SHIMMER_SIZES = [
  { value: "text-3xl", label: "Small" },
  { value: "text-5xl", label: "Medium" },
  { value: "text-7xl", label: "Large" },
] as const

const SPOTLIGHT_RADII = [
  { value: "rounded-md", label: "Tight" },
  { value: "rounded-xl", label: "Round" },
  { value: "rounded-3xl", label: "Soft" },
] as const

const SPLIT_MODES = [
  { value: "chars", label: "Characters" },
  { value: "words", label: "Words" },
] as const

const GRAIN_TYPES = [
  { value: "linear", label: "Linear" },
  { value: "radial", label: "Radial" },
] as const

const MASK_VARIANTS = [
  { value: "iris", label: "Iris" },
  { value: "wipe", label: "Wipe" },
  { value: "curtain", label: "Curtain" },
  { value: "slats", label: "Slats" },
  { value: "grid", label: "Grid" },
  { value: "type", label: "Type" },
] as const

type Theme = "dark" | "light"
type ShimmerSize = (typeof SHIMMER_SIZES)[number]["value"]
type SpotlightRadius = (typeof SPOTLIGHT_RADII)[number]["value"]
type SplitBy = (typeof SPLIT_MODES)[number]["value"]

function hexToRgb(hex: string): [number, number, number] {
  const normalized = hex.replace("#", "")
  const full =
    normalized.length === 3
      ? normalized
          .split("")
          .map((channel) => channel + channel)
          .join("")
      : normalized
  const value = Number.parseInt(full, 16)
  if (Number.isNaN(value)) return [99, 102, 241]
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255]
}

export default function App() {
  const [theme, setTheme] = useState<Theme>("dark")

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark")
  }, [theme])

  return (
    <div className="min-h-svh bg-background text-foreground">
      <header className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-6 pt-10 pb-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-2xl">
            <p className="font-mono text-xs text-muted-foreground">mewo registry</p>
            <h1 className="mt-2 text-4xl font-medium tracking-tight">Motion playground</h1>
            <p className="mt-3 text-sm text-muted-foreground">
              Five installed components on one page. Move a control and the stage answers.
              Pieces stay readable when the system asks for reduced motion.
            </p>
          </div>
          <Button
            variant="outline"
            onClick={() => setTheme((current) => (current === "dark" ? "light" : "dark"))}
          >
            {theme === "dark" ? <Sun /> : <Moon />}
            {theme === "dark" ? "Light" : "Dark"}
          </Button>
        </div>
        <nav className="flex flex-wrap gap-2" aria-label="Demos">
          {[
            ["#text-shimmer", "Text Shimmer"],
            ["#spotlight-card", "Spotlight Card"],
            ["#split-text", "Split Text"],
            ["#grainient", "Grainient"],
            ["#scroll-mask", "Scroll Mask"],
          ].map(([href, label]) => (
            <a
              key={href}
              href={href}
              className="rounded-lg bg-muted px-2.5 py-1 text-sm text-foreground hover:bg-accent"
            >
              {label}
            </a>
          ))}
        </nav>
      </header>
      <main className="mx-auto w-full max-w-6xl px-6 pb-24">
        <TextShimmerDemo />
        <SpotlightDemo />
        <SplitTextDemo />
        <GrainientDemo lightMode={theme === "light"} />
        <ScrollMaskDemo />
      </main>
    </div>
  )
}

function TextShimmerDemo() {
  const [text, setText] = useState("Light sweeps the line")
  const [duration, setDuration] = useState(2)
  const [size, setSize] = useState<ShimmerSize>("text-5xl")

  return (
    <DemoSection
      id="text-shimmer"
      index="01"
      title="Text Shimmer"
      command="@mewo/text-shimmer"
      summary="A CSS light pass across the letters. No animation library."
      stage={
        <div className="flex min-h-56 items-center rounded-xl bg-muted/40 px-8 py-10 ring-1 ring-foreground/10">
          <TextShimmer duration={duration} className={`${size} font-medium tracking-tight`}>
            {text.trim() || " "}
          </TextShimmer>
        </div>
      }
      controls={
        <>
          <div className="grid gap-2">
            <Label htmlFor="shimmer-text">Text</Label>
            <Input
              id="shimmer-text"
              value={text}
              onChange={(event) => setText(event.target.value)}
            />
          </div>
          <NumberSlider
            id="shimmer-duration"
            label="Duration"
            value={duration}
            min={0.4}
            max={6}
            step={0.1}
            format={(value) => `${value.toFixed(1)}s`}
            onChange={setDuration}
          />
          <Choice
            label="Size"
            value={size}
            onChange={setSize}
            options={SHIMMER_SIZES.map((option) => ({ ...option }))}
          />
        </>
      }
    />
  )
}

function SpotlightDemo() {
  const [color, setColor] = useState("#6366f1")
  const [strength, setStrength] = useState(0.55)
  const [radius, setRadius] = useState<SpotlightRadius>("rounded-xl")
  const [red, green, blue] = hexToRgb(color)
  const spotlightColor = `rgb(${red} ${green} ${blue} / ${strength})`

  return (
    <DemoSection
      id="spotlight-card"
      index="02"
      title="Spotlight Card"
      command="@mewo/spotlight-card"
      summary="A radial glow that follows the pointer and fades when it leaves."
      stage={
        <SpotlightCard spotlightColor={spotlightColor} className={`min-h-64 ${radius}`}>
          <p className="text-xs text-muted-foreground">Hover the card</p>
          <h3 className="mt-3 text-3xl font-medium tracking-tight">The light follows you</h3>
          <p className="mt-3 max-w-md text-sm text-muted-foreground">
            Move across the surface. The glow is a Motion gradient painted only under the pointer.
          </p>
        </SpotlightCard>
      }
      controls={
        <>
          <div className="grid gap-2">
            <Label htmlFor="spotlight-color">Color</Label>
            <Input
              id="spotlight-color"
              type="color"
              value={color}
              onChange={(event) => setColor(event.target.value)}
              className="h-9 w-full cursor-pointer p-1"
            />
          </div>
          <NumberSlider
            id="spotlight-strength"
            label="Strength"
            value={strength}
            min={0.15}
            max={0.9}
            step={0.05}
            format={(value) => value.toFixed(2)}
            onChange={setStrength}
          />
          <Choice
            label="Radius"
            value={radius}
            onChange={setRadius}
            options={SPOTLIGHT_RADII.map((option) => ({ ...option }))}
          />
        </>
      }
    />
  )
}

function SplitTextDemo() {
  const [text, setText] = useState("Characters arrive one after another")
  const [by, setBy] = useState<SplitBy>("chars")
  const [stagger, setStagger] = useState(0.03)
  const [once, setOnce] = useState(false)
  const copy = text.trim() || " "

  return (
    <DemoSection
      id="split-text"
      index="03"
      title="Split Text"
      command="@mewo/split-text"
      summary="Characters or words stagger in when the line scrolls into view."
      stage={
        <div className="flex min-h-56 items-center rounded-xl bg-muted/40 px-8 py-10 ring-1 ring-foreground/10">
          <SplitText
            key={`${copy}|${by}|${stagger}|${once}`}
            as="h3"
            by={by}
            stagger={stagger}
            once={once}
            className="text-4xl font-medium tracking-tight md:text-5xl"
          >
            {copy}
          </SplitText>
        </div>
      }
      controls={
        <>
          <div className="grid gap-2">
            <Label htmlFor="split-text-copy">Text</Label>
            <Input
              id="split-text-copy"
              value={text}
              onChange={(event) => setText(event.target.value)}
            />
          </div>
          <Choice label="Split by" value={by} onChange={setBy} options={[...SPLIT_MODES]} />
          <NumberSlider
            id="split-stagger"
            label="Stagger"
            value={stagger}
            min={0.01}
            max={0.16}
            step={0.01}
            format={(value) => `${value.toFixed(2)}s`}
            onChange={setStagger}
          />
          <ToggleField id="split-once" label="Play once" checked={once} onCheckedChange={setOnce} />
        </>
      }
    />
  )
}

function GrainientDemo({ lightMode }: { lightMode: boolean }) {
  const [type, setType] = useState<GrainientType>("linear")
  const [speed, setSpeed] = useState(1)
  const [flow, setFlow] = useState(0.8)
  const [interactive, setInteractive] = useState(true)

  return (
    <DemoSection
      id="grainient"
      index="04"
      title="Grainient"
      command="@mewo/grainient"
      summary="A film-grained gradient. Move to stir it, click to swirl."
      stage={
        <div className="h-[28rem] overflow-hidden rounded-xl ring-1 ring-foreground/10">
          <Grainient
            type={type}
            speed={speed}
            flow={flow}
            interactive={interactive}
            lightMode={lightMode}
          />
        </div>
      }
      controls={
        <>
          <Choice label="Type" value={type} onChange={setType} options={[...GRAIN_TYPES]} />
          <NumberSlider
            id="grain-speed"
            label="Speed"
            value={speed}
            min={0}
            max={3}
            step={0.05}
            onChange={setSpeed}
          />
          <NumberSlider
            id="grain-flow"
            label="Flow"
            value={flow}
            min={0}
            max={2}
            step={0.05}
            onChange={setFlow}
          />
          <ToggleField
            id="grain-interactive"
            label="Pointer stir"
            checked={interactive}
            onCheckedChange={setInteractive}
          />
        </>
      }
    />
  )
}

function ScrollMaskDemo() {
  const [variant, setVariant] = useState<ScrollMaskVariant>("iris")
  const [feather, setFeather] = useState(14)
  const [smooth, setSmooth] = useState(0.14)
  const [columns, setColumns] = useState(9)

  return (
    <section id="scroll-mask" className="scroll-mt-8 border-t border-border py-12">
      <div className="mb-6 flex flex-col gap-2">
        <p className="font-mono text-xs text-muted-foreground">05</p>
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <h2 className="text-2xl font-medium tracking-tight">Scroll Mask</h2>
          <code className="font-mono text-xs text-muted-foreground">@mewo/scroll-mask</code>
        </div>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Scroll opens the picture. The panel stays put while the frame is pinned.
        </p>
      </div>
      <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_17.5rem] lg:items-start lg:gap-6">
        <div className="order-2 min-w-0 lg:order-1">
          <ScrollMask
            variant={variant}
            src="/reveal.svg"
            alt="Dusk harbor with a low sun, dark wharves, and two boats"
            word="MEWO"
            feather={feather}
            smooth={smooth}
            columns={columns}
            scrollLength={1.35}
          >
            <p className="text-lg font-medium text-white drop-shadow">The harbor opens</p>
          </ScrollMask>
        </div>
        <div className="order-1 mb-6 grid gap-4 rounded-xl bg-card p-4 text-card-foreground ring-1 ring-foreground/10 lg:sticky lg:top-6 lg:order-2 lg:mb-0">
          <p className="text-xs font-medium text-muted-foreground">Props</p>
          <Choice label="Variant" value={variant} onChange={setVariant} options={[...MASK_VARIANTS]} />
          <NumberSlider
            id="mask-feather"
            label="Feather"
            value={feather}
            min={0}
            max={36}
            step={1}
            format={(value) => `${Math.round(value)}`}
            onChange={setFeather}
          />
          <NumberSlider
            id="mask-smooth"
            label="Smooth"
            value={smooth}
            min={0}
            max={0.6}
            step={0.02}
            format={(value) => `${value.toFixed(2)}s`}
            onChange={setSmooth}
          />
          <NumberSlider
            id="mask-columns"
            label="Columns"
            value={columns}
            min={3}
            max={16}
            step={1}
            format={(value) => `${Math.round(value)}`}
            onChange={setColumns}
          />
          <p className="text-xs text-muted-foreground">Columns apply to slats and grid.</p>
        </div>
      </div>
    </section>
  )
}
