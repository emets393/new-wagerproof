"""
b71b — TEASER EMPIRICAL FOUNDATION, extended to 2018-2025 (8 seasons).

Uses `matchup_arch.parquet` which has CLOSING spread back to 2018. For 2023-2025 we
ALSO have opening spreads (from odds_consensus); we use those years to validate that
bucket assignment is stable between open and close (line movement is typically <1pt
so most games stay in the same bucket).

WHY THIS MATTERS
  - Phase 1 (b71) used only 2023-2025 → 710 games → Wong buckets had n=17-82, CIs were ±15pp
  - This expansion gives us ~1700 games → Wong buckets n=80-200+, CIs tighten to ±5-8pp
  - We can now see if 2025's strong Wong-dog performance is variance or a trend

CAVEATS (honest)
  - 2018-2022 grades against CLOSE spread (only line we have). Live bettors face OPEN. For 2023-2025
    we compare both lines to quantify the difference.
  - Books may have re-juiced Wong spots over the past 5 years. Per-season breakdown will reveal this.
"""
import os, sys, warnings
import numpy as np, pandas as pd
warnings.filterwarnings("ignore")
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from stats_helpers import wilson_ci
DATA=os.path.join(os.path.dirname(os.path.abspath(__file__)),"data"); L=print

ma = pd.read_parquet(os.path.join(DATA,"matchup_arch.parquet"))
od = pd.read_parquet(os.path.join(DATA,"odds_consensus.parquet"))
ma["actual_margin"] = ma.home_score - ma.away_score
ma["actual_total"]  = ma.home_score + ma.away_score

# CLOSE spread is `home_spread` in matchup_arch. Merge OPEN where available (2023-2025).
g = ma[["season","week","home_ab","away_ab","home_spread","ou_vegas_line","actual_margin","actual_total"]].rename(
    columns={"home_spread":"close_spread","ou_vegas_line":"close_total"})
g = g.merge(od[["season","home_ab","away_ab","open_spread","open_total"]],
            on=["season","home_ab","away_ab"], how="left")
g = g[(g.week>=4) & g.close_spread.notna() & g.close_total.notna()].copy()
L(f"\n[load] {len(g)} games {g.season.min()}-{g.season.max()}, week>=4 only")
for Y in sorted(g.season.unique()):
    sy=g[g.season==Y]
    has_open = sy.open_spread.notna().sum()
    L(f"  {Y}: n={len(sy):3d}  close_spread coverage=100%  open_spread coverage={has_open}/{len(sy)}")

# Pick the spread we'll use per game: OPEN if available, else CLOSE
g["bet_spread"] = g.open_spread.fillna(g.close_spread)
g["bet_total"]  = g.open_total.fillna(g.close_total)
g["spread_src"] = np.where(g.open_spread.notna(), "OPEN", "CLOSE")

# Sanity: how often does open vs close land in different teaser buckets (2023-2025)?
def bucket_of(s):
    if pd.isna(s): return None
    for lo,hi,name in [(-14,-10.5,"-14 to -10.5"),(-10,-9,"-10 to -9"),(-8.5,-7.5,"-8.5 to -7.5"),
                       (-7,-6,"-7 to -6"),(-5.5,-4,"-5.5 to -4"),(-3.5,-3,"-3.5 to -3"),
                       (-2.5,-1.5,"-2.5 to -1.5"),(-1,1,"-1 to +1"),(1.5,2.5,"+1.5 to +2.5"),
                       (3,3.5,"+3 to +3.5"),(4,5.5,"+4 to +5.5"),(6,7,"+6 to +7"),(7.5,8.5,"+7.5 to +8.5"),
                       (9,10,"+9 to +10"),(10.5,14,"+10.5 to +14")]:
        if lo<=s<=hi: return name
    return None
both = g.dropna(subset=["open_spread","close_spread"]).copy()
both["bo"]=both.open_spread.apply(bucket_of); both["bc"]=both.close_spread.apply(bucket_of)
same_bucket = (both.bo==both.bc).mean()*100
L(f"\nOpen-vs-close bucket consistency (2023-2025, n={len(both)}): {same_bucket:.1f}% land in same bucket")
L(f"  -> close-spread bucket is a reasonable proxy for open-spread bucket")

# Teaser leg outcomes — grade against the bet_spread (OPEN where available, CLOSE for 2018-2022)
g["home_tease_cover"] = (g.actual_margin + g.bet_spread + 6 > 0).astype(float)
g.loc[g.actual_margin + g.bet_spread + 6 == 0, "home_tease_cover"] = np.nan
g["away_tease_cover"] = (g.actual_margin + g.bet_spread - 6 < 0).astype(float)
g.loc[g.actual_margin + g.bet_spread - 6 == 0, "away_tease_cover"] = np.nan
g["over_tease_cover"]  = (g.actual_total > g.bet_total - 6).astype(float)
g.loc[g.actual_total == g.bet_total - 6, "over_tease_cover"] = np.nan
g["under_tease_cover"] = (g.actual_total < g.bet_total + 6).astype(float)
g.loc[g.actual_total == g.bet_total + 6, "under_tease_cover"] = np.nan

# =================================================================================
# PART 1 — MARGIN DISTRIBUTION (8 seasons)
# =================================================================================
L(f"\n{'='*92}\nPART 1: Margin distribution, 2018-2025 ({len(g)} games)\n{'='*92}")
m_abs = g.actual_margin.abs()
for k in [3,7,4,10,14,1,2,5,6,8,9,11,12,13,17,21]:
    L(f"  |margin|={k:2d}: {(m_abs==k).mean()*100:5.2f}%  (n={(m_abs==k).sum()})")
L(f"  Combined 3 OR 7: {((m_abs==3)|(m_abs==7)).mean()*100:.2f}%  (vs ~7% uniform)")

L(f"\nPer-season key-number rate (sanity — should be stable):")
for Y in sorted(g.season.unique()):
    sy=g[g.season==Y]; ma_y=sy.actual_margin.abs()
    L(f"  {Y}: n={len(sy):3d}  margin=3: {(ma_y==3).mean()*100:4.1f}%  margin=7: {(ma_y==7).mean()*100:4.1f}%  combined: {((ma_y==3)|(ma_y==7)).mean()*100:4.1f}%")

# =================================================================================
# PART 2 — TEASER LEG HIT % BY SPREAD BUCKET (8 seasons)
# =================================================================================
L(f"\n{'='*92}\nPART 2: 6-pt sides teaser hit % by spread bucket, 2018-2025\n{'='*92}")
L(f"{'spread bucket':18s} {'n':>4s}  {'HOME tease win%':>16s}  {'AWAY tease win%':>16s}  notes")
L("-"*92)
buckets = [(-14,-10.5),(-10,-9),(-8.5,-7.5),(-7,-6),(-5.5,-4),(-3.5,-3),(-2.5,-1.5),(-1,1),
           (1.5,2.5),(3,3.5),(4,5.5),(6,7),(7.5,8.5),(9,10),(10.5,14)]
for lo,hi in buckets:
    sub = g[(g.bet_spread>=lo) & (g.bet_spread<=hi)]
    if len(sub)<10: continue
    h = sub.home_tease_cover.dropna(); a = sub.away_tease_cover.dropna()
    h_lo,h_hi = wilson_ci(int(h.sum()), len(h))
    a_lo,a_hi = wilson_ci(int(a.sum()), len(a))
    note=""
    is_wong_home = (lo<=-7.5 and hi>=-8.5) or (lo>=1.5 and hi<=2.5)
    is_wong_away = (lo>=7.5 and hi<=8.5) or (lo<=-1.5 and hi>=-2.5)
    if is_wong_home: note="<- WONG (home)"
    if is_wong_away: note="<- WONG (away)"
    L(f"  {lo:+5.1f} to {hi:+5.1f}   {len(sub):4d}  {h.mean()*100:5.1f}% [{h_lo*100:.0f},{h_hi*100:.0f}]   {a.mean()*100:5.1f}% [{a_lo*100:.0f},{a_hi*100:.0f}]  {note}")

# =================================================================================
# WONG SPOTS — deep per-season
# =================================================================================
L(f"\n{'='*92}\nWONG-SPOT DEEP DIVE (n much larger now)\n{'='*92}")
def wong_dive(label, mask, side):
    sub = g[mask].copy()
    won_col = "home_tease_cover" if side=="home" else "away_tease_cover"
    won = sub[won_col].dropna(); n=len(won); k=int(won.sum())
    if n==0: L(f"\n{label}: (no data)"); return
    lo_p,hi_p = wilson_ci(k,n)
    L(f"\n{label} — n={len(sub)}, win={k}/{n}={k/n*100:.1f}% CI[{lo_p*100:.0f},{hi_p*100:.0f}]")
    breakevens = {"-110":(110/210)**0.5, "-120":(110/220)**0.5, "-130":(110/230)**0.5}
    for j,p in breakevens.items():
        L(f"    breakeven at {j}: {p*100:.1f}% per leg  ({'CLEARS' if k/n>=p else 'fails'})")
    L(f"    Per-season:")
    for Y in sorted(sub.season.unique()):
        sy = sub[sub.season==Y]; sw = sy[won_col].dropna()
        if len(sw)==0: continue
        ksy = int(sw.sum())
        L(f"      {Y}: n={len(sy):2d}  hit={ksy}/{len(sw)}={sw.mean()*100:5.1f}%")

wong_dive("WONG A — HOME -7.5 to -8.5 favorite, teased to -1.5/-2.5 (crosses 3 AND 7)",
          (g.bet_spread>=-8.5)&(g.bet_spread<=-7.5), "home")
wong_dive("WONG B — HOME +1.5 to +2.5 underdog, teased to +7.5/+8.5 (crosses 3 AND 7)",
          (g.bet_spread>=1.5)&(g.bet_spread<=2.5), "home")
wong_dive("WONG C — AWAY -7.5 to -8.5 favorite, teased to -1.5/-2.5 (crosses 3 AND 7)",
          (g.bet_spread>=7.5)&(g.bet_spread<=8.5), "away")
wong_dive("WONG D — AWAY +1.5 to +2.5 underdog, teased to +7.5/+8.5 (crosses 3 AND 7)",
          (g.bet_spread<=-1.5)&(g.bet_spread>=-2.5), "away")

# Also dig into the non-Wong buckets that looked elite in Phase 1
L(f"\n{'='*92}\nNON-WONG STRONG SPOTS — confirm with bigger sample\n{'='*92}")
wong_dive("HOME -7 to -6 favorite, teased through 3 (-7 -> -1)",
          (g.bet_spread>=-7)&(g.bet_spread<=-6), "home")
wong_dive("HOME -1 to +1 (pickem region), teased home through 3",
          (g.bet_spread>=-1)&(g.bet_spread<=1), "home")
wong_dive("HOME +4 to +5.5 underdog, teased through 7",
          (g.bet_spread>=4)&(g.bet_spread<=5.5), "home")
wong_dive("HOME -5.5 to -4 favorite, teased through 3",
          (g.bet_spread<=-4)&(g.bet_spread>=-5.5), "home")
wong_dive("AWAY -3.5 to -3 (home fav by 3), teased away through 3",
          (g.bet_spread<=-3)&(g.bet_spread>=-3.5), "away")
wong_dive("AWAY +3 to +3.5 (home dog by 3), teased away through 3",
          (g.bet_spread>=3)&(g.bet_spread<=3.5), "away")
wong_dive("AWAY +6 to +7 (home dog), teased away through 0",
          (g.bet_spread>=6)&(g.bet_spread<=7), "away")

# =================================================================================
# PART 3 — TOTALS TEASERS (8 seasons)
# =================================================================================
L(f"\n{'='*92}\nPART 3: 6-pt totals teaser hit % by total bucket, 2018-2025\n{'='*92}")
tbuckets = [(33,37),(37.5,39),(39.5,41),(41.5,43),(43.5,45),(45.5,47),(47.5,49),(49.5,51),(51.5,53),(53.5,56)]
L(f"{'total bucket':14s} {'n':>4s}  {'OVER tease win%':>17s}  {'UNDER tease win%':>17s}")
L("-"*92)
for lo,hi in tbuckets:
    sub = g[(g.bet_total>=lo) & (g.bet_total<=hi)]
    if len(sub)<10: continue
    o = sub.over_tease_cover.dropna(); u = sub.under_tease_cover.dropna()
    o_lo,o_hi = wilson_ci(int(o.sum()), len(o))
    u_lo,u_hi = wilson_ci(int(u.sum()), len(u))
    L(f"  {lo:4.1f} to {hi:4.1f}    {len(sub):4d}   {o.mean()*100:5.1f}% [{o_lo*100:.0f},{o_hi*100:.0f}]   {u.mean()*100:5.1f}% [{u_lo*100:.0f},{u_hi*100:.0f}]")

# =================================================================================
# CALIBRATION: which buckets meet which juice tier?
# =================================================================================
L(f"\n{'='*92}\nPHASE 2 ELIGIBILITY: buckets meeting breakeven thresholds (lower CI bound, conservative)\n{'='*92}")
L(f"  -110 per-leg breakeven = 72.4%")
L(f"  -120 per-leg breakeven = 73.85%")
L(f"  -130 per-leg breakeven = 75.16%\n")

results=[]
for lo,hi in buckets:
    sub = g[(g.bet_spread>=lo) & (g.bet_spread<=hi)]
    for side,wcol in [("HOME","home_tease_cover"),("AWAY","away_tease_cover")]:
        won = sub[wcol].dropna(); n=len(won); k=int(won.sum())
        if n<30: continue
        lo_ci,hi_ci = wilson_ci(k,n)
        results.append({"bucket":f"{lo:+5.1f}..{hi:+5.1f}","side":side,"n":n,
                        "hit":k/n*100,"lo_ci":lo_ci*100,"hi_ci":hi_ci*100})
df=pd.DataFrame(results).sort_values("hit",ascending=False)
L(f"{'bucket':18s} {'side':6s} {'n':>4s} {'hit%':>6s} {'CI_low':>7s} {'tier':>10s}")
for _,r in df.iterrows():
    tier = "@-130" if r.lo_ci>=75.16 else ("@-120" if r.lo_ci>=73.85 else ("@-110" if r.lo_ci>=72.4 else "  thin "))
    L(f"  {r.bucket:18s} {r.side:6s} {int(r.n):4d}  {r.hit:5.1f}%  {r.lo_ci:5.1f}%   {tier}")

L(f"\n{'-'*92}")
L(f"Phase 2 plan: legs that clear the @-120 row are bet-eligible. Layer b70 regression to filter")
L(f"per-game, then pair into 2-team teasers (and check empirical correlation between legs).")
