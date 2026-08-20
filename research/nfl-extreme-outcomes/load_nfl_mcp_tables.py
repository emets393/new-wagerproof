"""Sync the MCP-facing NFL tables from research parquets (sweep 2026-08-18).

Tables: nfl_team_scheme (team-week scheme identities — refreshes weekly in-season),
nfl_qb_scheme_splits / nfl_rusher_box_splits (career charting splits),
nfl_player_ratings (current rosters + ratings), nfl_schedule (full season).
Runs in run_nfl_week.sh; idempotent full reload per table (small tables).
"""
import json
import os
import sys

import pandas as pd
import requests

HERE = os.path.dirname(os.path.abspath(__file__))
SUPA = "https://jpxnjuwglavsjbgbasnl.supabase.co/rest/v1"


def key():
    for line in open(os.path.join(HERE, "..", "..", ".env.local")):
        if line.startswith("SUPABASE_SERVICE_KEY="):
            return line.split("=", 1)[1].strip()
    sys.exit("SUPABASE_SERVICE_KEY not in .env.local")


def main():
    sk = key()
    hdr = {"apikey": sk, "Authorization": f"Bearer {sk}",
           "Content-Type": "application/json", "Prefer": "return=minimal"}

    def load(tbl, df, wipe="id=not.is.null"):
        requests.delete(f"{SUPA}/{tbl}?{wipe}", headers=hdr, timeout=120)
        recs = json.loads(df.where(pd.notna(df), None).to_json(orient="records"))
        for i in range(0, len(recs), 4000):
            requests.post(f"{SUPA}/{tbl}", headers=hdr, json=recs[i:i + 4000], timeout=180).raise_for_status()
        print(f"[mcp-sync] {len(recs)} -> {tbl}")

    D = os.path.join(HERE, "data")
    xw = pd.read_parquet(f"{D}/players_xwalk.parquet")[["gsis_id", "display_name", "position"]] \
        .rename(columns={"gsis_id": "player_id", "display_name": "player_name"})

    d = pd.read_parquet(f"{D}/nfl_def_scheme.parquet")
    o = pd.read_parquet(f"{D}/nfl_off_scheme.parquet")
    load("nfl_team_scheme", d.merge(o, on=["team", "season", "week"], how="outer"), "team=not.is.null")

    load("nfl_qb_scheme_splits",
         pd.read_parquet(f"{D}/nfl_qb_vs_scheme.parquet").merge(xw, on="player_id", how="left"),
         "player_id=not.is.null")
    load("nfl_rusher_box_splits",
         pd.read_parquet(f"{D}/nfl_rusher_vs_box.parquet").merge(xw, on="player_id", how="left"),
         "player_id=not.is.null")

    mr = pd.read_parquet(f"{D}/madden_ratings.parquet")
    ma = pd.read_parquet(f"{D}/madden_attributes.parquet")[["season", "name", "team", "pos", "speed", "ht", "wt"]] \
        .rename(columns={"name": "mname"})
    pr = mr.merge(ma, on=["season", "mname", "team", "pos"], how="left") \
        .drop_duplicates(["season", "mname", "team", "pos"]) \
        .rename(columns={"mname": "player_name", "nname": "nflverse_name"})
    load("nfl_player_ratings", pr, "season=not.is.null")

    nv = pd.read_parquet(f"{D}/nflverse_games.parquet")
    season = int(os.environ.get("NFL_SEASON", nv.season.max()))
    sc = nv[nv.season == season][["game_id", "season", "game_type", "week", "gameday", "weekday",
                                  "gametime", "away_team", "home_team", "location", "div_game"]].copy()
    sc["gameday"] = sc.gameday.astype(str)
    load("nfl_schedule", sc, f"season=eq.{season}")


if __name__ == "__main__":
    main()
