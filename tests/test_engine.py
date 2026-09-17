import json
from datetime import timedelta

import pytest

from gann.engine import MIN_CANDLES, analyze, to_payload
from tests.conftest import make_candles


def trending_series(n=120):
    """An uptrend with regular pullbacks, so pivots and cycles both exist."""
    closes = []
    for i in range(n):
        base = 100 + i * 0.5
        wobble = 6 if i % 10 < 5 else -6
        closes.append(base + wobble)
    return make_candles(closes, spread=1.5)


def test_analysis_populates_every_section():
    analysis = analyze(trending_series(), "TEST")

    assert analysis.symbol == "TEST"
    assert analysis.timeframe == "1d"
    assert analysis.swings
    assert analysis.angles
    assert analysis.square_of_nine
    assert analysis.price_unit_per_bar > 0
    assert analysis.last_price == pytest.approx(trending_series()[-1].close)


def test_too_little_history_is_refused():
    with pytest.raises(ValueError, match="at least"):
        analyze(make_candles(list(range(MIN_CANDLES - 1))), "THIN")


def test_unsorted_input_is_ordered_before_analysis():
    candles = trending_series()
    shuffled = [candles[i] for i in (5, 0, 9, 3)] + candles[10:] + candles[1:3]

    analysis = analyze(shuffled, "SHUFFLED")
    # last_price must come from the chronologically last bar, not the last item.
    assert analysis.as_of is not None
    assert analysis.last_price == pytest.approx(
        max(candles, key=lambda c: c.time).close
    )


def test_every_ray_shares_one_anchor():
    analysis = analyze(trending_series(), "TEST")
    origins = {(a.origin_time, a.origin_price) for a in analysis.angles}

    # A fan is a fan: all rays leave from the same turning point.
    assert len(origins) == 1


def test_fan_is_anchored_on_a_major_pivot_not_the_latest_wiggle():
    # Long rise, a decisive top, then a shallow drift with minor pivots in it.
    closes = [100 + i * 2 for i in range(40)] + [
        180 - i * 0.4 + (3 if i % 6 < 3 else -3) for i in range(40)
    ]
    analysis = analyze(make_candles(closes, spread=1.0), "TOP")

    anchor_price = analysis.angles[0].origin_price
    highest_high = max(s.price for s in analysis.swings if s.kind == "HIGH")

    # The fan must hang off the significant top, not a 3-point wobble near the
    # end, which would give a ray a few bars long that describes nothing.
    assert anchor_price == pytest.approx(highest_high)
    assert all(a.direction == "DOWN" for a in analysis.angles)


def test_fan_anchor_is_reported_in_the_payload():
    payload = to_payload(analyze(trending_series(), "TEST"))
    anchor = payload["fan_anchor"]

    assert anchor is not None
    assert set(anchor) == {"time", "price", "kind"}
    assert anchor["price"] == pytest.approx(payload["angles"][0]["origin_price"])


def test_square_always_brackets_the_market():
    analysis = analyze(trending_series(), "TEST")
    last = analysis.last_price

    supports = [l.price for l in analysis.square_of_nine if l.kind == "SUPPORT"]
    resistances = [l.price for l in analysis.square_of_nine if l.kind == "RESISTANCE"]

    # Both sides must be populated: a panel with no support is no use, and
    # anchoring on a distant pivot is what used to cause that.
    assert supports and resistances
    assert all(p <= last for p in supports)
    assert all(p > last for p in resistances)


def test_square_brackets_the_market_even_after_a_sharp_drop():
    # Anchor pivot well above the market: the regression case. BTC-USD looked
    # like this and produced zero support levels.
    closes = [100 + i for i in range(60)] + [160 - i * 3 for i in range(25)]
    analysis = analyze(make_candles(closes, spread=2.0), "DROP")

    supports = [l for l in analysis.square_of_nine if l.kind == "SUPPORT"]
    resistances = [l for l in analysis.square_of_nine if l.kind == "RESISTANCE"]
    assert supports and resistances


def test_cycle_projections_are_in_the_future():
    analysis = analyze(trending_series(), "TEST")
    for cycle in analysis.cycles:
        assert cycle.projected_time > analysis.as_of


def test_flat_market_still_produces_a_payload_with_notes():
    # No pivots and no cycles: the engine must say so rather than fabricate.
    flat = make_candles([100.0] * 80, spread=0.0)
    analysis = analyze(flat, "FLAT")

    assert analysis.angles == [] or analysis.swings == []
    assert analysis.notes


def test_payload_is_json_serialisable_and_versioned():
    payload = to_payload(analyze(trending_series(), "TEST"))

    encoded = json.dumps(payload)
    assert json.loads(encoded) == payload
    assert payload["version"] == 1


def test_payload_shape_matches_the_frontend_contract():
    payload = to_payload(analyze(trending_series(), "TEST"))

    assert set(payload) == {
        "version",
        "symbol",
        "timeframe",
        "as_of",
        "last_price",
        "price_unit_per_bar",
        "bar_duration_seconds",
        "square_of_nine_anchor",
        "fan_anchor",
        "swings",
        "angles",
        "square_of_nine",
        "cycles",
        "notes",
    }
    assert set(payload["angles"][0]) == {
        "name",
        "price_units",
        "time_units",
        "direction",
        "slope_per_bar",
        "origin_time",
        "origin_price",
        "current_price",
    }
    assert set(payload["square_of_nine"][0]) == {
        "degrees",
        "price",
        "direction",
        "kind",
    }
    assert set(payload["swings"][0]) == {"time", "price", "kind"}


def test_payload_caps_the_swing_list():
    payload = to_payload(analyze(trending_series(300), "TEST"), max_swings=5)
    assert len(payload["swings"]) <= 5


def test_payload_timestamps_are_iso_strings():
    payload = to_payload(analyze(trending_series(), "TEST"))

    assert payload["as_of"].startswith("20")
    for angle in payload["angles"]:
        assert "T" in angle["origin_time"]


def test_weekly_spacing_projects_in_weeks_not_days():
    weekly = make_candles(
        [100 + (i % 10) * 3 for i in range(80)],
        spacing=timedelta(days=7),
        spread=2.0,
    )
    analysis = analyze(weekly, "WEEKLY", timeframe="1wk")

    for cycle in analysis.cycles:
        span = cycle.projected_time - cycle.anchor_time
        # Each bar is a week, so an N-bar cycle projects ~N weeks out.
        assert span >= timedelta(days=7 * cycle.length_bars * 0.9)


def test_narrow_square_is_flagged_at_high_prices():
    # A four-figure price makes every turn of the spiral a fraction of a
    # percent, which is worth saying out loud rather than implying precision.
    closes = [70000 + (i % 10) * 400 for i in range(80)]
    analysis = analyze(make_candles(closes, spread=300.0), "PRICEY")

    assert any("close together" in note for note in analysis.notes)


def test_normal_priced_asset_is_not_flagged():
    analysis = analyze(trending_series(), "TEST")
    assert not any("close together" in note for note in analysis.notes)


def test_bar_duration_is_reported_for_the_frontend():
    # The fan's slope is per bar, so drawing it on a time axis needs to know
    # how much wall-clock time a bar covers.
    daily = analyze(trending_series(), "TEST")
    assert daily.bar_duration_seconds == pytest.approx(86400, rel=0.01)

    weekly_candles = make_candles(
        [100 + (i % 10) * 3 for i in range(80)], spacing=timedelta(days=7)
    )
    weekly = analyze(weekly_candles, "WEEKLY", timeframe="1wk")
    assert weekly.bar_duration_seconds == pytest.approx(86400 * 7, rel=0.01)
