"""
FADE ALERTS — fade the legacy model when it's EXTREME (>=.80 or <=.20). The splits showed the model is
anti-calibrated at the extremes (conf>=.8 spread picks went 34.6% -> fade ~65%). Test it: dose-response by
threshold, graded vs CLOSE and vs OPENER, spread + O/U, + primetime. 2025 real preds (small n -> CIs shown).
"""
import os, sys, warnings
import numpy as np, pandas as pd
warnings.filterwarnings("ignore")
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from stats_helpers import wilson_ci
from fetch import cache, fetch_table
DATA=os.path.join(os.path.dirname(os.path.abspath(__file__)),"data"); L=print
leg=cache("nfl_predictions_epa", lambda: fetch_table("nfl_predictions_epa"))
for c in ["home_away_spread_cover_prob","ou_result_prob"]: leg[c]=pd.to_numeric(leg[c],errors="coerce")
leg["as_of_ts"]=pd.to_datetime(leg["as_of_ts"],errors="coerce",utc=True)
leg=leg.sort_values("as_of_ts").groupby("unique_id",as_index=False).first().rename(columns={"home_away_spread_cover_prob":"p_sp","ou_result_prob":"p_ou"})
m=pd.read_parquet(os.path.join(DATA,"matchup.parquet")); od=pd.read_parquet(os.path.join(DATA,"odds_consensus.parquet"))
m["actual_margin"]=m.home_score-m.away_score; m["actual_total"]=m.home_score+m.away_score; m["primetime_i"]=m.primetime.fillna(0).astype(int)
g=m[m.season==2025].merge(leg[["unique_id","p_sp","p_ou"]],on="unique_id",how="inner").merge(od[["season","home_ab","away_ab","open_spread","open_total"]],on=["season","home_ab","away_ab"],how="left")
g["home_cov_close"]=(g.actual_margin+g.home_spread>0).astype(float); g.loc[g.actual_margin+g.home_spread==0,"home_cov_close"]=np.nan
g["home_cov_open"]=(g.actual_margin+g.open_spread>0).astype(float); g.loc[g.actual_margin+g.open_spread==0,"home_cov_open"]=np.nan
g["over_close"]=(g.actual_total>g.nv_total_line).astype(float); g.loc[g.actual_total==g.nv_total_line,"over_close"]=np.nan
g["over_open"]=(g.actual_total>g.open_total).astype(float); g.loc[g.actual_total==g.open_total,"over_open"]=np.nan
L(f"[data] 2025 games w/ legacy preds: {len(g)}")

def fade_spread(df, thr, line):
    # model says home (p_sp>=thr) -> FADE -> bet AWAY covers (=1-home_cov); model says away (p_sp<=1-thr) -> bet HOME covers
    hi=df[df.p_sp>=thr]; loo=df[df.p_sp<=1-thr]
    won=pd.concat([1-hi[line], loo[line]]).dropna(); n=len(won); k=int(won.sum()); return n,k,len(hi),len(loo)
def fade_ou(df, thr, line):
    hi=df[df.p_ou>=thr]; loo=df[df.p_ou<=1-thr]
    won=pd.concat([1-hi[line], loo[line]]).dropna(); n=len(won); k=int(won.sum()); return n,k
def show(n,k,label):
    lo,hi=wilson_ci(k,n) if n else (0,0); flag=" (thin)" if n<25 else ""; L(f"  {label:34s} {(k/n*100 if n else 0):5.1f}%  n={n:3d}  CI[{lo*100:.0f},{hi*100:.0f}]{flag}")

L("\n"+"="*80); L("SPREAD FADE — fade model when >= thr (bet away) / <= 1-thr (bet home). Dose-response."); L("="*80)
for thr in [0.65,0.70,0.75,0.80,0.85]:
    n,k,nhi,nlo=fade_spread(g,thr,"home_cov_close"); show(n,k,f"fade>= {thr:.2f} vs CLOSE  (home-side n={nhi}, away-side n={nlo})")
L("  vs the OPENER (bettable):")
for thr in [0.70,0.80]:
    n,k,_,_=fade_spread(g,thr,"home_cov_open"); show(n,k,f"fade>= {thr:.2f} vs OPEN")
L("  fade>=.80 primetime vs non-primetime (vs close):")
for pt,lab in [(1,"primetime"),(0,"non-primetime")]:
    n,k,_,_=fade_spread(g[g.primetime_i==pt],0.80,"home_cov_close"); show(n,k,f"fade>=.80 {lab}")

L("\n"+"="*80); L("O/U FADE — fade model when >= thr (bet under) / <= 1-thr (bet over)"); L("="*80)
for thr in [0.65,0.70,0.75,0.80]:
    n,k=fade_ou(g,thr,"over_close"); show(n,k,f"fade>= {thr:.2f} vs CLOSE")
for thr in [0.70,0.80]:
    n,k=fade_ou(g,thr,"over_open"); show(n,k,f"fade>= {thr:.2f} vs OPEN")

# FOLLOW (not fade) at extremes for contrast — confirms fade is the right direction
L("\n"+"="*80); L("CONTRAST — FOLLOW the model at >=.80 (should be BAD if fade is right)"); L("="*80)
hi=g[g.p_sp>=0.80]; loo=g[g.p_sp<=0.20]; won=pd.concat([hi.home_cov_close,1-loo.home_cov_close]).dropna(); n=len(won);k=int(won.sum()); show(n,k,"FOLLOW spread >=.80/<=.20 vs close")
