#!/usr/bin/env python3
"""DOSE RESPONSE of the production NFL sides models (owner question, 2026-09-18). Walk-forward with
the exact harness recipe (forecast_harness.build() features, same HistGradientBoosting params, train
on seasons < target and weeks >= 4). Two numbers ship: the classifier's P(home covers) — the bet
signal, threshold CONF=0.03 — and the regression margin used as confirmation (REG_EDGE=1.5).
Buckets by confidence / by regression gap vs the line, per season, graded vs the OPENER (what the
ledger bets; odds_consensus has openers 2023+) and vs the CLOSE (nflverse line, 2021+).
Weeks 1-3 vs 4+ split because the model is TRAINED on weeks 4+ only."""
import io, contextlib, sys, numpy as np, pandas as pd
from sklearn.ensemble import HistGradientBoostingClassifier, HistGradientBoostingRegressor
with contextlib.redirect_stdout(io.StringIO()):
    import forecast_harness as FH
    m, BASE = FH.build()
od = pd.read_parquet("data/odds_consensus.parquet")[["season","home_ab","away_ab","open_spread","close_spread"]]
m = m.merge(od, on=["season","home_ab","away_ab"], how="left"); m["close_nv"] = m.home_spread
rows = []
for yr in (2021, 2022, 2023, 2024, 2025):
    tr = m[(m.season < yr) & (m.week >= 4)].dropna(subset=["home_cover"]); te = m[(m.season == yr) & m.actual_margin.notna()].copy()
    clf = HistGradientBoostingClassifier(max_depth=3, learning_rate=0.05, max_iter=300, l2_regularization=2.0, min_samples_leaf=40, random_state=0).fit(tr[BASE], tr.home_cover)
    reg = HistGradientBoostingRegressor(max_depth=3, learning_rate=0.05, max_iter=300, l2_regularization=2.0, min_samples_leaf=40, random_state=0).fit(tr.dropna(subset=["actual_margin"])[BASE], tr.dropna(subset=["actual_margin"]).actual_margin)
    te["ph"] = clf.predict_proba(te[BASE])[:, 1]; te["pred_margin"] = reg.predict(te[BASE]); rows.append(te)
T = pd.concat(rows); T["phase"] = np.where(T.week <= 3, "wk1-3", "wk4+"); T["conf"] = (T.ph - 0.5).abs()
def grade(d, line, by):
    L = d[line]; res = d.actual_margin + L
    if by == "conf": pick_home = d.ph >= 0.5; dose = d.conf
    else: e = d.pred_margin + L; pick_home = e > 0; dose = e.abs()
    ok = L.notna() & res.notna() & (res != 0) & dose.notna(); won = np.where(pick_home, res > 0, res < 0)
    return dose[ok], pd.Series(won, index=d.index)[ok], d[ok]
roi = lambda w: 100 * (w.mean() * 1.909 - 1)
YRS = (2021, 2022, 2023, 2024, 2025)
def table(title, line, by, bins, fmt):
    print(f"\n{title}  (graded vs {line}; win% / n per season; ROI at -110)")
    print(f"  {'bucket':9s} | " + " | ".join(f"{yr:^15d}" for yr in YRS) + f" | {'pooled':^22s} | wk1-3 pooled | wk4+ pooled")
    for lo, hi in bins:
        lab = fmt(lo, hi); cells = []
        for yr in YRS:
            e, w, d = grade(T[T.season == yr], line, by); mk = (e >= lo) & (e < hi); cells.append(f"{100*w[mk].mean():5.1f}% n={mk.sum():3d}" if mk.sum() else f"{'':12s}")
        e, w, d = grade(T, line, by); mk = (e >= lo) & (e < hi); ph = d.phase.values; p13 = mk & (ph == "wk1-3"); p4 = mk & (ph == "wk4+")
        print(f"  {lab:9s} | " + " | ".join(f"{c:15s}" for c in cells) + f" | {100*w[mk].mean():5.1f}% {roi(w[mk]):+5.1f}% n={mk.sum():4d} | {100*w[p13].mean():5.1f}% n={p13.sum():3d} | {100*w[p4].mean():5.1f}% n={p4.sum():4d}")
CB = [(0, .03), (.03, .06), (.06, .10), (.10, .15), (.15, 1)]; cf = lambda lo, hi: f"{lo:.2f}-{hi:.2f}" if hi < 1 else f"{lo:.2f}+"
RB = [(0, 1.5), (1.5, 3), (3, 5), (5, 7), (7, 99)]; rf = lambda lo, hi: f"{lo}-{hi}" if hi < 99 else f"{lo}+"
table("CLASSIFIER confidence |P(home cover) - .5|  (bet signal; production threshold .03)", "open_spread", "conf", CB, cf)
table("CLASSIFIER confidence", "close_nv", "conf", CB, cf)
table("REGRESSION gap |pred margin vs line|  (confirmation layer; production threshold 1.5)", "open_spread", "reg", RB, rf)
table("REGRESSION gap", "close_nv", "reg", RB, rf)
print("\nPRODUCTION RULE as shipped: classifier conf >= .03 at the opener, with / without regression agreement (>= 1.5 same side)")
for yr in list(YRS) + ["pooled"]:
    d = T if yr == "pooled" else T[T.season == yr]; d = d[d.open_spread.notna() & ((d.actual_margin + d.open_spread) != 0)]
    home = d.ph >= 0.5; res = d.actual_margin + d.open_spread; won = np.where(home, res > 0, res < 0); e = d.pred_margin + d.open_spread
    agree = np.where(home, e >= 1.5, e <= -1.5); fire = d.conf >= .03
    if fire.sum(): print(f"  {str(yr):6s} fires {100*won[fire].mean():5.1f}% n={fire.sum():3d} | with confluence {100*won[fire & agree].mean():5.1f}% n={(fire & agree).sum():3d} | without {100*won[fire & ~agree].mean():5.1f}% n={(fire & ~agree).sum():3d}")
print("\nMONOTONICITY: Spearman between dose decile and win rate, per season (+1 clean dose response, 0 flat)")
for title, line, by in (("conf vs open", "open_spread", "conf"), ("conf vs close", "close_nv", "conf"), ("reg vs open", "open_spread", "reg"), ("reg vs close", "close_nv", "reg")):
    out = []
    for yr in YRS:
        e, w, d = grade(T[T.season == yr], line, by)
        if len(e) < 50: out.append(f"{yr}: n/a"); continue
        dec = pd.qcut(e.rank(method="first"), 5, labels=False); wr = pd.Series(w.values).groupby(dec.values).mean(); out.append(f"{yr}: {wr.corr(pd.Series(range(5)), method='spearman'):+.2f}")
    print(f"  {title:14s} " + "   ".join(out))
T[["season","week","home_ab","away_ab","open_spread","close_nv","ph","pred_margin","actual_margin"]].to_parquet("data/_dose_response_preds.parquet", index=False)
