"""Rank assets by how well their Gann geometry lines up.

The app can already tell you what Gann says about an asset you have chosen. The
harder question, and the one people actually ask, is *which* asset to look at.
This answers it by scoring every analysis on the same four readings and sorting.

What it is not: a forecast, or a recommendation. Gann's geometry describes
where price has turned before. A high score here means "this chart's geometry
is unusually well arranged right now", nothing more, and the app says so where
the ranking is shown.

The four readings, and why each one:

1.  **Room versus risk.** The distance from price up to the nearest resistance,
    against the distance down to the nearest support. This is the only reading
    with a direct trading meaning: a chart with a support just underneath and
    open space above offers a definable stop and somewhere to go. Capped,
    because a ratio of 40 means the nearest support is a rounding error away,
    not that the trade is forty times better than even.

2.  **Balance.** Where the last close sits against the 1x1 — Gann's own
    trend test. Above it is a bull position, below it a bear one. Scored on
    *proximity* rather than distance: the 1x1 is where the decision is cheap,
    and a price stretched far from it has already made its move.

3.  **A turn due.** Gann's central claim is that time turns markets. A
    projected cycle landing soon scores; one months out does not.

4.  **Whether the reading can be trusted at all.** Few pivots, no fan, a
    Square of Nine whose turns are a fraction of a percent apart — the engine
    already records these as notes, and a score computed from thin data should
    say so rather than compete with a score computed from a clean one.

The weights are stated in one place below and are deliberately round numbers.
There is no backtest behind them and inventing one would be dishonest; they
express which readings matter more, not a calibrated edge.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Literal

from gann.models import GannAnalysis

Bias = Literal["LONG", "SHORT", "NONE"]

#: How much each reading contributes. They sum to 1.0.
WEIGHT_ROOM = 0.40
WEIGHT_BALANCE = 0.25
WEIGHT_CYCLE = 0.20
WEIGHT_CONFIDENCE = 0.15

#: A reward-to-risk beyond this is treated as the same as this. Past roughly
#: three-to-one the number is being driven by a support that happens to sit very
#: close, not by genuine room above.
MAX_REWARD_RISK = 3.0

#: A cycle landing within this many days counts as "due"; beyond it, nothing.
CYCLE_HORIZON_DAYS = 21.0

#: Being within this fraction of the 1x1 counts as balanced.
BALANCE_BAND = 0.08

#: Swings needed before the geometry is treated as fully trustworthy.
SWINGS_FOR_CONFIDENCE = 6


@dataclass(frozen=True)
class Opportunity:
    """One asset's score, with the parts that produced it.

    The parts are kept rather than folded away because a ranking nobody can
    interrogate is a ranking nobody should act on. The UI shows them.
    """

    symbol: str
    score: float
    bias: Bias
    room_score: float
    balance_score: float
    cycle_score: float
    confidence: float
    #: The levels the room reading came from, for display. None when absent.
    support: float | None
    resistance: float | None
    reward_risk: float | None
    #: Days until the nearest projected cycle, or None.
    days_to_cycle: float | None


def _clamp(value: float, low: float = 0.0, high: float = 1.0) -> float:
    return max(low, min(high, value))


def _nearest_levels(analysis: GannAnalysis) -> tuple[float | None, float | None]:
    """The closest Square of Nine support below and resistance above."""
    price = analysis.last_price
    supports = [l.price for l in analysis.square_of_nine if l.price < price]
    resistances = [l.price for l in analysis.square_of_nine if l.price > price]
    return (max(supports) if supports else None, min(resistances) if resistances else None)


def _room_reading(
    analysis: GannAnalysis,
) -> tuple[float, float | None, float | None, float | None]:
    """Score the space above against the space below."""
    support, resistance = _nearest_levels(analysis)
    price = analysis.last_price
    if support is None or resistance is None or price <= 0:
        # No bracket, so nothing to say. Scored at zero rather than at a
        # neutral half: an asset whose levels all sit on one side is not a
        # middling opportunity, it is one this reading cannot see.
        return 0.0, support, resistance, None

    risk = price - support
    reward = resistance - price
    if risk <= 0:
        return 0.0, support, resistance, None

    ratio = reward / risk
    return _clamp(ratio / MAX_REWARD_RISK), support, resistance, ratio


def _balance_reading(analysis: GannAnalysis) -> tuple[float, Bias]:
    """Score proximity to the 1x1, and read the bias from which side it is on."""
    one_by_one = next((a for a in analysis.angles if a.name == "1x1"), None)
    price = analysis.last_price
    if one_by_one is None or price <= 0 or one_by_one.current_price <= 0:
        return 0.0, "NONE"

    bias: Bias = "LONG" if price >= one_by_one.current_price else "SHORT"
    distance = abs(price - one_by_one.current_price) / price
    # 1.0 sitting on the line, falling to 0 at the edge of the band.
    return _clamp(1.0 - distance / BALANCE_BAND), bias


def _cycle_reading(
    analysis: GannAnalysis, now: datetime
) -> tuple[float, float | None]:
    """Score how soon the nearest projected turn lands."""
    ahead = [
        (c.projected_time - now).total_seconds() / 86400.0
        for c in analysis.cycles
        if c.projected_time > now
    ]
    if not ahead:
        return 0.0, None
    days = min(ahead)
    return _clamp(1.0 - days / CYCLE_HORIZON_DAYS), days


def _confidence_reading(analysis: GannAnalysis) -> float:
    """How much of the geometry actually resolved."""
    # Pivots are what everything else is built from.
    score = _clamp(len(analysis.swings) / SWINGS_FOR_CONFIDENCE)
    if not analysis.angles:
        score *= 0.5
    if not analysis.square_of_nine:
        score *= 0.5
    # Every note the engine wrote is a caveat it wanted the reader to see.
    score *= _clamp(1.0 - 0.15 * len(analysis.notes))
    return _clamp(score)


def score(analysis: GannAnalysis, *, now: datetime | None = None) -> Opportunity:
    """Score one analysis. Deterministic given the same analysis and clock."""
    moment = now or datetime.now(timezone.utc)
    room, support, resistance, reward_risk = _room_reading(analysis)
    balance, bias = _balance_reading(analysis)
    cycle, days_to_cycle = _cycle_reading(analysis, moment)
    confidence = _confidence_reading(analysis)

    total = (
        WEIGHT_ROOM * room
        + WEIGHT_BALANCE * balance
        + WEIGHT_CYCLE * cycle
        + WEIGHT_CONFIDENCE * confidence
    )

    return Opportunity(
        symbol=analysis.symbol,
        score=round(_clamp(total), 4),
        bias=bias,
        room_score=round(room, 4),
        balance_score=round(balance, 4),
        cycle_score=round(cycle, 4),
        confidence=round(confidence, 4),
        support=round(support, 8) if support is not None else None,
        resistance=round(resistance, 8) if resistance is not None else None,
        reward_risk=round(reward_risk, 4) if reward_risk is not None else None,
        days_to_cycle=round(days_to_cycle, 2) if days_to_cycle is not None else None,
    )


def to_payload(opportunity: Opportunity) -> dict:
    """Serialise into the `opportunity` block of gann_signals.payload.

    Matched on the other side by src/types/gann.ts, like the rest of the
    payload, so the two change together.
    """
    return {
        "score": opportunity.score,
        "bias": opportunity.bias,
        "room_score": opportunity.room_score,
        "balance_score": opportunity.balance_score,
        "cycle_score": opportunity.cycle_score,
        "confidence": opportunity.confidence,
        "support": opportunity.support,
        "resistance": opportunity.resistance,
        "reward_risk": opportunity.reward_risk,
        "days_to_cycle": opportunity.days_to_cycle,
    }
