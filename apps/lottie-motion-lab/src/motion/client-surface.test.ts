import { describe, expect, test } from "bun:test"
import { readdirSync, readFileSync, statSync } from "node:fs"
import { join, relative } from "node:path"

const appRoot = join(import.meta.dir, "../..")

const SKIP_DIRS = new Set([
  "node_modules",
  "dist",
  ".vite",
  "test-results",
  "playwright-report",
  "blob-report",
  "capture-output",
])

const SOURCE_EXT = new Set([".ts", ".tsx", ".css", ".json", ".html", ".js", ".mjs"])

const RULES: { name: string; pattern: RegExp }[] = [
  {
    name: "skill-add",
    pattern: /(?:npx|bunx|npm|pnpm|yarn)\s+skills\s+add/i,
  },
  {
    name: "skills-add-repo",
    pattern: /skills\s+add\s+LottieFiles/i,
  },
  {
    name: "lottie-credential",
    pattern: /LOTTIE(?:FILES)?_(?:API_)?(?:KEY|TOKEN|SECRET)/,
  },
  {
    name: "assigned-secret",
    pattern:
      /(?:api[_-]?key|access[_-]?token|client[_-]?secret)\s*[:=]\s*["'][^"']+["']/i,
  },
  {
    name: "live-key",
    pattern: /sk-[A-Za-z0-9]{20,}/,
  },
  {
    name: "private-key",
    pattern: /-----BEGIN [A-Z ]*PRIVATE KEY-----/,
  },
]

function collect(dir: string, out: string[]) {
  for (const entry of readdirSync(dir)) {
    if (SKIP_DIRS.has(entry)) continue
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) {
      collect(full, out)
      continue
    }
    out.push(full)
  }
}

function hitsIn(text: string): string[] {
  return RULES.filter((rule) => rule.pattern.test(text)).map((rule) => rule.name)
}

function assertClean(paths: string[]) {
  const failures: string[] = []
  for (const path of paths) {
    const text = readFileSync(path, "utf8")
    const hits = hitsIn(text)
    if (hits.length > 0) {
      failures.push(`${relative(appRoot, path)}: ${hits.join(", ")}`)
    }
  }
  expect(failures).toEqual([])
}

describe("client surface", () => {
  test("source and scripts do not install a skill or embed keys", () => {
    const files: string[] = []
    collect(appRoot, files)
    const client = files.filter((path) => {
      if (path.endsWith(".test.ts")) return false
      if (path.endsWith(".md")) return false
      if (path.endsWith("bun.lock")) return false
      return SOURCE_EXT.has(path.slice(path.lastIndexOf(".")))
    })
    expect(client.length).toBeGreaterThan(0)
    assertClean(client)

    const pkg = JSON.parse(readFileSync(join(appRoot, "package.json"), "utf8")) as {
      scripts?: Record<string, string>
    }
    const scripts = Object.values(pkg.scripts ?? {}).join("\n")
    expect(hitsIn(scripts)).toEqual([])
    expect(scripts).not.toContain("skills")
  })

  test("production bundle does not install a skill or embed keys", () => {
    const result = Bun.spawnSync(["bun", "run", "build"], {
      cwd: appRoot,
      stdout: "pipe",
      stderr: "pipe",
    })
    if (result.exitCode !== 0) {
      throw new Error(
        `${result.stdout.toString()}\n${result.stderr.toString()}`,
      )
    }
    const dist = join(appRoot, "dist")
    const files: string[] = []
    collect(dist, files)
    const bundled = files.filter((path) => /\.(js|css|html)$/.test(path))
    expect(bundled.length).toBeGreaterThan(0)
    assertClean(bundled)
  })
})
