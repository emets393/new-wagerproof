"""Sync public.cfb_game_advanced from data/cfbd/game_advanced_*.parquet.

Created 2026-08-17 after MCP users hit the frozen legacy table (cfb_api_training_data,
2018-2024) and were told "no 2025 advanced data". This table is the current-source
replacement: per-game REALIZED CFBD advanced efficiency, one row per team per game,
2016-2025 complete + 2026 appending in-season (this script runs in run_cfb_week.sh).
Idempotent: wipes + reloads only seasons present in the parquets.
"""
import glob
import json
import os
import sys

import pandas as pd
import requests

HERE = os.path.dirname(os.path.abspath(__file__))
SUPA = "https://jpxnjuwglavsjbgbasnl.supabase.co/rest/v1"

KEEP = {
    "gameId": "game_id", "season": "season", "seasonType": "season_type", "week": "week",
    "team": "team", "opponent": "opponent",
    "offense.plays": "off_plays", "offense.drives": "off_drives",
    "offense.ppa": "off_epa_per_play", "offense.successRate": "off_success_rate",
    "offense.explosiveness": "off_explosiveness", "offense.lineYards": "off_line_yards",
    "offense.secondLevelYards": "off_second_level_yards",
    "offense.openFieldYards": "off_open_field_yards",
    "offense.powerSuccess": "off_power_success", "offense.stuffRate": "off_stuff_rate",
    "offense.standardDowns.ppa": "off_std_downs_epa",
    "offense.passingDowns.ppa": "off_pass_downs_epa",
    "offense.rushingPlays.ppa": "off_rush_epa", "offense.passingPlays.ppa": "off_pass_epa",
    "defense.plays": "def_plays", "defense.ppa": "def_epa_per_play_allowed",
    "defense.successRate": "def_success_rate_allowed",
    "defense.explosiveness": "def_explosiveness_allowed",
    "defense.rushingPlays.ppa": "def_rush_epa_allowed",
    "defense.passingPlays.ppa": "def_pass_epa_allowed",
}


def key():
    for line in open(os.path.join(HERE, "..", "..", ".env.local")):
        if line.startswith("SUPABASE_SERVICE_KEY="):
            return line.split("=", 1)[1].strip()
    sys.exit("SUPABASE_SERVICE_KEY not in .env.local")


def main():
    only = int(sys.argv[1]) if len(sys.argv) > 1 else None   # optionally one season
    frames = []
    for f in sorted(glob.glob(os.path.join(HERE, "data", "cfbd", "game_advanced_20*.parquet"))):
        d = pd.read_parquet(f)
        if not len(d):
            continue
        cols = {k: v for k, v in KEEP.items() if k in d.columns}
        frames.append(d[list(cols)].rename(columns=cols))
    df = pd.concat(frames, ignore_index=True).drop_duplicates(["game_id", "team"])
    if only:
        df = df[df.season == only]
    if not len(df):
        print("[cfb_game_advanced] nothing to load")
        return
    df = df.where(pd.notna(df), None)
    sk = key()
    hdr = {"apikey": sk, "Authorization": f"Bearer {sk}",
           "Content-Type": "application/json", "Prefer": "return=minimal"}
    for season in sorted(df.season.unique()):
        requests.delete(f"{SUPA}/cfb_game_advanced?season=eq.{int(season)}", headers=hdr, timeout=60)
    recs = json.loads(df.to_json(orient="records"))
    for i in range(0, len(recs), 4000):
        r = requests.post(f"{SUPA}/cfb_game_advanced", headers=hdr, json=recs[i:i + 4000], timeout=120)
        r.raise_for_status()
    print(f"[cfb_game_advanced] loaded {len(recs)} rows, seasons {sorted(df.season.unique())}")


if __name__ == "__main__":
    main()
