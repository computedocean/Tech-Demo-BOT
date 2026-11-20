import { validateParams } from "@/lib/params.ts"
import { resolveBacktest } from "@/lib/resolve-backtest.ts"
import { tryNautilusSidecar } from "@/server/sidecar.ts"
import type { BacktestResponse } from "@/lib/types.ts"

export async function handleBacktest(raw: string): Promise<BacktestResponse> {
  if (raw.length > 10_000) {
    return { ok: false, error: "Request is too large." }
  }
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return { ok: false, error: "Invalid JSON." }
  }
  const validated = validateParams(parsed)
  if (!validated.ok) return validated
  return resolveBacktest(validated.params, tryNautilusSidecar)
}
