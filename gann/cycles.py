"""Time cycle analysis.

Gann's premise was that turns recur at repeating time distances. The method
here is deliberately plain and checkable: measure the bar distance between
consecutive pivots of the same kind, see which distances repeat, and project
the repeaters forward from the most recent pivot.

No claim is made that this predicts anything. It reports "this spacing has
happened before, and counting it forward lands here", which is exactly what a
beginner needs stated rather than dressed up.
"""

from __future__ import annotations

from collections import Counter
from datetime import datetime, timedelta, timezone

from gann.models import Candle, Swing, SwingKind, TimeCycle


def pivot_distances(swings: list[Swing], kind: SwingKind) -> list[int]:
    """Bar gaps between consecutive pivots of one kind, oldest first."""
    indices = [swing.index for swing in swings if swing.kind == kind]
    return [b - a for a, b in zip(indices, indices[1:]) if b > a]


def average_bar_duration(candles: list[Candle]) -> timedelta:
    """Mean wall-clock time per bar.

    Daily bars skip weekends and holidays, so a projection of N bars is not N
    days. Averaging the real spacing absorbs that instead of pretending every
    bar is 24 hours apart.
    """
    if len(candles) < 2:
        raise ValueError("need at least two candles to measure bar duration")
    span = candles[-1].time - candles[0].time
    return span / (len(candles) - 1)


def dominant_cycles(
    swings: list[Swing],
    candles: list[Candle],
    *,
    tolerance: int = 2,
    min_occurrences: int = 2,
    min_length_bars: int = 6,
    max_cycles: int = 3,
    now: datetime | None = None,
) -> list[TimeCycle]:
    """Repeating pivot spacings, projected forward from the latest pivot.

    Distances within `tolerance` bars of each other are treated as the same
    cycle and collapsed onto their rounded centre, because real pivots never
    land on exactly the same spacing twice. A spacing seen only once is not a
    cycle, so `min_occurrences` defaults to 2.

    `min_length_bars` discards spacings at the detector's own resolution limit.
    Counting raw distances is biased towards the shortest ones — adjacent
    pivots are the most numerous thing on any chart — so without a floor the
    "dominant cycle" is just the smallest gap the swing detector can resolve,
    which says more about the settings than the market. Callers should pass a
    floor derived from the swing strength they used.

    Returns the strongest cycles first (most occurrences, then longest).
    """
    if not candles:
        return []

    bar_duration = average_bar_duration(candles)
    horizon = now or datetime.now(timezone.utc)
    results: list[TimeCycle] = []

    for kind in ("HIGH", "LOW"):
        distances = pivot_distances(swings, kind)  # type: ignore[arg-type]
        if not distances:
            continue

        anchor = _last_of_kind(swings, kind)  # type: ignore[arg-type]
        if anchor is None:
            continue

        for length, occurrences in _cluster(distances, tolerance):
            if occurrences < min_occurrences or length < min_length_bars:
                continue
            results.append(
                TimeCycle(
                    length_bars=length,
                    occurrences=occurrences,
                    anchor_time=anchor.time,
                    anchor_kind=kind,  # type: ignore[arg-type]
                    projected_time=_project(
                        anchor.time, length, bar_duration, horizon
                    ),
                )
            )

    results.sort(key=lambda cycle: (-cycle.occurrences, -cycle.length_bars))
    return results[:max_cycles]


def _cluster(distances: list[int], tolerance: int) -> list[tuple[int, int]]:
    """Group nearby distances, returning (representative_length, count)."""
    if tolerance <= 0:
        return sorted(Counter(distances).items())

    remaining = sorted(distances)
    clusters: list[tuple[int, int]] = []
    while remaining:
        seed = remaining[0]
        members = [d for d in remaining if abs(d - seed) <= tolerance]
        remaining = [d for d in remaining if abs(d - seed) > tolerance]
        centre = round(sum(members) / len(members))
        clusters.append((centre, len(members)))
    return clusters


def _last_of_kind(swings: list[Swing], kind: SwingKind) -> Swing | None:
    for swing in reversed(swings):
        if swing.kind == kind:
            return swing
    return None


def _project(
    anchor: datetime,
    length_bars: int,
    bar_duration: timedelta,
    horizon: datetime,
) -> datetime:
    """Next occurrence of the cycle after `horizon`.

    The anchor pivot can be older than the cycle length, in which case one
    step forward lands in the past — a date that has already come and gone is
    not a forecast. Step in whole cycles until the projection is ahead of us.
    """
    step = bar_duration * length_bars
    if step <= timedelta(0):
        return anchor

    projected = anchor + step
    while projected <= horizon:
        projected += step
    return projected
