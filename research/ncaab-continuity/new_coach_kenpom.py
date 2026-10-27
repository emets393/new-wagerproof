#!/usr/bin/env python3
"""New head coach x KenPom PRESEASON quintile: is 'rebuilt roster' just a proxy for 'bad program'? Overlap, combined rule, ROI, placebo."""
import numpy as np, pandas as pd, importlib.util, io, contextlib
spec = importlib.util.spec_from_file_location("sg", "split_grid.py"); sg = importlib.util.module_from_spec(spec)
with contextlib.redirect_stdout(io.StringIO()): spec.loader.exec_module(sg)
D = sg.D; nc = D.new_coach; lo = D.ret_min <= 0.30; nd = D.novdec; dog = D.spread > 0
def rec(s, side="BACK"):
    w, l = int((s.win_ats > 0).sum()), int((s.win_ats < 0).sum()); return (w, l) if side == "BACK" else (l, w)
def line(lab, m, side="BACK"):
    s = D[m]; w, l = rec(s, side); roi = 100 * (w * 0.909 - l) / max(1, len(s))
    per = " ".join(f"{str(y)[2:]}:{rec(g, side)[0]}-{rec(g, side)[1]}" for y, g in s.groupby("season_end"))
    pl = D[(m & ~nd & ~D.early10) & D.janfeb.reindex(D.index) | (D.janfeb & (m.values & True))] if False else None
    print(f"   {lab:<62} {side} {w}-{l} ({100*w/max(1,w+l):.1f}%, ROI {roi:+.1f}%)  spread {s.spread.mean():+.1f}  SU {100*(s.win>0).mean():.0f}% | {per}")
q1 = D.kp_q == "Q1 worst"; q2 = D.kp_q == "Q2"
print("Nov-Dec, new head coach, by KenPom preseason quintile (BACK):")
for q in ["Q1 worst", "Q2", "Q3", "Q4", "Q5 best"]:
    line(f"  {q}", nd & nc & (D.kp_q == q)); line(f"  {q}, as underdog", nd & nc & (D.kp_q == q) & dog)
print("\n overlap of the two framings, Nov-Dec:")
line("new coach, KenPom Q1", nd & nc & q1)
line("new coach, KenPom Q1, roster rebuilt", nd & nc & q1 & lo)
line("new coach, KenPom Q1, roster NOT rebuilt", nd & nc & q1 & ~lo)
line("new coach, rebuilt, KenPom NOT Q1", nd & nc & lo & ~q1)
line("new coach, rebuilt, KenPom Q2-Q5, underdog", nd & nc & lo & ~q1 & dog)
line("UNION: new coach AND (KenPom Q1 OR rebuilt), as underdog", nd & nc & (q1 | lo) & dog)
line("UNION, dog of 7+", nd & nc & (q1 | lo) & (D.spread >= 7))
print("\n placebos (same rules Jan-Feb, BACK side):")
line("new coach, KenPom Q1 -- Jan-Feb", D.janfeb & nc & q1)
line("UNION as underdog -- Jan-Feb", D.janfeb & nc & (q1 | lo) & dog)
print("\n Q1 by conference size / venue / opponent, Nov-Dec:")
for lab, m in [("low-major", D.csize == "low-major"), ("power", D.csize == "power"), ("home", D.is_home == 1), ("away", D.is_home == 0), ("neutral", D.neutral == 1), ("vs power opp", D.o_csize == "power"), ("vs low-major opp", D.o_csize == "low-major"), ("first 5 games", D.gn <= 5), ("games 6+", D.gn > 5)]:
    line(f"  new coach Q1, {lab}", nd & nc & q1 & m)
print("\n teams per season:", D[nc & q1].groupby("season_end").teamId.nunique().to_dict(), " union:", D[nc & (q1 | lo)].groupby("season_end").teamId.nunique().to_dict())
