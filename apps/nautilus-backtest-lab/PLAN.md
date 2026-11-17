# nautilus-backtest-lab

## Goal
Ship a single-user Bun + Vite React lab that runs an EMA-crossover plus trailing-stop backtest on bundled sample ETH/BTC bars, shows a candlestick chart with entry/exit markers, an equity curve, and a stats card, and uses a small Python sidecar to run a **real NautilusTrader** backtest when it is available — with a recorded-result fallback so `bun install && bun run dev` always works, and with no exchange keys.

## Reality check
Verified 2026-11-17 from [nautechsystems/nautilus_trader](https://github.com/nautechsystems/nautilus_trader). GitHub SPDX and the repo `LICENSE` file are **LGPL-3.0**. Homepage: [nautilustrader.io](https://nautilustrader.io). Production-grade **Rust-native** event-driven trading engine with a **Python API** for strategies and backtests. This demo is **paper research only**: it must not place live orders or talk to an exchange.

**Why a sidecar plus a recorded fallback.** Nautilus is not a Bun/TypeScript library. A tiny Python sidecar (importing the installed `nautilus_trader` package) is the honest way to show a real engine run. Cloud agents, CI, and screenshot/video capture cannot assume Python, a Nautilus install, or system build deps. Therefore the UI **must** load bundled, pre-recorded backtest results (JSON fixtures generated from the same strategy and sample bars) whenever the sidecar is missing or fails. `bun install && bun run dev` is complete without Python.

**LGPL limits.** Use Nautilus as a dynamically imported library in the sidecar only. **Do not vendor, fork, or copy** Nautilus source into this app. Attribute LGPL-3.0 and link the repo. This lab is not an official Nautech Systems product.

## Single-user MVP
- Scaffold with `bunx create-vite` (React + TypeScript). Add `bunfig.toml` with `[install]` and `minimumReleaseAge = 259200` **before** any install, then `bun install`.
- Init shadcn/ui with a minimalist preset (Nova or the closest available preset).
- Add a `.gitignore` covering `node_modules`, `dist`, `.vite`, `.env`, `.env.local`, and Python leftovers (`__pycache__/`, `.venv/`). No secrets are required; do not add exchange API env vars.
- Vendor **bundled sample ETH and BTC OHLC bars** that are original, clearly labeled sample/synthetic, or permissively licensed, with the license/source noted in the app. No live market data and **no exchange keys**.
- One-page backtest lab:
  1. Choose ETH or BTC (sample series) and edit **EMA-cross** parameters (fast/slow periods) plus a **trailing-stop** parameter (e.g. trail percent or ATR multiple). A Run control starts the backtest.
  2. Prefer the **Python sidecar** when `python` (or `python3`) and `nautilus_trader` are importable: the sidecar runs a real Nautilus backtest on the bundled bars and returns trades, equity, and stats as JSON. Keep the sidecar small and local (stdio or a loopback POST). It must never call an exchange.
  3. If the sidecar is absent or errors, **automatically** use **recorded-result fixtures** for the default (and, if cheap, nearby) parameter sets. The UI still shows candles, markers, equity, and stats. Disclose clearly whether the run is a live Nautilus sidecar result or a recorded fallback.
  4. Visuals: a **candlestick chart** of the sample series with **entry/exit markers**, an **equity curve**, and a **stats card** (at least trade count, net return, max drawdown, and a Sharpe or equivalent). Figures are not live performance or advice.
  5. Footer: independent paper-research demo, **not an official Nautech / NautilusTrader product**, not financial advice, no orders. Attribute **NautilusTrader, LGPL-3.0**, and link https://github.com/nautechsystems/nautilus_trader and https://nautilustrader.io.
- `bun install && bun run dev` from `apps/nautilus-backtest-lab/` must run with **no secrets**, **no Python**, and no extra system deps (fallback path).
- **Tests (required):** `bun test` covering at least: (a) default EMA-cross + trailing-stop params produce a finite fixture result with trades, equity points, and stats; (b) edited params are validated (reject empty/invalid) and still render via fallback when no sidecar is present; (c) the UI/data layer can distinguish sidecar vs recorded fallback; (d) no exchange keys or API secrets appear in client bundles, default env, or fixtures.
- **Validation:** Playwright captures **at least one screenshot** of the running UI, and the PR also includes **at least one video** (under 15 MB) of selecting a sample series, editing a parameter, running the backtest (fallback is fine), and showing candles with markers, the equity curve, and the stats card. Attach both to **exactly one PR**. Do not commit large videos. **Do not merge the PR.**

## Explicitly out of scope
- Live or paper exchange connectivity, order placement, or any exchange/API keys.
- Vendoring NautilusTrader source, or claiming engine-parity for the TypeScript fallback (the fallback is recorded output, not a reimplementation of the Rust engine).
- A full strategy IDE, portfolio of many strategies, or walk-forward optimization.
- Implying official affiliation with Nautech Systems.
- Auth, routing, deploy, a new GitHub repo, or changes outside `apps/nautilus-backtest-lab/`.
- Shared monorepo workspace deps. Merging the PR.

## Outcome-oriented tasks
1. Scaffold Vite React-TS under `apps/nautilus-backtest-lab/`, add `bunfig.toml` and `.gitignore`, install with Bun, init shadcn, and vendor sample ETH/BTC bars plus recorded backtest JSON (note licenses).
2. Build the param controls, candlestick + marker chart, equity curve, and stats card on the fallback fixtures.
3. Add a small Python sidecar that runs a NautilusTrader backtest on the bundled bars when the package is installed; wire automatic fallback.
4. Write `bun test` coverage for fixtures, param validation, fallback vs sidecar signaling, and “no exchange keys.”
5. Add Playwright screenshot capture of the running app, record a short video (under 15 MB), and open exactly one PR with both artifacts attached. Do not merge.

## Stack
- **Bun** — runtime, package manager, scripts, and tests (repo rule).
- **Vite + React + TypeScript** — official one-screen scaffold.
- **shadcn/ui + Tailwind** — symbol toggle, param fields, stats card, and run/fallback badge.
- **A small chart** (SVG/canvas or a boring MIT chart lib such as `lightweight-charts` if it installs cleanly) — candlesticks, trade markers, and equity.
- **Optional Python sidecar** — `nautilus_trader` only when present; never required for `bun run dev`.
- **Playwright** — screenshot validation of the running UI (plus a manually or script-recorded video attached to the PR).

## Secrets
None. Do not add or request exchange API keys.

## License limits
NautilusTrader is LGPL-3.0. Link the repo and license, and use it only as a replaceable imported library in the sidecar. Do not copy substantial upstream source or brand UI. Bundled bars and recorded results must be original, clearly labeled sample/synthetic, or permissively licensed. This lab is an independent paper-research demo, not official NautilusTrader, and not financial advice.

## Deferred
- Additional strategies, live data catalogs, and walk-forward reports — not needed to prove sidecar-or-fallback EMA + trailing stop.
- Packaging a Python venv in CI — optional later; fallback already unblocks the PR.
- Cloudflare Pages preview wiring — optional later.

## Source
Bookmark: https://x.com/quantscience_/status/2122317784902234136  
Repo: https://github.com/nautechsystems/nautilus_trader (LGPL-3.0)  
Site: https://nautilustrader.io
