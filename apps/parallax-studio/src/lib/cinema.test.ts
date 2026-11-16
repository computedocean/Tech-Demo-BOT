import { describe, expect, test } from "bun:test"
import { assetForShot, batchFill, bundledStoryboard } from "./cinema"
import { SAMPLES } from "./samples"

describe("cinema batch", () => {
  test("the bundled storyboard starts empty", () => {
    const board = bundledStoryboard()
    expect(board.title).toBe("Harbor dusk")
    expect(board.shots).toHaveLength(3)
    expect(board.shots.map((shot) => shot.kind)).toEqual(["image", "video", "audio"])
    expect(board.shots.every((shot) => shot.status === "waiting" && shot.assetId == null)).toBe(
      true,
    )
  })

  test("batch render fills every shot from the matching sample", () => {
    const filled = batchFill(bundledStoryboard())
    expect(filled.shots.map((shot) => shot.status)).toEqual(["filled", "filled", "filled"])
    for (const shot of filled.shots) {
      const asset = assetForShot(shot)
      expect(asset).not.toBeNull()
      expect(asset?.id).toBe(SAMPLES[shot.kind].id)
      expect(asset?.src).toBe(SAMPLES[shot.kind].src)
      expect(shot.assetId).toBe(SAMPLES[shot.kind].id)
    }
  })

  test("batch render is idempotent", () => {
    const once = batchFill(bundledStoryboard())
    const twice = batchFill(once)
    expect(twice).toEqual(once)
  })
})
