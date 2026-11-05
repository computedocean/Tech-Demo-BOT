# Kronos candle forecast — plan

**Goal:** Load OHLCV candles, ask the open-source Kronos-small model for the next N bars, and check it honestly against a naive "tomorrow = today" baseline.

## Single-user MVP
- Bundled BTC-USD daily sample CSV + CSV upload (`timestamps,open,high,low,close[,volume]`).
- Candlestick chart with forecast bars drawn in a distinct (hollow/purple) style.
- Horizon slider (1–60 bars).
- Backtest mode: hide the last N real bars, forecast them, score MAE on close vs the naive baseline.
- Local Python helper running Kronos-small on CPU.

**Out:** auth, multiple assets, live data feeds, fine-tuning, GPU, deployment, persistence.

## Tasks (vertical slices)
1. Sample data on a chart: download real BTC daily data, Vite app renders candles.
2. Forecast: FastAPI `/forecast` wraps `KronosPredictor.predict`; UI draws predicted bars + horizon slider.
3. Upload: parse a user CSV client-side and chart it.
4. Backtest: hide last N, forecast, compute MAE (Kronos vs naive), show a score card.
5. One-command start (`./start.sh`), README, screenshot + video.

## Stack
- **Bun + Vite react-ts** — official scaffold, one screen, no framework needed.
- **shadcn/ui (neutral, minimal)** — prebuilt accessible controls.
- **lightweight-charts** — purpose-built, tiny candlestick library.
- **FastAPI + uv** — smallest way to expose the PyTorch model locally.
- **Kronos (upstream repo, pinned commit)** — not on PyPI, so `setup` clones it into `server/vendor/`.

## Deferred
- Probabilistic bands (sample_count > 1) — slower on CPU; single path first.
- Multiple-window backtests / more metrics — one window is enough to test the claim.
- Kronos-base/mini selector — small is the README default.
