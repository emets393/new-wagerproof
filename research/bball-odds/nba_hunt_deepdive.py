#!/usr/bin/env python3
"""Interrogate the candidates that came out of the pre-registered stage.

A cell clearing z=2.2 in a 150-rule set is a HYPOTHESIS, not a result. What made S9
trustworthy was never its z -- it was that the away-team version was null, the clinched
version was null, the bad-but-alive version was null, no single team carried it, and the
dose curve behaved. This file runs that same interrogation on every new candidate:

  dose ladder      -- does the effect grow with the strength of the trigger, or is it a
                      cliff at one arbitrary cut (the fingerprint of an overfit threshold)
  mechanism control -- the near-miss version that SHOULD be dead if the stated story is
                      the real one
  matched placebo  -- a random cut of the same size, 2000 times, which prices "a cell this
                      good exists somewhere" without assuming normality
  open vs T-60     -- a rule that only works at the opener is a news-latency artifact
  concentration    -- drop the single best team / season and see what is left

    python3 nba_hunt_deepdive.py
"""
import os
import warnings

import numpy as np
import pandas as pd

from nba_hunt_sweep import build_markets

warnings.filterwarnings("ignore")
ROOT = os.path.dirname(os.path.abspath(__file__))
PQ = os.path.join(ROOT, "data", "parquet")
RNG = np.random.default_rng(11)


def grade(d, mask, universe, market, markets, label="", min_n=40):
    y, price = markets[market]
    ok = np.isfinite(y) & np.isfinite(price)
    cell, base = mask & universe & ok, universe & ok
    n = int(cell.sum())
    if n < min_n:
        return None
    prof = np.where(y > 0, price - 1.0, -1.0)
    roi, win = prof[cell].mean(), y[cell].mean()
    broi, bwin = prof[base].mean(), y[base].mean()
    sd = prof[base].std()
    return {"label": label, "n": n, "win": 100 * win, "base": 100 * bwin,
            "edge": 100 * (win - bwin), "roi": 100 * roi, "base_roi": 100 * broi,
            "z": (roi - broi) / (sd / np.sqrt(n))}


def show(rows, title):
    rows = [r for r in rows if r]
    if not rows:
        print(f"\n-- {title}: nothing met the size floor")
        return
    print(f"\n-- {title}")
    print(pd.DataFrame(rows).to_string(index=False, float_format=lambda x: f"{x:7.2f}"))


def placebo(d, universe, market, markets, n_cell, observed_roi, trials=2000):
    """Random cuts of the same size inside the same universe.

    Answers the only question that matters about a cut chosen from a menu: how often does
    a slice this profitable turn up by luck at this sample size?
    """
    y, price = markets[market]
    ok = np.isfinite(y) & np.isfinite(price) & universe
    idx = np.flatnonzero(ok)
    prof = np.where(y > 0, price - 1.0, -1.0)[idx]
    if len(idx) < n_cell * 2:
        return np.nan
    hits = 0
    for _ in range(trials):
        pick = RNG.choice(len(idx), n_cell, replace=False)
        hits += (prof[pick].mean() * 100 >= observed_roi)
    return hits / trials


def per_season(d, mask, universe, market, markets):
    out = []
    for s in sorted(set(d["season"])):
        sm = (d["season"] == s).to_numpy()
        r = grade(d, mask & sm, universe & sm, market, markets, s, min_n=20)
        if r:
            out.append(r)
    return out


def per_team(d, mask, universe, market, markets, teamcol):
    """Drop-one-team robustness. One franchise carrying a rule is not a rule."""
    teams = d.loc[mask & universe, teamcol].value_counts()
    full = grade(d, mask, universe, market, markets, "all")
    out = [full]
    for t in teams.head(3).index:
        out.append(grade(d, mask & (d[teamcol] != t).to_numpy(), universe, market,
                         markets, f"drop {t}"))
    print(f"   ({len(teams)} distinct teams, top share "
          f"{100*teams.iloc[0]/teams.sum():.1f}%)")
    return out


def main():
    d = pd.read_parquet(os.path.join(PQ, "nba_hunt_frame.parquet")).sort_values("game_date").reset_index(drop=True)
    M = build_markets(d)
    reg = (d["postseason"] == 0).to_numpy()
    gp50 = reg & (d["min_gp"] >= 50).to_numpy()
    gp25 = reg & (d["min_gp"] >= 25).to_numpy()

    # A second market book graded at the OPENING line, so every rule can be checked for
    # the "only works before the market moves" failure mode.
    dopen = d.copy()
    for a, b in [("t60_spread_home_point", "open_spread_home_point"),
                 ("t60_spread_home_price", "open_spread_home_price"),
                 ("t60_spread_away_price", "open_spread_away_price"),
                 ("t60_total_point", "open_total_point"),
                 ("t60_total_over_price", "open_total_over_price"),
                 ("t60_total_under_price", "open_total_under_price"),
                 ("t60_ml_home_price", "open_ml_home_price"),
                 ("t60_ml_away_price", "open_ml_away_price")]:
        dopen[a] = d[b]
    dopen["ats_margin"] = dopen["margin"] + dopen["open_spread_home_point"]
    dopen["home_cover"] = np.where(dopen["ats_margin"] > 0, 1,
                                   np.where(dopen["ats_margin"] < 0, 0, np.nan))
    dopen["over"] = np.where(dopen["gm_total"] > dopen["open_total_point"], 1,
                             np.where(dopen["gm_total"] < dopen["open_total_point"], 0, np.nan))
    MO = build_markets(dopen)

    rest_edge = (d["h_rest_days"] - d["a_rest_days"]).to_numpy()

    # =====================================================================
    print("\n" + "=" * 78)
    print("C1  HOME REST ADVANTAGE -> HOME SPREAD")
    print("    trigger: home team has at least 2 more days off than the visitor")
    print("=" * 78)
    m = rest_edge >= 2
    show([grade(d, rest_edge >= k, reg, "fg_spread_home", M, f"rest edge >= {k}d")
          for k in (1, 2, 3, 4, 5)] +
         [grade(d, rest_edge <= -k, reg, "fg_spread_away", M, f"AWAY edge >= {k}d")
          for k in (1, 2, 3, 4, 5)], "dose ladder (both directions)")
    show(per_season(d, m, reg, "fg_spread_home", M), "per season")
    show([
        grade(d, m & (d["a_b2b"] == 1).to_numpy(), reg, "fg_spread_home", M,
              "visitor on a b2b"),
        grade(d, m & (d["a_b2b"] == 0).to_numpy(), reg, "fg_spread_home", M,
              "visitor NOT on a b2b"),
        grade(d, (d["a_b2b"] == 1).to_numpy(), reg, "fg_spread_home", M,
              "CONTROL: visitor b2b, ignore rest edge"),
        grade(d, m & (d["t60_spread_home_point"] < 0).to_numpy(), reg, "fg_spread_home", M,
              "home is favourite"),
        grade(d, m & (d["t60_spread_home_point"] > 0).to_numpy(), reg, "fg_spread_home", M,
              "home is dog"),
    ], "mechanism: is it just fading tired visitors?")
    show([grade(d, m, reg, mk, M, mk) for mk in
          ("fg_spread_home", "fg_ml_home", "fg_total_under", "fg_total_over",
           "h1_spread_home", "tt_home_over")], "does it show up in other markets?")
    show([grade(d, m, reg, "fg_spread_home", M, "T-60 close"),
          grade(dopen, m, reg, "fg_spread_home", MO, "opening line")], "close vs open")
    show(per_team(d, m, reg, "fg_spread_home", M, "home_team"), "drop-one-team")
    r = grade(d, m, reg, "fg_spread_home", M)
    print(f"   matched random-cut placebo p = "
          f"{placebo(d, reg, 'fg_spread_home', M, r['n'], r['roi']):.4f}")

    # =====================================================================
    print("\n" + "=" * 78)
    print("C2  BOTH TEAMS OUT OF IT -> OVER")
    print("    trigger: late season, neither team has anything left to play for")
    print("=" * 78)
    bd = (d["st_both_done"] == 1).to_numpy()
    dead_h = ((d["st_h_eliminated"] > 0) | (d["st_h_tank"] > 0)).to_numpy()
    dead_a = ((d["st_a_eliminated"] > 0) | (d["st_a_tank"] > 0)).to_numpy()
    show([
        grade(d, bd, gp50, "fg_total_over", M, "both done"),
        grade(d, dead_h & ~dead_a, gp50, "fg_total_over", M, "only home done"),
        grade(d, dead_a & ~dead_h, gp50, "fg_total_over", M, "only away done"),
        grade(d, ~dead_h & ~dead_a, gp50, "fg_total_over", M, "CONTROL: neither done"),
    ], "dose: nobody -> one side -> both")
    show(per_season(d, bd, gp50, "fg_total_over", M), "per season")
    show([grade(d, bd, gp50, mk, M, mk) for mk in
          ("fg_total_over", "h1_total_over", "tt_home_over", "tt_away_over",
           "fg_spread_fav", "fg_spread_dog")], "other markets")
    show([grade(d, bd, gp50, "fg_total_over", M, "T-60 close"),
          grade(dopen, bd, gp50, "fg_total_over", MO, "opening line")], "close vs open")
    r = grade(d, bd, gp50, "fg_total_over", M)
    print(f"   matched random-cut placebo p = "
          f"{placebo(d, gp50, 'fg_total_over', M, r['n'], r['roi']):.4f}")

    # =====================================================================
    print("\n" + "=" * 78)
    print("C3  ELIMINATION PRESSURE ON THE UNDERDOG -> BACK THE FAVOURITE")
    print("    Lust 2018's continuous version: games back divided by games remaining, so")
    print("    a 5-game hole in December is not scored like a 5-game hole in April")
    print("=" * 78)
    gbr = d["gbr_dog"].to_numpy()
    show([grade(d, gbr >= k, gp25, "fg_spread_fav", M, f"dog gbr >= {k}")
          for k in (0.05, 0.10, 0.20, 0.35, 0.50, 0.75)], "dose ladder")
    show([grade(d, (gbr >= lo) & (gbr < hi), gp25, "fg_spread_fav", M, f"{lo}-{hi}")
          for lo, hi in ((0, .05), (.05, .15), (.15, .3), (.3, .6), (.6, 9))],
         "disjoint buckets (a real dose response should be monotone here)")
    show(per_season(d, gbr >= 0.35, gp25, "fg_spread_fav", M), "per season, gbr >= 0.35")
    show([grade(d, (gbr >= 0.35) & (d["gbr_fav"] <= 0.05).to_numpy(), gp25,
                "fg_spread_fav", M, "dog out AND fav alive"),
          grade(d, (gbr >= 0.35) & (d["gbr_fav"] >= 0.35).to_numpy(), gp25,
                "fg_spread_fav", M, "CONTROL: both out"),
          grade(d, (d["gbr_fav"] >= 0.35).to_numpy(), gp25, "fg_spread_fav", M,
                "CONTROL: fav out, dog alive")],
         "mechanism: it should need the FAVOURITE to still care")
    show([grade(d, gbr >= 0.35, gp25, "fg_spread_fav", M, "T-60 close"),
          grade(dopen, gbr >= 0.35, gp25, "fg_spread_fav", MO, "opening line")],
         "close vs open")

    # =====================================================================
    print("\n" + "=" * 78)
    print("C4  SEASON'S FIRST WEEKS -> OVER")
    print("    the published bias is the UNDER (Baryla 2007, Girdner 2013). If this frame")
    print("    says OVER, either the regime flipped or the finding is noise -- and the")
    print("    stated mechanism (books anchored on last season's pace) predicts a flip in")
    print("    any era where pace is rising, so the per-season sign is the whole test")
    print("=" * 78)
    gp = d["min_gp"].to_numpy()
    show([grade(d, gp <= k, reg, "fg_total_over", M, f"first {k} games") for k in
          (2, 3, 5, 8, 12, 20)], "dose ladder")
    show([grade(d, (gp > lo) & (gp <= hi), reg, "fg_total_over", M, f"gp {lo+1}-{hi}")
          for lo, hi in ((0, 3), (3, 6), (6, 10), (10, 20), (20, 40), (40, 99))],
         "disjoint buckets")
    show(per_season(d, gp <= 5, reg, "fg_total_over", M), "per season, first 5 games")
    show([grade(d, gp <= 5, reg, mk, M, mk) for mk in
          ("fg_total_over", "h1_total_over", "tt_home_over", "tt_away_over",
           "fg_spread_dog", "fg_spread_fav")], "other markets")
    show([grade(d, gp <= 5, reg, "fg_total_over", M, "T-60 close"),
          grade(dopen, gp <= 5, reg, "fg_total_over", MO, "opening line")], "close vs open")
    r = grade(d, gp <= 5, reg, "fg_total_over", M)
    print(f"   matched random-cut placebo p = "
          f"{placebo(d, reg, 'fg_total_over', M, r['n'], r['roi']):.4f}")

    # =====================================================================
    print("\n" + "=" * 78)
    print("C5  S9 EXTENSIONS -- can the proven rule be sharpened or widened?")
    print("=" * 78)
    show([
        grade(d, dead_h, gp50, "fg_spread_fav", M, "S9 as shipped"),
        grade(d, (d["st_h_tank"] > 0).to_numpy(), gp50, "fg_spread_fav", M, "tank only"),
        grade(d, (d["st_h_eliminated"] > 0).to_numpy(), gp50, "fg_spread_fav", M,
              "eliminated only"),
        grade(d, dead_h & (rest_edge <= 0), gp50, "fg_spread_fav", M, "+ no home rest edge"),
        grade(d, dead_h & (d["h_b2b"] == 1).to_numpy(), gp50, "fg_spread_fav", M,
              "+ dead team on a b2b"),
        grade(d, dead_h & (d["is_divisional"] == 1).to_numpy(), gp50, "fg_spread_fav", M,
              "+ divisional"),
        grade(d, dead_h & (d["st_post_deadline"] == 1).to_numpy(), gp50, "fg_spread_fav", M,
              "+ post deadline"),
        grade(d, dead_h & ~dead_a, gp50, "fg_spread_fav", M, "+ visitor still alive"),
        grade(d, dead_h & (d["t60_spread_home_point"] > 0).to_numpy(), gp50,
              "fg_spread_fav", M, "+ dead team is the dog (fav = visitor)"),
        grade(d, dead_h & (d["t60_spread_home_point"] < 0).to_numpy(), gp50,
              "fg_spread_fav", M, "+ dead team is the FAVOURITE"),
    ], "conjunctions on top of S9")
    show([grade(d, dead_a, gp50, "fg_spread_fav", M, "away dead (control)"),
          grade(d, dead_a & ~dead_h, gp50, "fg_spread_fav", M, "away dead, home alive"),
          grade(d, dead_h | dead_a, gp50, "fg_spread_fav", M, "either side dead")],
         "the away-side mirror -- must stay dead for the venue story to hold")


if __name__ == "__main__":
    main()
