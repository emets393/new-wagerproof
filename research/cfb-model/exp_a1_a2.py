"""
A1: spot/trend rules as in-model signed boolean features. NFL result: FAILED mechanically (rare flags can't
split w/ min_samples_leaf~40 -> identical picks). Check fire rates first; document negative fast if same.
A2: cross-team matchup nets (NFL winner, +2.4pp). SUM semantics: hexp = home_off_X + away_def_allowed_X
(def metrics measure what they ALLOW), aexp = away_off_X + home_def_allowed_X, net = hexp - aexp; sum for totals.
BASE vs BASE+nets on identical folds, sides + totals, product-style.
"""
import numpy as np
import pandas as pd
import exp_shared as E

gm, FEATS = E.load()

# ---------- A1: spot flags ----------
print("=" * 78); print("A1: SPOT FLAGS AS FEATURES — fire rates first")
P5 = {"SEC", "Big Ten", "Big 12", "ACC", "Pac-12"}
conf = np.where(gm.homeConference == gm.awayConference, gm.homeConference, "NON")
flags = pd.DataFrame(index=gm.index)
flags["f_rvr"] = np.where((gm.home_self_rank_is == 1) & (gm.away_self_rank_is == 1) & (gm.spread_close < 0), 1, 0)  # RvR home-fav -> home
flags["f_sunbelt_fade"] = np.where((pd.Series(conf) == "Sun Belt") & (gm.spread_close < 0), -1, 0)               # fade home fav -> away
flags["f_bigten_awayfav"] = np.where((pd.Series(conf) == "Big Ten") & (gm.spread_close > 0), -1, 0)              # away
flags["f_wk1_rank1025"] = np.where((gm.week == 1) & (((gm.home_self_rank >= 10) & (gm.home_self_rank <= 25)) ), 1, 0)
for c in flags.columns:
    print(f"  {c:<20} fires {100*(flags[c]!=0).mean():.1f}% of games")
gm2 = gm.join(flags)
A_base = E.walk(gm, FEATS, "actual_margin")
A_flag = E.walk(gm2, FEATS + list(flags.columns), "actual_margin")
same = (np.sign(A_base.pred + A_base.spread_open) == np.sign(A_flag.pred.values + A_base.spread_open)).mean()
print(f"  pick agreement BASE vs +FLAGS: {100*same:.1f}% (NFL was ~100% = mechanical fail)")
E.grade_sides(A_base, label="SIDES base")
E.grade_sides(A_flag, label="SIDES +spotflags")

# ---------- A2: cross-team nets ----------
print("\n" + "=" * 78); print("A2: CROSS-TEAM MATCHUP NETS (SUM semantics)")
bases = [c[len("home_adj_"):-len("_allowed")] for c in gm.columns
         if c.startswith("home_adj_") and c.endswith("_allowed")]
print(f"  off/allowed pairs found: {len(bases)}: {bases}")
nets, sums = [], []
for b in bases:
    hexp = gm[f"home_adj_{b}"] + gm[f"away_adj_{b}_allowed"]
    aexp = gm[f"away_adj_{b}"] + gm[f"home_adj_{b}_allowed"]
    gm[f"net_{b}"] = hexp - aexp; gm[f"sum_{b}"] = hexp + aexp
    nets.append(f"net_{b}"); sums.append(f"sum_{b}")

print("\n-- SIDES (target margin), gate>=4, grade @ open --")
E.grade_sides(E.walk(gm, FEATS, "actual_margin"), label="BASE")
E.grade_sides(E.walk(gm, FEATS + nets, "actual_margin"), label="BASE+nets")
print("\n-- TOTALS (target total), gate>=3, grade @ open --")
E.grade_totals(E.walk(gm, FEATS, "actual_total"), label="BASE")
E.grade_totals(E.walk(gm, FEATS + sums, "actual_total"), label="BASE+sums")
E.grade_totals(E.walk(gm, FEATS + nets + sums, "actual_total"), label="BASE+nets+sums")
