"""
Wire Madden OVR into the sides model + test the two hypotheses.
(A) COLD-START: does a preseason Madden team-rating prior make early weeks (1-3, which we currently DROP)
    bettable vs the opener? Ablation overall + by week bucket.
(B) INJURY VALUATION: Madden-OVR features the box score can't give us — QB starter-minus-backup downgrade,
    OL-out OVR (new), Madden-weighted skill-out. Added to the locked sides model + standalone vs opener.
All held-out 2024-25 vs the OPENER. Cover (validated): actual_margin + home_spread > 0.
"""
import os, sys, warnings
import numpy as np, pandas as pd
warnings.filterwarnings("ignore")
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from stats_helpers import wilson_ci
from sklearn.ensemble import HistGradientBoostingClassifier
DATA=os.path.join(os.path.dirname(os.path.abspath(__file__)),"data"); L=print
m=pd.read_parquet(os.path.join(DATA,"matchup.parquet")); od=pd.read_parquet(os.path.join(DATA,"odds_consensus.parquet"))
inj=pd.read_parquet(os.path.join(DATA,"injuries_raw.parquet")); rec=pd.read_parquet(os.path.join(DATA,"ngs_receiving.parquet"))
dfd=pd.read_parquet(os.path.join(DATA,"player_stats_def.parquet")); tg=pd.read_parquet(os.path.join(DATA,"tg.parquet"))
mad=pd.read_parquet(os.path.join(DATA,"madden_ratings.parquet"))
nv2our={"LA":"LAR","SD":"LAC","STL":"LAR"}

# ---------- Madden team aggregates (preseason roster strength) ----------
NICK={'49ers':'SF','cardinals':'ARI','falcons':'ATL','ravens':'BAL','bills':'BUF','panthers':'CAR',
 'bears':'CHI','bengals':'CIN','browns':'CLE','cowboys':'DAL','broncos':'DEN','lions':'DET','packers':'GB',
 'texans':'HOU','colts':'IND','jaguars':'JAX','chiefs':'KC','chargers':'LAC','rams':'LAR','dolphins':'MIA',
 'vikings':'MIN','patriots':'NE','saints':'NO','giants':'NYG','jets':'NYJ','eagles':'PHI','steelers':'PIT',
 'seahawks':'SEA','buccaneers':'TB','titans':'TEN','commanders':'WAS','redskins':'WAS','team':'WAS'}
def to_ab(name,season):
    toks=str(name).split(); last=toks[-1].lower() if toks else ''
    if last=='raiders': return 'OAK' if season<=2019 else 'LV'
    return NICK.get(last)
mm=mad[mad.status=="matched"].copy(); mm["ab"]=[to_ab(t,s) for t,s in zip(mm.team,mm.season)]
mm=mm.dropna(subset=["ab"])
OL={'LT','LG','C','RG','RT'}
g=mm.sort_values("ovr",ascending=False).groupby(["season","ab"])
qb=mm[mm.pos=="QB"].sort_values(["season","ab","ovr"],ascending=[True,True,False]).copy()
qb["rk"]=qb.groupby(["season","ab"]).cumcount()
qb1=qb[qb.rk==0].set_index(["season","ab"]).ovr.rename("qb1")
qb2=qb[qb.rk==1].set_index(["season","ab"]).ovr.rename("qb2")
team_ovr=g.head(22).groupby(["season","ab"]).ovr.mean().rename("team_ovr")
ol_avg=mm[mm.pos.isin(OL)].sort_values("ovr",ascending=False).groupby(["season","ab"]).head(5).groupby(["season","ab"]).ovr.mean().rename("ol_avg")
agg=pd.concat([team_ovr,qb1,qb2,ol_avg],axis=1).reset_index()

# ---------- Madden injury features (per season,week,team) ----------
mov=mm[["season","gsis_id","ovr"]].dropna(subset=["gsis_id"]).drop_duplicates(["season","gsis_id"]).rename(columns={"ovr":"m_ovr"})
io=inj[inj.report_status.isin(["Out","Doubtful"])].merge(mov,left_on=["season","player_id"],right_on=["season","gsis_id"],how="left")
io["pos"]=io.position.astype(str).str.strip()
OLp={"T","G","C","OL"}; SKp={"WR","TE","RB","FB"}
io["ol_out"]=np.where(io.pos.isin(OLp),(io.m_ovr-60).clip(lower=0),0.0)
io["sk_out"]=np.where(io.pos.isin(SKp),(io.m_ovr-60).clip(lower=0),0.0)
io["qb_out_ovr"]=np.where(io.pos=="QB",io.m_ovr,np.nan)
ti=io.groupby(["season","week","team"]).agg(ol_out=("ol_out","sum"),sk_out=("sk_out","sum"),qb_out=("qb_out_ovr","max")).reset_index()
ti["ab"]=ti.team.replace(nv2our)
# QB downgrade = out-QB OVR minus the team's backup OVR (true magnitude of the drop)
ti=ti.merge(agg[["season","ab","qb2"]],on=["season","ab"],how="left")
ti["qb_dn"]=(ti.qb_out-ti.qb2).clip(lower=0).fillna(0)

# ---------- attach Madden to games (home/away) ----------
for side,p in [("home","h_"),("away","a_")]:
    m=m.merge(agg.rename(columns={"ab":f"{side}_ab","team_ovr":f"{p}team_ovr","qb1":f"{p}qb1","ol_avg":f"{p}ol_avg"})[["season",f"{side}_ab",f"{p}team_ovr",f"{p}qb1",f"{p}ol_avg"]],on=["season",f"{side}_ab"],how="left")
    m=m.merge(ti.rename(columns={"ab":f"{side}_ab","ol_out":f"{p}ol_out","sk_out":f"{p}sk_out","qb_dn":f"{p}qb_dn"})[["season","week",f"{side}_ab",f"{p}ol_out",f"{p}sk_out",f"{p}qb_dn"]],on=["season","week",f"{side}_ab"],how="left")
for c in ["h_ol_out","a_ol_out","h_sk_out","a_sk_out","h_qb_dn","a_qb_dn"]: m[c]=m[c].fillna(0)
m["team_ovr_diff"]=m.h_team_ovr-m.a_team_ovr; m["qb1_diff"]=m.h_qb1-m.a_qb1; m["ol_avg_diff"]=m.h_ol_avg-m.a_ol_avg
m["qb_dn_diff"]=m.a_qb_dn-m.h_qb_dn   # away QB hurt more => helps home
m["ol_out_diff"]=m.a_ol_out-m.h_ol_out; m["sk_out_diff"]=m.a_sk_out-m.h_sk_out

# ---------- base (locked b14) features ----------
def carry(df,kid,col,out):
    df=df.sort_values([kid,"season","week"]).copy(); df["_c"]=df.groupby([kid,"season"])[col].apply(lambda s:s.shift(1).expanding().mean()).reset_index(level=[0,1],drop=True)
    pl=df[["season",kid]].drop_duplicates(); grid=pl.merge(pd.DataFrame({"week":range(1,23)}),how="cross").merge(df[["season",kid,"week","_c"]],on=["season",kid,"week"],how="left").sort_values(["season",kid,"week"]); grid[out]=grid.groupby(["season",kid])["_c"].ffill(); return grid[["season","week",kid,out]]
air=carry(rec,"player_id","percent_share_of_intended_air_yards","airshare")
dfd["dprod"]=dfd.def_sacks.fillna(0)*2+dfd.def_qb_hits.fillna(0)+dfd.def_pass_defended.fillna(0)+dfd.def_interceptions.fillna(0)*2+dfd.def_tackles_for_loss.fillna(0)
miss=inj[inj.report_status.isin(["Out","Doubtful"])].merge(air,on=["season","week","player_id"],how="left")
miss["air_w"]=np.where(miss.position.isin({"WR","TE","RB","FB"}),miss.airshare.clip(lower=0).fillna(0),0)
ai=miss.groupby(["season","week","team"]).air_w.sum().reset_index(); ai["ab"]=ai.team.replace(nv2our)
dteam=dfd.groupby(["season","week","team"]).dprod.sum().reset_index().sort_values(["team","season","week"])
dteam["dprod_team"]=dteam.groupby(["team","season"]).dprod.apply(lambda s:s.shift(1).expanding().mean()).reset_index(level=[0,1],drop=True); dteam["ab"]=dteam.team.replace(nv2our)
for side,p in [("home","h_"),("away","a_")]:
    m=m.merge(ai.rename(columns={"ab":f"{side}_ab","air_w":f"{p}air"})[["season","week",f"{side}_ab",f"{p}air"]],on=["season","week",f"{side}_ab"],how="left")
    m=m.merge(dteam.rename(columns={"ab":f"{side}_ab","dprod_team":f"{p}dpt"})[["season","week",f"{side}_ab",f"{p}dpt"]],on=["season","week",f"{side}_ab"],how="left")
for c in ["h_air","a_air","h_dpt","a_dpt"]: m[c]=m[c].fillna(0)
flags=["pre_bye","blowout_win_last","blowout_loss_last","third_road","div_revenge"]
H=tg[tg.is_home==1][["unique_id"]+flags].rename(columns={f:f"h_{f}" for f in flags}); A=tg[tg.is_home==0][["unique_id"]+flags].rename(columns={f:f"a_{f}" for f in flags})
m=m.merge(H,on="unique_id",how="left").merge(A,on="unique_id",how="left")
m["pr_diff"]=m.home_predictive_pr-m.away_predictive_pr; m["last5_diff"]=m.home_last5_pr-m.away_last5_pr
m["abs_spread"]=m.home_spread.abs(); m["actual_margin"]=m.home_score-m.away_score
m["home_cover"]=(m.actual_margin+m.home_spread>0).astype(int)
m["home_dog_7_10"]=((m.home_spread>=7.5)&(m.home_spread<=10.5)).astype(int); m["away_dog_7_10"]=((m.home_spread<=-7.5)&(m.home_spread>=-10.5)).astype(int)
m["div_game_i"]=m.div_game.astype(int); m["conf_game_i"]=m.conference_game.astype(int); m["league_game_i"]=m.league_game.astype(int)
m["primetime_i"]=m.primetime.fillna(0).astype(int); m["home_fav"]=(m.home_spread<0).astype(int)
m["air_diff"]=m.h_air-m.a_air; m["dprod_team_diff"]=m.h_dpt-m.a_dpt
sched=[f"{s}_{f}" for s in ["h","a"] for f in flags]
for c in sched: m[c]=pd.to_numeric(m[c],errors="coerce").fillna(0)
ref=[c for c in ["ref_total_pts_avg","ref_home_cover_pct","ref_under_pct","ref_fav_cover_pct"] if c in m.columns]
BASE=["pr_diff","home_predictive_pr","away_predictive_pr","last5_diff","home_consistency_pr","away_consistency_pr",
      "home_dog_7_10","away_dog_7_10","div_game_i","conf_game_i","league_game_i","primetime_i","week","home_fav","abs_spread",
      "air_diff","dprod_team_diff","h_dpt","a_dpt"]+ref+sched
MAD=["team_ovr_diff","qb1_diff","ol_avg_diff","qb_dn_diff","ol_out_diff","sk_out_diff"]
for c in BASE+MAD: m[c]=pd.to_numeric(m[c],errors="coerce")
key=["season","home_ab","away_ab"]; OD=od[key+["open_spread"]]

def walkfwd(df,feats):
    df=df.copy(); df["ph"]=np.nan
    for Y in range(2021,2026):
        trn=df[df.season<Y]; te=df[df.season==Y]
        clf=HistGradientBoostingClassifier(max_depth=3,learning_rate=0.05,max_iter=300,l2_regularization=2.0,min_samples_leaf=40,random_state=0).fit(trn[feats],trn.home_cover)
        df.loc[te.index,"ph"]=clf.predict_proba(te[feats])[:,1]
    return df
def grade(df,wk=None,conf=0.03):
    d=df[df.season.isin([2024,2025])].merge(OD,on=key,how="inner").dropna(subset=["ph","open_spread"])
    if wk is not None: d=d[d.week.isin(wk)]
    d["hco"]=(d.actual_margin+d.open_spread>0).astype(float); d.loc[d.actual_margin+d.open_spread==0,"hco"]=np.nan
    bh=d[d.ph>=0.5+conf]; ba=d[d.ph<=0.5-conf]; won=pd.concat([bh.hco,1-ba.hco]).dropna(); k=int((won==1).sum()); n=int(won.isin([0,1]).sum())
    lo,hi=wilson_ci(k,n) if n else (0,0); roi=(k*100/110-(n-k))/n*100 if n else 0
    return n,(k/n*100 if n else 0),lo*100,hi*100,roi

L("="*100); L("(A) COLD-START — does Madden roster prior make EARLY weeks bettable? (held-out 2024-25 vs opener)"); L("="*100)
Wall=m[m.week>=1].copy()                       # include weeks 1-3 (normally dropped)
for label,feats in [("base (no Madden)",BASE),("base + Madden",BASE+MAD)]:
    df=walkfwd(Wall,feats)
    for tag,wk in [("ALL wks",None),("wks 1-3",[1,2,3]),("wks 4+",list(range(4,23)))]:
        n,h,lo,hi,roi=grade(df,wk)
        L(f"  {label:18s} {tag:8s}: n={n:3d} hit={h:.1f}% CI[{lo:.0f},{hi:.0f}] roi={roi:+.1f}%")

L("\n"+"="*100); L("(B) ABLATION — Madden added to the LOCKED sides model (wks 4+, conf>=.03)"); L("="*100)
W4=m[m.week>=4].copy()
for label,feats in [("base (locked b14)",BASE),("base + Madden",BASE+MAD),("Madden ONLY",MAD)]:
    n,h,lo,hi,roi=grade(walkfwd(W4,feats))
    L(f"  {label:20s}: n={n} hit={h:.1f}% CI[{lo:.0f},{hi:.0f}] roi={roi:+.1f}%")

L("\n"+"="*100); L("STANDALONE Madden injury spots vs the OPENER (held-out 2024-25)"); L("="*100)
d=m[m.season.isin([2024,2025])].merge(OD,on=key,how="inner").dropna(subset=["open_spread"])
d["hco"]=(d.actual_margin+d.open_spread>0).astype(float); d=d[d.actual_margin+d.open_spread!=0]
# QB downgrade: fade the team with a big QB downgrade (>=8 OVR drop)
for lab,mask,fade_home in [("home QB downgrade>=8 -> fade home", d.h_qb_dn>=8, True),
                           ("away QB downgrade>=8 -> fade away", d.a_qb_dn>=8, False),
                           ("home OL-out>=15 -> fade home", d.h_ol_out>=15, True),
                           ("away OL-out>=15 -> fade away", d.a_ol_out>=15, False)]:
    sub=d[mask];
    won=(1-sub.hco) if fade_home else sub.hco   # fade home = bet away covers
    n=int(won.notna().sum()); k=int(won.sum())
    if n>=8: lo,hi=wilson_ci(k,n); L(f"  {lab:34s} n={n} hit={k/n*100:.1f}% CI[{lo*100:.0f},{hi*100:.0f}]")
    else: L(f"  {lab:34s} n={n} (too few)")
