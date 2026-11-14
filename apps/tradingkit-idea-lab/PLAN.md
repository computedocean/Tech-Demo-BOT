# tradingkit-idea-lab

## Goal
Ship a single-user Bun + Vite React lab that turns a plain-English strategy idea into Pine Script v6 and a local backtest on bundled sample OHLC candles — equity curve, trade list, Sharpe, and max drawdown — with saved runs you can compare, fully offline, and with no order placement.

## Reality check
Verified 2026-11-14 from [tradingkit.com](https://tradingkit.com), the [install / connect guide](https://app.tradingkit.com/install), and the [Pine Script help article](https://kb.tradingkit.com/backtests/pine-script/).

**What it is.** TradingKit is a **commercial AI research workspace**, not an open-source library. You describe a trading idea in plain words; its AI writes a Pine Script v6 strategy, backtests it on real market data, and shows every trade. Official copy: test the idea before you trade it. Markets include 500+ Bybit USDT perpetuals plus 60 forex, metals, oil, stock, and ETF markets. Plans: Free ($0, 25 credits/day), Starter ($29.99/mo), Pro ($39.99/mo).

**Pine v6, documented subset.** TradingKit is **not TradingView**. Scripts should start with `//@version=6` and define a `strategy` (an indicator alone is not an executable strategy). The hosted engine supports a documented subset of Pine: no `request.security` (other symbols or timeframes), no arrays, maps, or matrices, and no `strategy.order` or order cancels. Unsupported constructs must fail explicitly, not be silently ignored. This demo’s generated Pine should stay inside that subset.

**MCP and auth.** Remote MCP is OAuth with the user’s own TradingKit account (Auth0). **No API key** is used for the official connector. Common URL: `https://app.tradingkit.com/mcp` (ChatGPT). Claude, Claude Code, Codex, Cursor, and OpenCode often use `https://app.tradingkit.com/mcp/pro`. “Pro” in the path does not grant a paid plan. Official docs: do not paste session tokens, API keys, or Auth0 secrets into chat. The Cursor install page publishes a shared public client ID that is **not a secret**; do not invent or commit any other credentials. An optional “Send to TradingKit” adapter in this app may target `https://app.tradingkit.com/mcp` behind the user’s OAuth, but it must be **off by default**. The demo must work fully without it.

**Orders.** TradingKit itself **never places orders and never holds money**. Official automation is alerts (Telegram, email, or a webhook you point at your own bot). This demo is **paper research only**: no alerts that fire live, no webhooks to brokers, no order placement.

**Why a local engine is required.** A cloud agent, CI, and screenshot/video capture cannot assume a TradingKit login, paid credits, or an LLM key. Do not scrape the hosted app or depend on its backtest API for `bun run dev`.

## Single-user MVP
- Scaffold with `bunx create-vite` (React + TypeScript). Add `bunfig.toml` with `[install]` and `minimumReleaseAge = 259200` **before** any install, then `bun install`.
- Init shadcn/ui with a minimalist preset (Nova or the closest available preset).
- Add a `.gitignore` covering `node_modules`, `dist`, `.vite`, `.env`, and `.env.local`. If an optional LLM path exists, commit `.env.example` with empty names only (no values).
- One-page idea lab:
  1. An idea field with a few **preset examples**, including “EMA 8/55 crossover on SPY daily”. The user can type in plain words.
  2. **Offline strategy generation** is the default and must work with no keys: a deterministic template/parser for common ideas (EMA/SMA crossovers, RSI thresholds, simple donchian/breakout if cheap). It emits `//@version=6` `strategy` Pine in TradingKit’s documented subset, plus a structured strategy object the local backtester can run. Unrecognized ideas fail clearly and suggest a supported pattern — they must not invent silent logic.
  3. An optional **server-side only** LLM rewrite, off unless an env key is set (for example `OPENAI_API_KEY` or a clearly named `TRADINGKIT_IDEA_LAB_LLM_KEY`). The Bun server is the only process that may read it. Never put the key in client code, `VITE_*` env, URLs, or responses. If no key is set, the UI may mention the optional path but generation still uses the offline parser.
  4. Show the generated **Pine Script v6 beside a local backtest** on **bundled sample OHLC** (at least one daily series labeled as a sample, e.g. SPY-like or a clearly synthetic “SAMPLE” series, plus maybe one other timeframe if cheap). Disclose that this is bundled sample data, not a live TradingKit or broker feed, and that figures are not live performance or advice.
  5. Backtest output: **equity curve**, **trade list** (entry/exit, side, PnL), **Sharpe**, and **max drawdown**, plus trade count and net return. Use a simple, documented local model (closed-candle signals, disclosed commission/slippage defaults). This is **not** a full Pine interpreter and must not claim TradingKit or TradingView engine parity.
  6. **Save runs** and **compare** at least two saved runs (metrics table and overlaid or side-by-side equity). Session persistence is enough; localStorage is optional.
  7. Optional **Send to TradingKit** control, **off by default**, that would call `https://app.tradingkit.com/mcp` only after the user enables it and completes **their own** OAuth. If disabled or unauthenticated, show a short “connect on tradingkit.com / app.tradingkit.com/install” note and keep the local lab fully usable. Never place orders through this adapter.
  8. Footer: this is an independent paper-research demo, **not an official TradingKit product**, not financial advice, and it does not place orders. Link https://tradingkit.com and the Pine help article.
- `bun install && bun run dev` from `apps/tradingkit-idea-lab/` must run with **no secrets**, no OAuth, and no extra system deps.
- **Tests (required):** `bun test` covering at least: (a) “EMA 8/55 crossover on SPY daily” (and 1–2 other presets) parse offline into valid-looking Pine v6 `strategy` source and a structured strategy; (b) unrecognized input fails clearly; (c) the local backtest on bundled candles returns a finite equity curve, trade list, Sharpe, and max drawdown; (d) saved runs can be compared; (e) generated Pine stays within the documented subset (no `request.security`, arrays/maps/matrices, or `strategy.order`); (f) no API keys or OAuth tokens appear in client bundles or default responses; (g) the TradingKit adapter is off by default and is not required for a complete run.
- **Validation:** Playwright captures **at least one screenshot** of the running UI, and the PR also includes **at least one video** (under 15 MB) of typing or selecting an idea, showing Pine beside the backtest (curve, trades, Sharpe, max drawdown), and saving/comparing a run. Attach both to **exactly one PR**. Do not commit large videos. **Do not merge the PR.**

## Explicitly out of scope
- Live broker or exchange order placement, funded accounts, or alert webhooks that could trade.
- Scraping TradingKit’s hosted app, using someone else’s account, or committing OAuth tokens or client secrets (the published Cursor public client ID is not required for MVP).
- Claiming TradingView or TradingKit engine parity, or a complete Pine interpreter.
- Requiring an LLM key or a TradingKit login for `bun run dev`.
- Implying official TradingKit affiliation, or copying their brand UI or marketing performance figures.
- Auth, routing, deploy, a new GitHub repo, or changes outside `apps/tradingkit-idea-lab/`.
- Shared monorepo workspace deps. Merging the PR.

## Outcome-oriented tasks
1. Scaffold Vite React-TS under `apps/tradingkit-idea-lab/`, add `bunfig.toml` and `.gitignore`, install with Bun, init shadcn, and vendor bundled sample OHLC with a license/source note.
2. Build the offline idea parser/templates and the local backtester (equity, trades, Sharpe, max drawdown); render Pine beside the results.
3. Add save/compare, the optional disabled-by-default TradingKit adapter stub or gated OAuth path, and the paper-research disclaimer.
4. Write `bun test` coverage for parsing, subset constraints, backtest metrics, compare, and “no key / adapter off by default.”
5. Add Playwright screenshot capture of the running app, record a short video (under 15 MB), and open exactly one PR with both artifacts attached. Do not merge.

## Stack
- **Bun** — runtime, package manager, scripts, and tests (repo rule).
- **Vite + React + TypeScript** — official one-screen scaffold; no Next and no TradingKit runtime.
- **shadcn/ui + Tailwind** — idea field, Pine pane, metrics, trade table, and compare view.
- **A small local chart** (e.g. a lightweight SVG/canvas or a boring MIT chart lib such as `lightweight-charts` if it installs cleanly) — equity curve only; do not pull a full trading terminal.
- **Playwright** — screenshot validation of the running UI (plus a manually or script-recorded video attached to the PR).

## Secrets
None required. Optional server-only LLM key, if implemented, stays in the server environment and is never required. TradingKit MCP uses the user’s own OAuth and is off by default; do not commit tokens.

## License limits
TradingKit is a commercial product. Do not copy substantial site copy, marketing charts, or brand UI. Do not claim the product is open source. Attribute the idea and link the site and docs. Bundled candles must be original, clearly labeled sample/synthetic, or permissively licensed public data with the license noted in the app. This lab is an independent paper-research demo, not official TradingKit, and not financial advice.

## Deferred
- Walk-forward optimisation, Incubator forward tests, and live alerts — not needed to prove idea → Pine → local backtest.
- A full Pine v6 interpreter — templates plus a structured local engine are enough for MVP.
- Cloudflare Pages preview wiring — optional later.

## Source
Bookmark: https://x.com/DaviddDotTech/status/2120084045220524318  
Site: https://tradingkit.com  
Install: https://app.tradingkit.com/install  
MCP: https://app.tradingkit.com/mcp  
Pine docs: https://kb.tradingkit.com/backtests/pine-script/
