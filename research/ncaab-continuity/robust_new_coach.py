#!/usr/bin/env python3
"""Robustness of the one surviving cell: NEW HEAD COACH + rebuilt roster (<=30% of last season's minutes kept), Nov-Dec, BACK."""
import numpy as np, pandas as pd, importlib.util, sys, io, contextlib
spec = importlib.util.spec_from_file_location("cs", "continuity_study.py"); cs = importlib.util.module_from_spec(spec)
with contextlib.redirect_stdout(io.StringIO()): spec.loader.exec_module(cs)
D = cs.D; ats = cs.ats
lo = D.ret_min <= 0.30; nc = D.new_coach; nd = D.novdec
def roi(s):
    pr = s.spread_price.astype(float).fillna(1.909)                 # cbb_sit_panel prices are DECIMAL (1.91 = -110)
    pay = pr - 1.0
    u = np.where(s.win_ats > 0, pay, np.where(s.win_ats < 0, -1.0, 0.0)); return 100 * u.sum() / len(s)
c = D[nd & nc & lo]
print(f"new coach + rebuilt, Nov-Dec: n={len(c)}  ROI at the posted price {roi(c):+.1f}%  (at -110 flat {100*((c.win_ats>0).sum()*100/110-(c.win_ats<0).sum())/len(c):+.1f}%)")
oc = c[c.ats_open_pts.notna()]; print(f"  vs OPENER instead of close: {(oc.ats_open_pts>0).sum()}-{(oc.ats_open_pts<0).sum()} ({100*(oc.ats_open_pts>0).sum()/max(1,(oc.ats_open_pts!=0).sum()):.1f}%)  avg move close-open {(oc.spread-oc.open_spread).mean():+.2f} (negative = market moved TOWARD the new coach's team)")
print("  drop-one season:", {y: f"{100*(c[c.season_end!=y].win_ats>0).sum()/((c[c.season_end!=y].win_ats!=0).sum()):.1f}%" for y in sorted(c.season_end.unique())})
print("\n is it the coach or the roster?  (Nov-Dec, BACK %)")
for lab, m in [("new coach, rebuilt", nd & nc & lo), ("new coach, NOT rebuilt (>30% kept)", nd & nc & ~lo), ("same coach, rebuilt", nd & ~nc & lo), ("same coach, not rebuilt", nd & ~nc & ~lo)]:
    s = D[m]; print(f"   {lab:<40} {(s.win_ats>0).sum()}-{(s.win_ats<0).sum()} ({100*(s.win_ats>0).sum()/max(1,(s.win_ats!=0).sum()):.1f}%)  spread {s.spread.mean():+.1f}  margin vs spread {s.ats_pts.mean():+.2f}")
print("\n inside the cell:")
ats(nd & nc & lo & (D.spread > 0), "  as underdog")
ats(nd & nc & lo & (D.spread < 0), "  as favorite")
ats(nd & nc & lo & (D.spread >= 7), "  dog of 7+")
ats(nd & nc & lo & (D.tier == "low"), "  low conference tier")
ats(nd & nc & lo & (D.tier == "mid"), "  mid conference tier")
ats(nd & nc & lo & (D.tier == "high"), "  high conference tier")
ats(nd & nc & lo & D.nonconf.astype(bool), "  non-conference")
ats(nd & nc & lo & (D.gn <= 5), "  first 5 games")
ats(nd & nc & lo & (D.gn > 5), "  games 6+ in Nov-Dec")
ats(nd & nc & lo & (D.o_ret_min > 0.5), "  vs opponent that kept 50%+ (continuity mismatch)")
ats(D.janfeb & nc & lo, "  PLACEBO Jan-Feb same teams")
ats((D.mon == 3) & nc & lo, "  March same teams")
print("\n new coach as underdog, Nov-Dec (second cell):")
c2 = D[nd & nc & (D.spread > 0)]; print(f"  n={len(c2)} ROI at price {roi(c2):+.1f}%; drop-one:", {y: f"{100*(c2[c2.season_end!=y].win_ats>0).sum()/((c2[c2.season_end!=y].win_ats!=0).sum()):.1f}%" for y in sorted(c2.season_end.unique())})
ats(nd & nc & (D.spread > 0) & ~lo, "  new coach dog, roster NOT rebuilt")
ats(D.janfeb & nc & (D.spread > 0), "  PLACEBO Jan-Feb new coach dog")
print("\n how many such teams per season:", D[nc & lo].groupby("season_end").teamId.nunique().to_dict(), " of new-coach teams:", D[nc].groupby("season_end").teamId.nunique().to_dict())
