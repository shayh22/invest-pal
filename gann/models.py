"""Value types shared by the Gann engine.

Kept as plain dataclasses with no third-party dependencies so the engine can be
imported and tested anywhere Python 3.10+ runs.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from typing import Literal

SwingKind = Literal["HIGH", "LOW"]
Direction = Literal["UP", "DOWN"]


@dataclass(frozen=True)
class Candle:
    """One OHLCV bar. `time` is timezone-aware UTC."""

    time: datetime
    open: float
    high: float
    low: float
    close: float
    volume: float = 0.0


@dataclass(frozen=True)
class Swing:
    """A pivot: a bar whose high (or low) dominates its neighbours."""

    index: int
    time: datetime
    price: float
    kind: SwingKind


@dataclass(frozen=True)
class GannAngle:
    """One ray of a Gann fan, anchored at a pivot.

    `slope_per_bar` is signed: positive rises, negative falls.
    """

    name: str
    price_units: int
    time_units: int
    slope_per_bar: float
    origin_index: int
    origin_time: datetime
    origin_price: float
    direction: Direction
    #: Value of the ray at the most recent bar.
    current_price: float


@dataclass(frozen=True)
class SquareOfNineLevel:
    """A price level a fixed number of degrees around the Square of Nine.

    `direction` is which way the level lies from its anchor pivot; `kind` is
    whether it sits above or below the *current* price. The two differ whenever
    price has moved past the anchor, and it is `kind` a trader acts on: a level
    above the market is resistance no matter which side of the anchor it came
    from.
    """

    degrees: int
    price: float
    direction: Direction
    kind: Literal["SUPPORT", "RESISTANCE"]


@dataclass(frozen=True)
class TimeCycle:
    """A repeating bar-count between same-type pivots, projected forward."""

    length_bars: int
    #: How many times this length was observed in the history.
    occurrences: int
    #: Pivot the projection is measured from.
    anchor_time: datetime
    anchor_kind: SwingKind
    projected_time: datetime


@dataclass
class GannAnalysis:
    """Everything the engine produces for one asset and timeframe."""

    symbol: str
    timeframe: str
    as_of: datetime
    last_price: float
    #: Price distance one bar of time is treated as worth; scales the fan.
    price_unit_per_bar: float
    #: Mean wall-clock seconds per bar. The frontend needs this to draw a
    #: per-bar slope on a time axis, and on a chart whose interval differs
    #: from the one analysed.
    bar_duration_seconds: float = 0.0
    swings: list[Swing] = field(default_factory=list)
    angles: list[GannAngle] = field(default_factory=list)
    square_of_nine: list[SquareOfNineLevel] = field(default_factory=list)
    cycles: list[TimeCycle] = field(default_factory=list)
    #: Human-readable notes about assumptions or thin data.
    notes: list[str] = field(default_factory=list)
