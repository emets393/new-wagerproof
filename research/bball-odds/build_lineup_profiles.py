#!/usr/bin/env python3
"""Lineup-derived TEAM profile dimensions (prior-only, leak-safe).

From the 5-man stint data, per team-game (using strictly PRIOR games in the
same season), compute what box aggregates cannot:

  star_dep     top rotation player's on/off impact — how much the team's
               ceiling rides on one guy (drives how hard an absence hurts)
  top2_share   share of positive rotation impact concentrated in top 2
  bench_dropoff  net rating in starter-heavy lineups minus bench-heavy lineups
                 (real fall-off when starters sit — not box eFG)
  rotation_depth  # players with >=10% of prior team minutes (true rotation size)

Output: data/parquet/lineup_profiles.parquet (game_id, team_id + features).
"""
import os

import numpy as np
import pandas as pd

ROOT = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(ROOT, "data", "parquet")


def main():
    lu = pd.read_parquet(f"{OUT}/lineups_ncaab.parquet")
    meta = pd.read_parquet(f"{OUT}/cbbd_team_box.parquet",
                           columns=["gameId", "teamId", "season", "startDate"]
                           ).drop_duplicates(["gameId", "teamId"])
    lu = lu.merge(meta.rename(columns={"gameId": "game_id", "teamId": "team_id"}),
                  on=["game_id", "team_id"], how="left")
    lu = lu[lu["net_rtg"].notna() & (lu["secs"] >= 20)].copy()
    lu["date"] = pd.to_datetime(lu["startDate"]).dt.tz_localize(None)

    # team game index (prior-only ordering)
    tg = lu[["team_id", "season", "game_id", "date"]].drop_duplicates(
        ["team_id", "game_id"]).sort_values(["team_id", "season", "date"])
    tg["gidx"] = tg.groupby(["team_id", "season"]).cumcount()
    lu = lu.merge(tg[["team_id", "game_id", "gidx"]], on=["team_id", "game_id"])
    lu["wnet"] = lu["secs"] * lu["net_rtg"]

    # team totals per game (each stint once), then cumulative PRIOR
    tgt = lu.groupby(["team_id", "season", "gidx"]).agg(
        t_secs=("secs", "sum"), t_wnet=("wnet", "sum")).reset_index()
    tgt = tgt.sort_values(["team_id", "season", "gidx"])
    g = tgt.groupby(["team_id", "season"])
    tgt["cum_t_secs"] = g["t_secs"].cumsum() - tgt["t_secs"]
    tgt["cum_t_wnet"] = g["t_wnet"].cumsum() - tgt["t_wnet"]

    # explode to player-stint, per-player per-game on totals, cumulative PRIOR
    rows = []
    for pc in ("p1", "p2", "p3", "p4", "p5"):
        rows.append(lu[["team_id", "season", "gidx", "secs", "wnet", pc]].rename(
            columns={pc: "player"}))
    ps = pd.concat(rows, ignore_index=True)
    pg = ps.groupby(["team_id", "season", "player", "gidx"]).agg(
        on_secs=("secs", "sum"), on_wnet=("wnet", "sum")).reset_index()
    pg = pg.sort_values(["team_id", "season", "player", "gidx"])
    gp = pg.groupby(["team_id", "season", "player"])
    pg["cum_on_secs"] = gp["on_secs"].cumsum() - pg["on_secs"]
    pg["cum_on_wnet"] = gp["on_wnet"].cumsum() - pg["on_wnet"]

    pg = pg.merge(tgt[["team_id", "season", "gidx", "cum_t_secs", "cum_t_wnet"]],
                  on=["team_id", "season", "gidx"])
    off_secs = pg["cum_t_secs"] - pg["cum_on_secs"]
    pg["on_net"] = pg["cum_on_wnet"] / pg["cum_on_secs"].replace(0, np.nan)
    pg["off_net"] = (pg["cum_t_wnet"] - pg["cum_on_wnet"]) / off_secs.replace(0, np.nan)
    pg["impact"] = pg["on_net"] - pg["off_net"]
    pg["min_share"] = pg["cum_on_secs"] / pg["cum_t_secs"].replace(0, np.nan)
    # rotation player = >=8% of prior team-minutes and >=200s prior
    rot = pg[(pg["min_share"] >= 0.08) & (pg["cum_on_secs"] >= 200)].copy()

    def team_game(gr):
        imp = gr["impact"].dropna()
        pos = imp[imp > 0].sort_values(ascending=False)
        star = imp.max() if len(imp) else np.nan
        top2 = pos.head(2).sum() / pos.sum() if pos.sum() > 0 else np.nan
        depth = len(gr)
        return pd.Series({"star_dep": star, "top2_share": top2, "rotation_depth": depth})

    prof = rot.groupby(["team_id", "season", "gidx"]).apply(team_game).reset_index()

    # bench drop-off: starters = top-5 by prior minutes; classify prior stints
    starters = pg[pg["cum_on_secs"] > 0].sort_values(
        ["team_id", "season", "gidx", "cum_on_secs"], ascending=[True, True, True, False])
    starters["rk"] = starters.groupby(["team_id", "season", "gidx"]).cumcount()
    star_set = starters[starters["rk"] < 5][["team_id", "season", "gidx", "player"]]
    star_set["is_starter"] = 1
    ps2 = ps.merge(star_set, on=["team_id", "season", "gidx", "player"], how="left")
    ps2["is_starter"] = ps2["is_starter"].fillna(0)
    # per stint: count starters (need stint-level; approximate via player rows sharing secs/wnet)
    stint = ps2.groupby(["team_id", "season", "gidx", "secs", "wnet"]).agg(
        nstart=("is_starter", "sum")).reset_index()
    stint = stint[stint["secs"] > 0]
    heavy = stint[stint["nstart"] >= 4].groupby(["team_id", "season", "gidx"]).agg(
        h_wnet=("wnet", "sum"), h_secs=("secs", "sum")).reset_index()
    lite = stint[stint["nstart"] <= 2].groupby(["team_id", "season", "gidx"]).agg(
        l_wnet=("wnet", "sum"), l_secs=("secs", "sum")).reset_index()
    bd = heavy.merge(lite, on=["team_id", "season", "gidx"], how="outer")
    bd = bd.sort_values(["team_id", "season", "gidx"])
    for c in ("h_wnet", "h_secs", "l_wnet", "l_secs"):
        bd[c] = bd.groupby(["team_id", "season"])[c].cumsum() - bd[c].fillna(0)
    bd["bench_dropoff"] = (bd["h_wnet"] / bd["h_secs"].replace(0, np.nan)) \
        - (bd["l_wnet"] / bd["l_secs"].replace(0, np.nan))
    prof = prof.merge(bd[["team_id", "season", "gidx", "bench_dropoff"]],
                      on=["team_id", "season", "gidx"], how="left")

    prof = prof.merge(tg[["team_id", "season", "gidx", "game_id"]],
                      on=["team_id", "season", "gidx"])
    prof = prof.rename(columns={"game_id": "cbbd_id"})
    prof.to_parquet(f"{OUT}/lineup_profiles.parquet", index=False)
    valid = prof["star_dep"].notna()
    print(f"lineup_profiles: {len(prof):,} team-games ({valid.mean()*100:.0f}% with values)", flush=True)
    print(prof[valid][["star_dep", "top2_share", "rotation_depth", "bench_dropoff"]]
          .describe().loc[["mean", "50%", "std"]].round(2).to_string(), flush=True)


if __name__ == "__main__":
    main()
