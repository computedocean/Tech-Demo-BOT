import { describe, expect, test } from "bun:test"
import { spawnSync } from "node:child_process"
import { readdirSync, readFileSync, statSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { applyEdit } from "../src/lib/edit.ts"
import { generateDiagram, generatePreset } from "../src/lib/generate.ts"
import { assertDiagram, routeEdgeIds } from "../src/lib/graph.ts"
import { clearHighlight, highlightPath } from "../src/lib/highlight.ts"
import { PLAIN_PROMPTS, PRESETS } from "../src/lib/presets.ts"
import type { Diagram, HighlightResult } from "../src/lib/types.ts"
import { handleDiagramBody } from "../server/diagram.ts"
import { acceptRewrite, llmKeyPresent, maybeRewriteDiagram } from "../server/llm.ts"

const root = join(dirname(fileURLToPath(import.meta.url)), "..")

function requireDiagram(result: { ok: true; diagram: Diagram } | { ok: false; error: string }): Diagram {
  if (!result.ok) throw new Error(result.error)
  return result.diagram
}

function requireHighlight(result: HighlightResult) {
  if (!result.ok) throw new Error(result.error)
  return result.highlight
}

function walk(dir: string): string[] {
  const files: string[] = []
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) files.push(...walk(full))
    else files.push(full)
  }
  return files
}

function expectDirected(diagram: Diagram, nodeIds: string[], edgeIds: string[]) {
  expect(edgeIds.length).toBe(nodeIds.length - 1)
  expect(routeEdgeIds(nodeIds, diagram.edges)).toEqual(edgeIds)
  for (let index = 0; index < nodeIds.length - 1; index += 1) {
    const edge = diagram.edges.find((item) => item.id === edgeIds[index])
    expect(edge?.from).toBe(nodeIds[index])
    expect(edge?.to).toBe(nodeIds[index + 1])
  }
}

describe("template generation", () => {
  test("each preset is a structured diagram with detail and a directed path", () => {
    for (const preset of PRESETS) {
      const diagram = generatePreset(preset.id)
      assertDiagram(diagram)
      expect(diagram.templateId).toBe(preset.id)
      expect(diagram.title.length).toBeGreaterThan(0)
      expect(diagram.summary.length).toBeGreaterThan(0)
      expect(diagram.nodes.length).toBeGreaterThanOrEqual(3)
      expect(diagram.edges.length).toBeGreaterThanOrEqual(2)
      expect(diagram.paths.length).toBeGreaterThan(0)
      for (const node of diagram.nodes) {
        expect(node.detail.length).toBeGreaterThan(10)
        expect(node.role.length).toBeGreaterThan(0)
      }
      for (const path of diagram.paths) {
        const highlight = requireHighlight(highlightPath(diagram, path.id))
        expectDirected(diagram, highlight.nodeIds, highlight.edgeIds)
      }
      expect(JSON.stringify(generatePreset(preset.id))).toBe(JSON.stringify(diagram))
    }
  })

  test("a plain-words prompt matches the same template as its preset", () => {
    for (const preset of PRESETS) {
      const fromPreset = generatePreset(preset.id)
      const fromLabel = requireDiagram(generateDiagram(preset.label))
      const fromPlain = requireDiagram(generateDiagram(PLAIN_PROMPTS[preset.id]))
      expect(fromLabel).toEqual(fromPreset)
      expect(fromPlain.templateId).toBe(preset.id)
      expect(fromPlain.nodes.map((node) => node.id)).toEqual(fromPreset.nodes.map((node) => node.id))
      assertDiagram(fromPlain)
    }
  })

  test("unrecognized and blank descriptions fail clearly", () => {
    const unknown = generateDiagram("design a spaceship with a warp core")
    expect(unknown.ok).toBe(false)
    if (unknown.ok) return
    expect(unknown.error.toLowerCase()).toContain("does not recognize")
    expect(unknown.suggestions).toEqual(PRESETS.map((preset) => preset.label))
    expect("diagram" in unknown).toBe(false)

    const blank = generateDiagram("   ")
    expect(blank.ok).toBe(false)
    if (!blank.ok) expect(blank.error.toLowerCase()).toContain("enter a system description")

    const editAsPrompt = generateDiagram("add a Redis cache")
    expect(editAsPrompt.ok).toBe(false)
  })
})

describe("follow-up edits", () => {
  test("add a Redis cache inserts a node and a directed miss route", () => {
    const diagram = generatePreset("web")
    const before = structuredClone(diagram)
    const edited = applyEdit(diagram, "add a Redis cache")
    expect(diagram).toEqual(before)
    expect(edited.ok).toBe(true)
    if (!edited.ok) return
    assertDiagram(edited.diagram)
    const redis = edited.diagram.nodes.find((node) => node.name === "Redis")
    expect(redis?.kind).toBe("cache")
    expect(edited.diagram.nodes.length).toBe(diagram.nodes.length + 1)
    expect(edited.diagram.edges.some((edge) => edge.label === "lookup" && edge.to === redis?.id)).toBe(true)
    expect(edited.diagram.edges.some((edge) => edge.label === "miss" && edge.from === redis?.id)).toBe(true)
    expect(edited.note.toLowerCase()).toContain("redis")
    const miss = edited.diagram.paths.find((path) => path.name === "Cache miss")
    expect(miss).toBeDefined()
    if (!miss || !redis) return
    expect(miss.nodeIds).toContain(redis.id)
    const highlight = requireHighlight(highlightPath(edited.diagram, miss.id))
    expectDirected(edited.diagram, highlight.nodeIds, highlight.edgeIds)
    expect(highlight.nodeIds).toEqual(["web-api", redis.id, "web-db"])

    const shouted = applyEdit(diagram, "ADD A REDIS CACHE")
    expect(shouted.ok).toBe(true)
    if (shouted.ok) expect(shouted.diagram.nodes.some((node) => node.name === "Redis")).toBe(true)
  })

  test("add authentication inserts a session gate and a directed sign-in route", () => {
    const diagram = generatePreset("web")
    const before = structuredClone(diagram)
    const edited = applyEdit(diagram, "add authentication")
    expect(diagram).toEqual(before)
    expect(edited.ok).toBe(true)
    if (!edited.ok) return
    assertDiagram(edited.diagram)
    const auth = edited.diagram.nodes.find((node) => node.kind === "auth")
    expect(auth?.name).toBe("Auth")
    expect(edited.diagram.edges.some((edge) => edge.label === "sign in" && edge.to === auth?.id)).toBe(true)
    expect(edited.diagram.edges.some((edge) => edge.label === "session" && edge.from === auth?.id)).toBe(true)
    const signIn = edited.diagram.paths.find((path) => path.name === "Sign in")
    expect(signIn).toBeDefined()
    if (!signIn) return
    const highlight = requireHighlight(highlightPath(edited.diagram, signIn.id))
    expectDirected(edited.diagram, highlight.nodeIds, highlight.edgeIds)
    expect(highlight.nodeIds[0]).toBe("web-browser")
    expect(highlight.nodeIds).toContain(auth?.id)
  })

  test("a second cache and an unknown edit fail without changing the graph", () => {
    const diagram = generatePreset("queue")
    const first = applyEdit(diagram, "add a Redis cache")
    expect(first.ok).toBe(true)
    if (!first.ok) return
    const again = applyEdit(first.diagram, "add a Redis cache")
    expect(again.ok).toBe(false)
    if (!again.ok) expect(again.error.toLowerCase()).toContain("already")
    expect(first.diagram.nodes.filter((node) => node.kind === "cache")).toHaveLength(1)

    const before = structuredClone(diagram)
    const unknown = applyEdit(diagram, "repaint the nodes gold")
    expect(unknown.ok).toBe(false)
    if (!unknown.ok) {
      expect(unknown.error.toLowerCase()).toContain("does not recognize")
      expect(unknown.suggestions).toContain("add a Redis cache")
      expect(unknown.suggestions).toContain("add authentication")
    }
    expect(diagram).toEqual(before)

    const authPreset = generatePreset("auth")
    const duplicateAuth = applyEdit(authPreset, "add authentication")
    expect(duplicateAuth.ok).toBe(false)
    if (!duplicateAuth.ok) expect(duplicateAuth.error.toLowerCase()).toContain("already")
  })
})

describe("path highlighting", () => {
  test("selects a real directed route and can be cleared", () => {
    const diagram = generatePreset("event")
    const path = diagram.paths[0]
    if (!path) throw new Error("missing path")
    const selected = requireHighlight(highlightPath(diagram, path.id))
    expect(selected.pathId).toBe(path.id)
    expect(selected.nodeIds).toEqual(path.nodeIds)
    expectDirected(diagram, selected.nodeIds, selected.edgeIds)
    expect(selected.nodeIds).toEqual(["event-checkout", "event-bus", "event-inventory", "event-orders"])

    const cleared = clearHighlight()
    expect(cleared.pathId).toBeNull()
    expect(cleared.nodeIds).toEqual([])
    expect(cleared.edgeIds).toEqual([])

    const missing = highlightPath(diagram, "not-a-path")
    expect(missing.ok).toBe(false)
    if (!missing.ok) expect(missing.error.toLowerCase()).toContain("no path")
  })
})

describe("secrets and optional rewrite", () => {
  test("client sources and default responses contain no keys", async () => {
    const banned = [
      /ARCHIFY_DIAGRAM_LLM_KEY/,
      /OPENAI_API_KEY/,
      /VITE_/,
      /sk-[A-Za-z0-9]{8,}/,
      /api\.openai\.com/,
      /Bearer\s+/,
    ]
    const files = [...walk(join(root, "src")), join(root, "index.html")]
    for (const file of files) {
      const text = readFileSync(file, "utf8")
      for (const pattern of banned) {
        expect(text).not.toMatch(pattern)
      }
    }

    const previousNamed = process.env.ARCHIFY_DIAGRAM_LLM_KEY
    const previousOpenAi = process.env.OPENAI_API_KEY
    delete process.env.ARCHIFY_DIAGRAM_LLM_KEY
    delete process.env.OPENAI_API_KEY
    try {
      expect(llmKeyPresent()).toBe(false)
      const generated = await handleDiagramBody({ action: "generate", prompt: "a todo app with an API and a database" })
      expect(generated.ok).toBe(true)
      if (generated.ok) {
        expect(generated.usedLlm).toBe(false)
        expect(generated.note.toLowerCase()).toContain("off")
      }
      const preset = await handleDiagramBody({ action: "preset", presetId: "web" })
      expect(preset.ok).toBe(true)
      if (preset.ok) expect(preset.usedLlm).toBe(false)
      const unknown = await handleDiagramBody({ action: "generate", prompt: "warp core" })
      expect(unknown.ok).toBe(false)
      const blob = JSON.stringify({ generated, preset, unknown })
      expect(blob).not.toMatch(/ARCHIFY_DIAGRAM_LLM_KEY|OPENAI_API_KEY|sk-[A-Za-z0-9]{8,}|Bearer\s+|api\.openai\.com/i)
    } finally {
      if (previousNamed === undefined) delete process.env.ARCHIFY_DIAGRAM_LLM_KEY
      else process.env.ARCHIFY_DIAGRAM_LLM_KEY = previousNamed
      if (previousOpenAi === undefined) delete process.env.OPENAI_API_KEY
      else process.env.OPENAI_API_KEY = previousOpenAi
    }
  })

  test("rewrite stays off without a key and does not leak a key on failure", async () => {
    const diagram = generatePreset("web")
    const previousNamed = process.env.ARCHIFY_DIAGRAM_LLM_KEY
    const previousOpenAi = process.env.OPENAI_API_KEY
    delete process.env.ARCHIFY_DIAGRAM_LLM_KEY
    delete process.env.OPENAI_API_KEY
    const originalFetch = globalThis.fetch
    try {
      const idle = await maybeRewriteDiagram(diagram, "clarify the copy")
      expect(idle.usedLlm).toBe(false)
      expect(idle.diagram).toEqual(diagram)
      expect(JSON.stringify(idle)).not.toMatch(/sk-|Bearer/)

      process.env.ARCHIFY_DIAGRAM_LLM_KEY = "sk-testsecretvalue"
      expect(llmKeyPresent()).toBe(true)
      globalThis.fetch = async () => {
        throw new Error("network down sk-testsecretvalue")
      }
      const failed = await maybeRewriteDiagram(diagram, "clarify the copy")
      expect(failed.usedLlm).toBe(false)
      expect(failed.diagram).toEqual(diagram)
      expect(JSON.stringify(failed)).not.toContain("sk-testsecretvalue")
      expect(JSON.stringify(failed)).not.toMatch(/Bearer/)

      const bad = acceptRewrite(diagram, "not json")
      expect(bad.usedLlm).toBe(false)
      expect(bad.diagram).toBe(diagram)

      const rewritten = acceptRewrite(
        diagram,
        JSON.stringify({
          summary: "Shorter summary.",
          nodes: diagram.nodes.map((node) => ({ id: node.id, detail: `Rewritten ${node.name}.` })),
        }),
      )
      expect(rewritten.usedLlm).toBe(true)
      expect(rewritten.diagram.edges).toEqual(diagram.edges)
      expect(rewritten.diagram.paths).toEqual(diagram.paths)
      expect(rewritten.diagram.nodes.map((node) => node.name)).toEqual(diagram.nodes.map((node) => node.name))
      expect(rewritten.diagram.summary).toBe("Shorter summary.")
      expect(JSON.stringify(rewritten)).not.toMatch(/sk-|Bearer|api\.openai\.com/)

      const invented = acceptRewrite(
        diagram,
        JSON.stringify({
          summary: "Nope",
          nodes: [...diagram.nodes.map((node) => ({ id: node.id, detail: "x" })), { id: "extra", detail: "nope" }],
        }),
      )
      expect(invented.usedLlm).toBe(false)
      expect(invented.diagram).toBe(diagram)
    } finally {
      globalThis.fetch = originalFetch
      if (previousNamed === undefined) delete process.env.ARCHIFY_DIAGRAM_LLM_KEY
      else process.env.ARCHIFY_DIAGRAM_LLM_KEY = previousNamed
      if (previousOpenAi === undefined) delete process.env.OPENAI_API_KEY
      else process.env.OPENAI_API_KEY = previousOpenAi
    }
  })

  test("the production client bundle does not contain server keys", () => {
    const built = spawnSync(process.execPath, ["run", "build"], {
      cwd: root,
      encoding: "utf8",
      env: { ...process.env, OPENAI_API_KEY: "", ARCHIFY_DIAGRAM_LLM_KEY: "" },
    })
    if (built.status !== 0) throw new Error(`${built.stdout}\n${built.stderr}`)
    const assets = readdirSync(join(root, "dist/assets")).filter((file) => file.endsWith(".js"))
    expect(assets.length).toBeGreaterThan(0)
    const blob = assets.map((file) => readFileSync(join(root, "dist/assets", file), "utf8")).join("\n")
    expect(blob).not.toContain("ARCHIFY_DIAGRAM_LLM_KEY")
    expect(blob).not.toContain("OPENAI_API_KEY")
    expect(blob).not.toContain("api.openai.com")
    expect(blob).not.toMatch(/sk-[A-Za-z0-9]{8,}/)
    expect(blob).not.toMatch(/Bearer\s+/)
  }, 120_000)
})
