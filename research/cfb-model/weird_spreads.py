"""
'Weird spreads': where a power-rating fair line diverges from the market spread.
Build fair_margin = power rating diff scaled to points + HFA (walk-forward linear fit),
compare to the spread-implied home margin, and test whether betting the POWER-RATING side
when the line disagrees is exploitable -- or whether the market is right (abstain signal).

power rating = net_rating (opp-adjusted EPA, as-of week-1). Graded ATS vs OPEN, 2021-2025.
"""
import os
import numpy as np
import pandas as pd
from sklearn.linear_model import LinearRegression

HERE = os.path.dirname(os.path.abspath(__file__))
gm = pd.read_parquet(os.path.join(HERE, "data", "model_games.parquet"))
TS = [2021, 2022, 2023, 2024, 2025]
def roi(h, n): return (h * 0.909 - (n - h)) / n * 100 if n else 0.0

gm["neutral_i"] = gm["neutralSite"].astype("boolean").astype("Int64").fillna(0)
PR = ["net_rating_diff", "neutral_i"]   # power rating diff + neutral-site (HFA via intercept)
g = gm.dropna(subset=["net_rating_diff", "actual_margin"]).copy()

# walk-forward fair margin from power rating
parts = []
for S in TS:
    tr = g[(g.season < S)]
    te = g[(g.season == S) & g.spread_open.notna()].copy()
    lr = LinearRegression().fit(tr[PR], tr["actual_margin"])
    te["fair_margin"] = lr.predict(te[PR])      # PR-implied home margin (incl HFA intercept)
    te["hfa"] = lr.intercept_
    parts.append(te)
A = pd.concat(parts)
A["mkt_margin"] = -A["spread_open"]              # spread-implied home margin
A["diverg"] = A["fair_margin"] - A["mkt_margin"] # >0: PR says home better than line -> bet HOME
A = A[(A.actual_margin + A.spread_open) != 0].copy()
A["home_cover"] = (A.actual_margin + A.spread_open) > 0
print(f"n={len(A)} | mean HFA intercept ~ {A['hfa'].mean():.1f} pts | home cover base {100*A.home_cover.mean():.1f}%")
print(f"corr(fair_margin, actual_margin)={np.corrcoef(A.fair_margin,A.actual_margin)[0,1]:.3f} "
      f"vs corr(mkt_margin, actual)={np.corrcoef(A.mkt_margin,A.actual_margin)[0,1]:.3f} (market should be higher)")

print("\n=== Bet the POWER-RATING side, by divergence magnitude (ATS vs open) ===")
print(f"{'|diverg| bin':>16}{'n':>6}{'PRside hit%':>13}{'roi':>8}  per-season")
bins = [(0, 3), (3, 6), (6, 10), (10, 14), (14, 99)]
for lo, hi in bins:
    m = (A["diverg"].abs() >= lo) & (A["diverg"].abs() < hi)
    b = A[m]; n = len(b)
    if n < 25:
        print(f"{f'[{lo},{hi})':>16}{n:>6}  (thin)"); continue
    # bet PR side: diverg>0 -> bet home (hit=home_cover); diverg<0 -> bet away
    bet_home = b["diverg"] > 0
    hit = np.where(bet_home, b["home_cover"], ~b["home_cover"])
    h = int(hit.sum())
    per = "/".join(f"{100*np.where(b['diverg'][b.season==s]>0, b['home_cover'][b.season==s], ~b['home_cover'][b.season==s]).mean():.0f}" if (b.season==s).sum()>=10 else "--" for s in TS)
    print(f"{f'[{lo},{hi})':>16}{n:>6}{100*h/n:>13.1f}{roi(h,n):>8.1f}  [{per}]")

print("\n=== Same, but FADE the PR side (bet the market/line side) at high divergence ===")
for lo in [6, 10]:
    m = A["diverg"].abs() >= lo
    b = A[m]; bet_home = b["diverg"] < 0  # fade PR = bet the side the line favors
    hit = np.where(bet_home, b["home_cover"], ~b["home_cover"]); h = int(hit.sum()); n = len(b)
    print(f"  fade PR, |diverg|>={lo}: n={n} hit={100*h/n:.1f}% roi={roi(h,n):+.1f}")

# does divergence interact with the away-bias edge? (PR says away better AND it's an away team)
print("\n=== PR-divergence on the AWAY side (PR favors away = diverg<0) ===")
for lo in [4, 6, 8]:
    b = A[A["diverg"] <= -lo]; h = int((~b["home_cover"]).sum()); n = len(b)
    per = "/".join(f"{100*(~b['home_cover'])[b.season==s].mean():.0f}" if (b.season==s).sum()>=8 else "--" for s in TS)
    print(f"  PR favors away by >={lo} (bet away): n={n:<4} hit={100*h/n:.1f}% roi={roi(h,n):+.1f} [{per}]")
