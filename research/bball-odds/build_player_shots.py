#!/usr/bin/env python3
"""Re-slim raw plays keeping the SHOOTER id -> player-level shot profiles.

Output: data/parquet/player_shots_ncaab.parquet — one row per FG attempt:
gameId, season, teamId, shooter_id, range, made, assisted. Powers player
shot-zone profiles (star-vs-defense archetype work) and OT flags per game.
"""
import glob
import gzip
import json
import os

import pandas as pd

ROOT = os.path.dirname(os.path.abspath(__file__))
RAW = os.path.join(ROOT, "data", "plays_raw")
OUT = os.path.join(ROOT, "data", "parquet")


def main():
    rows, ot_rows = [], []
    files = sorted(glob.glob(f"{RAW}/*.json.gz"))
    for i, path in enumerate(files):
        with gzip.open(path, "rt") as f:
            plays = json.load(f)
        max_period = {}
        for p in plays:
            gid = p["gameId"]
            max_period[gid] = max(max_period.get(gid, 0), p.get("period") or 0)
            if not p.get("shootingPlay"):
                continue
            si = p.get("shotInfo") or {}
            sh = (si.get("shooter") or {}).get("id")
            rng = si.get("range")
            if sh is None or rng in (None, "free_throw"):
                continue
            rows.append((gid, p["season"], p["teamId"], sh, rng,
                         bool(si.get("made")), bool(si.get("assisted"))))
        for gid, mp in max_period.items():
            ot_rows.append((gid, mp))
        if i % 100 == 0:
            print(f"  {i}/{len(files)}", flush=True)
    df = pd.DataFrame(rows, columns=["gameId", "season", "teamId", "shooter_id",
                                     "range", "made", "assisted"])
    df.to_parquet(f"{OUT}/player_shots_ncaab.parquet", index=False)
    ot = pd.DataFrame(ot_rows, columns=["gameId", "max_period"]).groupby(
        "gameId")["max_period"].max().reset_index()
    ot["went_ot"] = ot["max_period"] > 2
    ot.to_parquet(f"{OUT}/game_ot_ncaab.parquet", index=False)
    print(f"player_shots: {len(df):,} FGAs | OT games: {ot['went_ot'].sum():,}", flush=True)


if __name__ == "__main__":
    main()
