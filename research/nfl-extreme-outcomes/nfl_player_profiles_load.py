"""Load nflverse roster (names, IDs, headshot_url) into nfl_player_profiles.

Source: nflverse roster parquet for the given season — includes a CDN-hosted
headshot_url for ~97% of players (100% of active). Upserts on gsis_id, so
re-running with a fresh roster (weekly in-season) keeps team/status current.

Usage:  python3 nfl_player_profiles_load.py [--season 2025]
"""
import argparse
import sys
from pathlib import Path

import numpy as np
import pandas as pd
import requests

ROOT = Path(__file__).resolve().parent
URL = "https://jpxnjuwglavsjbgbasnl.supabase.co/rest/v1/nfl_player_profiles"
SRC = "https://github.com/nflverse/nflverse-data/releases/download/rosters/roster_{season}.parquet"
BATCH = 500

COLS = ["season", "full_name", "first_name", "last_name", "football_name",
        "team", "position", "depth_chart_position", "jersey_number", "status",
        "birth_date", "height", "weight", "college", "years_exp", "rookie_year",
        "draft_club", "draft_number", "espn_id", "pfr_id", "sleeper_id",
        "sportradar_id", "headshot_url", "gsis_id"]
INT_COLS = ["season", "jersey_number", "height", "weight", "years_exp",
            "rookie_year", "draft_number"]


def load_key():
    for line in (ROOT.parent.parent / ".env.local").read_text().splitlines():
        if line.startswith("SUPABASE_SERVICE_KEY="):
            return line.split("=", 1)[1].strip()
    sys.exit("SUPABASE_SERVICE_KEY not found in .env.local")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--season", type=int, default=2025)
    ap.add_argument("--fill-missing", action="store_true",
                    help="insert only players not already in the table "
                         "(backfill older seasons without overwriting current)")
    args = ap.parse_args()

    r = pd.read_parquet(SRC.format(season=args.season))
    r = r[r.gsis_id.notna() & (r.gsis_id.astype(str).str.len() > 0)].copy()
    # one row per player: prefer active status, then latest week seen
    r["act"] = (r.status == "ACT").astype(int)
    r = (r.sort_values(["act", "week"]).groupby("gsis_id", as_index=False).last())
    r["birth_date"] = pd.to_datetime(r.birth_date, errors="coerce").dt.strftime("%Y-%m-%d")
    for c in ("espn_id", "sleeper_id"):
        r[c] = r[c].astype("string").str.replace(r"\.0$", "", regex=True)
    r = r[COLS]
    for c in INT_COLS:
        r[c] = pd.to_numeric(r[c], errors="coerce").astype("Int64")
    r = r.replace({np.nan: None, pd.NA: None, "": None, "NaT": None})
    print(f"{len(r)} players, headshot coverage "
          f"{r.headshot_url.notna().mean():.1%}")

    key = load_key()
    prefer = ("resolution=ignore-duplicates" if args.fill_missing
              else "resolution=merge-duplicates")
    hdr = {"apikey": key, "Authorization": f"Bearer {key}",
           "Content-Type": "application/json", "Prefer": prefer}
    rows = r.to_dict("records")
    for i in range(0, len(rows), BATCH):
        resp = requests.post(URL + "?on_conflict=gsis_id", headers=hdr,
                             json=rows[i:i + BATCH], timeout=60)
        if resp.status_code not in (200, 201):
            sys.exit(f"batch {i}: {resp.status_code} {resp.text[:300]}")
        print(f"  upserted {min(i + BATCH, len(rows))}/{len(rows)}", end="\r")
    print(f"\ndone: {len(rows)} rows upserted into nfl_player_profiles")


if __name__ == "__main__":
    main()
