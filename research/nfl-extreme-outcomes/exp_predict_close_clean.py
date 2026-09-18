#!/usr/bin/env python3
"""PREDICT THE CLOSE — NFL, CLEAN.  The harness BASE carries four features computed from m.home_spread,
which in history is the nflverse CLOSING line (home_fav, abs_spread, home_dog_7_10, away_dog_7_10).
A model that sees them 'predicts' the move at r=.70 because it is reading the close. Here they are
rebuilt from the OPENER (what is actually known at bet time) and the test is re-run:
  (1) predict the move (close − open) from open + clean features, walk-forward 2024-25,
  (2) how much the leak inflated the production sides backtest: classifier vs opener at conf >= .06,
      leaky BASE vs clean BASE, same recipe."""
import io, contextlib, numpy as np, pandas as pd, warnings
from sklearn.ensemble import HistGradientBoostingRegressor, HistGradientBoostingClassifier
warnings.filterwarnings("ignore")
with contextlib.redirect_stdout(io.StringIO()):
    import forecast_harness as FH; m, BASE = FH.build()
LEAK = ["home_fav", "abs_spread", "home_dog_7_10", "away_dog_7_10"]
od = pd.read_parquet("data/odds_consensus.parquet")[["season","home_ab","away_ab","open_spread","close_spread"]]
N = m.merge(od, on=["season","home_ab","away_ab"], how="left")
N["open"] = N.open_spread; N["close"] = N.close_spread
# opener-derived replacements (NaN where no opener, i.e. seasons < 2023 -> HGB handles NaN)
N["home_fav_o"] = np.where(N.open.notna(), (N.open < 0).astype(float), np.nan); N["abs_open"] = N.open.abs()
N["home_dog_o"] = np.where(N.open.notna(), ((N.open >= 7.5) & (N.open <= 10.5)).astype(float), np.nan); N["away_dog_o"] = np.where(N.open.notna(), ((N.open <= -7.5) & (N.open >= -10.5)).astype(float), np.nan)
CLEAN = [c for c in BASE if c not in LEAK] + ["home_fav_o", "abs_open", "home_dog_o", "away_dog_o"]
NOLINE = [c for c in BASE if c not in LEAK]                      # no line information at all
def grade(x, pm, thr):
    x = x[pm.abs() >= thr]; p = pm[x.index]; bh = p < 0; mv = x.close - x.open; moved = mv != 0
    hit = np.where(bh, mv < 0, mv > 0); pts = np.where(bh, -mv, mv); res = x.actual_margin + x.open; push = res == 0; won = np.where(bh, res > 0, res < 0)
    return len(x), (100 * hit[moved].mean() if moved.sum() else np.nan), pts.mean(), (100 * won[~push].mean() if (~push).sum() else np.nan)
D = N[N.open.notna() & N.close.notna() & N.actual_margin.notna()].copy()
print("=" * 100); print(f"NFL predict the MOVE, {len(D)} games 2023-25, clean features (line info = OPENER only)"); print("=" * 100)
for sname, feats in (("opener + clean fundamentals (no line-derived)", ["open","abs_open","week"] + NOLINE), ("opener + clean BASE (open-derived buckets)", ["open","week"] + CLEAN)):
    print(f"  --- {sname} ({len(feats)} features)")
    allp, allt = [], []
    for yr in (2024, 2025):
        tr = D[D.season < yr]; te = D[D.season == yr].copy(); y = tr.close - tr.open
        mdl = HistGradientBoostingRegressor(max_iter=200, learning_rate=0.05, max_depth=3, l2_regularization=2.0, min_samples_leaf=30, random_state=0).fit(tr[feats].astype(float), y)
        pm = pd.Series(mdl.predict(te[feats].astype(float)), index=te.index); r = np.corrcoef(pm, te.close - te.open)[0, 1]
        line = f"    {yr}: r={r:+.3f}"
        for t in (0.5, 1.0, 1.5, 2.0):
            n, hit, pts, win = grade(te, pm, t); line += f" | ≥{t}: n={n:3d} our-way {hit:4.0f}% clv {pts:+.2f} win-vs-open {win:4.1f}%"
        print(line); allp.append(pm); allt.append(te)
    P, T = pd.concat(allp), pd.concat(allt)
    for t in (1.0, 1.5): n, hit, pts, win = grade(T, P, t); print(f"    POOLED ≥{t}: n={n} our-way {hit:.0f}% clv {pts:+.2f} win-vs-open {win:.1f}%")
# ---- also: the production model's own edge vs open as the ONLY predictor, clean vs leaky
print("\n  --- the production sides regression's edge vs open as the only feature (walk-forward), leaky BASE vs clean BASE")
for lab, feats in (("LEAKY (as shipped)", BASE), ("CLEAN", CLEAN)):
    allp, allt = [], []
    for yr in (2024, 2025):
        tr = N[(N.season < yr) & (N.week >= 4)].dropna(subset=["actual_margin"]); te = D[D.season == yr].copy()
        reg = HistGradientBoostingRegressor(max_depth=3, learning_rate=0.05, max_iter=300, l2_regularization=2.0, min_samples_leaf=40, random_state=0).fit(tr[feats].astype(float), tr.actual_margin)
        te["model_edge"] = reg.predict(te[feats].astype(float)) + te.open
        tr2 = D[D.season < yr].copy(); reg0 = HistGradientBoostingRegressor(max_depth=3, learning_rate=0.05, max_iter=300, l2_regularization=2.0, min_samples_leaf=40, random_state=0).fit(N[(N.season < yr) & (N.week >= 4)].dropna(subset=["actual_margin"])[feats].astype(float), N[(N.season < yr) & (N.week >= 4)].dropna(subset=["actual_margin"]).actual_margin)
        tr2["model_edge"] = reg0.predict(tr2[feats].astype(float)) + tr2.open
        mv = HistGradientBoostingRegressor(max_iter=200, learning_rate=0.05, max_depth=2, l2_regularization=2.0, min_samples_leaf=30, random_state=0).fit(tr2[["open","model_edge"]], tr2.close - tr2.open)
        pm = pd.Series(mv.predict(te[["open","model_edge"]]), index=te.index); line = f"    {lab:18s} {yr}: r={np.corrcoef(pm, te.close - te.open)[0,1]:+.3f}"
        for t in (1.0, 1.5, 2.0):
            n, hit, pts, win = grade(te, pm, t); line += f" | ≥{t}: n={n:3d} our-way {hit:4.0f}% clv {pts:+.2f} win-vs-open {win:4.1f}%"
        print(line)
# ---- (2) how much the leak inflated the SIDES backtest vs opener
print("\n" + "=" * 100); print("PRODUCTION SIDES CLASSIFIER vs OPENER, conf >= .06 (2023-25): leaky BASE vs clean BASE"); print("=" * 100)
for lab, feats in (("LEAKY (as shipped)", BASE), ("CLEAN (open-derived)", CLEAN), ("NO LINE FEATURES", NOLINE)):
    out = []; W = []
    for yr in (2023, 2024, 2025):
        tr = N[(N.season < yr) & (N.week >= 4)].dropna(subset=["home_cover"]); te = D[D.season == yr].copy()
        clf = HistGradientBoostingClassifier(max_depth=3, learning_rate=0.05, max_iter=300, l2_regularization=2.0, min_samples_leaf=40, random_state=0).fit(tr[feats].astype(float), tr.home_cover)
        te["ph"] = clf.predict_proba(te[feats].astype(float))[:, 1]; te = te[(te.ph - 0.5).abs() >= 0.06]; res = te.actual_margin + te.open; te = te[res != 0]; res = res[te.index]
        won = np.where(te.ph >= 0.5, res > 0, res < 0); out.append(f"{yr}: {100*won.mean():5.1f}% n={len(won):3d}"); W.append(won)
    W = np.concatenate(W); print(f"  {lab:22s} " + "  ".join(out) + f"  | pooled {100*W.mean():.1f}% n={len(W)}")
