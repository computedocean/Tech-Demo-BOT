"""Local paper-research sidecar.

Imports the installed ``nautilus_trader`` package and runs one EMA-cross plus
trailing-stop backtest on bars supplied by the caller. NautilusTrader stays an
imported library (LGPL-3.0); this file does not vendor upstream source.

The process refuses outbound network connections. It never reads exchange
credentials and never places live orders.
"""

from __future__ import annotations

import json
import math
import socket
import sys
import warnings
from datetime import UTC, datetime
from decimal import Decimal

STARTING_EQUITY = 10_000.0
FEE_RATE = Decimal("0.0004")


class MissingNautilus(RuntimeError):
    pass


_GUARD_INSTALLED = False


def _blocked(*_args, **_kwargs):
    raise RuntimeError("paper-research sidecar blocked a network connection")


def install_network_guard() -> None:
    """Refuse outbound sockets for the rest of this process."""
    global _GUARD_INSTALLED
    if _GUARD_INSTALLED:
        return
    socket.create_connection = _blocked
    socket.getaddrinfo = _blocked

    class _BlockedSocket(socket.socket):
        def connect(self, address):  # type: ignore[override]
            _blocked(address)

        def connect_ex(self, address):  # type: ignore[override]
            _blocked(address)

    socket.socket = _BlockedSocket
    _GUARD_INSTALLED = True


def run_request(payload: dict) -> dict:
    """Run one backtest. Raises MissingNautilus when the library is absent."""
    warnings.filterwarnings("ignore")
    install_network_guard()
    try:
        import nautilus_trader
        from nautilus_trader.backtest.engine import BacktestEngine
        from nautilus_trader.backtest.models import MakerTakerFeeModel
        from nautilus_trader.common.config import LoggingConfig
        from nautilus_trader.config import BacktestEngineConfig
        from nautilus_trader.core.datetime import dt_to_unix_nanos
        from nautilus_trader.indicators import ExponentialMovingAverage
        from nautilus_trader.model import Bar, BarType
        from nautilus_trader.model.currencies import BTC, ETH, USDT
        from nautilus_trader.model.enums import (
            AccountType,
            OmsType,
            OrderSide,
            TimeInForce,
            TrailingOffsetType,
            TriggerType,
        )
        from nautilus_trader.model.events import OrderFilled, PositionClosed
        from nautilus_trader.model.identifiers import InstrumentId, Symbol, TraderId, Venue
        from nautilus_trader.model.instruments import CurrencyPair
        from nautilus_trader.model.objects import Money, Price, Quantity
        from nautilus_trader.trading.config import StrategyConfig
        from nautilus_trader.trading.strategy import Strategy
    except ImportError as exc:
        raise MissingNautilus("nautilus_trader is not importable") from exc

    symbol = str(payload.get("symbol", "")).upper()
    specs = {
        "ETH": {
            "base": ETH,
            "code": "ETH",
            "instrument": "ETHUSD",
            "size_precision": 4,
            "size_increment": "0.0001",
        },
        "BTC": {
            "base": BTC,
            "code": "BTC",
            "instrument": "BTCUSD",
            "size_precision": 5,
            "size_increment": "0.00001",
        },
    }
    if symbol not in specs:
        raise ValueError("symbol must be ETH or BTC")
    spec = specs[symbol]
    fast = int(payload["fast"])
    slow = int(payload["slow"])
    trail_pct = float(payload["trailPct"])
    if fast < 2 or slow < 3 or fast >= slow:
        raise ValueError("fast EMA must be an integer >= 2 and less than slow EMA")
    if not math.isfinite(trail_pct) or trail_pct <= 0 or trail_pct > 50:
        raise ValueError("trail percent must be a finite number between 0 and 50")
    raw_bars = payload.get("bars")
    if not isinstance(raw_bars, list) or len(raw_bars) < slow + 2:
        raise ValueError("bars are missing or shorter than the slow EMA")

    class EmaTrailConfig(StrategyConfig, frozen=True):
        instrument_id: InstrumentId
        bar_type: BarType
        fast_period: int
        slow_period: int
        trail_bps: int
        base_code: str

    class EmaTrail(Strategy):
        """Long-only EMA cross with a reduce-only trailing stop. Original to this demo."""

        def __init__(self, config: EmaTrailConfig) -> None:
            super().__init__(config)
            self.fast_ema = ExponentialMovingAverage(config.fast_period)
            self.slow_ema = ExponentialMovingAverage(config.slow_period)
            self._prev_above: bool | None = None
            self._instrument = None
            self._exit_reason: str | None = None
            self._open_entry: dict | None = None
            self.equity: list[float] = []
            self.trades: list[dict] = []

        def on_start(self) -> None:
            self._instrument = self.cache.instrument(self.config.instrument_id)
            if self._instrument is None:
                self.log.error("instrument missing from cache")
                self.stop()
                return
            self.register_indicator_for_bars(self.config.bar_type, self.fast_ema)
            self.register_indicator_for_bars(self.config.bar_type, self.slow_ema)
            self.subscribe_bars(self.config.bar_type)

        def on_bar(self, bar: Bar) -> None:
            self._mark(bar)
            if not self.indicators_initialized():
                return
            above = self.fast_ema.value > self.slow_ema.value
            instrument_id = self.config.instrument_id
            if self._prev_above is not None:
                crossed_up = above and not self._prev_above
                crossed_down = (not above) and self._prev_above
                if crossed_up and self.portfolio.is_flat(instrument_id):
                    self._buy(bar)
                elif crossed_down and self.portfolio.is_net_long(instrument_id):
                    self._exit_reason = "cross"
                    self.cancel_all_orders(instrument_id)
                    self.close_all_positions(instrument_id)
            self._prev_above = above

        def _buy(self, bar: Bar) -> None:
            account = self.portfolio.account(self.config.instrument_id.venue)
            balance = account.balance_total(USDT)
            price = bar.close.as_double()
            if price <= 0 or balance is None:
                return
            qty = float(balance.as_decimal()) * 0.95 / price
            order = self.order_factory.market(
                instrument_id=self.config.instrument_id,
                order_side=OrderSide.BUY,
                quantity=self._instrument.make_qty(qty),
                time_in_force=TimeInForce.IOC,
            )
            self.submit_order(order)

        def on_event(self, event) -> None:
            if isinstance(event, OrderFilled) and event.order_side == OrderSide.BUY:
                if not self.portfolio.is_net_long(self.config.instrument_id):
                    return
                if self.cache.orders_open(instrument_id=self.config.instrument_id):
                    return
                self._open_entry = {
                    "entryTime": _ns_to_date(int(event.ts_event)),
                    "entryPrice": round(float(event.last_px), 2),
                }
                trail = self.order_factory.trailing_stop_market(
                    instrument_id=self.config.instrument_id,
                    order_side=OrderSide.SELL,
                    quantity=event.last_qty,
                    trailing_offset=Decimal(self.config.trail_bps),
                    trailing_offset_type=TrailingOffsetType.BASIS_POINTS,
                    trigger_type=TriggerType.LAST_PRICE,
                    time_in_force=TimeInForce.GTC,
                    reduce_only=True,
                )
                self.submit_order(trail)
            elif isinstance(event, PositionClosed):
                reason = self._exit_reason or "trail"
                self._exit_reason = None
                self._open_entry = None
                realized = float(event.realized_return)
                self.trades.append(
                    {
                        "side": "long",
                        "entryTime": _ns_to_date(int(event.ts_opened)),
                        "exitTime": _ns_to_date(int(event.ts_closed)),
                        "entryPrice": round(float(event.avg_px_open), 2),
                        "exitPrice": round(float(event.avg_px_close), 2),
                        "pnlQuote": round(float(event.realized_pnl.as_decimal()), 2),
                        "pnlPct": round(realized, 6),
                        "exitReason": reason,
                    }
                )

        def _mark(self, bar: Bar) -> None:
            account = self.portfolio.account(self.config.instrument_id.venue)
            if account is None:
                return
            quote = account.balance_total(USDT)
            base = account.balance_total(BASES[self.config.base_code])
            equity = float(quote.as_decimal()) if quote is not None else 0.0
            if base is not None:
                equity += float(base.as_decimal()) * bar.close.as_double()
            self.equity.append(round(equity, 2))

    BASES = {"ETH": ETH, "BTC": BTC}
    venue = Venue("SIM")
    instrument = CurrencyPair(
        instrument_id=InstrumentId(Symbol(spec["instrument"]), venue),
        raw_symbol=Symbol(spec["instrument"]),
        base_currency=spec["base"],
        quote_currency=USDT,
        price_precision=2,
        size_precision=spec["size_precision"],
        price_increment=Price.from_str("0.01"),
        size_increment=Quantity.from_str(spec["size_increment"]),
        lot_size=None,
        max_quantity=Quantity.from_str("100000"),
        min_quantity=Quantity.from_str(spec["size_increment"]),
        max_notional=None,
        min_notional=Money(1, USDT),
        max_price=Price.from_str("10000000"),
        min_price=Price.from_str("0.01"),
        margin_init=Decimal(0),
        margin_maint=Decimal(0),
        maker_fee=FEE_RATE,
        taker_fee=FEE_RATE,
        ts_event=0,
        ts_init=0,
    )
    bar_type = BarType.from_str(f"{instrument.id}-1-DAY-LAST-EXTERNAL")
    precision = spec["size_precision"]
    nautilus_bars: list[Bar] = []
    for bar in raw_bars:
        ts = dt_to_unix_nanos(datetime.fromisoformat(str(bar["time"])).replace(tzinfo=UTC))
        nautilus_bars.append(
            Bar(
                bar_type=bar_type,
                open=Price.from_str(f"{float(bar['open']):.2f}"),
                high=Price.from_str(f"{float(bar['high']):.2f}"),
                low=Price.from_str(f"{float(bar['low']):.2f}"),
                close=Price.from_str(f"{float(bar['close']):.2f}"),
                volume=Quantity.from_str(f"{float(bar['volume']):.{precision}f}"),
                ts_event=ts,
                ts_init=ts,
            )
        )

    engine = BacktestEngine(
        config=BacktestEngineConfig(
            trader_id=TraderId("BACKTESTER-001"),
            logging=LoggingConfig(log_level="ERROR"),
        )
    )
    try:
        engine.add_venue(
            venue=venue,
            oms_type=OmsType.NETTING,
            account_type=AccountType.CASH,
            base_currency=None,
            starting_balances=[Money(STARTING_EQUITY, USDT)],
            fee_model=MakerTakerFeeModel(),
            bar_execution=True,
            reject_stop_orders=False,
        )
        engine.add_instrument(instrument)
        engine.add_data(nautilus_bars, sort=True)
        strategy = EmaTrail(
            EmaTrailConfig(
                instrument_id=instrument.id,
                bar_type=bar_type,
                fast_period=fast,
                slow_period=slow,
                trail_bps=int(round(trail_pct * 100)),
                base_code=spec["code"],
            )
        )
        engine.add_strategy(strategy)
        engine.run()
        stats = _summarize(strategy.equity, strategy.trades)
        return {
            "engine": f"nautilus_trader {nautilus_trader.__version__}",
            "venue": "SIM",
            "params": {
                "symbol": symbol,
                "fast": fast,
                "slow": slow,
                "trailPct": trail_pct,
            },
            "stats": stats,
            "trades": strategy.trades,
            "equity": strategy.equity,
            "openPosition": strategy._open_entry,
        }
    finally:
        engine.dispose()


def _summarize(equity: list[float], trades: list[dict]) -> dict:
    if not equity:
        raise ValueError("backtest produced no equity points")
    start = equity[0]
    end = equity[-1]
    net = (end / start - 1.0) if start else 0.0
    peak = start
    max_dd = 0.0
    for value in equity:
        peak = max(peak, value)
        if peak:
            max_dd = min(max_dd, (value - peak) / peak)
    returns = []
    for previous, current in zip(equity, equity[1:]):
        if previous:
            returns.append(current / previous - 1.0)
    sharpe = 0.0
    if len(returns) >= 2:
        mean = sum(returns) / len(returns)
        variance = sum((item - mean) ** 2 for item in returns) / (len(returns) - 1)
        std = math.sqrt(variance)
        if std > 0:
            sharpe = mean / std * math.sqrt(365.0)
    return {
        "tradeCount": len(trades),
        "netReturn": round(net, 6),
        "maxDrawdown": round(max_dd, 6),
        "sharpe": round(sharpe, 4),
        "startingEquity": round(start, 2),
        "endingEquity": round(end, 2),
    }


def _ns_to_date(ns: int) -> str:
    return datetime.fromtimestamp(ns / 1_000_000_000, UTC).date().isoformat()


def main() -> int:
    raw = sys.stdin.read()
    try:
        payload = json.loads(raw) if raw.strip() else {}
    except json.JSONDecodeError:
        print(json.dumps({"ok": False, "error": "invalid json"}))
        return 2
    try:
        result = run_request(payload)
    except MissingNautilus as exc:
        print(json.dumps({"ok": False, "error": str(exc)}))
        return 2
    except Exception as exc:  # noqa: BLE001 - sidecar must return JSON, not a traceback
        print(json.dumps({"ok": False, "error": str(exc)}))
        return 1
    print(json.dumps({"ok": True, **result}))
    return 0


if __name__ == "__main__":
    sys.exit(main())
