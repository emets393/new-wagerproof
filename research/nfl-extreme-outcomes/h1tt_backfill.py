"""Backfill 1st-half (spread/total/ML) + team-total lines for 2023-2025.

Reuses the EXACT snapshot timestamps already in nfl_historical_odds
(mirrored locally in data/odds_hist.parquet) so the new markets capture the
same moment as the existing full-game lines. Per-event historical endpoint is
required because spreads_h1/totals_h1/h2h_h1/team_totals are not featured
markets. Raw JSON cached to disk so the run is resumable and never re-spends
credits (worst case ~40 credits/call; empty responses cost 0).

Usage:
  python3 h1tt_backfill.py --dry-run            # pair counts + credit estimate
  python3 h1tt_backfill.py --test               # single game end-to-end
  python3 h1tt_backfill.py [--season 2023]      # full run (optionally one season)
"""
import argparse, json, sys, time
from datetime import datetime, timedelta, timezone
from pathlib import Path

import pandas as pd
import requests

ROOT = Path(__file__).resolve().parent
CACHE = ROOT / "data" / "h1tt_snapshots"
EVENTS_CACHE = ROOT / "data" / "props_snapshots" / "events"  # shared with props backfill

MARKETS = "spreads_h1,totals_h1,h2h_h1,team_totals"
BASE = "https://api.the-odds-api.com/v4/historical/sports/americanfootball_nfl"

TEAM_NAMES = {
    "Arizona Cardinals": "ARI", "Atlanta Falcons": "ATL", "Baltimore Ravens": "BAL",
    "Buffalo Bills": "BUF", "Carolina Panthers": "CAR", "Chicago Bears": "CHI",
    "Cincinnati Bengals": "CIN", "Cleveland Browns": "CLE", "Dallas Cowboys": "DAL",
    "Denver Broncos": "DEN", "Detroit Lions": "DET", "Green Bay Packers": "GB",
    "Houston Texans": "HOU", "Indianapolis Colts": "IND", "Jacksonville Jaguars": "JAX",
    "Kansas City Chiefs": "KC", "Los Angeles Rams": "LA", "Los Angeles Chargers": "LAC",
    "Las Vegas Raiders": "LV", "Miami Dolphins": "MIA", "Minnesota Vikings": "MIN",
    "New England Patriots": "NE", "New Orleans Saints": "NO", "New York Giants": "NYG",
    "New York Jets": "NYJ", "Philadelphia Eagles": "PHI", "Pittsburgh Steelers": "PIT",
    "Seattle Seahawks": "SEA", "San Francisco 49ers": "SF", "Tampa Bay Buccaneers": "TB",
    "Tennessee Titans": "TEN", "Washington Commanders": "WAS",
}

# nfl_historical_odds stores city-style names, not Odds API full names
CITY_NAMES = {
    "Arizona": "ARI", "Atlanta": "ATL", "Baltimore": "BAL", "Buffalo": "BUF",
    "Carolina": "CAR", "Chicago": "CHI", "Cincinnati": "CIN", "Cleveland": "CLE",
    "Dallas": "DAL", "Denver": "DEN", "Detroit": "DET", "Green Bay": "GB",
    "Houston": "HOU", "Indianapolis": "IND", "Jacksonville": "JAX",
    "Kansas City": "KC", "LA Chargers": "LAC", "LA Rams": "LA", "Las Vegas": "LV",
    "Miami": "MIA", "Minnesota": "MIN", "NY Giants": "NYG", "NY Jets": "NYJ",
    "New England": "NE", "New Orleans": "NO", "Philadelphia": "PHI",
    "Pittsburgh": "PIT", "San Francisco": "SF", "Seattle": "SEA",
    "Tampa Bay": "TB", "Tennessee": "TEN", "Washington": "WAS",
}


def load_key():
    for line in (ROOT.parent.parent / ".env.local").read_text().splitlines():
        if line.startswith("ODDS_API_KEY="):
            return line.split("=", 1)[1].strip()
    sys.exit("ODDS_API_KEY not found in .env.local")


def iso(dt):
    return dt.astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def build_games():
    """One row per (season, ET gameday, home, away) with its unique snap_ts list.

    odds_hist has commence_time variants for the same game (time updates) —
    dedupe by ET calendar date of commence so each game gets one snapshot set.
    """
    d = pd.read_parquet(ROOT / "data" / "odds_hist.parquet")
    d["snap_dt"] = pd.to_datetime(d.snap_ts, utc=True, format="ISO8601")
    comm = pd.to_datetime(d.commence_time, utc=True, format="ISO8601")
    d["gameday"] = comm.dt.tz_convert("America/New_York").dt.strftime("%Y-%m-%d")
    g = (d.groupby(["season", "gameday", "home_team", "away_team"])
         .snap_dt.agg(lambda s: sorted(s.unique())).reset_index()
         .rename(columns={"snap_dt": "snaps"}))
    g["home_ab"] = g.home_team.map(CITY_NAMES)
    g["away_ab"] = g.away_team.map(CITY_NAMES)
    assert g.home_ab.notna().all() and g.away_ab.notna().all()
    g["game_key"] = g.gameday + "_" + g.away_ab + "@" + g.home_ab
    return g.sort_values(["season", "gameday", "game_key"]).reset_index(drop=True)


class Fetcher:
    def __init__(self, key):
        self.key = key
        self.calls = 0
        self.remaining = None
        self.sess = requests.Session()

    def get(self, url, params):
        params = {**params, "apiKey": self.key}
        for attempt in range(5):
            r = self.sess.get(url, params=params, timeout=30)
            if r.status_code == 429:
                time.sleep(5 * (attempt + 1))
                continue
            self.calls += 1
            if "x-requests-remaining" in r.headers:
                self.remaining = r.headers["x-requests-remaining"]
            if r.status_code in (404, 422):
                return None  # snapshot/event not available at this date
            r.raise_for_status()
            time.sleep(0.15)
            return r.json()
        raise RuntimeError(f"rate-limited 5x: {url}")


def map_event_ids(fetcher, games):
    """{game_key: event_id} via one cached historical events call per gameday."""
    EVENTS_CACHE.mkdir(parents=True, exist_ok=True)
    mapping, unmatched = {}, []
    for gameday, grp in games.groupby("gameday"):
        cf = EVENTS_CACHE / f"{gameday}.json"
        if cf.exists():
            payload = json.loads(cf.read_text())
        else:
            payload = fetcher.get(f"{BASE}/events", {
                "date": f"{gameday}T11:00:00Z",
                "commenceTimeFrom": f"{gameday}T00:00:00Z",
                "commenceTimeTo": (datetime.strptime(gameday, "%Y-%m-%d")
                                   + timedelta(days=1)).strftime("%Y-%m-%dT12:00:00Z"),
            })
            if payload is None:
                print(f"  !! no events snapshot for {gameday}", flush=True)
                continue
            cf.write_text(json.dumps(payload))
        by_teams = {}
        for ev in payload.get("data", []):
            h, a = TEAM_NAMES.get(ev["home_team"]), TEAM_NAMES.get(ev["away_team"])
            if h and a:
                by_teams[(a, h)] = ev["id"]
        for _, g in grp.iterrows():
            eid = by_teams.get((g.away_ab, g.home_ab))
            if eid:
                mapping[g.game_key] = eid
            else:
                unmatched.append(g)
    # flex-date placeholders: same matchup matched within 2 days shares the
    # event id (Odds API ids are stable across commence_time changes).
    # Speculative playoff matchups that never happened find no sibling -> skip.
    still = []
    for g in unmatched:
        d0 = datetime.strptime(g.gameday, "%Y-%m-%d")
        for off in (-1, 1, -2, 2):
            sib = f"{(d0 + timedelta(days=off)).strftime('%Y-%m-%d')}_{g.away_ab}@{g.home_ab}"
            if sib in mapping:
                mapping[g.game_key] = mapping[sib]
                break
        else:
            still.append(g.game_key)
    if still:
        print(f"UNMATCHED events ({len(still)}, skipped as phantom): {still}", flush=True)
    return mapping


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--test", action="store_true", help="fetch only the first game")
    ap.add_argument("--season", type=int, default=None)
    args = ap.parse_args()

    g = build_games()
    if args.season:
        g = g[g.season == args.season].reset_index(drop=True)
    pairs = g.snaps.str.len().sum()
    new_evdays = sum(1 for d in g.gameday.unique()
                     if not (EVENTS_CACHE / f"{d}.json").exists())
    print(f"games={len(g)} game-snapshot pairs={pairs:,} "
          f"(avg {pairs/len(g):.1f}/game) new event-days={new_evdays} "
          f"est credits ~{pairs*40 + new_evdays:,} (40/call worst case; empties cost 0)",
          flush=True)
    if args.dry_run:
        return

    fetcher = Fetcher(load_key())
    mapping = map_event_ids(fetcher, g)
    print(f"event ids mapped: {len(mapping)}/{len(g)}  remaining={fetcher.remaining}", flush=True)

    if args.test:
        g = g.head(1)

    done = fetched = empty = 0
    t0 = time.time()
    for r in g.itertuples():
        eid = mapping.get(r.game_key)
        if not eid:
            continue
        out_dir = CACHE / str(r.season)
        out_dir.mkdir(parents=True, exist_ok=True)
        for s in r.snaps:
            fn = out_dir / f"{r.game_key}__{eid}__{s.strftime('%Y%m%dT%H%M%S')}.json"
            if fn.exists():
                continue
            payload = fetcher.get(f"{BASE}/events/{eid}/odds", {
                "markets": MARKETS, "regions": "us",
                "oddsFormat": "american", "date": iso(s),
            })
            if payload is None:
                fn.write_text(json.dumps({"data": None}))  # cache the miss too
                continue
            fn.write_text(json.dumps(payload))
            fetched += 1
            if not payload.get("data", {}).get("bookmakers"):
                empty += 1
            if args.test:
                ts = payload.get("timestamp")
                print(f"  test: req {iso(s)} -> snapshot {ts} "
                      f"books={len(payload.get('data', {}).get('bookmakers', []))}", flush=True)
        done += 1
        if done % 10 == 0 or args.test:
            rate = fetcher.calls / max(time.time() - t0, 1)
            print(f"[{done}/{len(g)}] {r.game_key} calls={fetcher.calls} fetched={fetched} "
                  f"empty={empty} remaining={fetcher.remaining} ({rate:.1f} req/s)", flush=True)
    print(f"DONE games={done} calls={fetcher.calls} fetched={fetched} empty={empty} "
          f"remaining={fetcher.remaining}", flush=True)


if __name__ == "__main__":
    main()
