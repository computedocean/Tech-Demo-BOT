import { describe, expect, test } from "bun:test"
import { readdirSync, readFileSync, statSync } from "node:fs"
import { join, relative } from "node:path"
import { build } from "vite"
import { AFFILIATION, PRODUCT_LIMIT } from "./copy"
import { generateMock } from "./generate"
import { STUDIO_RUNTIME } from "./runtime"
import { publicModePayload, resolveGenerationMode } from "../server/treg-gate"

const appRoot = join(import.meta.dir, "../..")

function walk(dir: string): string[] {
  const files: string[] = []
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) files.push(...walk(full))
    else files.push(full)
  }
  return files
}

function clientSources(): { path: string; text: string }[] {
  const roots = [join(appRoot, "src"), join(appRoot, "index.html")]
  const files = roots.flatMap((root) => (statSync(root).isDirectory() ? walk(root) : [root]))
  return files
    .filter((file) => !file.includes(`${join("src", "server")}`))
    .filter((file) => !file.endsWith(".test.ts"))
    .filter((file) => /\.(tsx?|css|html)$/.test(file))
    .map((file) => ({ path: relative(appRoot, file), text: readFileSync(file, "utf8") }))
}

describe("runtime boundaries", () => {
  test("treg is off by default and a server token never leaves the gate", () => {
    expect(STUDIO_RUNTIME.mode).toBe("mock")
    expect(STUDIO_RUNTIME.treg).toBe("off")
    expect(STUDIO_RUNTIME.requiresKey).toBe(false)
    expect(STUDIO_RUNTIME.supercomputer).toBe("stand-in")
    expect(STUDIO_RUNTIME.liveComputers).toBe(false)
    expect(STUDIO_RUNTIME.remoteAgent).toBe(false)

    const unset = resolveGenerationMode({})
    expect(unset.treg).toBe("off")
    expect(unset.liveCall).toBe(false)
    expect(unset.mode).toBe("mock")

    const secret = "super-secret-token-value"
    const payload = publicModePayload({ TREG_TOKEN: secret })
    expect(payload.treg).toBe("off")
    expect(payload.liveCall).toBe(false)
    expect(payload.liveComputers).toBe(false)
    expect(payload.remoteAgent).toBe(false)
    expect(JSON.stringify(payload)).not.toContain(secret)

    const response = generateMock({
      kind: "video",
      modelName: "Sample Reel",
      prompt: "reel",
    })
    expect(JSON.stringify(response)).not.toContain(secret)
    expect(JSON.stringify(response)).not.toContain("TREG_TOKEN")
  })

  test("client source has no tokens, promo codes, or live wiring", () => {
    const forbidden = [
      /TREG_TOKEN/,
      /VITE_/,
      /ORGO_API_KEY/,
      /COMPOSIO_API_KEY/,
      /SUPER_MODE/,
      /treg\.to/i,
      /LAUNCH-WEEK/i,
      /hermes/i,
      /composio/i,
      /fetch\s*\(/,
    ]
    const allowedUrls = new Set([
      "https://github.com/nickvasilescu/parallax",
      "https://github.com/nickvasilescu/parallax/blob/main/LICENSE",
    ])

    for (const file of clientSources()) {
      const stripped = file.text.replaceAll(AFFILIATION, "").replaceAll(PRODUCT_LIMIT, "")
      for (const pattern of forbidden) {
        expect(stripped, `${file.path} matches ${pattern}`).not.toMatch(pattern)
      }
      expect(stripped, file.path).not.toMatch(/orgo/i)
      expect(stripped, file.path).not.toMatch(/higgsfield/i)
      const urls = stripped.match(/https?:\/\/[^\s"'`)]+/g) ?? []
      for (const url of urls) {
        expect(allowedUrls.has(url), `${file.path} url ${url}`).toBe(true)
      }
    }
  })

  test("the server gate does not call a provider", () => {
    const source = readFileSync(join(appRoot, "src/server/treg-gate.ts"), "utf8")
    expect(source).toContain("TREG_TOKEN")
    expect(source).not.toContain("fetch(")
    expect(source).not.toContain("treg.to")
    expect(source).not.toMatch(/hermes/i)
    expect(source).not.toMatch(/composio/i)
    expect(source).not.toMatch(/orgo/i)
    expect(source).not.toContain("SUPER_MODE")
  })

  test(
    "the client bundle has no token or live host",
    async () => {
      await build({
        root: appRoot,
        configFile: join(appRoot, "vite.config.ts"),
        logLevel: "error",
        build: {
          outDir: join(appRoot, "output/client-bundle"),
          emptyOutDir: true,
        },
      })
      const bundleDir = join(appRoot, "output/client-bundle")
      const bundled = walk(bundleDir)
        .filter((file) => file.endsWith(".js") || file.endsWith(".css") || file.endsWith(".html"))
        .map((file) => readFileSync(file, "utf8"))
        .join("\n")
      expect(bundled).not.toContain("TREG_TOKEN")
      expect(bundled).not.toContain("VITE_")
      expect(bundled).not.toContain("treg.to")
      expect(bundled).not.toContain("LAUNCH-WEEK")
      expect(bundled).not.toMatch(/ORGO_API_KEY/)
      expect(bundled).not.toMatch(/COMPOSIO_API_KEY/)
      expect(bundled).not.toMatch(/hermes/i)
      expect(bundled).not.toMatch(/composio/i)
      expect(bundled.toLowerCase()).not.toContain("super_mode")
    },
    60_000,
  )
})
