import { describe, expect, test } from "bun:test"
import {
  buildRiggingForm,
  interpretSubmitResponse,
  normalizeRigInput,
  submitRigging,
  type FetchLike,
} from "../server/hyper3d.ts"

const KEY = "test-key"

function model(name = "hero.glb") {
  return new File([new Uint8Array([1, 2, 3, 4])], name, { type: "model/gltf-binary" })
}

describe("submit mapping", () => {
  test("auto rig sends an uploaded glb and no asset id or prompt", async () => {
    let form: FormData | null = null
    let auth = ""
    const fetchImpl: FetchLike = async (input, init) => {
      expect(String(input)).toBe("https://api.hyper3d.com/api/v2/rigging")
      auth = (init?.headers as { Authorization: string }).Authorization
      form = init?.body as FormData
      return new Response(
        JSON.stringify({
          message: "Submitted.",
          uuid: "task-uuid",
          jobs: { uuids: ["job-uuid"], subscription_key: "sub-key" },
        }),
        { status: 201 },
      )
    }
    const result = await submitRigging({
      apiKey: KEY,
      fetchImpl,
      input: {
        model: model(),
        boneTemplate: "auto",
        skeletonDescription: "should not be sent",
        animationPresets: ["demo_walk", "demo_walk", "demo_wave"],
        inPlace: false,
      },
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.uuid).toBe("task-uuid")
    expect(result.subscriptionKey).toBe("sub-key")
    expect(auth).toBe(`Bearer ${KEY}`)
    expect(form).not.toBeNull()
    expect(form!.get("geometry_file_format")).toBe("glb")
    expect(form!.get("bone_template")).toBe("auto")
    expect(form!.get("skeleton_description")).toBeNull()
    expect(form!.get("asset_id")).toBeNull()
    expect(form!.get("in_place")).toBeNull()
    expect(form!.getAll("animation_preset")).toEqual(["demo_walk", "demo_wave"])
    expect(form!.get("model")).toBeTruthy()
  })

  test("prompt rig sends bone_template=custom and skeleton_description", () => {
    const normalized = normalizeRigInput({
      model: model(),
      boneTemplate: "custom",
      skeletonDescription: "  A quadruped with four legs and a tail. ",
      animationPresets: ["canine_000002"],
      inPlace: true,
      image: new File([new Uint8Array([1])], "ref.png", { type: "image/png" }),
      imageName: "ref.png",
    })
    expect(normalized.ok).toBe(true)
    if (!normalized.ok) return
    const form = buildRiggingForm(normalized.value)
    expect(form.get("bone_template")).toBe("custom")
    expect(form.get("skeleton_description")).toBe("A quadruped with four legs and a tail.")
    expect(form.get("geometry_file_format")).toBe("glb")
    expect(form.get("animation_preset")).toBe("canine_000002")
    expect(form.get("in_place")).toBe("true")
    expect(form.get("image")).toBeTruthy()
    expect(form.get("asset_id")).toBeNull()
  })

  test("rejects a missing model before any request", async () => {
    const fetchImpl: FetchLike = async () => {
      throw new Error("fetch should not run")
    }
    const result = await submitRigging({ apiKey: KEY, fetchImpl, input: { model: null, boneTemplate: "auto" } })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error).toBe("MISSING_MODEL")
  })

  test("rejects a custom rig without a prompt", () => {
    const result = normalizeRigInput({ model: model(), boneTemplate: "custom", skeletonDescription: "   " })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error).toBe("MISSING_SKELETON_DESCRIPTION")
  })

  test("rejects more than 10 distinct presets", () => {
    const presets = Array.from({ length: 11 }, (_, index) => `demo_${index}`)
    const result = normalizeRigInput({ model: model(), animationPresets: presets })
    expect(result.ok).toBe(false)
  })
})

describe("HTTP 201 application errors", () => {
  test("treats a 201 body error as failure even when a uuid is present", () => {
    const result = interpretSubmitResponse(201, {
      error: "API_INSUFFICIENT_FUNDS",
      message: "The fund in your wallet is insufficient to perform this operation.",
      uuid: "task-uuid",
      jobs: { subscription_key: "sub-key", uuids: ["job-uuid"] },
    })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error).toBe("API_INSUFFICIENT_FUNDS")
  })

  test("accepts a 201 when error is empty and uuid is present", () => {
    const result = interpretSubmitResponse(201, {
      error: "",
      uuid: "task-uuid",
      jobs: { subscription_key: "sub-key", uuids: ["job-uuid"] },
    })
    expect(result.ok).toBe(true)
  })

  test("accepts a 201 when error is absent", () => {
    const result = interpretSubmitResponse(201, {
      uuid: "task-uuid",
      jobs: { subscription_key: "sub-key", uuids: ["job-1"] },
    })
    expect(result.ok).toBe(true)
  })

  test("rejects a 201 with an empty uuid", () => {
    const result = interpretSubmitResponse(201, {
      uuid: "  ",
      jobs: { subscription_key: "sub-key" },
    })
    expect(result.ok).toBe(false)
  })
})
