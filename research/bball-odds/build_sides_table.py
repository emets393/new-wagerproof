#!/usr/bin/env python3
"""The CBB sides kitchen-sink table: one row per game, EVERYTHING joined.

Market + results + dated KenPom (incl. ranks) + boxscore s2d/l5 + style
percentiles & advantage channels + ATS/win streaks (both teams + differential)
+ rematch details (meeting-1 margin/cover/venue/days) + availability flags
(both teams) + roster attributes (height/exp/bench/continuity) + phase flags.

Feeds both the signal batteries (cbb_sides5_study.py) and the sides GBM
(ncaab_sides_model.py). Output: data/parquet/sides_table_ncaab.parquet
"""
import os

import numpy as np
import pandas as pd

from name_maps import norm
from combo3_study import height_table

ROOT = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(ROOT, "data", "parquet")

CHANNELS = (("p3_share", "d_p3_pct"), ("paint_share", "d_paint100"), ("ftr", "d_ftr"))


def main():
    df = pd.read_parquet(f"{OUT}/ncaab_model_features.parquet")
    if "season" not in df.columns:
        df = df.rename(columns={"season_x": "season"})
    # ncaab_model_features already carries the T-60 spread prices
    df = df.dropna(subset=["home_score", "t60_spread_home_point"]).copy()
    df["margin"] = df["home_score"] - df["away_score"]
    df["cover_amt"] = df["margin"] + df["t60_spread_home_point"]
    df["date_et"] = pd.to_datetime(df["date_et"])
    df["month"] = df["date_et"].dt.month
    df["nonconf"] = df["month"].isin([11, 12]).astype(int)

    # style percentiles + advantage channels
    st = pd.read_parquet(f"{OUT}/style_ncaab.parquet")
    pct_cols = [c for c in st.columns if c.startswith("pct_")]
    for side, is_home in (("h", True), ("a", False)):
        s = st[st["is_home"] == is_home][["game_key"] + pct_cols]
        s.columns = ["cbbd_id"] + [f"{side}_{c}" for c in pct_cols]
        df = df.merge(s, on="cbbd_id", how="left")
    for att, deff in (("h", "a"), ("a", "h")):
        advs = []
        for oc, dc in CHANNELS:
            col = f"{att}_adv_{oc}"
            df[col] = (df[f"{att}_pct_{oc}"] - .5) * (df[f"{deff}_pct_{dc}"] - .5)
            advs.append(col)
        df[f"{att}_style_adv"] = df[advs].sum(axis=1, min_count=1)

    # availability flags both teams
    fl = pd.read_parquet(f"{OUT}/player_flags_ncaab.parquet")[
        ["game_key", "team_id", "top1_out", "big_out", "guard_out",
         "lowto_guard_out", "reg_out_n", "stale_out_n"]].rename(
        columns={"game_key": "cbbd_id"})
    names = pd.read_parquet(f"{OUT}/cbbd_team_box.parquet",
                            columns=["gameId", "teamId", "isHome", "team",
                                     "conferenceGame", "neutralSite"]
                            ).drop_duplicates(["gameId", "teamId"])
    names = names.rename(columns={"gameId": "cbbd_id", "teamId": "team_id"})
    for side, is_home in (("h", True), ("a", False)):
        nm = names[names["isHome"] == is_home]
        f = nm[["cbbd_id", "team_id", "team"]].merge(fl, on=["cbbd_id", "team_id"], how="left")
        f = f.rename(columns={c: f"{side}_{c}" for c in
                              ("top1_out", "big_out", "guard_out", "lowto_guard_out",
                               "reg_out_n", "stale_out_n", "team", "team_id")})
        df = df.merge(f, on="cbbd_id", how="left")
    df = df.merge(names[names["isHome"]][["cbbd_id", "conferenceGame", "neutralSite"]],
                  on="cbbd_id", how="left")

    # roster attributes
    ht = height_table()
    for side in ("h", "a"):
        df[f"{side}_key"] = df[f"{side}_team"].map(norm)
        hh = ht.rename(columns={"key": f"{side}_key",
                                **{c: f"{side}_{c}" for c in
                                   ("HgtEff", "Hgt5", "Exp", "Bench", "Continuity")}})
        df = df.merge(hh, on=[f"{side}_key", "season"], how="left")

    # ATS/win streaks per team (strictly prior), then map to home/away
    long = []
    for side, sign in (("h", 1), ("a", -1)):
        long.append(pd.DataFrame({
            "team": df[f"{side}_team"], "season": df["season"],
            "date": df["date_et"], "event_id": df["event_id"],
            "side": side,
            "team_cover": np.where(sign * df["cover_amt"] > 0, 1.0,
                                   np.where(df["cover_amt"] == 0, np.nan, 0.0)),
            "team_win": (sign * df["margin"] > 0).astype(float)}))
    tg = pd.concat(long).sort_values(["team", "season", "date"])
    g = tg.groupby(["team", "season"])
    tg["l5_covers"] = g["team_cover"].transform(
        lambda s: s.shift(1).rolling(5, min_periods=3).sum())
    tg["l5_wins"] = g["team_win"].transform(
        lambda s: s.shift(1).rolling(5, min_periods=3).sum())
    tg["cover_streak"] = g["team_cover"].transform(
        lambda s: s.shift(1).groupby((s.shift(1) != 1).cumsum()).cumsum())
    for side in ("h", "a"):
        m = tg[tg["side"] == side][["event_id", "l5_covers", "l5_wins", "cover_streak"]]
        m.columns = ["event_id"] + [f"{side}_{c}" for c in ("l5_covers", "l5_wins", "cover_streak")]
        df = df.merge(m, on="event_id", how="left")
    df["cover_diff"] = df["h_l5_covers"] - df["a_l5_covers"]

    # rematch details (same pair, same season)
    df = df.sort_values("date_et")
    df["pair"] = np.where(df["h_team"] < df["a_team"],
                          df["h_team"] + "|" + df["a_team"] + "|" + df["season"],
                          df["a_team"] + "|" + df["h_team"] + "|" + df["season"])
    gp = df.groupby("pair")
    df["meet_no"] = gp.cumcount() + 1
    df["m1_margin_raw"] = gp["margin"].shift(1)          # home-perspective of MEETING 1
    df["m1_cover_raw"] = gp["cover_amt"].shift(1)
    df["m1_home_team"] = gp["h_team"].shift(1)
    df["m1_days_ago"] = (df["date_et"] - gp["date_et"].shift(1)).dt.days
    same_home = df["m1_home_team"] == df["h_team"]
    df["m1_margin_home"] = np.where(same_home, df["m1_margin_raw"], -df["m1_margin_raw"])
    df["m1_covamt_home"] = np.where(same_home, df["m1_cover_raw"], -df["m1_cover_raw"])
    df["venue_flip"] = (~same_home).astype(float).where(df["meet_no"] > 1)

    df.to_parquet(f"{OUT}/sides_table_ncaab.parquet", index=False)
    print(f"sides_table_ncaab: {len(df):,} games, {len(df.columns)} cols", flush=True)
    for c in ("h_l5_covers", "h_big_out", "home_kp_rank", "m1_margin_home", "h_Bench"):
        print(f"  {c}: {df[c].notna().mean()*100:.0f}%", flush=True)


if __name__ == "__main__":
    main()
