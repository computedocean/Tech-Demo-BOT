import { describe, expect, test } from "bun:test"
import { readFileSync } from "node:fs"
import { bundledStoryboard } from "./cinema"
import { proposeNext, proposedStep, resolveStep, STAND_IN_SCRIPT, initialStandIn } from "./stand-in"

describe("supercomputer stand-in", () => {
  test("propose, accept, and dismiss stay on the script and call no model", () => {
    const source = readFileSync(new URL("./stand-in.ts", import.meta.url), "utf8")
    expect(source).not.toContain("fetch(")
    expect(source).not.toContain("treg.to")

    let state = initialStandIn()
    let board = bundledStoryboard()
    expect(state.callsModel).toBe(false)
    expect(proposedStep(state)).toBeNull()

    state = proposeNext(state)
    expect(proposedStep(state)?.id).toBe(STAND_IN_SCRIPT[0].id)
    expect(state.callsModel).toBe(false)

    const held = proposeNext(state)
    expect(held).toEqual(state)

    const accepted = resolveStep(state, board, STAND_IN_SCRIPT[0].id, "accepted")
    expect(accepted.state.callsModel).toBe(false)
    expect(accepted.state.log).toEqual([{ stepId: "propose-still", decision: "accepted" }])
    expect(accepted.generation?.usedKey).toBe(false)
    expect(accepted.generation?.asset.id).toBe("harbor-still")
    expect(accepted.generation?.treg).toBe("off")
    expect(accepted.board).toEqual(board)

    state = proposeNext(accepted.state)
    const dismissed = resolveStep(state, board, STAND_IN_SCRIPT[1].id, "dismissed")
    expect(dismissed.state.log.at(-1)).toEqual({ stepId: "propose-reel", decision: "dismissed" })
    expect(dismissed.generation).toBeNull()
    expect(dismissed.board).toEqual(board)
    expect(dismissed.state.callsModel).toBe(false)
    expect(board.shots.every((shot) => shot.status === "waiting")).toBe(true)

    state = proposeNext(dismissed.state)
    const batched = resolveStep(state, board, STAND_IN_SCRIPT[2].id, "accepted")
    expect(batched.generation).toBeNull()
    expect(batched.board.shots.every((shot) => shot.status === "filled")).toBe(true)
    expect(batched.state.callsModel).toBe(false)
    expect(proposeNext(batched.state)).toEqual(batched.state)
  })

  test("dismiss and accept ignore steps that are not proposed", () => {
    const state = initialStandIn()
    const board = bundledStoryboard()
    const skipped = resolveStep(state, board, "propose-still", "accepted")
    expect(skipped.state).toEqual(state)
    expect(skipped.board).toEqual(board)
    expect(skipped.generation).toBeNull()
  })
})
