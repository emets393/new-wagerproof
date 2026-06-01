"""
b75 — SIMPLEST possible teaser empirical: for each exact home_spread value, what % of the
time would a 6-pt teaser on the HOME side cover, and what % would a 6-pt teaser on the
AWAY side cover? Across 2018-2025, all games week 1+.

NO models. NO filters. NO ranking. Just the raw historical cover rate by spread number,
split home/away. This is what should have been the FIRST analysis — sorry I overcomplicated.

GRADING (all at the line we have)
  HOME teaser: bet HOME at home_spread+6. Wins if margin + (home_spread+6) > 0.
  AWAY teaser: bet AWAY at (-home_spread)+6 = -home_spread+6. Wins if -margin + (-home_spread+6) > 0
               i.e. margin + home_spread - 6 < 0.

PUSH: margin + teased_line == 0 -> excluded from hit %.

OUTPUT: table of every spread value with n>=15 games, sorted by spread.
"""
import os, sys, warnings
import numpy as np, pandas as pd
warnings.filterwarnings("ignore")
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from stats_helpers import wilson_ci
DATA=os.path.join(os.path.dirname(os.path.abspath(__file__)),"data"); L=print

# Use matchup_arch for 8 seasons of outcomes + closing spread
ma = pd.read_parquet(os.path.join(DATA,"matchup_arch.parquet"))
od = pd.read_parquet(os.path.join(DATA,"odds_consensus.parquet"))
ma["actual_margin"] = ma.home_score - ma.away_score

# Where we have open_spread (2023+), prefer it; else use close (home_spread is close in matchup_arch)
g = ma[["season","week","home_ab","away_ab","home_spread","actual_margin","home_score","away_score"]].copy()
g = g.merge(od[["season","home_ab","away_ab","open_spread"]], on=["season","home_ab","away_ab"], how="left")
g["spread"] = g.open_spread.fillna(g.home_spread)
g = g.dropna(subset=["spread","actual_margin"]).copy()
L(f"\n[load] {len(g)} games {g.season.min()}-{g.season.max()}, all weeks")
L(f"  spread coverage: open={g.open_spread.notna().sum()}, close-only={g.open_spread.isna().sum()}")

# Compute outcomes
g["home_tease_cover"] = (g.actual_margin + g.spread + 6 > 0).astype(float)
g.loc[g.actual_margin + g.spread + 6 == 0, "home_tease_cover"] = np.nan
g["away_tease_cover"] = (g.actual_margin + g.spread - 6 < 0).astype(float)
g.loc[g.actual_margin + g.spread - 6 == 0, "away_tease_cover"] = np.nan

# Round spread to nearest 0.5 (handle rare 1.0 increments)
g["spread_r"] = (g.spread * 2).round() / 2

L(f"\n{'='*100}")
L(f"6-PT TEASER COVER RATE BY EXACT HOME-SPREAD VALUE, 2018-2025")
L(f"{'='*100}")
L(f"  Reading: 'spread' = home team's number (negative = home favored, positive = home dog)")
L(f"  Sorted by spread (most negative = biggest home favorites first)")
L(f"  Breakeven for 2-team teaser @ -120 per leg = 73.85%, @ -110 = 72.4%\n")
L(f"  {'spread':>7s}  {'n':>4s}  {'HOME tease win%':>17s}  {'AWAY tease win%':>17s}  notes")
L(f"  {'-'*7}  {'-'*4}  {'-'*17}  {'-'*17}  {'-'*30}")

rows=[]
for sp in sorted(g.spread_r.unique()):
    sub = g[g.spread_r==sp]
    if len(sub) < 15: continue
    h = sub.home_tease_cover.dropna(); a = sub.away_tease_cover.dropna()
    h_n, h_k = len(h), int(h.sum())
    a_n, a_k = len(a), int(a.sum())
    h_pct = h_k/h_n*100 if h_n else 0
    a_pct = a_k/a_n*100 if a_n else 0
    h_lo,h_hi = wilson_ci(h_k, h_n) if h_n else (0,0)
    a_lo,a_hi = wilson_ci(a_k, a_n) if a_n else (0,0)
    # tag the standout: clears -120 BE by lower CI
    h_tag = "★ HOME clears -120" if h_lo*100>=73.85 else ("✓ HOME clears -110" if h_lo*100>=72.4 else "")
    a_tag = "★ AWAY clears -120" if a_lo*100>=73.85 else ("✓ AWAY clears -110" if a_lo*100>=72.4 else "")
    tag = h_tag if h_tag else a_tag
    L(f"  {sp:+7.1f}  {len(sub):4d}  {h_pct:5.1f}% [{h_lo*100:.0f},{h_hi*100:.0f}]  {a_pct:5.1f}% [{a_lo*100:.0f},{a_hi*100:.0f}]  {tag}")
    rows.append({"spread":sp,"n":len(sub),"h_n":h_n,"h_hit":h_pct,"h_lo":h_lo*100,
                 "a_n":a_n,"a_hit":a_pct,"a_lo":a_lo*100})

df = pd.DataFrame(rows)

L(f"\n{'='*100}")
L(f"BUCKETS THAT CLEAR -120 BREAKEVEN (lower CI >= 73.85%) — these are the real edges")
L(f"{'='*100}")
# Home tease clears -120
home_clears = df[df.h_lo>=73.85].sort_values("h_hit", ascending=False)
L(f"\nHOME tease side clears -120 (lo_ci >= 73.85%):")
if len(home_clears)==0:
    L(f"  (none — no individual spread number has tight enough CI to clear -120 conservatively)")
else:
    for _,r in home_clears.iterrows():
        L(f"  spread={r.spread:+5.1f}  n={int(r.h_n):3d}  hit={r.h_hit:.1f}%  lo_ci={r.h_lo:.1f}%")

away_clears = df[df.a_lo>=73.85].sort_values("a_hit", ascending=False)
L(f"\nAWAY tease side clears -120 (lo_ci >= 73.85%):")
if len(away_clears)==0:
    L(f"  (none)")
else:
    for _,r in away_clears.iterrows():
        L(f"  spread={r.spread:+5.1f}  n={int(r.a_n):3d}  hit={r.a_hit:.1f}%  lo_ci={r.a_lo:.1f}%")

L(f"\n{'='*100}")
L(f"BUCKETS THAT CLEAR -110 BREAKEVEN (lower CI >= 72.4%)")
L(f"{'='*100}")
home_110 = df[df.h_lo>=72.4].sort_values("h_hit", ascending=False)
L(f"\nHOME tease side clears -110:")
for _,r in home_110.iterrows():
    L(f"  spread={r.spread:+5.1f}  n={int(r.h_n):3d}  hit={r.h_hit:.1f}%  lo_ci={r.h_lo:.1f}%")
if len(home_110)==0: L(f"  (none)")

away_110 = df[df.a_lo>=72.4].sort_values("a_hit", ascending=False)
L(f"\nAWAY tease side clears -110:")
for _,r in away_110.iterrows():
    L(f"  spread={r.spread:+5.1f}  n={int(r.a_n):3d}  hit={r.a_hit:.1f}%  lo_ci={r.a_lo:.1f}%")
if len(away_110)==0: L(f"  (none)")

# Pure hit % rankings (point estimate only — no CI gating)
L(f"\n{'='*100}")
L(f"TOP 10 HOME-tease spots by raw hit% (n>=20)")
L(f"{'='*100}")
top_h = df[df.h_n>=20].sort_values("h_hit", ascending=False).head(10)
for _,r in top_h.iterrows():
    L(f"  spread={r.spread:+5.1f}  n={int(r.h_n):3d}  hit={r.h_hit:.1f}%  CI_low={r.h_lo:.1f}%")

L(f"\nTOP 10 AWAY-tease spots by raw hit% (n>=20)")
top_a = df[df.a_n>=20].sort_values("a_hit", ascending=False).head(10)
for _,r in top_a.iterrows():
    L(f"  spread={r.spread:+5.1f}  n={int(r.a_n):3d}  hit={r.a_hit:.1f}%  CI_low={r.a_lo:.1f}%")

# Per-season for the top spots
L(f"\n{'='*100}")
L(f"PER-SEASON STABILITY for top-5 HOME and top-5 AWAY spots")
L(f"{'='*100}")
for _,r in top_h.head(5).iterrows():
    sp = r.spread
    L(f"\nHOME tease at spread = {sp:+5.1f} (pooled n={int(r.h_n)} hit={r.h_hit:.1f}%):")
    for Y in sorted(g.season.unique()):
        sy = g[(g.season==Y)&(g.spread_r==sp)]; w = sy.home_tease_cover.dropna()
        if len(w)>0: L(f"  {Y}: n={len(sy)}  hit={w.mean()*100:5.1f}% ({int(w.sum())}/{len(w)})")

for _,r in top_a.head(5).iterrows():
    sp = r.spread
    L(f"\nAWAY tease at spread = {sp:+5.1f} (pooled n={int(r.a_n)} hit={r.a_hit:.1f}%):")
    for Y in sorted(g.season.unique()):
        sy = g[(g.season==Y)&(g.spread_r==sp)]; w = sy.away_tease_cover.dropna()
        if len(w)>0: L(f"  {Y}: n={len(sy)}  hit={w.mean()*100:5.1f}% ({int(w.sum())}/{len(w)})")

df.to_csv(os.path.join(DATA,"b75_spread_teaser_table.csv"), index=False)
L(f"\n[save] full table -> data/b75_spread_teaser_table.csv")
