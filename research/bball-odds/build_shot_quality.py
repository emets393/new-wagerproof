#!/usr/bin/env python3
"""Shot-quality generated/allowed from CBB coordinates — the free tier of "real shot quality".

WHAT IS NEW vs possession_team_games. That table already carries the 3-bucket allowed
profile (rim_rate_alwd, three_pct_alwd...). This one adds the layer those buckets can't
see: an EXPECTED make probability per shot from fine distance bins built on 3.5M shots,
so a defense is scored on the QUALITY of the looks it concedes (xPTS allowed) separately
from whether those looks went in (the luck gap). The modeling bet is the classic split:
location mix forced is sticky defensive skill; opponent make% on those looks is mostly
noise and should regress. Owner brief 2026-08-02: build the free version first, and
ShotQuality's paid defender variables must later beat this baseline or we don't renew.

Expectation table = P(make) per (range x distance-bin), expanding over ALL shots in
chronological order with shrinkage toward the running league rate — the same
construction as nba_regression_build.expected_points, coarse buckets standing in for
its is3 flag because college coords are 85-99% covered and range never missing.
Shots without coordinates fall back to a range-only bin. No same-game leak reaches any
feature row: per-team aggregates are shift(1)-expanding, so game g only ever sees games
strictly before g.

Output: data/parquet/shot_quality_ncaab.parquet — one row per (gameId, teamId) with
p_* strictly-prior features, joined into the panel by cbb_blocks.py as the `xq` family.
"""
import glob
import os

import numpy as np
import pandas as pd

ROOT = os.path.dirname(os.path.abspath(__file__))
PQ = os.path.join(ROOT, "data", "parquet")

# Rims at (5.25, 25) and (88.75, 25) in feet on the 940x500 tenth-of-foot court; geometry
# validated against the FG% distance curve (63.7% at 0-4ft -> 33% at 25-30ft, college
# line resolving at 22.15ft).
SHRINK = 200          # bin prior weight, mirrors the NBA builder
MIN_BIN = 200         # burn-in: below this many prior shots the bin has no expectation
EDGES = [0, 3, 6, 10, 14, 18, 22.15, 25, 28, 32, 100]


def load_shots():
    frames = []
    for p in sorted(glob.glob(f"{PQ}/plays_ncaab_*.parquet")):
        pl = pd.read_parquet(p, columns=[
            "gameId", "teamId", "season", "homeWinProbability", "shootingPlay",
            "shot_range", "shot_made", "shot_x", "shot_y", "scoringPlay"])
        pl["season_lbl"] = os.path.basename(p).replace(
            "plays_ncaab_", "").replace(".parquet", "")
        wp = pl["homeWinProbability"].fillna(0.5)
        competitive = (wp >= 0.04) & (wp <= 0.96)   # same garbage-time cut as possession block
        s = pl[competitive & pl["shootingPlay"].fillna(False)
               & pl["shot_range"].notna() & (pl["shot_range"] != "free_throw")].copy()
        frames.append(s)
    S = pd.concat(frames, ignore_index=True)

    X, Y = S["shot_x"] / 10.0, S["shot_y"] / 10.0
    dx = np.minimum((X - 5.25).abs(), (X - 88.75).abs())
    S["dist"] = np.sqrt(dx ** 2 + (Y - 25.0) ** 2)
    S["is3"] = S["shot_range"] == "three_pointer"
    S["made"] = S["shot_made"].fillna(False).astype(int)
    S["pts_val"] = np.where(S["is3"], 3.0, 2.0)

    dates = pd.read_parquet(f"{PQ}/cbbd_team_box.parquet",
                            columns=["gameId", "startDate"]).drop_duplicates("gameId")
    dates["date"] = pd.to_datetime(dates["startDate"]).dt.tz_localize(None)
    S = S.merge(dates[["gameId", "date"]], on="gameId", how="left")
    S = S.dropna(subset=["date"]).sort_values(["date", "gameId"]).reset_index(drop=True)
    return S


def expected_points(S):
    """P(make) per (range x distance bin) from strictly prior shots, expanding + shrunk."""
    db = pd.cut(S["dist"], EDGES, labels=False, include_lowest=True)
    S["bin"] = S["shot_range"] + "_" + db.astype("Int64").astype(str)   # NaN dist -> range-only bin
    g = S.groupby("bin", sort=False)["made"]
    prior_n = g.cumcount()
    prior_made = g.cumsum() - S["made"]
    glob_n = np.arange(len(S))
    glob_made = S["made"].cumsum() - S["made"]
    glob_rate = np.where(glob_n > 0, glob_made / np.maximum(glob_n, 1), 0.44)
    p = (prior_made + SHRINK * glob_rate) / (prior_n + SHRINK)
    S["xp"] = p * S["pts_val"]
    S.loc[prior_n < MIN_BIN, "xp"] = np.nan
    S["ap"] = S["made"] * S["pts_val"]
    print(f"  xPTS table: {100 * (prior_n < MIN_BIN).mean():.1f}% burn-in, league "
          f"xPTS/shot {S['xp'].mean():.3f} vs actual {S['ap'].mean():.3f}", flush=True)
    assert abs(S["xp"].mean() - S["ap"].mean()) < 0.03, "expectation is mis-calibrated"
    return S


def team_games(S):
    v = S.dropna(subset=["xp"]).copy()
    v["rim4"] = (v["dist"] <= 4).astype(float)
    v["long2"] = ((~v["is3"]) & (v["dist"] >= 12)).astype(float)
    v["deep3"] = (v["is3"] & (v["dist"] >= 25)).astype(float)
    g = v.groupby(["gameId", "teamId", "season_lbl"]).agg(
        n=("xp", "size"), xp=("xp", "sum"), ap=("ap", "sum"),
        rim4=("rim4", "mean"), long2=("long2", "mean"), deep3=("deep3", "mean"),
        mdist=("dist", "mean"), date=("date", "first")).reset_index()
    g = g[g["n"] >= 20]                      # a competitive-shots floor; partial rows are noise
    g["xq"] = g["xp"] / g["n"]               # quality of looks generated, xPTS per shot
    g["luck"] = (g["ap"] - g["xp"]) / g["n"] # finishing above/below the looks, per shot

    opp = g[["gameId", "teamId", "xq", "luck", "rim4", "long2", "deep3", "mdist"]].copy()
    opp.columns = ["gameId", "opp_id", "xq_alwd", "luck_alwd", "rim4_alwd",
                   "long2_alwd", "deep3_alwd", "mdist_alwd"]
    m = g.merge(opp, on="gameId")
    m = m[m["teamId"] != m["opp_id"]].drop_duplicates(["gameId", "teamId"])
    return m


def main():
    S = load_shots()
    print(f"shots: {len(S):,} competitive FGAs, coords {S['dist'].notna().mean():.1%}", flush=True)
    S = expected_points(S)
    m = team_games(S)

    RAW = ["xq", "luck", "rim4", "long2", "deep3", "mdist",
           "xq_alwd", "luck_alwd", "rim4_alwd", "long2_alwd", "deep3_alwd", "mdist_alwd"]
    m["tkey"] = m["teamId"].astype(str) + "_" + m["season_lbl"]
    m = m.sort_values(["tkey", "date"])
    grp = m.groupby("tkey")
    for c in RAW:
        m[f"p_{c}"] = grp[c].transform(lambda s: s.shift(1).expanding(min_periods=4).mean())

    keep = ["gameId", "teamId", "season_lbl", "date"] + [f"p_{c}" for c in RAW]
    m[keep].to_parquet(f"{PQ}/shot_quality_ncaab.parquet", index=False)
    print(f"shot_quality_ncaab: {len(m):,} team-games, prior coverage "
          f"{m['p_xq'].notna().mean():.1%}", flush=True)


if __name__ == "__main__":
    main()
