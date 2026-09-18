"""Minimal Supabase (PostgREST) client for the refresh job.

Deliberately stdlib-only: the engine stays installable with no requirements
file, which matters because this runs in cron jobs and CI as often as on a
laptop.

Writes use the service role key, which bypasses row level security. That key
must never reach the browser — it belongs in the environment of whatever runs
this job, not in any VITE_* variable.
"""

from __future__ import annotations

import json
import os
import urllib.error
import urllib.parse
import urllib.request


class SupabaseError(RuntimeError):
    pass


class SupabaseRest:
    def __init__(self, url: str, service_key: str, *, timeout: float = 20.0):
        if not url or not service_key:
            raise SupabaseError(
                "SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must both be set"
            )
        self.base = url.rstrip("/")
        self.key = service_key
        self.timeout = timeout

    @classmethod
    def from_env(cls) -> SupabaseRest:
        return cls(
            os.environ.get("SUPABASE_URL", ""),
            os.environ.get("SUPABASE_SERVICE_ROLE_KEY", ""),
        )

    def _request(
        self,
        method: str,
        path: str,
        *,
        params: dict | None = None,
        body: object | None = None,
        extra_headers: dict | None = None,
    ):
        url = f"{self.base}/rest/v1/{path}"
        if params:
            url = f"{url}?{urllib.parse.urlencode(params)}"

        headers = {
            "apikey": self.key,
            "Authorization": f"Bearer {self.key}",
            "Content-Type": "application/json",
            "Accept": "application/json",
        }
        headers.update(extra_headers or {})

        data = json.dumps(body).encode("utf-8") if body is not None else None
        request = urllib.request.Request(url, data=data, headers=headers, method=method)

        try:
            with urllib.request.urlopen(request, timeout=self.timeout) as response:
                raw = response.read().decode("utf-8")
                return json.loads(raw) if raw else None
        except urllib.error.HTTPError as error:
            detail = error.read().decode("utf-8", errors="replace")
            raise SupabaseError(f"{method} {path} failed: HTTP {error.code} {detail}") from error
        except urllib.error.URLError as error:
            raise SupabaseError(f"{method} {path} failed: {error}") from error

    def list_assets(self) -> list[dict]:
        return self._request(
            "GET", "assets", params={"select": "id,ticker,name,type"}
        ) or []

    def insert_signal(self, row: dict) -> None:
        self._request(
            "POST",
            "gann_signals",
            body=[row],
            # Nothing needs the inserted row back; skip the round trip.
            extra_headers={"Prefer": "return=minimal"},
        )

    def delete_expired_signals(self, asset_id: str, timeframe: str) -> None:
        """Drop this asset's older rows so the cache does not grow unbounded."""
        self._request(
            "DELETE",
            "gann_signals",
            params={"asset_id": f"eq.{asset_id}", "timeframe": f"eq.{timeframe}"},
            extra_headers={"Prefer": "return=minimal"},
        )
