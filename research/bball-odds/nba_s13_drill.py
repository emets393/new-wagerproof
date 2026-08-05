#!/usr/bin/env python3
"""S13 candidate: FADE THE NAIVE SCORING PROJECTION. Plus the coherent reversals.

WHERE THIS CAME FROM. nba_conj_hunt.py ran 125 mechanism-backed conjunction templates two
ways -- a walk-forward with tuned thresholds (2,216 cells) and a pre-registered pass with one
a-priori threshold per term (125 cells). The tuned search transferred at +0.18% excess ROI
forward and -1.95% reversed, i.e. the tuning is pure noise and that whole design is dead. The
pre-registered pass produced exactly one rule that was positive out of sample in BOTH split
directions AND cleared z >= 2 on the full sample AND was positive in all four seasons.

WHAT THE RULE ACTUALLY IS. It was mislabelled "H2H" in the first run. pair_l{w}_margin_vs_line
is not head-to-head at all -- it is the amateur handicapper's method written down:

    projected home margin = (home pts scored - away pts allowed)/2 - (away pts scored - home pts allowed)/2
    signal               = that projection - what the spread asks the home team to beat

High values mean "recent points-for/points-against says the home team should win by far more
than the line asks". That is exactly what a casual bettor computes from a stat page. The
finding is that when it screams loudest for the home side, you back the AWAY side:
n=1021, 54.06% against a 50.19 in-slice base, +7.37% excess ROI, z=2.47, 55/56/51/53 by season.

WHY IT IS PLAUSIBLE RATHER THAN JUST SURVIVING. Points-for minus points-against ignores
opponent quality, pace, and garbage time -- all three of which inflate it for a team that has
just played a soft, fast, blowout-heavy stretch. The market adjusts for all three. So the
signal is a measure of how far PUBLIC-VISIBLE form has run ahead of REAL form, and fading it
is fading the crowd, not the model.

WHAT THIS FILE HAS TO RULE OUT, in order:
  1. that it is really just "the home team is a big favourite" (spread control)
  2. that it is really just "the home team has been scoring a lot" (form-only control, no line)
  3. that it is really just the LINE half of the expression (line-only control)
  4. that the effect is not monotone in the signal -- a real fade should grade
  5. that it is one season, one phase, or a handful of franchises
  6. that it lives only at the close (news latency) rather than at the open too

ALSO IN THIS FILE: the four templates from the pre-registered pass whose stated direction came
back REVERSED with a coherent alternative mechanism, graded properly on their winning side.
A pre-registered direction that fails is only interesting when the opposite side has a story,
so each is stated with one.
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
M_OPEN = sweep.build_markets(d.assign(
    t60_spread_home_point=d["open_spread_home_point"],
    t60_spread_home_price=d["open_spread_home_price"],
    t60_spread_away_price=d["open_spread_away_price"],
    t60_total_point=d["open_total_point"],
    t60_total_over_price=d["open_total_over_price"],
    t60_total_under_price=d["open_total_under_price"]))

REG = (d["postseason"] == 0).to_numpy()
GP = pd.to_numeric(d["min_gp"], errors="coerce").to_numpy(float)
UNI = REG & (GP >= 25)
SEASONS = sorted(set(d["season"]))
PHASES = {"early <25gp": REG & (GP < 25), "mid 25-49": REG & (GP >= 25) & (GP < 50),
          "late 50+": REG & (GP >= 50), "playoffs": ~REG}


def col(n):
    return pd.to_numeric(d[n], errors="coerce").to_numpy(float)


def hi(c, pct, uni=UNI):
    v = col(c)
    return np.isfinite(v) & (v >= np.nanquantile(v[uni & np.isfinite(v)], pct))


def lo(c, pct, uni=UNI):
    v = col(c)
    return np.isfinite(v) & (v <= np.nanquantile(v[uni & np.isfinite(v)], pct))


def g(mask, market, label, uni=UNI, markets=None, min_n=40):
    return dd.grade(d, mask & uni, uni, market, markets or M, label, min_n=min_n)


def seasons_of(mask, market, label, uni=UNI, min_n=15):
    out = []
    for s in SEASONS:
        k = (d["season"] == s).to_numpy()
        r = g(mask & k, market, f"{label} {s}", uni=uni & k, min_n=min_n)
        if r:
            out.append(r)
    return out


def phases_of(mask, market, label, min_n=25):
    out = []
    for pl, pm in PHASES.items():
        r = g(mask & pm, market, f"{label} {pl}", uni=pm, min_n=min_n)
        if r:
            out.append(r)
    return out


def head(t, s=""):
    print("\n" + "=" * 92 + f"\n{t}\n" + (f"   {s}\n" if s else "") + "=" * 92)


SP = col("t60_spread_home_point")

# ============================================================ 1. the dose ladder
head("S13a  DOSE LADDER -- how far the naive projection has to run before the fade pays",
     "a real over-extrapolation fade should grade with the size of the over-extrapolation")
for w in (3, 5, 10):
    rows = []
    for pct in (0.55, 0.65, 0.75, 0.85, 0.90, 0.95):
        rows.append(g(hi(f"pair_l{w}_margin_vs_line", pct),
                      "fg_spread_away", f"L{w} top {int((1-pct)*100)}% -> back AWAY", min_n=30))
    for pct in (0.45, 0.35, 0.25, 0.15, 0.10, 0.05):
        rows.append(g(lo(f"pair_l{w}_margin_vs_line", pct),
                      "fg_spread_home", f"L{w} bottom {int(pct*100)}% -> back HOME", min_n=30))
    dd.show(rows, f"L{w} ladder (the two halves should be mirror images if the signal is real)")

# ============================================================ 2. the three controls
head("S13b  CONTROLS -- is it the projection, or one of its two ingredients on its own?",
     "the signal is (recent scoring projection) minus (what the line asks). Test each half alone.")
S = hi("pair_l3_margin_vs_line", 0.85)
dd.show([g(S, "fg_spread_away", "S13 signal (projection minus line), top 15%"),
         g(lo("t60_spread_home_point", 0.15), "fg_spread_away", "LINE only: home is a big favourite"),
         g(hi("h_l3_margin", 0.85), "fg_spread_away", "FORM only: home's recent margin is high"),
         g(hi("h_l3_own", 0.85), "fg_spread_away", "FORM only: home has been scoring a lot"),
         g(hi("h_l3_margin", 0.85) & ~S, "fg_spread_away", "form high but signal NOT -- must be flat"),
         g(S & ~hi("h_l3_margin", 0.85), "fg_spread_away", "signal high but form NOT")],
        "S13b  each ingredient on its own, and the signal with each stripped out")

print("\n  S13b-ii  the signal INSIDE spread buckets. If it survives in every bucket it is")
print("           not a disguised 'fade big home favourites' rule.")
rows = []
for lo_s, hi_s, lab in ((-40, -9.5, "home fav 10+"), (-9.5, -4.5, "home fav 5-9"),
                        (-4.5, -0.5, "home fav 1-4"), (-0.5, 40, "home is a dog")):
    b = REG & (GP >= 25) & (SP > lo_s) & (SP <= hi_s)
    r = g(S & b, "fg_spread_away", f"S13 within {lab}", uni=b, min_n=25)
    if r:
        rows.append(r)
dd.show(rows, "S13b-ii  signal conditioned on the price")

# ============================================================ 3. stability
head("S13c  STABILITY -- season, phase, open vs close, franchise concentration")
dd.show(seasons_of(S, "fg_spread_away", "S13"), "per season")
dd.show(phases_of(S, "fg_spread_away", "S13"), "per phase")
dd.show([g(S, "fg_spread_away", "S13 at the T-60 CLOSE"),
         g(S, "fg_spread_away", "S13 at the OPEN", markets=M_OPEN)],
        "open vs close -- a crowd-fade should work at both, a news edge only at the close")
tc = [c for c in ("away_team", "home_team") if c in d.columns][0]
dd.show(dd.per_team(d, S, UNI, "fg_spread_away", M, tc)[:8], f"drop-one-team ({tc}), worst 8")
r = g(S, "fg_spread_away", "x")
print(f"\n  S13c placebo: n={r['n']} roi {r['roi']:+.2f}% z={r['z']:+.2f} "
      f"p={dd.placebo(d, UNI, 'fg_spread_away', M, r['n'], r['roi'], trials=8000):.4f}")

# ============================================================ 4. does it carry to other markets
head("S13d  OTHER MARKETS -- if the crowd over-reads recent scoring, the total should move too")
dd.show([g(S, "fg_ml_away", "S13 -> away moneyline"),
         g(S, "h1_spread_away", "S13 -> 1H back AWAY"),
         g(hi("pair_l3_gtot_vs_line", 0.85), "fg_total_under",
           "recent games ran ABOVE this total -> UNDER"),
         g(lo("pair_l3_gtot_vs_line", 0.15), "fg_total_over",
           "recent games ran BELOW this total -> OVER"),
         g(hi("pair_l3_gtot_vs_line", 0.85), "tt_home_under", "…-> home TT under"),
         g(hi("pair_l3_gtot_vs_line", 0.85), "tt_away_under", "…-> away TT under")],
        "S13d  the same over-extrapolation logic across our other markets")

# ============================================================ 5. the coherent reversals
head("R  PRE-REGISTERED DIRECTIONS THAT CAME BACK REVERSED, graded on their winning side",
     "each is only listed because the opposite side has a mechanism, not just a better number")

print("\n  R-i  Registered: low FT rate into a low-fouling defence -> UNDER. It lost badly.")
print("       The reverse story: few free throws means few whistles, a running clock and more")
print("       possessions. A foul-free game is a FAST game, not a low-scoring one.")
for w in (5, 10):
    m = lo(f"hb_l{w}_ftr", 0.30) & lo(f"ab_l{w}_ftr_alwd", 0.30)
    dd.show([g(m, "fg_total_over", f"L{w} clean-whistle game -> OVER")] +
            seasons_of(m, "fg_total_over", f"L{w} clean -> OVER"),
            f"R-i  L{w}")

print("\n  R-ii  Registered: away team concentrated scoring on a b2b -> UNDER. It lost badly.")
print("        The reverse story: a top-heavy tired team stops getting stops long before its")
print("        stars stop shooting, so the defence goes first and the game runs UP, not down.")
m = hi("ab_l10_hhi", 0.70) & (col("a_b2b") == 1)
dd.show([g(m, "fg_total_over", "top-heavy away side on a b2b -> OVER")] +
        seasons_of(m, "fg_total_over", "top-heavy b2b -> OVER"), "R-ii")

print("\n  R-iii  Registered: home shoots threes into a defence that concedes threes ->")
print("         home TT OVER. It lost badly. The reverse story: three-point volume against a")
print("         defence that funnels you there is the LOW-efficiency shot diet, not the high one.")
for w in (5, 10):
    m = hi(f"hb_l{w}_p3a_rate", 0.70) & hi(f"ab_l{w}_p3a_rate_alwd", 0.70)
    dd.show([g(m, "tt_home_under", f"L{w} home pushed into threes -> home TT UNDER")] +
            seasons_of(m, "tt_home_under", f"L{w} -> home TT UNDER"), f"R-iii  L{w}")

print("\n  R-iv  Registered: line moved AGAINST the home side but its form disagrees ->")
print("        back HOME (a contrarian fade of the move). It lost badly, which is the")
print("        cleanest possible statement that THE MOVE BEATS THE FORM. Graded as follow-the-move.")
m = hi("open_spread_move", 0.70) & hi("h_l5_atsm", 0.70)
dd.show([g(m, "fg_spread_away", "line moved off home, form says otherwise -> FOLLOW THE MOVE"),
         g(hi("open_spread_move", 0.70), "fg_spread_away", "control: any move off home -> back AWAY"),
         g(lo("open_spread_move", 0.30) & lo("h_l5_atsm", 0.30), "fg_spread_home",
           "mirror: move TOWARD home while form is poor -> follow it")] +
        seasons_of(m, "fg_spread_away", "follow-the-move"), "R-iv")

# ============================================================ 6. X2 confirmation
head("X2  REST: exactly +2 days is the cell, and the ladder explains why",
     "the market's rest slope is linear where the truth is convex, so +1 is over-paid and +2 under-paid")
dr = col("h_rest_days") - col("a_rest_days")
dd.show([g(REG & (dr == 2), "fg_spread_home", "home exactly +2 days rest -> back HOME", uni=REG, min_n=25),
         g(REG & (dr >= 2), "fg_spread_home", "home +2 or more -> back HOME", uni=REG, min_n=25),
         g(REG & (dr == 1), "fg_spread_home", "home +1 day (over-paid) -> back HOME", uni=REG),
         g(REG & (dr == 2) & (col("a_b2b") != 1), "fg_spread_home",
           "home +2 and away NOT on a b2b -> back HOME", uni=REG, min_n=25)] +
        seasons_of(REG & (dr == 2), "fg_spread_home", "rest +2", uni=REG, min_n=12),
        "X2  the rest cell")
