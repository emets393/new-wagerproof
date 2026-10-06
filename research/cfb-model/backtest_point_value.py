#!/usr/bin/env python3
"""Does measuring edge in PROBABILITY MASS rank our picks better than raw points?

The model already emits a point gap (pred_margin vs the close) and we gate on it. The Walters
method says that gap is worth wildly different amounts depending on WHICH numbers it spans.
This tests that claim on our own graded history instead of taking it on faith.

Out of sample by construction: build_season(S) trains on < S only.
Spreads only — the model's side pick is a spread bet, and totals have their own distribution.

Usage: backtest_point_value.py [first_season last_season]
"""
import os, sys, warnings
from pathlib import Path
import numpy as np, pandas as pd
warnings.filterwarnings("ignore")
HERE = Path(__file__).resolve().parent
os.chdir(HERE); sys.path.insert(0, str(HERE)); sys.path.insert(0, str(HERE.parent))
import cfb_forecast as F
from point_value import edge_pct, cfb_values, stars

LO = int(sys.argv[1]) if len(sys.argv) > 2 else 2021
HI = int(sys.argv[2]) if len(sys.argv) > 2 else 2025
MARG_V, _ = cfb_values()

rows = []
for season in range(LO, HI + 1):
    try:
        gm, feats, te, S = F.build_season(season)
    except Exception as e:
        print(f"  {season}: build_season failed ({e})"); continue
    te = te[te.actual_total.notna() & te.pred_margin.notna() & te.spread_close.notna()].copy()
    if te.empty:
        continue
    for r in te.itertuples():
        close_home = float(r.spread_close)          # home-perspective, <0 home favoured
        mkt_home = -close_home                      # market's implied home margin
        pred_home = float(r.pred_margin)
        side_home = pred_home > mkt_home
        act = float(r.actual_margin) if hasattr(r, "actual_margin") else float(r.homePoints - r.awayPoints)
        cover = act + close_home                    # >0 home covers
        if abs(cover) < 1e-9:
            continue                                # push
        won = (cover > 0) == side_home
        rows.append(dict(season=season,
                         pts=abs(pred_home - mkt_home),
                         pct=edge_pct(pred_home, mkt_home, MARG_V),
                         won=bool(won)))
    print(f"  {season}: {len(te)} graded games")

d = pd.DataFrame(rows)
print(f"\n{len(d)} graded model sides, {LO}-{HI} (out of sample, close-graded)\n")

def tab(d, col, bins, labels, title):
    print(f"=== by {title}")
    d = d.copy(); d["b"] = pd.cut(d[col], bins=bins, labels=labels, right=False)
    print(f"{'bucket':<14}{'n':>6}{'W-L':>12}{'hit':>8}{'ROI':>8}")
    for lab in labels:
        s = d[d.b == lab]
        if s.empty: continue
        w = int(s.won.sum()); l = len(s) - w
        print(f"{str(lab):<14}{len(s):>6}{f'{w}-{l}':>12}{w/len(s)*100:>7.1f}%{(w*0.909-l)/len(s)*100:>+7.1f}%")
    print()

tab(d, "pts", [0,1,2,3,4,6,8,100], ["0-1","1-2","2-3","3-4","4-6","6-8","8+"], "RAW POINT edge (what we gate on today)")
tab(d, "pct", [0,2,3,4,5,6,8,100], ["<2","2-3","3-4","4-5","5-6","6-8","8+"], "PROBABILITY MASS edge (Walters)")

print("=== cumulative: bet everything AT OR ABOVE a floor")
print(f"{'floor':<16}{'n':>6}{'W-L':>12}{'hit':>8}{'ROI':>8}")
for f_ in (0,2,3,4,5,5.5,6,7,8):
    s = d[d.pct >= f_]
    if s.empty: continue
    w = int(s.won.sum()); l = len(s) - w
    print(f"pct >= {f_:<9}{len(s):>6}{f'{w}-{l}':>12}{w/len(s)*100:>7.1f}%{(w*0.909-l)/len(s)*100:>+7.1f}%")
print()
for f_ in (0,1,2,3,4,6,8):
    s = d[d.pts >= f_]
    if s.empty: continue
    w = int(s.won.sum()); l = len(s) - w
    print(f"pts >= {f_:<9}{len(s):>6}{f'{w}-{l}':>12}{w/len(s)*100:>7.1f}%{(w*0.909-l)/len(s)*100:>+7.1f}%")

# do the two disagree in a way that matters?
print("\n=== where the two methods DISAGREE (same points, different mass)")
mid = d[(d.pts >= 2) & (d.pts < 4)]
if len(mid):
    hi_ = mid[mid.pct >= 5]; lo_ = mid[mid.pct < 4]
    for nm, s in (("2-4 pts but mass >=5%", hi_), ("2-4 pts but mass <4%", lo_)):
        if len(s):
            w = int(s.won.sum()); l = len(s) - w
            print(f"   {nm:<26}n={len(s):<5}{w}-{l}   {w/len(s)*100:5.1f}%   ROI {(w*0.909-l)/len(s)*100:+6.1f}%")
d.to_csv("out/backtest_point_value.csv", index=False)
print("\n-> out/backtest_point_value.csv")
