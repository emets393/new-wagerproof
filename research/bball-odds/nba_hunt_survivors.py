#!/usr/bin/env python3
"""The three signals that survived the 2026-07-31 NBA signal hunt, end to end.

This is the re-runnable proof for S11/S12/S13. Everything that gets quoted in
NBA_PROVEN.md is printed here, so any number in the ledger can be regenerated with one
command instead of being trusted:

  S11  late season (both teams 50+ games played) + home team eliminated-or-tanking
       AND the home team has played in 2+ DIFFERENT VENUES in the last 7 days
       -> back the favourite on the full-game spread
  S12  final ~2 weeks of the regular season (season_frac >= 0.94) -> OVER, full-game total
  S13  late season, NEITHER team has anything left to play for   -> OVER, full-game total

For each: in-slice baseline, per-season, matched random-cut placebo, the mechanism
control that must be dead if the story is true, and the same grade at the OPENING line
(a rule that only works at the open is news latency, not an edge).

    python3 nba_hunt_survivors.py
"""
import os
import warnings

import numpy as np
import pandas as pd

from nba_hunt_sweep import build_markets
from nba_hunt_deepdive import grade, show, placebo, per_season, per_team

warnings.filterwarnings("ignore")
ROOT = os.path.dirname(os.path.abspath(__file__))
PQ = os.path.join(ROOT, "data", "parquet")


def open_book(d):
    """Second market book priced at the opener, same grading code."""
    o = d.copy()
    for a, b in [("t60_spread_home_point", "open_spread_home_point"),
                 ("t60_spread_home_price", "open_spread_home_price"),
                 ("t60_spread_away_price", "open_spread_away_price"),
                 ("t60_total_point", "open_total_point"),
                 ("t60_total_over_price", "open_total_over_price"),
                 ("t60_total_under_price", "open_total_under_price"),
                 ("t60_ml_home_price", "open_ml_home_price"),
                 ("t60_ml_away_price", "open_ml_away_price")]:
        o[a] = d[b]
    o["ats_margin"] = o["margin"] + o["open_spread_home_point"]
    o["home_cover"] = np.where(o["ats_margin"] > 0, 1,
                               np.where(o["ats_margin"] < 0, 0, np.nan))
    return build_markets(o)


def main():
    d = (pd.read_parquet(os.path.join(PQ, "nba_hunt_frame.parquet"))
           .sort_values("game_date").reset_index(drop=True))
    M, MO = build_markets(d), open_book(d)

    reg = (d["postseason"] == 0).to_numpy()
    gp50 = reg & (d["min_gp"] >= 50).to_numpy()

    dead_h = ((d["st_h_eliminated"] > 0) | (d["st_h_tank"] > 0)).to_numpy()
    dead_a = ((d["st_a_eliminated"] > 0) | (d["st_a_tank"] > 0)).to_numpy()
    # venues_7d counts DISTINCT arenas in the trailing week, so a four-game homestand and a
    # four-city road swing stop looking identical the way a plain game-count makes them.
    tired_h = (d["h_venues_7d"] >= 2).to_numpy()

    # "Settled" is broader than "dead": a team locked INTO the playoffs has as little to
    # play for as one locked out. st_both_done is eliminated-or-clinched on both sides.
    settled_h = ((d["st_h_eliminated"] + d["st_h_clinched"]) > 0).to_numpy()
    settled_a = ((d["st_a_eliminated"] + d["st_a_clinched"]) > 0).to_numpy()
    n_settled = settled_h.astype(int) + settled_a.astype(int)

    s11 = dead_h & tired_h
    s12 = reg & (d["st_h_season_frac"] >= 0.94).to_numpy()
    s13 = gp50 & (d["st_both_done"] == 1).to_numpy()

    print("=" * 78)
    print("S11  dead home team ALSO on the road grind -> back the favourite (FG spread)")
    print("=" * 78)
    show([grade(d, s11, gp50, "fg_spread_fav", M, "S11 @ T-60"),
          grade(d, s11, gp50, "fg_spread_fav", MO, "S11 @ open")], "headline")
    show(per_season(d, s11, gp50, "fg_spread_fav", M), "per season")
    # The 2x2 is the whole argument: load without the motivation story has to be dead.
    show([grade(d, dead_h & tired_h, gp50, "fg_spread_fav", M, "dead AND tired"),
          grade(d, dead_h & ~tired_h, gp50, "fg_spread_fav", M, "dead, not tired"),
          grade(d, ~dead_h & tired_h, gp50, "fg_spread_fav", M, "tired, NOT dead <-CONTROL"),
          grade(d, ~dead_h & ~tired_h, gp50, "fg_spread_fav", M, "neither")],
         "mechanism 2x2")
    show([grade(d, dead_h & (d["h_venues_7d"] >= k).to_numpy(), gp50,
                "fg_spread_fav", M, f"venues_7d >= {k}") for k in (1, 2, 3, 4)],
         "dose ladder within dead")
    show(per_team(d, s11, gp50, "fg_spread_fav", M, "home_team"), "drop-one-team")
    r = grade(d, s11, gp50, "fg_spread_fav", M)
    print(f"   matched random-cut placebo p = "
          f"{placebo(d, gp50, 'fg_spread_fav', M, r['n'], r['roi']):.4f}")

    print()
    print("=" * 78)
    print("S12  final ~2 weeks of the regular season -> OVER (FG total)")
    print("=" * 78)
    show([grade(d, s12, reg, "fg_total_over", M, "S12 @ T-60"),
          grade(d, s12, reg, "fg_total_over", MO, "S12 @ open")], "headline")
    show(per_season(d, s12, reg, "fg_total_over", M), "per season")
    # If this were tanking wearing a calendar hat the no-dead subset would collapse.
    show([grade(d, s12 & dead_h, reg, "fg_total_over", M, "final 2wk, dead home"),
          grade(d, s12 & ~dead_h, reg, "fg_total_over", M, "final 2wk, NOT dead")],
         "is it just tanking?")
    show([grade(d, reg & (d["st_h_season_frac"] >= lo).to_numpy()
                & (d["st_h_season_frac"] < hi).to_numpy(), reg, "fg_total_over", M,
                f"season_frac {lo}-{hi}")
          for lo, hi in [(0.0, .25), (.25, .5), (.5, .75), (.75, .9), (.9, .97), (.97, 1.1)]],
         "disjoint calendar ladder")
    r = grade(d, s12, reg, "fg_total_over", M)
    print(f"   matched random-cut placebo p = "
          f"{placebo(d, reg, 'fg_total_over', M, r['n'], r['roi']):.4f}")

    print()
    print("=" * 78)
    print("S13  late season, NEITHER team playing for anything -> OVER (FG total)")
    print("=" * 78)
    show([grade(d, s13, gp50, "fg_total_over", M, "S13 @ T-60"),
          grade(d, s13, gp50, "fg_total_over", MO, "S13 @ open")], "headline")
    show(per_season(d, s13, gp50, "fg_total_over", M), "per season")
    # The ladder must use ONE definition end to end. The first pass in nba_hunt_deepdive.py
    # mixed st_both_done (eliminated-or-clinched) for the top rung with eliminated-or-tank
    # for the rungs below it, which made the middle rungs a different population.
    show([grade(d, gp50 & (n_settled == k), gp50, "fg_total_over", M,
                f"{k} of 2 teams settled") for k in (0, 1, 2)],
         "dose ladder (0 / 1 / 2 teams settled)")
    # A second market saying the same thing is worth more than a tighter p-value.
    show([grade(d, s13, gp50, "tt_home_over", M, "S13 -> home team total over"),
          grade(d, s13, gp50, "tt_away_over", M, "S13 -> away team total over")],
         "corroborating market")
    r = grade(d, s13, gp50, "fg_total_over", M)
    print(f"   matched random-cut placebo p = "
          f"{placebo(d, gp50, 'fg_total_over', M, r['n'], r['roi']):.4f}")

    print()
    print("=" * 78)
    print("drop-one-season -- four seasons is few enough that one good year can BE the rule")
    print("=" * 78)
    legs = [("S11", s11, gp50, "fg_spread_fav"), ("S12", s12, reg, "fg_total_over"),
            ("S13", s13, gp50, "fg_total_over")]
    for name, mask, uni, mkt in legs:
        rows = [grade(d, mask, uni, mkt, M, "all")]
        for s in sorted(set(d["season"])):
            keep = (d["season"] != s).to_numpy()
            rows.append(grade(d, mask & keep, uni & keep, mkt, M, f"drop {s}"))
        show(rows, f"{name} drop-one-season")

    print()
    print("=" * 78)
    print("portfolio")
    print("=" * 78)
    tot_n = tot_u = 0
    for name, mask, uni, mkt in legs:
        y, price = M[mkt]
        ok = np.isfinite(y) & np.isfinite(price) & mask & uni
        prof = np.where(y > 0, price - 1.0, -1.0)[ok]
        tot_n += len(prof)
        tot_u += prof.sum()
        print(f"  {name}: {len(prof):4d} bets  {prof.sum():+7.1f}u  {100*prof.mean():+6.2f}%")
    print(f"  ALL : {tot_n:4d} bets  {tot_u:+7.1f}u  {100*tot_u/tot_n:+6.2f}%  "
          f"(~{tot_n // 4} bets per season)")
    for (na, ma, ua, _), (nb, mb, ub, _) in [(legs[0], legs[1]), (legs[0], legs[2]),
                                             (legs[1], legs[2])]:
        print(f"  overlap {na} n {nb}: {int((ma & ua & mb & ub).sum())}")


if __name__ == "__main__":
    main()
