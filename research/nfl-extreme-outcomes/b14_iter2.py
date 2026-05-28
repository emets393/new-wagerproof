"""
Iteration 2: add the home/away-split dog flag, schedule-based PRE-BYE, off-a-blowout, 3rd-road,
div-revenge (reused from tg.parquet), and a PASS-RUSH-vs-offense facet (defensive production layer).
Iterative held-out 2024-25 ATS vs OPENER: [iter1 best] -> +schedule spots -> +pass-rush facet.
"""
import os, sys, warnings
import numpy as np, pandas as pd
warnings.filterwarnings("ignore")
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from stats_helpers import wilson_ci, bet_summary, fmt
from sklearn.ensemble import HistGradientBoostingClassifier
DATA=os.path.join(os.path.dirname(os.path.abspath(__file__)),"data"); L=print
m=pd.read_parquet(os.path.join(DATA,"matchup.parquet")); od=pd.read_parquet(os.path.join(DATA,"odds_consensus.parquet"))
inj=pd.read_parquet(os.path.join(DATA,"injuries_raw.parquet")); rec=pd.read_parquet(os.path.join(DATA,"ngs_receiving.parquet"))
dfd=pd.read_parquet(os.path.join(DATA,"player_stats_def.parquet")); tg=pd.read_parquet(os.path.join(DATA,"tg.parquet"))
def carry(df,kid,col,out):
    df=df.sort_values([kid,"season","week"]).copy(); df["_c"]=df.groupby([kid,"season"])[col].apply(lambda s:s.shift(1).expanding().mean()).reset_index(level=[0,1],drop=True)
    pl=df[["season",kid]].drop_duplicates(); grid=pl.merge(pd.DataFrame({"week":range(1,23)}),how="cross").merge(df[["season",kid,"week","_c"]],on=["season",kid,"week"],how="left").sort_values(["season",kid,"week"]); grid[out]=grid.groupby(["season",kid])["_c"].ffill(); return grid[["season","week",kid,out]]
# injury + defense (as iter1)
air=carry(rec,"player_id","percent_share_of_intended_air_yards","airshare")
dfd["dprod"]=dfd.def_sacks.fillna(0)*2+dfd.def_qb_hits.fillna(0)+dfd.def_pass_defended.fillna(0)+dfd.def_interceptions.fillna(0)*2+dfd.def_tackles_for_loss.fillna(0)
dfd["prush"]=dfd.def_sacks.fillna(0)*2+dfd.def_qb_hits.fillna(0)  # pass-rush production
dprod=carry(dfd,"player_id","dprod","dprod_prior")
miss=inj[inj.report_status.isin(["Out","Doubtful"])].merge(air,on=["season","week","player_id"],how="left").merge(dprod,on=["season","week","player_id"],how="left")
miss["air_w"]=np.where(miss.position.isin({"WR","TE","RB","FB"}),miss.airshare.clip(lower=0).fillna(0),0); miss["dpw"]=miss.dprod_prior.fillna(0)
ti=miss.groupby(["season","week","team"]).agg(air_out=("air_w","sum"),dprod_out=("dpw","sum")).reset_index()
dteam=dfd.groupby(["season","week","team"]).agg(dprod=("dprod","sum"),prush=("prush","sum")).reset_index().sort_values(["team","season","week"])
dteam["dprod_team"]=dteam.groupby(["team","season"]).dprod.apply(lambda s:s.shift(1).expanding().mean()).reset_index(level=[0,1],drop=True)
dteam["prush_team"]=dteam.groupby(["team","season"]).prush.apply(lambda s:s.shift(1).expanding().mean()).reset_index(level=[0,1],drop=True)
nv2our={"LA":"LAR","SD":"LAC","STL":"LAR"}
for t in [ti,dteam]: t["ab"]=t.team.replace(nv2our)
for side,p in [("home","h_"),("away","a_")]:
    m=m.merge(ti.rename(columns={"ab":f"{side}_ab","air_out":f"{p}air_out","dprod_out":f"{p}dprod_out"})[["season","week",f"{side}_ab",f"{p}air_out",f"{p}dprod_out"]],on=["season","week",f"{side}_ab"],how="left")
    m=m.merge(dteam.rename(columns={"ab":f"{side}_ab","dprod_team":f"{p}dprod_team","prush_team":f"{p}prush_team"})[["season","week",f"{side}_ab",f"{p}dprod_team",f"{p}prush_team"]],on=["season","week",f"{side}_ab"],how="left")
for c in ["h_air_out","a_air_out","h_dprod_out","a_dprod_out","h_dprod_team","a_dprod_team","h_prush_team","a_prush_team"]: m[c]=m[c].fillna(0)
# schedule flags from tg (home/away by unique_id)
flags=["pre_bye","blowout_win_last","blowout_loss_last","third_road","div_revenge","off_bye","win_streak","cover_streak"]
H=tg[tg.is_home==1][["unique_id"]+flags].rename(columns={f:f"h_{f}" for f in flags})
A=tg[tg.is_home==0][["unique_id"]+flags].rename(columns={f:f"a_{f}" for f in flags})
m=m.merge(H,on="unique_id",how="left").merge(A,on="unique_id",how="left")
# core engineered
m["pr_diff"]=m.home_predictive_pr-m.away_predictive_pr; m["last5_diff"]=m.home_last5_pr-m.away_last5_pr
m["abs_spread"]=m.home_spread.abs(); m["actual_margin"]=m.home_score-m.away_score
m["home_cover"]=(m.actual_margin+m.home_spread>0).astype(int)
m["home_dog_7_10"]=((m.home_spread>=7.5)&(m.home_spread<=10.5)).astype(int); m["away_dog_7_10"]=((m.home_spread<=-7.5)&(m.home_spread>=-10.5)).astype(int)
m["div_game_i"]=m.div_game.astype(int); m["conf_game_i"]=m.conference_game.astype(int); m["league_game_i"]=m.league_game.astype(int)
m["primetime_i"]=m.primetime.fillna(0).astype(int); m["home_fav"]=(m.home_spread<0).astype(int)
m["air_diff"]=m.h_air_out-m.a_air_out; m["dprod_team_diff"]=m.h_dprod_team-m.a_dprod_team
# pass-rush facets: own pass-rush vs opp passing offense (slow/weak O exposed)
m["h_prush_vs_aO"]=m.h_prush_team - (m.away_off_pass_epa_neutral_s2d.fillna(0)*20)
m["a_prush_vs_hO"]=m.a_prush_team - (m.home_off_pass_epa_neutral_s2d.fillna(0)*20)
m["prush_facet_diff"]=m.h_prush_vs_aO - m.a_prush_vs_hO
ref=[c for c in ["ref_total_pts_avg","ref_home_cover_pct","ref_under_pct","ref_fav_cover_pct"] if c in m.columns]
sched=[c for c in ["h_pre_bye","a_pre_bye","h_blowout_win_last","a_blowout_win_last","h_blowout_loss_last","a_blowout_loss_last","h_third_road","a_third_road","h_div_revenge","a_div_revenge"] if c in m.columns]
for c in sched: m[c]=m[c].fillna(0)

ITER1=["pr_diff","home_predictive_pr","away_predictive_pr","last5_diff","home_consistency_pr","away_consistency_pr",
       "home_dog_7_10","away_dog_7_10","div_game_i","conf_game_i","league_game_i","primetime_i","week","home_fav","abs_spread",
       "air_diff","dprod_team_diff","h_dprod_team","a_dprod_team"]+ref
for c in set(ITER1+sched+["prush_facet_diff","h_prush_team","a_prush_team"]):
    if c in m.columns: m[c]=pd.to_numeric(m[c],errors="coerce")
W=m[m.week>=4].copy(); key=["season","home_ab","away_ab"]; OD=od[key+["open_spread"]]

def evaluate(feats,label):
    W["ph"]=np.nan
    for Y in range(2021,2026):
        trn=W[W.season<Y]; te=W[W.season==Y]
        clf=HistGradientBoostingClassifier(max_depth=3,learning_rate=0.05,max_iter=300,l2_regularization=2.0,min_samples_leaf=40,random_state=0).fit(trn[feats],trn.home_cover)
        W.loc[te.index,"ph"]=clf.predict_proba(te[feats])[:,1]
    d=W[W.season.isin([2024,2025])].merge(OD,on=key,how="inner").dropna(subset=["ph","open_spread"])
    d["hco"]=(d.actual_margin+d.open_spread>0).astype(float); d.loc[d.actual_margin+d.open_spread==0,"hco"]=np.nan
    rows=[]
    for c in [0.03,0.06,0.10]:
        bh=d[d.ph>=0.5+c]; ba=d[d.ph<=0.5-c]; won=pd.concat([bh.hco,1-ba.hco]).dropna(); k=int((won==1).sum()); n=int(won.isin([0,1]).sum())
        rows.append((c,k,n))
    c,k,n=rows[0]; lo,hi=wilson_ci(k,n)
    c2,k2,n2=rows[2]; lo2,hi2=wilson_ci(k2,n2)
    L(f"  {label:22s} f={len(feats):2d} | conf>=.03: n={n} hit={k/n*100:.1f}% CI[{lo*100:.0f},{hi*100:.0f}] roi={(k*100/110-(n-k))/n*100:+.1f}% || conf>=.10: n={n2} hit={ (k2/n2*100 if n2 else 0):.1f}% roi={((k2*100/110-(n2-k2))/n2*100 if n2 else 0):+.1f}%")
    # per-season at conf>=.03 (skeptic check)
    for yr in [2024,2025]:
        dy=d[d.season==yr]; bh=dy[dy.ph>=0.53]; ba=dy[dy.ph<=0.47]; won=pd.concat([bh.hco,1-ba.hco]).dropna(); kk=int((won==1).sum()); nn=int(won.isin([0,1]).sum())
        L(f"        {yr}: n={nn} hit={ (kk/nn*100 if nn else 0):.1f}%")

L("="*100); L("ITERATION 2: held-out 2024-25 ATS vs OPENER (conf>=.03 and conf>=.10)"); L("="*100)
evaluate(ITER1,"iter1 (PR+flags+def)")
evaluate(ITER1+sched,"+schedule spots")
evaluate(ITER1+sched+["prush_facet_diff","h_prush_team","a_prush_team"],"+pass-rush facet (FULL)")
