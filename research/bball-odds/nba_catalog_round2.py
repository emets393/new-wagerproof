#!/usr/bin/env python3
"""Round 2 on the catalog battery: drill the three REVERSALS and settle X2.

Round 1 (nba_catalog_tests.py) tested ~30 published angles. Most were flat. Three came back
BACKWARDS at sample sizes too large to wave off, and one of our own two lit-suite survivors
scored well. A published angle that runs in reverse on n=618 is not a null -- it is a
finding, and it is only available because the angle was published in the first place.

WHAT IS BEING DRILLED

  C2'  Sports Insights published "fade a home favourite that won its last by 15+" at 57.5%.
       Ours: fading goes 45.15% against a 49.65 in-slice base on n=618, z=-2.23. Inverted,
       that is BACKING the home favourite off a blowout at 54.85% vs 50.35. The published
       story is momentum-overreaction ("the public buys the blowout, the line is too high").
       If the reverse is real, the modern line UNDER-reacts instead. Tests: a dose ladder on
       the blowout size (a real effect should grade with margin, an artefact should not), the
       control that strips the blowout (plain home favourites), the away mirror, per season,
       per phase, open vs close, and the correctly-scaled placebo.

  F1   Published 58.2% UNDER in the season's first week -- the mechanism being that opening
       totals anchor to last season's pace while books are busy with NFL. Ours: 45.19% under
       on n=312, i.e. 54.81% OVER. Same mechanism, opposite sign, and it has an obvious
       modern cause: league pace has risen almost every year in our sample, so an opener
       anchored to last season is anchored TOO LOW. That predicts the realised total should
       beat the posted total in October specifically, and that the effect should be bigger in
       seasons where pace rose more. Both are tested.

  K2   Published: moneyline dogs under ~20-25% implied win probability were profitable
       2016-20 (a REVERSED favourite-longshot bias). Ours: home dogs at <=15% implied return
       -42.17% ROI, z=-3.82 -- the largest single number in the whole battery, and it points
       the ORTHODOX way. That is worth more than a null, because the orthodox direction is a
       bet you can actually place: it says lay the price on huge favourites. Tested as a full
       calibration table (implied probability vs realised win rate vs ROI on BOTH sides), so
       the answer is a curve rather than one threshold.

  X2   Home team with 2+ days more rest: 57.36% vs a 50.35 base, +9.53% ROI on n=258, all
       four seasons positive, all four phases positive, identical at the open. Its two
       problems were a flat 3+ day variant (n=52) and a placebo of p=0.2265 that contradicted
       its z=2.25.

       THE PLACEBO WAS A UNITS BUG, NOT A DISAGREEMENT. dd.placebo compares
       prof.mean()*100 to observed_roi, so observed_roi has to be in percent; round 1 passed
       r["roi"]/100. That turns the test into "beat +0.095% ROI" against a market whose base
       is -3.85%, which returns p ~ 0.25 for anything. Fixed at both call sites and in the
       docstring; re-run here. What survives is the real question -- whether the 3+ day
       failure kills the convexity story -- so the rest ladder is graded day by day.
"""
import importlib.util
import os

import numpy as np
import pandas as pd

ROOT = os.path.dirname(os.path.abspath(__file__))

_c = importlib.util.spec_from_file_location("cat", os.path.join(ROOT, "nba_catalog_tests.py"))
cat = importlib.util.module_from_spec(_c); _c.loader.exec_module(cat)

dd, sweep = cat.dd, cat.sweep
d, P, pv, col = cat.d, cat.P, cat.pv, cat.col
M_CLOSE, M_OPEN = cat.M_CLOSE, cat.M_OPEN
REG, GP, PHASES = cat.REG, cat.GP, cat.PHASES
VALID_H, VALID_A = cat.VALID_H, cat.VALID_A
ats, per_season, by_phase, head = cat.ats, cat.per_season, cat.by_phase, cat.head

SP = col("t60_spread_home_point")
SP_O = col("open_spread_home_point")
HP_M, AP_M = pv("hp_p1_margin"), pv("ap_p1_margin")


def placebo_of(mask, market, universe=None, trials=6000, label=""):
    """Correctly-scaled placebo. r['roi'] goes in as PERCENT -- see the module docstring."""
    uni = REG if universe is None else universe
    r = dd.grade(d, mask & uni, uni, market, M_CLOSE, "x", min_n=25)
    if not r:
        print(f"  {label}: below the size floor")
        return
    p = dd.placebo(d, uni, market, M_CLOSE, r["n"], r["roi"], trials=trials)
    print(f"  {label}: n={r['n']:4d}  roi {r['roi']:+6.2f}%  z={r['z']:+.2f}  placebo p={p:.4f}")


# ================================================================= R1. the C2' reversal
head("R1", "BACK THE HOME FAVOURITE OFF A BLOWOUT WIN (published says FADE it at 57.5%)",
     "Sports Insights C2, inverted by our own data on n=618")

home_fav = SP < 0
rows = []
for k in (5, 10, 15, 20, 25):
    rows += cat.ats(VALID_H & home_fav & (HP_M >= k), f"home fav, won last by {k}+ -> back HOME",
                    "fg_spread_home", min_n=25, do_open=False)
dd.show(rows, "R1a  DOSE LADDER -- a real overreaction should grade with the size of the blowout")

dd.show(cat.ats(VALID_H & home_fav, "control: ANY home favourite -> back HOME",
                "fg_spread_home", min_n=25) +
        cat.ats(VALID_H & home_fav & (HP_M < 15), "control: home fav, last win < 15 (or a loss)",
                "fg_spread_home", min_n=25) +
        cat.ats(VALID_H & home_fav & (HP_M >= 15), "C2' home fav off a 15+ win -> back HOME",
                "fg_spread_home", min_n=25),
        "R1b  IS THE BLOWOUT DOING THE WORK, or is it just 'home favourite'?")

dd.show(cat.ats(VALID_A & (SP > 0) & (AP_M >= 15), "mirror: AWAY fav off a 15+ win -> back AWAY",
                "fg_spread_away", min_n=25) +
        cat.ats(VALID_H & (SP > 0) & (HP_M >= 15), "home DOG off a 15+ win -> back HOME",
                "fg_spread_home", min_n=25),
        "R1c  MIRROR AND DOG VERSIONS -- if this is about blowouts it should not need home-fav")

c2p = VALID_H & home_fav & (HP_M >= 15)
dd.show(per_season(c2p, "fg_spread_home", "C2' back home"), "R1d  per season")
dd.show(by_phase(c2p, "fg_spread_home", "C2' back home"), "R1e  by phase")
placebo_of(c2p, "fg_spread_home", label="R1f C2' back-home placebo")

# The line test: if the market UNDER-reacts to a blowout, the spread should be too SHORT.
for lab, m in (("off a 15+ win", c2p), ("off a <15 result", VALID_H & home_fav & (HP_M < 15))):
    am = col("ats_margin")[m & REG]
    print(f"  R1g  home fav {lab:18s} n={int((m & REG).sum()):4d}  "
          f"mean cover margin {np.nanmean(am):+5.2f} pts  (0 = line exactly right)")


# ================================================================= R2. the F1 reversal
head("R2", "EARLY-SEASON OVER (published says 58.2% UNDER in week 1)",
     "Sports Insights F1, inverted by our own data on n=312")

rows = []
for k in (3, 5, 8, 10, 15, 20):
    rows += cat.ats(REG & (GP < k), f"first <{k} gp -> OVER", "fg_total_over", min_n=25,
                    do_open=False)
dd.show(rows, "R2a  HOW EARLY IS EARLY -- the effect should decay as the books catch up")

dd.show(cat.ats(REG & (GP < 10), "first <10 gp -> OVER", "fg_total_over", min_n=25),
        "R2b  open vs close -- if books correct it intraday, the OPEN should be better")

dd.show(per_season(REG & (GP < 10), "fg_total_over", "F1 early over", min_n=20),
        "R2c  per season -- is this one October, or every October?")

placebo_of(REG & (GP < 10), "fg_total_over", label="R2d F1 early-over placebo")

# The mechanism test: an opener anchored to last season's pace in a league whose pace keeps
# rising should be too LOW, and by more in seasons where scoring rose more.
tot_c, oum = col("t60_total_point"), col("ou_margin")
gm = col("gm_total")
print("\n  R2e  posted vs realised, by season and season-phase (positive = the total was too low)")
for s in sorted(set(d["season"])):
    k = (d["season"] == s).to_numpy() & REG
    early, rest = k & (GP < 10), k & (GP >= 10)
    print(f"    {s}  early n={int(early.sum()):3d} posted {np.nanmean(tot_c[early]):6.1f} "
          f"realised {np.nanmean(gm[early]):6.1f} miss {np.nanmean(oum[early]):+5.2f}   |   "
          f"rest n={int(rest.sum()):4d} posted {np.nanmean(tot_c[rest]):6.1f} "
          f"realised {np.nanmean(gm[rest]):6.1f} miss {np.nanmean(oum[rest]):+5.2f}")

dd.show(cat.ats(REG & (GP < 10), "first <10 gp -> 1H OVER", "h1_total_over", min_n=25,
                do_open=False),
        "R2f  does it carry into the FIRST HALF total (same anchor, separate market)?")


# ================================================================= R3. the K2 reversal
head("R3", "FAVOURITE-LONGSHOT BIAS -- ORTHODOX, NOT REVERSED",
     "Towards Data Science 2020 / Paul & Weinbach 2005, contradicted at z=-3.82")

ml_h = np.asarray(sweep.dec(d["t60_ml_home_price"]), float)
ml_a = np.asarray(sweep.dec(d["t60_ml_away_price"]), float)
imp_h, imp_a = 1.0 / ml_h, 1.0 / ml_a
won_h = col("home_win")

print("\n  R3a  CALIBRATION: what a price implies vs what actually happens.")
print("       'edge' is realised minus implied, in percentage points. Negative on the dog")
print("       side = the orthodox longshot bias: big dogs win LESS than their price implies.")
print(f"    {'implied band':>14s} {'n':>5s} {'implied':>8s} {'realised':>9s} {'edge':>7s} "
      f"{'ROI dog':>8s} {'ROI fav':>8s}")
bands = [(0.02, 0.10), (0.10, 0.15), (0.15, 0.20), (0.20, 0.25), (0.25, 0.30),
         (0.30, 0.40), (0.40, 0.50), (0.50, 0.60), (0.60, 0.70), (0.70, 0.80),
         (0.80, 0.90), (0.90, 0.98)]
for lo, hi in bands:
    # pool both sides: every game contributes its dog once, whichever side that is
    mh = REG & np.isfinite(imp_h) & (imp_h >= lo) & (imp_h < hi)
    ma = REG & np.isfinite(imp_a) & (imp_a >= lo) & (imp_a < hi)
    n = int(mh.sum() + ma.sum())
    if n < 30:
        continue
    implied = np.concatenate([imp_h[mh], imp_a[ma]])
    realised = np.concatenate([won_h[mh], 1.0 - won_h[ma]])
    dec = np.concatenate([ml_h[mh], ml_a[ma]])
    roi_side = np.where(realised > 0, dec - 1.0, -1.0).mean() * 100
    # the other side of the very same games, at its own price
    dec_o = np.concatenate([ml_a[mh], ml_h[ma]])
    roi_other = np.where(realised > 0, -1.0, dec_o - 1.0).mean() * 100
    print(f"    {lo:.2f}-{hi:.2f}     {n:5d} {100*implied.mean():7.1f}% {100*realised.mean():8.1f}% "
          f"{100*(realised.mean()-implied.mean()):+6.1f} {roi_side:+7.2f}% {roi_other:+7.2f}%")

print("\n  R3b  the bet that follows: LAY the price on the big favourite")
for thr in (0.15, 0.20, 0.25):
    dd.show(cat.ats(np.isfinite(imp_a) & (imp_a <= thr),
                    f"away dog <={thr:.0%} implied -> back HOME fav ML", "fg_ml_home",
                    min_n=25, do_open=False) +
            cat.ats(np.isfinite(imp_h) & (imp_h <= thr),
                    f"home dog <={thr:.0%} implied -> back AWAY fav ML", "fg_ml_away",
                    min_n=25, do_open=False),
            f"R3b  favourites priced above {1-thr:.0%} implied")

big_fav = REG & ((np.isfinite(imp_a) & (imp_a <= 0.20)) | (np.isfinite(imp_h) & (imp_h <= 0.20)))
dd.show(per_season(np.isfinite(imp_h) & (imp_h <= 0.20), "fg_ml_away", "lay big away fav", min_n=15) +
        per_season(np.isfinite(imp_a) & (imp_a <= 0.20), "fg_ml_home", "lay big home fav", min_n=15),
        "R3c  per season -- laying huge chalk is exactly the bet a bad streak destroys")

print("\n  R3d  does the same spot show up on the SPREAD, where the price is symmetric?")
dd.show(cat.ats(np.isfinite(imp_a) & (imp_a <= 0.20), "away dog <=20% implied -> back HOME ATS",
                "fg_spread_home", min_n=25, do_open=False) +
        cat.ats(np.isfinite(imp_h) & (imp_h <= 0.20), "home dog <=20% implied -> back AWAY ATS",
                "fg_spread_away", min_n=25, do_open=False) +
        cat.ats(big_fav, "either big fav -> OVER", "fg_total_over", min_n=25, do_open=False) +
        cat.ats(big_fav, "either big fav -> UNDER", "fg_total_under", min_n=25, do_open=False),
        "R3d  spread and total versions of the big-mismatch spot")


# ================================================================= R4. settle X2
head("R4", "X2 REST ADVANTAGE -- the placebo was a units bug; re-run and grade the ladder",
     "our nba_lit_tests.py section 6")

h_rest, a_rest = col("h_rest_days"), col("a_rest_days")
dr = h_rest - a_rest

print("\n  R4a  THE FULL REST LADDER, every rung graded on BACK-HOME so the signs line up.")
print("       The convexity claim says the payoff should be flat from -1 to +1 and jump at +2.")
rows = []
for lo, hi, lab in ((-9, -3, "home 3+ days LESS"), (-2, -2, "home 2 less"), (-1, -1, "home 1 less"),
                    (0, 0, "equal rest"), (1, 1, "home 1 more"), (2, 2, "home 2 more"),
                    (3, 9, "home 3+ more")):
    rows += cat.ats(REG & (dr >= lo) & (dr <= hi), f"{lab} -> back HOME", "fg_spread_home",
                    min_n=25, do_open=False)
dd.show(rows, "R4a  rest ladder")

placebo_of(REG & (dr >= 2), "fg_spread_home", label="R4b X2 (dr>=2) CORRECTED placebo")
placebo_of(REG & (dr == 2), "fg_spread_home", label="R4b X2 exactly +2 only")
placebo_of(REG & (dr >= 3), "fg_spread_home", label="R4b X2' (dr>=3)")

print("\n  R4c  WHAT IS THE OPPONENT DOING? dr>=2 is mostly 'away team on a back-to-back'.")
a_b2b, h_b2b = col("a_b2b") == 1, col("h_b2b") == 1
dd.show(cat.ats(REG & (dr >= 2) & a_b2b, "dr>=2 AND away on a b2b -> back HOME",
                "fg_spread_home", min_n=25, do_open=False) +
        cat.ats(REG & (dr >= 2) & ~a_b2b, "dr>=2 but away NOT on a b2b -> back HOME",
                "fg_spread_home", min_n=25, do_open=False) +
        cat.ats(REG & a_b2b & ~h_b2b, "away b2b, home not (any rest gap) -> back HOME",
                "fg_spread_home", min_n=25, do_open=False),
        "R4c  is the rest GAP the signal, or just the away b2b?")

print("\n  R4d  X2 crossed with the home team's price -- rested chalk vs rested dog")
dd.show(cat.ats(REG & (dr >= 2) & (SP < 0), "dr>=2 AND home favoured -> back HOME",
                "fg_spread_home", min_n=25, do_open=False) +
        cat.ats(REG & (dr >= 2) & (SP > 0), "dr>=2 AND home is a dog -> back HOME",
                "fg_spread_home", min_n=25, do_open=False) +
        cat.ats(REG & (dr >= 2), "dr>=2 -> OVER", "fg_total_over", min_n=25, do_open=False) +
        cat.ats(REG & (dr >= 2), "dr>=2 -> 1H back HOME", "h1_spread_home", min_n=25,
                do_open=False),
        "R4d  conditioning and other markets")

print("\n  R4e  X1 (visitor 2+ tz WEST) with the corrected placebo, for completeness")
a_tz = col("a_trav_tz")
placebo_of(REG & (a_tz <= -2), "fg_spread_home", label="R4e X1 back-home")
placebo_of(REG & (a_tz <= -2), "fg_spread_away", label="R4e X1 back-away (published direction)")
