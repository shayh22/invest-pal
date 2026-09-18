import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from gann.models import Candle  # noqa: E402


def make_candles(closes, *, start=None, spacing=timedelta(days=1), spread=1.0):
    """Build a daily series from a list of closes.

    Highs and lows sit `spread` either side of the close, which keeps the
    derived price unit predictable in tests.
    """
    start = start or datetime(2024, 1, 1, tzinfo=timezone.utc)
    candles = []
    for i, close in enumerate(closes):
        candles.append(
            Candle(
                time=start + spacing * i,
                open=close,
                high=close + spread,
                low=close - spread,
                close=close,
                volume=1000.0,
            )
        )
    return candles


@pytest.fixture
def candles_factory():
    return make_candles
