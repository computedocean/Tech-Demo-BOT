# Agent Lens desk

A single-user paper desk for the closed-candle loop: candlestick, `ai-agent-lens/v1` JSON, and a LONG / SHORT / WAIT verdict.

This is an independent demo. It is not financial advice, it does not place orders, and it is not affiliated with [AI Agent Lens](https://github.com/roan-maverick/tradingview-indicator-for-ai-agents) or TradingView. The scoring rules and the bundled sample packet are adapted from that MIT project.

## Run

```bash
bun install
bun run dev
```

No API key, TradingView account, or extra system package is required. Open the printed local URL.

`SAMPLE BTC` and `SAMPLE ETH` are original synthetic 1h series. Step or play closed bars. The packet beside the chart and the verdict panel both follow the selected close. Live public BTC/ETH candles are off until you turn the switch on. If that fetch fails, the desk stays on the sample.

`POST /webhook` accepts a JSON body whose `schema` is `ai-agent-lens/v1` and rejects anything else. `POST /webhook/replay` returns the bundled upstream example. The chart works if you never post.

An optional server rewrite of the failure-risk sentence reads `AGENT_LENS_LLM_KEY` only on the server. It is off when the variable is unset. See `.env.example`.

## Test

```bash
bun test
```

## Attribution

AI Agent Lens / tradingview-indicator-for-ai-agents, MIT  
https://github.com/roan-maverick/tradingview-indicator-for-ai-agents
