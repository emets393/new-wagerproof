#!/usr/bin/env python3
"""Build the leak-safe NCAAB game-level feature table for the totals model.

One row per odds event with:
  - home/away season-to-date (expanding, PRIOR games only via shift) and
    last-5 form: pace, off/def efficiency, eFG for/against, 3PA rate, FT rate,
    TO ratio, ORB%
  - schedule spots: rest days, b2b, game number
  - KenPom dated ratings (archive at game's ET date — published that morning,
    reflects games through the prior day; *Final columns EXCLUDED as leaky)
  - market: open/T-60 total + spread (decimal prices), and finals as targets

Output: data/parquet/ncaab_model_features.parquet
"""
import os

import numpy as np
import pandas as pd

from name_maps import norm, kp_to_cbbd

ROOT = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(ROOT, "data", "parquet")

S2D_COLS = ["pace", "poss", "off_eff", "def_eff", "efg", "efg_allowed",
            "three_rate", "ftr", "to_ratio", "orb_pct", "pts", "opp_pts"]


def team_game_table():
    # weekly fetch chunks overlap at boundaries — a team-game can appear twice
    tb = pd.read_parquet(f"{OUT}/cbbd_team_box.parquet").drop_duplicates(["gameId", "teamId"])
    t = pd.DataFrame({
        "game_id": tb["gameId"],
        "season": tb["season"],
        "date": pd.to_datetime(tb["startDate"]).dt.tz_localize(None),
        "team": tb["team"],
        "is_home": tb["isHome"],
        "pace": tb["pace"],
        "poss": tb["teamStats.possessions"],
        "pts": tb["teamStats.points.total"],
        "opp_pts": tb["opponentStats.points.total"],
        "efg": tb["teamStats.fourFactors.effectiveFieldGoalPct"],
        "efg_allowed": tb["opponentStats.fourFactors.effectiveFieldGoalPct"],
        "three_rate": tb["teamStats.threePointFieldGoals.attempted"]
                      / tb["teamStats.fieldGoals.attempted"],
        "ftr": tb["teamStats.fourFactors.freeThrowRate"],
        "to_ratio": tb["teamStats.fourFactors.turnoverRatio"],
        "orb_pct": tb["teamStats.fourFactors.offensiveReboundPct"],
        "opp_poss": tb["opponentStats.possessions"],
    })
    t["off_eff"] = t["pts"] / t["poss"] * 100
    t["def_eff"] = t["opp_pts"] / t["opp_poss"] * 100
    t = t.sort_values(["team", "date"]).reset_index(drop=True)

    g = t.groupby(["team", "season"])
    for c in S2D_COLS:
        # shift(1): strictly prior games — the game's own box never leaks in
        t[f"s2d_{c}"] = g[c].transform(lambda s: s.shift(1).expanding().mean())
        t[f"l5_{c}"] = g[c].transform(lambda s: s.shift(1).rolling(5, min_periods=2).mean())
    t["game_num"] = g.cumcount() + 1
    t["rest_days"] = g["date"].transform(lambda s: s.diff().dt.days)
    t["b2b"] = (t["rest_days"] <= 1).astype(float)
    return t


def kenpom_table():
    kp = pd.read_parquet(f"{OUT}/kenpom_archive_daily.parquet")
    kp = kp[["ArchiveDate", "TeamName", "AdjEM", "AdjOE", "AdjDE", "AdjTempo",
             "RankAdjEM"]].copy()  # *Final columns are end-of-season = leaky
    kp["team_key"] = kp["TeamName"].map(kp_to_cbbd).map(norm)
    kp["kp_date"] = pd.to_datetime(kp["ArchiveDate"])
    return kp.drop(columns=["TeamName", "ArchiveDate"])


def main():
    games = pd.read_parquet(f"{OUT}/games_ncaab.parquet").dropna(subset=["home_score", "cbbd_id"])
    mg = pd.read_parquet(f"{OUT}/movement_games_ncaab.parquet")[
        ["event_id", "season", "open_total_point", "t60_total_point",
         "t60_total_over_price", "t60_total_under_price",
         "open_spread_home_point", "t60_spread_home_point",
         "t60_spread_home_price", "t60_spread_away_price"]]
    df = games.merge(mg, on="event_id", how="inner")
    df["date_et"] = (pd.to_datetime(df["commence_time"]).dt.tz_localize(None)
                     - pd.Timedelta(hours=5)).dt.normalize()

    t = team_game_table()
    feat_cols = ([f"s2d_{c}" for c in S2D_COLS] + [f"l5_{c}" for c in S2D_COLS]
                 + ["game_num", "rest_days", "b2b"])
    for side, is_home in (("home", True), ("away", False)):
        sub = t[t["is_home"] == is_home][["game_id"] + feat_cols]
        sub.columns = ["cbbd_id"] + [f"{side}_{c}" for c in feat_cols]
        df = df.merge(sub, on="cbbd_id", how="left")

    kp = kenpom_table()
    for side in ("home", "away"):
        df[f"{side}_key"] = df[f"{side}_team"].map(norm)
    # odds names -> CBBD keys were already resolved in games_ncaab? No — games spine
    # keeps odds names; reuse the mapping via team box names instead: pull the CBBD
    # team name per game_id/side from the boxscore table (exact, no fuzzy).
    names = pd.read_parquet(f"{OUT}/cbbd_team_box.parquet",
                            columns=["gameId", "team", "isHome"]
                            ).drop_duplicates(["gameId", "isHome"])
    for side, is_home in (("home", True), ("away", False)):
        m = names[names["isHome"] == is_home].rename(
            columns={"gameId": "cbbd_id", "team": f"{side}_cbbd"})
        df = df.merge(m[["cbbd_id", f"{side}_cbbd"]], on="cbbd_id", how="left")
        df[f"{side}_key"] = df[f"{side}_cbbd"].map(norm)
        kps = kp.rename(columns={
            "team_key": f"{side}_key", "kp_date": "date_et",
            "AdjEM": f"{side}_kp_em", "AdjOE": f"{side}_kp_oe",
            "AdjDE": f"{side}_kp_de", "AdjTempo": f"{side}_kp_tempo",
            "RankAdjEM": f"{side}_kp_rank"})
        df = df.merge(kps, on=[f"{side}_key", "date_et"], how="left")

    df = df.drop_duplicates("event_id")
    df["total_actual"] = df["home_score"] + df["away_score"]
    df["h1_total_actual"] = df["home_h1"] + df["away_h1"]
    df.to_parquet(f"{OUT}/ncaab_model_features.parquet", index=False)

    n = len(df)
    print(f"ncaab_model_features: {n:,} games, {len(df.columns)} cols", flush=True)
    for c in ["home_s2d_pace", "home_kp_em", "away_kp_em", "t60_total_point"]:
        print(f"  {c} coverage: {df[c].notna().mean()*100:.1f}%", flush=True)


if __name__ == "__main__":
    main()
