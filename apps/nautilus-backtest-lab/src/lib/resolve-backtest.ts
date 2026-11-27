import { lookupRecorded, RECORDED_ENGINE } from "@/lib/catalog.ts"
import type { BacktestParams, BacktestSuccess } from "@/lib/types.ts"
import { isFiniteRun } from "@/lib/catalog.ts"

export type SidecarProbe = (params: BacktestParams) => Promise<unknown>

const SIDECAR_NOTE =
  "Live local NautilusTrader sidecar on the bundled synthetic bars. Paper research only. No exchange connection was opened and no order was sent."

const RECORDED_NOTE =
  "Recorded fallback. This is a saved NautilusTrader run on the synthetic sample bars. The sidecar did not run. The page is replaying that JSON fixture. It is not a TypeScript reimplementation of the Rust engine."

const NEAREST_NOTE =
  "Recorded fallback for the nearest saved parameter set. The sidecar did not run, and this exact set was not recorded. The page is replaying a JSON fixture. It is not a TypeScript reimplementation of the Rust engine."

export async function resolveBacktest(
  params: BacktestParams,
  probe: SidecarProbe,
): Promise<BacktestSuccess> {
  try {
    const sidecar = await probe(params)
    if (isFiniteRun(sidecar)) {
      return {
        ok: true,
        source: "sidecar",
        exact: true,
        requested: params,
        params: sidecar.params ?? params,
        engine: sidecar.engine || "nautilus_trader",
        note: SIDECAR_NOTE,
        stats: sidecar.stats,
        trades: sidecar.trades,
        equity: sidecar.equity,
        openPosition: sidecar.openPosition ?? null,
      }
    }
  } catch {
    // A failed sidecar is a signal to replay the recorded fixture.
  }
  const recorded = lookupRecorded(params)
  return {
    ok: true,
    source: "recorded",
    exact: recorded.exact,
    requested: params,
    params: recorded.params,
    engine: RECORDED_ENGINE,
    note: recorded.exact ? RECORDED_NOTE : NEAREST_NOTE,
    stats: recorded.stats,
    trades: recorded.trades,
    equity: recorded.equity,
    openPosition: recorded.openPosition,
  }
}
