"""The Square of Nine rests on one identity, so test the identity directly."""

import math

import pytest

from gann.square_of_nine import (
    ROOT_PER_TURN,
    level_at,
    root_offset,
    square_of_nine_levels,
)


def test_full_turn_adds_two_to_the_root():
    # The defining property: 360 degrees around the spiral adds 2 to sqrt(price).
    price = 100.0
    after_one_turn = level_at(price, 360)
    assert math.sqrt(after_one_turn) == pytest.approx(math.sqrt(price) + ROOT_PER_TURN)


def test_a_perfect_square_lands_on_the_next_odd_square():
    # 25 -> root 5 -> +2 -> root 7 -> 49. The classic worked example.
    assert level_at(25.0, 360) == pytest.approx(49.0)
    assert level_at(49.0, -360) == pytest.approx(25.0)


def test_half_turn_is_half_the_root_offset():
    assert root_offset(180) == pytest.approx(ROOT_PER_TURN / 2)
    assert level_at(100.0, 180) == pytest.approx((10 + 1) ** 2)


def test_up_and_down_are_inverses():
    price = 337.5
    assert level_at(level_at(price, 90), -90) == pytest.approx(price)


def test_levels_straddle_the_anchor():
    price = 100.0
    levels = square_of_nine_levels(price)
    resistances = [lvl.price for lvl in levels if lvl.kind == "RESISTANCE"]
    supports = [lvl.price for lvl in levels if lvl.kind == "SUPPORT"]

    assert resistances and supports
    assert all(r > price for r in resistances)
    assert all(s < price for s in supports)


def test_larger_degrees_move_further_from_the_anchor():
    price = 100.0
    assert level_at(price, 45) < level_at(price, 90) < level_at(price, 360)
    assert level_at(price, -45) > level_at(price, -90) > level_at(price, -360)


def test_low_price_does_not_emit_a_zero_support():
    # sqrt(0.5) is ~0.707, so a full turn down would drive the root negative.
    levels = square_of_nine_levels(0.5)
    assert all(lvl.price > 0 for lvl in levels)


def test_non_positive_price_is_rejected():
    with pytest.raises(ValueError):
        square_of_nine_levels(0)
    with pytest.raises(ValueError):
        level_at(-10, 90)


def test_levels_are_classified_against_the_reference_not_the_anchor():
    # Anchor is a swing high at 100; the market has since fallen to 80. Levels
    # below the anchor but above 80 must read as resistance, not support.
    levels = square_of_nine_levels(100.0, reference=80.0)
    below_anchor_above_market = [
        lvl for lvl in levels if 80.0 < lvl.price < 100.0
    ]

    assert below_anchor_above_market
    assert all(lvl.direction == "DOWN" for lvl in below_anchor_above_market)
    assert all(lvl.kind == "RESISTANCE" for lvl in below_anchor_above_market)


def test_reference_defaults_to_the_anchor():
    levels = square_of_nine_levels(100.0)
    assert all(
        (lvl.kind == "RESISTANCE") == (lvl.price > 100.0) for lvl in levels
    )


def test_every_degree_yields_one_level_each_way():
    levels = square_of_nine_levels(100.0, degrees=(90, 180))
    assert len(levels) == 4
    assert {lvl.direction for lvl in levels} == {"UP", "DOWN"}
