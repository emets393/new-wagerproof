#!/usr/bin/env python3
"""
Final 1H possessions -> 2H performance (owner extension of the turnover study,
2026-09-11). NFL ONLY (nflverse pbp 2023-25).

How did each team's LAST possession of the first half end, and does it predict
the second half beyond the halftime line? Registered cells:
  A dog's final 1H possession: TD -> back dog | FG -> back dog |
    turnover -> back fav | punt = reference
  B fav's final 1H possession: TD -> back fav | turnover -> back dog
  C DOUBLE-DIP: team scores on its final 1H possession AND receives the 2H
    kickoff -> back that team (the classic bettor construct; split fav/dog)
  D dose: dog two-minute-drill TD (drive started inside 2:00) -> back dog
Kneel-out/end-of-half drives carry no info and are excluded from score/fail
classification. Grading: 2H spread vs close consensus, blind = side base rate.
"""
import os
import numpy as np
import pandas as pd

import exp_2h_nfl_deep as D

PBP = os.path.join(D.X.NFLX, "data", "pbp_cache")


def final_drives():
    rows = []
    for y in (2023, 2024, 2025):
        p = pd.read_parquet(os.path.join(PBP, f"pbp_{y}.parquet"),
                            columns=["game_id", "qtr", "posteam", "fixed_drive",
                                     "fixed_drive_result", "half_seconds_remaining",
                                     "drive_game_clock_start", "qb_kneel"])
        h1 = p[(p.qtr <= 2) & p.posteam.notna()]
        # each team's last 1H drive
        last = h1.groupby(["game_id", "posteam"]).fixed_drive.max().reset_index()
        dmeta = h1.groupby(["game_id", "fixed_drive"]).agg(
            res=("fixed_drive_result", "first"),
            start_sec=("half_seconds_remaining", "max"),
            kneels=("qb_kneel", "sum"), nplays=("qb_kneel", "size")).reset_index()
        last = last.merge(dmeta, on=["game_id", "fixed_drive"])
        # 2H kickoff receiver = posteam of first 3rd-quarter drive
        q3 = p[(p.qtr == 3) & p.posteam.notna()]
        rec = q3.sort_values("fixed_drive").groupby("game_id").posteam.first().rename("recv2h")
        last = last.merge(rec, on="game_id", how="left")
        last["season"] = y
        rows.append(last)
    f = pd.concat(rows, ignore_index=True)
    kneel_out = (f.kneels > 0) & (f.kneels >= f.nplays - 1)
    f["cat"] = np.select(
        [f.res == "Touchdown", f.res == "Field goal",
         f.res.isin(["Turnover", "Interception", "Fumble", "Turnover on downs"]),
         f.res == "Missed field goal", f.res == "Punt",
         kneel_out | f.res.isin(["End of half", "End of game"])],
        ["TD", "FG", "TO", "MISS_FG", "PUNT", "KNEEL"], default="OTHER")
    f["two_min"] = f.start_sec <= 120
    return f


def main():
    d = D.load()
    sp_diff = d.h2m + d.close_h2_spread
    wh = pd.Series(np.where(sp_diff == 0, np.nan, (sp_diff > 0).astype(float)), index=d.index)
    d = d[d.fg_sp != 0].copy()
    fav_home = d.fg_sp < 0
    parts = d.game_id.str.split("_")
    d["home_pb"], d["away_pb"] = parts.str[3], parts.str[2]
    d["fav_pb"] = np.where(fav_home, d.home_pb, d.away_pb)
    d["dog_pb"] = np.where(fav_home, d.away_pb, d.home_pb)
    d["fav_cov"] = np.where(fav_home, wh.loc[d.index], 1 - wh.loc[d.index])

    f = final_drives()
    fkey = f.set_index(["game_id", "posteam"])
    def col(team_col, field):
        idx = pd.MultiIndex.from_arrays([d.game_id, d[team_col]])
        return fkey[field].reindex(idx).values
    for side_, tc in (("dog", "dog_pb"), ("fav", "fav_pb")):
        d[f"{side_}_last"] = col(tc, "cat")
        d[f"{side_}_2min"] = col(tc, "two_min")
        d[f"{side_}_recv"] = col(tc, "recv2h") == d[tc]

    def cell(name, m, side_is_dog):
        w = pd.Series((1 - d.fav_cov) if side_is_dog else d.fav_cov, index=d.index)
        mm = pd.Series(m, index=d.index) & w.notna()
        n = int(mm.sum())
        if n < 30:
            print(f"{name:56s} n={n} (small)")
            return
        ww = w[mm].astype(float)
        blind = np.nanmean(pd.Series((1 - d.fav_cov) if side_is_dog else d.fav_cov).astype(float))
        per = " | ".join(f"{yr}:{100*ww[d.season[mm]==yr].mean():.0f}%(n={(d.season[mm]==yr).sum()})"
                         for yr in sorted(d.season[mm].unique()))
        z = (ww.mean() - blind) * 2 * np.sqrt(n)
        print(f"{name:56s} n={n:4d}  win {100*ww.mean():.1f}%  blind {100*blind:.1f}%  z={z:+.2f}   {per}")

    print("distribution of final-1H-possession outcomes (dog):",
          d.dog_last.value_counts().to_dict())
    print("\n== A: dog's final 1H possession ==")
    cell("dog ends 1H with TD: back DOG", d.dog_last == "TD", True)
    cell("dog ends 1H with FG: back DOG", d.dog_last == "FG", True)
    cell("dog ends 1H with TURNOVER: back FAV", d.dog_last == "TO", False)
    cell("dog ends 1H with PUNT (reference): back DOG", d.dog_last == "PUNT", True)
    cell("dog ends 1H with missed FG: back FAV", d.dog_last == "MISS_FG", False)
    print("\n== B: fav's final 1H possession ==")
    cell("fav ends 1H with TD: back FAV", d.fav_last == "TD", False)
    cell("fav ends 1H with TURNOVER: back DOG", d.fav_last == "TO", True)
    print("\n== C: DOUBLE-DIP — scored final 1H drive AND receives 2H kick ==")
    cell("DOG double-dip: back DOG", (d.dog_last.isin(["TD", "FG"])) & d.dog_recv, True)
    cell("FAV double-dip: back FAV", (d.fav_last.isin(["TD", "FG"])) & d.fav_recv, False)
    cell("DOG scored last but fav receives: back DOG", (d.dog_last.isin(["TD", "FG"])) & ~d.dog_recv, True)
    cell("FAV scored last but dog receives: back FAV", (d.fav_last.isin(["TD", "FG"])) & ~d.fav_recv, False)
    print("\n== D: dose — two-minute-drill scores ==")
    cell("dog 2-min-drill TD to end 1H: back DOG", (d.dog_last == "TD") & (d.dog_2min == True), True)
    cell("fav 2-min-drill TD to end 1H: back FAV", (d.fav_last == "TD") & (d.fav_2min == True), False)


if __name__ == "__main__":
    main()
