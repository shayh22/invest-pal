"""The AI mentor: turns a Gann analysis into two plain sentences.

Runs inside the refresh job rather than in the browser or an edge function, for
three reasons: the analysis is already in hand at that moment, the API key stays
in the same place as the service role key, and the result is cached in
gann_signals.ai_summary — so it costs one call per asset per refresh instead of
one per page view.

Uses OpenRouter, per the project brief. Stdlib only, like the rest of the
engine. If you would rather call Anthropic directly, `_request` is the only
function that needs replacing.
"""

from __future__ import annotations

import json
import os
import urllib.error
import urllib.request

from gann.models import GannAnalysis

DEFAULT_API_URL = "https://openrouter.ai/api/v1/chat/completions"


def api_url() -> str:
    """Endpoint to call. Overridable for a proxy, a gateway, or a test double."""
    return os.environ.get("OPENROUTER_BASE_URL") or DEFAULT_API_URL

# Slugs are OpenRouter's, not Anthropic's ("anthropic/claude-opus-5", not
# "claude-opus-5"). Override with OPENROUTER_MODEL — a smaller model is a
# reasonable trade here, since the task is rephrasing numbers rather than
# reasoning about them.
DEFAULT_MODEL = "anthropic/claude-opus-5"

#: Retried; anything else fails fast.
RETRY_STATUSES = frozenset({408, 429, 500, 502, 503, 504})


class MentorError(RuntimeError):
    """Raised when a summary could not be generated."""


#: Languages the mentor can write in, matching the frontend's language toggle.
LANGUAGE_NAMES = {"en": "English", "he": "Hebrew"}

SYSTEM_PROMPT = """\
You explain technical analysis to people who have never traded before, inside \
a paper-trading app where all money is virtual.

Write exactly two sentences, in plain language, for someone who does not know \
what a Gann angle or a Square of Nine is. Explain what the numbers describe \
about the market right now, in concrete terms.

Rules you must follow:
- Never predict what price will do. These are historical geometry, not forecasts.
- Never tell the person to buy, sell, or hold. No advice of any kind.
- Do not use the words "should", "will", "recommend", "expect" or "predict".
- Do not use jargon without explaining it in the same breath.
- No preamble, no bullet points, no headings. Two sentences only.
- Write in {language}, and in nothing else. Ticker symbols stay as they are.\
"""


def build_user_prompt(analysis: GannAnalysis) -> str:
    """Flatten the analysis into the few numbers worth explaining.

    Deliberately narrow: the model gets the balance line, the nearest level each
    way and the next cycle date, not the whole payload. Handing it sixteen
    levels and seven rays produces a summary that lists them rather than one
    that says what they mean.
    """
    lines = [
        f"Asset: {analysis.symbol}",
        f"Latest price: {analysis.last_price:,.2f}",
    ]

    one_by_one = next((a for a in analysis.angles if a.name == "1x1"), None)
    if one_by_one:
        position = "above" if analysis.last_price >= one_by_one.current_price else "below"
        lines.append(
            f"Gann 1x1 balance line: {one_by_one.current_price:,.2f} "
            f"(price is {position} it), drawn from the "
            f"{'low' if one_by_one.direction == 'UP' else 'high'} of "
            f"{one_by_one.origin_price:,.2f} on "
            f"{one_by_one.origin_time.date().isoformat()}"
        )

    supports = sorted(
        (lvl for lvl in analysis.square_of_nine if lvl.kind == "SUPPORT"),
        key=lambda lvl: -lvl.price,
    )
    resistances = sorted(
        (lvl for lvl in analysis.square_of_nine if lvl.kind == "RESISTANCE"),
        key=lambda lvl: lvl.price,
    )
    if supports:
        lines.append(f"Nearest Square of Nine support: {supports[0].price:,.2f}")
    if resistances:
        lines.append(f"Nearest Square of Nine resistance: {resistances[0].price:,.2f}")

    if analysis.cycles:
        cycle = analysis.cycles[0]
        lines.append(
            f"Strongest time cycle: {cycle.length_bars} bars between "
            f"{cycle.anchor_kind.lower()}s, seen {cycle.occurrences} times, "
            f"next due {cycle.projected_time.date().isoformat()}"
        )

    for note in analysis.notes:
        lines.append(f"Caveat the engine flagged: {note}")

    return "\n".join(lines)


def _request(
    prompt: str, *, api_key: str, model: str, timeout: float, language: str
) -> str:
    system = SYSTEM_PROMPT.format(
        language=LANGUAGE_NAMES.get(language, LANGUAGE_NAMES["en"])
    )
    body = json.dumps(
        {
            "model": model,
            "messages": [
                {"role": "system", "content": system},
                {"role": "user", "content": prompt},
            ],
            # Two sentences; the cap is a backstop, not the shaping mechanism.
            "max_tokens": 300,
            "temperature": 0.3,
        }
    ).encode("utf-8")

    request = urllib.request.Request(
        api_url(),
        data=body,
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
            # OpenRouter attributes traffic with these; both are optional.
            "HTTP-Referer": "https://github.com/shayh22/invest-pal",
            "X-Title": "invest-pal",
        },
        method="POST",
    )

    with urllib.request.urlopen(request, timeout=timeout) as response:
        payload = json.loads(response.read().decode("utf-8"))

    choices = payload.get("choices") or []
    if not choices:
        # OpenRouter reports upstream problems in the body with a 200.
        detail = (payload.get("error") or {}).get("message", "no choices returned")
        raise MentorError(f"OpenRouter returned no completion: {detail}")

    content = (choices[0].get("message") or {}).get("content") or ""
    return content.strip()


def _normalise(text: str, *, max_chars: int = 600) -> str:
    """Tidy the model's output without silently rewriting it."""
    cleaned = " ".join(text.split())
    # Models sometimes wrap a short answer in quotes.
    if len(cleaned) >= 2 and cleaned[0] in "\"'" and cleaned[-1] == cleaned[0]:
        cleaned = cleaned[1:-1].strip()
    if not cleaned:
        raise MentorError("The model returned an empty summary.")
    if len(cleaned) > max_chars:
        cleaned = cleaned[: max_chars - 1].rstrip() + "…"
    return cleaned


def summarise(
    analysis: GannAnalysis,
    *,
    api_key: str | None = None,
    model: str | None = None,
    timeout: float = 45.0,
    attempts: int = 3,
    language: str = "en",
) -> str:
    """Two sentences explaining `analysis`.

    Raises MentorError rather than returning a placeholder: a signal with no
    summary is shown without one, which is better than showing invented text.
    """
    key = api_key or os.environ.get("OPENROUTER_API_KEY", "")
    if not key:
        raise MentorError("OPENROUTER_API_KEY is not set.")

    prompt = build_user_prompt(analysis)
    chosen_model = model or os.environ.get("OPENROUTER_MODEL") or DEFAULT_MODEL
    last_error: Exception | None = None

    for attempt in range(attempts):
        try:
            return _normalise(
                _request(
                    prompt,
                    api_key=key,
                    model=chosen_model,
                    timeout=timeout,
                    language=language,
                )
            )
        except urllib.error.HTTPError as error:
            detail = error.read().decode("utf-8", errors="replace")[:300]
            if error.code not in RETRY_STATUSES or attempt == attempts - 1:
                raise MentorError(
                    f"OpenRouter request failed (HTTP {error.code}): {detail}"
                ) from error
            last_error = error
        except (urllib.error.URLError, TimeoutError) as error:
            if attempt == attempts - 1:
                raise MentorError(f"Could not reach OpenRouter: {error}") from error
            last_error = error
        except json.JSONDecodeError as error:
            raise MentorError("OpenRouter response was not JSON.") from error

    raise MentorError(f"OpenRouter request failed after {attempts} attempts: {last_error}")
