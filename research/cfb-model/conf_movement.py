"""
LINE-MOVEMENT by market liquidity: P5 (both Power-5) vs G5 (both Group-5) vs MIX (one each).
Theory: P5 = heavy two-sided action (moves are sharp/meaningful); G5 = thin (moves noisier / may overshoot).
All graded @ CLOSE (signal=move-to-close, grade=close -> honest). Push excluded. 2021-25. Per-season on standouts.
"""
import os
import numpy as np
import pandas as pd

HERE = os.path.dirname(os.path.abspath(__file__))
f = pd.read_parquet(os.path.join(HERE, "data", "movement_windows.parquet"))
TS = [2021, 2022, 2023, 2024, 2025]
def roi(w, n): return (w * 0.909 - (n - w)) / n * 100 if n else 0.0
P5 = {"SEC", "Big Ten", "Big 12", "ACC", "Pac-12"}
G5 = {"American Athletic", "Mountain West", "Mid-American", "Sun Belt", "Conference USA"}
def seg(r):
    h, a = r.homeConference, r.awayConference
    if h in P5 and a in P5: return "P5"
    if h in G5 and a in G5: return "G5"
    if (h in P5) != (a in P5): return "MIX"
    return "other"
f["seg"] = f.apply(seg, axis=1)

# spreads
fs = f.dropna(subset=["sp_open", "sp_close", "sp_h24", "actual_margin"]).copy()
fs["home_cover"] = (fs.actual_margin + fs.sp_close) > 0
fs = fs[(fs.actual_margin + fs.sp_close) != 0]
fs["sp_move"] = fs.sp_close - fs.sp_open
fs["sp_early"] = fs.sp_h24 - fs.sp_open
fs["sp_late"] = fs.sp_close - fs.sp_h24
# totals
ft = f.dropna(subset=["tot_open", "tot_close", "tot_h24", "actual_total"]).copy()
ft["over"] = ft.actual_total > ft.tot_close
ft = ft[ft.actual_total != ft.tot_close]
ft["t_move"] = ft.tot_close - ft.tot_open
ft["t_early"] = ft.tot_h24 - ft.tot_open
ft["t_late"] = ft.tot_close - ft.tot_h24
def per(b, win): return "/".join(f"{100*win[b.season==s].mean():.0f}" if (b.season==s).sum()>=8 else "--" for s in TS)

for sg in ["P5", "G5", "MIX"]:
    s = fs[fs.seg == sg]
    print(f"\n{'='*70}\n{sg}  (spread games n={len(s)}, avg |move| {s.sp_move.abs().mean():.2f})\n{'='*70}")
    print("A. FOLLOW the spread move, grade @ close, by magnitude:")
    print(f"   {'bucket':>10}{'n':>6}{'hit%':>7}{'roi':>7}   per-season")
    for lo, hi in [(0.5, 1), (1, 2), (2, 3), (3, 99)]:
        m = (s.sp_move.abs() >= lo) & (s.sp_move.abs() < hi); b = s[m]
        win = pd.Series(np.where(b.sp_move < 0, b.home_cover, ~b.home_cover), index=b.index)
        if len(b) >= 25: print(f"   {f'{lo}-{hi}':>10}{len(b):>6}{100*win.mean():>7.1f}{roi(int(win.sum()),len(b)):>7.1f}   [{per(b,win)}]")
    # reversal: follow late
    rev = (np.sign(s.sp_early) != np.sign(s.sp_late)) & (s.sp_early.abs() >= 1) & (s.sp_late.abs() >= 1)
    b = s[rev]; win = pd.Series(np.where(b.sp_late < 0, b.home_cover, ~b.home_cover), index=b.index)
    if len(b) >= 20: print(f"B. REVERSAL follow-late: n={len(b)} hit {100*win.mean():.1f}% roi {roi(int(win.sum()),len(b)):+.1f} [{per(b,win)}]")
    # timing: which window predicts close
    print("C. TIMING (|move|>=1.5) that-direction hits @ close:")
    for w in ["sp_early", "sp_late"]:
        m = s[w].abs() >= 1.5; b = s[m]; win = pd.Series(np.where(b[w] < 0, b.home_cover, ~b.home_cover), index=b.index)
        if len(b) >= 25: print(f"     {w:<9} n={len(b)} hit {100*win.mean():.1f}%")

print(f"\n\n########## TOTALS ##########")
for sg in ["P5", "G5", "MIX"]:
    s = ft[ft.seg == sg]
    print(f"\n{sg}  (total games n={len(s)}, avg |move| {s.t_move.abs().mean():.2f})")
    print("A. FOLLOW total move, grade @ close, by magnitude:")
    for lo, hi in [(0.5, 1), (1, 2), (2, 99)]:
        m = (s.t_move.abs() >= lo) & (s.t_move.abs() < hi); b = s[m]
        win = pd.Series(np.where(b.t_move > 0, b.over, ~b.over), index=b.index)
        if len(b) >= 25: print(f"   move {lo}-{hi}: n={len(b)} hit {100*win.mean():.1f}% roi {roi(int(win.sum()),len(b)):+.1f} [{per(b,win)}]")
    up = s[s.t_move >= 1]; dn = s[s.t_move <= -1]
    if len(up) >= 25: print(f"   UP->over:   n={len(up)} over {100*up.over.mean():.1f}% [{per(up,up.over)}]")
    if len(dn) >= 25: print(f"   DOWN->under:n={len(dn)} under {100*(~dn.over).mean():.1f}% [{per(dn,~dn.over)}]")
