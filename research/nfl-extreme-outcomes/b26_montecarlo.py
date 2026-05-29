"""
Drive-based Monte Carlo game simulator — STEP 1: calibration-first.
Each team's points = sum of simulated drive outcomes {TD/FG/none}, with drive scoring driven by
own offense vs opponent defense points-per-drive (log5-style rate combine) + HFA. N sims/game -> full
margin & total distributions.

Calibration questions (decide if it's worth anything before building the full engine):
  (a) Does sim mean margin/total TRACK the market?  (b) Does it BEAT the market at predicting actuals? (expect NO)
  (c) Are the distributions realistic (margin std ~13.5, total std ~10, win-prob calibrated)?
  (d) EDGE: bet where sim disagrees w/ market, graded vs CLOSE and OPENER, held-out 2024-25.
"""
import os, sys, warnings
import numpy as np, pandas as pd
warnings.filterwarnings("ignore")
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from stats_helpers import wilson_ci
DATA=os.path.join(os.path.dirname(os.path.abspath(__file__)),"data"); L=print
m=pd.read_parquet(os.path.join(DATA,"matchup.parquet")); od=pd.read_parquet(os.path.join(DATA,"odds_consensus.parquet"))
m["actual_margin"]=m.home_score-m.away_score; m["actual_total"]=m.home_score+m.away_score
m["mkt_margin"]=-m.home_spread
need=["home_off_ppd_s2d","away_off_ppd_s2d","home_def_ppd_allowed_s2d","away_def_ppd_allowed_s2d"]
W=m[m.week>=4].dropna(subset=need+["actual_margin","mkt_margin","nv_total_line"]).copy()
LG=pd.concat([W.home_off_ppd_s2d,W.away_off_ppd_s2d]).median()           # league points/drive
L(f"[setup] league ppd={LG:.2f}  games(wk>=4)={len(W)}")
SHRINK=0.85; HFA_PTS=1.6; NDR=11; FG_RATIO=0.7; TD_PTS=6.97; FG_PTS=3.0; N=20000
DEN=TD_PTS+FG_PTS*FG_RATIO
def eppd(off,deff):  # own offense ppd x opp defense ppd allowed / league, mild shrink to mean
    o=LG+(off-LG)*SHRINK; d=LG+(deff-LG)*SHRINK; return np.clip(o*d/LG,0.3,4.5)
W["eppd_h"]=eppd(W.home_off_ppd_s2d,W.away_def_ppd_allowed_s2d)+HFA_PTS/NDR
W["eppd_a"]=eppd(W.away_off_ppd_s2d,W.home_def_ppd_allowed_s2d)
rng=np.random.default_rng(7)
def sim_team(eppd_arr):
    ptd=np.clip(eppd_arr/DEN,0.01,0.6); pfg=np.clip(ptd*FG_RATIO,0,0.4); p0=1-ptd-pfg
    out=np.zeros((len(eppd_arr),N))
    for i in range(len(eppd_arr)):
        d=rng.multinomial(NDR,[ptd[i],pfg[i],p0[i]],size=N); out[i]=TD_PTS*d[:,0]+FG_PTS*d[:,1]
    return out
HP=sim_team(W.eppd_h.values); AP=sim_team(W.eppd_a.values)
MARG=HP-AP; TOT=HP+AP
W["sim_margin"]=MARG.mean(1); W["sim_total"]=TOT.mean(1); W["sim_margin_sd"]=MARG.std(1)
W["sim_pwin"]=(MARG>0).mean(1)

def corr(a,b): return np.corrcoef(a,b)[0,1]
L("\n"+"="*86); L("CALIBRATION"); L("="*86)
L(f"  sim_margin vs MARKET margin: corr={corr(W.sim_margin,W.mkt_margin):.3f}   (high = tracks the line)")
L(f"  predicting ACTUAL margin:  sim corr={corr(W.sim_margin,W.actual_margin):.3f}  vs  MARKET corr={corr(W.mkt_margin,W.actual_margin):.3f}")
L(f"  sim_total vs MARKET total:  corr={corr(W.sim_total,W.nv_total_line):.3f}")
L(f"  predicting ACTUAL total:   sim corr={corr(W.sim_total,W.actual_total):.3f}  vs  MARKET corr={corr(W.nv_total_line,W.actual_total):.3f}")
L(f"  realism: sim margin sd={W.sim_margin_sd.mean():.1f} (NFL~13.5) | actual margin sd={W.actual_margin.std():.1f} | sim total mean={W.sim_total.mean():.1f} (NFL~44-45)")
L(f"  bias: sim_margin mean={W.sim_margin.mean():+.2f} vs market {W.mkt_margin.mean():+.2f} | sim_total {W.sim_total.mean():.1f} vs market {W.nv_total_line.mean():.1f}")
# win-prob calibration
L("  win-prob calibration (sim P(home win) -> actual home win rate):")
W["hw"]=(W.actual_margin>0).astype(int)
for lo in [0,.2,.4,.6,.8]:
    s=W[(W.sim_pwin>=lo)&(W.sim_pwin<lo+.2)]; L(f"     pwin[{lo:.1f}-{lo+.2:.1f}): predicted~{s.sim_pwin.mean()*100:4.0f}% actual={s.hw.mean()*100:4.0f}% (n={len(s)})") if len(s) else None

# EDGE test vs close + opener (held-out 2024-25)
L("\n"+"="*86); L("EDGE: bet where SIM disagrees with the market (held-out 2024-25)"); L("="*86)
d=W[W.season.isin([2024,2025])].merge(od[["season","home_ab","away_ab","open_spread","open_total","close_total"]],on=["season","home_ab","away_ab"],how="left")
d["spread_edge"]=d.sim_margin-d.mkt_margin; d["open_m"]=-d.open_spread
for thr in [2,3,4]:
    sub=d[d.spread_edge.abs()>=thr]
    for line,lab in [("mkt_margin","CLOSE"),("open_m","OPEN")]:
        s=sub.dropna(subset=[line]); hc=s.actual_margin>s[line]; push=s.actual_margin==s[line]
        won=np.where(s.spread_edge>0,hc,~hc)[~push.values]; n=len(won); k=int(won.sum()); lo,hi=wilson_ci(k,n) if n else (0,0)
        L(f"  spread |edge|>={thr} vs {lab}: {(k/n*100 if n else 0):.1f}% (n={n}) CI[{lo*100:.0f},{hi*100:.0f}]")
d["total_edge"]=d.sim_total-d.nv_total_line
for thr in [2,3]:
    sub=d[d.total_edge.abs()>=thr]
    for line,lab in [("nv_total_line","CLOSE"),("open_total","OPEN")]:
        s=sub.dropna(subset=[line]); ov=s.actual_total>s[line]; push=s.actual_total==s[line]
        won=np.where(s.total_edge>0,ov,~ov)[~push.values]; n=len(won); k=int(won.sum()); lo,hi=wilson_ci(k,n) if n else (0,0)
        L(f"  total  |edge|>={thr} vs {lab}: {(k/n*100 if n else 0):.1f}% (n={n}) CI[{lo*100:.0f},{hi*100:.0f}]")
