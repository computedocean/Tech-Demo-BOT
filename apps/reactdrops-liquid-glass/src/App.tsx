import { useCallback, useEffect, useRef, useState } from "react";
import {
  LiquidGlassOrb,
  fluidAgentOrbPresets,
  fluidAgentOrbStateLabels,
  fluidAgentOrbStates,
  fluidAgentOrbThinkingAnimationLabels,
  fluidAgentOrbThinkingAnimations,
  type LiquidGlassOrbPreset,
  type LiquidGlassOrbState,
  type LiquidGlassOrbThinkingAnimation,
} from "@/components/liquid-glass-orb";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";

const PREFERRED_PRESETS = [
  "monochrome",
  "tide",
  "azure",
  "indigo",
  "mint",
  "coral",
  "scarlet",
  "fuchsia",
  "aqua",
  "berry",
  "cobalt",
  "cobalt-dark",
  "dune",
  "frost",
  "honey",
  "lilac",
  "red",
] as const satisfies readonly LiquidGlassOrbPreset[];

const CYCLE_MS = 3000;

const presets = PREFERRED_PRESETS.filter(
  (name) => name in fluidAgentOrbPresets,
);

function titleCase(value: string) {
  return value
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function isState(value: string): value is LiquidGlassOrbState {
  return (fluidAgentOrbStates as readonly string[]).includes(value);
}

function isPreset(value: string): value is LiquidGlassOrbPreset {
  return (presets as readonly string[]).includes(value);
}

function isThinkingAnimation(
  value: string,
): value is LiquidGlassOrbThinkingAnimation {
  return (fluidAgentOrbThinkingAnimations as readonly string[]).includes(value);
}

function sampleAudioLevel(
  state: LiquidGlassOrbState,
  autoDemo: boolean,
  reduceMotion: boolean,
) {
  const voiced = state === "listening" || state === "speaking";
  if (!voiced) return 0.18;
  if (!autoDemo || reduceMotion) return 0.55;
  const wave = 0.5 + 0.5 * Math.sin((performance.now() / 1000) * Math.PI * 1.5);
  return 0.08 + wave * 0.88;
}

function useOrbSize() {
  const [size, setSize] = useState(420);

  useEffect(() => {
    const apply = () => {
      const width = window.innerWidth;
      if (width < 640) setSize(260);
      else if (width < 1024) setSize(340);
      else setSize(440);
    };
    apply();
    window.addEventListener("resize", apply);
    return () => window.removeEventListener("resize", apply);
  }, []);

  return size;
}

function useReducedMotion() {
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => setReduceMotion(query.matches);
    apply();
    query.addEventListener("change", apply);
    return () => query.removeEventListener("change", apply);
  }, []);

  return reduceMotion;
}

export default function App() {
  const [state, setState] = useState<LiquidGlassOrbState>("idle");
  const [preset, setPreset] = useState<LiquidGlassOrbPreset>("monochrome");
  const [thinkingAnimation, setThinkingAnimation] =
    useState<LiquidGlassOrbThinkingAnimation>("ripples");
  const [speed, setSpeed] = useState(1.5);
  const [distortion, setDistortion] = useState(0.8);
  const [autoDemo, setAutoDemo] = useState(true);
  const reduceMotion = useReducedMotion();
  const orbSize = useOrbSize();

  const stateRef = useRef(state);
  const autoRef = useRef(autoDemo);
  const reduceRef = useRef(reduceMotion);
  const meterRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    stateRef.current = state;
    autoRef.current = autoDemo;
    reduceRef.current = reduceMotion;
  }, [state, autoDemo, reduceMotion]);

  const getAudioLevel = useCallback(() => {
    return sampleAudioLevel(
      stateRef.current,
      autoRef.current,
      reduceRef.current,
    );
  }, []);

  useEffect(() => {
    if (!autoDemo) return;
    const id = window.setInterval(() => {
      setState((current) => {
        const index = fluidAgentOrbStates.indexOf(current);
        return fluidAgentOrbStates[(index + 1) % fluidAgentOrbStates.length];
      });
    }, CYCLE_MS);
    return () => window.clearInterval(id);
  }, [autoDemo]);

  useEffect(() => {
    let frame = 0;
    const paint = () => {
      const level = sampleAudioLevel(
        stateRef.current,
        autoRef.current,
        reduceRef.current,
      );
      if (meterRef.current) {
        meterRef.current.style.transform = `scaleX(${level})`;
      }
    };
    if (reduceMotion) {
      paint();
      return;
    }
    const loop = () => {
      paint();
      frame = window.requestAnimationFrame(loop);
    };
    frame = window.requestAnimationFrame(loop);
    return () => window.cancelAnimationFrame(frame);
  }, [reduceMotion, state, autoDemo]);

  const stateLabel = fluidAgentOrbStateLabels[state];

  return (
    <main className="mx-auto flex min-h-svh w-full max-w-6xl flex-col gap-10 px-5 py-8 sm:px-8 lg:flex-row lg:items-center lg:justify-between lg:gap-16 lg:px-12 lg:py-10">
      <section className="flex flex-1 flex-col items-center gap-6 text-center">
        <header className="flex max-w-md flex-col gap-2">
          <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
            ReactDrops
          </p>
          <h1 className="font-heading text-4xl tracking-tight text-balance sm:text-5xl">
            Liquid Glass Orb
          </h1>
          <p className="text-sm text-muted-foreground text-pretty">
            Agent states for an interface that listens, thinks, and answers.
            The voice envelope is synthetic.
          </p>
        </header>

        <div
          className="grid place-items-center py-2"
          style={{ width: orbSize, maxWidth: "100%" }}
        >
          <LiquidGlassOrb
            preset={preset}
            state={state}
            thinkingAnimation={thinkingAnimation}
            speed={speed}
            distortion={distortion}
            getAudioLevel={getAudioLevel}
            size={orbSize}
            animateEntrance={!reduceMotion}
            aria-label={`Liquid glass orb, ${stateLabel}`}
            className="max-w-full"
          />
        </div>

        <div className="flex w-full max-w-xs flex-col items-center gap-3">
          <p className="font-heading text-3xl" aria-live="polite">
            {stateLabel}
          </p>
          <div className="w-full">
            <div className="mb-1.5 flex items-center justify-between text-xs font-semibold tracking-wide text-muted-foreground uppercase">
              <span>Voice envelope</span>
              <span>
                {state === "listening" || state === "speaking"
                  ? autoDemo && !reduceMotion
                    ? "Sine"
                    : "Held"
                  : "Rest"}
              </span>
            </div>
            <div className="h-0.5 w-full overflow-hidden bg-input">
              <div
                ref={meterRef}
                className="h-full origin-left bg-foreground"
                style={{ transform: "scaleX(0.18)" }}
              />
            </div>
          </div>
        </div>
      </section>

      <aside className="w-full border border-border p-5 sm:p-6 lg:max-w-sm">
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <h2 className="font-heading text-2xl">Controls</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {autoDemo
                ? "States advance every 3 seconds."
                : "Auto demo is off. Pick a state."}
            </p>
          </div>
          <div className="flex items-center gap-2 pt-1">
            <Label htmlFor="auto-demo">Auto</Label>
            <Switch
              id="auto-demo"
              checked={autoDemo}
              onCheckedChange={setAutoDemo}
            />
          </div>
        </div>

        <div className="flex flex-col gap-5">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="orb-state">State</Label>
            <Select
              value={state}
              onValueChange={(value) => {
                if (isState(value)) setState(value);
              }}
              disabled={autoDemo}
            >
              <SelectTrigger
                id="orb-state"
                className="w-full disabled:opacity-100"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent position="popper" className="max-h-72">
                {fluidAgentOrbStates.map((item) => (
                  <SelectItem key={item} value={item}>
                    {fluidAgentOrbStateLabels[item]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="orb-preset">Preset</Label>
            <Select
              value={preset}
              onValueChange={(value) => {
                if (isPreset(value)) setPreset(value);
              }}
            >
              <SelectTrigger id="orb-preset" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent position="popper" className="max-h-72">
                {presets.map((item) => (
                  <SelectItem key={item} value={item}>
                    {titleCase(item)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="orb-thinking">Thinking animation</Label>
            <Select
              value={thinkingAnimation}
              onValueChange={(value) => {
                if (isThinkingAnimation(value)) setThinkingAnimation(value);
              }}
            >
              <SelectTrigger id="orb-thinking" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent position="popper">
                {fluidAgentOrbThinkingAnimations.map((item) => (
                  <SelectItem key={item} value={item}>
                    {fluidAgentOrbThinkingAnimationLabels[item]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between gap-3">
              <Label htmlFor="orb-speed">Speed</Label>
              <span className="text-sm tabular-nums text-muted-foreground">
                {speed.toFixed(1)}
              </span>
            </div>
            <Slider
              id="orb-speed"
              min={0}
              max={4}
              step={0.1}
              value={[speed]}
              onValueChange={(next) => {
                const value = next[0];
                if (value !== undefined) setSpeed(value);
              }}
            />
          </div>

          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between gap-3">
              <Label htmlFor="orb-distortion">Distortion</Label>
              <span className="text-sm tabular-nums text-muted-foreground">
                {distortion.toFixed(1)}
              </span>
            </div>
            <Slider
              id="orb-distortion"
              min={0}
              max={8}
              step={0.1}
              value={[distortion]}
              onValueChange={(next) => {
                const value = next[0];
                if (value !== undefined) setDistortion(value);
              }}
            />
          </div>
        </div>

        {reduceMotion ? (
          <p className="mt-6 text-sm text-muted-foreground">
            Reduced motion is on. The orb skips its entrance and holds the
            voice pulse. The state name still updates.
          </p>
        ) : null}
      </aside>
    </main>
  );
}
