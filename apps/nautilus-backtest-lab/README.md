# Nautilus backtest lab

Single-user paper-research lab. Pick bundled synthetic SAMPLE-ETH or SAMPLE-BTC bars, edit an EMA-cross and trailing-stop, and run a backtest. The page shows candles with entry and exit markers, an equity curve, and a stats card.

```sh
bun install
bun run dev
```

No API keys and no Python are required. If `python3` cannot import `nautilus_trader`, the dev server replays recorded JSON fixtures and the page says so.

Optional live sidecar (still local, still no exchange):

```sh
pip install nautilus_trader
# optional, when the package lives in another interpreter:
# NAUTILUS_LAB_PYTHON=/path/to/python bun run dev
```

`NAUTILUS_LAB_PYTHON` is only a path to an interpreter. It is not a credential.

NautilusTrader is an imported library under LGPL-3.0. This demo does not vendor its source. It is not an official Nautech Systems product, not financial advice, and it does not place orders.

- https://github.com/nautechsystems/nautilus_trader
- https://nautilustrader.io

Tests: `bun test`
