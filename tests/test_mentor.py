"""Tests for the mentor's prompt building and response handling.

The network call itself is not tested here — that path is exercised against a
local stand-in for OpenRouter, since hitting the real API in a unit test costs
money and needs a key.
"""

import pytest

from gann.engine import analyze
from gann.mentor import MentorError, _normalise, build_user_prompt, summarise
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
    from gann.mentor import LANGUAGE_NAMES, SYSTEM_PROMPT

    hebrew = SYSTEM_PROMPT.format(language=LANGUAGE_NAMES["he"])
    assert "Write in Hebrew" in hebrew
    # Tickers must survive translation, or the summary stops matching the chart.
    assert "Ticker symbols stay as they are" in hebrew

    english = SYSTEM_PROMPT.format(language=LANGUAGE_NAMES["en"])
    assert "Write in English" in english


def test_empty_completion_is_a_retryable_error_type():
    # An empty completion is transient: the same prompt returns a good answer
    # on a retry, so it must not be indistinguishable from a bad request.
    from gann.mentor import EmptyCompletion, MentorError, _normalise

    with pytest.raises(EmptyCompletion):
        _normalise("  ")
    # Still a MentorError, so existing callers keep working.
    assert issubclass(EmptyCompletion, MentorError)
