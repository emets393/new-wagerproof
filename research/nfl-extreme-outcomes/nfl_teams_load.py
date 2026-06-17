"""Load nflverse teams_colors_logos into nfl_teams (32 current teams).

Logo URLs are ESPN-CDN hosted; abbreviations match nflverse game_ids
(LA / WAS / JAX scheme) so they join directly to the dryrun tables'
home_ab / away_ab and props team / opponent.

Usage:  python3 nfl_teams_load.py
"""
import sys
from pathlib import Path

import pandas as pd
import requests

ROOT = Path(__file__).resolve().parent
URL = "https://jpxnjuwglavsjbgbasnl.supabase.co/rest/v1/nfl_teams"
SRC = "https://github.com/nflverse/nflverse-pbp/raw/master/teams_colors_logos.csv"
LEGACY = {"LAR", "OAK", "SD", "STL"}

RENAME = {"team_logo_espn": "logo_espn", "team_logo_squared": "logo_squared",
          "team_logo_wikipedia": "logo_wikipedia", "team_wordmark": "wordmark",
          "team_conference_logo": "conference_logo",
          "team_league_logo": "league_logo"}


def load_key():
    for line in (ROOT.parent.parent / ".env.local").read_text().splitlines():
        if line.startswith("SUPABASE_SERVICE_KEY="):
            return line.split("=", 1)[1].strip()
    sys.exit("SUPABASE_SERVICE_KEY not found in .env.local")


def main():
    t = pd.read_csv(SRC)
    t = t[~t.team_abbr.isin(LEGACY)].rename(columns=RENAME).drop(columns=["team_id"])
    t = t.where(t.notna(), None)
    assert len(t) == 32, f"expected 32 teams, got {len(t)}"

    key = load_key()
    hdr = {"apikey": key, "Authorization": f"Bearer {key}",
           "Content-Type": "application/json",
           "Prefer": "resolution=merge-duplicates"}
    resp = requests.post(URL + "?on_conflict=team_abbr", headers=hdr,
                         json=t.to_dict("records"), timeout=60)
    if resp.status_code not in (200, 201):
        sys.exit(f"{resp.status_code} {resp.text[:300]}")
    print(f"done: {len(t)} teams upserted into nfl_teams")


if __name__ == "__main__":
    main()
