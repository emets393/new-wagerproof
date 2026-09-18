#!/usr/bin/env python3
"""Follow-ups: (a) 2022 as an extra out-of-sample fold using openers rebuilt from odds_hist (the
consensus file starts 2023); (b) K-ENSEMBLE arm — average the true nets over K=2/4/8 so the result
does not hinge on one seeding constant; (c) the per-K numbers pooled so the honest expected lift is
the average across K, not the best K."""
import io, contextlib, importlib.util as iu, sys, warnings
import numpy as np, pandas as pd
warnings.filterwarnings("ignore")
sys.argv = [sys.argv[0]]
spec = iu.spec_from_file_location("rb", "exp_prod_fix_s2d_robust.py")
src = open("exp_prod_fix_s2d_robust.py").read().split('m = frame("data/team_week_seasonal.parquet")')[0]
ns = {}; exec(compile(src, "rb", "exec"), ns)
frame, run, grade, BASE, TRUE, m0, AB, S, od = ns["frame"], ns["run"], ns["grade"], ns["BASE"], ns["TRUE"], ns["m0"], ns["AB"], ns["S"], ns["od"]
# openers 2021-22 from the raw snapshots (build_odds.py rule)
C2A = {"Arizona":"ARI","Atlanta":"ATL","Baltimore":"BAL","Buffalo":"BUF","Carolina":"CAR","Chicago":"CHI","Cincinnati":"CIN","Cleveland":"CLE","Dallas":"DAL","Denver":"DEN","Detroit":"DET","Green Bay":"GB","Houston":"HOU","Indianapolis":"IND","Jacksonville":"JAX","Kansas City":"KC","LA Rams":"LA","LA Chargers":"LAC","Las Vegas":"LV","Miami":"MIA","Minnesota":"MIN","New England":"NE","New Orleans":"NO","NY Giants":"NYG","NY Jets":"NYJ","Philadelphia":"PHI","Pittsburgh":"PIT","Seattle":"SEA","San Francisco":"SF","Tampa Bay":"TB","Tennessee":"TEN","Washington":"WAS"}
h = pd.read_parquet("data/odds_hist.parquet", columns=["season", "snap_ts", "home_team", "away_team", "book", "spread_home"]); h = h[h.season.isin([2021, 2022])]
h["home_ab"] = h.home_team.map(C2A).replace(AB); h["away_ab"] = h.away_team.map(C2A).replace(AB)
h = h.dropna(subset=["home_ab", "away_ab", "spread_home"]).sort_values("snap_ts").drop_duplicates(["season", "home_ab", "away_ab", "book"], keep="first")
O21 = h.groupby(["season", "home_ab", "away_ab"]).spread_home.median().rename("open_spread").reset_index(); O21["open_spread"] = np.round(O21.open_spread * 2) / 2
print(f"2021-22 openers rebuilt: {len(O21)}")
def frame22(path):
    m = frame(path); m = m.drop(columns=["open_spread", "close_spread"]).merge(pd.concat([O21, od[["season", "home_ab", "away_ab", "open_spread"]]]), on=["season", "home_ab", "away_ab"], how="left")
    m["close_spread"] = m.home_spread; return m
print("\n" + "=" * 100); print("(a) 2022 as extra fold (train 2018-21), conf .03 / .06 at the opener"); print("=" * 100)
m = frame22("data/team_week_seasonal.parquet")
Ra = run(m, BASE, tests=(2022,)); Rd = run(m, BASE + TRUE, tests=(2022,))
print(f"  A production   {100*grade(Ra)[0]:5.1f}% n={grade(Ra)[1]}   .06 {100*grade(Ra,0.06)[0]:5.1f}% n={grade(Ra,0.06)[1]}")
print(f"  D2 true nets   {100*grade(Rd)[0]:5.1f}% n={grade(Rd)[1]}   .06 {100*grade(Rd,0.06)[0]:5.1f}% n={grade(Rd,0.06)[1]}")
print("\n" + "=" * 100); print("(b) K-ENSEMBLE — true nets averaged over K=2/4/8, and (c) pooled 2022-25 view"); print("=" * 100)
ms = {K: frame22(p) for K, p in ((2, "data/team_week_seasonal_k2.parquet"), (4, "data/team_week_seasonal.parquet"), (8, "data/team_week_seasonal_k8.parquet"))}
me = ms[4].copy()
for c in TRUE: me[c] = np.mean([ms[K][c].values for K in ms], axis=0)
TESTS = (2022, 2023, 2024, 2025)
RA = run(me, BASE, tests=TESTS); RE = run(me, BASE + TRUE, tests=TESTS); R4 = run(ms[4], BASE + TRUE, tests=TESTS)
for lab, R in (("A production", RA), ("D2 K=4", R4), ("D2 K-ensemble", RE)):
    p, n, _ = grade(R); p6, n6, _ = grade(R, 0.06)
    print(f"  {lab:14s} 2022-25: {100*p:5.1f}% n={n}  ROI {100*(p*0.909-(1-p)):+5.1f}%  | .06 {100*p6:5.1f}% n={n6} ROI {100*(p6*0.909-(1-p6)):+5.1f}%  by yr " + "/".join(f"{100*grade(R[R.season==s])[0]:.0f}" for s in TESTS))
_, _, dA = grade(RA); _, _, dE = grade(RE); key = ["season", "home_ab", "away_ab"]
j = dA[key + ["won"]].merge(dE[key + ["won"]], on=key, how="outer", suffixes=("_A", "_E")); rng = np.random.default_rng(0)
diffs = np.array([(lambda b: b.won_E.mean() - b.won_A.mean())(j.sample(len(j), replace=True)) for _ in range(2000)])
print(f"  K-ensemble − A over 2022-25: {100*(j.won_E.mean()-j.won_A.mean()):+.1f} pts  95% CI [{100*np.percentile(diffs,2.5):+.1f}, {100*np.percentile(diffs,97.5):+.1f}]  P(<=0) {np.mean(diffs<=0):.3f}")
