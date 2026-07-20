"""Per-event T-60 closing snapshots for markets the bulk endpoint can't serve:
NBA/NCAAB 1st-half + team totals (40 credits/event) and NBA player props
(10 markets, 100 credits/event). Additional-market history only exists from
May 2023, so seasons 2023-24 onward.

Closing line = snapshot at commence-60min per owner T-60 policy (API returns
the nearest snapshot at-or-before the requested time; 5-min granularity).
Event ids come from one cached historical events call per gameday (1 credit),
shared across market sets. Empty responses cost 0; raw gz JSON cached so the
run is resumable and never re-spends credits.

Usage:
  python3 event_backfill.py --test                          # one h1tt + one props call
  python3 event_backfill.py --dry-run
  python3 event_backfill.py --sport nba --set props         # all 3 seasons
  python3 event_backfill.py --sport ncaab --set h1tt --season 2024-25
"""
import argparse, gzip, json, sys, time as _time
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

import requests

ROOT = Path(__file__).resolve().parent
DATA = ROOT / "data"

SPORT_KEYS = {"nba": "basketball_nba", "ncaab": "basketball_ncaab"}
MARKET_SETS = {
    "h1tt": "h2h_h1,spreads_h1,totals_h1,team_totals",
    "props": ",".join([
        "player_points", "player_rebounds", "player_assists", "player_threes",
        "player_blocks", "player_steals", "player_points_rebounds_assists",
        "player_points_rebounds", "player_points_assists", "player_rebounds_assists"]),
}
# Additional markets exist from 2023-05-03 → 2022-23 season is impossible.
SEASONS = {
    "nba": {
        "2023-24": ("2023-10-24", "2024-06-18"),
        "2024-25": ("2024-10-22", "2025-06-23"),
        "2025-26": ("2025-10-21", "2026-06-23"),
    },
    "ncaab": {
        "2023-24": ("2023-11-06", "2024-04-09"),
        "2024-25": ("2024-11-04", "2025-04-08"),
        "2025-26": ("2025-11-03", "2026-04-07"),
    },
}
CREDIT_FLOOR = 2_300_000


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
                r = self.sess.get(url, params=params, timeout=40)
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
                return {"__unavailable__": True, "status": r.status_code, "body": r.text[:300]}
            r.raise_for_status()
            _time.sleep(0.12)
            return r.json()
        raise RuntimeError(f"gave up after retries: {url}")


def day_range(start, end):
    d, stop = date.fromisoformat(start), date.fromisoformat(end)
    while d <= stop:
        yield d
        d += timedelta(days=1)


def build_events(fetcher, sport, season):
    """{event_id: event} for the season. One events call per gameday at 16:00
    UTC (11am ET — before the earliest tips, after the day's lines are up);
    events also list games days ahead, so dedupe by id, last sighting wins
    (tip times occasionally shift)."""
    start, end = SEASONS[sport][season]
    cachedir = DATA / "events" / sport
    cachedir.mkdir(parents=True, exist_ok=True)
    url = f"https://api.the-odds-api.com/v4/historical/sports/{SPORT_KEYS[sport]}/events"
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
        if lo <= c <= hi:
            keep[eid] = ev
    return keep


def run(fetcher, sport, mset, season, dry=False):
    events = build_events(fetcher, sport, season)
    outdir = DATA / mset / sport / season
    outdir.mkdir(parents=True, exist_ok=True)
    url_base = f"https://api.the-odds-api.com/v4/historical/sports/{SPORT_KEYS[sport]}/events"
    per_call = 10 * (len(MARKET_SETS[mset].split(",")))
    todo = [(eid, ev) for eid, ev in sorted(events.items(), key=lambda kv: kv[1]["commence_time"])
            if not (outdir / f"{eid}.json.gz").exists()]
    print(f"[{sport} {season} {mset}] {len(events)} events, {len(todo)} to fetch "
          f"(ceiling ~{len(todo) * per_call:,} credits)", flush=True)
    if dry:
        return
    for i, (eid, ev) in enumerate(todo):
        commence = datetime.fromisoformat(ev["commence_time"].replace("Z", "+00:00"))
        t60 = (commence - timedelta(minutes=60)).strftime("%Y-%m-%dT%H:%M:%SZ")
        js = fetcher.get(f"{url_base}/{eid}/odds",
                         {"date": t60, "regions": "us",
                          "markets": MARKET_SETS[mset], "oddsFormat": "american"})
        (outdir / f"{eid}.json.gz").write_bytes(gzip.compress(json.dumps(js).encode()))
        if i % 200 == 0:
            print(f"  {i}/{len(todo)} {ev.get('away_team','?')} @ {ev.get('home_team','?')} "
                  f"spent={fetcher.spent:,} remaining={fetcher.remaining:,}", flush=True)
    print(f"[{sport} {season} {mset}] DONE calls={fetcher.calls} spent={fetcher.spent:,} "
          f"remaining={fetcher.remaining:,}", flush=True)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--sport", choices=["nba", "ncaab"])
    ap.add_argument("--set", dest="mset", choices=["h1tt", "props"])
    ap.add_argument("--season")
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--test", action="store_true")
    a = ap.parse_args()
    f = Fetcher(load_key())
    if a.test:
        # one NBA gameday: events + one h1tt + one props call
        evs = build_events(f, "nba", "2025-26")
        eid, ev = next(iter(sorted(evs.items(), key=lambda kv: kv[1]["commence_time"])))
        commence = datetime.fromisoformat(ev["commence_time"].replace("Z", "+00:00"))
        t60 = (commence - timedelta(minutes=60)).strftime("%Y-%m-%dT%H:%M:%SZ")
        for mset in ("h1tt", "props"):
            before = f.spent
            js = f.get(f"https://api.the-odds-api.com/v4/historical/sports/basketball_nba/events/{eid}/odds",
                       {"date": t60, "regions": "us", "markets": MARKET_SETS[mset],
                        "oddsFormat": "american"})
            mk = sorted({m["key"] for b in (js or {}).get("data", {}).get("bookmakers", [])
                         for m in b["markets"]}) if not js.get("__unavailable__") else None
            print(f"test {mset}: {ev.get('away_team')} @ {ev.get('home_team')} "
                  f"markets={mk} cost={f.spent - before} remaining={f.remaining:,}")
        return
    if a.dry_run:
        for sport in (["nba", "ncaab"] if not a.sport else [a.sport]):
            for season in SEASONS[sport]:
                for mset in (["h1tt", "props"] if not a.mset else [a.mset]):
                    if mset == "props" and sport == "ncaab":
                        continue
                    run(f, sport, mset, season, dry=True)
        return
    assert a.sport and a.mset, "--sport and --set required"
    seasons = [a.season] if a.season else list(SEASONS[a.sport])
    for season in seasons:
        run(f, a.sport, a.mset, season)


if __name__ == "__main__":
    main()
