import {
  DISCLOSURE,
  MOCK_BADGE,
  modelsFor,
  presetsFor,
  sampleFor,
  type SampleAsset,
  type StudioKind,
} from "./samples"

export type GenerateRequest = {
  kind: StudioKind
  modelName: string
  prompt: string
}

export type GenerateResult = {
  ok: true
  mode: "mock"
  badge: typeof MOCK_BADGE
  disclosure: string
  asset: SampleAsset
  prompt: string
  modelName: string
  usedKey: false
  treg: "off"
}

export function generateMock(input: GenerateRequest): GenerateResult {
  const models = modelsFor(input.kind)
  const known = models.some((model) => model.name === input.modelName)
  const prompt = input.prompt.trim() || presetsFor(input.kind)[0].prompt

  return {
    ok: true,
    mode: "mock",
    badge: MOCK_BADGE,
    disclosure: DISCLOSURE,
    asset: sampleFor(input.kind),
    prompt,
    modelName: known ? input.modelName : models[0].name,
    usedKey: false,
    treg: "off",
  }
}
