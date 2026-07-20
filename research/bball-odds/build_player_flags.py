#!/usr/bin/env python3
"""Player-role + absence flags per team-game, both sports.

For every team-game we ask: which of the team's REGULARS (prior-games role,
never this game's box) did not play? Flags:

  top1_out        highest prior-minutes regular absent
  big_out         top prior-rebounds regular absent (the "big man")
  guard_out       top prior-assists regular absent
  lowto_guard_out best prior ast/TO ratio among top-2 assist regulars absent
  reg_out_n       count of absent regulars
  fresh           absent player PLAYED the team's previous game (new absence —
                  the case the market is most likely to misprice). Non-fresh
                  (multi-game) absences are counted separately as stale_out_n.

Regular = ≥5 prior appearances, prior minutes/game ≥ 22 (CBB) / 24 (NBA), and
appeared in ≥60% of team games so far. Grid spans first appearance → 2 games
past last appearance (season-ending injuries stay visible briefly, then drop).

Outputs data/parquet/player_flags_{sport}.parquet keyed by game/team ids.
"""
import os

import numpy as np
import pandas as pd

ROOT = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(ROOT, "data", "parquet")


def load_cbb():
    # athleteId is a per-game stat-line id; athleteSourceId is the stable player id
    pb = pd.read_parquet(f"{OUT}/cbbd_player_box.parquet").drop_duplicates(
        ["gameId", "athleteSourceId"])
    return pd.DataFrame({
        "game_key": pb["gameId"], "season": pb["season"],
        "date": pd.to_datetime(pb["startDate"]).dt.tz_localize(None),
        "team_key": pb["teamId"].astype(str) + "_" + pb["season"].astype(str),
        "team_id": pb["teamId"], "player": pb["athleteSourceId"],
        "mins": pd.to_numeric(pb["minutes"], errors="coerce"),
        "reb": pb["rebounds.total"], "ast": pb["assists"],
        "tov": pb["turnovers"], "pts": pb["points"],
    }), 22


def load_nba():
    pb = pd.read_parquet(f"{OUT}/bdl_player_box.parquet").drop_duplicates(
        ["game.id", "player.id"])
    season = pb["game.season"]
    return pd.DataFrame({
        "game_key": pb["game.id"], "season": season,
        "date": pd.to_datetime(pb["game.date"]),
        "team_key": pb["team.id"].astype(str) + "_" + season.astype(str),
        "team_id": pb["team.id"], "player": pb["player.id"],
        "mins": pd.to_numeric(pb["min"], errors="coerce"),
        "reb": pb["reb"], "ast": pb["ast"], "tov": pb["turnover"], "pts": pb["pts"],
    }), 24


def build(sport):
    pg, min_thr = load_cbb() if sport == "ncaab" else load_nba()
    pg = pg[pg["mins"].fillna(0) > 0].copy()

    # team game index
    tg = (pg[["team_key", "team_id", "season", "game_key", "date"]]
          .drop_duplicates(["team_key", "game_key"])
          .sort_values(["team_key", "date"]))
    tg["gidx"] = tg.groupby("team_key").cumcount()
    n_games = tg.groupby("team_key")["gidx"].max().rename("max_gidx")

    pg = pg.merge(tg[["team_key", "game_key", "gidx"]], on=["team_key", "game_key"])
    pg = pg.sort_values(["team_key", "player", "gidx"])
    g = pg.groupby(["team_key", "player"])
    # stats THROUGH each appearance (inclusive) — role as-of a later game uses
    # the last appearance's running values, so nothing from the later game leaks
    pg["apps"] = g.cumcount() + 1
    for c in ("mins", "reb", "ast", "tov"):
        pg[f"run_{c}"] = g[c].transform(lambda s: s.expanding().mean())

    # player span grid: first appearance -> min(last appearance + 2, season end)
    span = g.agg(first_g=("gidx", "min"), last_g=("gidx", "max")).reset_index()
    span = span.merge(n_games, on="team_key")
    span["end_g"] = np.minimum(span["last_g"] + 2, span["max_gidx"])
    span["gidx"] = span.apply(lambda r: range(int(r["first_g"]), int(r["end_g"]) + 1), axis=1)
    grid = span[["team_key", "player", "gidx"]].explode("gidx")
    grid["gidx"] = grid["gidx"].astype(int)

    grid = grid.merge(pg[["team_key", "player", "gidx", "apps",
                          "run_mins", "run_reb", "run_ast", "run_tov"]],
                      on=["team_key", "player", "gidx"], how="left")
    grid["present"] = grid["apps"].notna()
    gg = grid.sort_values(["team_key", "player", "gidx"]).groupby(["team_key", "player"])
    for c in ("apps", "run_mins", "run_reb", "run_ast", "run_tov"):
        grid[c] = gg[c].ffill()
    # prior-only view: role stats as of BEFORE this game
    grid["prior_apps"] = np.where(grid["present"], grid["apps"] - 1,
                                  grid["apps"].fillna(0))
    for c in ("mins", "reb", "ast", "tov"):
        grid[f"prior_{c}"] = gg[f"run_{c}"].shift(1).where(grid["present"],
                                                           grid[f"run_{c}"])
    grid["played_prev"] = gg["present"].shift(1).fillna(False)

    grid["regular"] = ((grid["prior_apps"] >= 5)
                       & (grid["prior_mins"] >= min_thr)
                       & (grid["prior_apps"] >= 0.6 * grid["gidx"]))
    reg = grid[grid["regular"]].copy()
    reg["ast_to"] = reg["prior_ast"] / reg["prior_tov"].clip(lower=0.5)

    grp = reg.groupby(["team_key", "gidx"])
    reg["r_mins"] = grp["prior_mins"].rank(ascending=False, method="first")
    reg["r_reb"] = grp["prior_reb"].rank(ascending=False, method="first")
    reg["r_ast"] = grp["prior_ast"].rank(ascending=False, method="first")
    is_g2 = reg["r_ast"] <= 2
    reg["r_astto"] = reg[is_g2].groupby(["team_key", "gidx"])["ast_to"].rank(
        ascending=False, method="first")

    absent = ~reg["present"]
    fresh = absent & reg["played_prev"]
    flags = pd.DataFrame({
        "team_key": reg["team_key"], "gidx": reg["gidx"],
        "reg_out_n": fresh.astype(int),
        "stale_out_n": (absent & ~reg["played_prev"]).astype(int),
        "top1_out": (fresh & (reg["r_mins"] == 1)).astype(int),
        "big_out": (fresh & (reg["r_reb"] == 1)).astype(int),
        "guard_out": (fresh & (reg["r_ast"] == 1)).astype(int),
        "lowto_guard_out": (fresh & (reg["r_astto"] == 1)).astype(int),
        "n_regulars": 1,
    }).groupby(["team_key", "gidx"]).sum().reset_index()

    out = tg.merge(flags, on=["team_key", "gidx"], how="left").fillna(0)
    out.to_parquet(f"{OUT}/player_flags_{sport}.parquet", index=False)
    tot = len(out)
    print(f"player_flags_{sport}: {tot:,} team-games | fresh reg out {out.reg_out_n.gt(0).mean()*100:.1f}%"
          f" | top1_out {out.top1_out.gt(0).mean()*100:.1f}% | big_out {out.big_out.gt(0).mean()*100:.1f}%"
          f" | guard_out {out.guard_out.gt(0).mean()*100:.1f}%", flush=True)


if __name__ == "__main__":
    build("ncaab")
    build("nba")
