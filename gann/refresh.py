"""Refresh the gann_signals cache.

Fetches candles for every asset in the database, runs the engine and writes the
result to Supabase. The browser reads that table; it never calls this code, so
there is no service to host — run this on a schedule (cron, a GitHub Action) or
by hand.

    SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... python -m gann.refresh

Set OPENROUTER_API_KEY as well to have the AI mentor write a plain-language
summary for each signal. Without it the signals are still computed and cached,
just without the summary.

Options:
    --timeframe 1d      candle interval to analyse
    --range 2y          how much history to fetch
    --ttl-hours 6       how long the written signal stays fresh
    --symbol AAPL       limit to one ticker (repeatable)
    --no-ai             skip the mentor even if a key is set
    --dry-run           compute and print, write nothing
"""

from __future__ import annotations

import argparse
import json
import os
import sys
from datetime import datetime, timedelta, timezone

from gann.engine import analyze, to_payload
from gann.mentor import MentorError, QuotaExhausted, summarise
from gann.supabase_io import SupabaseError, SupabaseRest
from gann.yahoo import MarketDataError, fetch_candles


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="python -m gann.refresh",
        description="Compute Gann signals and cache them in Supabase.",
    )
    parser.add_argument("--timeframe", default="1d", help="candle interval (default 1d)")
    parser.add_argument("--range", dest="range_", default="2y", help="history to fetch")
    parser.add_argument("--ttl-hours", type=float, default=6.0, help="signal freshness")
    parser.add_argument(
        "--symbol",
        action="append",
        dest="symbols",
        help="only this ticker (repeatable)",
    )
    parser.add_argument(
        "--lang",
        default="en",
        help="comma-separated mentor languages, e.g. en,he (default en)",
    )
    parser.add_argument(
        "--no-ai",
        action="store_true",
        help="skip the AI mentor summary even when a key is available",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="compute and print without writing to the database",
    )
    return parser


def refresh(
    *,
    timeframe: str = "1d",
    range_: str = "2y",
    ttl_hours: float = 6.0,
    symbols: list[str] | None = None,
    languages: tuple[str, ...] = ("en",),
    no_ai: bool = False,
    dry_run: bool = False,
) -> int:
    """Returns a process exit code: 0 if every asset succeeded."""
    client = SupabaseRest.from_env()
    assets = client.list_assets()
    if symbols:
        wanted = {symbol.upper() for symbol in symbols}
        assets = [a for a in assets if a["ticker"].upper() in wanted]

    if not assets:
        print("No matching assets found.", file=sys.stderr)
        return 1

    expires_at = datetime.now(timezone.utc) + timedelta(hours=ttl_hours)
    failures = 0

    want_summary = not no_ai and bool(os.environ.get("OPENROUTER_API_KEY"))
    if not want_summary and not no_ai:
        print("  (OPENROUTER_API_KEY not set — skipping mentor summaries)")

    for asset in sorted(assets, key=lambda a: a["ticker"]):
        ticker = asset["ticker"]
        try:
            candles = fetch_candles(ticker, range_=range_, interval=timeframe)
            analysis = analyze(candles, ticker, timeframe=timeframe)
            payload = to_payload(analysis)
        except (MarketDataError, ValueError) as error:
            # One bad ticker must not abort the run for the others.
            print(f"  {ticker}: SKIPPED — {error}", file=sys.stderr)
            failures += 1
            continue

        # A failed summary must not cost us the signal: the analysis is the
        # valuable part, and the panel renders fine without a mentor note.
        #
        # Note this drops any summary the previous run wrote. That is deliberate
        # — the prices it described have just been replaced, and a note that
        # contradicts the levels on screen is worse than no note at all.
        summaries: dict[str, str] = {}
        if want_summary:
            for language in languages:
                try:
                    summaries[language] = summarise(analysis, language=language)
                except QuotaExhausted as error:
                    # Every later call would fail the same way until the
                    # allowance resets, so stop asking. The signals themselves
                    # still refresh; only the notes stop here.
                    print(
                        f"  {ticker}: {error} — no more mentor notes this run",
                        file=sys.stderr,
                    )
                    want_summary = False
                    break
                except MentorError as error:
                    print(
                        f"  {ticker}: no {language} summary — {error}",
                        file=sys.stderr,
                    )
                    continue
                # summarise() refuses notes with advice or prediction in them,
                # so nothing here needs a second look. It used to warn and
                # store them anyway, which put "should" beside a Buy button.

        # ai_summary is the deprecated single-language column; keep it holding
        # English so anything still reading it stays correct.
        ai_summary = summaries.get("en")

        summary = (
            f"{len(candles)} candles, "
            f"{len(analysis.angles)} angles, "
            f"{len(analysis.square_of_nine)} levels, "
            f"{len(analysis.cycles)} cycles"
            f"{', summarised ' + '+'.join(summaries) if summaries else ''}"
        )

        if dry_run:
            print(f"  {ticker}: {summary} (dry run)")
            for language, text in summaries.items():
                print(f"    mentor[{language}]: {text}")
            print(json.dumps(payload, indent=2)[:400])
            continue

        try:
            # Replace rather than accumulate: this is a cache, and the frontend
            # only ever reads the newest row per asset.
            client.delete_expired_signals(asset["id"], timeframe)
            client.insert_signal(
                {
                    "asset_id": asset["id"],
                    "timeframe": timeframe,
                    "payload": payload,
                    "ai_summary": ai_summary,
                    "ai_summaries": summaries,
                    "expires_at": expires_at.isoformat(),
                }
            )
        except SupabaseError as error:
            print(f"  {ticker}: WRITE FAILED — {error}", file=sys.stderr)
            failures += 1
            continue

        print(f"  {ticker}: {summary}")

    total = len(assets)
    print(f"Refreshed {total - failures}/{total} assets ({timeframe}).")
    return 1 if failures else 0


def main(argv: list[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    try:
        return refresh(
            timeframe=args.timeframe,
            range_=args.range_,
            ttl_hours=args.ttl_hours,
            symbols=args.symbols,
            languages=tuple(
                lang.strip() for lang in args.lang.split(",") if lang.strip()
            ),
            no_ai=args.no_ai,
            dry_run=args.dry_run,
        )
    except SupabaseError as error:
        print(f"Supabase error: {error}", file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
