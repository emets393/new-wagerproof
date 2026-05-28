"""
Final fair checks:
(a) pressure x time-to-throw -> spread-miss VARIANCE (the single best raw hit) — per-season.
(b) ML market: does a walk-forward matchup win-prob model beat real closing ML prices (2023-25)?
(c) matchup signal inside the PR-vs-spread DIVERGENCE subset (where the line may be 'wrong').
"""
import os, sys, warnings
import numpy as np
import pandas as pd
warnings.filterwarnings("ignore")
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from stats_helpers import wilson_ci, bet_summary, fmt, ml_roi
from scipy import stats
from sklearn.ensemble import HistGradientBoostingClassifier

DATA = os.path.join(os.path.dirname(os.path.abspath(__file__)), "data")
m = pd.read_parquet(os.path.join(DATA, "matchup_arch.parquet"))
od = pd.read_parquet(os.path.join(DATA, "odds_consensus.parquet"))
L = print
W = m[m["week"] >= 4].copy()

L("="*90); L("(a) PRESSURE x TIME-TO-THROW -> spread-miss variance (best raw hit, FDR-failed)"); L("="*90)
F = m[(m["week"] >= 4) & m["away_ttt_x_homepressure"].notna()].copy()
F["blowup"] = (F["spread_miss"] >= 21).astype(int)
# combine the two pressure-vs-slow-QB interactions into one "trenches mismatch" score
for c in ["away_ttt_x_homepressure", "home_proe_x_awaypressure"]:
    F[c + "_z"] = (F[c] - F[c].mean()) / F[c].std()
F["trench_var"] = F["away_ttt_x_homepressure_z"] - F["home_proe_x_awaypressure_z"]
L(f"  corr(trench_var, spread_miss) = {stats.pearsonr(F['trench_var'], F['spread_miss'])[0]:+.3f} (n={len(F)})")
L("  blow-up rate by trench_var quintile:")
F["q"] = pd.qcut(F["trench_var"], 5, labels=False)
for qi in range(5):
    s = F[F["q"] == qi]
    lo, hi = wilson_ci(int(s["blowup"].sum()), len(s))
    L(f"    Q{qi+1}: n={len(s)} blowup%={s['blowup'].mean()*100:4.1f} CI[{lo*100:.1f},{hi*100:.1f}] mean|miss|={s['spread_miss'].mean():.2f}")
L("  per-season top-quintile blow-up rate (is it stable?):")
for yr in sorted(F["season"].unique()):
    s = F[(F["season"] == yr) & (F["q"] == 4)]
    if len(s):
        L(f"    {int(yr)}: n={len(s)} blowup%={s['blowup'].mean()*100:.0f}%")

L("\n"+"="*90); L("(b) ML MARKET — matchup win-prob model vs REAL closing prices (2023-25)"); L("="*90)
key = ["season", "home_ab", "away_ab"]
W2 = W.merge(od[key + ["close_ml_home", "close_ml_away"]], on=key, how="inner")
# vig sanity + garbage-odds filter (Brief #1 guardrail)
def imp(o):
    return np.where(o < 0, -o / (-o + 100), 100 / (o + 100))
W2 = W2[(W2["close_ml_home"].abs().between(100, 2000)) & (W2["close_ml_away"].abs().between(100, 2000))]
vig = imp(W2["close_ml_home"]) + imp(W2["close_ml_away"])
W2 = W2[(vig >= 1.00) & (vig <= 1.12)]
L(f"  games with clean ML prices (2023-25, week>=4): {len(W2)}")
NETS = [c for c in W2.columns if c.startswith(("hnet_", "anet_", "sep_", "env_", "exp_"))]
MF = NETS + ["ou_vegas_line", "home_spread", "abs_spread", "home_fav", "pace_sum", "mismatch_mag"]
MF = [f for f in MF if f in W2.columns]
for f in MF:
    W2[f] = pd.to_numeric(W2[f], errors="coerce")
W2["home_win"] = (W2["actual_margin"] > 0).astype(int)
picks = []
for S in [2024, 2025]:
    tr = m[(m["season"] < S) & (m["week"] >= 4)].copy()
    tr["home_win"] = (tr["actual_margin"] > 0).astype(int)
    for f in MF:
        tr[f] = pd.to_numeric(tr[f], errors="coerce")
    te = W2[W2["season"] == S]
    if len(te) < 30:
        continue
    clf = HistGradientBoostingClassifier(max_depth=3, learning_rate=0.05, max_iter=300,
                                         l2_regularization=1.0, min_samples_leaf=40, random_state=0)
    clf.fit(tr[MF], tr["home_win"])
    p = clf.predict_proba(te[MF])[:, 1]
    t = te.copy(); t["p_home"] = p
    picks.append(t)
if picks:
    pk = pd.concat(picks)
    # bet home when model prob > market-implied home prob (edge); else bet away when model<implied_away
    pk["imp_home"] = imp(pk["close_ml_home"]); pk["imp_away"] = imp(pk["close_ml_away"])
    pk["edge_home"] = pk["p_home"] - pk["imp_home"] / (pk["imp_home"] + pk["imp_away"])  # devigged
    for thr in [0.0, 0.03, 0.06]:
        bet_home = pk[pk["edge_home"] >= thr].copy()
        bet_away = pk[pk["edge_home"] <= -thr].copy()
        bet_home["won"] = bet_home["home_win"]; bet_home["price"] = bet_home["close_ml_home"]
        bet_away["won"] = 1 - bet_away["home_win"]; bet_away["price"] = bet_away["close_ml_away"]
        allb = pd.concat([bet_home, bet_away])
        r = ml_roi(allb, "won", "price")
        L(f"  model-edge>={thr:.2f}: n={r['n']} hit={r.get('hit',0):.3f} roi={r.get('roi',0)*100:+.1f}% "
          f"units={r.get('units',0):+.1f} (impl_be~{r.get('avg_implied_be',0):.3f})")

L("\n"+"="*90); L("(c) Matchup signal INSIDE the PR-vs-spread divergence subset"); L("="*90)
m["pr_diff"] = m["home_predictive_pr"] - m["away_predictive_pr"]
m["mkt_margin"] = -m["home_spread"]
m["pr_margin"] = m["pr_diff"] + m["actual_margin"].mean() * 0  # HFA folded below
HFA = 1.73
m["pr_margin"] = m["pr_diff"] + HFA
m["diverge"] = m["mkt_margin"] - m["pr_margin"]
D = m[(m["week"] >= 4) & (m["diverge"].abs() >= 3)].copy()
D["home_cover"] = pd.to_numeric(D["home_cover"], errors="coerce")
L(f"  divergence subset (|line-PR|>=3, wk>=4): n={len(D)}")
# does exp_margin_ppd (matchup) point to the side that covers, within this subset?
for feat in ["exp_margin_ppd", "sep_ppd", "sep_ed_pass"]:
    d = D[[feat, "home_cover"]].dropna()
    if len(d) < 100:
        continue
    # bet home when feat>median home-favoring; measure cover
    hi = d[d[feat] >= d[feat].median()]["home_cover"]
    lo = d[d[feat] < d[feat].median()]["home_cover"]
    L(f"    {feat:16s}: home-cover% when matchup favors home={hi.mean()*100:.1f} (n={len(hi)}) "
      f"vs favors away={lo.mean()*100:.1f} (n={len(lo)})")
