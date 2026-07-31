#!/usr/bin/env python3
"""NBA absence detail per team-game — the tiered version of player_flags_nba.

build_player_flags.py only counts absences. For 1H work we need to know HOW MUCH
was removed, because a derivative market can under-adjust proportionally: the
right dial for a TOTAL is points-removed, and for a SPREAD it is the missing
player's minutes/production, not a 0/1 flag.

Per team-game (prior-only role stats, never this game's box):
  fresh_n / stale_n      newly-absent vs multi-game-absent regulars
  fresh_max_ppg          best scorer among the newly absent (star tier)
  fresh_sum_ppg          TOTAL prior PPG removed from the lineup
  fresh_max_min          minutes of the biggest newly-absent piece
  fresh_sum_min          total prior minutes removed
  ret_n / ret_max_ppg    regulars RETURNING today (missed the previous game) —
                         a returning star is usually minutes-limited late, which
                         should hit the full game more than the first half
  top1_out/big_out/guard_out, n_regulars

Regular = >=5 prior appearances, prior mpg >= 24, appeared in >=60% of games so
far. Same grid/leak discipline as build_player_flags.py.
"""
import os

import numpy as np
import pandas as pd

ROOT = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(ROOT, "data", "parquet")
MIN_MPG = 24


def build():
    pb = pd.read_parquet(f"{OUT}/bdl_player_box.parquet").drop_duplicates(
        ["game.id", "player.id"])
    pg = pd.DataFrame({
        "game_key": pb["game.id"], "season": pb["game.season"],
        "date": pd.to_datetime(pb["game.date"]),
        "team_key": pb["team.id"].astype(str) + "_" + pb["game.season"].astype(str),
        "team_id": pb["team.id"], "player": pb["player.id"],
        "mins": pd.to_numeric(pb["min"], errors="coerce"),
        "reb": pb["reb"], "ast": pb["ast"], "tov": pb["turnover"], "pts": pb["pts"],
    })
    pg = pg[pg["mins"].fillna(0) > 0].copy()

    tg = (pg[["team_key", "team_id", "season", "game_key", "date"]]
          .drop_duplicates(["team_key", "game_key"]).sort_values(["team_key", "date"]))
    tg["gidx"] = tg.groupby("team_key").cumcount()
    n_games = tg.groupby("team_key")["gidx"].max().rename("max_gidx")

    pg = pg.merge(tg[["team_key", "game_key", "gidx"]], on=["team_key", "game_key"])
    pg = pg.sort_values(["team_key", "player", "gidx"])
    g = pg.groupby(["team_key", "player"])
    pg["apps"] = g.cumcount() + 1
    for c in ("mins", "reb", "ast", "tov", "pts"):
        pg[f"run_{c}"] = g[c].transform(lambda s: s.expanding().mean())

    span = g.agg(first_g=("gidx", "min"), last_g=("gidx", "max")).reset_index()
    span = span.merge(n_games, on="team_key")
    span["end_g"] = np.minimum(span["last_g"] + 2, span["max_gidx"])
    span["gidx"] = span.apply(lambda r: range(int(r["first_g"]), int(r["end_g"]) + 1), axis=1)
    grid = span[["team_key", "player", "gidx"]].explode("gidx")
    grid["gidx"] = grid["gidx"].astype(int)
    grid = grid.merge(pg[["team_key", "player", "gidx", "apps", "run_mins", "run_reb",
                          "run_ast", "run_tov", "run_pts"]],
                      on=["team_key", "player", "gidx"], how="left")
    grid["present"] = grid["apps"].notna()
    # sort FIRST, then ffill in place, then take shifts off the ffilled frame.
    # Doing the shift off a pre-ffill frame silently NaNs the prior role of any
    # player returning from an absence, which drops them from `regular` and made
    # the returning-player count come out at exactly zero.
    grid = grid.sort_values(["team_key", "player", "gidx"]).reset_index(drop=True)
    gg = grid.groupby(["team_key", "player"])
    for c in ("apps", "run_mins", "run_reb", "run_ast", "run_tov", "run_pts"):
        grid[c] = gg[c].ffill()
    gg = grid.groupby(["team_key", "player"])
    grid["prior_apps"] = np.where(grid["present"], grid["apps"] - 1, grid["apps"].fillna(0))
    for c in ("mins", "reb", "ast", "tov", "pts"):
        grid[f"prior_{c}"] = gg[f"run_{c}"].shift(1).where(grid["present"], grid[f"run_{c}"])
    grid["played_prev"] = gg["present"].shift(1).fillna(False)

    grid["regular"] = ((grid["prior_apps"] >= 5) & (grid["prior_mins"] >= MIN_MPG)
                       & (grid["prior_apps"] >= 0.6 * grid["gidx"]))
    reg = grid[grid["regular"]].copy()
    grp = reg.groupby(["team_key", "gidx"])
    reg["r_mins"] = grp["prior_mins"].rank(ascending=False, method="first")
    reg["r_reb"] = grp["prior_reb"].rank(ascending=False, method="first")
    reg["r_ast"] = grp["prior_ast"].rank(ascending=False, method="first")

    absent = ~reg["present"]
    fresh = absent & reg["played_prev"]
    reg["fresh"] = fresh
    reg["stale"] = absent & ~reg["played_prev"]
    # returning: present today, absent the previous game
    reg["ret"] = reg["present"] & ~reg["played_prev"] & (reg["prior_apps"] >= 5)

    def agg(sub, prefix):
        a = sub.groupby(["team_key", "gidx"]).agg(
            **{f"{prefix}_n": ("player", "size"),
               f"{prefix}_max_ppg": ("prior_pts", "max"),
               f"{prefix}_sum_ppg": ("prior_pts", "sum"),
               f"{prefix}_max_min": ("prior_mins", "max"),
               f"{prefix}_sum_min": ("prior_mins", "sum")})
        return a.reset_index()

    base = reg.groupby(["team_key", "gidx"]).agg(
        n_regulars=("player", "size"),
        top1_out=("r_mins", lambda s: 0),  # placeholder, filled below
    ).reset_index()[["team_key", "gidx", "n_regulars"]]
    role = reg[fresh].groupby(["team_key", "gidx"]).agg(
        top1_out=("r_mins", lambda s: int((s == 1).any())),
        big_out=("r_reb", lambda s: int((s == 1).any())),
        guard_out=("r_ast", lambda s: int((s == 1).any()))).reset_index()

    out = tg.merge(base, on=["team_key", "gidx"], how="left")
    for sub, pfx in ((reg[reg["fresh"]], "fresh"), (reg[reg["stale"]], "stale"),
                     (reg[reg["ret"]], "ret")):
        out = out.merge(agg(sub, pfx), on=["team_key", "gidx"], how="left")
    out = out.merge(role, on=["team_key", "gidx"], how="left")
    for c in out.columns:
        if c.endswith(("_n", "_ppg", "_min", "_out", "regulars")):
            out[c] = out[c].fillna(0)
    out.to_parquet(f"{OUT}/nba_absence.parquet", index=False)
    print(f"nba_absence: {len(out):,} team-games | fresh {out.fresh_n.gt(0).mean()*100:.1f}% | "
          f"fresh 20+ppg {out.fresh_max_ppg.ge(20).mean()*100:.1f}% | "
          f"returning {out.ret_n.gt(0).mean()*100:.1f}% | "
          f"mean regulars {out.n_regulars.mean():.1f}")


if __name__ == "__main__":
    build()
