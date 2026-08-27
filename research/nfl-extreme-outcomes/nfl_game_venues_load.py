"""Load per-game NFL venues from nflverse into nfl_game_venues (CFB Supabase).

Owner directive 2026-08-27: venue resolution comes from the nflverse schedule
(stadium, roof, neutral-site), not the legacy per-team scrape tables — those
don't fill until September and would have sent 8 international 2026 games
(incl. LA-SF at Melbourne Cricket Ground, WEEK 1) to the home team's US
stadium for weather.

Everything is resolved AT LOAD: coordinates come from nfl_stadium_weather by
venue name (alias-normalized), falling back to the home team's own stadium row
for standard home games. An UNRESOLVED NEUTRAL-SITE venue is a hard failure —
that is exactly the case this table exists for. Full-replace per season.

Usage:  python3 nfl_game_venues_load.py [--season 2026]
"""
import argparse
import sys
from pathlib import Path

import pandas as pd
import requests

ROOT = Path(__file__).resolve().parent
URL = "https://jpxnjuwglavsjbgbasnl.supabase.co/rest/v1"
GAMES_CSV = "https://github.com/nflverse/nfldata/raw/master/data/games.csv"

# nflverse abbr -> VSIN city (nfl_betting_lines.home_team scheme)
ABBR_TO_VSIN = {
    "ARI": "Arizona", "ATL": "Atlanta", "BAL": "Baltimore", "BUF": "Buffalo",
    "CAR": "Carolina", "CHI": "Chicago", "CIN": "Cincinnati", "CLE": "Cleveland",
    "DAL": "Dallas", "DEN": "Denver", "DET": "Detroit", "GB": "Green Bay",
    "HOU": "Houston", "IND": "Indianapolis", "JAX": "Jacksonville", "KC": "Kansas City",
    "LAC": "LA Chargers", "LA": "LA Rams", "LV": "Las Vegas", "MIA": "Miami",
    "MIN": "Minnesota", "NYG": "NY Giants", "NYJ": "NY Jets", "NE": "New England",
    "NO": "New Orleans", "PHI": "Philadelphia", "PIT": "Pittsburgh", "SF": "San Francisco",
    "SEA": "Seattle", "TB": "Tampa Bay", "TEN": "Tennessee", "WAS": "Washington",
}

# nflverse stadium string -> nfl_stadium_weather.vsin_team_name, where names differ
VENUE_ALIASES = {
    "Bernabeu": "Bernabeu Stadium",
    "Estadio Bernabeu": "Bernabeu Stadium",
    "Allianz Arena": "FC Bayern Munich Stadium",
    "Estadio Azteca": "Estadio Banorte",
    "Olympiastadion": "Olympic Stadium",
    "Olympic Stadium (Berlin)": "Olympic Stadium",
    "Corinthians Arena": "Arena Corinthians",
    "Neo Quimica Arena": "Arena Corinthians",
}


def load_key():
    for fn in (ROOT.parent.parent / ".env.local", ROOT.parent.parent / ".env"):
        if fn.exists():
            for line in fn.read_text().splitlines():
                if line.startswith("SUPABASE_SERVICE_KEY="):
                    return line.split("=", 1)[1].strip()
    sys.exit("SUPABASE_SERVICE_KEY not found")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--season", type=int, default=None)
    args = ap.parse_args()
    import datetime as dt
    today = dt.date.today()
    season = args.season or (today.year if today.month >= 3 else today.year - 1)

    key = load_key()
    hdr = {"apikey": key, "Authorization": f"Bearer {key}", "Content-Type": "application/json"}

    sw = requests.get(f"{URL}/nfl_stadium_weather?select=vsin_team_name,field_type,dome_stadium,latitude,longitude",
                      headers=hdr, timeout=30).json()
    sw_by_name = {r["vsin_team_name"]: r for r in sw}

    g = pd.read_csv(GAMES_CSV)
    g = g[(g.season == season) & (g.game_type == "REG")] if "game_type" in g.columns else g[g.season == season]
    if g.empty:
        sys.exit(f"nflverse has no {season} rows")

    rows, unresolved_neutral = [], []
    for r in g.itertuples():
        vsin_home = ABBR_TO_VSIN.get(r.home_team)
        if not vsin_home:
            continue
        neutral = str(getattr(r, "location", "Home")) == "Neutral"
        stadium = getattr(r, "stadium", None)
        stadium = None if pd.isna(stadium) else str(stadium)
        roof = getattr(r, "roof", None)
        roof = None if pd.isna(roof) else str(roof)

        # coords: exact/aliased venue row first, else the home team's stadium row
        # (correct for every standard home game). Neutral + unresolved = FAIL.
        venue_row = None
        if stadium:
            venue_row = sw_by_name.get(stadium) or sw_by_name.get(VENUE_ALIASES.get(stadium, ""))
        if venue_row is None and not neutral:
            venue_row = sw_by_name.get(vsin_home)
        if venue_row is None:
            unresolved_neutral.append((r.game_id, stadium))
            continue

        # roof from nflverse wins (per-game truth, incl. scheduled-closed
        # retractables); static dome flag fills the unlabeled games.
        dome = (roof in ("dome", "closed")) if roof else bool(venue_row.get("dome_stadium"))
        rows.append(dict(
            game_id=str(r.game_id), season=int(r.season), week=int(r.week),
            home_team=str(r.home_team), away_team=str(r.away_team), vsin_home=vsin_home,
            stadium=stadium or venue_row["vsin_team_name"], roof=roof, neutral=neutral,
            dome_stadium=dome, field_type=venue_row.get("field_type"),
            latitude=venue_row.get("latitude"), longitude=venue_row.get("longitude"),
            gameday=str(getattr(r, "gameday", "")) or None,
        ))

    if unresolved_neutral:
        sys.exit(f"UNRESOLVED NEUTRAL-SITE VENUE(S) — add coords to nfl_stadium_weather "
                 f"(+ alias if named differently): {unresolved_neutral}")

    requests.delete(f"{URL}/nfl_game_venues?season=eq.{season}", headers=hdr, timeout=60)
    for i in range(0, len(rows), 500):
        resp = requests.post(f"{URL}/nfl_game_venues", headers=hdr, json=rows[i:i + 500], timeout=60)
        if resp.status_code != 201:
            sys.exit(f"insert failed: {resp.status_code} {resp.text[:300]}")
    n_neutral = sum(1 for r in rows if r["neutral"])
    print(f"loaded {len(rows)} venue rows for {season} ({n_neutral} neutral-site) -> nfl_game_venues")


if __name__ == "__main__":
    main()
