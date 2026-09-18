"""Square of Nine support and resistance.

The square is a spiral of numbers around a centre. Its useful property is that
one full turn (360 degrees) adds 2 to the square root of the value, so any
angular distance from a starting price maps to a price level:

    level(d) = (sqrt(price) +/- 2 * d / 360) ** 2

Everything here follows from that one identity, which is why it is stated
rather than hidden in a table of magic numbers.
"""

from __future__ import annotations

from math import sqrt

from gann.models import SquareOfNineLevel

#: The cardinal and diagonal turns most Gann practitioners watch.
DEFAULT_DEGREES: tuple[int, ...] = (45, 90, 135, 180, 225, 270, 315, 360)

#: One full turn adds this much to the root.
ROOT_PER_TURN = 2.0


def root_offset(degrees: float) -> float:
    """Root distance corresponding to an angular distance on the spiral."""
    return ROOT_PER_TURN * degrees / 360.0


def level_at(price: float, degrees: float) -> float:
    """Price `degrees` around the spiral from `price`.

    Positive degrees move outwards (up), negative inwards (down). Moving
    inwards is clamped at zero: the spiral has a centre, and a negative root
    has no meaning as a price.
    """
    if price <= 0:
        raise ValueError("Square of Nine requires a positive price")

    root = sqrt(price) + root_offset(degrees)
    if root <= 0:
        return 0.0
    return root**2


def square_of_nine_levels(
    anchor: float,
    degrees: tuple[int, ...] = DEFAULT_DEGREES,
    reference: float | None = None,
) -> list[SquareOfNineLevel]:
    """Levels either side of `anchor`, nearest turn first.

    `reference` is the price the levels are classified against — the latest
    close in practice. Support and resistance are relative to where the market
    actually is, not to the anchor: once price has run past the anchor pivot,
    levels "below" it can sit above the market, and calling those support would
    be simply wrong. Defaults to the anchor when no reference is given.

    A downward level that collapses to zero is dropped rather than reported as
    a $0.00 support.
    """
    if anchor <= 0:
        raise ValueError("Square of Nine requires a positive price")

    compare_to = anchor if reference is None else reference
    levels: list[SquareOfNineLevel] = []

    for degree in sorted(degrees):
        for direction, signed in (("UP", degree), ("DOWN", -degree)):
            price = level_at(anchor, signed)
            if price <= 0:
                continue
            levels.append(
                SquareOfNineLevel(
                    degrees=degree,
                    price=price,
                    direction=direction,  # type: ignore[arg-type]
                    kind="RESISTANCE" if price > compare_to else "SUPPORT",
                )
            )

    return levels
