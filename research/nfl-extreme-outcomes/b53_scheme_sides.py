"""
b53: SIDES test using player-level scheme priors as matchup features (the test b49 didn't run).
For each game: identify each offense's primary QB + targeted WRs, look up their PRIOR (Y-2..Y-1) EPA
priors from b50 (QB-vs-MAN: stable 0.33; WR zone-no-pressure: stable 0.39). Combine with opposing
defense's PRIOR coverage/pressure rates -> per-team offense matchup score. Home-away differential
is the feature. Test ATS vs OPENER (held-out 2023+2024+2025, walk-forward priors).
"""
import os, sys, warnings
import numpy as np, pandas as pd
from scipy import stats
warnings.filterwarnings("ignore")
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from stats_helpers import wilson_ci
DATA=os.path.join(os.path.dirname(os.path.abspath(__file__)),"data"); L=print
sp=pd.read_parquet(os.path.join(DATA,"scheme_plays.parquet"))
m=pd.read_parquet(os.path.join(DATA,"matchup.parquet"))
od=pd.read_parquet(os.path.join(DATA,"odds_consensus.parquet"))
px=pd.read_parquet(os.path.join(DATA,"players_xwalk.parquet"))[["gsis_id","display_name"]]
nm=dict(zip(px.gsis_id,px.display_name))

m["actual_margin"]=m.home_score-m.away_score
nv2our={"LA":"LAR","SD":"LAC","STL":"LAR"}
sp["posteam"]=sp.posteam.replace(nv2our); sp["defteam"]=sp.defteam.replace(nv2our)
lab=sp[(sp["pass"]==1)&sp.defense_man_zone_type.isin(["MAN_COVERAGE","ZONE_COVERAGE"])].copy()
lab["mz"]=np.where(lab.defense_man_zone_type=="MAN_COVERAGE","M","Z")
lab["pr"]=pd.to_numeric(lab.was_pressure,errors="coerce").fillna(0).astype(int)
lab["epa"]=pd.to_numeric(lab.epa,errors="coerce")

def priors(Y):
    s=lab[lab.season.isin([Y-2,Y-1])]
    qbM=s[s.mz=="M"].groupby("passer_player_id").agg(n=("epa","size"),v=("epa","mean")).reset_index()
    qbM=qbM[qbM.n>=60].rename(columns={"v":"epa_vs_man"})[["passer_player_id","epa_vs_man"]]
    qbZ=s[s.mz=="Z"].groupby("passer_player_id").agg(n=("epa","size"),v=("epa","mean")).reset_index()
    qbZ=qbZ[qbZ.n>=60].rename(columns={"v":"epa_vs_zone"})[["passer_player_id","epa_vs_zone"]]
    qbp=qbM.merge(qbZ,on="passer_player_id",how="outer")
    wp=s[(s.mz=="Z")&(s.pr==0)&s.receiver_player_id.notna()].groupby("receiver_player_id").agg(n=("epa","size"),v=("epa","mean")).reset_index()
    wp=wp[wp.n>=40].rename(columns={"v":"epa_zNP"})[["receiver_player_id","epa_zNP"]]
    d=s.groupby("defteam").agg(n=("epa","size"),man_rate=("mz",lambda x:(x=="M").mean()),pressure_rate=("pr","mean")).reset_index()
    d["zone_rate"]=1-d.man_rate
    return qbp,wp,d

# Build per-team-game offense features for each test year
big=[]; dprs=[]
for Y in [2023,2024,2025]:
    qbp,wp,dp=priors(Y)
    dp["season"]=Y; dprs.append(dp)
    p=sp[(sp["pass"]==1)&(sp.season==Y)].copy()
    qc=p.groupby(["season","week","posteam","passer_player_id"]).size().reset_index(name="n")
    qprim=qc.sort_values("n",ascending=False).drop_duplicates(["season","week","posteam"]).merge(qbp,on="passer_player_id",how="left")
    qprim["qb_name"]=qprim.passer_player_id.map(nm.get)
    wt=p.dropna(subset=["receiver_player_id"]).groupby(["season","week","posteam","receiver_player_id"]).size().reset_index(name="tgts")
    wt=wt.merge(wp,on="receiver_player_id",how="inner")
    ww=wt.groupby(["season","week","posteam"]).apply(lambda g:pd.Series({"wr_zNP_w":(g.epa_zNP*g.tgts).sum()/g.tgts.sum(),"wr_n":g.tgts.sum(),"n_wr_match":len(g)})).reset_index()
    off=qprim[["season","week","posteam","passer_player_id","qb_name","epa_vs_man","epa_vs_zone"]].merge(ww,on=["season","week","posteam"],how="left")
    big.append(off)
oa=pd.concat(big,ignore_index=True); dp_all=pd.concat(dprs,ignore_index=True)

# Join to matchup. Build home + away offense features per game.
mt=m[m.season.isin([2023,2024,2025])].copy()
ho=oa.rename(columns={"posteam":"home_ab","epa_vs_man":"h_qb_M","epa_vs_zone":"h_qb_Z","wr_zNP_w":"h_wr_zNP","wr_n":"h_wrn","qb_name":"h_qb"})
ao=oa.rename(columns={"posteam":"away_ab","epa_vs_man":"a_qb_M","epa_vs_zone":"a_qb_Z","wr_zNP_w":"a_wr_zNP","wr_n":"a_wrn","qb_name":"a_qb"})
mt=mt.merge(ho[["season","week","home_ab","h_qb_M","h_qb_Z","h_wr_zNP","h_wrn","h_qb"]],on=["season","week","home_ab"],how="left")
mt=mt.merge(ao[["season","week","away_ab","a_qb_M","a_qb_Z","a_wr_zNP","a_wrn","a_qb"]],on=["season","week","away_ab"],how="left")
hd=dp_all.rename(columns={"defteam":"home_ab","man_rate":"h_dM","pressure_rate":"h_dP","zone_rate":"h_dZ"})[["season","home_ab","h_dM","h_dP","h_dZ"]]
ad=dp_all.rename(columns={"defteam":"away_ab","man_rate":"a_dM","pressure_rate":"a_dP","zone_rate":"a_dZ"})[["season","away_ab","a_dM","a_dP","a_dZ"]]
mt=mt.merge(hd,on=["season","home_ab"],how="left").merge(ad,on=["season","away_ab"],how="left")

# Score: home offense expected EPA-ish = QB-vs-coverage component + WR zone-no-pressure component
# QB component: weighted by opposing D's coverage mix, dampened by opposing D's pressure rate
# WR component: rewards good zone-killers against zone-heavy + pressure-weak Ds
mt["h_off"] = (mt.h_qb_M*mt.a_dM + mt.h_qb_Z*mt.a_dZ) - 0.5*mt.a_dP + mt.h_wr_zNP*mt.a_dZ*(1-mt.a_dP)
mt["a_off"] = (mt.a_qb_M*mt.h_dM + mt.a_qb_Z*mt.h_dZ) - 0.5*mt.h_dP + mt.a_wr_zNP*mt.h_dZ*(1-mt.h_dP)
mt["diff"]=mt.h_off-mt.a_off  # positive = home offense favored by matchup

# Test ATS vs OPENER
od2=od[od.season.isin([2023,2024,2025])][["season","home_ab","away_ab","open_spread"]]
mt=mt.merge(od2,on=["season","home_ab","away_ab"],how="left")
mt["hco_open"]=(mt.actual_margin+mt.open_spread>0).astype(float); mt.loc[mt.actual_margin+mt.open_spread==0,"hco_open"]=np.nan
test=mt.dropna(subset=["diff","hco_open","open_spread"]).copy()
L(f"[test] games eligible (2023+2024+2025, ATS vs opener, scheme features present): {len(test)}")

test["q"]=pd.qcut(test["diff"],5,labels=[1,2,3,4,5])
L(f"\nQuintile of matchup_diff -> home cover vs OPENER:")
for q in [1,2,3,4,5]:
    s=test[test.q==q]; c=s.hco_open.mean(); n=len(s); k=int(s.hco_open.sum())
    lo,hi=wilson_ci(k,n)
    L(f"  Q{q}: n={n:4d}  home_cover={c*100:5.1f}%  CI[{lo*100:.0f},{hi*100:.0f}]")

# Bet Q5-home + Q1-away (matchup-favored side)
bh=test[test.q==5]; ba=test[test.q==1]
won=pd.concat([bh.hco_open, 1-ba.hco_open]).dropna(); k=int(won.sum()); n=len(won); lo,hi=wilson_ci(k,n)
L(f"\nBet matchup-favored side (Q5 home + Q1 away): n={n}, hit={k/n*100:.1f}%, CI[{lo*100:.0f},{hi*100:.0f}] (52.4% breakeven)")
# OLS
sl=stats.linregress(test["diff"],test.hco_open)
L(f"OLS hco_open ~ diff: slope={sl.slope:+.3f}, p={sl.pvalue:.4f}, R^2={sl.rvalue**2:.4f}")

L(f"\nPer-season Q5+Q1-flip ATS (sanity check):")
for Y in [2023,2024,2025]:
    s=test[test.season==Y].copy(); s["q"]=pd.qcut(s["diff"],5,labels=[1,2,3,4,5],duplicates="drop")
    bh=s[s.q==5]; ba=s[s.q==1]
    won=pd.concat([bh.hco_open,1-ba.hco_open]).dropna(); k=int(won.sum()); n=len(won)
    L(f"  {Y}: n={n}, hit={k/n*100:.1f}%")

L(f"\nTop 10 home-matchup-favored spots (highest diff):")
L(f"  {'wk':>3s} matchup    {'diff':>6s} {'open':>5s} {'margin':>6s} cov  QB(h)        QB(a)")
for _,r in test.nlargest(10,"diff").iterrows():
    L(f"  {int(r.week):3d} {r.away_ab}@{r.home_ab:3s}    {r['diff']:+6.3f} {r.open_spread:+5.1f} {int(r.actual_margin):+6d}  {int(r.hco_open)}    {str(r.h_qb)[:12]:12s} {str(r.a_qb)[:12]}")
L(f"\nTop 10 away-matchup-favored spots (lowest diff):")
for _,r in test.nsmallest(10,"diff").iterrows():
    L(f"  {int(r.week):3d} {r.away_ab}@{r.home_ab:3s}    {r['diff']:+6.3f} {r.open_spread:+5.1f} {int(r.actual_margin):+6d}  {int(r.hco_open)}    {str(r.h_qb)[:12]:12s} {str(r.a_qb)[:12]}")
