"""Tests for the opportunity score.

The score is a ranking, so the tests are mostly about *ordering* — that a
better-arranged chart outranks a worse one — rather than about the absolute
numbers, which are weights with no backtest behind them and would make for
tests that only restate the constants.
"""

from datetime import datetime, timedelta, timezone

import pytest

from gann.models import (
    Candle,
    GannAnalysis,
    GannAngle,
    SquareOfNineLevel,
    Swing,
    TimeCycle,
)
from gann.opportunity import (
    BALANCE_BAND,
    CYCLE_HORIZON_DAYS,
    MAX_REWARD_RISK,
    Opportunity,
    score,
    to_payload,
)

NOW = datetime(2026, 1, 1, tzinfo=timezone.utc)


def make_angle(name, current_price):
    return GannAngle(
        name=name,
        price_units=1,
        time_units=1,
        slope_per_bar=1.0,
        origin_index=0,
        origin_time=NOW - timedelta(days=60),
        origin_price=50.0,
        direction="UP",
        current_price=current_price,
    )


def make_analysis(
    *,
    last_price=100.0,
    levels=((90.0, "SUPPORT"), (130.0, "RESISTANCE")),
    one_by_one=100.0,
    cycle_days=5,
    swings=8,
    notes=(),
):
    """An analysis assembled directly, so each reading can be moved alone."""
    return GannAnalysis(
        symbol="TEST",
        timeframe="1d",
        as_of=NOW,
        last_price=last_price,
        price_unit_per_bar=1.0,
        swings=[
            Swing(index=i, time=NOW - timedelta(days=i), price=90.0, kind="LOW")
            for i in range(swings)
        ],
        angles=[make_angle("1x1", one_by_one)] if one_by_one is not None else [],
        square_of_nine=[
            SquareOfNineLevel(
                degrees=90, price=price, direction="UP", kind=kind
            )
            for price, kind in levels
        ],
        cycles=(
            [
                TimeCycle(
                    length_bars=10,
                    occurrences=3,
                    anchor_time=NOW - timedelta(days=10),
                    anchor_kind="LOW",
                    projected_time=NOW + timedelta(days=cycle_days),
                )
            ]
            if cycle_days is not None
            else []
        ),
        notes=list(notes),
    )


# ---------------------------------------------------------------------------
# Room versus risk
# ---------------------------------------------------------------------------


def test_more_room_above_outranks_less():
    roomy = score(make_analysis(levels=((99.0, "SUPPORT"), (130.0, "RESISTANCE"))), now=NOW)
    cramped = score(make_analysis(levels=((70.0, "SUPPORT"), (101.0, "RESISTANCE"))), now=NOW)
    assert roomy.room_score > cramped.room_score
    assert roomy.score > cramped.score


def test_the_reward_to_risk_is_reported_as_it_is_measured():
    # Support 10 below, resistance 30 above: three to one.
    scored = score(make_analysis(levels=((90.0, "SUPPORT"), (130.0, "RESISTANCE"))), now=NOW)
    assert scored.reward_risk == pytest.approx(3.0)
    assert scored.support == 90.0
    assert scored.resistance == 130.0


def test_an_extreme_ratio_is_capped_rather_than_allowed_to_dominate():
    # Support a hair below price: the ratio is enormous but says nothing.
    absurd = score(
        make_analysis(levels=((99.999, "SUPPORT"), (130.0, "RESISTANCE"))), now=NOW
    )
    honest = score(
        make_analysis(levels=((100 - 30 / MAX_REWARD_RISK, "SUPPORT"), (130.0, "RESISTANCE"))),
        now=NOW,
    )
    assert absurd.reward_risk > MAX_REWARD_RISK * 10
    assert absurd.room_score == honest.room_score == 1.0


def test_levels_all_on_one_side_score_nothing_rather_than_something_middling():
    one_sided = score(
        make_analysis(levels=((110.0, "RESISTANCE"), (130.0, "RESISTANCE"))), now=NOW
    )
    assert one_sided.room_score == 0.0
    assert one_sided.reward_risk is None
    assert one_sided.support is None


# ---------------------------------------------------------------------------
# Balance
# ---------------------------------------------------------------------------


def test_sitting_on_the_balance_line_scores_highest():
    on_it = score(make_analysis(last_price=100.0, one_by_one=100.0), now=NOW)
    stretched = score(make_analysis(last_price=100.0, one_by_one=96.0), now=NOW)
    assert on_it.balance_score == 1.0
    assert stretched.balance_score < on_it.balance_score


def test_beyond_the_band_the_balance_reading_is_spent():
    far = score(
        make_analysis(last_price=100.0, one_by_one=100.0 * (1 - BALANCE_BAND * 2)),
        now=NOW,
    )
    assert far.balance_score == 0.0


def test_the_bias_is_which_side_of_the_one_by_one_price_sits():
    assert score(make_analysis(last_price=100.0, one_by_one=98.0), now=NOW).bias == "LONG"
    assert score(make_analysis(last_price=100.0, one_by_one=102.0), now=NOW).bias == "SHORT"


def test_without_a_fan_there_is_no_bias_to_report():
    scored = score(make_analysis(one_by_one=None), now=NOW)
    assert scored.bias == "NONE"
    assert scored.balance_score == 0.0


# ---------------------------------------------------------------------------
# Time
# ---------------------------------------------------------------------------


def test_a_turn_due_sooner_outranks_one_further_out():
    soon = score(make_analysis(cycle_days=2), now=NOW)
    later = score(make_analysis(cycle_days=18), now=NOW)
    assert soon.cycle_score > later.cycle_score
    assert soon.days_to_cycle == pytest.approx(2.0)


def test_a_turn_past_the_horizon_counts_for_nothing():
    distant = score(make_analysis(cycle_days=CYCLE_HORIZON_DAYS + 10), now=NOW)
    assert distant.cycle_score == 0.0


def test_a_cycle_already_behind_us_is_not_a_turn_that_is_due():
    passed = score(make_analysis(cycle_days=-3), now=NOW)
    assert passed.cycle_score == 0.0
    assert passed.days_to_cycle is None


# ---------------------------------------------------------------------------
# Whether the reading can be trusted
# ---------------------------------------------------------------------------


def test_thin_pivots_lower_the_confidence():
    thin = score(make_analysis(swings=2), now=NOW)
    full = score(make_analysis(swings=8), now=NOW)
    assert thin.confidence < full.confidence
    assert thin.score < full.score


def test_every_caveat_the_engine_wrote_costs_confidence():
    quiet = score(make_analysis(notes=()), now=NOW)
    noisy = score(make_analysis(notes=("thin data", "narrow square")), now=NOW)
    assert noisy.confidence < quiet.confidence


def test_a_chart_with_no_geometry_at_all_scores_zero():
    empty = GannAnalysis(
        symbol="EMPTY",
        timeframe="1d",
        as_of=NOW,
        last_price=100.0,
        price_unit_per_bar=1.0,
    )
    assert score(empty, now=NOW).score == 0.0


# ---------------------------------------------------------------------------
# The whole thing
# ---------------------------------------------------------------------------


def test_the_score_never_leaves_its_range():
    best = score(
        make_analysis(
            levels=((99.0, "SUPPORT"), (200.0, "RESISTANCE")),
            one_by_one=100.0,
            cycle_days=0.5,
            swings=20,
        ),
        now=NOW,
    )
    worst = score(make_analysis(levels=(), one_by_one=None, cycle_days=None, swings=0), now=NOW)
    assert 0.0 <= worst.score <= best.score <= 1.0


def test_a_well_arranged_chart_outranks_a_badly_arranged_one_overall():
    good = make_analysis(
        levels=((97.0, "SUPPORT"), (140.0, "RESISTANCE")),
        one_by_one=100.0,
        cycle_days=3,
        swings=10,
    )
    poor = make_analysis(
        levels=((60.0, "SUPPORT"), (101.0, "RESISTANCE")),
        one_by_one=80.0,
        cycle_days=40,
        swings=2,
        notes=("thin data",),
    )
    assert score(good, now=NOW).score > score(poor, now=NOW).score


def test_scoring_is_deterministic_given_the_same_clock():
    analysis = make_analysis()
    assert score(analysis, now=NOW) == score(analysis, now=NOW)


def test_the_payload_shape_matches_the_frontend_contract():
    payload = to_payload(score(make_analysis(), now=NOW))
    assert set(payload) == {
        "score",
        "bias",
        "room_score",
        "balance_score",
        "cycle_score",
        "confidence",
        "support",
        "resistance",
        "reward_risk",
        "days_to_cycle",
    }
    assert isinstance(payload["score"], float)
    assert payload["bias"] in {"LONG", "SHORT", "NONE"}


def test_absent_readings_serialise_as_null_rather_than_as_zero():
    # A zero support would be a price; None is "there is no support below".
    payload = to_payload(
        score(make_analysis(levels=(), one_by_one=None, cycle_days=None), now=NOW)
    )
    assert payload["support"] is None
    assert payload["resistance"] is None
    assert payload["reward_risk"] is None
    assert payload["days_to_cycle"] is None
