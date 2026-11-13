import { describe, expect, test } from "bun:test"
import { readFile } from "node:fs/promises"
import { join } from "node:path"
import { fileURLToPath } from "node:url"
import { NodeIO } from "@gltf-transform/core"

const root = fileURLToPath(new URL("..", import.meta.url))

describe("bundled sample rig", () => {
  test("rigged sample has a skin and Idle, Walk, and Wave clips", async () => {
    const bytes = await readFile(join(root, "public/samples/rigged-figure.glb"))
    const document = await new NodeIO().readBinary(new Uint8Array(bytes))
    const names = document.getRoot().listAnimations().map((animation) => animation.getName()).sort()
    expect(names).toEqual(["Idle", "Walk", "Wave"])
    expect(document.getRoot().listSkins().length).toBe(1)
    expect(document.getRoot().listSkins()[0]?.listJoints().length).toBeGreaterThan(8)
  })

  test("unrigged sample is a static mesh", async () => {
    const bytes = await readFile(join(root, "public/samples/unrigged-figure.glb"))
    const document = await new NodeIO().readBinary(new Uint8Array(bytes))
    expect(document.getRoot().listAnimations().length).toBe(0)
    expect(document.getRoot().listSkins().length).toBe(0)
    expect(document.getRoot().listMeshes().length).toBe(1)
  })

  test("license sits next to the sample meshes", async () => {
    const license = await readFile(join(root, "public/samples/LICENSE.txt"), "utf8")
    expect(license).toContain("MIT")
    expect(license).toContain("not Deemos or Hyper3D")
  })
})
