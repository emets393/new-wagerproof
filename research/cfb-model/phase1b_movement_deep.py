"""
PHASE 1b — deep line-movement: magnitude x timing x market (spread/total/ML).
Graded at CLOSE (does movement predict the outcome BEYOND the close?). Windows:
  early = open->24h, late = 24h->close, v_late = 6h->close. Tests if late 'steam' carries signal,
  whether big moves overshoot (fade) or continue, and reversals. 2021-25.
"""
import os
import numpy as np
import pandas as pd

HERE = os.path.dirname(os.path.abspath(__file__))
f = pd.read_parquet(os.path.join(HERE, "data", "movement_windows.parquet"))
f = f.dropna(subset=["sp_open", "sp_close", "actual_margin"]).copy()
TS = [2021, 2022, 2023, 2024, 2025]
def hit(mask, win):
    n = int(mask.sum())
    return (n, 100 * win[mask].mean() if n else 0)

# outcomes at close
f["home_cover"] = (f.actual_margin + f.sp_close) > 0
f["over"] = f.actual_total > f.tot_close
f["home_win"] = f.actual_margin > 0
# moves (full, early, late, very late)
f["sp_move"] = f.sp_close - f.sp_open; f["sp_early"] = f.sp_h24 - f.sp_open; f["sp_late"] = f.sp_close - f.sp_h24; f["sp_vlate"] = f.sp_close - f.sp_h6
f["tot_move"] = f.tot_close - f.tot_open; f["tot_early"] = f.tot_h24 - f.tot_open; f["tot_late"] = f.tot_close - f.tot_h24
f["ml_move"] = f.ml_close - f.ml_open; f["ml_late"] = f.ml_close - f.ml_h24

def block(title, movecol, side_win):
    """side_win = win-bool when betting the side the move went TOWARD, graded at close."""
    print(f"\n=== {title}: bet the side the line moved TOWARD, grade @ close ===")
    print(f"{'move bucket':>14}{'n':>6}{'hit%':>7}")
    for lo, hi in [(0.5, 1), (1, 2), (2, 3), (3, 5), (5, 99)]:
        m = (f[movecol].abs() >= lo) & (f[movecol].abs() < hi)
        n, h = hit(m, side_win)
        if n >= 25: print(f"{f'{lo}-{hi}':>14}{n:>6}{h:>7.1f}")

# SPREAD: move<0 = toward home; bet that side; win = home_cover if toward home else ~home_cover
sp_side = lambda col: np.where(f[col] < 0, f.home_cover, ~f.home_cover)
block("SPREAD full move", "sp_move", pd.Series(sp_side("sp_move"), index=f.index))
print("\n--- SPREAD by TIMING (|move|>=1.5 in window) ---")
for w in ["sp_early", "sp_late", "sp_vlate"]:
    m = f[w].abs() >= 1.5; win = pd.Series(np.where(f[w] < 0, f.home_cover, ~f.home_cover), index=f.index)
    n, h = hit(m, win); print(f"  {w:<10} |move|>=1.5: n={n} that-side covers close {h:.1f}%")

# TOTAL: move>0 = toward over
tot_side = lambda col: np.where(f[col] > 0, f.over, ~f.over)
block("TOTAL full move", "tot_move", pd.Series(tot_side("tot_move"), index=f.index))
print("\n--- TOTAL by TIMING (|move|>=1.5) ---")
for w in ["tot_early", "tot_late"]:
    m = f[w].abs() >= 1.5; win = pd.Series(np.where(f[w] > 0, f.over, ~f.over), index=f.index)
    n, h = hit(m, win); print(f"  {w:<10} |move|>=1.5: n={n} that-direction hits close {h:.1f}%")

# ML: move>0 = toward home (home prob rose)
print("\n=== ML (no-vig home prob) move -> home WIN at close ===")
for lo, hi in [(0.02, 0.05), (0.05, 0.10), (0.10, 0.99)]:
    m = (f.ml_move.abs() >= lo) & (f.ml_move.abs() < hi)
    win = pd.Series(np.where(f.ml_move > 0, f.home_win, ~f.home_win), index=f.index)
    n, h = hit(m, win);
    if n >= 25: print(f"  ml_move {lo}-{hi}: n={n} moved-side WIN% {h:.1f} (note: priced into ML)")

# REVERSAL: early one way, late other way (spread)
print("\n=== SPREAD REVERSAL: early & late move OPPOSITE directions ===")
rev = (np.sign(f.sp_early) != np.sign(f.sp_late)) & (f.sp_early.abs() >= 1) & (f.sp_late.abs() >= 1)
b = f[rev]; latewin = np.where(b.sp_late < 0, b.home_cover, ~b.home_cover)
print(f"  reversal games n={len(b)}: betting the LATE-move side covers close {100*latewin.mean() if len(b) else 0:.1f}%")
