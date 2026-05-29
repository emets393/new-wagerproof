"""
FLAG ablation + new-flag discovery for the locked sides model (the lever that moved 51.9->56%).
A) PRUNE: leave-one-out on the current flag groups -> held-out 2024-25 ATS vs opener. Drop hurts -> keep; drop helps -> cut.
B) DISCOVER: mechanism-based NEW candidate flags, tested as standalone spots vs opener + per-season + PERMUTATION NULL.
C) REBUILD: BASE(pruned) + surviving new flags -> re-measure held-out vs opener + CLV. Beat 56%?
Reuses forecast_harness.build() so we ablate the EXACT locked pipeline.
"""
import os, sys, warnings
import numpy as np, pandas as pd
warnings.filterwarnings("ignore")
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from stats_helpers import wilson_ci
from sklearn.ensemble import HistGradientBoostingClassifier
from forecast_harness import build, DATA
L=print; CONF=0.03
m,BASE=build()
od=pd.read_parquet(os.path.join(DATA,"odds_consensus.parquet"))
key=["season","home_ab","away_ab"]; OD=od[key+["open_spread","close_spread"]]
PR=["pr_diff","home_predictive_pr","away_predictive_pr","last5_diff","home_consistency_pr","away_consistency_pr"]
GROUPS={
 "dog7_10":["home_dog_7_10","away_dog_7_10"],
 "matchup":["div_game_i","conf_game_i","league_game_i"],
 "primetime":["primetime_i"], "homefav_absspread":["home_fav","abs_spread"],
 "schedule":[c for c in ["h_pre_bye","a_pre_bye","h_blowout_win_last","a_blowout_win_last","h_blowout_loss_last","a_blowout_loss_last","h_third_road","a_third_road","h_div_revenge","a_div_revenge"] if c in m.columns],
 "injury":["air_diff"], "defense":["dprod_team_diff","h_dpt","a_dpt"],
 "referee":[c for c in ["ref_total_pts_avg","ref_home_cover_pct","ref_under_pct","ref_fav_cover_pct"] if c in m.columns],
}
def walkfwd_grade(feats, extra=None):
    df=m.copy()
    if extra: feats=feats+extra
    df["ph"]=np.nan
    for Y in range(2021,2026):
        tr=df[(df.season<Y)&(df.week>=4)].dropna(subset=["home_cover"]); te=df[(df.season==Y)&(df.week>=4)]
        clf=HistGradientBoostingClassifier(max_depth=3,learning_rate=0.05,max_iter=300,l2_regularization=2.0,min_samples_leaf=40,random_state=0).fit(tr[feats],tr.home_cover)
        df.loc[te.index,"ph"]=clf.predict_proba(te[feats])[:,1]
    d=df[df.season.isin([2024,2025])].merge(OD,on=key,how="inner").dropna(subset=["ph","open_spread"])
    d["hco"]=(d.actual_margin+d.open_spread>0).astype(float); d.loc[d.actual_margin+d.open_spread==0,"hco"]=np.nan
    bh=d[d.ph>=0.5+CONF]; ba=d[d.ph<=0.5-CONF]; won=pd.concat([bh.hco,1-ba.hco]).dropna(); k=int((won==1).sum()); n=int(won.isin([0,1]).sum())
    clv=pd.concat([(bh.open_spread-bh.close_spread),(ba.close_spread-ba.open_spread)]).mean()
    lo,hi=wilson_ci(k,n) if n else (0,0); return n,(k/n*100 if n else 0),lo*100,hi*100,clv

L("="*88); L("A) PRUNE — leave-one-out on flag groups (held-out 2024-25 ATS vs opener, conf>=.03)"); L("="*88)
n,h,lo,hi,clv=walkfwd_grade(BASE); L(f"  FULL locked model: n={n} hit={h:.1f}% CI[{lo:.0f},{hi:.0f}] CLV={clv:+.2f}")
for g,fs in GROUPS.items():
    sub=[f for f in BASE if f not in fs]; n2,h2,lo2,hi2,c2=walkfwd_grade(sub)
    tag="CUT?" if h2>h else "keep"; L(f"  drop {g:18s}: hit={h2:.1f}% ({h2-h:+.1f}) n={n2} CLV={c2:+.2f}   {tag}")

L("\n"+"="*88); L("B) DISCOVER — new mechanism-based candidate flags: standalone home-cover vs OPENER + null"); L("="*88)
m["rest_diff"]=m.home_rest-m.away_rest
cand={
 "home_rest_edge3":(m.rest_diff>=3),"away_rest_edge3":(m.rest_diff<=-3),
 "short_week":((m.home_rest<=4)|(m.away_rest<=4)),
 "big_home_fav7":(m.home_spread<=-7),"big_road_fav7":(m.home_spread>=7),
 "div_late":((m.div_game==1)&(m.week>=12)),"div_early":((m.div_game==1)&(m.week<=6)),
 "home_off_bye":(m.home_rest>=13),"away_off_bye":(m.away_rest>=13),
}
dd=m[m.week>=4].merge(OD,on=key,how="inner").dropna(subset=["open_spread"]).copy()
dd["hco"]=(dd.actual_margin+dd.open_spread>0).astype(float); dd=dd[dd.actual_margin+dd.open_spread!=0]
base_home=dd.hco.mean()
def spot_pass(df,masks,thr=0.55,nmin=60):
    p=0
    for nm,mk in masks.items():
        y=df.loc[mk.reindex(df.index,fill_value=False),"hco"].dropna(); n=len(y); h=y.mean() if n else .5
        if n>=nmin and (h>=thr or h<=1-thr): p+=1
    return p
masks={k:v for k,v in cand.items()}
real=spot_pass(dd,masks); rng=np.random.default_rng(0); nc=[]
for _ in range(300):
    s=dd.copy(); s["hco"]=s.groupby("season")["hco"].transform(lambda x:rng.permutation(x.values)); nc.append(spot_pass(s,masks))
nc=np.array(nc)
L(f"  baseline home-cover vs opener={base_home*100:.1f}%. Candidate spots passing(|dev|->=55%,n>=60): real={real} vs null mean={nc.mean():.1f} (95th={np.quantile(nc,.95):.0f}) -> {'ENRICHED' if real>np.quantile(nc,.95) else 'NO signal'}")
surv=[]
for nm,mk in cand.items():
    y=dd.loc[mk.reindex(dd.index,fill_value=False),"hco"].dropna(); n=len(y); h=y.mean() if n else .5
    ps=[]
    for yr in sorted(dd.season.unique()):
        yy=dd[(dd.season==yr)]; ym=mk.reindex(yy.index,fill_value=False); yv=yy.loc[ym,"hco"].dropna(); ps.append(yv.mean()*100 if len(yv) else np.nan)
    cons=np.sum([(p>=55 or p<=45) for p in ps if not np.isnan(p)])
    keep = n>=60 and (h>=0.55 or h<=0.45) and cons>=4
    if keep: surv.append(nm)
    L(f"  {nm:16s} home-cover={h*100:4.1f}% (n={n:4d}) seasons|dev|: {['%.0f'%p if not np.isnan(p) else 'na' for p in ps]} {'<= ADD' if keep else ''}")

L("\n"+"="*88); L("C) REBUILD — pruned + surviving new flags, held-out vs opener + CLV"); L("="*88)
# auto-prune: drop groups whose removal improved hit; keep survivors as features
prune=[]
nF,hF,_,_,_=walkfwd_grade(BASE)
for g,fs in GROUPS.items():
    sub=[f for f in BASE if f not in fs]; _,h2,_,_,_=walkfwd_grade(sub)
    if h2>hF+0.3: prune+=fs
pruned=[f for f in BASE if f not in prune]
for nm in surv: m[nm]=cand[nm].astype(int)
n,h,lo,hi,clv=walkfwd_grade(pruned, extra=[s for s in surv])
L(f"  pruned (cut {len(prune)} feats) + {len(surv)} new flags: n={n} hit={h:.1f}% CI[{lo:.0f},{hi:.0f}] CLV={clv:+.2f}  (baseline 55.6%)")
