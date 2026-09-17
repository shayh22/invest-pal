"""Fetch OHLCV candles from Yahoo Finance.

Server-side only, so unlike the browser there is no CORS problem and no proxy
in the way. Uses nothing outside the standard library, which keeps this engine
installable without a requirements file.
"""

from __future__ import annotations

import json
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timezone

from gann.models import Candle

CHART_URL = "https://query1.finance.yahoo.com/v8/finance/chart/{symbol}"

# Yahoo 404s requests without a browser-like user agent.
HEADERS = {"User-Agent": "Mozilla/5.0", "Accept": "application/json"}


class MarketDataError(RuntimeError):
    """Raised when candles could not be fetched or parsed."""


def fetch_candles(
    symbol: str,
    *,
    range_: str = "2y",
    interval: str = "1d",
    timeout: float = 20.0,
) -> list[Candle]:
    """Return candles for `symbol`, oldest first.

    Bars Yahoo pads with nulls (halts, thin sessions) are dropped: a candle
    missing any of its four prices cannot be analysed.
    """
    url = CHART_URL.format(symbol=urllib.parse.quote(symbol, safe=""))
    query = urllib.parse.urlencode({"range": range_, "interval": interval})
    request = urllib.request.Request(f"{url}?{query}", headers=HEADERS)

    try:
        with urllib.request.urlopen(request, timeout=timeout) as response:
            body = json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as error:
        # Yahoo returns a structured error body with a useful description.
        detail = _error_detail(error)
        raise MarketDataError(f"{symbol}: {detail}") from error
    except (urllib.error.URLError, TimeoutError) as error:
        raise MarketDataError(f"{symbol}: could not reach Yahoo ({error})") from error
    except json.JSONDecodeError as error:
        raise MarketDataError(f"{symbol}: response was not JSON") from error

    return _parse(body, symbol)


def _error_detail(error: urllib.error.HTTPError) -> str:
    try:
        payload = json.loads(error.read().decode("utf-8"))
        description = payload.get("chart", {}).get("error", {}).get("description")
        if description:
            return description
    except Exception:  # noqa: BLE001 - the HTTP status is the fallback
        pass
    return f"HTTP {error.code}"


def _parse(body: dict, symbol: str) -> list[Candle]:
    chart = body.get("chart") or {}
    if chart.get("error"):
        raise MarketDataError(f"{symbol}: {chart['error'].get('description')}")

    results = chart.get("result") or []
    if not results:
        raise MarketDataError(f"{symbol}: no data returned")

    result = results[0]
    timestamps = result.get("timestamp") or []
    quotes = (result.get("indicators") or {}).get("quote") or [{}]
    series = quotes[0]

    opens = series.get("open") or []
    highs = series.get("high") or []
    lows = series.get("low") or []
    closes = series.get("close") or []
    volumes = series.get("volume") or []

    candles: list[Candle] = []
    for i, stamp in enumerate(timestamps):
        values = (
            _at(opens, i),
            _at(highs, i),
            _at(lows, i),
            _at(closes, i),
        )
        if stamp is None or any(value is None for value in values):
            continue
        open_, high, low, close = values
        candles.append(
            Candle(
                time=datetime.fromtimestamp(stamp, tz=timezone.utc),
                open=float(open_),
                high=float(high),
                low=float(low),
                close=float(close),
                volume=float(_at(volumes, i) or 0.0),
            )
        )

    if not candles:
        raise MarketDataError(f"{symbol}: no usable candles in the response")

    candles.sort(key=lambda candle: candle.time)
    return candles


def _at(values: list, index: int):
    return values[index] if index < len(values) else None
