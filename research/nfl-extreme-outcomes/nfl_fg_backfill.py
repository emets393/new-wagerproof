"""Backfill NFL FULL-GAME multi-book odds for 2021-2022 into data/odds_hist.parquet.

Extends the movement archive (2023-2026 from the live capture + h1tt backfill) two more
seasons back. The slate-wide historical endpoint returns EVERY not-yet-started event per
snapshot, so one call covers the whole week's board — 10 credits x 3 markets x regions
per call regardless of game count (vs per-event pricing on props/1H/TT). 1H/TT columns
stay null for these seasons: the API's additional-markets history starts 2023-05-03, so
that data does not exist and cannot be bought.

Cadence mirrors the existing archive (~twice daily 14:00Z/22:00Z from Tuesday of game
week) + a kickoff-5min stamp per distinct kickoff. Raw JSON cached under
data/fg_snapshots/<season>/ so the run is resumable and never re-spends credits.

Usage:
  python3 nfl_fg_backfill.py --slate      # stamp count + credit estimate
  python3 nfl_fg_backfill.py --test         # one week end-to-end
  python3 nfl_fg_backfill.py                # full 2021+2022 run, then append parquet
"""
import argparse, json, sys, time
from datetime import datetime, timedelta, timezone
from pathlib import Path
from zoneinfo import ZoneInfo

import pandas as pd
import requests

ROOT = Path(__file__).resolve().parent
CACHE = ROOT / "data" / "fg_snapshots"
ET = ZoneInfo("America/New_York")
BASE = "https://api.the-odds-api.com/v4/historical/sports/americanfootball_nfl"
MARKETS = "spreads,totals,h2h"
REGIONS = "us,us2"
SEASONS = (2021, 2022)

# Odds API full names -> the city-style names odds_hist stores (nfl_historical_odds scheme)
CITY = {
    "Arizona Cardinals": "Arizona", "Atlanta Falcons": "Atlanta", "Baltimore Ravens": "Baltimore",
    "Buffalo Bills": "Buffalo", "Carolina Panthers": "Carolina", "Chicago Bears": "Chicago",
    "Cincinnati Bengals": "Cincinnati", "Cleveland Browns": "Cleveland", "Dallas Cowboys": "Dallas",
    "Denver Broncos": "Denver", "Detroit Lions": "Detroit", "Green Bay Packers": "Green Bay",
    "Houston Texans": "Houston", "Indianapolis Colts": "Indianapolis", "Jacksonville Jaguars": "Jacksonville",
    "Kansas City Chiefs": "Kansas City", "Los Angeles Rams": "LA Rams", "Los Angeles Chargers": "LA Chargers",
    "Las Vegas Raiders": "Las Vegas", "Miami Dolphins": "Miami", "Minnesota Vikings": "Minnesota",
    "New England Patriots": "New England", "New Orleans Saints": "New Orleans", "New York Giants": "NY Giants",
    "New York Jets": "NY Jets", "Philadelphia Eagles": "Philadelphia", "Pittsburgh Steelers": "Pittsburgh",
    "Seattle Seahawks": "Seattle", "San Francisco 49ers": "San Francisco", "Tampa Bay Buccaneers": "Tampa Bay",
    "Tennessee Titans": "Tennessee", "Washington Commanders": "Washington", "Washington Football Team": "Washington",
}


def load_key():
    for line in (ROOT.parent.parent / ".env.local").read_text().splitlines():
        if line.startswith("ODDS_API_KEY="):
            return line.split("=", 1)[1].strip()
    sys.exit("ODDS_API_KEY not found in .env.local")


def week_stamps(week_games):
    """Snapshot timestamps for one (season, week): twice daily from Tuesday of game
    week through the last gameday, + kickoff-5min per distinct kickoff."""
    days = sorted(pd.to_datetime(week_games.gameday).dt.date.unique())
    first, last = days[0], days[-1]
    tuesday = first - timedelta(days=(first.weekday() - 1) % 7)
    stamps = []
    d = tuesday
    while d <= last:
        for hh in (14, 22):
            stamps.append(datetime(d.year, d.month, d.day, hh, 0, tzinfo=timezone.utc))
        d += timedelta(days=1)
    for r in week_games.itertuples():
        hh, mm = map(int, r.gametime.split(":"))
        gd = pd.to_datetime(r.gameday).date()
        ko = datetime(gd.year, gd.month, gd.day, hh, mm, tzinfo=ET).astimezone(timezone.utc)
        stamps.append(ko - timedelta(minutes=5))
    last_ko = max(s for s in stamps)
    return sorted(set(s for s in stamps if s <= last_ko))


class Fetcher:
    def __init__(self, key):
        self.key, self.calls, self.remaining = key, 0, None
        self.sess = requests.Session()

    def get(self, params):
        params = {**params, "apiKey": self.key}
        for attempt in range(5):
            try:
                r = self.sess.get(f"{BASE}/odds", params=params, timeout=30)
            except requests.exceptions.RequestException:
                time.sleep(5 * (attempt + 1)); continue
            # 5xx gateway blips killed a full run at wk19 — retry them like 429s
            if r.status_code == 429 or r.status_code >= 500:
                time.sleep(5 * (attempt + 1)); continue
            self.calls += 1
            self.remaining = r.headers.get("x-requests-remaining", self.remaining)
            if r.status_code in (404, 422):
                return None
            r.raise_for_status()
            time.sleep(0.15)
            return r.json()
        raise RuntimeError("rate-limited 5x")


def parse_snapshot(payload, season, valid_pairs):
    """One slate snapshot -> odds_hist-schema rows (FG columns only, 1H/TT null)."""
    rows = []
    snap_ts = payload.get("timestamp")
    for ev in payload.get("data", []):
        h, a = CITY.get(ev["home_team"]), CITY.get(ev["away_team"])
        if not h or not a or (valid_pairs is not None and (h, a) not in valid_pairs):
            continue
        for bk in ev.get("bookmakers", []):
            row = {"season": season, "snap_ts": snap_ts, "commence_time": ev["commence_time"],
                   "home_team": h, "away_team": a, "book": bk["key"]}
            for m in bk.get("markets", []):
                oc = {o["name"]: o for o in m["outcomes"]}
                if m["key"] == "spreads":
                    ho, ao = oc.get(ev["home_team"]), oc.get(ev["away_team"])
                    if ho: row["spread_home"], row["spread_home_price"] = ho.get("point"), ho.get("price")
                    if ao: row["spread_away"], row["spread_away_price"] = ao.get("point"), ao.get("price")
                elif m["key"] == "totals":
                    ov, un = oc.get("Over"), oc.get("Under")
                    if ov: row["total_point"], row["total_over_price"] = ov.get("point"), ov.get("price")
                    if un: row["total_under_price"] = un.get("price")
                elif m["key"] == "h2h":
                    ho, ao = oc.get(ev["home_team"]), oc.get(ev["away_team"])
                    if ho: row["ml_home"] = ho.get("price")
                    if ao: row["ml_away"] = ao.get("price")
            rows.append(row)
    return rows


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--slate", action="store_true")
    ap.add_argument("--test", action="store_true", help="one week only")
    args = ap.parse_args()

    g = pd.read_parquet(ROOT / "data" / "games_enriched.parquet")
    g = g[g.season.isin(SEASONS)].copy()
    g["gameday"] = pd.to_datetime(g.gameday).dt.strftime("%Y-%m-%d")

    weeks = [(int(s), int(w), grp) for (s, w), grp in g.groupby(["season", "week"])]
    total = sum(len(week_stamps(grp)) for _, _, grp in weeks)
    print(f"weeks={len(weeks)} stamps={total} est credits ~{total * 60:,} "
          f"(10 x 3 markets x 2 regions/stamp; empty stamps cost 0)", flush=True)
    if args.dry_run:
        return

    fetcher = Fetcher(load_key())
    if args.test:
        weeks = weeks[:1]

    all_rows, done = [], 0
    for season, week, grp in weeks:
        # Accept every event a snapshot returns (a snapshot only lists real upcoming
        # NFL games); the season tag + dedupe handle week overlap.
        out_dir = CACHE / str(season)
        out_dir.mkdir(parents=True, exist_ok=True)
        for s in week_stamps(grp):
            fn = out_dir / f"wk{week:02d}__{s.strftime('%Y%m%dT%H%M')}.json"
            if fn.exists():
                payload = json.loads(fn.read_text())
            else:
                payload = fetcher.get({"regions": REGIONS, "markets": MARKETS,
                                       "oddsFormat": "american", "date": s.strftime("%Y-%m-%dT%H:%M:%SZ")})
                if payload is None:
                    fn.write_text(json.dumps({"data": []}))
                    continue
                fn.write_text(json.dumps(payload))
            all_rows.extend(parse_snapshot(payload, season, valid_pairs=None))
        done += 1
        print(f"[{done}/{len(weeks)}] {season} wk{week} calls={fetcher.calls} "
              f"remaining={fetcher.remaining}", flush=True)

    df = pd.DataFrame(all_rows).drop_duplicates(subset=["season", "snap_ts", "home_team", "away_team", "book"])
    hist = pd.read_parquet(ROOT / "data" / "odds_hist.parquet")
    keep = hist[~hist.season.isin(SEASONS)]
    merged = pd.concat([df, keep], ignore_index=True)
    merged.to_parquet(ROOT / "data" / "odds_hist.parquet", index=False)
    print(f"DONE new_rows={len(df)} -> odds_hist.parquet total={len(merged)} "
          f"calls={fetcher.calls} remaining={fetcher.remaining}", flush=True)


if __name__ == "__main__":
    main()
