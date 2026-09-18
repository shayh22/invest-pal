"""Orchestrates the three Gann calculations into one analysis payload."""

from __future__ import annotations

from datetime import datetime, timezone

from gann.angles import build_fan
from gann.cycles import average_bar_duration, dominant_cycles
from gann.models import Candle, GannAnalysis
from gann.square_of_nine import square_of_nine_levels
from gann.swings import find_swings, major_pivot, price_unit_per_bar

#: Below this, pivots cannot be identified with any confidence.
MIN_CANDLES = 30

#: Flag the Square of Nine as tight when its whole span is under this fraction
#: of price. The square is scale-dependent; high-priced assets get narrow turns.
NARROW_SQUARE_SPAN = 0.05


def analyze(
    candles: list[Candle],
    symbol: str,
    timeframe: str = "1d",
    *,
    swing_strength: int = 5,
) -> GannAnalysis:
    """Run the engine over one series.

    Raises ValueError when there is too little history to say anything, rather
    than returning confident-looking output derived from six bars.
    """
    if len(candles) < MIN_CANDLES:
        raise ValueError(
            f"need at least {MIN_CANDLES} candles for {symbol}, got {len(candles)}"
        )

    ordered = sorted(candles, key=lambda candle: candle.time)
    last = ordered[-1]
    last_index = len(ordered) - 1
    notes: list[str] = []

    unit = price_unit_per_bar(ordered)
    swings = find_swings(ordered, strength=swing_strength)

    # Fan from the major pivot (see gann.swings.major_pivot for the rule). A low
    # fans up as support, a high fans down as resistance.
    pivot = major_pivot(swings)
    angles = build_fan(pivot, unit, last_index) if pivot else []
    if pivot is None:
        notes.append(
            "No confirmed swing pivot in this window, so no Gann fan was drawn."
        )

    # The square is anchored on the latest close, not on the pivot the fan uses.
    # Anchoring it on a distant pivot can put every level on one side of the
    # market — a pivot 7% above price yields no support at all, because a full
    # turn of the spiral is a small percentage at four-figure prices. Squaring
    # the current price always brackets it, which is what a support/resistance
    # panel has to do to be useful.
    levels = square_of_nine_levels(last.close) if last.close > 0 else []
    if last.close <= 0:
        notes.append("Square of Nine needs a positive price; skipped.")
    elif levels:
        # The spiral adds a fixed amount to the square root per turn, so at
        # four-figure prices a full turn is a fraction of a percent. Say so
        # rather than presenting levels 0.2% apart as meaningful targets.
        span = max(l.price for l in levels) - min(l.price for l in levels)
        if span / last.close < NARROW_SQUARE_SPAN:
            notes.append(
                "At this price level the Square of Nine's turns are less than "
                f"{NARROW_SQUARE_SPAN:.0%} apart, so these levels sit very close "
                "together."
            )

    # Floor the cycle length at the detector's resolution: two pivots cannot be
    # closer than the swing strength, so anything shorter is an artefact.
    cycles = dominant_cycles(
        swings, ordered, min_length_bars=swing_strength + 1
    )
    if not cycles:
        notes.append(
            "No pivot spacing repeated often enough in this window to call a cycle."
        )

    return GannAnalysis(
        symbol=symbol,
        timeframe=timeframe,
        as_of=datetime.now(timezone.utc),
        last_price=last.close,
        price_unit_per_bar=unit,
        bar_duration_seconds=average_bar_duration(ordered).total_seconds(),
        swings=swings,
        angles=angles,
        square_of_nine=levels,
        cycles=cycles,
        notes=notes,
    )


def to_payload(analysis: GannAnalysis, *, max_swings: int = 12) -> dict:
    """Serialise an analysis into the JSON stored in gann_signals.payload.

    This dict is the contract the frontend reads, so it is explicit rather than
    a dataclass dump: field names here are matched by
    src/types/gann.ts on the other side.
    """
    return {
        "version": 1,
        "symbol": analysis.symbol,
        "timeframe": analysis.timeframe,
        "as_of": analysis.as_of.isoformat(),
        "last_price": round(analysis.last_price, 8),
        "price_unit_per_bar": round(analysis.price_unit_per_bar, 8),
        "bar_duration_seconds": round(analysis.bar_duration_seconds, 3),
        "square_of_nine_anchor": round(analysis.last_price, 8),
        "fan_anchor": (
            {
                "time": analysis.angles[0].origin_time.isoformat(),
                "price": round(analysis.angles[0].origin_price, 8),
                "kind": "LOW" if analysis.angles[0].direction == "UP" else "HIGH",
            }
            if analysis.angles
            else None
        ),
        "swings": [
            {
                "time": swing.time.isoformat(),
                "price": round(swing.price, 8),
                "kind": swing.kind,
            }
            # Most recent pivots are the useful ones; the full list can be long.
            for swing in analysis.swings[-max_swings:]
        ],
        "angles": [
            {
                "name": angle.name,
                "price_units": angle.price_units,
                "time_units": angle.time_units,
                "direction": angle.direction,
                "slope_per_bar": round(angle.slope_per_bar, 8),
                "origin_time": angle.origin_time.isoformat(),
                "origin_price": round(angle.origin_price, 8),
                "current_price": round(angle.current_price, 8),
            }
            for angle in analysis.angles
        ],
        "square_of_nine": [
            {
                "degrees": level.degrees,
                "price": round(level.price, 8),
                "direction": level.direction,
                "kind": level.kind,
            }
            for level in analysis.square_of_nine
        ],
        "cycles": [
            {
                "length_bars": cycle.length_bars,
                "occurrences": cycle.occurrences,
                "anchor_time": cycle.anchor_time.isoformat(),
                "anchor_kind": cycle.anchor_kind,
                "projected_time": cycle.projected_time.isoformat(),
            }
            for cycle in analysis.cycles
        ],
        "notes": analysis.notes,
    }
