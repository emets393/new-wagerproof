"""
KITCHEN-SINK combined model — everything together (your point: stop testing silos).
ONE feature matrix: power ratings + EPA matchup nets + team EPA/success/explosive + FTN scheme +
NGS + value-weighted INJURIES (air-share/QB/def) + situational/weather.
Targets: actual MARGIN (home-away) and actual TOTAL — predicted from FUNDAMENTALS ONLY (no line as a
feature), walk-forward. Then: does the combined model beat the SPREAD/TOTAL out of sample? Bet its
disagreements vs the line (ATS/OU), per season. Permutation importance = what wins when all compete.
"""
import os, sys, warnings
import numpy as np, pandas as pd
warnings.filterwarnings("ignore")
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from stats_helpers import wilson_ci, bet_summary, fmt
from sklearn.ensemble import HistGradientBoostingRegressor
from sklearn.inspection import permutation_importance
from sklearn.metrics import r2_score
rng = np.random.default_rng(0)
DATA = os.path.join(os.path.dirname(os.path.abspath(__file__)), "data")
L = print
m = pd.read_parquet(os.path.join(DATA, "matchup.parquet"))
inj = pd.read_parquet(os.path.join(DATA, "injuries_raw.parquet"))
rec = pd.read_parquet(os.path.join(DATA, "ngs_receiving.parquet"))
pas = pd.read_parquet(os.path.join(DATA, "ngs_passing.parquet"))
sc = pd.read_parquet(os.path.join(DATA, "snap_counts.parquet"))
px = pd.read_parquet(os.path.join(DATA, "players_xwalk.parquet"))
g2p = dict(zip(px.gsis_id, px.pfr_id))

def carry(df, kid, col, out):
    df = df.sort_values([kid, "season", "week"]).copy()
    df["_c"] = df.groupby([kid, "season"])[col].apply(lambda s: s.shift(1).expanding().mean()).reset_index(level=[0,1], drop=True)
    pl = df[["season", kid]].drop_duplicates()
    grid = pl.merge(pd.DataFrame({"week": range(1,23)}), how="cross").merge(df[["season", kid, "week", "_c"]], on=["season", kid, "week"], how="left").sort_values(["season", kid, "week"])
    grid[out] = grid.groupby(["season", kid])["_c"].ffill(); return grid[["season","week",kid,out]]
air = carry(rec,"player_id","percent_share_of_intended_air_yards","airshare")
qat = carry(pas,"player_id","attempts","qb_att")
sc=sc[sc.game_type=="REG"].copy(); sc["def_pct"]=sc.defense_pct.fillna(0); dsnap=carry(sc,"pfr_player_id","def_pct","def_pct_prior")
miss=inj[inj.report_status.isin(["Out","Doubtful"])].copy(); miss["pfr"]=miss.player_id.map(g2p)
miss=miss.merge(air,on=["season","week","player_id"],how="left").merge(qat,on=["season","week","player_id"],how="left").merge(dsnap.rename(columns={"pfr_player_id":"pfr"}),on=["season","week","pfr"],how="left")
SK={"WR","TE","RB","FB"}; DEFP={"DE","DT","NT","OLB","EDGE","CB","S","SS","FS","DB","LB","ILB","MLB"}
miss["air_w"]=np.where(miss.position.isin(SK),miss.airshare.clip(lower=0).fillna(0),0.0)
miss["qb_w"]=((miss.position=="QB")&(miss.qb_att>=15)).astype(float)
miss["def_w"]=np.where(miss.position.isin(DEFP),miss.def_pct_prior.fillna(0),0.0)
ti=miss.groupby(["season","week","team"]).agg(air_out=("air_w","sum"),qb_out=("qb_w","max"),def_out=("def_w","sum")).reset_index()
nv2our={"LA":"LAR","SD":"LAC","STL":"LAR"}; ti["ab"]=ti.team.replace(nv2our)
m=m.merge(ti.rename(columns={"ab":"home_ab","air_out":"h_air_out","qb_out":"h_qb_out","def_out":"h_def_out"})[["season","week","home_ab","h_air_out","h_qb_out","h_def_out"]],on=["season","week","home_ab"],how="left")
m=m.merge(ti.rename(columns={"ab":"away_ab","air_out":"a_air_out","qb_out":"a_qb_out","def_out":"a_def_out"})[["season","week","away_ab","a_air_out","a_qb_out","a_def_out"]],on=["season","week","away_ab"],how="left")
for c in ["h_air_out","h_qb_out","h_def_out","a_air_out","a_qb_out","a_def_out"]: m[c]=m[c].fillna(0)

# engineered diffs
m["pr_diff"]=m.home_predictive_pr-m.away_predictive_pr; m["rest_diff"]=m.home_rest-m.away_rest
m["air_diff"]=m.h_air_out-m.a_air_out; m["def_diff"]=m.h_def_out-m.a_def_out
m["is_outdoor"]=(~m.dome_closed.astype("boolean").fillna(False)).astype(int)
m["mkt_margin"]=-m.home_spread

# ---- assemble kitchen-sink feature list (FUNDAMENTALS ONLY; no line/score) ----
BAN=["home_spread","away_spread","ou_vegas","spread","favorite","_fav","mkt_margin","implied_","resid_",
     "_miss","actual_","home_score","away_score","total_points","total_diff","over","home_cover","ats_","_ml",
     "home_win","underdog","ou_result","home_away","_arch","pair_","total_line","nv_total","nv_spread","unique_id",
     "home_team","away_team","home_ab","away_ab","game_date","kickoff","favorite","month","start","precipitation_type",
     "surface","referee","modal_qb","qb_status"]
feats=[c for c in m.columns if not any(b in c for b in BAN) and (pd.api.types.is_numeric_dtype(m[c]) or m[c].dtype==bool)
       and c not in ("season","week","home_team_id","away_team_id","game_time")]
# add engineered + injury
for c in ["pr_diff","rest_diff","air_diff","def_diff","h_air_out","a_air_out","h_qb_out","a_qb_out","h_def_out","a_def_out","is_outdoor"]:
    if c not in feats and c in m.columns: feats.append(c)
# explicit outcome/line-derived excludes that slipped the substring ban
for bad in ["fav_margin", "upset_outright", "home_fav", "fav_spread_diff"]:
    if bad in feats: feats.remove(bad)
feats=sorted(set(feats))
for f in feats: m[f]=pd.to_numeric(m[f], errors="coerce")
m["actual_margin"]=m.home_score-m.away_score; m["actual_total"]=m.home_score+m.away_score
# LEAK GUARD: drop any feature too correlated with an outcome (legit pregame feats max ~0.45 w/ margin)
def safecorr(a, b):
    d = pd.concat([a, b], axis=1).dropna()
    if len(d) < 100 or d.iloc[:, 0].nunique() < 3:
        return 0.0
    c = d.corr().iloc[0, 1]
    return 0.0 if pd.isna(c) else abs(c)
leaks=[]
for f in list(feats):
    cm = safecorr(m[f], m["actual_margin"]); ct = safecorr(m[f], m["actual_total"])
    if max(cm, ct) > 0.5:
        leaks.append((f, round(cm, 2), round(ct, 2))); feats.remove(f)
W=m[m.week>=4].copy()
L(f"[build] kitchen-sink features: {len(feats)} | games (wk>=4): {len(W)}")
if leaks: L(f"  [LEAK GUARD] dropped {len(leaks)} features corr>0.5 w/ outcome: {leaks}")
L(f"  includes: PR, EPA nets, team EPA/SR/explosive, FTN scheme, NGS, INJURY(air/qb/def), weather, situational")

def wf(target, line_col, label, outcome_sign):
    L("\n"+"="*88); L(f"COMBINED MODEL -> {label} (target={target}, predicted from fundamentals only)"); L("="*88)
    preds=[]
    for Y in range(2021,2026):
        tr=W[(W.season<Y)].dropna(subset=[target]); te=W[(W.season==Y)].dropna(subset=[target])
        if len(tr)<500: continue
        gb=HistGradientBoostingRegressor(max_depth=3,learning_rate=0.05,max_iter=500,l2_regularization=1.0,min_samples_leaf=40,random_state=0).fit(tr[feats],tr[target])
        t=te.copy(); t["pred"]=gb.predict(te[feats]); preds.append(t)
    P=pd.concat(preds)
    cm=np.corrcoef(P.pred,P[target])[0,1]; cl=np.corrcoef(P[line_col],P[target])[0,1]
    mm=np.abs(P.pred-P[target]).mean(); ml=np.abs(P[line_col]-P[target]).mean()
    L(f"  OOS corr with actual: COMBINED MODEL={cm:.3f}  vs  MARKET LINE={cl:.3f}   (market is the bar)")
    L(f"  OOS MAE: model={mm:.2f}  market={ml:.2f}   (model lower => beats the line)")
    # bet disagreements vs the line
    P["disc"]=P.pred-P[line_col]
    if "margin" in target:
        P["cover"]=np.where(P[target] > P.mkt_margin, 1.0, np.where(P[target] < P.mkt_margin, 0.0, np.nan))  # home covers
        for thr in [1,2,3,4]:
            home=P[P.disc>=thr]; away=P[P.disc<=-thr]
            won=pd.concat([home.cover, 1-away.cover]).dropna(); k=int((won==1).sum()); n=int(won.isin([0,1]).sum())
            L(f"   bet our side |disc|>={thr}: "+fmt(bet_summary(k,n,f"thr{thr}")))
    else:
        P["over"]=np.where(P[target]>P[line_col],1.0,np.where(P[target]<P[line_col],0.0,np.nan))
        for thr in [1,2,3,4]:
            ov=P[P.disc>=thr]; un=P[P.disc<=-thr]
            won=pd.concat([ov.over, 1-un.over]).dropna(); k=int((won==1).sum()); n=int(won.isin([0,1]).sum())
            L(f"   bet our side |disc|>={thr}: "+fmt(bet_summary(k,n,f"thr{thr}")))
    return P, gb

Pm, gbm = wf("actual_margin", "mkt_margin", "MARGIN vs the SPREAD", 1)
Pt, gbt = wf("actual_total", "ou_vegas_line", "TOTAL vs the O/U", 1)

# importance (what wins when everything competes) — margin model, 2025
L("\n"+"="*88); L("WHAT WINS WHEN ALL FEATURES COMPETE (perm importance)"); L("="*88)
tr=W[W.season<=2024].dropna(subset=["actual_margin"]); te=W[W.season==2025].dropna(subset=["actual_margin"])
gb=HistGradientBoostingRegressor(max_depth=3,learning_rate=0.05,max_iter=500,l2_regularization=1.0,min_samples_leaf=40,random_state=0).fit(tr[feats],tr.actual_margin)
pi=permutation_importance(gb,te[feats],te.actual_margin,n_repeats=10,random_state=0,scoring="neg_mean_absolute_error")
imp=pd.DataFrame({"f":feats,"imp":pi.importances_mean}).sort_values("imp",ascending=False)
L("  MARGIN model top 15:")
for _,r in imp.head(15).iterrows(): L(f"     {r.f:34s} {r.imp:+.4f}")
tr=W[W.season<=2024].dropna(subset=["actual_total"]); te=W[W.season==2025].dropna(subset=["actual_total"])
gb=HistGradientBoostingRegressor(max_depth=3,learning_rate=0.05,max_iter=500,l2_regularization=1.0,min_samples_leaf=40,random_state=0).fit(tr[feats],tr.actual_total)
pi=permutation_importance(gb,te[feats],te.actual_total,n_repeats=10,random_state=0,scoring="neg_mean_absolute_error")
imp=pd.DataFrame({"f":feats,"imp":pi.importances_mean}).sort_values("imp",ascending=False)
L("  TOTAL model top 15:")
for _,r in imp.head(15).iterrows(): L(f"     {r.f:34s} {r.imp:+.4f}")
