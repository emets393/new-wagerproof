"""
b60: SIDES MODEL injury ablation. Same framework as b57/b59 for totals.
The locked sides model (forecast_harness BASE) uses `air_diff` = h_air - a_air, where h_air/a_air
sum the air-share of Out/Doubtful WR/TE/RB on each team — built from injuries_raw with NO timing
filter. Same leak concern as b57 on totals.

Three variants graded vs OPENER (confidence >= .03):
  A) STRICT: BASE without air_diff (honest floor, no injury info)
  E) PREOP:  BASE with air_diff built from pre-opener injuries only (timing-honest)
  C) FULL:   BASE with all-injury air_diff (locked baseline — potentially leaky)
"""
import os, sys, warnings
import numpy as np, pandas as pd
warnings.filterwarnings("ignore")
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from stats_helpers import wilson_ci
from sklearn.ensemble import HistGradientBoostingClassifier
DATA=os.path.join(os.path.dirname(os.path.abspath(__file__)),"data"); L=print
nv2our={"LA":"LAR","SD":"LAC","STL":"LAR"}
CONF=0.03

m=pd.read_parquet(os.path.join(DATA,"matchup.parquet"))
od=pd.read_parquet(os.path.join(DATA,"odds_consensus.parquet"))
inj=pd.read_parquet(os.path.join(DATA,"injuries_raw.parquet"))
rec=pd.read_parquet(os.path.join(DATA,"ngs_receiving.parquet"))
dfd=pd.read_parquet(os.path.join(DATA,"player_stats_def.parquet"))
tg=pd.read_parquet(os.path.join(DATA,"tg.parquet"))
od["open_ts"]=pd.to_datetime(od.open_ts,errors="coerce",utc=True)
inj["date_modified"]=pd.to_datetime(inj.date_modified,errors="coerce",utc=True)

m["actual_margin"]=m.home_score-m.away_score
m["home_cover"]=(m.actual_margin+m.home_spread>0).astype(int)

# ==== team-week → open_ts ====
mw=pd.concat([
    m[["season","week","home_ab","away_ab"]].rename(columns={"home_ab":"team","away_ab":"opp"}),
    m[["season","week","away_ab","home_ab"]].rename(columns={"away_ab":"team","home_ab":"opp"})
],ignore_index=True)
od_a=od[["season","home_ab","away_ab","open_ts"]].rename(columns={"home_ab":"team","away_ab":"opp"})
od_b=od[["season","away_ab","home_ab","open_ts"]].rename(columns={"away_ab":"team","home_ab":"opp"})
od_team=pd.concat([od_a,od_b],ignore_index=True).drop_duplicates(["season","team","opp"])
twk=mw.merge(od_team,on=["season","team","opp"],how="left")
L(f"[opener join] {twk.open_ts.notna().sum()}/{len(twk)} team-weeks have opener_ts")

# ==== build air-share carry-forward ====
def carry(df,kid,col,out):
    df=df.sort_values([kid,"season","week"]).copy()
    df["_c"]=df.groupby([kid,"season"])[col].apply(lambda s:s.shift(1).expanding().mean()).reset_index(level=[0,1],drop=True)
    pl=df[["season",kid]].drop_duplicates()
    grid=pl.merge(pd.DataFrame({"week":range(1,23)}),how="cross").merge(df[["season",kid,"week","_c"]],on=["season",kid,"week"],how="left").sort_values(["season",kid,"week"])
    grid[out]=grid.groupby(["season",kid])["_c"].ffill(); return grid[["season","week",kid,out]]
air=carry(rec,"player_id","percent_share_of_intended_air_yards","airshare")

# Defensive production (leak-safe — based on prior games)
dfd["dprod"]=dfd.def_sacks.fillna(0)*2+dfd.def_qb_hits.fillna(0)+dfd.def_pass_defended.fillna(0)+dfd.def_interceptions.fillna(0)*2+dfd.def_tackles_for_loss.fillna(0)
dteam=dfd.groupby(["season","week","team"]).dprod.sum().reset_index().sort_values(["team","season","week"])
dteam["dpt"]=dteam.groupby(["team","season"]).dprod.apply(lambda s:s.shift(1).expanding().mean()).reset_index(level=[0,1],drop=True)
dteam["ab"]=dteam.team.replace(nv2our)

# ==== compute air_diff in 3 variants ====
def build_air(injf, label):
    miss=injf[injf.report_status.isin(["Out","Doubtful"])].merge(air,on=["season","week","player_id"],how="left")
    miss["air_w"]=np.where(miss.position.astype(str).str.strip().isin(["WR","TE","RB","FB"]),miss.airshare.clip(lower=0).fillna(0),0)
    ai=miss.groupby(["season","week","team"]).air_w.sum().reset_index()
    ai["ab"]=ai.team.replace(nv2our)
    return ai[["season","week","ab","air_w"]].rename(columns={"air_w":f"air_{label}"})

# FULL: all injury reports (matches current locked sides model)
ai_full=build_air(inj,"full")
# PREOP: filter to date_modified <= open_ts
inj_o=inj.merge(twk[["season","week","team","open_ts"]],on=["season","week","team"],how="left")
pre_op=inj_o[(inj_o.date_modified<=inj_o.open_ts)&inj_o.open_ts.notna()&inj_o.date_modified.notna()].copy()
ai_preop=build_air(pre_op,"preop")
L(f"\n[air injury rates 2024-25]")
for lab,df in [("FULL",ai_full),("PREOP",ai_preop)]:
    nz=df[df.season.isin([2024,2025])&(df[f"air_{lab.lower()}"]>0)]
    L(f"  {lab}: {len(nz)} team-weeks with air-share>0 from out players")

# ==== attach to matchup ====
mm=m.copy()
# defensive features
for side,p in [("home","h_"),("away","a_")]:
    mm=mm.merge(dteam[["season","week","ab","dpt"]].rename(columns={"ab":f"{side}_ab","dpt":f"{p}dpt"}),on=["season","week",f"{side}_ab"],how="left")
    for label,df in [("full",ai_full),("preop",ai_preop)]:
        mm=mm.merge(df.rename(columns={"ab":f"{side}_ab"})[["season","week",f"{side}_ab",f"air_{label}"]].rename(columns={f"air_{label}":f"{p}air_{label}"}),on=["season","week",f"{side}_ab"],how="left")
for c in ["h_dpt","a_dpt","h_air_full","a_air_full","h_air_preop","a_air_preop"]: mm[c]=mm[c].fillna(0)
mm["air_diff_full"]=mm.h_air_full-mm.a_air_full
mm["air_diff_preop"]=mm.h_air_preop-mm.a_air_preop
mm["dprod_team_diff"]=mm.h_dpt-mm.a_dpt

# schedule spot flags from tg
flags=["pre_bye","blowout_win_last","blowout_loss_last","third_road","div_revenge"]
H=tg[tg.is_home==1][["unique_id"]+flags].rename(columns={f:f"h_{f}" for f in flags})
Aw=tg[tg.is_home==0][["unique_id"]+flags].rename(columns={f:f"a_{f}" for f in flags})
mm=mm.merge(H,on="unique_id",how="left").merge(Aw,on="unique_id",how="left")

# core features
mm["pr_diff"]=mm.home_predictive_pr-mm.away_predictive_pr
mm["last5_diff"]=mm.home_last5_pr-mm.away_last5_pr
mm["abs_spread"]=mm.home_spread.abs()
mm["home_dog_7_10"]=((mm.home_spread>=7.5)&(mm.home_spread<=10.5)).astype(int)
mm["away_dog_7_10"]=((mm.home_spread<=-7.5)&(mm.home_spread>=-10.5)).astype(int)
mm["div_game_i"]=mm.div_game.astype(int); mm["conf_game_i"]=mm.conference_game.astype(int); mm["league_game_i"]=mm.league_game.astype(int)
mm["primetime_i"]=mm.primetime.fillna(0).astype(int); mm["home_fav"]=(mm.home_spread<0).astype(int)
sched=[f"{s}_{f}" for s in ["h","a"] for f in flags]
for c in sched: mm[c]=pd.to_numeric(mm[c],errors="coerce").fillna(0)
ref=[c for c in ["ref_total_pts_avg","ref_home_cover_pct","ref_under_pct","ref_fav_cover_pct"] if c in mm.columns]

# BASE features (3 variants, only differ in air_diff)
CORE=["pr_diff","home_predictive_pr","away_predictive_pr","last5_diff","home_consistency_pr","away_consistency_pr",
      "home_dog_7_10","away_dog_7_10","div_game_i","conf_game_i","league_game_i","primetime_i","week","home_fav","abs_spread",
      "dprod_team_diff","h_dpt","a_dpt"]+ref+sched
BASE_FULL=CORE+["air_diff_full"]
BASE_PREOP=CORE+["air_diff_preop"]
BASE_STRICT=CORE   # no air_diff
for c in set(BASE_FULL+BASE_PREOP): mm[c]=pd.to_numeric(mm[c],errors="coerce")

# ==== walk-forward train, grade vs OPENER ====
def run(feats, label):
    df=mm.copy(); df["ph"]=np.nan
    for Y in [2024,2025]:
        tr=df[(df.season<Y)&(df.week>=4)].dropna(subset=["home_cover"]+feats)
        te=df[df.season==Y]
        clf=HistGradientBoostingClassifier(max_depth=3,learning_rate=0.05,max_iter=300,l2_regularization=2.0,min_samples_leaf=40,random_state=0).fit(tr[feats],tr.home_cover)
        df.loc[te.index,"ph"]=clf.predict_proba(te[feats])[:,1]
    d=df[df.season.isin([2024,2025])].merge(od[["season","home_ab","away_ab","open_spread","close_spread"]],on=["season","home_ab","away_ab"],how="inner").dropna(subset=["ph","open_spread"])
    d["hco"]=(d.actual_margin+d.open_spread>0).astype(float); d.loc[d.actual_margin+d.open_spread==0,"hco"]=np.nan
    d["clv"]=np.where(d.ph>=0.5, d.open_spread-d.close_spread, d.close_spread-d.open_spread)
    bh=d[d.ph>=0.5+CONF]; ba=d[d.ph<=0.5-CONF]
    won=pd.concat([bh.hco,1-ba.hco]).dropna()
    clv=pd.concat([bh.clv,ba.clv]).mean() if (len(bh)+len(ba)) else np.nan
    k=int(won.sum()); n=len(won); lo,hi=wilson_ci(k,n) if n else (0,0); roi=(k*100/110-(n-k))/n*100 if n else 0
    L(f"\n  {label:24s} n={n} hit={(k/n*100 if n else 0):.1f}% CI[{lo*100:.0f},{hi*100:.0f}] ROI={roi:+.1f}% CLV={clv:+.3f}pts")
    # per-season
    for Y in [2024,2025]:
        dy=d[d.season==Y]; bh=dy[dy.ph>=0.5+CONF]; ba=dy[dy.ph<=0.5-CONF]
        won=pd.concat([bh.hco,1-ba.hco]).dropna()
        clv=pd.concat([bh.clv,ba.clv]).mean() if (len(bh)+len(ba)) else np.nan
        k=int(won.sum()); n=len(won); roi=(k*100/110-(n-k))/n*100 if n else 0
        L(f"    {Y}: n={n} hit={(k/n*100 if n else 0):.1f}% ROI={roi:+.1f}% CLV={clv:+.3f}")

L(f"\n{'='*86}\nSIDES — held-out 2024-25 vs OPENER, conf>=.03\n{'='*86}")
run(BASE_STRICT, "A) STRICT (no air_diff)")
run(BASE_PREOP,  "E) PREOP (pre-opener air_diff)")
run(BASE_FULL,   "C) FULL (all-injury air_diff = current locked)")
