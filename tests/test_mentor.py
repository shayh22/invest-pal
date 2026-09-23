"""Tests for the mentor's prompt building and response handling.

The network call itself is not tested here — that path is exercised against a
local stand-in for OpenRouter, since hitting the real API in a unit test costs
money and needs a key.
"""

import json
import urllib.error

import pytest

from gann import mentor
from gann.engine import analyze
from gann.mentor import (
    MentorError,
    QuotaExhausted,
    _normalise,
    build_user_prompt,
    summarise,
)
from tests.conftest import make_candles


def analysis():
    closes = []
    for i in range(120):
        closes.append(100 + i * 0.5 + (6 if i % 10 < 5 else -6))
    return analyze(make_candles(closes, spread=1.5), "TEST")


def test_prompt_carries_the_numbers_worth_explaining():
    prompt = build_user_prompt(analysis())

    assert "Asset: TEST" in prompt
    assert "Latest price:" in prompt
    assert "1x1 balance line" in prompt
    # The position relative to the balance line is the reading, so it must be
    # stated rather than left for the model to work out.
    assert "price is above it" in prompt or "price is below it" in prompt


def test_prompt_is_narrow_on_purpose():
    # Handing over all sixteen levels and seven rays yields a summary that
    # lists them instead of explaining them.
    prompt = build_user_prompt(analysis())

    assert prompt.count("Square of Nine") <= 2
    assert "2x1" not in prompt
    assert len(prompt.splitlines()) <= 8


def test_prompt_passes_engine_caveats_through():
    # A tight square is something the reader should hear about.
    pricey = analyze(
        make_candles([70000 + (i % 10) * 400 for i in range(80)], spread=300.0),
        "PRICEY",
    )
    assert any("Caveat" in line for line in build_user_prompt(pricey).splitlines())


def test_prompt_omits_sections_that_have_no_data():
    flat = analyze(make_candles([100.0] * 80, spread=0.0), "FLAT")
    prompt = build_user_prompt(flat)

    # No fan and no cycles on a flat series: the prompt must not claim any.
    assert "1x1 balance line" not in prompt
    assert "Strongest time cycle" not in prompt
    assert "Asset: FLAT" in prompt


def test_normalise_strips_wrapping_quotes():
    assert _normalise('"Two sentences. Like this."') == "Two sentences. Like this."
    assert _normalise("'Quoted.'") == "Quoted."
    # An apostrophe inside must survive.
    assert _normalise("Gann's method. Second sentence.") == "Gann's method. Second sentence."


def test_normalise_collapses_whitespace():
    assert _normalise("One.\n\n  Two.\t Three.") == "One. Two. Three."


def test_normalise_truncates_a_runaway_answer():
    long_text = "word " * 400
    out = _normalise(long_text, max_chars=100)

    assert len(out) <= 100
    assert out.endswith("…")


def test_normalise_rejects_an_empty_answer():
    # Better to store no summary than an empty one the UI would render as a gap.
    with pytest.raises(MentorError):
        _normalise("   \n  ")


def test_missing_key_is_a_clear_error(monkeypatch):
    monkeypatch.delenv("OPENROUTER_API_KEY", raising=False)
    with pytest.raises(MentorError, match="OPENROUTER_API_KEY"):
        summarise(analysis())


def test_prompt_language_is_explicit_in_the_system_prompt():
    from gann.mentor import LANGUAGE_NAMES, STYLE, SYSTEM_PROMPT

    hebrew = SYSTEM_PROMPT.format(language=LANGUAGE_NAMES["he"], style=STYLE["he"])
    assert "Write in Hebrew" in hebrew
    # Tickers must survive translation, or the summary stops matching the chart.
    assert "Ticker symbols stay as they are" in hebrew

    english = SYSTEM_PROMPT.format(language=LANGUAGE_NAMES["en"], style=STYLE["en"])
    assert "Write in English" in english


def test_empty_completion_is_a_retryable_error_type():
    # An empty completion is transient: the same prompt returns a good answer
    # on a retry, so it must not be indistinguishable from a bad request.
    from gann.mentor import EmptyCompletion, MentorError, _normalise

    with pytest.raises(EmptyCompletion):
        _normalise("  ")
    # Still a MentorError, so existing callers keep working.
    assert issubclass(EmptyCompletion, MentorError)


def test_model_is_chosen_explicit_then_env_then_default(monkeypatch):
    """Precedence matters: a CI variable must not override an explicit --model,
    and an unset variable must land on the cheap default rather than nothing."""
    seen: list[str] = []

    def record(prompt, *, api_key, model, timeout, language):
        seen.append(model)
        return "TEST sits above its balance line, with support holding at 98."

    monkeypatch.setattr(mentor, "_request", record)
    monkeypatch.setenv("OPENROUTER_API_KEY", "test-key")

    monkeypatch.delenv("OPENROUTER_MODEL", raising=False)
    summarise(analysis())

    monkeypatch.setenv("OPENROUTER_MODEL", "vendor/from-env")
    summarise(analysis())

    summarise(analysis(), model="vendor/explicit")

    assert seen == [mentor.DEFAULT_MODEL, "vendor/from-env", "vendor/explicit"]


def test_the_default_model_is_chosen_for_its_hebrew():
    """A change of default is a change to what the app costs to run and to
    what every Hebrew reader sees, so it should be deliberate."""
    assert mentor.DEFAULT_MODEL == "openai/gpt-5-mini"
    assert not mentor.is_free(mentor.DEFAULT_MODEL)
    assert mentor.is_free("openrouter/free")
    assert mentor.is_free("qwen/qwen3.8-27b:free")


# --- The free tier: rate limits, the daily cap, and the wrong language -------


class FakeHTTPError(urllib.error.HTTPError):
    def __init__(self, code, body, headers=None):
        super().__init__("https://openrouter.test", code, "error", headers or {}, None)
        self._body = body.encode("utf-8")

    def read(self, *args):
        return self._body


class FakeResponse:
    def __init__(self, payload):
        self._payload = json.dumps(payload).encode("utf-8")

    def __enter__(self):
        return self

    def __exit__(self, *exc):
        return False

    def read(self):
        return self._payload


def completion(text):
    return FakeResponse({"choices": [{"message": {"content": text}}]})


@pytest.fixture
def openrouter(monkeypatch):
    """Serves queued responses to _request and records every sleep."""
    queue: list = []
    sleeps: list[float] = []

    def urlopen(request, timeout):
        item = queue.pop(0)
        if isinstance(item, Exception):
            raise item
        return item

    monkeypatch.setattr(mentor.urllib.request, "urlopen", urlopen)
    monkeypatch.setattr(mentor, "_sleep", sleeps.append)
    monkeypatch.setattr(mentor, "_next_free_call", 0.0)
    monkeypatch.setenv("OPENROUTER_API_KEY", "test-key")
    monkeypatch.delenv("OPENROUTER_MODEL", raising=False)
    return queue, sleeps


def test_free_models_are_spaced_under_twenty_a_minute(openrouter):
    queue, sleeps = openrouter
    queue += [completion("TEST sits above its balance line, with support holding at 98."), completion("TEST sits above its balance line, with support holding at 98.")]

    summarise(analysis(), model="openrouter/free")
    summarise(analysis(), model="openrouter/free")

    # The second call waited out most of the interval; the first did not wait.
    assert len(sleeps) == 1
    assert 3.0 < sleeps[0] <= mentor.FREE_MIN_INTERVAL


def test_paid_models_are_not_slowed_down(openrouter):
    queue, sleeps = openrouter
    queue += [completion("TEST sits above its balance line, with support holding at 98."), completion("TEST sits above its balance line, with support holding at 98.")]

    summarise(analysis(), model="anthropic/claude-haiku-4.5")
    summarise(analysis(), model="anthropic/claude-haiku-4.5")

    assert sleeps == []


def test_the_daily_cap_is_not_retried(openrouter):
    """Retrying cannot succeed until tomorrow, so it has to stop at once —
    three attempts per note would spend a whole run's failures on nothing."""
    queue, _ = openrouter
    queue += [
        FakeHTTPError(
            429,
            '{"error":{"message":"Rate limit exceeded: free-models-per-day."}}',
        ),
        completion("never reached"),
    ]

    with pytest.raises(QuotaExhausted):
        summarise(analysis())
    assert len(queue) == 1


def test_a_per_minute_429_waits_as_told_and_retries(openrouter):
    queue, sleeps = openrouter
    queue += [
        FakeHTTPError(429, "slow down", {"Retry-After": "7"}),
        completion("TEST sits above its balance line, with support holding at 98."),
    ]

    assert summarise(analysis()) == "TEST sits above its balance line, with support holding at 98."
    assert 7.0 in sleeps


def test_a_429_in_the_body_is_treated_like_one_in_the_status(openrouter):
    queue, sleeps = openrouter
    queue += [
        FakeResponse({"error": {"code": 429, "message": "upstream busy"}}),
        completion("TEST sits above its balance line, with support holding at 98."),
    ]

    assert summarise(analysis()) == "TEST sits above its balance line, with support holding at 98."
    assert mentor.BACKOFF_SECONDS[0] in sleeps


def test_a_hebrew_note_written_in_english_is_asked_for_again(openrouter):
    queue, _ = openrouter
    queue += [
        completion("TEST sits above its balance line, with support holding at 98."),
        completion("TEST נמצא מעל קו האיזון של גאן, והתמיכה מחזיקה ב-98."),
    ]

    assert summarise(analysis(), language="he").startswith("TEST נמצא")


def test_a_model_that_never_writes_hebrew_gives_no_note(openrouter):
    queue, _ = openrouter
    queue += [completion("TEST sits above its balance line, with support holding at 98.")] * 3

    with pytest.raises(MentorError, match="Hebrew"):
        summarise(analysis(), language="he")


# --- Notes that break the brief ----------------------------------------------


@pytest.mark.parametrize(
    "bad",
    [
        # Each of these was stored by the first run on the free router.
        "NVDA should hold above its 1x1 line. We predict a move to 190.",
        "Here's a thinking process: 1. **Analyze User Input:** - Asset: ADBE",
        "User Safety: safe",
        "We need to produce exactly two sentences, no more than 45 words total.",
        " ".join(["word"] * 80),
        "Neutral.",
    ],
)
def test_a_note_that_breaks_the_brief_is_asked_for_again(openrouter, bad):
    queue, _ = openrouter
    queue += [completion(bad), completion("TEST sits above its balance line, with support holding at 98.")]

    assert summarise(analysis()).startswith("TEST sits above")
    assert queue == []


def test_the_brief_is_not_broken_by_ordinary_words():
    from gann.mentor import rule_problem

    # "shoulder" is not "should", and a Hebrew note has no English to trip on.
    assert rule_problem("A head and shoulders shape sits under the 1x1 line.") is None
    assert rule_problem("המחיר נמצא מעל קו האיזון של גאן. התמיכה ב-329.84.") is None
    assert rule_problem("Price is expected to rise.") is not None


def test_a_model_that_keeps_breaking_the_brief_gives_no_note(openrouter):
    queue, _ = openrouter
    queue += [completion("TEST should keep rising above its balance line from here.")] * 3

    with pytest.raises(MentorError, match="forbidden"):
        summarise(analysis())


def test_the_request_asks_the_default_model_to_reason_briefly(monkeypatch):
    sent = []

    def urlopen(request, timeout):
        sent.append(json.loads(request.data))
        return completion("TEST sits above its balance line, with support holding at 98.")

    monkeypatch.setattr(mentor.urllib.request, "urlopen", urlopen)
    monkeypatch.setenv("OPENROUTER_API_KEY", "test-key")
    monkeypatch.delenv("OPENROUTER_MODEL", raising=False)

    summarise(analysis(), language="en")

    assert sent[0]["model"] == "openai/gpt-5-mini"
    # Brief, and kept out of the reply so it can never be stored as the note.
    assert sent[0]["reasoning"] == {"effort": "low", "exclude": True}


def test_hebrew_notes_are_asked_for_in_hebrew_terms():
    from gann.mentor import LANGUAGE_NAMES, STYLE, SYSTEM_PROMPT

    hebrew = SYSTEM_PROMPT.format(language=LANGUAGE_NAMES["he"], style=STYLE["he"])
    # The terms the panels and the glossary use, so the note matches them.
    for term in ("ריבוע התשע", "קו האיזון 1x1 של גאן", "תמיכה", "התנגדות", "נרות"):
        assert term in hebrew
    assert "באוקטובר" in hebrew

    english = SYSTEM_PROMPT.format(language=LANGUAGE_NAMES["en"], style=STYLE["en"])
    assert "ריבוע" not in english
    assert english.rstrip().endswith("Ticker symbols stay as they are.")
