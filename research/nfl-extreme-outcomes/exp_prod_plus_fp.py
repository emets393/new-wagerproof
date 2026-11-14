#!/usr/bin/env python3
"""THE TEST THAT SHOULD HAVE RUN FIRST (owner 2026-09-17): do the reliability-gated Fantasy Points
unit ratings improve the PRODUCTION sides model?  Same frame (forecast_harness.build), same
HistGBM + params, same walk-forward (train < season, week>=4), same bet rule (|p-.5|>=.03 at the
OPENER), same grading. Only difference: extra FP columns. Arms:
  A  BASE (locked b14 + matchup nets)                 <- production
  B  BASE + FP matchup NETS (offense unit − opponent's matching defense unit, home minus away)
  C  BASE + all FP units (home + away) + nets
FP values are entering-week, K=4 prior-season seeded (power_ratings.ENT), 2021+; earlier rows are
NaN and HistGBM handles that natively, so training history is unchanged."""
import io, contextlib, importlib.util as iu, os, sys, warnings
import numpy as np, pandas as pd
warnings.filterwarnings("ignore")
from sklearn.ensemble import HistGradientBoostingClassifier
sys.argv = [sys.argv[0]]
spec = iu.spec_from_file_location("fh", "forecast_harness.py"); FH = iu.module_from_spec(spec)
with contextlib.redirect_stdout(io.StringIO()): spec.loader.exec_module(FH)
with contextlib.redirect_stdout(io.StringIO()): m, BASE = FH.build()
spec2 = iu.spec_from_file_location("pr", "power_ratings.py"); M = iu.module_from_spec(spec2)
with contextlib.redirect_stdout(io.StringIO()): spec2.loader.exec_module(M)
ENT, UNITS, PAIRS = M.ENT.copy(), M.ALLU, M.PAIRS
# abbreviation bridge (production uses its own style)
ours = set(m.home_ab.unique()); theirs = set(ENT.__k.unique()); miss = theirs - ours
AB = {"LA": "LAR", "JAX": "JAC", "WAS": "WSH", "LV": "LVR", "ARI": "ARZ", "BAL": "BLT", "CLE": "CLV", "HOU": "HST"}
AB = {k: v for k, v in AB.items() if k in miss and v in ours}
ENT["__k"] = ENT.__k.replace(AB)
print(f"team keys: production {len(ours)} | FP {len(theirs)} | unmatched after bridge: {sorted(set(ENT.__k.unique()) - ours)}")
H = ENT.rename(columns={"__k": "home_ab", "__season": "season", "__week": "week", **{u: f"h_{u}" for u in UNITS}})
A = ENT.rename(columns={"__k": "away_ab", "__season": "season", "__week": "week", **{u: f"a_{u}" for u in UNITS}})
m = m.merge(H[["home_ab", "season", "week"] + [f"h_{u}" for u in UNITS]], on=["home_ab", "season", "week"], how="left")
m = m.merge(A[["away_ab", "season", "week"] + [f"a_{u}" for u in UNITS]], on=["away_ab", "season", "week"], how="left")
FPNET = []
for o, d in PAIRS:
    if f"h_{o}" in m.columns and f"a_{d}" in m.columns:
        m[f"fpnet_{o[2:]}"] = (m[f"h_{o}"] - m[f"a_{d}"]) - (m[f"a_{o}"] - m[f"h_{d}"]); FPNET.append(f"fpnet_{o[2:]}")
FPALL = [f"{s}_{u}" for s in ("h", "a") for u in UNITS if f"{s}_{u}" in m.columns]
cov = m[m.season >= 2023][FPNET].notna().mean().mean()
print(f"FP nets: {len(FPNET)}  FP unit cols: {len(FPALL)}  coverage on 2023-25 rows: {cov:.0%}")
od = pd.read_parquet("data/odds_consensus.parquet")[["season", "home_ab", "away_ab", "open_spread", "close_spread"]]
m = m.merge(od, on=["season", "home_ab", "away_ab"], how="left")
ARMS = {"A production BASE": BASE, "B BASE + FP nets": BASE + FPNET, "C BASE + all FP": BASE + FPNET + FPALL}
print("\n" + "=" * 112); print("SIDES — walk-forward 2023-25, HistGBM (production params), bet |p−.5|>=.03 at the OPENER; hit% / n / ROI@-110 | vs CLOSE"); print("=" * 112)
res = {}
for lab, feats in ARMS.items():
    rows = []
    for ssn in (2023, 2024, 2025):
        tr = m[(m.season < ssn) & (m.week >= 4)].dropna(subset=["home_cover"]); te = m[m.season == ssn].copy()
        for seed in (0, 1, 2):        # 3 seeds averaged so a lucky tree split can't decide the verdict
            clf = HistGradientBoostingClassifier(max_depth=3, learning_rate=0.05, max_iter=300, l2_regularization=2.0, min_samples_leaf=40, random_state=seed).fit(tr[feats], tr.home_cover)
            te[f"ph{seed}"] = clf.predict_proba(te[feats])[:, 1]
        te["ph"] = te[["ph0", "ph1", "ph2"]].mean(axis=1); rows.append(te)
    R = pd.concat(rows).dropna(subset=["open_spread"]); res[lab] = R
    out = f"  {lab:20s}"
    for conf in (0.03, 0.06):
        d = R[(R.ph - 0.5).abs() >= conf].copy(); d = d[(d.actual_margin + d.open_spread) != 0]
        won = np.where(d.ph > 0.5, d.actual_margin + d.open_spread > 0, d.actual_margin + d.open_spread < 0)
        dc = R[(R.ph - 0.5).abs() >= conf].copy(); dc = dc[(dc.actual_margin + dc.close_spread) != 0]
        wc = np.where(dc.ph > 0.5, dc.actual_margin + dc.close_spread > 0, dc.actual_margin + dc.close_spread < 0)
        out += f" | conf{conf:.2f}: {100*won.mean():5.1f}% n={len(d):3d} ROI {100*(won.mean()*0.909-(1-won.mean())):+5.1f}%  (close {100*wc.mean():4.1f}%)"
    d = R[(R.ph - 0.5).abs() >= 0.03]; d = d[(d.actual_margin + d.open_spread) != 0]
    won = np.where(d.ph > 0.5, d.actual_margin + d.open_spread > 0, d.actual_margin + d.open_spread < 0)
    out += "  by yr " + "/".join(f"{100*won[(d.season==s).values].mean():.0f}" for s in (2023, 2024, 2025))
    print(out)
# paired comparison: same games, do the FP arms flip picks, and do flips win?
A_, B_ = res["A production BASE"], res["B BASE + FP nets"]
j = A_[["season", "home_ab", "away_ab", "ph", "actual_margin", "open_spread"]].merge(B_[["season", "home_ab", "away_ab", "ph"]], on=["season", "home_ab", "away_ab"], suffixes=("_A", "_B"))
j["pickA"] = np.sign(j.ph_A - 0.5); j["pickB"] = np.sign(j.ph_B - 0.5); j["cov"] = j.actual_margin + j.open_spread
flip = j[(j.pickA != j.pickB) & ((j.ph_A - 0.5).abs() >= 0.03) & ((j.ph_B - 0.5).abs() >= 0.03) & (j["cov"] != 0)]
print(f"\n  games where A and B disagree at conf .03: {len(flip)} — B's side won {100*np.mean(np.where(flip.pickB > 0, flip['cov'] > 0, flip['cov'] < 0)):.1f}%")
print(f"  correlation of the two models' probabilities: {np.corrcoef(j.ph_A, j.ph_B)[0,1]:.3f}")
# feature importance proxy: permutation on the 2025 fold for arm B
tr = m[(m.season < 2025) & (m.week >= 4)].dropna(subset=["home_cover"]); te = m[m.season == 2025].dropna(subset=["home_cover"])
clf = HistGradientBoostingClassifier(max_depth=3, learning_rate=0.05, max_iter=300, l2_regularization=2.0, min_samples_leaf=40, random_state=0).fit(tr[BASE + FPNET], tr.home_cover)
from sklearn.inspection import permutation_importance
pi = permutation_importance(clf, te[BASE + FPNET], te.home_cover, n_repeats=10, random_state=0, scoring="neg_log_loss")
imp = pd.Series(pi.importances_mean, index=BASE + FPNET).sort_values(ascending=False)
print("\n  permutation importance (2025 fold, arm B), top 12:")
for k, v in imp.head(12).items(): print(f"    {k:32s} {v:+.4f}{'   <- FP' if k.startswith('fpnet') else ''}")
print("  FP nets ranked: " + ", ".join(f"{k}#{list(imp.index).index(k)+1}" for k in FPNET))
