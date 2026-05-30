"""
b52: Continuous spot-strength scoring, walk-forward (Y-2..Y-1 priors -> Y test) across 2023+2024+2025.
Each game gets a real-valued spot score combining (player prior) x (def coverage rate) x (def pressure rate),
so we can quintile-bin or regress instead of collapsing to a binary spot rule that lands on 1-2 defenses.
LOO baselines per (player, season). t-test Q5 vs Q1-4 and OLS slope of diff~score.
"""
import os, sys, warnings
import numpy as np, pandas as pd
from scipy import stats
warnings.filterwarnings("ignore")
sys.path.insert(0,os.path.dirname(os.path.abspath(__file__)))
DATA=os.path.join(os.path.dirname(os.path.abspath(__file__)),"data"); L=print
sp=pd.read_parquet(os.path.join(DATA,"scheme_plays.parquet"))
px=pd.read_parquet(os.path.join(DATA,"players_xwalk.parquet"))[["gsis_id","display_name"]]
nm=dict(zip(px.gsis_id,px.display_name))
def nn(p): return nm.get(p,p) if isinstance(p,str) else ""

lab=sp[(sp["pass"]==1)&sp.defense_man_zone_type.isin(["MAN_COVERAGE","ZONE_COVERAGE"])].copy()
lab["mz"]=np.where(lab.defense_man_zone_type=="MAN_COVERAGE","M","Z")
lab["pr"]=pd.to_numeric(lab.was_pressure,errors="coerce").fillna(0).astype(int)
lab["epa"]=pd.to_numeric(lab.epa,errors="coerce")

def priors(Y):
    s=lab[lab.season.isin([Y-2,Y-1])]
    q=s[s.mz=="M"].groupby("passer_player_id").agg(n=("epa","size"),epa_vs_man=("epa","mean")).reset_index()
    q=q[q.n>=60]
    w=s[(s.mz=="Z")&(s.pr==0)&s.receiver_player_id.notna()].groupby("receiver_player_id").agg(n=("epa","size"),epa_zNP=("epa","mean")).reset_index()
    w=w[w.n>=40]
    d=s.groupby("defteam").agg(n=("epa","size"),man_rate=("mz",lambda x:(x=="M").mean()),pressure_rate=("pr","mean")).reset_index()
    d["zone_rate"]=1-d.man_rate
    return q,w,d

def games(Y):
    p=sp[(sp["pass"]==1)&(sp.season==Y)].copy()
    p["yds"]=pd.to_numeric(p.yards_gained,errors="coerce").fillna(0)
    p["cp"]=pd.to_numeric(p.complete_pass,errors="coerce").fillna(0)
    q=p[p.cp==1].groupby(["game_id","passer_player_id","posteam","defteam","week"]).agg(pass_yds=("yds","sum")).reset_index()
    att=p.groupby(["game_id","passer_player_id"]).size().rename("att").reset_index()
    q=q.merge(att,on=["game_id","passer_player_id"]); q=q[q.att>=15]
    w=p[(p.cp==1)&p.receiver_player_id.notna()].groupby(["game_id","receiver_player_id","posteam","defteam","week"]).agg(rec_yds=("yds","sum")).reset_index()
    tg=p.dropna(subset=["receiver_player_id"]).groupby(["game_id","receiver_player_id"]).size().rename("tgts").reset_index()
    w=w.merge(tg,on=["game_id","receiver_player_id"]); w=w[w.tgts>=3]
    return q,w

AQ=[]; AW=[]
for Y in [2023,2024,2025]:
    qp,wp,dp=priors(Y); qg,wg=games(Y)
    qg=qg.merge(qp[["passer_player_id","epa_vs_man"]],on="passer_player_id",how="inner").merge(dp[["defteam","man_rate","pressure_rate"]],on="defteam",how="left")
    wg=wg.merge(wp[["receiver_player_id","epa_zNP"]],on="receiver_player_id",how="inner").merge(dp[["defteam","zone_rate","pressure_rate"]],on="defteam",how="left")
    qg["season"]=Y; wg["season"]=Y
    AQ.append(qg); AW.append(wg)
qb=pd.concat(AQ,ignore_index=True); wr=pd.concat(AW,ignore_index=True)
qb["name"]=qb.passer_player_id.map(nn); wr["name"]=wr.receiver_player_id.map(nn)
L(f"[data] qb-games {len(qb)} | wr-games {len(wr)} across 2023+2024+2025")

# LOO per (player, season)
def loo(df,keys,col):
    g=df.groupby(keys)[col]; s=g.transform("sum"); c=g.transform("size")
    return np.where(c>1,(s-df[col])/(c-1),np.nan)
qb["base"]=loo(qb,["passer_player_id","season"],"pass_yds"); qb["diff"]=qb.pass_yds-qb.base
wr["base"]=loo(wr,["receiver_player_id","season"],"rec_yds"); wr["diff"]=wr.rec_yds-wr.base

# Continuous scores
qb["score"]=(-qb.epa_vs_man)*qb.man_rate*qb.pressure_rate     # high = strong UNDER
wr["score"]=wr.epa_zNP*wr.zone_rate*(1-wr.pressure_rate)      # high = strong OVER

def report(df,label,ycol,direction):
    d=df.dropna(subset=["diff","score"]).copy()
    d["q"]=pd.qcut(d.score,5,labels=[1,2,3,4,5])
    L(f"\n{'='*92}\n{label} — quintile of continuous spot score (n={len(d)})\n{'='*92}")
    L(f"  {'Q':>2s} {'n':>4s} {'yds':>6s} {'base':>6s} {'diff':>8s} {'med_diff':>9s} {'%dir':>6s}")
    for q in [1,2,3,4,5]:
        s=d[d.q==q]; dr=(s["diff"]>0).mean() if direction=="over" else (s["diff"]<0).mean()
        L(f"  {q:>2d} {len(s):>4d} {s[ycol].mean():>6.1f} {s.base.mean():>6.1f} {s['diff'].mean():>+8.2f} {s['diff'].median():>+9.2f} {dr*100:>5.1f}%")
    sl=stats.linregress(d.score,d["diff"])
    L(f"  OLS  diff~score: slope={sl.slope:+.2f}, p={sl.pvalue:.4f}, R^2={sl.rvalue**2:.4f}")
    s5=d[d.q==5]; rest=d[d.q!=5]
    t,p=stats.ttest_ind(s5["diff"],rest["diff"],equal_var=False)
    L(f"  Q5 vs Q1-4: Q5 diff {s5['diff'].mean():+.2f} vs rest {rest['diff'].mean():+.2f}, t={t:.2f}, p={p:.4f} ({'SIGNIFICANT' if p<0.05 else 'not sig'})")
    L(f"  Q5 def mix (top spots concentrate in which defenses?):")
    print("    "+" ".join([f"{t}({c})" for t,c in s5.defteam.value_counts().head(6).items()]))
report(qb,"QB UNDER (passing yards vs LOO baseline)","pass_yds","under")
report(wr,"WR OVER (receiving yards vs LOO baseline)","rec_yds","over")

# Per-season breakdown for WR
L("\n"+"="*92); L("WR OVER — per-season check (does Q5 outperform every year?)"); L("="*92)
for Y in [2023,2024,2025]:
    d=wr[wr.season==Y].dropna(subset=["diff","score"]).copy()
    if len(d)<50: continue
    d["q"]=pd.qcut(d.score,5,labels=[1,2,3,4,5])
    s5=d[d.q==5]; rest=d[d.q!=5]
    t,p=stats.ttest_ind(s5["diff"],rest["diff"],equal_var=False)
    L(f"  {Y}: n={len(d)}  Q5 diff {s5['diff'].mean():+5.1f}  vs rest {rest['diff'].mean():+5.1f}  t={t:.2f} p={p:.4f}  Q5_n={len(s5)}")
