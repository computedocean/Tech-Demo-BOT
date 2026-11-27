import { useEffect, useState } from "react"
import { Stage } from "./Stage.tsx"
import { defaultTokens } from "./types.ts"

declare global {
  interface Window {
    __seek?: (time: number) => void
  }
}

/** Full-frame render used to author the bundled sample. Not a second screen. */
export function CaptureFrame() {
  const initial = Number(new URLSearchParams(window.location.search).get("t") ?? "0")
  const [time, setTime] = useState(Number.isFinite(initial) ? initial : 0)

  useEffect(() => {
    const previousBody = document.body.style.background
    const previousHtml = document.documentElement.style.background
    document.body.style.background = defaultTokens.ink
    document.documentElement.style.background = defaultTokens.ink
    window.__seek = (next: number) => setTime(next)
    return () => {
      document.body.style.background = previousBody
      document.documentElement.style.background = previousHtml
      delete window.__seek
    }
  }, [])

  return (
    <div style={{ width: 1280, height: 720, overflow: "hidden" }}>
      <Stage tokens={defaultTokens} time={time} />
    </div>
  )
}
