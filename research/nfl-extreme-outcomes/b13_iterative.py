"""
ITERATIVE sides model — build UP, use our PROVEN signals as features, add groups one at a time.
Target: home covers the CLOSE (validated: actual_margin + home_spread > 0). Walk-forward classify.
Feature GROUPS added incrementally: PR-core -> +proven flags (dog +7.5-10.5, pre/post-bye, div/conf/league,
week, primetime) -> +referee -> +value-weighted injury -> +defensive production.
Held-out 2024-25: model confident picks -> ATS vs OPENER + CLV. Also standalone proven-spots vs opener.
"""
import os, sys, warnings
import numpy as np, pandas as pd
warnings.filterwarnings("ignore")
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from stats_helpers import wilson_ci, bet_summary, fmt
from sklearn.ensemble import HistGradientBoostingClassifier
DATA = os.path.join(os.path.dirname(os.path.abspath(__file__)), "data"); L=print
m=pd.read_parquet(os.path.join(DATA,"matchup.parquet")); od=pd.read_parquet(os.path.join(DATA,"odds_consensus.parquet"))
inj=pd.read_parquet(os.path.join(DATA,"injuries_raw.parquet")); rec=pd.read_parquet(os.path.join(DATA,"ngs_receiving.parquet"))
dfd=pd.read_parquet(os.path.join(DATA,"player_stats_def.parquet")); tr_epa=None

def carry(df,kid,col,out):
    df=df.sort_values([kid,"season","week"]).copy(); df["_c"]=df.groupby([kid,"season"])[col].apply(lambda s:s.shift(1).expanding().mean()).reset_index(level=[0,1],drop=True)
    pl=df[["season",kid]].drop_duplicates(); grid=pl.merge(pd.DataFrame({"week":range(1,23)}),how="cross").merge(df[["season",kid,"week","_c"]],on=["season",kid,"week"],how="left").sort_values(["season",kid,"week"]); grid[out]=grid.groupby(["season",kid])["_c"].ffill(); return grid[["season","week",kid,out]]

# value-weighted injuries (air-share for receivers; def production for defenders)
air=carry(rec,"player_id","percent_share_of_intended_air_yards","airshare")
dfd["dprod"]=dfd.def_sacks.fillna(0)*2 + dfd.def_qb_hits.fillna(0) + dfd.def_pass_defended.fillna(0) + dfd.def_interceptions.fillna(0)*2 + dfd.def_tackles_for_loss.fillna(0)
dprod=carry(dfd,"player_id","dprod","dprod_prior")
miss=inj[inj.report_status.isin(["Out","Doubtful"])].copy().merge(air,on=["season","week","player_id"],how="left").merge(dprod,on=["season","week","player_id"],how="left")
SK={"WR","TE","RB","FB"}
miss["air_w"]=np.where(miss.position.isin(SK),miss.airshare.clip(lower=0).fillna(0),0)
miss["dprod_w"]=miss.dprod_prior.fillna(0)
ti=miss.groupby(["season","week","team"]).agg(air_out=("air_w","sum"),dprod_out=("dprod_w","sum")).reset_index()
# team defensive production (unit quality) entering game
dteam=dfd.groupby(["season","week","team"]).dprod.sum().reset_index()
dteam=dteam.sort_values(["team","season","week"]); dteam["dprod_team_prior"]=dteam.groupby(["team","season"]).dprod.apply(lambda s:s.shift(1).expanding().mean()).reset_index(level=[0,1],drop=True)
nv2our={"LA":"LAR","SD":"LAC","STL":"LAR"}
for t in [ti,dteam]: t["ab"]=t.team.replace(nv2our)

for side,p in [("home","h_"),("away","a_")]:
    m=m.merge(ti.rename(columns={"ab":f"{side}_ab","air_out":f"{p}air_out","dprod_out":f"{p}dprod_out"})[["season","week",f"{side}_ab",f"{p}air_out",f"{p}dprod_out"]],on=["season","week",f"{side}_ab"],how="left")
    m=m.merge(dteam.rename(columns={"ab":f"{side}_ab","dprod_team_prior":f"{p}dprod_team"})[["season","week",f"{side}_ab",f"{p}dprod_team"]],on=["season","week",f"{side}_ab"],how="left")
for c in ["h_air_out","a_air_out","h_dprod_out","a_dprod_out","h_dprod_team","a_dprod_team"]: m[c]=m[c].fillna(0)

# ---- engineer features incl PROVEN signal flags ----
m["pr_diff"]=m.home_predictive_pr-m.away_predictive_pr; m["last5_diff"]=m.home_last5_pr-m.away_last5_pr
m["abs_spread"]=m.home_spread.abs(); m["actual_margin"]=m.home_score-m.away_score
m["home_cover"]=(m.actual_margin + m.home_spread > 0).astype(int)   # validated cover vs close
# proven flags
m["home_dog_7_10"]=((m.home_spread>=7.5)&(m.home_spread<=10.5)).astype(int)   # home getting 7.5-10.5
m["away_dog_7_10"]=((m.home_spread<=-7.5)&(m.home_spread>=-10.5)).astype(int) # away getting 7.5-10.5 (home favored 7.5-10.5)
m["div_game_i"]=m.div_game.astype(int) if "div_game" in m else 0
m["conf_game_i"]=m.conference_game.astype(int)
m["league_game_i"]=m.league_game.astype(int)
m["primetime_i"]=m.primetime.fillna(0).astype(int)
m["air_diff"]=m.h_air_out-m.a_air_out; m["dprod_inj_diff"]=m.h_dprod_out-m.a_dprod_out
m["dprod_team_diff"]=m.h_dprod_team-m.a_dprod_team
m["mkt_margin"]=-m.home_spread
# pre/post bye: home/away rest>=13 (off bye) ; pre-bye harder w/o schedule, use rest as proxy + consecutive
m["home_off_bye"]=(m.home_rest>=13).astype(int); m["away_off_bye"]=(m.away_rest>=13).astype(int)
m["home_fav"]=(m.home_spread<0).astype(int)
m["post_bye_fav"]=(((m.home_off_bye==1)&(m.home_fav==1))|((m.away_off_bye==1)&(m.home_fav==0))).astype(int)
ref=[c for c in ["ref_total_pts_avg","ref_home_cover_pct","ref_under_pct","ref_fav_cover_pct","ref_avg_margin"] if c in m.columns]

GROUPS={
 "PR":["pr_diff","home_predictive_pr","away_predictive_pr","last5_diff","home_consistency_pr","away_consistency_pr"],
 "+flags":["home_dog_7_10","away_dog_7_10","div_game_i","conf_game_i","league_game_i","primetime_i","week","home_off_bye","away_off_bye","post_bye_fav","home_fav","abs_spread"],
 "+referee":ref,
 "+injury":["air_diff","dprod_inj_diff","h_air_out","a_air_out"],
 "+defense":["dprod_team_diff","h_dprod_team","a_dprod_team"],
}
allf=[];
for g in GROUPS:
    GROUPS[g]=[f for f in GROUPS[g] if f in m.columns]
    for f in GROUPS[g]: m[f]=pd.to_numeric(m[f],errors="coerce")
W=m[m.week>=4].copy()
key=["season","home_ab","away_ab"]; OD=od[key+["open_spread"]]

def evaluate(feats, label):
    W["ph"]=np.nan
    for Y in range(2021,2026):
        trn=W[W.season<Y]; te=W[W.season==Y]
        if len(trn)<400: continue
        clf=HistGradientBoostingClassifier(max_depth=3,learning_rate=0.05,max_iter=300,l2_regularization=2.0,min_samples_leaf=40,random_state=0).fit(trn[feats],trn.home_cover)
        W.loc[te.index,"ph"]=clf.predict_proba(te[feats])[:,1]
    # held-out 2024-25, bet model's confident side vs OPENER
    d=W[W.season.isin([2024,2025])].merge(OD,on=key,how="inner").dropna(subset=["ph","open_spread"])
    # bet home if ph high; cover vs OPENER = actual_margin + open_spread > 0
    d["home_cov_open"]=(d.actual_margin + d.open_spread > 0).astype(float)
    d.loc[d.actual_margin + d.open_spread == 0,"home_cov_open"]=np.nan
    d["lm"]=(-(-d.open_spread)) # placeholder; CLV below
    # CLV uses close vs open (home margin)
    res=[]
    for c in [0.0,0.03,0.06]:
        bh=d[d.ph>=0.5+c]; ba=d[d.ph<=0.5-c]
        won=pd.concat([bh.home_cov_open, 1-ba.home_cov_open]).dropna(); k=int((won==1).sum()); n=int(won.isin([0,1]).sum())
        res.append((c,k,n))
    c,k,n=res[1]  # conf>=0.03
    lo,hi=wilson_ci(k,n)
    L(f"  {label:14s} feats={len(feats):2d} | conf>=.03 vs OPEN: n={n} hit={k/n*100:.1f}% CI[{lo*100:.0f},{hi*100:.0f}] roi={(k*100/110-(n-k))/n*100:+.1f}%")
    return feats

L("="*92); L("ITERATIVE MODEL: add feature groups, held-out 2024-25 ATS vs OPENER (conf>=.03)"); L("="*92)
cum=[]
for g in GROUPS:
    cum=cum+GROUPS[g]
    evaluate(cum, g)

L("\n"+"="*92); L("STANDALONE PROVEN SPOTS vs the OPENER (do they hold at the bettable number?)"); L("="*92)
d=W.merge(OD,on=key,how="inner").copy()
d["dog_cov_open"]=np.nan
# +7.5-10.5 dog covers vs OPENER
for lab,mask,dog_is_home in [("home dog +7.5-10.5", (d.home_spread>=7.5)&(d.home_spread<=10.5), True),
                              ("away dog +7.5-10.5", (d.home_spread<=-7.5)&(d.home_spread>=-10.5), False)]:
    sub=d[mask].copy()
    # dog covers vs opener
    if dog_is_home: cov=(sub.actual_margin + sub.open_spread > 0)
    else: cov=(-(sub.actual_margin) + (-sub.open_spread) > 0)  # away covers
    push=(sub.actual_margin + sub.open_spread==0)
    cov=cov[~push]; n=len(cov); k=int(cov.sum()); lo,hi=wilson_ci(k,n) if n else (0,0)
    if n>=10: L(f"  {lab} vs OPEN: n={n} cover={k/n*100:.1f}% CI[{lo*100:.0f},{hi*100:.0f}]")
# combined dog 7.5-10.5 (either side) vs opener, per season
alldog=d[((d.home_spread>=7.5)&(d.home_spread<=10.5))|((d.home_spread<=-7.5)&(d.home_spread>=-10.5))].copy()
alldog["dogcov"]=np.where(alldog.home_spread>0, (alldog.actual_margin+alldog.open_spread>0), (-alldog.actual_margin-alldog.open_spread>0))
alldog=alldog[alldog.actual_margin+alldog.home_spread!=0]
L(f"  ALL +7.5-10.5 dogs vs OPEN: n={len(alldog)} cover={alldog.dogcov.mean()*100:.1f}%  per-season:")
for s in sorted(alldog.season.unique()):
    ss=alldog[alldog.season==s]; L(f"    {int(s)}: {int(ss.dogcov.sum())}/{len(ss)}={ss.dogcov.mean()*100:.0f}%")
