#!/usr/bin/env python3
"""Round 2 on "both teams hot -> UNDER". The stated mechanism failed; the effect did not.

WHAT ROUND 1 SETTLED (nba_hot3_validate.py):
  - The rule is real enough to keep testing: top-quintile-each, L3, 58.90% vs a 49.75%
    in-slice base, +12.46% ROI on n=146, positive in a drop-one-season on all four seasons
    (z 1.26 to 3.23), 30 distinct teams with a 7.4% top share, identical at the OPEN.
  - The THRESHOLD LADDER is monotone, which is the single best sign it is not a fluke:
    top 40% each +2.75, 30% +3.04, 25% +6.65, 19% +12.46, 15% +15.01.
  - The 3PA-RATE placebo is DEAD (-10.8 / -7.8 / -5.8). So this is not "both teams shoot
    a lot of threes", which was the obvious style confound.
  - BUT THE MECHANISM CONTROL FAILED. The league-baseline version scores the same as the
    own-baseline version (+12.15 vs +12.46 at L3, and at L5 the league version is BETTER,
    +10.47 vs +5.01). "Shooting over its own head" is therefore NOT what is being traded.
    And the dose ladder is a step, not a gradient: 0 hot -5.80, 1 hot -5.69, 2 hot +12.15.
    One hot team is worth exactly nothing, which no regression-to-the-mean story predicts.

SO WHAT IS IT ACTUALLY? The surviving description is plain: BOTH teams have been shooting
efficiently lately, in level terms, and the total comes in too high. That points at market
over-extrapolation of recent scoring rather than at shooting luck, and it makes four
predictions this file tests:

  A. LEVEL beats DELTA. Raw recent eFG should work at least as well as the own-baseline
     delta. If it does, drop the "regression" framing entirely.
  B. It should generalise past shooting to recent SCORING (off_eff, points). If recent
     offensive efficiency works too, the story is "recent scoring is over-extrapolated",
     which is a bigger and more useful finding than a three-point quirk.
  C. THE CONJUNCTION IS THE POINT. One hot team is worth zero; two is worth +12. That is an
     interaction, and it needs the interaction-excess statistic, not a marginal.
  D. THE LINE TEST. If the market over-extrapolates, the posted total should be visibly
     HIGHER in these games than the same teams' season norm would justify -- and the model
     residual should be negative. If the total is NOT elevated, the story is wrong and this
     is something else.
"""
import importlib.util
import os

import numpy as np
import pandas as pd

ROOT = os.path.dirname(os.path.abspath(__file__))
PQ = os.path.join(ROOT, "data", "parquet")

_s = importlib.util.spec_from_file_location("sweep", os.path.join(ROOT, "nba_hunt_sweep.py"))
sweep = importlib.util.module_from_spec(_s); _s.loader.exec_module(sweep)
_d = importlib.util.spec_from_file_location("dd", os.path.join(ROOT, "nba_hunt_deepdive.py"))
dd = importlib.util.module_from_spec(_d); _d.loader.exec_module(dd)

d = pd.read_parquet(f"{PQ}/nba_hunt_frame2.parquet").sort_values("game_date").reset_index(drop=True)
M = sweep.build_markets(d)
UNI = ((d["postseason"] == 0) & (d["min_gp"] >= 25)).to_numpy()


def top(col, hi=0.80, uni=UNI):
    v = d[col].to_numpy(float)
    sub = v[uni & np.isfinite(v)]
    if len(sub) < 100:
        return np.zeros(len(d), bool)
    return uni & np.isfinite(v) & (v >= np.quantile(sub, hi))


def pair(stem, w, hi=0.80):
    return top(f"hb_l{w}_{stem}", hi) & top(f"ab_l{w}_{stem}", hi)


print("\n########## A. LEVEL vs DELTA -- is the own-baseline framing doing any work?")
rows = []
for w in (3, 5, 10):
    rows.append(dd.grade(d, pair("p3_pct", w), UNI, "fg_total_under", M, f"L{w} 3P% LEVEL"))
    rows.append(dd.grade(d, top(f"hr_own{w}_p3_pct") & top(f"ar_own{w}_p3_pct"), UNI,
                         "fg_total_under", M, f"L{w} 3P% own-DELTA"))
    rows.append(dd.grade(d, pair("efg", w), UNI, "fg_total_under", M, f"L{w} eFG LEVEL"))
dd.show(rows, "level vs delta, both teams top quintile -> under")

print("\n########## B. DOES IT GENERALISE PAST SHOOTING? recent scoring / efficiency")
rows = []
for w in (3, 5, 10):
    for stem, lab in (("off_eff", "off efficiency"), ("pace", "pace"),
                      ("ft_pct", "FT%"), ("tov_rate", "TOV rate")):
        r = dd.grade(d, pair(stem, w), UNI, "fg_total_under", M, f"L{w} both top {lab}")
        if r:
            rows.append(r)
dd.show(rows, "other 'both teams high' pairs -> under")

print("\n########## C. INTERACTION EXCESS -- one hot team is worth nothing, two is worth +12")
rows = []
for w in (3, 5, 10):
    h, a = top(f"hb_l{w}_efg"), top(f"ab_l{w}_efg")
    rows.append(dd.grade(d, h, UNI, "fg_total_under", M, f"L{w} HOME only (marginal)"))
    rows.append(dd.grade(d, a, UNI, "fg_total_under", M, f"L{w} AWAY only (marginal)"))
    rows.append(dd.grade(d, h & a, UNI, "fg_total_under", M, f"L{w} BOTH (conjunction)"))
    rows.append(dd.grade(d, h ^ a, UNI, "fg_total_under", M, f"L{w} exactly ONE"))
dd.show(rows, "eFG conjunction structure")

print("\n########## D. THE LINE TEST -- is the posted total actually elevated in these games?")
tot = d["t60_total_point"].to_numpy(float)
oum = d["ou_margin"].to_numpy(float)
for w in (3, 5, 10):
    for stem in ("efg", "p3_pct", "off_eff"):
        m = pair(stem, w)
        if m.sum() < 40:
            continue
        base = UNI & np.isfinite(tot)
        print(f"  L{w:2d} both-top {stem:8s} n={m.sum():4d}  posted total "
              f"{np.nanmean(tot[m]):6.2f} vs universe {np.nanmean(tot[base]):6.2f} "
              f"(+{np.nanmean(tot[m])-np.nanmean(tot[base]):.2f})   "
              f"actual-minus-line {np.nanmean(oum[m]):+6.2f} vs {np.nanmean(oum[base]):+.2f}")

print("\n########## E. PHASE -- the standing rule: never grade all games as one pool")
gp = d["min_gp"].to_numpy(float)
reg = (d["postseason"] == 0).to_numpy()
for w in (3, 10):
    rows = []
    m = pair("efg", w)
    for lab, ph in (("early <25gp", reg & (gp < 25)), ("mid 25-49", reg & (gp >= 25) & (gp < 50)),
                    ("late 50+", reg & (gp >= 50)), ("playoffs", ~reg)):
        # the cut has to be re-taken inside each phase or "top quintile" means top quintile
        # of the season, which is not the same population in October as in April
        mm = top(f"hb_l{w}_efg", uni=ph) & top(f"ab_l{w}_efg", uni=ph)
        r = dd.grade(d, mm, ph, "fg_total_under", M, f"L{w} {lab}", min_n=25)
        if r:
            rows.append(r)
    dd.show(rows, f"L{w} eFG-both by phase (cut re-taken inside each phase)")

print("\n########## F. PLACEBO on the best surviving version")
for w, stem in ((3, "efg"), (3, "p3_pct"), (10, "p3_pct")):
    m = pair(stem, w)
    r = dd.grade(d, m, UNI, "fg_total_under", M, "x")
    if r:
        p = dd.placebo(d, UNI, "fg_total_under", M, r["n"], r["roi"], trials=4000)
        print(f"  L{w} both-top {stem:8s} n={r['n']:4d} roi {r['roi']:+6.2f}  placebo p={p:.4f}")
