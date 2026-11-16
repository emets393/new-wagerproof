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


# Upstream saying "later", never "your request is wrong": a 400/404 must fail on the first try.
# 429 is CFBD's rate limit; 52x is Cloudflare in front of it.
RETRY_STATUS = {429, 500, 502, 503, 504, 520, 521, 522, 523, 524}


def get(path, **params):
    """GET an endpoint, retrying the transient classes with exponential backoff.

    The backoff used to be 1.5/3/4.5s -- 9s of patience in total, which is not enough for the heavy
    endpoints. cfb-slate-weekly died on 2026-11-16 11:04Z when /stats/game/advanced?year=2026 returned
    502 for 72 seconds straight, taking the whole weekly CFB run with it. 2/4/8/16/32s rides that out.
    """
    delay = 2.0
    for attempt in range(1, 7):
        last = None
        try:
            r = requests.get(f"{BASE}{path}", headers=HDRS, params=params, timeout=60)
            if r.status_code == 401:
                raise RuntimeError(f"401 Unauthorized — check CFBD_API_KEY. body={r.text[:200]}")
            if r.status_code not in RETRY_STATUS:
                r.raise_for_status()
                return r.json()
            last = f"{r.status_code} {r.text[:120]}"
            ra = (r.headers.get("Retry-After") or "").strip()
            if ra.replace(".", "", 1).isdigit():
                delay = min(float(ra), 60)
        except RuntimeError:
            raise                                  # 401 is a config error, not a blip
        except requests.HTTPError:
            raise                                  # a non-retryable status already decided above
        except (requests.Timeout, requests.ConnectionError) as e:
            last = type(e).__name__
        if attempt == 6:
            raise RuntimeError(f"CFBD {path} failed after 6 attempts: {last}")
        print(f"  ! CFBD {path}: {last} — retry {attempt}/5 in {delay:.0f}s", flush=True)
        time.sleep(delay)
        delay = min(delay * 2, 32)
