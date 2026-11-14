#!/usr/bin/env python3
"""ROI AT THE POSTED PRICE for the confirmed prop specs (close-fed vs close) and for the
shuffled-target placebo (= regress-to-the-mean strategy). A win rate means nothing on a juiced
market; this is units won per 1u staked at over_px/under_px from the T-60 snapshot."""
import io, contextlib, importlib.util as iu, numpy as np, pandas as pd
spec = iu.spec_from_file_location("pa", "prop_anchor_check.py")
src = open("prop_anchor_check.py").read().split("for mkt, pos, lam, thr, fs, tier, note in PE.SPECS:")[0]
ns = {}; exec(compile(src, "pa", "exec"), ns)
PE, panel, SETS, fit, grade, rng = ns["PE"], ns["panel"], ns["SETS"], ns["fit"], ns["grade"], ns["rng"]
def profit(px, won):
    px = np.asarray(px, float); return np.where(won, np.where(px > 0, px / 100, 100 / -px), -1.0)
def roi(pr, thr):
    m = (pr.edge.abs() >= thr) & (pr.actual != pr.close_line); x = pr[m]
    over = x.edge >= thr; won = np.where(over, x.actual > x.close_line, x.actual < x.close_line)
    px = np.where(over, x.over_px, x.under_px); ok = ~np.isnan(px)
    p = profit(px[ok], won[ok]); return won.mean(), len(x), p.sum(), 100 * p.mean(), np.nanmean(px)
for mkt, pos, lam, thr, fs, tier, note in PE.SPECS:
    if tier != "CONFIRMED": continue
    d = panel[(panel.market == mkt) & panel.position.isin(pos)].copy()
    d = d[(d.week >= 4) & d.close_line.notna() & (d.close_line > 0) & d.actual.notna()]
    F0 = fs if fs is not None else SETS[mkt]
    F = [c for c in dict.fromkeys(F0) if c in d.columns and d[c].notna().mean() > 0.35]
    d[F] = d[F].apply(lambda s: s.fillna(s.median())).fillna(0)
    pr = fit(d, F, lam); w, n, u, r, px = roi(pr, thr)
    print(f"\n{mkt} [{'+'.join(pos)}] thr{thr}: REAL   {100*w:.1f}% n={n}  {u:+.1f}u  ROI {r:+.1f}%  avg price {px:+.0f}"
          + "   by season " + " ".join(f"{s}:{roi(pr[pr.season==s], thr)[3]:+.1f}%" for s in (2024, 2025)))
    pl = [roi(fit(d, F, lam, shuffle=True), thr) for _ in range(10)]
    print(f"{'':>{len(mkt)+len(pos[0])+12}} PLACEBO (regress-to-mean) win {100*np.mean([p[0] for p in pl]):.1f}%  ROI {np.mean([p[3] for p in pl]):+.1f}%  (max {max(p[3] for p in pl):+.1f}%)")
    price_side = pr[(pr.edge.abs() >= thr)]; over = price_side.edge >= thr
    print(f"{'':>{len(mkt)+len(pos[0])+12}} side mix: OVER {100*over.mean():.0f}% (avg px {np.nanmean(price_side.over_px[over]):+.0f}) / UNDER {100*(~over).mean():.0f}% (avg px {np.nanmean(price_side.under_px[~over]):+.0f})")
