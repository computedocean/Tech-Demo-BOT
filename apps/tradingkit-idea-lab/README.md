# Idea lab

Single-user paper-research demo. Type a plain-English strategy idea, read generated Pine Script v6, and run a local backtest on bundled synthetic daily candles.

```sh
bun install
bun run dev
bun test
```

No API keys, OAuth, or extra system packages are required. `bun run dev` works with the offline parser alone.

An optional rewrite can run inside the Bun server when `OPENAI_API_KEY` or `TRADINGKIT_IDEA_LAB_LLM_KEY` is set in the server environment. Leave both empty. Do not prefix them with `VITE_`. See `.env.example`.

Send to TradingKit is off by default. The official connector is the user's own OAuth at [app.tradingkit.com/install](https://app.tradingkit.com/install). This demo does not place orders and does not store tokens.

Sample candles are original synthetic series dedicated under CC0. They are not a live TradingKit or broker feed. Figures are not TradingView or TradingKit engine parity, and they are not performance or advice.

This is an independent paper-research demo, not an official TradingKit product.

- https://tradingkit.com
- https://kb.tradingkit.com/backtests/pine-script/
- Bookmark: https://x.com/DaviddDotTech/status/2120084045220524318
