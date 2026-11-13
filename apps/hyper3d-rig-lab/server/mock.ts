import type { JobView } from "../shared/types.ts"

/** Visible submit/poll sequence. Short enough for a recording, long enough to read each state. */
export const MOCK_RIG_GENERATING_MS = 2_000
export const MOCK_PACKAGING_GENERATING_MS = 4_500
export const MOCK_DONE_MS = 6_500

export function mockJobViews(elapsedMs: number, rigUuid: string, packagingUuid: string): JobView[] {
  const rigStatus = elapsedMs < MOCK_RIG_GENERATING_MS ? "Waiting" : elapsedMs < MOCK_PACKAGING_GENERATING_MS ? "Generating" : "Done"
  const packagingStatus =
    elapsedMs < MOCK_PACKAGING_GENERATING_MS ? "Waiting" : elapsedMs < MOCK_DONE_MS ? "Generating" : "Done"
  const rig: JobView = { uuid: rigUuid, name: "rig", status: rigStatus }
  const packaging: JobView = { uuid: packagingUuid, name: "packaging", status: packagingStatus }
  if (rigStatus === "Waiting") rig.queue_length = 2
  if (packagingStatus === "Waiting") packaging.queue_length = 1
  return [rig, packaging]
}

export function mockReady(elapsedMs: number): boolean {
  return elapsedMs >= MOCK_DONE_MS
}
