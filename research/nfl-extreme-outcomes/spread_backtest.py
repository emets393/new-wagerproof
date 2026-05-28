"""
SPREAD BACKTEST — explicit ROI of betting the fair-value model's spread side.
Walk-forward (train seasons<Y, test Y), leak-safe. Bet rule: when our fair line disagrees with the
posted line by >= threshold, bet OUR side at the posted number, priced -110. Report n, win%, ROI,
units, 95% CI, per season; across thresholds and subsets (all / non-abstain / abstain).
Breakeven at -110 = 52.38%.  1 unit risked per bet (loss = -1.0, win = +0.909).
"""
import os, sys, warnings
import numpy as np, pandas as pd
warnings.filterwarnings("ignore")
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from stats_helpers import wilson_ci
from sklearn.linear_model import Ridge
from sklearn.preprocessing import StandardScaler
DATA = os.path.join(os.path.dirname(os.path.abspath(__file__)), "data")
L = print
m = pd.read_parquet(os.path.join(DATA, "matchup.parquet"))
m["mkt_margin"] = -m["home_spread"]
m["pr_diff"] = m["home_predictive_pr"] - m["away_predictive_pr"]
m["last5_diff"] = m["home_last5_pr"] - m["away_last5_pr"]
m["passer_diff"] = m["home_off_passer_rating_s2d"] - m["away_off_passer_rating_s2d"]
m["injury_diff"] = m["home_injury_severity"] - m["away_injury_severity"]
m["rest_diff"] = m["home_rest"] - m["away_rest"]
FEATS = ["pr_diff", "last5_diff", "passer_diff", "injury_diff", "rest_diff",
         "home_backup_qb", "away_backup_qb", "home_qb_out_or_doubtful", "away_qb_out_or_doubtful",
         "hnet_pass_epa", "anet_pass_epa", "hnet_rush_epa", "anet_rush_epa"]
for f in FEATS:
    m[f] = pd.to_numeric(m[f], errors="coerce")
W = m[m["week"] >= 4].copy()

# walk-forward fair margin (out-of-sample)
W["fair_margin"] = np.nan
for Y in range(2021, 2026):
    tr = W[W.season < Y].dropna(subset=["mkt_margin"]); te = W[W.season == Y].dropna(subset=["mkt_margin"])
    med = tr[FEATS].median(); sc = StandardScaler().fit(tr[FEATS].fillna(med).fillna(0))
    rg = Ridge(alpha=10).fit(sc.transform(tr[FEATS].fillna(med).fillna(0)), tr["mkt_margin"])
    W.loc[te.index, "fair_margin"] = rg.predict(sc.transform(te[FEATS].fillna(med).fillna(0)))
W = W.dropna(subset=["fair_margin"]).copy()
W["disc"] = W["fair_margin"] - W["mkt_margin"]                 # >0 we like home more than market
W["ats_home"] = np.where(W["spread_diff"] > 0, 1.0, np.where(W["spread_diff"] < 0, 0.0, np.nan))
W["blindspot"] = ((W["week"] >= 17) | (W["home_backup_qb"] == 1) | (W["away_backup_qb"] == 1) |
                  (W["home_qb_out_or_doubtful"] == 1) | (W["away_qb_out_or_doubtful"] == 1))


def backtest(sub, thr):
    s = sub[sub["disc"].abs() >= thr]
    bet_home = s["disc"] > 0
    won = np.where(bet_home, s["ats_home"], 1 - s["ats_home"])
    won = pd.Series(won, index=s.index).dropna()
    n = int(won.isin([0, 1]).sum()); k = int((won == 1).sum())
    if n == 0:
        return None
    units = k * (100/110) - (n - k) * 1.0
    roi = units / n
    lo, hi = wilson_ci(k, n)
    return dict(n=n, win=k/n, roi=roi, units=units, lo=lo, hi=hi)


def report(title, sub):
    L("\n" + "=" * 84); L(title); L("=" * 84)
    L(f"  {'thr':>4s} {'n':>5s} {'win%':>6s} {'ROI':>7s} {'units':>8s}  {'95% CI':>14s}  {'edge vs 52.4%':>13s}")
    for thr in [0, 1, 2, 3, 4]:
        r = backtest(sub, thr)
        if r:
            L(f"  {thr:>4d} {r['n']:>5d} {r['win']*100:>5.1f}% {r['roi']*100:>+6.1f}% {r['units']:>+8.1f}  "
              f"[{r['lo']*100:>4.1f},{r['hi']*100:>4.1f}]  {(r['win']-0.5238)*100:>+11.1f}pp")


report("ALL games — bet our side when |fair-market| >= thr (at -110)", W)
report("NON-ABSTAIN only (full strength, wk<=16)", W[~W["blindspot"]])
report("ABSTAIN games (blindspot: wk>=17 / backup-QB / QB-out)", W[W["blindspot"]])

# per-season at the most-used threshold (>=2) on ALL games
L("\n" + "=" * 84); L("PER-SEASON — bet our side, |disc|>=2, ALL games (at -110)"); L("=" * 84)
tot_u = 0; tot_n = 0
for Y in sorted(W.season.unique()):
    r = backtest(W[W.season == Y], 2)
    if r:
        tot_u += r["units"]; tot_n += r["n"]
        L(f"  {int(Y)}: n={r['n']:3d} win={r['win']*100:5.1f}% ROI={r['roi']*100:+6.1f}% units={r['units']:+6.1f}")
L(f"  ALL: n={tot_n} units={tot_u:+.1f}  ROI={tot_u/tot_n*100:+.1f}%")

# Benchmark: a pure coin-flip / always-home-favorite, to show the vig drag
L("\n" + "=" * 84); L("BENCHMARKS (context for the vig)"); L("=" * 84)
home = W.dropna(subset=["ats_home"])
k = int(home["ats_home"].sum()); n = len(home)
L(f"  Always bet HOME ATS:  n={n} win={k/n*100:.1f}% ROI={ (k*100/110-(n-k))/n*100:+.1f}%")
fav = W.dropna(subset=["ats_home"]); favbet = np.where(fav["mkt_margin"] > 0, fav["ats_home"], 1-fav["ats_home"])
k = int(favbet.sum()); n = len(favbet)
L(f"  Always bet FAVORITE:  n={n} win={k/n*100:.1f}% ROI={ (k*100/110-(n-k))/n*100:+.1f}%")
L(f"  (Note: a true 50% strategy returns -4.5% at -110 from vig alone; 52.38% = breakeven.)")
