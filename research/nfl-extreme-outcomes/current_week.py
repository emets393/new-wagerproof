"""
Derive the upcoming week for the Render slate/grade crons (render.yaml startCommands).
Prints a single integer week. Self-contained (no local imports) so it runs from any dir.

  python3 current_week.py nfl [2026]   NFL upcoming week  (min unplayed week, nflverse schedule)
  python3 current_week.py cfb [2026]   CFB upcoming week  (min unplayed week, cfb_games)

Upcoming = the first week that still has unplayed games (so it holds on the current week
until all its games finish, then advances). Falls back to 1 (preseason / no schedule yet).
"""
import io
import os
import sys
import requests
import pandas as pd

SPORT = (sys.argv[1] if len(sys.argv) > 1 else "nfl").lower()
SEASON = int(sys.argv[2]) if len(sys.argv) > 2 else 2026
ANON = os.environ.get(
    "CFB_SUPABASE_ANON_KEY",
    ("eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Impw"
     "eG5qdXdnbGF2c2piZ2Jhc25sIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI2OTc4NjEsImV4cCI6MjA2ODI3Mzg2MX0"
     ".BjOHMysQh3wST-_UR6bJxHngRThlAmOOx4FfSVKRzWo"))


def _first_unplayed(df, played_col):
    if not len(df):
        return 1
    unplayed = df[df[played_col].isna()]
    return int(unplayed["week"].min()) if len(unplayed) else int(df["week"].max())


def nfl_week():
    try:
        r = requests.get("https://github.com/nflverse/nfldata/raw/master/data/games.csv", timeout=60)
        g = pd.read_csv(io.StringIO(r.text))
        return _first_unplayed(g[g["season"] == SEASON], "result")
    except Exception:
        return 1


def cfb_week():
    try:
        key = os.environ.get("SUPABASE_SERVICE_KEY", ANON)
        r = requests.get(
            "https://jpxnjuwglavsjbgbasnl.supabase.co/rest/v1/cfb_games"
            f"?select=week,home_points&season=eq.{SEASON}",
            headers={"apikey": key, "Authorization": f"Bearer {key}"}, timeout=60)
        return _first_unplayed(pd.DataFrame(r.json()), "home_points")
    except Exception:
        return 1


print(nfl_week() if SPORT == "nfl" else cfb_week())
