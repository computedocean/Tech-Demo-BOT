import { describe, expect, test } from "bun:test"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { generateMock } from "./generate"
import { MODELS, modelsFor, SAMPLES, type StudioKind } from "./samples"

const appRoot = join(import.meta.dir, "../..")

describe("mock generate", () => {
  const kinds: StudioKind[] = ["image", "video", "audio"]

  test.each(kinds)("%s returns a bundled sample without a key", (kind) => {
    const model = modelsFor(kind)[0]
    const result = generateMock({
      kind,
      modelName: model.name,
      prompt: `A prompt for ${kind}`,
    })

    expect(result.ok).toBe(true)
    expect(result.mode).toBe("mock")
    expect(result.treg).toBe("off")
    expect(result.usedKey).toBe(false)
    expect(result.badge).toBe("mock / sample file")
    expect(result.asset).toEqual(SAMPLES[kind])
    expect(result.modelName).toBe(model.name)
    expect(result.disclosure.toLowerCase()).toContain("bundled sample")
    expect(JSON.stringify(result)).not.toContain("TREG_TOKEN")

    const bytes = readFileSync(join(appRoot, result.asset.file))
    expect(bytes.byteLength).toBeGreaterThan(1000)
    if (kind === "image") {
      expect(bytes.subarray(0, 8).toString("hex")).toBe("89504e470d0a1a0a")
    }
    if (kind === "video") {
      expect(bytes.subarray(4, 8).toString("ascii")).toBe("ftyp")
    }
    if (kind === "audio") {
      expect(bytes.subarray(0, 4).toString("ascii")).toBe("RIFF")
      expect(bytes.subarray(8, 12).toString("ascii")).toBe("WAVE")
    }
  })

  test("an unknown model name still returns the sample", () => {
    const result = generateMock({
      kind: "image",
      modelName: "Not a real model",
      prompt: "",
    })
    expect(result.asset.id).toBe("harbor-still")
    expect(result.modelName).toBe(MODELS[0].name)
    expect(result.prompt.length).toBeGreaterThan(0)
    expect(result.usedKey).toBe(false)
  })

  test("both image mock models share the bundled still", () => {
    const [first, second] = modelsFor("image")
    const a = generateMock({ kind: "image", modelName: first.name, prompt: "one" })
    const b = generateMock({ kind: "image", modelName: second.name, prompt: "two" })
    expect(a.asset.src).toBe(b.asset.src)
    expect(a.modelName).not.toBe(b.modelName)
  })
})
