"""
Thin CFBD API client. Loads CFBD_API_KEY from .env.local (gitignored).
Base: https://api.collegefootballdata.com  (Bearer auth)
"""
import os, time
import requests

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))


def _load_key():
    # prefer .env.local, fall back to env var
    for fn in (".env.local", ".env"):
        p = os.path.join(ROOT, fn)
        if os.path.exists(p):
            for line in open(p):
                if line.startswith("CFBD_API_KEY="):
                    return line.split("=", 1)[1].strip()
    if os.environ.get("CFBD_API_KEY"):
        return os.environ["CFBD_API_KEY"]
    raise RuntimeError("CFBD_API_KEY not found in .env.local / .env / env")


KEY = _load_key()
BASE = "https://api.collegefootballdata.com"
HDRS = {"Authorization": f"Bearer {KEY}", "Accept": "application/json"}


def get(path, **params):
    """GET an endpoint with retries. path like '/stats/season/advanced'."""
    for attempt in range(4):
        try:
            r = requests.get(f"{BASE}{path}", headers=HDRS, params=params, timeout=60)
            if r.status_code == 401:
                raise RuntimeError(f"401 Unauthorized — check CFBD_API_KEY. body={r.text[:200]}")
            r.raise_for_status()
            return r.json()
        except Exception as e:
            if attempt == 3:
                raise
            time.sleep(1.5 * (attempt + 1))
