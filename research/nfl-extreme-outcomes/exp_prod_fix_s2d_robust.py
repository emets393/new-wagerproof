#!/usr/bin/env python3
"""ROBUSTNESS for the one positive result of the day: production sides + TRUE season-to-date nets
(D2: 55.9% vs 53.0%, 2023-25). Before anyone believes it:
  1. leak screen on the 4 true nets (2021-22): |corr vs result| must not exceed |corr vs line|
  2. K sensitivity: seasonal nets rebuilt at K = 2, 4, 8, 16 prior-season games
  3. extra fold: 2022 as a test year (train 2018-21)
  4. placebo: true nets shuffled across games within season -> must fall back to A
  5. vs CLOSE: does the lift survive at the closing line (is the market pricing it by kickoff?)
  6. bootstrap the paired A-vs-D2 difference at conf .03 (2000 resamples of games)
  7. flips: games where D2 disagrees with A — who wins?"""
import io, contextlib, importlib.util as iu, sys, warnings
import numpy as np, pandas as pd
warnings.filterwarnings("ignore")
from sklearn.ensemble import HistGradientBoostingClassifier
sys.argv = [sys.argv[0]]
spec = iu.spec_from_file_location("fh", "forecast_harness.py"); FH = iu.module_from_spec(spec)
with contextlib.redirect_stdout(io.StringIO()): spec.loader.exec_module(FH); m0, BASE = FH.build()
AB = {"LA": "LAR", "JAX": "JAC", "WAS": "WSH", "LV": "LVR", "ARI": "ARZ", "BAL": "BLT", "CLE": "CLV", "HOU": "HST"}
ours = set(m0.home_ab.unique()); AB = {k: v for k, v in AB.items() if v in ours and k not in ours}
S = {"pass": ("off_pass_epa_neutral_s2d", "def_pass_epa_allowed_neutral_s2d"), "rush": ("off_rush_epa_neutral_s2d", "def_rush_epa_allowed_neutral_s2d"),
     "ppd": ("off_pts_per_drive_s2d", "def_pts_per_drive_allowed_s2d"), "proe": ("off_proe_s2d", None)}
od = pd.read_parquet("data/odds_consensus.parquet")[["season", "home_ab", "away_ab", "open_spread", "close_spread"]]
TRUE = [f"true_net_{k}" for k in S]

def frame(path, shuffle=False, seed=0):
    m = m0.copy(); T = pd.read_parquet(path); T["team"] = T.team.replace(AB)
    th = T.rename(columns={"team": "home_ab", **{c: "h_" + c for c in T.columns if c.endswith("_s2d")}})
    ta = T.rename(columns={"team": "away_ab", **{c: "a_" + c for c in T.columns if c.endswith("_s2d")}})
    m = m.merge(th[["home_ab", "season", "week"] + [c for c in th.columns if c.startswith("h_")]], on=["home_ab", "season", "week"], how="left")
    m = m.merge(ta[["away_ab", "season", "week"] + [c for c in ta.columns if c.startswith("a_")]], on=["away_ab", "season", "week"], how="left")
    for k, (o, d) in S.items():
        m[f"true_net_{k}"] = ((m[f"h_{o}"] + m[f"a_{d}"]) - (m[f"a_{o}"] + m[f"h_{d}"])) if d else (m[f"h_{o}"] - m[f"a_{o}"])
    if shuffle:
        rng = np.random.default_rng(seed)
        for s in m.season.unique():
            idx = m.index[m.season == s]; m.loc[idx, TRUE] = m.loc[rng.permutation(idx), TRUE].values
    return m.merge(od, on=["season", "home_ab", "away_ab"], how="left")

def run(m, feats, tests=(2023, 2024, 2025), seeds=5):
    rows = []
    for ssn in tests:
        tr = m[(m.season < ssn) & (m.week >= 4)].dropna(subset=["home_cover"]); te = m[m.season == ssn].copy(); ps = []
        for seed in range(seeds):
            clf = HistGradientBoostingClassifier(max_depth=3, learning_rate=0.05, max_iter=300, l2_regularization=2.0, min_samples_leaf=40, random_state=seed).fit(tr[feats], tr.home_cover)
            ps.append(clf.predict_proba(te[feats])[:, 1])
        te["ph"] = np.mean(ps, axis=0); rows.append(te)
    return pd.concat(rows)

def grade(R, conf=0.03, line="open_spread"):
    d = R.dropna(subset=[line]); d = d[(d.ph - 0.5).abs() >= conf]; d = d[(d.actual_margin + d[line]) != 0]
    won = np.where(d.ph > 0.5, d.actual_margin + d[line] > 0, d.actual_margin + d[line] < 0)
    return won.mean(), len(d), d.assign(won=won)

m = frame("data/team_week_seasonal.parquet")
print("=" * 100); print("1) LEAK SCREEN on the true nets (2021-22): |corr vs home spread| vs |corr vs actual margin|"); print("=" * 100)
s = m[m.season.isin([2021, 2022])]
for c in TRUE:
    x = s[[c, "home_spread", "actual_margin"]].dropna(); cl, cr = abs(x[c].corr(-x.home_spread)), abs(x[c].corr(x.actual_margin))
    print(f"  {c:16s} line {cl:.3f}  result {cr:.3f}  {'⚠ DROP' if cr > cl * 1.25 and cr > 0.05 else 'ok'}")

print("\n" + "=" * 100); print("2) K SENSITIVITY + 3) 2022 FOLD + 4) PLACEBO + 5) vs CLOSE     (conf .03 / .06 at the opener)"); print("=" * 100)
RA = run(m, BASE); pa, na, _ = grade(RA); pa6, na6, _ = grade(RA, 0.06); pac, _, _ = grade(RA, 0.03, "close_spread")
print(f"  A production                 {100*pa:5.1f}% n={na}  | .06 {100*pa6:5.1f}% n={na6}  | vs close {100*pac:5.1f}%")
RES = {}
for K, path in ((2, "data/team_week_seasonal_k2.parquet"), (4, "data/team_week_seasonal.parquet"), (8, "data/team_week_seasonal_k8.parquet"), (16, "data/team_week_seasonal_k16.parquet")):
    mk = frame(path); R = run(mk, BASE + TRUE); RES[K] = R; p, n, _ = grade(R); p6, n6, _ = grade(R, 0.06); pc, _, _ = grade(R, 0.03, "close_spread")
    print(f"  D2 true nets K={K:2d}            {100*p:5.1f}% n={n}  | .06 {100*p6:5.1f}% n={n6}  | vs close {100*pc:5.1f}%   by yr " + "/".join(f"{100*grade(R[R.season==s])[0]:.0f}" for s in (2023, 2024, 2025)))
R22a = run(m, BASE, tests=(2022,)); R22 = run(m, BASE + TRUE, tests=(2022,))
print(f"  2022 fold (train 2018-21):   A {100*grade(R22a)[0]:5.1f}% n={grade(R22a)[1]}   D2 {100*grade(R22)[0]:5.1f}% n={grade(R22)[1]}   (.06: A {100*grade(R22a,0.06)[0]:.1f}%  D2 {100*grade(R22,0.06)[0]:.1f}%)")
pl = []
for sd in range(5):
    Rp = run(frame("data/team_week_seasonal.parquet", shuffle=True, seed=sd), BASE + TRUE, seeds=2); pl.append(grade(Rp)[0])
print(f"  PLACEBO (true nets shuffled within season, 5 draws): {', '.join(f'{100*p:.1f}' for p in pl)}  mean {100*np.mean(pl):.1f}%")

print("\n" + "=" * 100); print("6) BOOTSTRAP paired difference A vs D2 (K=4) at conf .03, and 7) FLIPS"); print("=" * 100)
R = RES[4]; _, _, dA = grade(RA); _, _, dD = grade(R)
key = ["season", "home_ab", "away_ab"]
j = dA[key + ["won"]].merge(dD[key + ["won"]], on=key, how="outer", suffixes=("_A", "_D"))
rng = np.random.default_rng(0); diffs = []
for _ in range(2000):
    b = j.sample(len(j), replace=True); diffs.append(b.won_D.mean() - b.won_A.mean())
diffs = np.array(diffs); print(f"  D2 − A hit-rate difference: {100*(j.won_D.mean()-j.won_A.mean()):+.1f} pts   95% CI [{100*np.percentile(diffs,2.5):+.1f}, {100*np.percentile(diffs,97.5):+.1f}]   P(diff<=0) = {np.mean(diffs<=0):.3f}")
jj = RA[key + ["ph", "actual_margin", "open_spread"]].merge(R[key + ["ph"]], on=key, suffixes=("_A", "_D")).dropna(subset=["open_spread"])
jj["cov"] = jj.actual_margin + jj.open_spread; f = jj[(np.sign(jj.ph_A - .5) != np.sign(jj.ph_D - .5)) & ((jj.ph_D - .5).abs() >= .03) & (jj["cov"] != 0)]
print(f"  games where D2 picks the OTHER side from A (D2 conf>=.03): {len(f)} — D2's side won {100*np.mean(np.where(f.ph_D > .5, f['cov'] > 0, f['cov'] < 0)):.1f}%")
print(f"  correlation of probabilities A vs D2: {np.corrcoef(jj.ph_A, jj.ph_D)[0,1]:.3f}")
