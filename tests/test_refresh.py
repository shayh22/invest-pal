"""The refresh loop's handling of the mentor, with the network faked out."""

from gann import refresh as refresh_module
from gann.mentor import MentorError, QuotaExhausted
from tests.conftest import make_candles


class FakeClient:
    def __init__(self, tickers):
        self.assets = [{"id": i, "ticker": t} for i, t in enumerate(tickers)]
        self.rows = []

    def list_assets(self):
        return self.assets

    def delete_expired_signals(self, asset_id, timeframe):
        pass

    def insert_signal(self, row):
        self.rows.append(row)


def setup(monkeypatch, tickers, summarise):
    client = FakeClient(tickers)
    closes = [100 + i * 0.5 + (6 if i % 10 < 5 else -6) for i in range(120)]
    monkeypatch.setattr(refresh_module.SupabaseRest, "from_env", lambda: client)
    monkeypatch.setattr(
        refresh_module,
        "fetch_candles",
        lambda *a, **k: make_candles(closes, spread=1.5),
    )
    monkeypatch.setattr(refresh_module, "summarise", summarise)
    monkeypatch.setenv("OPENROUTER_API_KEY", "test-key")
    return client


def test_the_daily_cap_stops_the_notes_but_not_the_signals(monkeypatch):
    calls = []

    def summarise(analysis, *, language):
        calls.append((analysis.symbol, language))
        if len(calls) > 3:
            raise QuotaExhausted("free-models-per-day")
        return f"{language} note"

    client = setup(monkeypatch, ["AAA", "BBB", "CCC", "DDD"], summarise)

    assert refresh_module.refresh(languages=("en", "he")) == 0

    # AAA both, BBB English, then the cap on BBB's Hebrew — and no calls after.
    assert len(calls) == 4
    assert [row["ai_summaries"] for row in client.rows] == [
        {"en": "en note", "he": "he note"},
        {"en": "en note"},
        {},
        {},
    ]
    # Every signal still refreshed.
    assert len(client.rows) == 4


def test_an_ordinary_mentor_failure_skips_only_that_note(monkeypatch):
    def summarise(analysis, *, language):
        if language == "he":
            raise MentorError("no Hebrew")
        return "en note"

    client = setup(monkeypatch, ["AAA", "BBB"], summarise)

    assert refresh_module.refresh(languages=("en", "he")) == 0
    assert [row["ai_summaries"] for row in client.rows] == [
        {"en": "en note"},
        {"en": "en note"},
    ]
