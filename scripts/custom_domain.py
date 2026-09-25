"""Keep the app's own domain attached, and sign-in links pointing at it.

Run by the deploy workflow after each production deploy. Every step is safe to
repeat, so it runs every time rather than once by hand and then drifting:

  1. Vercel: the domain is on the project. Adding it again is a no-op.
  2. Supabase: sign-in links may return to the domain and to the vercel.app
     address, which keeps working for anyone who installed from it.
  3. Whether the domain serves the app yet. The DNS record lives in the
     domain's own DNS provider, outside anything this can reach, so until it
     exists this warns and says which record to add, instead of failing
     every deploy.
  4. Once it serves the app, Supabase's Site URL moves to it. That is the
     address confirmation emails link to, so it moves only when it works.

    APP_DOMAIN=invest-pal.example.com VERCEL_TOKEN=... VERCEL_PROJECT_ID=... \
    VERCEL_ORG_ID=... SUPABASE_ACCESS_TOKEN=... SUPABASE_URL=... \
    python3 scripts/custom_domain.py
"""

import json
import os
import re
import sys
import urllib.error
import urllib.request

VERCEL_API = "https://api.vercel.com"
SUPABASE_API = "https://api.supabase.com"
# The address every deploy also answers on. Installs and links made from it
# before the domain existed must keep signing in.
FALLBACK_ORIGIN = "https://invest-pal.vercel.app"
USER_AGENT = "invest-pal-deploy"


class ApiError(Exception):
    def __init__(self, status, body):
        super().__init__(f"HTTP {status}: {body[:500]}")
        self.status = status
        self.body = body


def request(method, url, token=None, payload=None, timeout=60):
    headers = {"User-Agent": USER_AGENT}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    data = None
    if payload is not None:
        data = json.dumps(payload).encode()
        headers["Content-Type"] = "application/json"
    req = urllib.request.Request(url, data=data, method=method, headers=headers)
    try:
        with urllib.request.urlopen(req, timeout=timeout) as response:
            return response.status, response.read().decode("utf-8", "replace")
    except urllib.error.HTTPError as error:
        raise ApiError(error.code, error.read().decode("utf-8", "replace")) from None


def allow_list_with(current, origins):
    """Supabase's redirect allow list, a comma-separated string, with a
    `<origin>/**` entry for each origin added if it is not there. Order and
    everything already listed are kept."""
    entries = [entry.strip() for entry in (current or "").split(",") if entry.strip()]
    for origin in origins:
        wanted = f"{origin.rstrip('/')}/**"
        if wanted not in entries:
            entries.append(wanted)
    return ",".join(entries)


def serves_app(html):
    """The page is this app's shell, not a parking page or someone else's."""
    return '<div id="root"' in html and "invest-pal" in html.lower()


def summary(lines):
    path = os.environ.get("GITHUB_STEP_SUMMARY")
    text = "\n".join(lines) + "\n"
    if path:
        with open(path, "a", encoding="utf-8") as handle:
            handle.write(text)
    print(text)


def vercel(domain, token, project, org):
    """Attach the domain to the project. Returns the project's record of it."""
    team = f"?teamId={org}" if org.startswith("team_") else ""
    try:
        request("POST", f"{VERCEL_API}/v10/projects/{project}/domains{team}", token, {"name": domain})
        print(f"Vercel: added {domain} to the project.")
    except ApiError as error:
        # 409 is "already there" when it is on this project, and a real
        # problem when another project or account holds it. The lookup
        # below tells the two apart.
        if error.status != 409:
            raise
    try:
        _, body = request("GET", f"{VERCEL_API}/v9/projects/{project}/domains/{domain}{team}", token)
    except ApiError as error:
        if error.status == 404:
            raise SystemExit(
                f"PROBLEM: Vercel would not add {domain} to this project, and it is not on it. "
                "Another Vercel project or account probably holds it: remove it there first."
            ) from None
        raise
    return json.loads(body)


def supabase(token, ref, origins, site_url):
    """Allow sign-in links back to each origin; set the Site URL if given."""
    url = f"{SUPABASE_API}/v1/projects/{ref}/config/auth"
    _, body = request("GET", url, token)
    config = json.loads(body)
    change = {}
    allow = allow_list_with(config.get("uri_allow_list"), origins)
    if allow != (config.get("uri_allow_list") or ""):
        change["uri_allow_list"] = allow
    if site_url and config.get("site_url") != site_url:
        change["site_url"] = site_url
    if change:
        request("PATCH", url, token, change)
        print(f"Supabase auth: updated {', '.join(sorted(change))}.")
    else:
        print("Supabase auth: already up to date.")
    return change


def main():
    domain = os.environ["APP_DOMAIN"].strip().lower()
    origin = f"https://{domain}"
    match = re.match(r"https://([a-z0-9]+)\.supabase\.co", os.environ.get("SUPABASE_URL", ""))
    if not match:
        raise SystemExit("PROBLEM: SUPABASE_URL is not https://<project-ref>.supabase.co.")

    record = vercel(
        domain,
        os.environ["VERCEL_TOKEN"].strip(),
        os.environ["VERCEL_PROJECT_ID"].strip(),
        os.environ.get("VERCEL_ORG_ID", "").strip(),
    )

    try:
        _, html = request("GET", origin + "/", timeout=20)
        live = serves_app(html)
    except (ApiError, urllib.error.URLError, TimeoutError, OSError):
        live = False

    supabase(
        os.environ["SUPABASE_ACCESS_TOKEN"].strip(),
        match.group(1),
        [origin, FALLBACK_ORIGIN],
        origin if live else None,
    )

    if live:
        summary([f"## {domain} is live", "", f"{origin} serves this deploy, and sign-in emails link to it."])
        return

    lines = [
        f"## {domain} is not serving the app yet",
        "",
        "Vercel has the domain; its DNS record is still missing. In the DNS for "
        f"`{domain.split('.', 1)[1]}` add:",
        "",
        "| Type | Name | Target | Proxy |",
        "|---|---|---|---|",
        f"| CNAME | `{domain.split('.', 1)[0]}` | `cname.vercel-dns.com` | DNS only |",
    ]
    for item in record.get("verification") or []:
        lines.append(f"| {item.get('type')} | `{item.get('domain')}` | `{item.get('value')}` | DNS only |")
    lines += ["", "The next deploy picks it up. Until then the app stays on the vercel.app address."]
    summary(lines)
    print(f"::warning::{domain} does not serve the app yet: add its DNS record (see the summary).")


if __name__ == "__main__":
    try:
        main()
    except ApiError as error:
        print(f"PROBLEM: {error}", file=sys.stderr)
        sys.exit(1)
