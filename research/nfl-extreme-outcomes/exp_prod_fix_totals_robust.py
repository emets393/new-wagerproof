#!/usr/bin/env python3
"""Robustness for totals D2 (b15 + true season-to-date sums): placebo, bootstrap vs A, K sensitivity,
vs CLOSE, 2022 fold with open totals rebuilt from odds_hist. b15 alone at the 3-7 HC band and >=2."""
import io, contextlib, os, sys, warnings, numpy as np, pandas as pd
warnings.filterwarnings("ignore")
src = open("exp_prod_fix_totals.py").read().split("od = pd.read_parquet(os.path.join(DATA")[0]
ns = {}; exec(compile(src, "ft", "exec"), ns)
b15_src, MA0, TRUE_SUM, m0, AB, TC, DATA = ns["b15"], ns["MA"], ns["TRUE_SUM"], ns["m0"], ns["AB"], ns["TC"], ns["DATA"]
od = pd.read_parquet(os.path.join(DATA, "odds_consensus.parquet"))[["season", "home_ab", "away_ab", "open_total", "close_total"]]
C2A = {"Arizona":"ARI","Atlanta":"ATL","Baltimore":"BAL","Buffalo":"BUF","Carolina":"CAR","Chicago":"CHI","Cincinnati":"CIN","Cleveland":"CLE","Dallas":"DAL","Denver":"DEN","Detroit":"DET","Green Bay":"GB","Houston":"HOU","Indianapolis":"IND","Jacksonville":"JAX","Kansas City":"KC","LA Rams":"LA","LA Chargers":"LAC","Las Vegas":"LV","Miami":"MIA","Minnesota":"MIN","New England":"NE","New Orleans":"NO","NY Giants":"NYG","NY Jets":"NYJ","Philadelphia":"PHI","Pittsburgh":"PIT","Seattle":"SEA","San Francisco":"SF","Tampa Bay":"TB","Tennessee":"TEN","Washington":"WAS"}
h = pd.read_parquet(os.path.join(DATA, "odds_hist.parquet"), columns=["season", "snap_ts", "home_team", "away_team", "book", "total_point"]); h = h[h.season == 2022]
h["home_ab"] = h.home_team.map(C2A).replace(AB); h["away_ab"] = h.away_team.map(C2A).replace(AB)
h = h.dropna(subset=["home_ab", "away_ab", "total_point"]).sort_values("snap_ts").drop_duplicates(["season", "home_ab", "away_ab", "book"], keep="first")
O22 = h.groupby(["season", "home_ab", "away_ab"]).total_point.median().rename("open_total").reset_index(); O22["open_total"] = np.round(O22.open_total * 2) / 2; O22["close_total"] = np.nan
OD = pd.concat([O22, od])
def make_ma(path, shuffle=False, seed=0):
    T = pd.read_parquet(path); T["team"] = T.team.replace(AB); m = m0.copy()
    for side in ("home", "away"):
        t = T.rename(columns={"team": f"{side}_ab", **{k: f"{side}_{v}" for k, v in TC.items()}})
        m = m.merge(t[[f"{side}_ab", "season", "week"] + [f"{side}_{v}" for v in TC.values()]], on=[f"{side}_ab", "season", "week"], how="left")
    for v in ("pass", "rush", "ppd", "proe"): m[f"true_off_{v}_sum"] = m[f"home_true_off_{v}"] + m[f"away_true_off_{v}"]
    for v in ("pass", "rush", "ppd"): m[f"true_def_{v}_sum"] = m[f"home_true_def_{v}"] + m[f"away_true_def_{v}"]
    if shuffle:
        rng = np.random.default_rng(seed)
        for s in m.season.unique():
            idx = m.index[m.season == s]; m.loc[idx, TRUE_SUM] = m.loc[rng.permutation(idx), TRUE_SUM].values
    return m
def run(MA, extra, years=(2023, 2024, 2025)):
    ns["MA"] = MA; R = pd.concat([ns["b15"](y, extra) for y in years]).merge(OD, on=["season", "home_ab", "away_ab"], how="left")
    R = R.merge(m0[["season", "week", "home_ab", "away_ab", "home_score", "away_score"]], on=["season", "week", "home_ab", "away_ab"]); R["act"] = R.home_score + R.away_score; R["e"] = R.pt - R.open_total; return R
def grade(R, lo=3, hi=7, line="open_total"):
    R = R.dropna(subset=[line]).copy(); R["e2"] = R.pt - R[line]; d = R[(R.e2.abs() >= lo) & (R.e2.abs() <= hi) & (R.act != R[line])]
    w = np.where(d.e2 > 0, d.act > d[line], d.act < d[line]); return w.mean(), len(d), d.assign(won=w)
def line(lab, R):
    p, n, _ = grade(R); p2, n2, _ = grade(R, 2, 99); pc, nc, _ = grade(R, 3, 7, "close_total")
    print(f"  {lab:26s} 3-7: {100*p:5.1f}% n={n:3d} ROI {100*(p*0.909-(1-p)):+5.1f}% | >=2: {100*p2:5.1f}% n={n2:3d} | vs close 3-7: {100*pc:5.1f}% n={nc}  by yr " + "/".join(f"{100*grade(R[R.season==s])[0]:.0f}" for s in sorted(R.season.unique())))
print("=" * 110); print("TOTALS b15 — A vs D2, K sensitivity, placebo, vs close, 2022 fold"); print("=" * 110)
RA = run(MA0, ()); line("A locked", RA)
RES = {}
for K, path in ((2, "data/team_week_seasonal_k2.parquet"), (4, "data/team_week_seasonal.parquet"), (8, "data/team_week_seasonal_k8.parquet"), (16, "data/team_week_seasonal_k16.parquet")):
    R = run(make_ma(path), TRUE_SUM); RES[K] = R; line(f"D2 true sums K={K}", R)
pl = [grade(run(make_ma("data/team_week_seasonal.parquet", True, sd), TRUE_SUM))[0] for sd in range(5)]
print(f"  PLACEBO (shuffled true sums, 5 draws) 3-7: {', '.join(f'{100*p:.1f}' for p in pl)}  mean {100*np.mean(pl):.1f}%")
RA22 = run(MA0, (), (2022,)); RD22 = run(make_ma("data/team_week_seasonal.parquet"), TRUE_SUM, (2022,))
print(f"  2022 fold: A {100*grade(RA22)[0]:.1f}% n={grade(RA22)[1]}  D2 {100*grade(RD22)[0]:.1f}% n={grade(RD22)[1]}   (>=2: A {100*grade(RA22,2,99)[0]:.1f}  D2 {100*grade(RD22,2,99)[0]:.1f})")
_, _, dA = grade(RA); _, _, dD = grade(RES[4]); key = ["season", "week", "home_ab", "away_ab"]
j = dA[key + ["won"]].merge(dD[key + ["won"]], on=key, how="outer", suffixes=("_A", "_D")); rng = np.random.default_rng(0)
diffs = np.array([(lambda b: b.won_D.mean() - b.won_A.mean())(j.sample(len(j), replace=True)) for _ in range(2000)])
print(f"  bootstrap D2−A (3-7 band, union of plays): {100*(j.won_D.mean()-j.won_A.mean()):+.1f} pts  95% CI [{100*np.percentile(diffs,2.5):+.1f}, {100*np.percentile(diffs,97.5):+.1f}]  P(<=0) {np.mean(diffs<=0):.3f}")
