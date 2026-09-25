"""The custom-domain step of the deploy: the pure parts, without the network."""

import importlib.util
import json
from pathlib import Path

import pytest

SPEC = importlib.util.spec_from_file_location(
    "custom_domain", Path(__file__).resolve().parent.parent / "scripts" / "custom_domain.py"
)
custom_domain = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(custom_domain)


def test_allow_list_adds_each_origin_once_and_keeps_what_is_there():
    current = "https://invest-pal.vercel.app/**, http://localhost:5173/**"
    result = custom_domain.allow_list_with(
        current, ["https://invest-pal.example.com", "https://invest-pal.vercel.app/"]
    )
    assert result.split(",") == [
        "https://invest-pal.vercel.app/**",
        "http://localhost:5173/**",
        "https://invest-pal.example.com/**",
    ]


@pytest.mark.parametrize("current", [None, "", " , "])
def test_allow_list_starts_from_nothing(current):
    assert custom_domain.allow_list_with(current, ["https://a.example"]) == "https://a.example/**"


def test_serves_app_recognises_the_shell_only():
    shell = Path(__file__).resolve().parent.parent.joinpath("index.html").read_text()
    assert custom_domain.serves_app(shell)
    assert not custom_domain.serves_app("<html><body>Parked domain</body></html>")
    assert not custom_domain.serves_app('<div id="root"></div><title>Another app</title>')


class FakeApi:
    """Stands in for urllib: answers by (method, url prefix), records writes."""

    def __init__(self, routes):
        self.routes = routes
        self.calls = []

    def __call__(self, method, url, token=None, payload=None, timeout=60):
        self.calls.append((method, url, payload))
        for (m, prefix), answer in self.routes.items():
            if m == method and url.startswith(prefix):
                if isinstance(answer, Exception):
                    raise answer
                return 200, json.dumps(answer)
        raise AssertionError(f"unexpected {method} {url}")


def test_supabase_sets_site_url_only_when_asked(monkeypatch):
    url = f"{custom_domain.SUPABASE_API}/v1/projects/ref/config/auth"
    api = FakeApi({
        ("GET", url): {"site_url": "https://invest-pal.vercel.app", "uri_allow_list": "https://invest-pal.vercel.app/**"},
        ("PATCH", url): {},
    })
    monkeypatch.setattr(custom_domain, "request", api)

    change = custom_domain.supabase("t", "ref", ["https://d.example", custom_domain.FALLBACK_ORIGIN], None)
    assert change == {"uri_allow_list": "https://invest-pal.vercel.app/**,https://d.example/**"}

    change = custom_domain.supabase("t", "ref", ["https://d.example"], "https://d.example")
    assert change["site_url"] == "https://d.example"


def test_supabase_writes_nothing_when_up_to_date(monkeypatch):
    url = f"{custom_domain.SUPABASE_API}/v1/projects/ref/config/auth"
    api = FakeApi({("GET", url): {"site_url": "https://d.example", "uri_allow_list": "https://d.example/**"}})
    monkeypatch.setattr(custom_domain, "request", api)
    assert custom_domain.supabase("t", "ref", ["https://d.example"], "https://d.example") == {}
    assert [c[0] for c in api.calls] == ["GET"]


def test_vercel_treats_already_attached_as_fine(monkeypatch):
    base = f"{custom_domain.VERCEL_API}"
    api = FakeApi({
        ("POST", f"{base}/v10/projects/p/domains"): custom_domain.ApiError(409, "domain_already_in_use"),
        ("GET", f"{base}/v9/projects/p/domains/d.example"): {"name": "d.example", "verified": True},
    })
    monkeypatch.setattr(custom_domain, "request", api)
    assert custom_domain.vercel("d.example", "t", "p", "user_1")["verified"] is True
    # A personal account takes no teamId; a team does.
    assert all("teamId" not in c[1] for c in api.calls)


def test_vercel_explains_a_domain_held_elsewhere(monkeypatch):
    base = f"{custom_domain.VERCEL_API}"
    api = FakeApi({
        ("POST", f"{base}/v10/projects/p/domains"): custom_domain.ApiError(409, "domain_already_in_use"),
        ("GET", f"{base}/v9/projects/p/domains/d.example"): custom_domain.ApiError(404, "not found"),
    })
    monkeypatch.setattr(custom_domain, "request", api)
    with pytest.raises(SystemExit, match="Another Vercel project"):
        custom_domain.vercel("d.example", "t", "p", "team_1")
    assert all("?teamId=team_1" in c[1] for c in api.calls)


def test_vercel_passes_other_errors_through(monkeypatch):
    api = FakeApi({("POST", custom_domain.VERCEL_API): custom_domain.ApiError(403, "forbidden")})
    monkeypatch.setattr(custom_domain, "request", api)
    with pytest.raises(custom_domain.ApiError):
        custom_domain.vercel("d.example", "t", "p", "")
