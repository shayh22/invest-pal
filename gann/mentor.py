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
import re
import time
import urllib.error
import urllib.request

from gann.models import GannAnalysis

DEFAULT_API_URL = "https://openrouter.ai/api/v1/chat/completions"


def api_url() -> str:
    """Endpoint to call. Overridable for a proxy, a gateway, or a test double."""
    return os.environ.get("OPENROUTER_BASE_URL") or DEFAULT_API_URL

# Slugs are OpenRouter's ("anthropic/claude-haiku-4.5", not "claude-haiku-4.5").
# Override with OPENROUTER_MODEL.
#
# The default is OpenAI's GPT-5 mini, chosen for its Hebrew. The free router
# cost nothing but wrote usable Hebrew for only 54 of 74 assets on its first
# strict run, and some of what passed was wrong ("ריבוע החמש" for the Square of
# Nine). At about 148 notes a day this is roughly $2 a month.
#
# It is a reasoning model, and its hidden reasoning is billed as output. The
# engine has already done the thinking; the model only has to put a handful
# of numbers into two sentences, so the request asks it to reason briefly
# (REASONING below).
#
# Set OPENROUTER_MODEL to override: "openrouter/free" to pay nothing (the
# rate limits and refusals below then apply), or anthropic/claude-haiku-4.5,
# which wrote 16 clean notes out of 16 in both languages when measured.
DEFAULT_MODEL = "openai/gpt-5-mini"

#: Sent with every request. Models that do not reason ignore it; for those that
#: do, a short pass is plenty for two sentences, and the reasoning text is kept
#: out of the reply so it can never be stored as the note.
REASONING = {"effort": "low", "exclude": True}

#: Retried; anything else fails fast.
RETRY_STATUSES = frozenset({408, 429, 500, 502, 503, 504})

#: OpenRouter allows free models 20 requests a minute. Spacing calls a little
#: wider than 3s keeps a whole run under that rather than meeting it as 429s.
FREE_MIN_INTERVAL = 3.2

#: How long a 429 without a Retry-After waits before the next attempt.
BACKOFF_SECONDS = (5.0, 15.0, 30.0)
MAX_BACKOFF_SECONDS = 60.0

#: Seam for tests, which should not sleep.
_sleep = time.sleep
_next_free_call = 0.0


def is_free(model: str) -> bool:
    return model == "openrouter/free" or model.endswith(":free")


class MentorError(RuntimeError):
    """Raised when a summary could not be generated."""


class Retryable(MentorError):
    """Transient: the same request may well succeed if sent again."""


class RateLimited(Retryable):
    """A 429 that is not the daily cap. Worth a retry after a pause."""

    def __init__(self, message: str, *, retry_after: float | None = None):
        super().__init__(message)
        self.retry_after = retry_after


class EmptyCompletion(Retryable):
    """The model returned no text. Transient — worth retrying."""


class WrongLanguage(Retryable):
    """The model answered in a language other than the one asked for.

    Retryable because the free router picks a model per request, and the next
    one usually does write the language asked for.
    """


class QuotaExhausted(MentorError):
    """The account's daily allowance of free-model requests is spent.

    Nothing will succeed again until it resets, so the caller should stop
    asking for the rest of the run rather than spend a failure on every asset.
    """


# OpenRouter names the limit in the error text: "free-models-per-day".
_DAILY_CAP = re.compile(r"per[-_ ]day", re.IGNORECASE)

#: A letter of the language's own script. A summary without one was not
#: written in that language, whatever else it is. English has no entry: Latin
#: letters are no evidence either way, since tickers are Latin in every note.
SCRIPT = {"he": re.compile(r"[\u05d0-\u05ea]")}


class BrokeTheRules(Retryable):
    """The note breaks the brief: advice or prediction, or it is not a note.

    Retryable for the same reason as WrongLanguage. On the free router this
    was not rare: the first run stored English notes saying "should" and
    "predict" beside a Buy button, and notes that were the model's own
    working ("Here's a thinking process: 1. Analyze User Input…").
    """


#: The words SYSTEM_PROMPT forbids. Whole words, so "shoulder" — as in head and
#: shoulders — is not caught by "should".
FORBIDDEN = re.compile(
    r"\b(should|will|recommend\w*|expect\w*|predict\w*)\b", re.IGNORECASE
)

#: Signs that the reply is the model thinking aloud, or talking about the
#: prompt, rather than the two sentences asked for.
LEAKED = re.compile(
    r"thinking process|user (input|safety)|\bwe need to\b|\bthe user\b"
    r"|\btwo sentences\b|\bexactly two\b|\bwords total\b|\*\*",
    re.IGNORECASE,
)

#: The prompt asks for at most 45 words. Well past that is not a longer note;
#: it is something else. Well short of it is not a note either: the free router
#: sometimes hands the prompt to a content-safety classifier, whose whole reply
#: is "User Safety: safe", and six of those were stored on the first run.
MAX_WORDS = 70
MIN_WORDS = 8


def rule_problem(text: str) -> str | None:
    """Why `text` cannot be shown as a mentor note, or None if it can."""
    words = len(text.split())
    if words > MAX_WORDS or words < MIN_WORDS:
        return f"{words} words, not two sentences"
    if LEAKED.search(text):
        return f"reads as the model's working: {text[:80]}"
    forbidden = sorted({match.lower() for match in FORBIDDEN.findall(text)})
    if forbidden:
        return f"uses forbidden words {forbidden}"
    return None


def _rate_limited(message: str, retry_after: float | None = None) -> MentorError:
    if _DAILY_CAP.search(message):
        return QuotaExhausted(f"Daily free-model allowance spent: {message}")
    return RateLimited(f"Rate limited: {message}", retry_after=retry_after)


def _retry_after(value: str | None) -> float | None:
    try:
        return max(0.0, float(value)) if value else None
    except ValueError:
        return None


#: Languages the mentor can write in, matching the frontend's language toggle.
LANGUAGE_NAMES = {"en": "English", "he": "Hebrew"}

SYSTEM_PROMPT = """\
You explain technical analysis to people who have never traded before, inside \
a paper-trading app where all money is virtual.

Write exactly two sentences, no more than 45 words in total. Say what the \
numbers mean for this market right now, in plain language.

Rules you must follow:
- Never predict what price will do. These are historical geometry, not forecasts.
- Never tell the person to buy, sell, or hold. No advice of any kind.
- Do not use the words "should", "will", "recommend", "expect" or "predict".
- Do not define the indicators or explain how they are calculated. Name them \
plainly and say what they show.
- Keep each sentence short enough to read in one breath.
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
            # Generous because a reasoning model's thinking counts against the
            # cap too; at 300 it could run out before writing a word, which
            # would read as an empty completion. Only tokens used are billed.
            "max_tokens": 2000,
            "temperature": 0.3,
            "reasoning": REASONING,
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

    global _next_free_call
    if is_free(model):
        wait = _next_free_call - time.monotonic()
        if wait > 0:
            _sleep(wait)
        _next_free_call = time.monotonic() + FREE_MIN_INTERVAL

    try:
        with urllib.request.urlopen(request, timeout=timeout) as response:
            payload = json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as error:
        if error.code != 429:
            raise
        detail = error.read().decode("utf-8", errors="replace")[:300]
        raise _rate_limited(
            detail, _retry_after(error.headers.get("Retry-After"))
        ) from error

    choices = payload.get("choices") or []
    if not choices:
        # OpenRouter reports upstream problems in the body with a 200. On the
        # free router that is mostly a busy upstream, which is worth a retry.
        error = payload.get("error") or {}
        detail = error.get("message", "no choices returned")
        if error.get("code") == 429:
            raise _rate_limited(detail)
        if error.get("code") in RETRY_STATUSES:
            raise Retryable(f"OpenRouter returned no completion: {detail}")
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
        raise EmptyCompletion("The model returned an empty summary.")
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
            text = _normalise(
                _request(
                    prompt,
                    api_key=key,
                    model=chosen_model,
                    timeout=timeout,
                    language=language,
                )
            )
            script = SCRIPT.get(language)
            if script and not script.search(text):
                raise WrongLanguage(
                    f"Asked for {LANGUAGE_NAMES[language]}, got: {text[:80]}"
                )
            problem = rule_problem(text)
            if problem:
                raise BrokeTheRules(problem)
            return text
        except EmptyCompletion as error:
            # Observed in practice: a completion arrives with finish_reason
            # "stop" and no content at all. Retrying the same prompt returns a
            # good answer, so this is transient rather than a bad request.
            if attempt == attempts - 1:
                raise MentorError(
                    f"The model returned an empty summary {attempts} times."
                ) from error
            last_error = error
        except Retryable as error:
            if attempt == attempts - 1:
                raise MentorError(f"{error} ({attempts} attempts)") from error
            if isinstance(error, RateLimited):
                backoff = BACKOFF_SECONDS[min(attempt, len(BACKOFF_SECONDS) - 1)]
                wait = error.retry_after if error.retry_after is not None else backoff
                _sleep(min(wait, MAX_BACKOFF_SECONDS))
            last_error = error
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
