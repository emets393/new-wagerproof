"""
b59: PRE-OPENER injury filter — use open_ts (odds_consensus) + date_modified (injuries_raw) to
restrict injury features to ONLY those known when the opener was set. The realistic middle tier
between b57's strict-open (no injuries) and b57's full (all injuries, leaky).

For b15: rebuild key_recv_out, h_max_air_out, a_max_air_out with pre-opener filter.
For b55: stays strict-open (matchup-pipeline injury features can't be refiltered without
recomputing the pipeline). Future work: rebuild b55 features with pre-opener inputs.

Tests both 2024 and 2025 (where odds_consensus has openers). Compares 3 ensemble combos:
  A: strict-b15 + strict-b55  (current locked baseline)
  E: PREOP-b15 + strict-b55   (NEW middle tier)
  C: full-b15 + full-b55      (leaky reference for upper bound)
All at b58 sweet spot (agree + 3<=min|edge|<=7).
"""
import os, sys, warnings
import numpy as np, pandas as pd
warnings.filterwarnings("ignore")
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from stats_helpers import wilson_ci
from sklearn.ensemble import HistGradientBoostingRegressor
from consensus_totals import build_b55, MIN_EDGE_BET, MAX_EDGE_BET
DATA=os.path.join(os.path.dirname(os.path.abspath(__file__)),"data"); L=print
nv2our={"LA":"LAR","SD":"LAC","STL":"LAR"}

m=pd.read_parquet(os.path.join(DATA,"matchup.parquet"))
od=pd.read_parquet(os.path.join(DATA,"odds_consensus.parquet"))
inj=pd.read_parquet(os.path.join(DATA,"injuries_raw.parquet"))
rec=pd.read_parquet(os.path.join(DATA,"ngs_receiving.parquet"))
m["actual_total"]=m.home_score+m.away_score
od["open_ts"]=pd.to_datetime(od.open_ts,errors="coerce",utc=True)
inj["date_modified"]=pd.to_datetime(inj.date_modified,errors="coerce",utc=True)
L(f"[load] matchup {m.shape} | injuries {inj.shape} | odds {od.shape}")

# ==== Build team-week -> open_ts mapping ====
# Each team plays one game per week. Use matchup for (season, week, team, opp); join odds on (season, team, opp)
mw=pd.concat([
    m[["season","week","home_ab","away_ab"]].rename(columns={"home_ab":"team","away_ab":"opp"}),
    m[["season","week","away_ab","home_ab"]].rename(columns={"away_ab":"team","home_ab":"opp"})
],ignore_index=True)
# odds has (season, home_ab, away_ab, open_ts) — same orientation as our (team, opp) when team=home_ab
od_a=od[["season","home_ab","away_ab","open_ts"]].rename(columns={"home_ab":"team","away_ab":"opp"})
od_b=od[["season","away_ab","home_ab","open_ts"]].rename(columns={"away_ab":"team","home_ab":"opp"})
od_team=pd.concat([od_a,od_b],ignore_index=True).drop_duplicates(["season","team","opp"])
twk=mw.merge(od_team,on=["season","team","opp"],how="left")
L(f"[team-week opener] {twk.open_ts.notna().sum()} / {len(twk)} team-weeks have opener_ts ({twk.open_ts.notna().mean()*100:.1f}%)")
L(f"[seasons with opener_ts]: {sorted(twk[twk.open_ts.notna()].season.unique().tolist())}")

# ==== Filter injuries to pre-opener ====
inj_o=inj.merge(twk[["season","week","team","open_ts"]],on=["season","week","team"],how="left")
pre_op_mask=(inj_o.date_modified<=inj_o.open_ts)&inj_o.open_ts.notna()&inj_o.date_modified.notna()
L(f"\n[pre-opener filter]")
L(f"  injuries w/ opener_ts available: {inj_o.open_ts.notna().sum():,} / {len(inj_o):,}")
L(f"  PRE-OPENER (date_modified <= open_ts): {pre_op_mask.sum():,} ({pre_op_mask.sum()/inj_o.open_ts.notna().sum()*100:.1f}%)")
L(f"  POST-OPENER (the leak): {(inj_o.open_ts.notna() & ~pre_op_mask).sum():,}")
pre_op_inj=inj_o[pre_op_mask].copy()

# ==== Build air-share carry-forward (same as b15_totals) ====
def carry(df,kid,col,out):
    df=df.sort_values([kid,"season","week"]).copy()
    df["_c"]=df.groupby([kid,"season"])[col].apply(lambda s:s.shift(1).expanding().mean()).reset_index(level=[0,1],drop=True)
    pl=df[["season",kid]].drop_duplicates()
    grid=pl.merge(pd.DataFrame({"week":range(1,23)}),how="cross").merge(df[["season",kid,"week","_c"]],on=["season",kid,"week"],how="left").sort_values(["season",kid,"week"])
    grid[out]=grid.groupby(["season",kid])["_c"].ffill(); return grid[["season","week",kid,out]]
air=carry(rec,"player_id","percent_share_of_intended_air_yards","airshare")

# ==== Compute key_recv_out + max_air_out per (season,week,team) for PREOP and FULL ====
def kr(injf, label):
    miss=injf[injf.report_status.isin(["Out","Doubtful"])].merge(air,on=["season","week","player_id"],how="left")
    miss=miss[miss.position.isin({"WR","TE","RB","FB"})]
    return miss.groupby(["season","week","team"]).airshare.max().reset_index().rename(columns={"airshare":f"max_air_out_{label}"})
preop_k=kr(pre_op_inj,"preop")
full_k=kr(inj,"full")

# ==== Attach to matchup-derived working frame ====
mm=m.copy()
for label, kdf in [("preop",preop_k),("full",full_k)]:
    for side,p in [("home","h_"),("away","a_")]:
        col=f"max_air_out_{label}"; out=f"{p}{col}"
        mm=mm.merge(kdf.rename(columns={"team":f"{side}_ab",col:out})[["season","week",f"{side}_ab",out]],on=["season","week",f"{side}_ab"],how="left")
        mm[out]=mm[out].fillna(0)
    mm[f"key_recv_out_{label}"]=((mm[f"h_max_air_out_{label}"]>=35)|(mm[f"a_max_air_out_{label}"]>=35)).astype(int)

# Fire rate comparison
test=mm[mm.season.isin([2024,2025])]
L(f"\n[key_recv_out fire rate on test years 2024+2025]")
L(f"  PREOP version:  {int(test.key_recv_out_preop.sum())} / {len(test)} = {test.key_recv_out_preop.mean()*100:.1f}%")
L(f"  FULL version:   {int(test.key_recv_out_full.sum())} / {len(test)} = {test.key_recv_out_full.mean()*100:.1f}%")
L(f"  Games where FULL fires but PREOP doesn't (post-opener news): {int(((test.key_recv_out_full==1)&(test.key_recv_out_preop==0)).sum())}")

# ==== Build b15 weather/env features (same as b15_totals.py) ====
mm["wind_mph"]=pd.to_numeric(mm.wind_mph,errors="coerce").fillna(pd.to_numeric(mm.wind_speed,errors="coerce"))
mm["temp_f"]=pd.to_numeric(mm.temp_f,errors="coerce").fillna(pd.to_numeric(mm.temperature,errors="coerce"))
mm["dome"]=(mm.dome_closed.fillna(0).astype(float)>0).astype(int) if "dome_closed" in mm else 0
mm["wind_under"]=(mm.wind_mph>=15).astype(int); mm["cold"]=(mm.temp_f<=32).astype(int); mm["primetime_i"]=mm.primetime.fillna(0).astype(int)
def s(c): return pd.to_numeric(mm[c],errors="coerce") if c in mm.columns else np.nan
mm["off_ppd_sum"]=s("home_off_ppd_s2d")+s("away_off_ppd_s2d")
mm["def_ppd_sum"]=s("home_def_ppd_allowed_s2d")+s("away_def_ppd_allowed_s2d")
mm["pace_sum"]=s("home_off_pace_s2d")+s("away_off_pace_s2d")
mm["pass_epa_sum"]=s("home_off_pass_epa_neutral_s2d")+s("away_off_pass_epa_neutral_s2d")
mm["rush_epa_sum"]=s("home_off_rush_epa_neutral_s2d")+s("away_off_rush_epa_neutral_s2d")
mm["def_pass_allowed_sum"]=s("home_def_pass_epa_allowed_neutral_s2d")+s("away_def_pass_epa_allowed_neutral_s2d")
mm["def_rush_allowed_sum"]=s("home_def_rush_epa_allowed_neutral_s2d")+s("away_def_rush_epa_allowed_neutral_s2d")
mm["expl_pass_sum"]=s("home_off_explosive_pass_rate_s2d")+s("away_off_explosive_pass_rate_s2d")
mm["td_per_drive_sum"]=s("home_off_td_per_drive_s2d")+s("away_off_td_per_drive_s2d")
mm["last_pts_sum"]=s("home_last_points")+s("away_last_points")+s("home_last_allowed_points")+s("away_last_allowed_points")
mm["no_huddle_sum"]=s("home_off_no_huddle_rate_s2d")+s("away_off_no_huddle_rate_s2d")

B15_BASE=["off_ppd_sum","def_ppd_sum","pace_sum","pass_epa_sum","rush_epa_sum","def_pass_allowed_sum",
          "def_rush_allowed_sum","expl_pass_sum","td_per_drive_sum","last_pts_sum","no_huddle_sum",
          "wind_mph","temp_f","dome","wind_under","cold","primetime_i"]
B15_INJ_PREOP=["key_recv_out_preop","h_max_air_out_preop","a_max_air_out_preop"]
B15_INJ_FULL=["key_recv_out_full","h_max_air_out_full","a_max_air_out_full"]
B15_BASE=[c for c in B15_BASE if c in mm.columns and pd.to_numeric(mm[c],errors="coerce").notna().mean()>0.5]
for c in set(B15_BASE+B15_INJ_PREOP+B15_INJ_FULL): mm[c]=pd.to_numeric(mm[c],errors="coerce")

# Train 3 variants of b15
def train_b15(feats, label):
    W=mm[mm.week>=4].copy(); W[f"pt_b15_{label}"]=np.nan
    for Y in [2024,2025]:
        trn=W[W.season<Y].dropna(subset=["actual_total"]+feats); te=W[W.season==Y]
        gb=HistGradientBoostingRegressor(max_depth=3,learning_rate=0.05,max_iter=350,l2_regularization=2.0,min_samples_leaf=40,random_state=0).fit(trn[feats],trn.actual_total)
        W.loc[te.index,f"pt_b15_{label}"]=gb.predict(te[feats])
    return W[W.season.isin([2024,2025])][['season','week','home_ab','away_ab',f"pt_b15_{label}"]].dropna(subset=[f"pt_b15_{label}"])

L(f"\n[train] b15 variants...")
b15_strict=train_b15(B15_BASE, "strict")
b15_preop=train_b15(B15_BASE+B15_INJ_PREOP, "preop")
b15_full=train_b15(B15_BASE+B15_INJ_FULL, "full")
L(f"  strict: {len(b15_strict)} preds | preop: {len(b15_preop)} preds | full: {len(b15_full)} preds")

# Build b55 variants (use existing locked function)
L(f"\n[train] b55 strict-open...")
b55_strict=pd.concat([build_b55(Y, strict_open=True) for Y in [2024,2025]], ignore_index=True)
L(f"[train] b55 full (with injuries)...")
b55_full=pd.concat([build_b55(Y, strict_open=False) for Y in [2024,2025]], ignore_index=True)

# Assemble game-level frame
gp=m[m.season.isin([2024,2025])][['season','week','home_ab','away_ab','home_score','away_score']].copy()
gp['actual_total']=gp.home_score+gp.away_score
for df,col in [(b15_strict,'pt_b15_strict'),(b15_preop,'pt_b15_preop'),(b15_full,'pt_b15_full')]:
    gp=gp.merge(df,on=['season','week','home_ab','away_ab'],how='left')
gp=gp.merge(b55_strict.rename(columns={'pt_b55':'pt_b55_strict'}),on=['season','week','home_ab','away_ab'],how='left')
gp=gp.merge(b55_full.rename(columns={'pt_b55':'pt_b55_full'}),on=['season','week','home_ab','away_ab'],how='left')
gp=gp.merge(od[['season','home_ab','away_ab','open_total']],on=['season','home_ab','away_ab'],how='left')
gp=gp.dropna(subset=['actual_total','open_total','pt_b15_strict','pt_b15_preop','pt_b15_full','pt_b55_strict','pt_b55_full']).copy()
L(f"\n[assemble] n games with all predictions: {len(gp)}")

# ==== Run ensemble in 3 combos with b58 sweet spot ====
def ensemble(d, b15_col, b55_col, label):
    L(f"\n{'='*86}\n{label}\n{'='*86}")
    edge_b15=d[b15_col]-d.open_total; edge_b55=d[b55_col]-d.open_total
    agree=(np.sign(edge_b15)==np.sign(edge_b55))&(edge_b15!=0)&(edge_b55!=0)
    min_edge=np.minimum(edge_b15.abs(),edge_b55.abs())
    sub=d[agree&(min_edge>=MIN_EDGE_BET)&(min_edge<=MAX_EDGE_BET)].copy()
    e=edge_b15[agree&(min_edge>=MIN_EDGE_BET)&(min_edge<=MAX_EDGE_BET)]
    over=(sub.actual_total>sub.open_total).astype(float).where(sub.actual_total!=sub.open_total,np.nan)
    won=np.where(e>0,over,1-over); won=pd.Series(won).dropna()
    k=int(won.sum()); n=len(won); lo,hi=wilson_ci(k,n) if n else (0,0); roi=(k*100/110-(n-k))/n*100 if n else 0
    L(f"  HC (3-7 sweet spot, agree): n={n} hit={(k/n*100 if n else 0):.1f}% CI[{lo*100:.0f},{hi*100:.0f}] ROI={roi:+.1f}%")
    # Also show per-season
    for Y in [2024,2025]:
        d_y=d[d.season==Y]; eb15_y=d_y[b15_col]-d_y.open_total; eb55_y=d_y[b55_col]-d_y.open_total
        agree_y=(np.sign(eb15_y)==np.sign(eb55_y))&(eb15_y!=0)&(eb55_y!=0)
        min_y=np.minimum(eb15_y.abs(),eb55_y.abs())
        sub_y=d_y[agree_y&(min_y>=MIN_EDGE_BET)&(min_y<=MAX_EDGE_BET)]
        e_y=eb15_y[agree_y&(min_y>=MIN_EDGE_BET)&(min_y<=MAX_EDGE_BET)]
        over_y=(sub_y.actual_total>sub_y.open_total).astype(float).where(sub_y.actual_total!=sub_y.open_total,np.nan)
        won_y=np.where(e_y>0,over_y,1-over_y); won_y=pd.Series(won_y).dropna()
        k_y=int(won_y.sum()); n_y=len(won_y); roi_y=(k_y*100/110-(n_y-k_y))/n_y*100 if n_y else 0
        L(f"    {Y}: n={n_y} hit={(k_y/n_y*100 if n_y else 0):.1f}% ROI={roi_y:+.1f}%")

ensemble(gp,'pt_b15_strict','pt_b55_strict','A) STRICT b15 + STRICT b55  -- current locked baseline')
ensemble(gp,'pt_b15_preop','pt_b55_strict','E) PRE-OPENER b15 + STRICT b55  -- NEW middle tier (honest)')
ensemble(gp,'pt_b15_preop','pt_b55_full',  'E2) PRE-OPENER b15 + FULL b55  -- mixed (b55 features still uncontrolled)')
ensemble(gp,'pt_b15_full','pt_b55_full',   'C) FULL b15 + FULL b55  -- LEAKY reference (post-opener info)')

L(f"\n{'='*86}\nSUMMARY")
L(f"{'='*86}")
L(f"  If E (pre-opener b15 + strict b55) beats A (current baseline): swap b15 preop into production")
L(f"  If E2 (pre-opener b15 + full b55) > E: matchup pipeline injury features are mostly pre-opener -> include them too")
L(f"  If all variants are similar: the b15 injury features add little; b55 + scheme is doing most of the work")
