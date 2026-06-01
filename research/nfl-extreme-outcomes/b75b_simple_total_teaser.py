"""
b75b — SIMPLE total teaser empirical: for each exact opening-total value, what % of the
time would a 6-pt teaser on OVER cover, and what % would a 6-pt teaser on UNDER cover?
Across 2018-2025, all weeks.

NO models. NO filters. Just historical cover rate by total number, split over/under.

GRADING
  OVER teaser: bet OVER at line-6 (more favorable). Wins if actual_total > line-6.
  UNDER teaser: bet UNDER at line+6 (more favorable). Wins if actual_total < line+6.
  PUSH (actual_total == teased line) excluded from hit %.
"""
import os, sys, warnings
import numpy as np, pandas as pd
warnings.filterwarnings("ignore")
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from stats_helpers import wilson_ci
DATA=os.path.join(os.path.dirname(os.path.abspath(__file__)),"data"); L=print

ma = pd.read_parquet(os.path.join(DATA,"matchup_arch.parquet"))
od = pd.read_parquet(os.path.join(DATA,"odds_consensus.parquet"))
ma["actual_total"] = ma.home_score + ma.away_score

# Where we have open_total (2023+), prefer it; else close (ou_vegas_line is close in matchup_arch)
g = ma[["season","week","home_ab","away_ab","ou_vegas_line","actual_total","home_score","away_score"]].copy()
g = g.merge(od[["season","home_ab","away_ab","open_total"]], on=["season","home_ab","away_ab"], how="left")
g["total"] = g.open_total.fillna(g.ou_vegas_line)
g = g.dropna(subset=["total","actual_total"]).copy()
L(f"\n[load] {len(g)} games {g.season.min()}-{g.season.max()}, all weeks")
L(f"  total coverage: open={g.open_total.notna().sum()}, close-only={g.open_total.isna().sum()}")

g["over_tease_cover"]  = (g.actual_total > g.total - 6).astype(float)
g.loc[g.actual_total == g.total - 6, "over_tease_cover"] = np.nan
g["under_tease_cover"] = (g.actual_total < g.total + 6).astype(float)
g.loc[g.actual_total == g.total + 6, "under_tease_cover"] = np.nan

g["total_r"] = (g.total * 2).round() / 2

L(f"\n{'='*100}\n6-PT TOTAL TEASER COVER RATE BY EXACT OPENING TOTAL, 2018-2025\n{'='*100}")
L(f"  Breakeven for 2-team teaser @ -120 per leg = 73.85%, @ -110 = 72.4%\n")
L(f"  {'total':>6s}  {'n':>4s}  {'OVER tease win%':>16s}  {'UNDER tease win%':>17s}  notes")
L(f"  {'-'*6}  {'-'*4}  {'-'*16}  {'-'*17}  {'-'*30}")

rows=[]
for t in sorted(g.total_r.unique()):
    sub = g[g.total_r==t]
    if len(sub) < 15: continue
    o = sub.over_tease_cover.dropna(); u = sub.under_tease_cover.dropna()
    o_n, o_k = len(o), int(o.sum())
    u_n, u_k = len(u), int(u.sum())
    o_pct = o_k/o_n*100 if o_n else 0
    u_pct = u_k/u_n*100 if u_n else 0
    o_lo,o_hi = wilson_ci(o_k, o_n) if o_n else (0,0)
    u_lo,u_hi = wilson_ci(u_k, u_n) if u_n else (0,0)
    o_tag = "★ OVER clears -120"  if o_lo*100>=73.85 else ("✓ OVER clears -110"  if o_lo*100>=72.4 else "")
    u_tag = "★ UNDER clears -120" if u_lo*100>=73.85 else ("✓ UNDER clears -110" if u_lo*100>=72.4 else "")
    tag = o_tag if o_tag else u_tag
    L(f"  {t:6.1f}  {len(sub):4d}  {o_pct:5.1f}% [{o_lo*100:.0f},{o_hi*100:.0f}]  {u_pct:5.1f}% [{u_lo*100:.0f},{u_hi*100:.0f}]  {tag}")
    rows.append({"total":t,"n":len(sub),"o_n":o_n,"o_hit":o_pct,"o_lo":o_lo*100,
                 "u_n":u_n,"u_hit":u_pct,"u_lo":u_lo*100})

df = pd.DataFrame(rows)

L(f"\n{'='*100}\nBUCKETS THAT CLEAR -120 BREAKEVEN (lower CI >= 73.85%)\n{'='*100}")
o_clears = df[df.o_lo>=73.85].sort_values("o_hit", ascending=False)
L(f"\nOVER tease clears -120:")
if len(o_clears)==0: L(f"  (none)")
for _,r in o_clears.iterrows(): L(f"  total={r.total:5.1f}  n={int(r.o_n):3d}  hit={r.o_hit:.1f}%  lo_ci={r.o_lo:.1f}%")
u_clears = df[df.u_lo>=73.85].sort_values("u_hit", ascending=False)
L(f"\nUNDER tease clears -120:")
if len(u_clears)==0: L(f"  (none)")
for _,r in u_clears.iterrows(): L(f"  total={r.total:5.1f}  n={int(r.u_n):3d}  hit={r.u_hit:.1f}%  lo_ci={r.u_lo:.1f}%")

L(f"\n{'='*100}\nBUCKETS THAT CLEAR -110 BREAKEVEN (lower CI >= 72.4%)\n{'='*100}")
o_110 = df[df.o_lo>=72.4].sort_values("o_hit", ascending=False)
L(f"\nOVER tease clears -110:")
for _,r in o_110.iterrows(): L(f"  total={r.total:5.1f}  n={int(r.o_n):3d}  hit={r.o_hit:.1f}%  lo_ci={r.o_lo:.1f}%")
if len(o_110)==0: L(f"  (none)")
u_110 = df[df.u_lo>=72.4].sort_values("u_hit", ascending=False)
L(f"\nUNDER tease clears -110:")
for _,r in u_110.iterrows(): L(f"  total={r.total:5.1f}  n={int(r.u_n):3d}  hit={r.u_hit:.1f}%  lo_ci={r.u_lo:.1f}%")
if len(u_110)==0: L(f"  (none)")

L(f"\n{'='*100}\nTOP 10 OVER-tease totals by raw hit% (n>=20)\n{'='*100}")
top_o = df[df.o_n>=20].sort_values("o_hit", ascending=False).head(10)
for _,r in top_o.iterrows(): L(f"  total={r.total:5.1f}  n={int(r.o_n):3d}  hit={r.o_hit:.1f}%  CI_low={r.o_lo:.1f}%")

L(f"\nTOP 10 UNDER-tease totals by raw hit% (n>=20)")
top_u = df[df.u_n>=20].sort_values("u_hit", ascending=False).head(10)
for _,r in top_u.iterrows(): L(f"  total={r.total:5.1f}  n={int(r.u_n):3d}  hit={r.u_hit:.1f}%  CI_low={r.u_lo:.1f}%")

L(f"\n{'='*100}\nPER-SEASON STABILITY for top-5 OVER and top-5 UNDER totals\n{'='*100}")
for _,r in top_o.head(5).iterrows():
    t = r.total
    L(f"\nOVER tease at total = {t:.1f} (pooled n={int(r.o_n)} hit={r.o_hit:.1f}%):")
    for Y in sorted(g.season.unique()):
        sy = g[(g.season==Y)&(g.total_r==t)]; w = sy.over_tease_cover.dropna()
        if len(w)>0: L(f"  {Y}: n={len(sy)}  hit={w.mean()*100:5.1f}% ({int(w.sum())}/{len(w)})")
for _,r in top_u.head(5).iterrows():
    t = r.total
    L(f"\nUNDER tease at total = {t:.1f} (pooled n={int(r.u_n)} hit={r.u_hit:.1f}%):")
    for Y in sorted(g.season.unique()):
        sy = g[(g.season==Y)&(g.total_r==t)]; w = sy.under_tease_cover.dropna()
        if len(w)>0: L(f"  {Y}: n={len(sy)}  hit={w.mean()*100:5.1f}% ({int(w.sum())}/{len(w)})")

df.to_csv(os.path.join(DATA,"b75b_total_teaser_table.csv"), index=False)
L(f"\n[save] full table -> data/b75b_total_teaser_table.csv")
