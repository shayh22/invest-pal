"""Swing (pivot) detection.

Gann's angles and time cycles are both measured from pivots, so everything else
in the engine depends on this being sane.
"""

from __future__ import annotations

from gann.models import Candle, Swing


def find_swings(candles: list[Candle], strength: int = 3) -> list[Swing]:
    """Return pivot highs and lows, oldest first.

    A bar is a swing high when its high is the highest of the `strength` bars on
    each side, and a swing low when its low is the lowest. Bars within
    `strength` of either end are skipped: there is not enough context to judge
    them, and treating the final bar as a confirmed pivot is how naive
    implementations invent reversals that have not happened.

    Ties are broken in favour of the earlier bar, so a flat top yields one pivot
    rather than several.
    """
    if strength < 1:
        raise ValueError("strength must be at least 1")

    swings: list[Swing] = []
    for index in range(strength, len(candles) - strength):
        candle = candles[index]
        left = candles[index - strength : index]
        right = candles[index + 1 : index + 1 + strength]

        is_high = all(candle.high > other.high for other in left) and all(
            candle.high >= other.high for other in right
        )
        if is_high:
            swings.append(
                Swing(index=index, time=candle.time, price=candle.high, kind="HIGH")
            )
            continue

        is_low = all(candle.low < other.low for other in left) and all(
            candle.low <= other.low for other in right
        )
        if is_low:
            swings.append(
                Swing(index=index, time=candle.time, price=candle.low, kind="LOW")
            )

    return swings


def last_swing(swings: list[Swing], kind: str | None = None) -> Swing | None:
    """Most recent swing, optionally restricted to highs or lows."""
    for swing in reversed(swings):
        if kind is None or swing.kind == kind:
            return swing
    return None


def major_pivot(swings: list[Swing]) -> Swing | None:
    """The turning point a fan should be anchored on.

    Gann drew his fans from significant highs and lows, not from whatever
    wiggle happened last. Anchoring on the latest pivot produces a ray a few
    bars long that describes nothing — and on a six-month chart it is not even
    visible.

    The rule here: take the extreme swing of each kind (the highest high and
    the lowest low in the window) and use whichever is more recent. That is the
    turn the current move actually started from, and it gives the fan enough
    run to be read.
    """
    highs = [swing for swing in swings if swing.kind == "HIGH"]
    lows = [swing for swing in swings if swing.kind == "LOW"]

    candidates = []
    if highs:
        candidates.append(max(highs, key=lambda swing: swing.price))
    if lows:
        candidates.append(min(lows, key=lambda swing: swing.price))
    if not candidates:
        return None

    return max(candidates, key=lambda swing: swing.index)


def price_unit_per_bar(candles: list[Candle]) -> float:
    """Price distance that one bar of time is treated as worth.

    Gann drew on squared paper where one box of time equalled one box of price,
    so a fan's slope came from how the chart was scaled: he sized the sheet so
    the whole price range fitted it. That is what this reproduces — the
    window's full high-to-low range divided by its bar count.

    Using per-bar volatility instead (a median bar range, say) looks reasonable
    and is badly wrong: on daily AAPL the median range is about 2% of price, so
    a 1x1 anchored 30 bars back projects 60% away from the market and the
    balance line becomes meaningless. Scaling to the range keeps the 1x1
    tracking the trend, which is the only thing that makes "price above its own
    1x1" a statement about strength.

    Scale-free, so it works on a $30 stock and a $76,000 coin alike.
    """
    if not candles:
        raise ValueError("cannot derive a price unit from zero candles")

    span = max(candle.high for candle in candles) - min(
        candle.low for candle in candles
    )
    unit = span / len(candles)
    if unit > 0:
        return unit

    # Degenerate input (a flat or synthetic series): fall back to something
    # proportional to price rather than returning a zero-slope fan.
    last_close = candles[-1].close
    return abs(last_close) * 0.01 if last_close else 1.0
