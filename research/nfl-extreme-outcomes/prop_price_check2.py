#!/usr/bin/env python3
"""ROI at MATCHED T-60 prices (prop_price_rebuild.py) for the confirmed prop specs and the
regress-to-mean placebo. Plays kept only where the panel's graded line equals the matched line."""
import numpy as np, pandas as pd
src = open("prop_anchor_check.py").read().split("for mkt, pos, lam, thr, fs, tier, note in PE.SPECS:")[0]
ns = {}; exec(compile(src, "pa", "exec"), ns)
PE, panel, SETS, fit = ns["PE"], ns["panel"], ns["SETS"], ns["fit"]
PX = pd.read_parquet("data/fpdata/_prop_close_prices_matched.parquet").rename(columns={"close_line": "cl_m"})
keys = ["season", "week", "player_id", "market"]
def roi(pr, thr):
    x = pr[(pr.edge.abs() >= thr) & (pr.actual != pr.close_line) & pr.over_dec.notna() & (pr.cl_m == pr.close_line)]
    over = x.edge >= thr; won = np.where(over, x.actual > x.close_line, x.actual < x.close_line)
    pay = np.where(over, x.over_dec, x.under_dec); p = np.where(won, pay, -1.0)
    return won.mean(), len(x), p.sum(), 100 * p.mean(), np.mean(pay), over.mean()
for mkt, pos, lam, thr, fs, tier, note in PE.SPECS:
    if tier != "CONFIRMED": continue
    d = panel[(panel.market == mkt) & panel.position.isin(pos)].copy()
    d = d[(d.week >= 4) & d.close_line.notna() & (d.close_line > 0) & d.actual.notna()]
    F0 = fs if fs is not None else SETS[mkt]
    F = [c for c in dict.fromkeys(F0) if c in d.columns and d[c].notna().mean() > 0.35]
    d[F] = d[F].apply(lambda s: s.fillna(s.median())).fillna(0)
    d = d.merge(PX[keys + ["cl_m", "over_dec", "under_dec"]], on=keys, how="left")
    pr = fit(d, F, lam); w, n, u, r, pay, ov = roi(pr, thr)
    print(f"\n{mkt} [{'+'.join(pos)}] thr{thr}: REAL   {100*w:.1f}% n={n}  {u:+.1f}u  ROI {r:+.1f}%  avg payout {pay:.3f} (breakeven {100/(1+pay):.1f}%)  OVER share {100*ov:.0f}%"
          + "   by season " + " ".join(f"{s}:{roi(pr[pr.season==s], thr)[3]:+.1f}% (n={roi(pr[pr.season==s], thr)[1]})" for s in (2024, 2025)))
    pl = [roi(fit(d, F, lam, shuffle=True), thr) for _ in range(10)]
    print(f"{'':>30} PLACEBO (regress-to-mean): win {100*np.mean([p[0] for p in pl]):.1f}%  ROI {np.mean([p[3] for p in pl]):+.1f}%  (best {max(p[3] for p in pl):+.1f}%)")
