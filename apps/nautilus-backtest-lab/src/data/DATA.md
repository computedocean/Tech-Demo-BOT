# Sample bars and recorded results

`sample-bars.json` and `recorded-runs.json` are original synthetic data made for this demo.

- License: CC0-1.0. The generator is `scripts/record_sample_fixtures.py`.
- The bars are not exchange history and are not copied from NautilusTrader's sample files.
- `recorded-runs.json` was produced by calling the installed NautilusTrader 1.231.0 `BacktestEngine` through `sidecar/backtest.py` on those bars.
- The TypeScript app replays that JSON when the sidecar cannot run. It does not reimplement the Rust engine.
- Figures are sample research output, not live performance and not financial advice.

NautilusTrader itself is LGPL-3.0 and is not vendored in this folder. https://github.com/nautechsystems/nautilus_trader
