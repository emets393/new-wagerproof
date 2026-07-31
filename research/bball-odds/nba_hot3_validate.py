#!/usr/bin/env python3
"""Does "both teams hot from three -> UNDER" survive the controls?

It was the top rule out of 76 pre-registered hypotheses in nba_hunt_style.py: n=146,
58.9% against a 49.75% in-slice base, +12.46% ROI, 3 of 4 seasons, placebo p=0.013. But
z=2.21 out of 76 rules is BELOW the expected maximum of 76 draws from pure noise (2.41), so
the pre-registration alone does not clear it. Either the controls carry it or it dies.

The mechanism claim is specific and therefore falsifiable: three-point percentage is mostly
luck at a three-to-ten game scale, so a team shooting over its OWN season number will shoot
worse tonight, and when BOTH teams are doing it the total is set too high. That claim makes
five predictions, each with a control that must come back flat if the story is true:

  1. DOSE      two hot teams > one hot team > zero. A step with no gradient is a red flag.
  2. OWN vs LG the own-baseline version must beat the league-baseline version. If a flat
               league cut scores the same, this is "teams that shoot threes well", a style
               fact, not a luck fact.
  3. STYLE     both teams taking MANY threes (3PA rate, a stable skill) must be dead. If the
               volume placebo scores too, the rule is about style and the label is wrong.
  4. SKILL     both teams hot on TWOs (rim finishing, far more stable) should be weaker.
  5. STABILITY it should not depend on the exact 80th percentile, on one season, or on a
               handful of teams, and it should hold at the OPEN as well as the T-60 close.
"""
import importlib.util
import os

import numpy as np
import pandas as pd

ROOT = os.path.dirname(os.path.abspath(__file__))
PQ = os.path.join(ROOT, "data", "parquet")

_s = importlib.util.spec_from_file_location("sweep", os.path.join(ROOT, "nba_hunt_sweep.py"))
sweep = importlib.util.module_from_spec(_s)
_s.loader.exec_module(sweep)
_d = importlib.util.spec_from_file_location("dd", os.path.join(ROOT, "nba_hunt_deepdive.py"))
dd = importlib.util.module_from_spec(_d)
_d.loader.exec_module(dd)

d = pd.read_parquet(f"{PQ}/nba_hunt_frame2.parquet").sort_values("game_date").reset_index(drop=True)
M = sweep.build_markets(d)
UNI = ((d["postseason"] == 0) & (d["min_gp"] >= 25)).to_numpy()


def top(col, uni, hi=0.80):
    v = d[col].to_numpy(float)
    sub = v[uni & np.isfinite(v)]
    return uni & np.isfinite(v) & (v >= np.quantile(sub, hi))


def bot(col, uni, lo=0.20):
    v = d[col].to_numpy(float)
    sub = v[uni & np.isfinite(v)]
    return uni & np.isfinite(v) & (v <= np.quantile(sub, lo))


def run(rows, title):
    dd.show([r for r in rows if r], title)


print("\n########## 1. DOSE -- how many of the two teams are hot from three (own baseline, L3)")
for w in (3, 5, 10):
    hh = top(f"hr_own{w}_p3_pct", UNI)
    ha = top(f"ar_own{w}_p3_pct", UNI)
    nhot = hh.astype(int) + ha.astype(int)
    run([dd.grade(d, UNI & (nhot == k), UNI, "fg_total_under", M, f"{k} of 2 hot")
         for k in (0, 1, 2)], f"L{w} dose ladder")

print("\n########## 2. OWN baseline vs LEAGUE baseline -- the mechanism control")
rows = []
for w in (3, 5, 10):
    own = top(f"hr_own{w}_p3_pct", UNI) & top(f"ar_own{w}_p3_pct", UNI)
    lg = top(f"hr_lg{w}_p3_pct", UNI) & top(f"ar_lg{w}_p3_pct", UNI)
    rows.append(dd.grade(d, own, UNI, "fg_total_under", M, f"L{w} OWN baseline"))
    rows.append(dd.grade(d, lg, UNI, "fg_total_under", M, f"L{w} LEAGUE baseline (control)"))
run(rows, "own vs league")

print("\n########## 3. STYLE PLACEBO -- both teams take a LOT of threes (a stable skill)")
rows = []
for w in (3, 5, 10):
    vol = top(f"hb_l{w}_p3a_rate", UNI) & top(f"ab_l{w}_p3a_rate", UNI)
    rows.append(dd.grade(d, vol, UNI, "fg_total_under", M, f"L{w} both high 3PA RATE"))
run(rows, "volume placebo -- must be flat")

print("\n########## 4. SKILL CONTROL -- both hot on eFG (includes twos, more stable)")
rows = []
for w in (3, 5, 10):
    efg = top(f"hr_own{w}_efg", UNI) & top(f"ar_own{w}_efg", UNI)
    rows.append(dd.grade(d, efg, UNI, "fg_total_under", M, f"L{w} both hot eFG (own)"))
run(rows, "eFG version")

print("\n########## 5a. THRESHOLD SENSITIVITY -- L3, percentile of the 'hot' cut")
rows = []
for hi in (0.60, 0.70, 0.75, 0.80, 0.85, 0.90):
    m = top("hr_own3_p3_pct", UNI, hi) & top("ar_own3_p3_pct", UNI, hi)
    rows.append(dd.grade(d, m, UNI, "fg_total_under", M, f"top {int((1-hi)*100)}% each"))
run(rows, "threshold ladder")

print("\n########## 5b. DROP-ONE-SEASON")
for w in (3, 10):
    m = top(f"hr_own{w}_p3_pct", UNI) & top(f"ar_own{w}_p3_pct", UNI)
    rows = [dd.grade(d, m, UNI, "fg_total_under", M, "all")]
    for s in sorted(set(d["season"])):
        k = (d["season"] != s).to_numpy()
        rows.append(dd.grade(d, m & k, UNI & k, "fg_total_under", M, f"drop {s}"))
    run(rows, f"L{w} drop-one-season")

print("\n########## 5c. OPEN vs T-60 CLOSE -- a luck edge should survive both")
Mo = sweep.build_markets(d.assign(
    t60_total_point=d["open_total_point"],
    t60_total_over_price=d["open_total_over_price"],
    t60_total_under_price=d["open_total_under_price"]))
rows = []
for w in (3, 5, 10):
    m = top(f"hr_own{w}_p3_pct", UNI) & top(f"ar_own{w}_p3_pct", UNI)
    rows.append(dd.grade(d, m, UNI, "fg_total_under", M, f"L{w} close"))
    rows.append(dd.grade(d, m, UNI, "fg_total_under", Mo, f"L{w} OPEN"))
run(rows, "open vs close")

print("\n########## 5d. TEAM CONCENTRATION -- is one franchise carrying it?")
m = top("hr_own3_p3_pct", UNI) & top("ar_own3_p3_pct", UNI)
tc = [c for c in ("home_team", "home_team.id", "home_abbr") if c in d.columns][0]
run(dd.per_team(d, m, UNI, "fg_total_under", M, tc), f"drop-one-team ({tc})")
