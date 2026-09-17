"""Gann angles (the fan).

A fan is a set of straight lines from a pivot, each with a fixed ratio of price
movement to time movement. The 1x1 ("45 degree") line rises one unit of price
per bar; 2x1 rises twice as fast, 1x2 half as fast. Gann treated the 1x1 as the
balance line, with price above it read as strength and below as weakness.

The unit of price per bar comes from `gann.swings.price_unit_per_bar` — see the
note there about why it is derived from volatility rather than fixed.
"""

from __future__ import annotations

from gann.models import Direction, GannAngle, Swing

#: (price_units, time_units) for each ray, steepest first.
DEFAULT_RATIOS: tuple[tuple[int, int], ...] = (
    (8, 1),
    (4, 1),
    (2, 1),
    (1, 1),
    (1, 2),
    (1, 4),
    (1, 8),
)


def ratio_name(price_units: int, time_units: int) -> str:
    return f"{price_units}x{time_units}"


def build_fan(
    pivot: Swing,
    price_unit_per_bar: float,
    last_index: int,
    ratios: tuple[tuple[int, int], ...] = DEFAULT_RATIOS,
) -> list[GannAngle]:
    """Fan out from `pivot` to `last_index`.

    A pivot low fans upwards (the lines act as support), a pivot high fans
    downwards (resistance). `last_index` is the index of the most recent bar, so
    each ray can report where it sits today.
    """
    if price_unit_per_bar <= 0:
        raise ValueError("price_unit_per_bar must be positive")
    if last_index < pivot.index:
        raise ValueError("last_index must be at or after the pivot")

    direction: Direction = "UP" if pivot.kind == "LOW" else "DOWN"
    sign = 1.0 if direction == "UP" else -1.0
    bars_elapsed = last_index - pivot.index

    angles: list[GannAngle] = []
    for price_units, time_units in ratios:
        slope = sign * price_unit_per_bar * price_units / time_units
        angles.append(
            GannAngle(
                name=ratio_name(price_units, time_units),
                price_units=price_units,
                time_units=time_units,
                slope_per_bar=slope,
                origin_index=pivot.index,
                origin_time=pivot.time,
                origin_price=pivot.price,
                direction=direction,
                current_price=pivot.price + slope * bars_elapsed,
            )
        )
    return angles


def value_at(angle: GannAngle, index: int) -> float:
    """Where `angle` sits at bar `index`."""
    return angle.origin_price + angle.slope_per_bar * (index - angle.origin_index)
