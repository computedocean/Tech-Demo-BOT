# agent-lens-desk

## Goal
Ship a single-user Bun + Vite React paper-research desk that turns each closed candle into an `ai-agent-lens/v1` JSON packet, shows that packet beside a candlestick chart, and produces a LONG / SHORT / WAIT verdict with entry, stop, take-profits, and failure risk — focusing on the **candle → agent-readable JSON → verdict** loop, fully usable with no keys and no TradingView account.

## Reality check
Verified 2026-11-19 from [roan-maverick/tradingview-indicator-for-ai-agents](https://github.com/roan-maverick/tradingview-indicator-for-ai-agents). GitHub SPDX and the repo `LICENSE` file are **MIT**. This is **AI Agent Lens**: a Pine Script v6 TradingView indicator that, on each **closed** candle (no repainting), builds a structured JSON packet and can send it to an agent webhook. Official schema name: **`ai-agent-lens/v1`**. Docs: [docs/PACKET_SCHEMA.md](https://github.com/roan-maverick/tradingview-indicator-for-ai-agents/blob/main/docs/PACKET_SCHEMA.md), example: [examples/sample_packet.json](https://github.com/roan-maverick/tradingview-indicator-for-ai-agents/blob/main/examples/sample_packet.json). Long and short scores are 0–100 (five factors, 20 points each); a setup fires when a score crosses 70 on a closed candle and the regime does not point the other way. A webhook alert to a live agent needs a **paid TradingView plan**; this demo must not require that.

**How this differs from TradingKit** (`apps/tradingkit-idea-lab`). TradingKit is idea → Pine Script → local backtest. This desk is **not** a strategy generator or equity-curve lab. The product to demonstrate is the packet loop: closed candle in, `ai-agent-lens/v1` JSON out, verdict beside the chart.

**Why a TypeScript port plus fixtures.** The official indicator is Pine on TradingView. Cloud agents, CI, and screenshot/video capture cannot assume a TradingView login or webhook plan. Port the documented scoring and packet fields into TypeScript and drive them from **bundled sample OHLCV**. A local `/webhook` can accept or replay TradingView alert bodies when someone has one, but `bun install && bun run dev` must be complete without it.

## Single-user MVP
- Scaffold with `bunx create-vite` (React + TypeScript). Add `bunfig.toml` with `[install]` and `minimumReleaseAge = 259200` **before** any install, then `bun install`.
- Init shadcn/ui with a minimalist preset (Nova or the closest available preset).
- Add a `.gitignore` covering `node_modules`, `dist`, `.vite`, `.env`, and `.env.local`. If an optional LLM path exists, commit `.env.example` with empty names only (no values).
- One-page paper desk:
  1. A **candlestick chart** on **bundled sample OHLCV** (at least one clearly labeled SAMPLE series; ETH- or BTC-like is fine). Optional **live public BTC/ETH candles** (a free public endpoint, **no API keys**) may be offered as a toggle, **off by default**. If live fetch fails, stay on bundled samples. Disclose sample vs live public data; figures are not live performance or advice.
  2. A **TypeScript port** of the Lens scoring walks closed candles and emits **`ai-agent-lens/v1` packets** (`schema` must be `"ai-agent-lens/v1"`). Show the current packet (pretty JSON) **beside the chart**. Cover the documented core: candle breakdown and last N recent candles, regime, trend (EMA stack), momentum, strength, volatility, volume, structure, levels as available from the series, long/short scores with factor breakdowns, and trade/setup fields when a setup is active. Follow the published field names and enums closely; do not invent a private schema. Cite PACKET_SCHEMA.md. It is acceptable to note any documented field that cannot be computed from a single bundled timeframe (e.g. some HTF/previous-day values) as `null` with a short disclosure — do not silently fake them.
  3. A local Bun **`/webhook`** endpoint that **accepts** a TradingView-style alert body (plain JSON, `schema: "ai-agent-lens/v1"`) and can **replay** a bundled sample packet or history (include or adapt the upstream MIT `examples/sample_packet.json`). Invalid or wrong-schema bodies fail clearly. The desk stays fully usable when nothing is posted to `/webhook`.
  4. A **verdict panel**: **LONG**, **SHORT**, or **WAIT**, plus entry, stop, take-profit levels (1.5R / 3R or the packet’s `trade` targets), and a short **failure-risk** note. **Mock rules are the default** (deterministic, based on scores, regime, and threshold — no model). Optional **server-side only** LLM rewrite of the verdict is **off by default** (env key, never `VITE_*`, never in the client or responses). If no key is set, the mock verdict still runs.
  5. Controls to step or play through closed candles on the sample series so packets and verdicts update per bar. Paper research only: **no order placement**, no broker webhooks that could trade.
  6. Footer: independent demo, **not financial advice**, **no orders**, **not affiliated** with the upstream project or TradingView. Attribute **AI Agent Lens / tradingview-indicator-for-ai-agents, MIT**, and link https://github.com/roan-maverick/tradingview-indicator-for-ai-agents.
- Vendor bundled OHLCV that is original, clearly labeled sample/synthetic, or permissively licensed, with the license/source noted in the app.
- `bun install && bun run dev` from `apps/agent-lens-desk/` must run with **no secrets**, no TradingView account, and no extra system deps. Self-contained `package.json`; no monorepo workspace dependencies.
- **Tests (required):** `bun test` covering at least: (a) scoring on bundled candles emits packets with `schema: "ai-agent-lens/v1"` and required top-level fields; (b) scores stay in 0–100 and factor keys match the documented set; (c) `/webhook` (or its handler) accepts a valid sample packet and rejects a wrong schema; (d) mock verdict returns LONG, SHORT, or WAIT with entry/stop/TPs (or a clear WAIT without levels) and a failure-risk note, with no LLM key; (e) no API keys appear in client bundles or default responses, and the optional LLM path is off by default.
- **Validation:** Playwright captures **at least one screenshot** of the running UI, and the PR also includes **at least one video** (under 15 MB) of stepping or playing closed candles, the packet updating beside the chart, and the verdict panel (LONG/SHORT/WAIT with levels). Optionally show a webhook replay of the sample packet. Attach both to **exactly one PR**. Do not commit large videos. **Do not merge the PR.**

## Explicitly out of scope
- Live broker or exchange order placement, or alert webhooks that could trade.
- Requiring a TradingView account, paid webhook plan, or any API key for `bun run dev`.
- A Pine-to-backtest equity lab, strategy idea generator, or overlap with TradingKit’s MVP.
- Claiming exact numeric parity with every TradingView Pine tick in all markets; the port should follow the published schema and scoring rules on bundled data, and disclose approximation where the feed is incomplete.
- Implying official affiliation with the upstream project or TradingView.
- Auth, routing, deploy, a new GitHub repo, or changes outside `apps/agent-lens-desk/`.
- Shared monorepo workspace deps. Merging the PR.

## Outcome-oriented tasks
1. Scaffold Vite React-TS under `apps/agent-lens-desk/`, add `bunfig.toml` and `.gitignore`, install with Bun, init shadcn, and vendor sample OHLCV plus a sample `ai-agent-lens/v1` packet (note licenses).
2. Port closed-candle scoring and packet assembly to TypeScript; render the chart with the live packet JSON beside it; add step/play through bars.
3. Add the local `/webhook` accept/replay path, the mock LONG/SHORT/WAIT verdict panel (entry/stop/TPs, failure risk), and the MIT / paper-research footer.
4. Write `bun test` coverage for packet schema, scores, webhook accept/reject, mock verdict, and “no key / LLM off by default.”
5. Add Playwright screenshot capture of the running app, record a short video (under 15 MB), and open exactly one PR with both artifacts attached. Do not merge.

## Stack
- **Bun** — runtime, package manager, scripts, tests, and the local `/webhook` server (repo rule).
- **Vite + React + TypeScript** — official one-screen scaffold; packet and score logic in TypeScript, not a Pine runtime.
- **shadcn/ui + Tailwind** — chart pane, packet JSON, verdict card, and step/play controls.
- **A small chart** (SVG/canvas or a boring MIT chart lib such as `lightweight-charts` if it installs cleanly) — candlesticks only; not a full trading terminal.
- **Playwright** — screenshot validation of the running UI (plus a manually or script-recorded video attached to the PR).

## Secrets
None required. Optional server-only LLM key, if implemented, stays in the server environment, is off by default, and is never required. Do not commit tokens. Live public candles, if added, must use a no-key public endpoint.

## License limits
Upstream is MIT. Attribute AI Agent Lens / `tradingview-indicator-for-ai-agents` and link the repo (and LICENSE). You may adapt the published schema, sample packet, and documented scoring rules with attribution. Do not copy TradingView brand UI, and do not imply official affiliation. This lab is an independent paper-research demo, not financial advice, and it does not place orders.

## Deferred
- A full Pine interpreter, multi-symbol scanner, and hosted tunnel for live TradingView alerts — not needed to prove the packet loop on bundled candles.
- Optional live public BTC/ETH is already in MVP as a non-default toggle; do not block the PR on it if the bundled path is solid.
- Cloudflare Pages preview wiring — optional later.

## Source
Bookmark: https://x.com/foodloss_otoko/status/2121632355555397802  
Repo: https://github.com/roan-maverick/tradingview-indicator-for-ai-agents (MIT)
