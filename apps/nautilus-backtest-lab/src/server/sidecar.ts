import { spawn } from "node:child_process"
import { fileURLToPath } from "node:url"
import { seriesFor } from "@/lib/catalog.ts"
import type { BacktestParams } from "@/lib/types.ts"

const SCRIPT = fileURLToPath(new URL("../../sidecar/backtest.py", import.meta.url))
const TIMEOUT_MS = 20_000

function pythonExecutable(): string {
  const override = process.env.NAUTILUS_LAB_PYTHON?.trim()
  return override || "python3"
}

/** Run the local sidecar. Returns null when Python, Nautilus, or the run fails. */
export function tryNautilusSidecar(params: BacktestParams): Promise<unknown> {
  const bars = seriesFor(params.symbol).bars
  const payload = JSON.stringify({ ...params, bars })
  return new Promise((resolve) => {
    let settled = false
    const finish = (value: unknown) => {
      if (settled) return
      settled = true
      resolve(value)
    }
    const child = spawn(pythonExecutable(), [SCRIPT], {
      stdio: ["pipe", "pipe", "pipe"],
    })
    const timer = setTimeout(() => {
      child.kill()
      finish(null)
    }, TIMEOUT_MS)
    let stdout = ""
    child.stdout.setEncoding("utf8")
    child.stdout.on("data", (chunk: string) => {
      stdout += chunk
    })
    child.on("error", () => {
      clearTimeout(timer)
      finish(null)
    })
    child.on("close", () => {
      clearTimeout(timer)
      try {
        finish(JSON.parse(stdout))
      } catch {
        finish(null)
      }
    })
    child.stdin.write(payload)
    child.stdin.end()
  })
}
