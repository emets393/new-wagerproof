"""Populate nfl_dryrun_games.assigned_referee for the slate.

Ref trends attach to a matchup via the assigned head referee, but the slate builder
doesn't carry it. For the dry-run we source assignments from nflverse (completed-game
referees). In production this should be replaced by the weekly NFL ref-assignment feed
(released ~Wednesday) — same target column.

Run AFTER the slate is built (it PATCHes existing rows). Idempotent.
Usage:  python3 backfill_dryrun_referees.py
"""
import io
import os
import sys
from pathlib import Path

import pandas as pd
import requests

ROOT = Path(__file__).resolve().parent
BASE_URL = "https://jpxnjuwglavsjbgbasnl.supabase.co/rest/v1"
SEASON = int(os.environ.get("NFL_SEASON", 2025))
WEEK = int(os.environ.get("NFL_WEEK", 12))
GAMES_CSV = "https://github.com/nflverse/nfldata/raw/master/data/games.csv"
NORM = {"LAR": "LA", "WSH": "WAS", "JAC": "JAX", "OAK": "LV", "SD": "LAC", "STL": "LA"}


def load_key():
    for line in (ROOT.parent.parent / ".env.local").read_text().splitlines():
        if line.startswith("SUPABASE_SERVICE_KEY="):
            return line.split("=", 1)[1].strip()
    sys.exit("SUPABASE_SERVICE_KEY not found in .env.local")


def main():
    g = pd.read_csv(io.StringIO(requests.get(GAMES_CSV, timeout=90).text))
    g = g[(g.season == SEASON) & (g.week == WEEK) & g.referee.notna()].copy()
    g["home_ab"] = g.home_team.replace(NORM)
    g["away_ab"] = g.away_team.replace(NORM)
    if not len(g):
        print(f"[refs] no referee assignments available for {SEASON} wk{WEEK} yet — skipping")
        return
    key = load_key()
    hdr = {"apikey": key, "Authorization": f"Bearer {key}",
           "Content-Type": "application/json", "Prefer": "return=minimal"}
    n = 0
    for r in g.itertuples():
        resp = requests.patch(
            f"{BASE_URL}/nfl_dryrun_games?season=eq.{SEASON}&week=eq.{WEEK}"
            f"&home_ab=eq.{r.home_ab}&away_ab=eq.{r.away_ab}",
            headers=hdr, json={"assigned_referee": r.referee}, timeout=60)
        if resp.status_code in (200, 204):
            n += 1
    print(f"[refs] set assigned_referee on {n}/{len(g)} games for {SEASON} wk{WEEK}")


if __name__ == "__main__":
    main()
