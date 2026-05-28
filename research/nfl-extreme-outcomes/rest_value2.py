"""
(1) Clean check of the only significant rest 'edge' coefficient — rest config vs TOTALS,
    by interpretable buckets, per season (the OLS was collinear).
(2) Proof-of-concept of the 'build our own line from feature point-values' approach:
    our_margin = HFA + b_pr*pr_diff + b_rest*rest_diff -> compare to the market spread,
    and test whether our-line-minus-market divergences beat the market ATS.
"""
import os, sys
import numpy as np
import pandas as pd
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from stats_helpers import wilson_ci, bet_summary, fmt
DATA = os.path.join(os.path.dirname(os.path.abspath(__file__)), "data")
m = pd.read_parquet(os.path.join(DATA, "master.parquet"))
L = print
m["rest_diff"] = m["home_rest"] - m["away_rest"]
m["abs_rest"] = m["rest_diff"].abs()
m["pr_diff"] = m["home_predictive_pr"] - m["away_predictive_pr"]
m["over_win"] = np.where(m["total_diff"] > 0, 1.0, np.where(m["total_diff"] < 0, 0.0, np.nan))
m["ats_home"] = np.where(m["spread_diff"] > 0, 1.0, np.where(m["spread_diff"] < 0, 0.0, np.nan))


def tot_bucket(label, mask):
    s = m[mask]; n = len(s)
    over = (s["total_diff"] > 0).mean(); k = int((s["total_diff"] > 0).sum())
    lo, hi = wilson_ci(k, n)
    L(f"  {label:34s} n={n:4d} over%={over*100:5.1f} CI[{lo*100:4.1f},{hi*100:4.1f}] "
      f"mean_total_diff={s['total_diff'].mean():+5.2f}")


L("="*88); L("REST CONFIG vs TOTALS (clean buckets — the only significant edge coef)"); L("="*88)
tot_bucket("baseline (all games)", m["week"] > 0)
tot_bucket("either team off bye (rest>=13)", (m["home_rest"] >= 13) | (m["away_rest"] >= 13))
tot_bucket("both teams normal (rest=7)", (m["home_rest"] == 7) & (m["away_rest"] == 7))
tot_bucket("both teams short (rest<=5)", (m["home_rest"] <= 5) & (m["away_rest"] <= 5))
tot_bucket("big rest mismatch (|diff|>=6)", m["abs_rest"] >= 6)
tot_bucket("Thursday game", m["is_thu"] == 1)

L("\n  off-bye totals UNDER, per season (mean_total_diff was negative-ish?):")
sub = m[(m["home_rest"] >= 13) | (m["away_rest"] >= 13)]
for s in sorted(sub["season"].unique()):
    ss = sub[sub["season"] == s]; oc = (ss["total_diff"] < 0)  # under
    k = int(oc.sum()); n = int(ss["over_win"].isin([0, 1]).sum())
    # under wins:
    uw = (ss["total_diff"] < 0).sum(); nn = int((ss["total_diff"] != 0).sum())
    L("    " + fmt(bet_summary(int(uw), nn, str(int(s)))) + " (betting UNDER off-bye games)")
uw = int((sub["total_diff"] < 0).sum()); nn = int((sub["total_diff"] != 0).sum())
L("    " + fmt(bet_summary(uw, nn, "ALL")) + " (betting UNDER off-bye games)")

# ------------------------------------------------------------------
L("\n"+"="*88); L("PROOF-OF-CONCEPT — build our own line from feature point-values"); L("="*88)
L("  our_margin = HFA + 0.88*pr_diff + 0.14*rest_diff   (coefs from the OLS above)")
HFA, B_PR, B_REST = 1.58, 0.88, 0.14
m["our_margin"] = HFA + B_PR * m["pr_diff"] + B_REST * m["rest_diff"]
m["mkt_margin"] = -m["home_spread"]
d = m.dropna(subset=["our_margin", "mkt_margin"])
L(f"  corr(our_margin, market) = {np.corrcoef(d['our_margin'], d['mkt_margin'])[0,1]:.3f}; "
  f"mean|our-market| = {(d['our_margin']-d['mkt_margin']).abs().mean():.2f} pts")
L(f"  corr(our_margin, actual) = {np.corrcoef(d['our_margin'], d['actual_margin'])[0,1]:.3f}; "
  f"corr(market, actual) = {np.corrcoef(d['mkt_margin'], d['actual_margin'])[0,1]:.3f}")
L("  -> if our line ~ market and predicts no better, the features are already in the price.\n")

# when OUR line disagrees with market by >=2 pts, bet our side ATS — does it beat the market?
m["our_edge"] = m["our_margin"] - m["mkt_margin"]   # >0: we like home more than market
for thr in [1.5, 2.5, 3.5]:
    home_side = m["our_edge"] >= thr
    away_side = m["our_edge"] <= -thr
    won = pd.concat([m.loc[home_side, "ats_home"], 1 - m.loc[away_side, "ats_home"]]).dropna()
    k = int((won == 1).sum()); n = int(won.isin([0, 1]).sum())
    L("  our line disagrees by >=%.1f pts -> bet our side: %s" % (thr, fmt(bet_summary(k, n, f"thr{thr}"))))
L("\n  (This is the 'our model vs market' test. Brief #1 showed the PR piece alone loses ATS;")
L("   here we confirm whether adding a transparent rest term changes that.)")
