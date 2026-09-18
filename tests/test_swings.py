import pytest

from gann.models import Candle
from gann.swings import find_swings, last_swing, price_unit_per_bar
from tests.conftest import make_candles


def test_finds_a_single_peak():
    # Rises to a peak at index 5, then falls.
    closes = [10, 11, 12, 13, 14, 20, 14, 13, 12, 11, 10]
    swings = find_swings(make_candles(closes), strength=3)

    highs = [s for s in swings if s.kind == "HIGH"]
    assert len(highs) == 1
    assert highs[0].index == 5


def test_finds_a_single_trough():
    closes = [20, 19, 18, 17, 16, 10, 16, 17, 18, 19, 20]
    swings = find_swings(make_candles(closes), strength=3)

    lows = [s for s in swings if s.kind == "LOW"]
    assert len(lows) == 1
    assert lows[0].index == 5
    # A pivot low is recorded at the bar's low, not its close.
    assert lows[0].price == pytest.approx(10 - 1.0)


def test_alternating_peaks_and_troughs_are_all_found():
    closes = [10, 12, 14, 20, 14, 12, 10, 12, 14, 22, 14, 12, 10]
    swings = find_swings(make_candles(closes), strength=2)

    kinds = [s.kind for s in swings]
    assert kinds == ["HIGH", "LOW", "HIGH"]
    assert [s.index for s in swings] == [3, 6, 9]


def test_edges_are_never_reported_as_pivots():
    # Highest bar is the last one; it cannot be confirmed as a pivot because
    # there is no data after it. Reporting it would invent a reversal.
    closes = [10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 99]
    swings = find_swings(make_candles(closes), strength=3)

    assert all(s.index != len(closes) - 1 for s in swings)


def test_flat_top_yields_one_pivot_not_several():
    closes = [10, 11, 12, 20, 20, 20, 12, 11, 10]
    swings = find_swings(make_candles(closes), strength=2)

    highs = [s for s in swings if s.kind == "HIGH"]
    assert len(highs) == 1


def test_strength_controls_sensitivity():
    # A small wiggle at index 4 is a pivot at strength 1 but noise at strength 3.
    closes = [10, 10.5, 11, 10.9, 11.4, 10.9, 11, 11.5, 12, 12.5, 13]
    sensitive = find_swings(make_candles(closes, spread=0.05), strength=1)
    strict = find_swings(make_candles(closes, spread=0.05), strength=3)

    assert len(sensitive) > len(strict)


def test_strength_must_be_positive():
    with pytest.raises(ValueError):
        find_swings(make_candles([1, 2, 3]), strength=0)


def test_last_swing_filters_by_kind():
    closes = [10, 12, 14, 20, 14, 12, 10, 12, 14, 16, 18]
    swings = find_swings(make_candles(closes), strength=2)

    assert last_swing(swings, "HIGH").kind == "HIGH"
    assert last_swing(swings, "LOW").kind == "LOW"
    assert last_swing([]) is None


def test_price_unit_is_the_window_range_per_bar():
    # Closes 0..39 with a 1.0 spread: range is -1.0 to 40.0 over 40 bars.
    candles = make_candles(list(range(40)), spread=1.0)
    assert price_unit_per_bar(candles) == pytest.approx(41.0 / 40)


def test_price_unit_tracks_the_trend_not_bar_noise():
    # Same 100-point move over 100 bars, but one series is far choppier. A
    # volatility-based unit would differ wildly between these; a range-based
    # one must not, because the trend they describe is identical.
    calm = make_candles([100 + i for i in range(100)], spread=0.5)
    choppy = make_candles([100 + i for i in range(100)], spread=8.0)

    calm_unit = price_unit_per_bar(calm)
    choppy_unit = price_unit_per_bar(choppy)
    assert choppy_unit == pytest.approx(calm_unit, rel=0.25)


def test_price_unit_keeps_a_distant_one_by_one_near_price():
    # The regression this replaced: a unit from median bar range put the 1x1
    # 60% away from price 30 bars after the pivot.
    candles = make_candles([100 + i * 0.5 for i in range(500)], spread=4.0)
    unit = price_unit_per_bar(candles)

    pivot_price = candles[-40].close
    projected = pivot_price + unit * 40
    drift = abs(projected - candles[-1].close) / candles[-1].close
    assert drift < 0.10


def test_price_unit_scales_with_the_instrument():
    cheap = price_unit_per_bar(make_candles([30] * 40, spread=0.3))
    pricey = price_unit_per_bar(make_candles([76000] * 40, spread=900))
    assert pricey > cheap * 100


def test_flat_series_falls_back_to_a_fraction_of_price():
    # A zero-range series would otherwise produce a flat, useless fan.
    flat = [
        Candle(time=c.time, open=100, high=100, low=100, close=100)
        for c in make_candles([100] * 40)
    ]
    assert price_unit_per_bar(flat) == pytest.approx(1.0)


def test_price_unit_needs_data():
    with pytest.raises(ValueError):
        price_unit_per_bar([])


def test_major_pivot_prefers_the_more_recent_extreme():
    from gann.swings import major_pivot

    # Deep low early, high top later: the top is the turn the current move came
    # from, so the fan should hang off it.
    closes = [100, 80, 60, 40, 20, 60, 100, 140, 180, 140, 100, 60, 40]
    swings = find_swings(make_candles(closes, spread=1.0), strength=2)
    pivot = major_pivot(swings)

    assert pivot is not None
    assert pivot.kind == "HIGH"
    assert pivot.price == pytest.approx(max(s.price for s in swings if s.kind == "HIGH"))


def test_major_pivot_picks_the_low_when_the_low_is_more_recent():
    from gann.swings import major_pivot

    closes = [20, 60, 100, 140, 180, 140, 100, 60, 20, 60, 100, 140]
    swings = find_swings(make_candles(closes, spread=1.0), strength=2)
    pivot = major_pivot(swings)

    assert pivot is not None
    assert pivot.kind == "LOW"


def test_major_pivot_is_always_one_of_the_window_extremes():
    # The guarantee is not "the biggest move" but "an extreme": the anchor is
    # either the highest high or the lowest low of the window, never an
    # intermediate pivot. This is what keeps the fan off mid-range noise.
    from gann.swings import major_pivot

    closes = [100 + i * 3 for i in range(20)] + [
        155 + (2 if i % 4 < 2 else -2) for i in range(20)
    ]
    swings = find_swings(make_candles(closes, spread=0.5), strength=2)
    pivot = major_pivot(swings)

    highest = max(s.price for s in swings if s.kind == "HIGH")
    lowest = min(s.price for s in swings if s.kind == "LOW")

    assert pivot is not None
    assert pivot.price in (pytest.approx(highest), pytest.approx(lowest))


def test_major_pivot_is_never_an_intermediate_pivot():
    from gann.swings import major_pivot

    # A clear V: the bottom is the only sensible anchor, and there are plenty
    # of intermediate pivots on both legs to be wrongly picked.
    closes = (
        [200 - i * 8 for i in range(12)]
        + [104 + (3 if i % 4 < 2 else -3) for i in range(6)]
        + [110 + i * 8 for i in range(12)]
    )
    swings = find_swings(make_candles(closes, spread=1.0), strength=2)
    pivot = major_pivot(swings)

    assert pivot is not None
    assert pivot.kind == "LOW"
    assert pivot.price == pytest.approx(min(s.price for s in swings if s.kind == "LOW"))


def test_major_pivot_of_nothing_is_none():
    from gann.swings import major_pivot

    assert major_pivot([]) is None
