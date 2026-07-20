"""Bulk-snapshot line-movement grid for NBA/NCAAB full-game markets.

One historical bulk snapshot = 30 credits (10 x 3 featured markets x 1 region)
and returns EVERY game with posted odds at that timestamp (all US books,
including games 1-3 days out) — so cost scales with the time grid, not the
slate size. Grid: hourly 09:00-16:00 ET + half-hourly 17:00-23:30 ET
(22 snaps/day). Raw gzipped JSON cached per snapshot; rerun-safe, never
re-spends credits.

Usage:
  python3 grid_backfill.py --test                      # one snapshot, show cost
  python3 grid_backfill.py --dry-run                   # planned calls + credit ceiling
  python3 grid_backfill.py --sport nba --season 2025-26
"""
import argparse, gzip, json, sys, time as _time
from datetime import date, datetime, time, timedelta, timezone
from pathlib import Path
from zoneinfo import ZoneInfo

import requests

ROOT = Path(__file__).resolve().parent
DATA = ROOT / "data" / "grid"
ET = ZoneInfo("America/New_York")

MARKETS = "h2h,spreads,totals"
SPORT_KEYS = {"nba": "basketball_nba", "ncaab": "basketball_ncaab"}

# Season windows (ET dates, inclusive): a few days before opening night through
# a couple days past the title game, so openers' first postings are captured.
SEASONS = {
    "nba": {
        "2022-23": ("2022-10-15", "2023-06-14"),
        "2023-24": ("2023-10-21", "2024-06-19"),
        "2024-25": ("2024-10-19", "2025-06-24"),
        "2025-26": ("2025-10-18", "2026-06-24"),
    },
    "ncaab": {
        "2022-23": ("2022-11-04", "2023-04-05"),
        "2023-24": ("2023-11-03", "2024-04-10"),
        "2024-25": ("2024-11-01", "2025-04-09"),
        "2025-26": ("2025-11-01", "2026-04-08"),
    },
}

CREDIT_FLOOR = 2_300_000  # hard abort so MLB + buffer are never at risk


def load_key():
    for line in (ROOT.parent.parent / ".env.local").read_text().splitlines():
        if line.startswith("ODDS_API_KEY="):
            return line.split("=", 1)[1].strip()
    sys.exit("ODDS_API_KEY not found in .env.local")


def grid_times():
    return [time(h, 0) for h in range(9, 17)] + \
           [time(h, m) for h in range(17, 24) for m in (0, 30)]


def day_range(start, end):
    d, stop = date.fromisoformat(start), date.fromisoformat(end)
    while d <= stop:
        yield d
        d += timedelta(days=1)


class Fetcher:
    def __init__(self, key):
        self.key, self.calls, self.spent, self.remaining = key, 0, 0, None
        self.sess = requests.Session()

    def get(self, url, params):
        params = {**params, "apiKey": self.key}
        for attempt in range(6):
            try:
                r = self.sess.get(url, params=params, timeout=40)
            except requests.RequestException as e:
                _time.sleep(10 * (attempt + 1))
                continue
            if r.status_code == 429:
                _time.sleep(5 * (attempt + 1))
                continue
            self.calls += 1
            if "x-requests-last" in r.headers:
                self.spent += int(float(r.headers["x-requests-last"]))
            if "x-requests-remaining" in r.headers:
                self.remaining = int(float(r.headers["x-requests-remaining"]))
                if self.remaining < CREDIT_FLOOR:
                    sys.exit(f"ABORT: credit floor hit ({self.remaining} < {CREDIT_FLOOR})")
            if r.status_code in (404, 422):
                return {"__unavailable__": True, "status": r.status_code, "body": r.text[:300]}
            r.raise_for_status()
            _time.sleep(0.12)
            return r.json()
        raise RuntimeError(f"gave up after retries: {url}")


def run_season(fetcher, sport, season, dry=False):
    start, end = SEASONS[sport][season]
    outdir = DATA / sport / season
    outdir.mkdir(parents=True, exist_ok=True)
    url = f"https://api.the-odds-api.com/v4/historical/sports/{SPORT_KEYS[sport]}/odds"
    todo = []
    for d in day_range(start, end):
        for t in grid_times():
            snap_et = datetime.combine(d, t, tzinfo=ET)
            fname = outdir / f"{d.isoformat()}_{t.strftime('%H%M')}.json.gz"
            if not fname.exists():
                todo.append((snap_et, fname))
    print(f"[{sport} {season}] {len(todo)} snapshots to fetch "
          f"(ceiling ~{len(todo) * 30:,} credits)", flush=True)
    if dry:
        return
    for i, (snap_et, fname) in enumerate(todo):
        iso = snap_et.astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
        js = fetcher.get(url, {"date": iso, "regions": "us",
                               "markets": MARKETS, "oddsFormat": "american"})
        fname.write_bytes(gzip.compress(json.dumps(js).encode()))
        if i % 100 == 0:
            n = len((js or {}).get("data", [])) if isinstance(js, dict) else 0
            print(f"  {i}/{len(todo)} {fname.stem} events={n} "
                  f"spent={fetcher.spent:,} remaining={fetcher.remaining:,}", flush=True)
    print(f"[{sport} {season}] DONE calls={fetcher.calls} spent={fetcher.spent:,} "
          f"remaining={fetcher.remaining:,}", flush=True)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--sport", choices=["nba", "ncaab"])
    ap.add_argument("--season")
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--test", action="store_true")
    a = ap.parse_args()
    f = Fetcher(load_key())
    if a.test:
        url = f"https://api.the-odds-api.com/v4/historical/sports/basketball_nba/odds"
        js = f.get(url, {"date": "2026-01-15T23:00:00Z", "regions": "us",
                         "markets": MARKETS, "oddsFormat": "american"})
        n = len(js.get("data", []))
        print(f"test snapshot 2026-01-15T23:00Z: {n} events, cost={f.spent}, "
              f"remaining={f.remaining:,}")
        return
    if a.dry_run:
        for sport in (["nba", "ncaab"] if not a.sport else [a.sport]):
            for season in SEASONS[sport]:
                run_season(f, sport, season, dry=True)
        return
    assert a.sport and a.season, "--sport and --season required"
    run_season(f, a.sport, a.season)


if __name__ == "__main__":
    main()
