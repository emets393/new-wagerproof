"""
PHASE 1d — dedicated DEEP totals line-movement (mirror of the spread dig).
Magnitude / timing (early=open->24h, late=24h->close, v-late=6h->close) / reversal / direction-asymmetry.
Graded at CLOSE (over_close = actual_total > tot_close). Per-season. 2021-25.
"""
import os
import numpy as np
import pandas as pd

HERE = os.path.dirname(os.path.abspath(__file__))
f = pd.read_parquet(os.path.join(HERE, "data", "movement_windows.parquet"))
f = f.dropna(subset=["tot_open", "tot_close", "tot_h24", "actual_total"]).copy()
TS = [2021, 2022, 2023, 2024, 2025]
def roi(h, n): return (h * 0.909 - (n - h)) / n * 100 if n else 0.0
f["over"] = f.actual_total > f.tot_close
f["t_move"] = f.tot_close - f.tot_open
f["t_early"] = f.tot_h24 - f.tot_open
f["t_late"] = f.tot_close - f.tot_h24
f["t_vlate"] = f.tot_close - f.tot_h6
f = f[f.actual_total != f.tot_close]
def perseason(b, win):
    return "/".join(f"{100*win[b.season==s].mean():.0f}" if (b.season==s).sum()>=8 else "--" for s in TS)

print(f"games: {len(f)} | mean |total move| {f.t_move.abs().mean():.2f}")
print("\n=== A. MAGNITUDE: bet the direction the total moved, grade @ close ===")
print(f"{'move bucket':>14}{'n':>6}{'hit%':>7}{'roi':>7}")
for lo, hi in [(0.5, 1), (1, 2), (2, 3), (3, 5), (5, 99)]:
    m = (f.t_move.abs() >= lo) & (f.t_move.abs() < hi); b = f[m]
    win = pd.Series(np.where(b.t_move > 0, b.over, ~b.over), index=b.index); n = len(b)
    if n >= 25: print(f"{f'{lo}-{hi}':>14}{n:>6}{100*win.mean():>7.1f}{roi(int(win.sum()),n):>7.1f}")

print("\n=== B. DIRECTION ASYMMETRY: moves UP (->over) vs DOWN (->under), |move|>=1 ===")
up = f[f.t_move >= 1]; dn = f[f.t_move <= -1]
print(f"  moved UP   (bet over):  n={len(up)} over hits {100*up.over.mean():.1f}%  [{perseason(up,up.over)}]")
print(f"  moved DOWN (bet under): n={len(dn)} under hits {100*(~dn.over).mean():.1f}%  [{perseason(dn,~dn.over)}]")

print("\n=== C. TIMING: which window's move predicts close? (|move|>=1.5) ===")
for w in ["t_early", "t_late", "t_vlate"]:
    m = f[w].abs() >= 1.5; b = f[m]; win = pd.Series(np.where(b[w] > 0, b.over, ~b.over), index=b.index)
    print(f"  {w:<8} n={len(b)} that-direction hits close {100*win.mean():.1f}%")

print("\n=== D. REVERSAL: total moves one way early, reverses late -> follow LATE ===")
for mag in [0.5, 1, 1.5]:
    rev = (np.sign(f.t_early) != np.sign(f.t_late)) & (f.t_early.abs() >= mag) & (f.t_late.abs() >= mag)
    b = f[rev]; win = pd.Series(np.where(b.t_late > 0, b.over, ~b.over), index=b.index)
    if len(b) >= 25: print(f"  reversal both>={mag}: n={len(b)} follow-late hits {100*win.mean():.1f}% roi {roi(int(win.sum()),len(b)):+.1f} [{perseason(b,win)}]")

print("\n=== E. does total move CONFIRM our model under spot? ===")
# big down-move + high open total (our under spot)
b = f[(f.t_move <= -1.5)]; print(f"  total dropped >=1.5 (steam under): n={len(b)} under hits {100*(~b.over).mean():.1f}% [{perseason(b,~b.over)}]")
b2 = f[(f.t_move >= 1.5)]; print(f"  total rose >=1.5 (steam over): n={len(b2)} over hits {100*b2.over.mean():.1f}% [{perseason(b2,b2.over)}]")
