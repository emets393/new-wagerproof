#!/usr/bin/env python3
"""Possession-level team features from CBBD plays (the information upgrade).

Per team-game, computed on COMPETITIVE plays only (win prob in [0.04, 0.96] —
garbage time excluded, the noise KenPom-style season aggregates keep):

  clean_off / clean_def   points per 100 possessions (competitive)
  rim_rate / rim_pct      share of FGA at the rim, FG% there — and ALLOWED
  three_rate / three_pct  same for threes — and ALLOWED
  ast_rate                assisted share of makes
  ftr                     FTA/FGA (competitive)

Then strictly-prior expanding (shift-1) season-to-date values, plus a light
opponent adjustment: each game's efficiency measured RELATIVE to the
opponent's own prior allowed-efficiency, re-centered on the league average.

Output: data/parquet/possession_team_games.parquet (one row per team-game
with prior features as of that game).
"""
import glob
import os

import numpy as np
import pandas as pd

ROOT = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(ROOT, "data", "parquet")


def per_game():
    frames = []
    for p in sorted(glob.glob(f"{OUT}/plays_ncaab_*.parquet")):
        season = os.path.basename(p).replace("plays_ncaab_", "").replace(".parquet", "")
        pl = pd.read_parquet(p)
        pl["season_lbl"] = season

        wp = pl["homeWinProbability"].fillna(0.5)
        competitive = (wp >= 0.04) & (wp <= 0.96)
        is_fga = pl["shootingPlay"] & (pl["shot_range"] != "free_throw") \
            & pl["shot_range"].notna()
        is_ft = pl["shot_range"] == "free_throw"
        is_to = pl["playType"].str.contains("Turnover", na=False)
        is_oreb = pl["playType"] == "Offensive Rebound"
        made = pl["shot_made"].fillna(False).astype(bool)
        pts = np.where(pl["scoringPlay"].fillna(False), pl["scoreValue"].fillna(0), 0)

        c = pl[competitive].assign(
            fga=is_fga[competitive].astype(int),
            fta=is_ft[competitive].astype(int),
            to=is_to[competitive].astype(int),
            oreb=is_oreb[competitive].astype(int),
            pts=pts[competitive],
            rim_att=(is_fga & (pl["shot_range"] == "rim"))[competitive].astype(int),
            rim_made=(is_fga & (pl["shot_range"] == "rim") & made)[competitive].astype(int),
            three_att=(is_fga & (pl["shot_range"] == "three_pointer"))[competitive].astype(int),
            three_made=(is_fga & (pl["shot_range"] == "three_pointer") & made)[competitive].astype(int),
            fg_made=(is_fga & made)[competitive].astype(int),
            assisted=(made & pl["shot_assisted"].fillna(False))[competitive].astype(int),
        )
        g = c.groupby(["gameId", "teamId", "isHomeTeam", "season_lbl"]).agg(
            fga=("fga", "sum"), fta=("fta", "sum"), to=("to", "sum"),
            oreb=("oreb", "sum"), pts=("pts", "sum"),
            rim_att=("rim_att", "sum"), rim_made=("rim_made", "sum"),
            three_att=("three_att", "sum"), three_made=("three_made", "sum"),
            fg_made=("fg_made", "sum"), assisted=("assisted", "sum")).reset_index()
        frames.append(g)
        print(f"[{season}] {len(g):,} team-games", flush=True)
    return pd.concat(frames, ignore_index=True)


def main():
    g = per_game()
    g["poss"] = g["fga"] - g["oreb"] + g["to"] + 0.475 * g["fta"]
    g["off_eff"] = g["pts"] / g["poss"].replace(0, np.nan) * 100
    g["rim_rate"] = g["rim_att"] / g["fga"].replace(0, np.nan)
    g["rim_pct"] = g["rim_made"] / g["rim_att"].replace(0, np.nan)
    g["three_rate"] = g["three_att"] / g["fga"].replace(0, np.nan)
    g["three_pct"] = g["three_made"] / g["three_att"].replace(0, np.nan)
    g["ast_rate"] = g["assisted"] / g["fg_made"].replace(0, np.nan)
    g["ftr"] = g["fta"] / g["fga"].replace(0, np.nan)

    # defensive mirror = opponent's offensive line in the same game
    opp = g[["gameId", "teamId", "off_eff", "rim_rate", "rim_pct",
             "three_rate", "three_pct", "ftr"]].copy()
    opp.columns = ["gameId", "opp_id", "def_eff", "rim_rate_alwd", "rim_pct_alwd",
                   "three_rate_alwd", "three_pct_alwd", "ftr_alwd"]
    m = g.merge(opp, on="gameId")
    m = m[m["teamId"] != m["opp_id"]].drop_duplicates(["gameId", "teamId"])

    dates = pd.read_parquet(f"{OUT}/cbbd_team_box.parquet",
                            columns=["gameId", "teamId", "startDate"]
                            ).drop_duplicates(["gameId", "teamId"])
    m = m.merge(dates, on=["gameId", "teamId"], how="left")
    m["date"] = pd.to_datetime(m["startDate"]).dt.tz_localize(None)
    m["tkey"] = m["teamId"].astype(str) + "_" + m["season_lbl"]
    m = m.sort_values(["tkey", "date"])

    RAW = ["off_eff", "def_eff", "rim_rate", "rim_pct", "three_rate", "three_pct",
           "ast_rate", "ftr", "rim_rate_alwd", "rim_pct_alwd", "three_rate_alwd",
           "three_pct_alwd", "ftr_alwd", "poss"]
    grp = m.groupby("tkey")
    for c in RAW:
        m[f"p_{c}"] = grp[c].transform(lambda s: s.shift(1).expanding(min_periods=4).mean())

    # light opponent adjustment: game efficiency relative to opponent's prior allowed
    lg = m.groupby("season_lbl")["off_eff"].transform("mean")
    okey = m["opp_id"].astype(str) + "_" + m["season_lbl"]
    opp_prior_def = m.set_index(["gameId", "tkey"])["p_def_eff"]
    m["opp_prior_def"] = opp_prior_def.reindex(
        pd.MultiIndex.from_arrays([m["gameId"], okey])).values
    m["adj_game_off"] = m["off_eff"] - m["opp_prior_def"] + lg
    opp_prior_off = m.set_index(["gameId", "tkey"])["p_off_eff"]
    m["opp_prior_off"] = opp_prior_off.reindex(
        pd.MultiIndex.from_arrays([m["gameId"], okey])).values
    m["adj_game_def"] = m["def_eff"] - m["opp_prior_off"] + lg
    for c in ("adj_game_off", "adj_game_def"):
        m[f"p_{c}"] = grp[c].transform(lambda s: s.shift(1).expanding(min_periods=4).mean())

    keep = ["gameId", "teamId", "isHomeTeam", "season_lbl", "date"] \
        + [f"p_{c}" for c in RAW] + ["p_adj_game_off", "p_adj_game_def"]
    m[keep].to_parquet(f"{OUT}/possession_team_games.parquet", index=False)
    print(f"possession_team_games: {len(m):,} rows, prior-feature coverage "
          f"{m['p_adj_game_off'].notna().mean()*100:.0f}%", flush=True)


if __name__ == "__main__":
    main()
