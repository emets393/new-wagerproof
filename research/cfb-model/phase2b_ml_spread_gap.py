"""
PHASE 2b — re-investigate ML-vs-spread inconsistency, 3 ways (not just ATS):
  gap = ML-implied fair spread MINUS actual open spread (in POINTS).
  For |gap| buckets test: (1) ATS cover at open, (2) straight-up WIN rate, (3) does the SPREAD MOVE
  toward the ML's side by close (= ML leads = sharp/CLV signal). All walk-forward, per-season.
First sanity-check the spread->winprob calibration.
"""
import os
import numpy as np
import pandas as pd
from sklearn.linear_model import LogisticRegression

HERE = os.path.dirname(os.path.abspath(__file__))
fr = pd.read_parquet(os.path.join(HERE, "data", "odds_game_frame.parquet"))
fr = fr[(fr.close_hrs < 12) & fr.open_spread.notna() & fr.open_novig_home.notna() & fr.actual_margin.notna() & fr.close_spread.notna()].copy()
fr["home_win"] = (fr.actual_margin > 0).astype(int)
TS = [2021, 2022, 2023, 2024, 2025]
def roi(h, n): return (h * 0.909 - (n - h)) / n * 100 if n else 0.0

# walk-forward: fit spread<->winprob, build ML-implied fair spread (invert), gap in points
parts = []
for S in TS:
    tr = fr[fr.season < S]
    if len(tr) < 200:
        continue
    lr = LogisticRegression().fit(tr[["open_spread"]], tr["home_win"])
    b0, b1 = lr.intercept_[0], lr.coef_[0][0]   # logit(p) = b0 + b1*spread
    te = fr[fr.season == S].copy()
    te["spread_winp"] = lr.predict_proba(te[["open_spread"]])[:, 1]
    # invert: ML winp -> implied fair spread.  p = 1/(1+e^-(b0+b1*s)) => s = (logit(p)-b0)/b1
    p = te.open_novig_home.clip(0.02, 0.98)
    te["ml_implied_spread"] = (np.log(p / (1 - p)) - b0) / b1
    te["gap"] = te.ml_implied_spread - te.open_spread   # >0: ML implies home spread should be HIGHER(more dog) => ML likes home LESS than spread
    parts.append(te)
A = pd.concat(parts)

# sanity: calibration of spread->winp
print("spread->winprob sanity (2022-25): pickem(|spr|<1) home win%", round(100*A[A.open_spread.abs()<1].home_win.mean(),1),
      "| home -7 win%", round(100*A[(A.open_spread<=-6)&(A.open_spread>=-8)].home_win.mean(),1))
print(f"gap (ML_implied_spread - open_spread) distribution: mean|gap| {A.gap.abs().mean():.2f}pt, "
      f">=1pt {100*(A.gap.abs()>=1).mean():.0f}%, >=2pt {100*(A.gap.abs()>=2).mean():.0f}%, >=3pt {100*(A.gap.abs()>=3).mean():.0f}%")

A["home_cover_open"] = (A.actual_margin + A.open_spread) > 0
# gap<0 => ML thinks home should be MORE favored than the spread => ML likes home => bet home
# gap>0 => ML likes away
A["ml_side_home"] = A.gap < 0
A["spread_move_to_ml"] = np.where(A.ml_side_home, A.open_spread - A.close_spread, A.close_spread - A.open_spread)  # +=line moved toward ML side
print("\n=== by |gap| bucket: ATS / straight-up WIN / line-moves-to-ML-side (CLV) ===")
print(f"{'|gap| bucket':>14}{'n':>6}{'ATS%':>7}{'WIN%':>7}{'CLV pts':>9}{'%moveToML':>11}")
for lo, hi in [(0, 0.5), (0.5, 1), (1, 1.5), (1.5, 2.5), (2.5, 99)]:
    b = A[(A.gap.abs() >= lo) & (A.gap.abs() < hi)].copy()
    bc = b[(b.actual_margin + b.open_spread) != 0]
    ats = np.where(bc.ml_side_home, bc.home_cover_open, ~bc.home_cover_open)   # bet ML side ATS
    win = np.where(b.ml_side_home, b.home_win, 1 - b.home_win)                  # ML side wins SU
    print(f"{f'{lo}-{hi}':>14}{len(b):>6}{100*ats.mean() if len(bc) else 0:>7.1f}{100*win.mean():>7.1f}{b.spread_move_to_ml.mean():>9.2f}{100*(b.spread_move_to_ml>0).mean():>11.0f}")
print("\n(ATS<52.4 = no cover edge; CLV pts>0 & %moveToML>50 = ML LEADS the spread = sharp/CLV signal)")
