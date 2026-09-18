from datetime import datetime, timedelta, timezone

import pytest

from gann.cycles import average_bar_duration, dominant_cycles, pivot_distances
from gann.models import Swing
from gann.swings import find_swings
from tests.conftest import make_candles


def swing(index, kind, price=100.0):
    return Swing(
        index=index,
        time=datetime(2024, 1, 1, tzinfo=timezone.utc) + timedelta(days=index),
        price=price,
        kind=kind,
    )


def test_distances_are_measured_between_same_kind_pivots():
    swings = [swing(0, "LOW"), swing(5, "HIGH"), swing(10, "LOW"), swing(15, "HIGH")]

    assert pivot_distances(swings, "LOW") == [10]
    assert pivot_distances(swings, "HIGH") == [10]


def test_average_bar_duration_absorbs_weekend_gaps():
    # Five weekday bars spanning Mon -> Fri: 4 gaps over 4 days.
    candles = make_candles([1, 2, 3, 4, 5], spacing=timedelta(days=1))
    assert average_bar_duration(candles) == timedelta(days=1)

    # A series with a two-day weekend between each bar averages out higher,
    # which is what keeps an N-bar projection from landing N calendar days out.
    weekly = make_candles([1, 2, 3], spacing=timedelta(days=7))
    assert average_bar_duration(weekly) == timedelta(days=7)


def test_average_bar_duration_needs_two_candles():
    with pytest.raises(ValueError):
        average_bar_duration(make_candles([1]))


def test_a_repeating_spacing_is_reported_as_a_cycle():
    # Lows every 10 bars.
    swings = [swing(i, "LOW") for i in (0, 10, 20, 30)]
    candles = make_candles(list(range(40)))

    cycles = dominant_cycles(swings, candles)
    assert cycles
    assert cycles[0].length_bars == 10
    assert cycles[0].occurrences == 3


def test_projection_counts_forward_from_the_latest_pivot():
    swings = [swing(i, "LOW") for i in (0, 10, 20, 30)]
    candles = make_candles(list(range(40)), spacing=timedelta(days=1))

    # Pin "now" just after the anchor so the first step is still in the future.
    cycle = dominant_cycles(
        swings, candles, now=swings[-1].time + timedelta(days=1)
    )[0]
    assert cycle.anchor_time == swings[-1].time
    # 10 bars at one day per bar.
    assert cycle.projected_time == swings[-1].time + timedelta(days=10)
    assert cycle.projected_time > cycle.anchor_time


def test_projection_is_rolled_forward_past_a_stale_anchor():
    # The anchor is 100 days old and the cycle is 10 bars, so a single step
    # would land in the past. A date that has already passed is not a forecast.
    swings = [swing(i, "LOW") for i in (0, 10, 20, 30)]
    candles = make_candles(list(range(40)), spacing=timedelta(days=1))
    now = swings[-1].time + timedelta(days=100)

    cycle = dominant_cycles(swings, candles, now=now)[0]
    assert cycle.projected_time > now
    # Still a whole number of cycles from the anchor.
    elapsed = cycle.projected_time - cycle.anchor_time
    assert elapsed.days % cycle.length_bars == 0


def test_near_miss_spacings_collapse_into_one_cycle():
    # 10, 11 and 9 bars apart is one ~10 bar cycle, not three cycles.
    swings = [swing(i, "LOW") for i in (0, 10, 21, 30)]
    candles = make_candles(list(range(40)))

    cycles = dominant_cycles(swings, candles, tolerance=2)
    lows = [c for c in cycles if c.anchor_kind == "LOW"]
    assert len(lows) == 1
    assert lows[0].occurrences == 3
    assert lows[0].length_bars == pytest.approx(10, abs=1)


def test_a_spacing_seen_once_is_not_a_cycle():
    swings = [swing(0, "LOW"), swing(10, "LOW")]
    candles = make_candles(list(range(20)))

    assert dominant_cycles(swings, candles, min_occurrences=2) == []


def test_stronger_cycles_come_first():
    # 5-bar spacing occurs three times, 20-bar spacing twice.
    swings = [swing(i, "LOW") for i in (0, 5, 10, 15)] + [
        swing(i, "HIGH") for i in (0, 20, 40)
    ]
    candles = make_candles(list(range(50)))

    cycles = dominant_cycles(swings, candles, max_cycles=5)
    assert cycles[0].occurrences >= cycles[-1].occurrences


def test_max_cycles_is_respected():
    swings = [swing(i, "LOW") for i in range(0, 60, 5)]
    candles = make_candles(list(range(60)))

    assert len(dominant_cycles(swings, candles, max_cycles=2)) <= 2


def test_no_pivots_means_no_cycles():
    assert dominant_cycles([], make_candles(list(range(40)))) == []


def test_works_on_pivots_found_from_real_shaped_data():
    # A triangle wave with a 10-bar period should surface a ~10 bar cycle.
    closes = []
    for cycle_index in range(6):
        closes.extend([10, 12, 14, 16, 18, 20, 18, 16, 14, 12])
    candles = make_candles(closes, spread=0.5)

    swings = find_swings(candles, strength=2)
    cycles = dominant_cycles(swings, candles)

    assert cycles
    assert any(abs(c.length_bars - 10) <= 2 for c in cycles)
