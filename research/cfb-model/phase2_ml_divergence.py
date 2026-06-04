"""
PHASE 2 — no-vig ML vs spread divergence (the 'soft-ML' family).
- Build CFB spread->home-win-prob table WALK-FORWARD (logistic on open_spread, seasons<Y). NOT the NFL table.
- ml_winp = no-vig home prob from OPEN ML. divergence = ml_winp - spread_implied_winp.
- divergence>0: ML likes home MORE than the spread implies; <0: ML likes home LESS (NFL 'soft-ML fade home').
- Backtest ATS vs OPEN spread (signal = open ML + open spread). Per-season. Test follow AND fade, tight games.
"""
import os
import numpy as np
import pandas as pd
from sklearn.linear_model import LogisticRegression

HERE = os.path.dirname(os.path.abspath(__file__))
fr = pd.read_parquet(os.path.join(HERE, "data", "odds_game_frame.parquet"))
fr = fr[(fr.close_hrs < 12) & fr.open_spread.notna() & fr.open_novig_home.notna() & fr.actual_margin.notna()].copy()
fr["home_win"] = (fr.actual_margin > 0).astype(int)
TS = [2021, 2022, 2023, 2024, 2025]; P5 = {"SEC", "Big Ten", "Big 12", "ACC", "Pac-12"}
def roi(h, n): return (h * 0.909 - (n - h)) / n * 100 if n else 0.0
print(f"games with open ML + open spread: {len(fr)} | novig ML coverage of frame")

# walk-forward spread -> home win prob, then divergence
parts = []
for S in TS:
    tr = fr[fr.season < S]
    te = fr[fr.season == S].copy()
    if len(tr) < 200:
        # 2021 has no prior odds-frame season; use a generic logistic on tr if any, else skip divergence test for 2021
        if len(tr) < 50:
            continue
    lr = LogisticRegression().fit(tr[["open_spread"]], tr["home_win"])
    te["spread_winp"] = lr.predict_proba(te[["open_spread"]])[:, 1]
    parts.append(te)
A = pd.concat(parts)
A["diverg"] = A.open_novig_home - A.spread_winp        # >0 ML likes home more than spread implies
A["home_cover_open"] = (A.actual_margin + A.open_spread) > 0
A = A[(A.actual_margin + A.open_spread) != 0].copy()
A["p5"] = A.homeConference.isin(P5) & A.awayConference.isin(P5)
print(f"test games (2022-25, walk-forward): {len(A)} | mean |diverg| {A.diverg.abs().mean():.3f}")

def ev(name, mask, side):
    b = A[mask.fillna(False)]; n = len(b)
    if n < 25: print(f"  {name:<46} n={n} (thin)"); return
    hit = b.home_cover_open if side == "home" else ~b.home_cover_open
    h = int(hit.sum()); per = "/".join(f"{100*(b.home_cover_open[b.season==s] if side=='home' else ~b.home_cover_open[b.season==s]).mean():.0f}" if (b.season==s).sum()>=8 else "--" for s in TS)
    print(f"  {name:<46} n={n:<4} ATS={100*h/n:.1f}% roi={roi(h,n):+.1f}  [{per}]")

print("\n=== FOLLOW the ML (bet the side ML favors vs spread) ===")
for thr in [0.03, 0.05, 0.07]:
    ev(f"ML likes home (diverg>={thr}) -> bet home", A.diverg >= thr, "home")
    ev(f"ML likes away (diverg<=-{thr}) -> bet away", A.diverg <= -thr, "away")
print("\n=== NFL-style: tight games |spread|<=3, soft-ML fade ===")
ev("tight & ML soft on home (div<=-.04) -> away", (A.open_spread.abs() <= 3) & (A.diverg <= -0.04), "away")
ev("tight & ML strong home (div>=.04) -> home", (A.open_spread.abs() <= 3) & (A.diverg >= 0.04), "home")
ev("tight & ML soft on home (div<=-.04) -> FADE=home", (A.open_spread.abs() <= 3) & (A.diverg <= -0.04), "home")
print("\n=== P5 only, larger divergence ===")
ev("P5 ML likes home (div>=.05) -> home", (A.diverg >= 0.05) & A.p5, "home")
ev("P5 ML likes away (div<=-.05) -> away", (A.diverg <= -0.05) & A.p5, "away")
