"""
Feature selection / ablation — DONE RIGHT (held-out evaluation, no selection leak).
TRAIN=2018-22, VAL=2023 (select features here), TEST=2024-25 (held out, judge here only).
Forward selection (greedy, by VAL MAE) + backward ablation (which features HURT). Then on held-out TEST:
does the selected subset beat the market line (corr/MAE) and beat it betting (ATS/OU)?
Candidate pools curated (~40 each) to keep the search tractable and shrink the overfit surface.
"""
import os, sys, warnings
import numpy as np, pandas as pd
warnings.filterwarnings("ignore")
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from stats_helpers import wilson_ci, bet_summary, fmt
from sklearn.ensemble import HistGradientBoostingRegressor
from sklearn.metrics import mean_absolute_error
DATA = os.path.join(os.path.dirname(os.path.abspath(__file__)), "data")
L = print
m = pd.read_parquet(os.path.join(DATA, "matchup.parquet"))
# rebuild injury features (same as b9)
inj=pd.read_parquet(os.path.join(DATA,"injuries_raw.parquet")); rec=pd.read_parquet(os.path.join(DATA,"ngs_receiving.parquet"))
pas=pd.read_parquet(os.path.join(DATA,"ngs_passing.parquet")); sc=pd.read_parquet(os.path.join(DATA,"snap_counts.parquet"))
px=pd.read_parquet(os.path.join(DATA,"players_xwalk.parquet")); g2p=dict(zip(px.gsis_id,px.pfr_id))
def carry(df,kid,col,out):
    df=df.sort_values([kid,"season","week"]).copy()
    df["_c"]=df.groupby([kid,"season"])[col].apply(lambda s:s.shift(1).expanding().mean()).reset_index(level=[0,1],drop=True)
    pl=df[["season",kid]].drop_duplicates(); grid=pl.merge(pd.DataFrame({"week":range(1,23)}),how="cross").merge(df[["season",kid,"week","_c"]],on=["season",kid,"week"],how="left").sort_values(["season",kid,"week"])
    grid[out]=grid.groupby(["season",kid])["_c"].ffill(); return grid[["season","week",kid,out]]
air=carry(rec,"player_id","percent_share_of_intended_air_yards","airshare"); qat=carry(pas,"player_id","attempts","qb_att")
sc=sc[sc.game_type=="REG"].copy(); sc["def_pct"]=sc.defense_pct.fillna(0); dsnap=carry(sc,"pfr_player_id","def_pct","def_pct_prior")
miss=inj[inj.report_status.isin(["Out","Doubtful"])].copy(); miss["pfr"]=miss.player_id.map(g2p)
miss=miss.merge(air,on=["season","week","player_id"],how="left").merge(qat,on=["season","week","player_id"],how="left").merge(dsnap.rename(columns={"pfr_player_id":"pfr"}),on=["season","week","pfr"],how="left")
SK={"WR","TE","RB","FB"}; DEFP={"DE","DT","NT","OLB","EDGE","CB","S","SS","FS","DB","LB","ILB","MLB"}
miss["air_w"]=np.where(miss.position.isin(SK),miss.airshare.clip(lower=0).fillna(0),0); miss["qb_w"]=((miss.position=="QB")&(miss.qb_att>=15)).astype(float); miss["def_w"]=np.where(miss.position.isin(DEFP),miss.def_pct_prior.fillna(0),0)
ti=miss.groupby(["season","week","team"]).agg(air_out=("air_w","sum"),qb_out=("qb_w","max"),def_out=("def_w","sum")).reset_index()
nv2our={"LA":"LAR","SD":"LAC","STL":"LAR"}; ti["ab"]=ti.team.replace(nv2our)
for side in ["home","away"]:
    p="h_" if side=="home" else "a_"
    m=m.merge(ti.rename(columns={"ab":f"{side}_ab","air_out":f"{p}air_out","qb_out":f"{p}qb_out","def_out":f"{p}def_out"})[["season","week",f"{side}_ab",f"{p}air_out",f"{p}qb_out",f"{p}def_out"]],on=["season","week",f"{side}_ab"],how="left")
for c in ["h_air_out","h_qb_out","h_def_out","a_air_out","a_qb_out","a_def_out"]: m[c]=m[c].fillna(0)
m["pr_diff"]=m.home_predictive_pr-m.away_predictive_pr; m["last5_diff"]=m.home_last5_pr-m.away_last5_pr
m["air_diff"]=m.h_air_out-m.a_air_out; m["def_diff"]=m.h_def_out-m.a_def_out; m["rest_diff"]=m.home_rest-m.away_rest
m["passer_diff"]=m.home_off_passer_rating_s2d-m.away_off_passer_rating_s2d
m["pace_sum"]=m.home_off_plays_per_game_s2d+m.away_off_plays_per_game_s2d
m["mkt_margin"]=-m.home_spread; m["actual_margin"]=m.home_score-m.away_score; m["actual_total"]=m.home_score+m.away_score
m["is_outdoor"]=(~m.dome_closed.astype("boolean").fillna(False)).astype(int)
W=m[m.week>=4].copy()

TOT_POOL=["wind_mph","precipitation_pct","dome_closed","is_outdoor","temp_f","primetime","kick_hour_et","pace_sum",
 "home_points_per_play","away_points_per_play","home_off_pass_epa_neutral_s2d","away_off_pass_epa_neutral_s2d",
 "home_def_pass_epa_allowed_neutral_s2d","away_def_pass_epa_allowed_neutral_s2d","home_off_pts_per_drive_s2d",
 "away_off_pts_per_drive_s2d","home_def_pts_per_drive_allowed_s2d","away_def_pts_per_drive_allowed_s2d",
 "h_air_out","a_air_out","h_qb_out","a_qb_out","h_def_out","a_def_out","home_off_proe_s2d","away_off_proe_s2d",
 "exp_total_ppd","env_pass_epa","ref_total_pts_avg","week"]
MAR_POOL=["pr_diff","last5_diff","home_predictive_pr","away_predictive_pr","h_air_out","a_air_out","h_qb_out","a_qb_out",
 "h_def_out","a_def_out","air_diff","def_diff","rest_diff","passer_diff","hnet_pass_epa","anet_pass_epa","hnet_rush_epa",
 "anet_rush_epa","sep_ppd","home_consistency_pr","away_consistency_pr","primetime","div_game","home_last5_pr","away_last5_pr"]
for c in set(TOT_POOL+MAR_POOL):
    if c in W.columns: W[c]=pd.to_numeric(W[c],errors="coerce")

TR=W[W.season<=2022]; VA=W[W.season==2023]; TE=W[W.season.isin([2024,2025])]

def fit_pred(feats, target, tr, ev):
    gb=HistGradientBoostingRegressor(max_depth=3,learning_rate=0.06,max_iter=250,l2_regularization=2.0,min_samples_leaf=40,random_state=0)
    gb.fit(tr[feats], tr[target]); return gb.predict(ev[feats])

def forward_select(pool, target, line_col):
    chosen=[]; best=1e9
    pool=[f for f in pool if f in W.columns]
    improved=True
    while improved and len(chosen)<12:
        improved=False; cand=None
        for f in [x for x in pool if x not in chosen]:
            p=fit_pred(chosen+[f], target, pd.concat([TR,VA]).iloc[:len(TR)] if False else TR, VA)
            mae=mean_absolute_error(VA[target], p)
            if mae<best-0.02:
                best=mae; cand=f; improved=True
        if cand: chosen.append(cand)
    return chosen, best

def betting(feats, target, line_col, is_margin):
    p=fit_pred(feats, target, pd.concat([TR,VA]), TE)  # train on 2018-23, predict held-out 2024-25
    te=TE.copy(); te["pred"]=p; te["disc"]=te.pred - te[line_col]
    corr_m=np.corrcoef(te.pred,te[target])[0,1]; corr_l=np.corrcoef(te[line_col],te[target])[0,1]
    L(f"    TEST(24-25): model corr={corr_m:.3f} vs market {corr_l:.3f} | MAE model={np.abs(te.pred-te[target]).mean():.2f} market={np.abs(te[line_col]-te[target]).mean():.2f}")
    if is_margin:
        te["hcov"]=np.where(te[target]>te.mkt_margin,1.0,np.where(te[target]<te.mkt_margin,0.0,np.nan))
        for thr in [1,2,3]:
            h=te[te.disc>=thr]; a=te[te.disc<=-thr]; won=pd.concat([h["hcov"],1-a["hcov"]]).dropna(); k=int((won==1).sum()); n=int(won.isin([0,1]).sum())
            L("      bet |disc|>=%d: %s"%(thr,fmt(bet_summary(k,n,f"thr{thr}"))))
    else:
        te["ov"]=np.where(te[target]>te[line_col],1.0,np.where(te[target]<te[line_col],0.0,np.nan))
        for thr in [1,2,3]:
            o=te[te.disc>=thr]; u=te[te.disc<=-thr]; won=pd.concat([o.ov,1-u.ov]).dropna(); k=int((won==1).sum()); n=int(won.isin([0,1]).sum())
            L("      bet |disc|>=%d: %s"%(thr,fmt(bet_summary(k,n,f"thr{thr}"))))

L("="*90); L("FEATURE SELECTION (select on 2018-23, evaluate on HELD-OUT 2024-25)"); L("="*90)
for label, pool, target, line in [("TOTAL", TOT_POOL, "actual_total", "ou_vegas_line"), ("MARGIN", MAR_POOL, "actual_margin", "mkt_margin")]:
    sel, vmae = forward_select(pool, target, line)
    L(f"\n[{label}] forward-selected ({len(sel)} feats, VAL MAE={vmae:.2f}): {sel}")
    L(f"  held-out TEST performance of the SELECTED subset:")
    betting(sel, target, line, label=="MARGIN" if False else (label=="MARGIN"))
    L(f"  vs FULL pool ({len(pool)} feats) on held-out TEST:")
    betting([f for f in pool if f in W.columns], target, line, label=="MARGIN")
