#!/usr/bin/env python3
"""DOSE RESPONSE of the production CFB base models (owner question, 2026-09-18): does a bigger gap
between the model's number and the sportsbook line mean a better result?  Walk-forward, exact
production recipe (cfb_forecast.load() features + HistGradientBoosting params), train < season,
score the season, bucket by |edge| vs the OPENER (what the model is graded on) and vs the CLOSE.
Per season 2022-2025 so a bucket has to hold up across years, not just pooled.  Also splits
weeks 1-3 (priors / last-season carry) from weeks 4+ (in-season data) since that switch is next week."""
import sys, os, numpy as np, pandas as pd
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from sklearn.ensemble import HistGradientBoostingRegressor
import cfb_forecast as CF
gm, feats, nets = CF.load(); sfeats = feats + nets
rows = []
for yr in (2022, 2023, 2024, 2025):
    tr = gm[(gm.season < yr) & gm.actual_total.notna()]; te = gm[(gm.season == yr) & gm.actual_total.notna()].copy()
    tm = HistGradientBoostingRegressor(max_iter=300, learning_rate=0.05, max_depth=4, l2_regularization=1.0, random_state=0).fit(tr[feats], tr.actual_total)
    sm = HistGradientBoostingRegressor(max_iter=300, learning_rate=0.05, max_depth=4, l2_regularization=1.0, random_state=0).fit(tr[sfeats], tr.actual_margin)
    te["pred_total"] = tm.predict(te[feats]); te["pred_margin"] = sm.predict(te[sfeats]); rows.append(te)
T = pd.concat(rows); T["phase"] = np.where(T.week <= 3, "wk1-3", "wk4+")
def grade_side(d, line):   # bet the side the model favors vs `line` (home spread); push = no action
    e = d.pred_margin + d[line]; res = d.actual_margin + d[line]; ok = e.notna() & res.notna() & (res != 0) & (e != 0)
    return e[ok].abs(), (np.sign(e[ok]) == np.sign(res[ok])), d[ok]
def grade_total(d, line):
    e = d.pred_total - d[line]; res = d.actual_total - d[line]; ok = e.notna() & res.notna() & (res != 0) & (e != 0)
    return e[ok].abs(), (np.sign(e[ok]) == np.sign(res[ok])), d[ok]
roi = lambda w: 100 * (w.mean() * 1.909 - 1)
def table(title, fn, line, bins):
    print(f"\n{title}  (graded vs {line}; win% / n per season; ROI at -110)")
    labs = [f"{lo}-{hi}" if hi < 99 else f"{lo}+" for lo, hi in bins]
    print(f"  {'|edge|':8s} | " + " | ".join(f"{yr:^16d}" for yr in (2022, 2023, 2024, 2025)) + " | " + f"{'pooled':^22s}" + " | wk1-3 pooled | wk4+ pooled")
    for (lo, hi), lab in zip(bins, labs):
        cells = []
        for yr in (2022, 2023, 2024, 2025):
            e, w, d = fn(T[T.season == yr], line); m = (e >= lo) & (e < hi); cells.append(f"{100*w[m].mean():5.1f}% n={m.sum():4d}" if m.sum() else f"{'':13s}")
        e, w, d = fn(T, line); m = (e >= lo) & (e < hi); ph = d.phase.values
        p13 = m & (ph == "wk1-3"); p4 = m & (ph == "wk4+")
        print(f"  {lab:8s} | " + " | ".join(f"{c:16s}" for c in cells) + f" | {100*w[m].mean():5.1f}% {roi(w[m]):+5.1f}% n={m.sum():4d} | {100*w[p13].mean():5.1f}% n={p13.sum():3d} | {100*w[p4].mean():5.1f}% n={p4.sum():4d}")
table("SIDES model", grade_side, "spread_open", [(0, 2), (2, 4), (4, 6), (6, 8), (8, 10), (10, 99)])
table("SIDES model", grade_side, "spread_close", [(0, 2), (2, 4), (4, 6), (6, 8), (8, 10), (10, 99)])
table("TOTALS model", grade_total, "total_open", [(0, 2), (2, 4), (4, 6), (6, 8), (8, 10), (10, 99)])
table("TOTALS model", grade_total, "total_close", [(0, 2), (2, 4), (4, 6), (6, 8), (8, 10), (10, 99)])
# monotonic test: rank correlation between |edge| and win, per season (Spearman on the deciles)
print("\nMONOTONICITY: correlation between |edge| decile and win rate, per season (+1 = clean dose response, 0 = flat, - = inverted)")
for title, fn, line in (("sides vs open", grade_side, "spread_open"), ("sides vs close", grade_side, "spread_close"), ("totals vs open", grade_total, "total_open"), ("totals vs close", grade_total, "total_close")):
    out = []
    for yr in (2022, 2023, 2024, 2025):
        e, w, d = fn(T[T.season == yr], line); dec = pd.qcut(e.rank(method="first"), 10, labels=False); wr = pd.Series(w.values).groupby(dec.values).mean()
        out.append(f"{yr}: {wr.corr(pd.Series(range(10)), method='spearman'):+.2f}")
    print(f"  {title:16s} " + "   ".join(out))
T[["season","week","homeTeam","awayTeam","spread_open","spread_close","total_open","total_close","pred_margin","pred_total","actual_margin","actual_total"]].to_parquet("out/_dose_response_preds.parquet", index=False)
