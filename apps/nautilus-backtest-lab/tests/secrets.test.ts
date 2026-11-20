import { describe, expect, test } from "bun:test"
import { spawnSync } from "node:child_process"
import { readdirSync, readFileSync, statSync } from "node:fs"
import path from "node:path"

const root = new URL("..", import.meta.url).pathname

const forbidden = [
  /BINANCE_API/i,
  /BYBIT_API/i,
  /OKX_API/i,
  /COINBASE_API/i,
  /KRAKEN_API/i,
  /API_KEY\s*[:=]/i,
  /API_SECRET\s*[:=]/i,
  /SECRET_KEY\s*[:=]/i,
  /private_key\s*[:=]/i,
  /api\.binance/i,
  /api\.bybit/i,
  /stream\.binance/i,
  /BEGIN (?:RSA |OPENSSH )?PRIVATE KEY/,
]

function filesUnder(dir: string): string[] {
  const skip = new Set(["node_modules", "dist", ".vite", "out", "test-results", "playwright-report"])
  const found: string[] = []
  for (const entry of readdirSync(dir)) {
    if (skip.has(entry)) continue
    const full = path.join(dir, entry)
    const info = statSync(full)
    if (info.isDirectory()) found.push(...filesUnder(full))
    else if (info.isFile() && info.size < 2_000_000) found.push(full)
  }
  return found
}

describe("no exchange credentials", () => {
  test("source, fixtures, and the sidecar contain no exchange keys", () => {
    const hits: string[] = []
    for (const file of filesUnder(root)) {
      if (file.endsWith("bun.lock") || file.endsWith("secrets.test.ts")) continue
      const text = readFileSync(file, "utf8")
      for (const pattern of forbidden) {
        if (pattern.test(text)) hits.push(`${path.relative(root, file)} matched ${pattern}`)
      }
    }
    expect(hits).toEqual([])
  })

  test("the client bundle contains no exchange keys", () => {
    const build = spawnSync("bun", ["run", "build"], {
      cwd: root,
      encoding: "utf8",
      env: { ...process.env, PATH: process.env.PATH },
    })
    expect(build.status, build.stdout + build.stderr).toBe(0)
    const hits: string[] = []
    for (const file of filesUnder(path.join(root, "dist"))) {
      const text = readFileSync(file, "utf8")
      for (const pattern of forbidden) {
        if (pattern.test(text)) hits.push(`${path.relative(root, file)} matched ${pattern}`)
      }
    }
    expect(hits).toEqual([])
  })

  test("the sidecar blocks network and does not vendor the engine", () => {
    const source = readFileSync(path.join(root, "sidecar/backtest.py"), "utf8")
    expect(source).toContain("blocked a network connection")
    expect(source).toContain("import nautilus_trader")
    expect(source.includes("class BacktestEngine")).toBe(false)
    expect(source.length).toBeLessThan(20_000)
  })
})
