"""
b66: TIGHT-SPREAD games comprehensive signal battery (|open_spread| <= 3).
Per user framework: open-source signal -> grade vs OPEN, movement signal -> grade vs MOVED line.

Tests:
  1. ML divergence (open ML vs spread implied) — open signal, grade vs open
  2. Spread juice (DK) — open signal, grade vs open
  3. Power rating: differential + tier matchups (top10/top10 vs bot/bot vs mismatched)
  4. Last game ATS result (momentum/regression)
  5. Primetime split in tight games
  6. Line movement (grade vs LINE AT TRIGGER TIME, not open — per framework)
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
m["pr_diff"]=m.home_predictive_pr-m.away_predictive_pr

# Master frame with open lines
g=m[["season","week","home_ab","away_ab","home_score","away_score","actual_margin","actual_total",
     "home_predictive_pr","away_predictive_pr","pr_diff","primetime","home_spread"]].merge(
    od[["season","home_ab","away_ab","open_spread","close_spread","open_total","close_total",
        "open_ml_home","close_ml_home","open_ml_away","close_ml_away","spread_move","total_move","ml_home_move"]],
    on=["season","home_ab","away_ab"],how="inner")

# DK close juice (open-level not consistently available)
o=pd.read_parquet(os.path.join(DATA,"odds_hist.parquet"))
dk=o[o.book=="draftkings"].copy()
dk["snap_ts"]=pd.to_datetime(dk.snap_ts,utc=True); dk["commence_time"]=pd.to_datetime(dk.commence_time,utc=True)
dk=dk[dk.snap_ts<=dk.commence_time]
TM={'Arizona':'ARI','Atlanta':'ATL','Baltimore':'BAL','Buffalo':'BUF','Carolina':'CAR','Chicago':'CHI','Cincinnati':'CIN','Cleveland':'CLE','Dallas':'DAL','Denver':'DEN','Detroit':'DET','Green Bay':'GB','Houston':'HOU','Indianapolis':'IND','Jacksonville':'JAX','Kansas City':'KC','Los Angeles Chargers':'LAC','Los Angeles Rams':'LAR','Las Vegas':'LV','Miami':'MIA','Minnesota':'MIN','New England':'NE','New Orleans':'NO','New York Giants':'NYG','New York Jets':'NYJ','Philadelphia':'PHI','Pittsburgh':'PIT','San Francisco':'SF','Seattle':'SEA','Tampa Bay':'TB','Tennessee':'TEN','Washington':'WAS'}
dk_open=dk.sort_values("snap_ts").drop_duplicates(["season","home_team","away_team","commence_time"],keep="first")
dk_close=dk.sort_values("snap_ts").drop_duplicates(["season","home_team","away_team","commence_time"],keep="last")
for d in [dk_open,dk_close]:
    d["home_ab"]=d.home_team.map(TM); d["away_ab"]=d.away_team.map(TM)
do=dk_open[["season","home_ab","away_ab","commence_time","spread_home_price","ml_home","ml_away"]].rename(columns={"spread_home_price":"dk_juice_open","ml_home":"dk_ml_h_open","ml_away":"dk_ml_a_open"})
do=do.sort_values("commence_time").drop_duplicates(["season","home_ab","away_ab"],keep="first").drop(columns=["commence_time"])
dc=dk_close[["season","home_ab","away_ab","commence_time","spread_home_price"]].rename(columns={"spread_home_price":"dk_juice_close"})
dc=dc.sort_values("commence_time").drop_duplicates(["season","home_ab","away_ab"],keep="first").drop(columns=["commence_time"])
g=g.merge(do,on=["season","home_ab","away_ab"],how="left").merge(dc,on=["season","home_ab","away_ab"],how="left")

# Compute outcomes vs OPEN and vs CLOSE (per framework)
g["hco_open"]=(g.actual_margin+g.open_spread>0).astype(float); g.loc[g.actual_margin+g.open_spread==0,"hco_open"]=np.nan
g["hco_close"]=(g.actual_margin+g.close_spread>0).astype(float); g.loc[g.actual_margin+g.close_spread==0,"hco_close"]=np.nan
g["over_open"]=(g.actual_total>g.open_total).astype(float); g.loc[g.actual_total==g.open_total,"over_open"]=np.nan
g["over_close"]=(g.actual_total>g.close_total).astype(float); g.loc[g.actual_total==g.close_total,"over_close"]=np.nan

# Last game ATS result per team
def team_ats_history(m):
    h=m[["season","week","home_ab","home_spread","home_score","away_score"]].rename(columns={"home_ab":"team","home_spread":"spread"})
    h["margin"]=h.home_score-h.away_score
    a=m[["season","week","away_ab","home_spread","home_score","away_score"]].rename(columns={"away_ab":"team","home_spread":"home_spread_orig"})
    a["spread"]=-a.home_spread_orig
    a["margin"]=a.away_score-a.home_score
    t=pd.concat([h[["season","week","team","spread","margin"]],a[["season","week","team","spread","margin"]]],ignore_index=True)
    t["covered"]=(t.margin+t.spread>0).astype(float); t.loc[t.margin+t.spread==0,"covered"]=np.nan
    t=t.sort_values(["team","season","week"])
    t["last_covered"]=t.groupby(["team","season"]).covered.shift(1)
    t["last_margin"]=t.groupby(["team","season"]).margin.shift(1)
    return t[["season","week","team","last_covered","last_margin"]]
ats=team_ats_history(m)
g=g.merge(ats.rename(columns={"team":"home_ab","last_covered":"h_last_cov","last_margin":"h_last_marg"}),on=["season","week","home_ab"],how="left")
g=g.merge(ats.rename(columns={"team":"away_ab","last_covered":"a_last_cov","last_margin":"a_last_marg"}),on=["season","week","away_ab"],how="left")

# Power rating tiers (within season percentile)
g["h_pr_pct"]=g.groupby("season").home_predictive_pr.rank(pct=True)
g["a_pr_pct"]=g.groupby("season").away_predictive_pr.rank(pct=True)
g["h_tier"]=pd.cut(g.h_pr_pct,bins=[0,0.33,0.67,1.01],labels=["bot","mid","top"])
g["a_tier"]=pd.cut(g.a_pr_pct,bins=[0,0.33,0.67,1.01],labels=["bot","mid","top"])

# Filter to tight games
tight=g[g.open_spread.abs()<=3].copy()
L(f"[data] tight games (|open_spread|<=3) n={len(tight)} over 2023-2025")

# Helper for clean reporting
def report(d, win_col, label, thr=52.4, min_n=10):
    d=d.dropna(subset=[win_col])
    n=len(d); k=int(d[win_col].sum())
    if n<min_n: L(f"  {label:65s} n={n} (too few)"); return
    lo,hi=wilson_ci(k,n); roi=(k*100/110-(n-k))/n*100
    edge="*" if k/n>=thr/100 else " "
    L(f"  {label:65s} n={n:3d} hit={k/n*100:5.1f}% CI[{lo*100:.0f},{hi*100:.0f}] ROI={roi:+5.1f}% {edge}")

# ================================ TEST 1: ML DIVERGENCE in tight games ================================
L(f"\n{'='*92}\nTEST 1: ML DIVERGENCE in tight games (signal: open ML; grade: vs OPEN)\n{'='*92}")
def ml_p(ml):
    if pd.isna(ml) or ml==0: return np.nan
    return -ml/(-ml+100) if ml<0 else 100/(ml+100)
tight["ml_h_imp"]=tight.open_ml_home.apply(ml_p)
tight["ml_a_imp"]=tight.open_ml_away.apply(ml_p)
tight["ml_h_nv"]=tight.ml_h_imp/(tight.ml_h_imp+tight.ml_a_imp)
# Empirical spread -> SU win rate
m["fav_won"]=((m.home_spread<0)&(m.actual_margin>0))|((m.home_spread>0)&(m.actual_margin<0))
m["sp_b"]=(m.home_spread.abs()/0.5).round()*0.5
sp_lookup=dict(zip(m.groupby("sp_b").fav_won.mean().index, m.groupby("sp_b").fav_won.mean().values))
def sp2(s): return sp_lookup.get(round(abs(s)/0.5)*0.5,0.5) if pd.notna(s) else np.nan
tight["sp_imp_h"]=tight.open_spread.apply(lambda s: sp2(s) if s<0 else (1-sp2(s)) if s>0 else 0.5)
tight["div_h"]=tight.ml_h_nv - tight.sp_imp_h
# Soft home ML (home ML implies less than spread) -> bet home? Or bet away?
for thr in [0.02,0.03,0.04,0.05]:
    sub=tight[tight.div_h<=-thr]   # home ML softer than spread
    report(sub, "hco_open", f"home ML SOFT by {thr*100:.0f}pp -> bet HOME")
    won=1-sub.hco_open.dropna(); k=int(won.sum()); n=len(won)
    if n>=10:
        lo,hi=wilson_ci(k,n); roi=(k*100/110-(n-k))/n*100
        L(f"  {'  same set -> bet AWAY':65s} n={n:3d} hit={k/n*100:5.1f}% CI[{lo*100:.0f},{hi*100:.0f}] ROI={roi:+5.1f}%")
for thr in [0.02,0.03,0.04,0.05]:
    sub=tight[tight.div_h>=thr]   # home ML tighter than spread
    report(sub, "hco_open", f"home ML TIGHT by {thr*100:.0f}pp -> bet HOME")

# ================================ TEST 2: DK SPREAD JUICE in tight games ================================
L(f"\n{'='*92}\nTEST 2: DK SPREAD JUICE in tight games (signal: open juice; grade: vs OPEN)\n{'='*92}")
for jthr in [-110,-115,-120,-125]:
    sub=tight[tight.dk_juice_open<=jthr]
    report(sub, "hco_open", f"DK home_juice_open<={jthr} -> bet HOME")
for jthr in [-105,-100,100]:
    sub=tight[tight.dk_juice_open>=jthr]
    report(sub, "hco_open", f"DK home_juice_open>={jthr} (away juiced) -> bet AWAY (1-hco)")
    won=1-sub.hco_open.dropna(); k=int(won.sum()); n=len(won)
    if n>=10:
        lo,hi=wilson_ci(k,n); roi=(k*100/110-(n-k))/n*100
        L(f"  {'  bet AWAY':65s} n={n:3d} hit={k/n*100:5.1f}% CI[{lo*100:.0f},{hi*100:.0f}] ROI={roi:+5.1f}%")

# ================================ TEST 3: PR TIER MATCHUPS ================================
L(f"\n{'='*92}\nTEST 3: PR TIER MATCHUPS in tight games (signal: pre-game PR; grade: vs OPEN)\n{'='*92}")
for h_t in ["top","mid","bot"]:
    for a_t in ["top","mid","bot"]:
        sub=tight[(tight.h_tier==h_t)&(tight.a_tier==a_t)]
        if len(sub)<10: continue
        L(f"  HOME={h_t}, AWAY={a_t}:")
        report(sub, "hco_open", f"   bet HOME")
        wona=1-sub.hco_open.dropna(); k=int(wona.sum()); n=len(wona)
        if n>=10:
            lo,hi=wilson_ci(k,n); roi=(k*100/110-(n-k))/n*100
            L(f"  {'   bet AWAY':65s} n={n:3d} hit={k/n*100:5.1f}% CI[{lo*100:.0f},{hi*100:.0f}] ROI={roi:+5.1f}%")

# PR differential alone
L(f"\nPR DIFFERENTIAL in tight games (signal: pre-game PR; grade: vs OPEN)")
for thr in [1,2,3,5]:
    sub_h=tight[tight.pr_diff>=thr]   # home better PR
    sub_a=tight[tight.pr_diff<=-thr]  # away better PR
    report(sub_h, "hco_open", f"pr_diff>=+{thr} (home better) -> bet HOME")
    won=1-sub_a.hco_open.dropna(); k=int(won.sum()); n=len(won)
    if n>=10:
        lo,hi=wilson_ci(k,n); roi=(k*100/110-(n-k))/n*100
        L(f"  {'  pr_diff<=-'+str(thr)+' (away better) -> bet AWAY':65s} n={n:3d} hit={k/n*100:5.1f}% CI[{lo*100:.0f},{hi*100:.0f}] ROI={roi:+5.1f}%")
L(f"\nFADE-PR signal (already locked, retest in tight context):")
for thr in [1,2,3,5]:
    sub=tight[tight.pr_diff>=thr]
    won=1-sub.hco_open.dropna(); k=int(won.sum()); n=len(won)
    if n>=10:
        lo,hi=wilson_ci(k,n); roi=(k*100/110-(n-k))/n*100
        L(f"  {'FADE: pr_diff>=+'+str(thr)+' -> bet AWAY':65s} n={n:3d} hit={k/n*100:5.1f}% CI[{lo*100:.0f},{hi*100:.0f}] ROI={roi:+5.1f}%")
    sub_a=tight[tight.pr_diff<=-thr]
    report(sub_a, "hco_open", f"FADE: pr_diff<=-{thr} -> bet HOME")

# ================================ TEST 4: LAST GAME ATS effect ================================
L(f"\n{'='*92}\nTEST 4: LAST GAME ATS effect in tight games (signal: last week result; grade: vs OPEN)\n{'='*92}")
# Did teams that covered last week continue to cover?
both_cov=tight[(tight.h_last_cov==1)&(tight.a_last_cov==0)]   # home covered, away didn't
report(both_cov, "hco_open", "home covered, away DIDN'T cover -> bet HOME")
both_inv=tight[(tight.h_last_cov==0)&(tight.a_last_cov==1)]
won=1-both_inv.hco_open.dropna(); k=int(won.sum()); n=len(won)
if n>=10:
    lo,hi=wilson_ci(k,n); roi=(k*100/110-(n-k))/n*100
    L(f"  {'away covered, home DIDN_T -> bet AWAY':65s} n={n:3d} hit={k/n*100:5.1f}% CI[{lo*100:.0f},{hi*100:.0f}] ROI={roi:+5.1f}%")
# FADE: bet against the team that covered last
report(both_cov.assign(faded=1-both_cov.hco_open).rename(columns={"faded":"hco_open"}).rename(columns={"hco_open":"_hh"}), "_hh", "FADE momentum (home covered) -> bet AWAY") if False else None
# Simpler: bet last-week covered team
sub=tight[tight.h_last_cov==1]
report(sub, "hco_open", "home covered LAST WEEK -> bet HOME this week")
sub=tight[tight.h_last_cov==0]
report(sub, "hco_open", "home FAILED to cover LAST WEEK -> bet HOME this week (fade)")
sub=tight[tight.a_last_cov==1]
won=1-sub.hco_open.dropna(); k=int(won.sum()); n=len(won)
if n>=10:
    lo,hi=wilson_ci(k,n); roi=(k*100/110-(n-k))/n*100
    L(f"  {'away covered LAST WEEK -> bet AWAY this week':65s} n={n:3d} hit={k/n*100:5.1f}% CI[{lo*100:.0f},{hi*100:.0f}] ROI={roi:+5.1f}%")

# ================================ TEST 5: PRIMETIME SPLIT ================================
L(f"\n{'='*92}\nTEST 5: PRIMETIME in tight games (signal: scheduled primetime; grade: vs OPEN)\n{'='*92}")
tight["pt"]=tight.primetime.fillna(0).astype(int)
pt=tight[tight.pt==1]; np_=tight[tight.pt==0]
L(f"  primetime tight games: n={len(pt)}, non-primetime tight: n={len(np_)}")
# In primetime tight games, does the favorite cover more?
pt_fav=pt[pt.open_spread<0]   # home fav
pt_dog=pt[pt.open_spread>0]
report(pt_fav, "hco_open", "PRIMETIME + home fav -> bet HOME")
won=1-pt_dog.hco_open.dropna(); k=int(won.sum()); n=len(won)
if n>=10: lo,hi=wilson_ci(k,n); roi=(k*100/110-(n-k))/n*100; L(f"  {'PRIMETIME + home dog -> bet AWAY':65s} n={n:3d} hit={k/n*100:5.1f}% CI[{lo*100:.0f},{hi*100:.0f}] ROI={roi:+5.1f}%")
# Test home dog covers in PT
report(pt_dog, "hco_open", "PRIMETIME + home DOG -> bet HOME (dog cover)")
# Primetime UNDER?
report(pt, "over_open", "PRIMETIME tight -> bet OVER", thr=52.4)
won=1-pt.over_open.dropna(); k=int(won.sum()); n=len(won)
if n>=10: lo,hi=wilson_ci(k,n); roi=(k*100/110-(n-k))/n*100; L(f"  {'PRIMETIME tight -> bet UNDER':65s} n={n:3d} hit={k/n*100:5.1f}% CI[{lo*100:.0f},{hi*100:.0f}] ROI={roi:+5.1f}%")

# ================================ TEST 6: LINE MOVEMENT (graded vs CLOSE per framework) ================================
L(f"\n{'='*92}\nTEST 6: LINE MOVEMENT in tight games (signal: movement; grade: vs CLOSE per framework)\n{'='*92}")
# spread_move = close - open. We bet at the moved-to line, so grade vs close.
for thr in [0.5,1.0,1.5,2.0]:
    bh=tight[tight.spread_move<=-thr]; ba=tight[tight.spread_move>=thr]
    won=pd.concat([bh.hco_close, 1-ba.hco_close]).dropna()
    k=int(won.sum()); n=len(won)
    if n>=10:
        lo,hi=wilson_ci(k,n); roi=(k*100/110-(n-k))/n*100
        L(f"  spread_move>={thr}: BET MOVEMENT side (vs CLOSE)              n={n:3d} hit={k/n*100:5.1f}% CI[{lo*100:.0f},{hi*100:.0f}] ROI={roi:+5.1f}%")
# Total movement (vs close)
for thr in [0.5,1.0,1.5]:
    bo=tight[tight.total_move>=thr]; bu=tight[tight.total_move<=-thr]
    won=pd.concat([bo.over_close, 1-bu.over_close]).dropna()
    k=int(won.sum()); n=len(won)
    if n>=10:
        lo,hi=wilson_ci(k,n); roi=(k*100/110-(n-k))/n*100
        L(f"  total_move>={thr}: BET MOVEMENT side (vs CLOSE)              n={n:3d} hit={k/n*100:5.1f}% CI[{lo*100:.0f},{hi*100:.0f}] ROI={roi:+5.1f}%")

# ================================ TEST 7: COMBO — primetime + tier matchup ================================
L(f"\n{'='*92}\nTEST 7: COMBO SPOTS\n{'='*92}")
# Top vs Top in primetime
ttp=tight[(tight.h_tier=="top")&(tight.a_tier=="top")&(tight.pt==1)]
report(ttp, "hco_open", "top-vs-top + primetime -> bet HOME")
report(ttp, "over_open", "top-vs-top + primetime -> bet OVER")
# Bot vs Bot
bb=tight[(tight.h_tier=="bot")&(tight.a_tier=="bot")]
report(bb, "hco_open", "bot-vs-bot tight -> bet HOME")
report(bb, "over_open", "bot-vs-bot tight -> bet OVER")
won=1-bb.over_open.dropna(); k=int(won.sum()); n=len(won)
if n>=10: lo,hi=wilson_ci(k,n); roi=(k*100/110-(n-k))/n*100; L(f"  {'bot-vs-bot tight -> bet UNDER':65s} n={n:3d} hit={k/n*100:5.1f}% CI[{lo*100:.0f},{hi*100:.0f}] ROI={roi:+5.1f}%")
# Mid vs Mid
mm=tight[(tight.h_tier=="mid")&(tight.a_tier=="mid")]
report(mm, "hco_open", "mid-vs-mid tight -> bet HOME")
report(mm, "over_open", "mid-vs-mid tight -> bet OVER")
# Heavy juice + PR confluence
sub=tight[(tight.dk_juice_open<=-120)&(tight.pr_diff>=2)]
report(sub, "hco_open", "heavy home juice + home PR adv -> bet HOME (confluence)")
sub=tight[(tight.dk_juice_open<=-120)&(tight.pr_diff<=-2)]
report(sub, "hco_open", "heavy home juice + away PR adv -> bet HOME (mismatch)")
