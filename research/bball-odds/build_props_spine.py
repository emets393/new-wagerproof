#!/usr/bin/env python3
"""NBA props grading spine: consensus T-60 closes joined to player actuals.

props_nba_{season}.parquet (book-level) -> consensus per event x market x
player (median line, decimal-median prices) -> joined to BDL player boxscores
by normalized name + ET date. DNP (no box row / 0 min) = VOID, excluded.

Output: data/parquet/props_graded.parquet + match-rate / base-rate report.
"""
import glob
import os

import numpy as np
import pandas as pd

from movement_study import am_to_dec
from name_maps import norm

ROOT = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(ROOT, "data", "parquet")

STAT_MAP = {
    "player_points": ["pts"],
    "player_rebounds": ["reb"],
    "player_assists": ["ast"],
    "player_threes": ["fg3m"],
    "player_blocks": ["blk"],
    "player_steals": ["stl"],
    "player_points_rebounds_assists": ["pts", "reb", "ast"],
    "player_points_rebounds": ["pts", "reb"],
    "player_points_assists": ["pts", "ast"],
    "player_rebounds_assists": ["reb", "ast"],
}


def main():
    frames = []
    for p in sorted(glob.glob(f"{OUT}/props_nba_*.parquet")):
        season = os.path.basename(p).replace("props_nba_", "").replace(".parquet", "")
        df = pd.read_parquet(p)
        df["season"] = season
        frames.append(df)
    pr = pd.concat(frames, ignore_index=True)
    pr["over_dec"] = am_to_dec(pr["over_price"])
    pr["under_dec"] = am_to_dec(pr["under_price"])

    cons = pr.groupby(["season", "event_id", "commence_time", "home_team",
                       "away_team", "market", "player"]).agg(
        line=("line_point", "median"),
        over_dec=("over_dec", "median"),
        under_dec=("under_dec", "median"),
        n_books=("book", "nunique")).reset_index()
    print(f"consensus prop rows: {len(cons):,}", flush=True)

    pb = pd.read_parquet(f"{OUT}/bdl_player_box.parquet")
    stats = pd.DataFrame({
        "pkey": (pb["player.first_name"] + " " + pb["player.last_name"]).map(norm),
        "date_et": pd.to_datetime(pb["game.date"]),
        "team_id": pb["team.id"],
        "mins": pd.to_numeric(pb["min"], errors="coerce"),
        "pts": pb["pts"], "reb": pb["reb"], "ast": pb["ast"],
        "fg3m": pb["fg3m"], "blk": pb["blk"], "stl": pb["stl"],
    }).drop_duplicates(["pkey", "date_et"])

    cons["pkey"] = cons["player"].map(norm)
    cons["date_et"] = (pd.to_datetime(cons["commence_time"])
                       .dt.tz_localize(None) - pd.Timedelta(hours=5)).dt.normalize()
    g = cons.merge(stats, on=["pkey", "date_et"], how="left")
    played = g["mins"].fillna(0) > 0
    print(f"matched to a box line: {(g['pts'].notna()).mean()*100:.1f}% | "
          f"played (non-void): {played.mean()*100:.1f}%", flush=True)

    g = g[played].copy()
    g["actual"] = 0.0
    for mkt, cols in STAT_MAP.items():
        m = g["market"] == mkt
        g.loc[m, "actual"] = g.loc[m, cols].sum(axis=1)
    g["over"] = g["actual"] > g["line"]
    g["push"] = g["actual"] == g["line"]

    ok = ~g["push"]
    print(f"graded props: {len(g):,} | over rate (ex-push): "
          f"{g.loc[ok, 'over'].mean()*100:.2f}%", flush=True)
    for mkt, sub in g[ok].groupby("market"):
        print(f"  {mkt:34s} n={len(sub):7,} over {sub['over'].mean()*100:.1f}% "
              f"avg line {sub['line'].mean():.1f}", flush=True)
    g.drop(columns=["pkey"]).to_parquet(f"{OUT}/props_graded.parquet", index=False)
    print("saved props_graded.parquet", flush=True)


if __name__ == "__main__":
    main()
