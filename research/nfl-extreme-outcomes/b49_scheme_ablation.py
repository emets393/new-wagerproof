"""
(B) Ablate scheme features in sides + totals models (do they add predictive juice or get priced?).
(C) Team scheme-environment trends — incl. user's hypothesis: man-heavy defenses + rush-strong offenses ->
    longer rushes/scoring (totals OVER). Permutation null guards the battery.
Team scheme rates computed from scheme_plays; merged to each game as PRIOR-season team rates (leak-safe).
"""
import os, sys, warnings
import numpy as np, pandas as pd
warnings.filterwarnings("ignore")
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from stats_helpers import wilson_ci
from sklearn.ensemble import HistGradientBoostingClassifier, HistGradientBoostingRegressor
DATA=os.path.join(os.path.dirname(os.path.abspath(__file__)),"data"); L=print
sp=pd.read_parquet(os.path.join(DATA,"scheme_plays.parquet"))
m=pd.read_parquet(os.path.join(DATA,"matchup.parquet"))
od=pd.read_parquet(os.path.join(DATA,"odds_consensus.parquet"))
m["actual_margin"]=m.home_score-m.away_score; m["actual_total"]=m.home_score+m.away_score
m["home_cover"]=(m.actual_margin+m.home_spread>0).astype(int)
m["over_close"]=(m.actual_total>m.nv_total_line).astype(float); m.loc[m.actual_total==m.nv_total_line,"over_close"]=np.nan
# scheme rates per (team, season) — DEFENSE
pp=sp[(sp["pass"]==1)&(sp.defense_man_zone_type.isin(["MAN_COVERAGE","ZONE_COVERAGE"]))].copy()
pp["n_rush"]=pd.to_numeric(pp.number_of_pass_rushers,errors="coerce")
pp["box"]=pd.to_numeric(pp.defenders_in_box,errors="coerce")
pp["press"]=pd.to_numeric(pp.was_pressure,errors="coerce").fillna(0)
defR=pp.groupby(["defteam","season"]).agg(
    n=("epa","size"),
    man_rate=("defense_man_zone_type",lambda s:(s=="MAN_COVERAGE").mean()),
    blitz_rate=("n_rush",lambda s:(s>=5).mean()),
    pressure_rate=("press","mean"),
    avg_box=("box","mean"),
).reset_index().rename(columns={"defteam":"team"})
# OFFENSE rates: rush-strength (rush EPA), pass-rate, pressure-faced
sa=sp[sp.play_type.isin(["pass","run"])].copy()
sa["epa_n"]=pd.to_numeric(sa.epa,errors="coerce")
offR=sa.groupby(["posteam","season"]).agg(
    plays=("epa","size"),
    pass_rate=("pass",lambda s:pd.to_numeric(s,errors="coerce").fillna(0).mean()),
    epa_per_play=("epa_n","mean"),
).reset_index().rename(columns={"posteam":"team"})
rush_epa=sa[sa["rush"]==1].groupby(["posteam","season"]).epa_n.mean().rename("rush_epa").reset_index().rename(columns={"posteam":"team"})
pass_epa=sa[sa["pass"]==1].groupby(["posteam","season"]).epa_n.mean().rename("pass_epa").reset_index().rename(columns={"posteam":"team"})
offR=offR.merge(rush_epa,on=["team","season"],how="left").merge(pass_epa,on=["team","season"],how="left")
# nflverse->our abbrev
nv2our={"LA":"LAR","SD":"LAC","STL":"LAR"}
for t in [defR,offR]: t["team"]=t.team.replace(nv2our)
# PRIOR-season features (leak-safe): feature for season Y = team's rate in season Y-1
defR["season"]=defR.season+1; offR["season"]=offR.season+1
L(f"[build] def-scheme team-seasons: {len(defR)} | off-scheme: {len(offR)}")

# merge to games: home/away
m2=m.copy()
for side,p in [("home","h_"),("away","a_")]:
    m2=m2.merge(defR.rename(columns={"team":f"{side}_ab",**{c:f"{p}d_{c}" for c in ["man_rate","blitz_rate","pressure_rate","avg_box"]}}).drop(columns=["n"]),on=["season",f"{side}_ab"],how="left")
    m2=m2.merge(offR.rename(columns={"team":f"{side}_ab",**{c:f"{p}o_{c}" for c in ["pass_rate","epa_per_play","rush_epa","pass_epa"]}}).drop(columns=["plays"]),on=["season",f"{side}_ab"],how="left")
SCH=["h_d_man_rate","h_d_blitz_rate","h_d_pressure_rate","h_d_avg_box","a_d_man_rate","a_d_blitz_rate","a_d_pressure_rate","a_d_avg_box",
     "h_o_pass_rate","h_o_rush_epa","h_o_pass_epa","a_o_pass_rate","a_o_rush_epa","a_o_pass_epa"]
W=m2[m2.week>=4].copy()
for c in SCH: W[c]=pd.to_numeric(W[c],errors="coerce")
L(f"[merge] games with scheme features: {(W[SCH].notna().all(1)).sum()} / {len(W)}")

# ---- (B) SIDES ablation: PR-core baseline vs +scheme; held-out 2024-25 vs opener ----
PR=["home_predictive_pr","away_predictive_pr","home_spread","abs_spread"]
W["abs_spread"]=W.home_spread.abs()
for c in PR: W[c]=pd.to_numeric(W[c],errors="coerce")
key=["season","home_ab","away_ab"]; OD=od[key+["open_spread","open_total","close_spread","close_total"]]
def wf_cover(feats, label):
    df=W.copy(); df["ph"]=np.nan
    for Y in range(2021,2026):
        tr=df[df.season<Y].dropna(subset=["home_cover"]+feats); te=df[df.season==Y]
        if len(tr)<300: continue
        clf=HistGradientBoostingClassifier(max_depth=3,learning_rate=0.05,max_iter=300,l2_regularization=2.0,min_samples_leaf=40,random_state=0).fit(tr[feats],tr.home_cover)
        df.loc[te.index,"ph"]=clf.predict_proba(te[feats])[:,1]
    d=df[df.season.isin([2024,2025])].merge(OD,on=key,how="inner").dropna(subset=["ph","open_spread"])
    d["hco"]=(d.actual_margin+d.open_spread>0).astype(float); d.loc[d.actual_margin+d.open_spread==0,"hco"]=np.nan
    bh=d[d.ph>=0.53]; ba=d[d.ph<=0.47]; won=pd.concat([bh.hco,1-ba.hco]).dropna(); k=int((won==1).sum()); n=int(won.isin([0,1]).sum())
    lo,hi=wilson_ci(k,n) if n else (0,0)
    L(f"  {label:34s} n={n} hit={(k/n*100 if n else 0):.1f}% CI[{lo*100:.0f},{hi*100:.0f}]")
L("\n"+"="*84); L("(B) SIDES ablation — does scheme add to PR baseline? (held-out 2024-25 vs opener)"); L("="*84)
wf_cover(PR,"PR baseline")
wf_cover(PR+SCH,"PR + scheme")

# ---- TOTALS ablation: pace+EPA baseline vs +scheme; bet edge vs open_total ----
TOT_B=["h_o_rush_epa","h_o_pass_epa","a_o_rush_epa","a_o_pass_epa"]
def wf_total(feats, label):
    df=W.dropna(subset=["actual_total","nv_total_line"]+feats).copy(); df["pt"]=np.nan
    for Y in range(2021,2026):
        tr=df[df.season<Y]; te=df[df.season==Y]
        if len(tr)<300: continue
        gb=HistGradientBoostingRegressor(max_depth=3,learning_rate=0.05,max_iter=300,l2_regularization=2.0,min_samples_leaf=40,random_state=0).fit(tr[feats],tr.actual_total)
        df.loc[te.index,"pt"]=gb.predict(te[feats])
    d=df[df.season.isin([2024,2025])].merge(OD,on=key,how="inner").dropna(subset=["pt","open_total","actual_total"])
    d["edge"]=d.pt-d.open_total
    s=d[d.edge.abs()>=2]; ov=s.actual_total>s.open_total; push=s.actual_total==s.open_total
    won=np.where(s.edge>0,ov,~ov)[~push.values]; n=len(won);k=int(won.sum()); lo,hi=wilson_ci(k,n) if n else (0,0)
    L(f"  {label:34s} edge>=2: n={n} hit={(k/n*100 if n else 0):.1f}% CI[{lo*100:.0f},{hi*100:.0f}]")
L("\n"+"="*84); L("(B) TOTALS ablation — scheme as features (held-out 2024-25 vs open_total, edge>=2)"); L("="*84)
wf_total(TOT_B,"EPA baseline")
wf_total(TOT_B+SCH,"EPA + scheme")

# ---- (C) SCHEME-ENVIRONMENT trends (incl. user's man-heavy + rush-strong hypothesis) ----
L("\n"+"="*84); L("(C) Scheme-environment matchup trends (with permutation null)"); L("="*84)
g=W.dropna(subset=["actual_total","nv_total_line"]+SCH).copy()
g["over"]=(g.actual_total>g.nv_total_line).astype(float); g=g[g.actual_total!=g.nv_total_line]
g["both_d_man"]=((g.h_d_man_rate>=0.40)&(g.a_d_man_rate>=0.40)).astype(int)        # man-heavy is ~40%+ (league avg ~36)
g["both_d_zone"]=((g.h_d_man_rate<=0.30)&(g.a_d_man_rate<=0.30)).astype(int)        # zone-heavy
g["both_o_rush_str"]=((g.h_o_rush_epa>=0.0)&(g.a_o_rush_epa>=0.0)).astype(int)      # both positive rush EPA = above avg
g["both_d_blitz"]=((g.h_d_blitz_rate>=0.30)&(g.a_d_blitz_rate>=0.30)).astype(int)
g["man_meets_rush"]=((g.both_d_man==1)&(g.both_o_rush_str==1)).astype(int)         # USER HYPOTHESIS
g["zone_meets_pass_str"]=((g.both_d_zone==1)&(g.h_o_pass_epa>=0)&(g.a_o_pass_epa>=0)).astype(int)
spots={"both Ds man-heavy(>=40)":g.both_d_man==1, "both Ds zone-heavy(<=30)":g.both_d_zone==1,
       "both Os rush-strong":g.both_o_rush_str==1, "both Ds blitz-heavy(>=30)":g.both_d_blitz==1,
       "USER: man-heavy Ds + rush-strong Os":g.man_meets_rush==1,
       "zone-heavy Ds + pass-strong Os":g.zone_meets_pass_str==1}
def pass_count(df, masks, target, thr=0.55, nmin=40):
    p=0; r={}
    for nm,mk in masks.items():
        y=df.loc[mk,target].dropna(); n=len(y); h=y.mean() if n else 0
        r[nm]=(h,n);
        if n>=nmin and (h>=thr or h<=1-thr): p+=1
    return p,r
real,res=pass_count(g,spots,"over")
rng=np.random.default_rng(0); nc=[]
for _ in range(500):
    s=g.copy(); s["over"]=s.groupby("season")["over"].transform(lambda x:rng.permutation(x.values))
    nc.append(pass_count(s,spots,"over")[0])
nc=np.array(nc)
L(f"  OVER rate vs CLOSE — permutation null: real passers={real} vs null mean={nc.mean():.1f} (95th={np.quantile(nc,.95):.0f}) -> {'ENRICHED' if real>np.quantile(nc,.95) else 'within chance'}")
for nm,(h,n) in res.items():
    lo,hi=wilson_ci(int(h*n),n) if n else (0,0); L(f"    {nm:42s} OVER {h*100:5.1f}% (n={n:4d}) CI[{lo*100:.0f},{hi*100:.0f}]")
# same battery vs cover
real2,res2=pass_count(g,spots,"home_cover")
L(f"  HOME COVER vs CLOSE — real passers={real2} (null trivial; ATS spots are mostly priced):")
for nm,(h,n) in res2.items():
    L(f"    {nm:42s} cover {h*100:5.1f}% (n={n:4d})")
