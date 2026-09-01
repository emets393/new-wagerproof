"""Historical MLB player-prop odds backfill from The Odds API (per-event T-60 snapshots).

Additional markets (player props) only exist in the historical API from 2023-05-03, so
2023 starts in May; 2024/2025 are full; 2026 backfilled to date. Cost = 10 credits per
market RETURNED per event (~110/event at 11 markets); pre-wall dates return empty = 0
credits. One historical-events call per gameday (1 credit, cached), shared across the run.

Closing line = snapshot at commence-60min (owner T-60 policy). The historical odds
endpoint returns the nearest snapshot at-or-before the requested time (5-min granularity).
Raw gz JSON is cached per event so the run is fully resumable and never re-spends credits.

Usage:
  python3 fetch_props.py --test                 # one events + one odds call
  python3 fetch_props.py --simulate              # count events + credit ceiling, spend nothing
  python3 fetch_props.py                        # all seasons
  python3 fetch_props.py --season 2024          # one season
"""
import argparse, gzip, json, sys, time as _time
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

import requests

ROOT = Path(__file__).resolve().parent
DATA = ROOT / "data"
SPORT = "baseball_mlb"

# markets we currently store + the high-value ones the API serves historically
MARKETS = ",".join([
    "pitcher_strikeouts", "pitcher_outs", "pitcher_hits_allowed",
    "batter_hits", "batter_total_bases", "batter_rbis", "batter_hits_runs_rbis",
    "batter_walks", "batter_strikeouts", "batter_home_runs", "batter_runs_scored",
])
N_MARKETS = len(MARKETS.split(","))

# props history begins 2023-05-03; before that the odds call returns empty (free).
SEASONS = {
    "2023": ("2023-05-01", "2023-10-02"),
    "2024": ("2024-03-28", "2024-10-01"),
    "2025": ("2025-03-27", "2025-10-01"),
    "2026": ("2026-03-26", "2026-08-31"),
}
CREDIT_FLOOR = 1_000_000  # abort well above zero so live pipelines keep credits


def load_key():
    for line in (ROOT.parent.parent / ".env.local").read_text().splitlines():
        if line.startswith("ODDS_API_KEY="):
            return line.split("=", 1)[1].strip()
    sys.exit("ODDS_API_KEY not found in .env.local")


class Fetcher:
    def __init__(self, key):
        self.key, self.calls, self.spent, self.remaining = key, 0, 0, None
        self.sess = requests.Session()

    def get(self, url, params):
        params = {**params, "apiKey": self.key}
        for attempt in range(6):
            try:
                r = self.sess.get(url, params=params, timeout=45)
            except requests.RequestException:
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
                return {"__unavailable__": True, "status": r.status_code}
            r.raise_for_status()
            _time.sleep(0.12)
            return r.json()
        raise RuntimeError(f"gave up after retries: {url}")


def day_range(start, end):
    d, stop = date.fromisoformat(start), date.fromisoformat(end)
    while d <= stop:
        yield d
        d += timedelta(days=1)


def build_events(fetcher, season):
    """{event_id: event} for the season. One events call per gameday at 16:00 UTC;
    events also list games a day or two ahead, so dedupe by id (last sighting wins,
    since tip times shift). Cached so re-runs cost nothing."""
    start, end = SEASONS[season]
    cachedir = DATA / "events"
    cachedir.mkdir(parents=True, exist_ok=True)
    url = f"https://api.the-odds-api.com/v4/historical/sports/{SPORT}/events"
    events = {}
    for d in day_range(start, end):
        cf = cachedir / f"{d.isoformat()}.json.gz"
        if cf.exists():
            js = json.loads(gzip.decompress(cf.read_bytes()))
        else:
            js = fetcher.get(url, {"date": f"{d.isoformat()}T16:00:00Z"})
            cf.write_bytes(gzip.compress(json.dumps(js).encode()))
        for ev in (js or {}).get("data", []) or []:
            events[ev["id"]] = ev
    lo = datetime.fromisoformat(start).replace(tzinfo=timezone.utc)
    hi = datetime.fromisoformat(end).replace(tzinfo=timezone.utc) + timedelta(days=1)
    keep = {}
    for eid, ev in events.items():
        c = datetime.fromisoformat(ev["commence_time"].replace("Z", "+00:00"))
        if lo <= c <= hi and "All-Star" not in (ev.get("home_team") or ""):
            keep[eid] = ev
    return keep


def run(fetcher, season, dry=False):
    events = build_events(fetcher, season)
    outdir = DATA / "props" / season
    outdir.mkdir(parents=True, exist_ok=True)
    url_base = f"https://api.the-odds-api.com/v4/historical/sports/{SPORT}/events"
    todo = [(eid, ev) for eid, ev in sorted(events.items(), key=lambda kv: kv[1]["commence_time"])
            if not (outdir / f"{eid}.json.gz").exists()]
    print(f"[{season}] {len(events)} events, {len(todo)} to fetch "
          f"(ceiling ~{len(todo) * 10 * N_MARKETS:,} credits)", flush=True)
    if dry:
        return
    for i, (eid, ev) in enumerate(todo):
        commence = datetime.fromisoformat(ev["commence_time"].replace("Z", "+00:00"))
        t60 = (commence - timedelta(minutes=60)).strftime("%Y-%m-%dT%H:%M:%SZ")
        js = fetcher.get(f"{url_base}/{eid}/odds",
                         {"date": t60, "regions": "us", "markets": MARKETS, "oddsFormat": "american"})
        (outdir / f"{eid}.json.gz").write_bytes(gzip.compress(json.dumps(js).encode()))
        if i % 100 == 0:
            print(f"  {season} {i}/{len(todo)} spent={fetcher.spent:,} "
                  f"remaining={fetcher.remaining} calls={fetcher.calls}", flush=True)
    print(f"[{season}] DONE calls={fetcher.calls} spent={fetcher.spent:,} "
          f"remaining={fetcher.remaining}", flush=True)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--season", choices=list(SEASONS))
    ap.add_argument("--simulate", action="store_true")
    ap.add_argument("--test", action="store_true")
    a = ap.parse_args()
    f = Fetcher(load_key())
    if a.test:
        evs = build_events(f, "2024")
        eid, ev = next(iter(sorted(evs.items(), key=lambda kv: kv[1]["commence_time"])))
        commence = datetime.fromisoformat(ev["commence_time"].replace("Z", "+00:00"))
        t60 = (commence - timedelta(minutes=60)).strftime("%Y-%m-%dT%H:%M:%SZ")
        js = f.get(f"https://api.the-odds-api.com/v4/historical/sports/{SPORT}/events/{eid}/odds",
                   {"date": t60, "regions": "us", "markets": MARKETS, "oddsFormat": "american"})
        bk = (js.get("data") or {}).get("bookmakers", [])
        print("TEST", ev["away_team"], "@", ev["home_team"], "books", len(bk),
              "spent", f.spent, "remaining", f.remaining)
        return
    seasons = [a.season] if a.season else list(SEASONS)
    for s in seasons:
        run(f, s, dry=a.simulate)


if __name__ == "__main__":
    main()
