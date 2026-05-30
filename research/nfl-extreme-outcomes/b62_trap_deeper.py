"""
b62: DEEPER trap-flag analysis. Use ALL seasons 2018-2025 (vs CLOSE line — always available)
plus the 2023-2025 subset where OPEN line is available. Per-season breakdown to check stability,
threshold sensitivity, and confirm the FADE direction (mean reversion) is the real signal.

Tests:
  1. "TOTAL OVER trap" fires (both teams +sum miss + line below avg) — does UNDER reliably hit?
  2. "TOTAL UNDER trap" fires (both teams -sum miss + line above avg) — does OVER reliably hit?
  3. Same for spread cover traps (low n historically, see if all-seasons gives more fires)
"""
import os, sys, warnings
import numpy as np, pandas as pd
warnings.filterwarnings("ignore")
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from stats_helpers import wilson_ci
DATA=os.path.join(os.path.dirname(os.path.abspath(__file__)),"data"); L=print

m=pd.read_parquet(os.path.join(DATA,"matchup.parquet"))
od=pd.read_parquet(os.path.join(DATA,"odds_consensus.parquet"))
m["actual_margin"]=m.home_score-m.away_score; m["actual_total"]=m.home_score+m.away_score

# === team-game miss values (per b61) ===
m["h_implied"]=(m.nv_total_line - m.home_spread)/2
m["a_implied"]=(m.nv_total_line + m.home_spread)/2
m["h_total_miss"]=m.home_score - m.h_implied
m["a_total_miss"]=m.away_score - m.a_implied
m["h_margin_miss"]=m.actual_margin + m.home_spread
m["a_margin_miss"]=-(m.actual_margin + m.home_spread)

# team-game frame + rolling
h=m[["season","week","home_ab","h_total_miss","h_margin_miss"]].rename(columns={"home_ab":"team","h_total_miss":"total_miss","h_margin_miss":"margin_miss"})
a=m[["season","week","away_ab","a_total_miss","a_margin_miss"]].rename(columns={"away_ab":"team","a_total_miss":"total_miss","a_margin_miss":"margin_miss"})
tg=pd.concat([h,a],ignore_index=True).sort_values(["team","season","week"]).reset_index(drop=True)
for col in ["total_miss","margin_miss"]:
    tg[f"{col}_s2d"]=tg.groupby(["team","season"])[col].transform(lambda s: s.shift(1).expanding().mean())
    tg[f"{col}_last3"]=tg.groupby(["team","season"])[col].transform(lambda s: s.shift(1).rolling(3, min_periods=1).mean())

roll_cols=["total_miss_s2d","total_miss_last3","margin_miss_s2d","margin_miss_last3"]
mm=m.copy()
for side,p in [("home","h_"),("away","a_")]:
    sub=tg[["season","week","team"]+roll_cols].rename(columns={"team":f"{side}_ab", **{c:f"{p}{c}" for c in roll_cols}})
    mm=mm.merge(sub,on=["season","week",f"{side}_ab"],how="left")
mm["total_miss_sum_last3"]=mm.h_total_miss_last3 + mm.a_total_miss_last3
mm["total_miss_sum_s2d"]=mm.h_total_miss_s2d + mm.a_total_miss_s2d

# League-avg-total per season
league_tot=mm.groupby("season").nv_total_line.mean().to_dict()
mm["line_vs_league"]=mm.nv_total_line - mm.season.map(league_tot)

# ========== Trap-flag testing — FADE direction (mean reversion) ==========
def report(d, mask, fade_side, label, line_col="nv_total_line"):
    sub=d[mask].copy()
    n=len(sub)
    if n<5: L(f"  {label:62s} n={n} (too few)"); return None
    if fade_side=="under":
        hit=(sub.actual_total < sub[line_col]).astype(float)[sub.actual_total != sub[line_col]]
    elif fade_side=="over":
        hit=(sub.actual_total > sub[line_col]).astype(float)[sub.actual_total != sub[line_col]]
    k=int(hit.sum()); n=len(hit); lo,hi=wilson_ci(k,n) if n else (0,0); roi=(k*100/110-(n-k))/n*100 if n else 0
    L(f"  {label:62s} n={n:4d} hit={(k/n*100 if n else 0):5.1f}% CI[{lo*100:.0f},{hi*100:.0f}] ROI={roi:+.1f}%")
    return (n,k)

# Build test frame: 2018-2025, week>=4, vs CLOSE line (always available)
d_close=mm[mm.week>=4].dropna(subset=["total_miss_sum_last3","nv_total_line","actual_total"]).copy()
L(f"[data] CLOSE-line test set (all seasons 2018+): n={len(d_close)} games")

L("\n"+"="*96); L("FADE-THE-TRAP, vs CLOSE LINE, all seasons 2018-2025"); L("="*96)
L("\nTOTAL OVER trap fires -> BET UNDER (mean reversion thesis)")
for sum_thr in [3,4,5,6,8]:
    for line_thr in [-1,-2,-3,-4]:
        mask=(d_close.total_miss_sum_last3>=sum_thr)&(d_close.line_vs_league<=line_thr)
        report(d_close, mask, "under", f"sum>={sum_thr}, line_vs_league<={line_thr}")

L("\nTOTAL UNDER trap fires -> BET OVER (mean reversion thesis)")
for sum_thr in [3,4,5,6,8]:
    for line_thr in [1,2,3,4]:
        mask=(d_close.total_miss_sum_last3<=-sum_thr)&(d_close.line_vs_league>=line_thr)
        report(d_close, mask, "over", f"sum<=-{sum_thr}, line_vs_league>={line_thr}")

# Per-season breakdown for the most-fired strict variant
L("\n"+"="*96); L("PER-SEASON: fade-OVER-trap (sum>=4, line<=-2 -> bet UNDER)"); L("="*96)
mask=(d_close.total_miss_sum_last3>=4)&(d_close.line_vs_league<=-2)
sub=d_close[mask]
for Y in sorted(sub.season.unique()):
    sy=sub[sub.season==Y]
    hit=(sy.actual_total<sy.nv_total_line).astype(float)[sy.actual_total != sy.nv_total_line]
    k=int(hit.sum()); n=len(hit); lo,hi=wilson_ci(k,n) if n else (0,0)
    L(f"  {int(Y)}: n={n:3d} UNDER hit={(k/n*100 if n else 0):5.1f}% CI[{lo*100:.0f},{hi*100:.0f}]")
L(f"\nPER-SEASON: fade-UNDER-trap (sum<=-4, line>=+2 -> bet OVER)")
mask=(d_close.total_miss_sum_last3<=-4)&(d_close.line_vs_league>=2)
sub=d_close[mask]
for Y in sorted(sub.season.unique()):
    sy=sub[sub.season==Y]
    hit=(sy.actual_total>sy.nv_total_line).astype(float)[sy.actual_total != sy.nv_total_line]
    k=int(hit.sum()); n=len(hit); lo,hi=wilson_ci(k,n) if n else (0,0)
    L(f"  {int(Y)}: n={n:3d} OVER hit={(k/n*100 if n else 0):5.1f}% CI[{lo*100:.0f},{hi*100:.0f}]")

# Same vs OPENER (only 2023-2025)
d_open=mm[mm.week>=4].merge(od[["season","home_ab","away_ab","open_total"]],on=["season","home_ab","away_ab"],how="inner").dropna(subset=["total_miss_sum_last3","open_total","actual_total"]).copy()
L(f"\n[data] OPEN-line test set (2023-2025 only): n={len(d_open)} games")

L("\n"+"="*96); L("FADE-THE-TRAP, vs OPEN LINE, 2023-2025"); L("="*96)
L("\nTOTAL OVER trap fires -> BET UNDER (open)")
for sum_thr in [3,4,5,6]:
    for line_thr in [-1,-2,-3]:
        mask=(d_open.total_miss_sum_last3>=sum_thr)&((d_open.open_total - d_open.season.map(league_tot))<=line_thr)
        report(d_open, mask, "under", f"sum>={sum_thr}, line_vs_league<={line_thr}", line_col="open_total")

L("\nTOTAL UNDER trap fires -> BET OVER (open)")
for sum_thr in [3,4,5,6]:
    for line_thr in [1,2,3]:
        mask=(d_open.total_miss_sum_last3<=-sum_thr)&((d_open.open_total - d_open.season.map(league_tot))>=line_thr)
        report(d_open, mask, "over", f"sum<=-{sum_thr}, line_vs_league>={line_thr}", line_col="open_total")

# ========== Spread-cover trap (FADE direction) on full sample ==========
L("\n"+"="*96); L("SPREAD COVER TRAPS — FADE direction, vs CLOSE, all seasons"); L("="*96)
L("\nHome-dog covering vs away-fav not covering -> FADE = bet AWAY")
mm["fade_home_cover_trap"]=((mm.h_margin_miss_s2d>=3)&(mm.a_margin_miss_s2d<=-3)&(mm.home_spread>0)).astype(int)
mm["fade_away_cover_trap"]=((mm.a_margin_miss_s2d>=3)&(mm.h_margin_miss_s2d<=-3)&(mm.home_spread<0)).astype(int)
d_sp=mm[mm.week>=4].dropna(subset=["h_margin_miss_s2d","a_margin_miss_s2d","nv_spread_line"]).copy()
# Bet away if home_cover_trap fires (fade), bet home if away_cover_trap fires (fade)
for thr in [2,3,4,5]:
    mask=(d_sp.h_margin_miss_s2d>=thr)&(d_sp.a_margin_miss_s2d<=-thr)&(d_sp.home_spread>0)
    sub=d_sp[mask]
    if len(sub)>=10:
        # FADE = bet away = away covers when actual_margin + home_spread < 0
        hit=(sub.actual_margin + sub.home_spread < 0).astype(float)
        k=int(hit.sum()); n=len(hit); lo,hi=wilson_ci(k,n)
        L(f"  h_miss>={thr}, a_miss<=-{thr}, home_dog: FADE=AWAY n={n:3d} hit={k/n*100:5.1f}% CI[{lo*100:.0f},{hi*100:.0f}]")
    mask2=(d_sp.a_margin_miss_s2d>=thr)&(d_sp.h_margin_miss_s2d<=-thr)&(d_sp.home_spread<0)
    sub2=d_sp[mask2]
    if len(sub2)>=10:
        hit=(sub2.actual_margin + sub2.home_spread > 0).astype(float)
        k=int(hit.sum()); n=len(hit); lo,hi=wilson_ci(k,n)
        L(f"  a_miss>={thr}, h_miss<=-{thr}, home_fav: FADE=HOME n={n:3d} hit={k/n*100:5.1f}% CI[{lo*100:.0f},{hi*100:.0f}]")

# ========== Honest direct (NOT fade) check for comparison ==========
L("\n"+"="*96); L("ORIGINAL HYPOTHESIS (FOLLOW the trap, not fade) — for comparison"); L("="*96)
L("\nFOLLOW: OVER trap -> bet OVER, all seasons vs CLOSE")
for sum_thr in [3,4,6]:
    for line_thr in [-1,-2,-3]:
        mask=(d_close.total_miss_sum_last3>=sum_thr)&(d_close.line_vs_league<=line_thr)
        report(d_close, mask, "over", f"FOLLOW sum>={sum_thr}, line<={line_thr}: bet OVER")
