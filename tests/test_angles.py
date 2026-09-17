from datetime import datetime, timezone

import pytest

from gann.angles import DEFAULT_RATIOS, build_fan, value_at
from gann.models import Swing

LOW = Swing(index=10, time=datetime(2024, 3, 1, tzinfo=timezone.utc), price=100.0, kind="LOW")
HIGH = Swing(index=10, time=datetime(2024, 3, 1, tzinfo=timezone.utc), price=200.0, kind="HIGH")


def test_one_by_one_rises_one_unit_per_bar_from_a_low():
    fan = build_fan(LOW, price_unit_per_bar=2.0, last_index=20)
    one_by_one = next(a for a in fan if a.name == "1x1")

    assert one_by_one.slope_per_bar == pytest.approx(2.0)
    # 10 bars later, 10 units of price.
    assert one_by_one.current_price == pytest.approx(100.0 + 20.0)


def test_a_low_fans_up_and_a_high_fans_down():
    rising = build_fan(LOW, price_unit_per_bar=2.0, last_index=20)
    falling = build_fan(HIGH, price_unit_per_bar=2.0, last_index=20)

    assert all(a.direction == "UP" and a.slope_per_bar > 0 for a in rising)
    assert all(a.direction == "DOWN" and a.slope_per_bar < 0 for a in falling)


def test_steeper_ratios_are_steeper():
    fan = {a.name: a for a in build_fan(LOW, price_unit_per_bar=2.0, last_index=20)}

    # 2x1 is two price per one time, so twice the 1x1; 1x2 is half.
    assert fan["2x1"].slope_per_bar == pytest.approx(fan["1x1"].slope_per_bar * 2)
    assert fan["1x2"].slope_per_bar == pytest.approx(fan["1x1"].slope_per_bar / 2)
    assert fan["8x1"].slope_per_bar == pytest.approx(fan["1x1"].slope_per_bar * 8)
    assert fan["1x8"].slope_per_bar == pytest.approx(fan["1x1"].slope_per_bar / 8)


def test_fan_is_ordered_steepest_first_and_never_crosses():
    fan = build_fan(LOW, price_unit_per_bar=2.0, last_index=40)
    prices = [a.current_price for a in fan]

    # Rays diverge from a shared origin, so their order at any later bar is
    # fixed and they must not cross.
    assert prices == sorted(prices, reverse=True)
    assert len(fan) == len(DEFAULT_RATIOS)


def test_every_ray_starts_at_the_pivot_price():
    fan = build_fan(LOW, price_unit_per_bar=2.0, last_index=20)
    assert all(value_at(a, LOW.index) == pytest.approx(LOW.price) for a in fan)


def test_value_at_extrapolates_linearly():
    fan = build_fan(LOW, price_unit_per_bar=2.0, last_index=20)
    one_by_one = next(a for a in fan if a.name == "1x1")

    assert value_at(one_by_one, 30) == pytest.approx(100.0 + 2.0 * 20)
    # Before the pivot the line is still defined, just behind the origin.
    assert value_at(one_by_one, 5) == pytest.approx(100.0 - 2.0 * 5)


def test_fan_at_the_pivot_bar_is_flat():
    fan = build_fan(LOW, price_unit_per_bar=2.0, last_index=LOW.index)
    assert all(a.current_price == pytest.approx(LOW.price) for a in fan)


def test_invalid_inputs_are_rejected():
    with pytest.raises(ValueError):
        build_fan(LOW, price_unit_per_bar=0, last_index=20)
    with pytest.raises(ValueError):
        build_fan(LOW, price_unit_per_bar=2.0, last_index=LOW.index - 1)
