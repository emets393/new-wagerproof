"""Full-cadence historical player-props backfill (2024+2025, incl playoffs).

Simulates the live-season fetch schedule against The Odds API historical endpoints:
  - daily 16:00Z from Tuesday of game week through day before the game
  - gameday every 2h from 13:00Z until kickoff, plus kickoff-5min close
4 books (DK/FD/MGM/Caesars), 6 markets. Raw JSON cached to disk keyed by
game_id + snapshot time so the run is resumable and never re-spends credits.

Usage:
  python3 props_backfill.py --dry-run          # snapshot counts + credit estimate, no API calls
  python3 props_backfill.py --test             # fetch a single game end-to-end
  python3 props_backfill.py                    # full run
"""
import argparse, json, sys, time
from datetime import datetime, timedelta, timezone
from pathlib import Path
from zoneinfo import ZoneInfo

import pandas as pd
import requests

ROOT = Path(__file__).resolve().parent
CACHE = ROOT / "data" / "props_snapshots"
EVENTS_CACHE = CACHE / "events"
ET = ZoneInfo("America/New_York")

MARKETS = "player_pass_tds,player_pass_yds,player_receptions,player_reception_yds,player_rush_yds,player_anytime_td"
BOOKS = "draftkings,fanduel,betmgm,williamhill_us"
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


def load_key():
    for line in (ROOT.parent.parent / ".env.local").read_text().splitlines():
        if line.startswith("ODDS_API_KEY="):
            return line.split("=", 1)[1].strip()
    sys.exit("ODDS_API_KEY not found in .env.local")


def iso(dt):
    return dt.astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def snapshot_times(gameday: str, gametime: str):
    """Snapshot schedule for one game. Returns (list[datetime], kickoff_utc)."""
    day = datetime.strptime(gameday, "%Y-%m-%d").date()
    hh, mm = map(int, gametime.split(":"))
    kickoff = datetime(day.year, day.month, day.day, hh, mm, tzinfo=ET).astimezone(timezone.utc)

    # Tuesday of game week (NFL week runs Tue..Mon)
    tuesday = day - timedelta(days=(day.weekday() - 1) % 7)
    snaps = []
    d = tuesday
    while d < day:
        snaps.append(datetime(d.year, d.month, d.day, 16, 0, tzinfo=timezone.utc))
        d += timedelta(days=1)

    t = datetime(day.year, day.month, day.day, 13, 0, tzinfo=timezone.utc)
    while t < kickoff:
        snaps.append(t)
        t += timedelta(hours=2)
    snaps.append(kickoff - timedelta(minutes=5))
    return sorted(set(s for s in snaps if s < kickoff)), kickoff


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
    """One historical events call per unique gameday -> {game_id: event_id}."""
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
                "commenceTimeTo": (datetime.strptime(gameday, "%Y-%m-%d") + timedelta(days=1)).strftime("%Y-%m-%dT12:00:00Z"),
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
            eid = by_teams.get((g.away_team, g.home_team))
            if eid:
                mapping[g.game_id] = eid
            else:
                unmatched.append(g.game_id)
    if unmatched:
        print(f"UNMATCHED events ({len(unmatched)}): {unmatched}", flush=True)
    return mapping


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--test", action="store_true", help="fetch only the first game")
    args = ap.parse_args()

    g = pd.read_parquet(ROOT / "data" / "games_enriched.parquet")
    g = g[g.season.isin([2024, 2025])].sort_values(["season", "week", "gameday", "gametime"]).reset_index(drop=True)
    g["gameday"] = pd.to_datetime(g.gameday).dt.strftime("%Y-%m-%d")

    total_snaps = sum(len(snapshot_times(r.gameday, r.gametime)[0]) for r in g.itertuples())
    est = total_snaps * 60 + g.gameday.nunique()
    print(f"games={len(g)} snapshots={total_snaps} (avg {total_snaps/len(g):.1f}/game) "
          f"est credits ~{est:,} (60/snap worst case; empty snaps cost 0)", flush=True)
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
        eid = mapping.get(r.game_id)
        if not eid:
            continue
        snaps, _ = snapshot_times(r.gameday, r.gametime)
        out_dir = CACHE / str(r.season)
        out_dir.mkdir(parents=True, exist_ok=True)
        for s in snaps:
            fn = out_dir / f"{r.game_id}__{eid}__{s.strftime('%Y%m%dT%H%M')}.json"
            if fn.exists():
                continue
            payload = fetcher.get(f"{BASE}/events/{eid}/odds", {
                "markets": MARKETS, "bookmakers": BOOKS,
                "oddsFormat": "american", "date": iso(s),
            })
            if payload is None:
                fn.write_text(json.dumps({"data": None}))  # cache the miss too
                continue
            fn.write_text(json.dumps(payload))
            fetched += 1
            if not payload.get("data", {}).get("bookmakers"):
                empty += 1
        done += 1
        if done % 10 == 0 or args.test:
            rate = fetcher.calls / max(time.time() - t0, 1)
            print(f"[{done}/{len(g)}] {r.game_id} calls={fetcher.calls} fetched={fetched} "
                  f"empty={empty} remaining={fetcher.remaining} ({rate:.1f} req/s)", flush=True)
    print(f"DONE games={done} calls={fetcher.calls} fetched={fetched} empty={empty} "
          f"remaining={fetcher.remaining}", flush=True)


if __name__ == "__main__":
    main()
