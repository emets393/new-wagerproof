#!/usr/bin/env python3
"""
1H turnover conversion -> 2H performance (Discord user theory, 2026-09-11).

Claims, registered verbatim before results:
  U1 underdog gets a 1H takeaway AND converts it into points -> back DOG 2H
  U2 underdog gets a takeaway but blows every one (no points) -> back FAV 2H
  U3 favorite gets a takeaway but blows every one -> back DOG 2H
  U4 dose: takeaways in the FINAL 5:00 of the 1H matter more (late-conv dog)

"Converted" = defensive TD on the turnover play itself, or the ensuing
possession (fixed_drive + 1) ends in Touchdown / Field goal.
Grading: 2H spread vs close consensus, real home price where held. The
halftime line already knows the SCORE — these cells test whether HOW the
points happened carries extra information. If a cell pops, the shift-matched
control decides whether it survives the state the line already prices.
"""
import os
import numpy as np
import pandas as pd

import exp_2h_nfl_deep as D

HERE = os.path.dirname(os.path.abspath(__file__))
PBP = os.path.join(D.X.NFLX, "data", "pbp_cache")


def turnover_flags():
    rows = []
    for y in (2023, 2024, 2025):
        p = pd.read_parquet(os.path.join(PBP, f"pbp_{y}.parquet"),
                            columns=["game_id", "qtr", "half_seconds_remaining", "posteam",
                                     "defteam", "interception", "fumble_lost", "touchdown",
                                     "td_team", "fixed_drive", "fixed_drive_result"])
        p = p.sort_values(["game_id", "fixed_drive"])
        drive_res = p.groupby(["game_id", "fixed_drive"]).fixed_drive_result.first()
        tos = p[(p.qtr <= 2) & ((p.interception == 1) | (p.fumble_lost == 1)) & p.defteam.notna()]
        for _, t in tos.iterrows():
            conv = False
            if t.touchdown == 1 and t.td_team == t.defteam:
                conv = True                                   # pick-six / scoop-and-score
            else:
                nxt = drive_res.get((t.game_id, t.fixed_drive + 1))
                conv = nxt in ("Touchdown", "Field goal")
            rows.append(dict(game_id=t.game_id, team=t.defteam, conv=conv,
                             late=t.half_seconds_remaining <= 300))
    return pd.DataFrame(rows)


def main():
    d = D.load()
    sp_diff = d.h2m + d.close_h2_spread
    wh = pd.Series(np.where(sp_diff == 0, np.nan, (sp_diff > 0).astype(float)), index=d.index)
    d = d[d.fg_sp != 0].copy()
    fav_home = d.fg_sp < 0
    # abbrs for pbp matching come from the game_id itself: 2023_01_AWAY_HOME
    parts = d.game_id.str.split("_")
    d["away_pb"] = parts.str[2]
    d["home_pb"] = parts.str[3]
    d["fav_pb"] = np.where(fav_home, d.home_pb, d.away_pb)
    d["dog_pb"] = np.where(fav_home, d.away_pb, d.home_pb)
    d["fav_cov"] = np.where(fav_home, wh.loc[d.index], 1 - wh.loc[d.index])
    d["fav_lay"] = d.fg_sp.abs()
    fav_h2line = np.where(fav_home, -d.close_h2_spread, d.close_h2_spread)
    d["shift_v"] = np.where(fav_home, d.h1m, -d.h1m) + fav_h2line - d.fav_lay

    to = turnover_flags()
    agg = to.groupby(["game_id", "team"]).agg(n_to=("conv", "size"), n_conv=("conv", "sum"),
                                              late_conv=("late", lambda s: bool((s & to.loc[s.index, "conv"]).any())),
                                              late_any=("late", "any")).reset_index()
    def side(df, team_col, pre):
        m = df.merge(agg, left_on=["game_id", team_col], right_on=["game_id", "team"], how="left")
        return pd.DataFrame({f"{pre}_to": m.n_to.fillna(0).values,
                             f"{pre}_conv": m.n_conv.fillna(0).values,
                             f"{pre}_late_conv": m.late_conv.fillna(False).values}, index=df.index)
    d = pd.concat([d, side(d, "dog_pb", "dog"), side(d, "fav_pb", "fav")], axis=1)
    print(f"games: {len(d)} | dog had 1H takeaway: {(d.dog_to>0).sum()} | fav: {(d.fav_to>0).sum()}")

    def cell(name, m, side_is_dog, blind_note=True):
        w = (1 - d.fav_cov) if side_is_dog else d.fav_cov
        w = pd.Series(w, index=d.index)
        mm = m & w.notna()
        n = int(mm.sum())
        if n < 30:
            print(f"{name:56s} n={n} (small)")
            return
        ww = w[mm].astype(float)
        blind = np.nanmean(((1 - d.fav_cov) if side_is_dog else d.fav_cov).astype(float))
        per = " | ".join(f"{yr}:{100*ww[d.season[mm]==yr].mean():.0f}%(n={(d.season[mm]==yr).sum()})"
                         for yr in sorted(d.season[mm].unique()))
        z = (ww.mean() - blind) * 2 * np.sqrt(n)
        print(f"{name:56s} n={n:4d}  win {100*ww.mean():.1f}%  blind {100*blind:.1f}%  z={z:+.2f}   {per}")

    print("\n== the user's claims ==")
    cell("U1 dog converted a takeaway: back DOG 2H", (d.dog_to > 0) & (d.dog_conv > 0), True)
    cell("U2 dog blew ALL its takeaways: back FAV 2H", (d.dog_to > 0) & (d.dog_conv == 0), False)
    cell("U3 fav blew ALL its takeaways: back DOG 2H", (d.fav_to > 0) & (d.fav_conv == 0), True)
    cell("U4 dog converted a LATE-1H takeaway: back DOG", d.dog_late_conv, True)
    print("\n== symmetric / control cells ==")
    cell("fav converted a takeaway: back FAV 2H", (d.fav_to > 0) & (d.fav_conv > 0), False)
    cell("dog had NO takeaway (baseline): back DOG", d.dog_to == 0, True)
    cell("dog converted 2+ takeaways: back DOG", d.dog_conv >= 2, True)

    # shift-matched control for any cell that matters: does U1 survive the state?
    print("\n== U1 within live-view state (does it add beyond the line?) ==")
    u1 = (d.dog_to > 0) & (d.dog_conv > 0)
    for lbl, m2 in (("dog still behind pace (shift<=-2 for fav... i.e. dog gaining)", d.shift_v <= -2),
                    ("game on script (|shift|<2)", d.shift_v.abs() < 2),
                    ("fav pulling away (shift>=+2)", d.shift_v >= 2)):
        cell(f"U1 x {lbl}", u1 & m2, True)


if __name__ == "__main__":
    main()
