import { presetsFor, sampleFor, type SampleAsset, type StudioKind } from "./samples"

export type ShotStatus = "waiting" | "filled"

export type Shot = {
  id: string
  index: number
  title: string
  kind: StudioKind
  prompt: string
  status: ShotStatus
  assetId: string | null
}

export type CinemaBoard = {
  id: string
  title: string
  shots: Shot[]
}

const STORY_SHOTS: Omit<Shot, "prompt" | "status" | "assetId">[] = [
  { id: "shot-still", index: 1, title: "Establishing still", kind: "image" },
  { id: "shot-reel", index: 2, title: "Push-in reel", kind: "video" },
  { id: "shot-tone", index: 3, title: "Room tone", kind: "audio" },
]

export function bundledStoryboard(): CinemaBoard {
  return {
    id: "harbor-dusk",
    title: "Harbor dusk",
    shots: STORY_SHOTS.map((shot) => ({
      ...shot,
      prompt: presetsFor(shot.kind)[0].prompt,
      status: "waiting",
      assetId: null,
    })),
  }
}

export function batchFill(board: CinemaBoard): CinemaBoard {
  return {
    ...board,
    shots: board.shots.map((shot) => ({
      ...shot,
      status: "filled",
      assetId: sampleFor(shot.kind).id,
    })),
  }
}

export function assetForShot(shot: Shot): SampleAsset | null {
  if (shot.status !== "filled" || shot.assetId == null) return null
  const asset = sampleFor(shot.kind)
  return asset.id === shot.assetId ? asset : null
}
