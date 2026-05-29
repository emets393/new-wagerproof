"""
Complete the matchup study with the RUSHING side (user asked passing/rushing).
RB/OL attribute mismatches vs the opposing front-7 -> (1) rushing OUTPUT (NGS rush-yards-over-expected),
(2) betting: offense ATS + game UNDER (run control -> ball control -> fewer possessions). Permutation null.
"""
import os, sys, warnings
import numpy as np, pandas as pd
warnings.filterwarnings("ignore")
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from stats_helpers import wilson_ci
DATA=os.path.join(os.path.dirname(os.path.abspath(__file__)),"data"); L=print
A=pd.read_parquet(os.path.join(DATA,"madden_attributes.parquet"))
T=pd.read_parquet(os.path.join(DATA,"offense_matchup.parquet"))
rush=pd.read_parquet(os.path.join(DATA,"ngs_rushing.parquet"))
nv2our={"LA":"LAR","SD":"LAC","STL":"LAR"}
NICK={'49ers':'SF','cardinals':'ARI','falcons':'ATL','ravens':'BAL','bills':'BUF','panthers':'CAR','bears':'CHI',
 'bengals':'CIN','browns':'CLE','cowboys':'DAL','broncos':'DEN','lions':'DET','packers':'GB','texans':'HOU',
 'colts':'IND','jaguars':'JAX','chiefs':'KC','chargers':'LAC','rams':'LAR','dolphins':'MIA','vikings':'MIN',
 'patriots':'NE','saints':'NO','giants':'NYG','jets':'NYJ','eagles':'PHI','steelers':'PIT','seahawks':'SEA',
 'buccaneers':'TB','titans':'TEN','commanders':'WAS','redskins':'WAS','team':'WAS'}
def to_ab(t,s):
    last=str(t).split()[-1].lower() if str(t).split() else ''
    return ('OAK' if s<=2019 else 'LV') if last=='raiders' else NICK.get(last)
A["ab"]=[to_ab(t,s) for t,s in zip(A.team,A.season)]; A=A.dropna(subset=["ab"])
def topmean(positions,n,cols):
    s=A[A.pos.isin(positions)].sort_values("ovr",ascending=False).groupby(["season","ab"]).head(n)
    return s.groupby(["season","ab"])[cols].mean()
RB=topmean({"HB","FB"},2,["speed","agility","strength","wt","acceleration"]).add_prefix("rb_")
DL=topmean({"LE","RE","DT"},4,["strength","wt"]).add_prefix("dl_")
LB=topmean({"MLB","LOLB","ROLB"},3,["speed","wt","strength"]).add_prefix("lb_")
off_r=RB.reset_index(); def_r=pd.concat([DL,LB],axis=1).reset_index()   # ol_* already in T (from b23)
T=T.merge(off_r.rename(columns={"ab":"off_ab"}),on=["season","off_ab"],how="left").merge(def_r.rename(columns={"ab":"def_ab"}),on=["season","def_ab"],how="left")
# rushing output: primary RB RYOE (or efficiency) per team-game
rush["ab"]=rush.team.replace(nv2our); ycol="rush_yards_over_expected" if "rush_yards_over_expected" in rush.columns else ("efficiency" if "efficiency" in rush.columns else "rush_yards")
rb=rush.sort_values("rush_attempts" if "rush_attempts" in rush.columns else ycol,ascending=False).groupby(["season","week","ab"]).head(1)[["season","week","ab",ycol]].rename(columns={ycol:"ryoe"})
T=T.merge(rb.rename(columns={"ab":"off_ab"}),on=["season","week","off_ab"],how="left")
# rushing mismatches
T["m_ol_dl_str"]=T.ol_strength-T.dl_strength; T["m_ol_dl_wt"]=T.ol_wt-T.dl_wt
T["m_rb_lb_speed"]=T.rb_speed-T.lb_speed; T["m_rb_box_agility"]=T.rb_agility-T.lb_speed; T["m_rb_power"]=T.rb_strength-T.dl_strength
RMIS=["m_ol_dl_str","m_ol_dl_wt","m_rb_lb_speed","m_rb_box_agility","m_rb_power"]
for c in RMIS+["ryoe"]: T[c]=pd.to_numeric(T[c],errors="coerce")

L("="*90); L("RUSHING — mechanism: do OL/RB mismatches predict rush-yards-over-expected?"); L("="*90)
d=T.dropna(subset=["ryoe"]+RMIS)
for f in RMIS: L(f"  {f:18s} corr with RYOE: r={np.corrcoef(d[f],d.ryoe)[0,1]:+.3f}")
L(f"  (n={len(d)})")
L("\n"+"="*90); L("RUSHING — betting: quartile spots -> offense ATS + game UNDER (close), permutation null"); L("="*90)
def masks(df):
    o={}
    for f in RMIS:
        o[f+"_HI"]=df[f]>=df[f].quantile(.75); o[f+"_LO"]=df[f]<=df[f].quantile(.25)
    return o
def cpass(df,tgt,mk,thr=.535,nmin=120):
    p=0;r={}
    for nm,m in mk.items():
        y=df.loc[m,tgt].dropna(); n=len(y); h=y.mean() if n else 0
        if n>=nmin and h>=thr:p+=1
        r[nm]=(h,n)
    return p,r
T["under_close"]=1-T["over_close"]
for tgt in ["off_cover","under_close"]:
    sub=T.dropna(subset=[tgt]).copy(); mk=masks(sub); real,res=cpass(sub,tgt,mk)
    rng=np.random.default_rng(0); nc=[]
    for _ in range(300):
        s=sub.copy(); s[tgt]=s.groupby("season")[tgt].transform(lambda x:rng.permutation(x.values)); nc.append(cpass(s,tgt,mk)[0])
    nc=np.array(nc); L(f"  [{tgt}] real passers={real} vs null mean={nc.mean():.1f} (95th={np.quantile(nc,.95):.0f}) -> {'ENRICHED' if real>np.quantile(nc,.95) else 'NO signal'}")
    top=sorted(res.items(),key=lambda kv:-kv[1][0])[:3]
    for nm,(h,n) in top: lo,hi=wilson_ci(int(h*n),n); L(f"     top: {nm:20s} {h*100:.1f}% (n={n}) CI[{lo*100:.0f},{hi*100:.0f}]")
