"""
TEAM SCORING-DEVIATION deep dive.
For each team-game: residual points = actual team points - MARKET-implied team points ((total - spread)/2).
Model that residual (offense) — and the opponent's residual = points this team ALLOWED — from:
  own offense rates, opponent defense rates, OWN injury (air-share/QB out), OPP defense injury, scheme, weather.
Walk-forward GBM (train<Y, test Y). Q: does adding the player-injury layer give OOS skill on team points
beyond the market, and does the implied TOTAL residual beat the O/U line? Permutation importance shows
WHAT drives a team to score/allow more or less than priced.
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

# ---- injury team-week features (nflverse abbrev) ----
def carry(df, kid, col, out):
    df = df.sort_values([kid, "season", "week"]).copy()
    df["_c"] = df.groupby([kid, "season"])[col].apply(lambda s: s.shift(1).expanding().mean()).reset_index(level=[0,1], drop=True)
    pl = df[["season", kid]].drop_duplicates()
    grid = pl.merge(pd.DataFrame({"week": range(1,23)}), how="cross").merge(df[["season", kid, "week", "_c"]], on=["season", kid, "week"], how="left").sort_values(["season", kid, "week"])
    grid[out] = grid.groupby(["season", kid])["_c"].ffill()
    return grid[["season", "week", kid, out]]
air = carry(rec, "player_id", "percent_share_of_intended_air_yards", "airshare")
qbr = carry(pas, "player_id", "attempts", "qb_att")
sc = sc[sc.game_type=="REG"].copy(); sc["def_pct"]=sc.defense_pct.fillna(0)
dsnap = carry(sc, "pfr_player_id", "def_pct", "def_pct_prior")
miss = inj[inj.report_status.isin(["Out","Doubtful"])].copy()
miss["pfr"]=miss.player_id.map(g2p)
miss = miss.merge(air, on=["season","week","player_id"], how="left").merge(qbr, on=["season","week","player_id"], how="left").merge(dsnap.rename(columns={"pfr_player_id":"pfr"}), on=["season","week","pfr"], how="left")
SK={"WR","TE","RB","FB"}; DEFP={"DE","DT","NT","OLB","EDGE","CB","S","SS","FS","DB","LB","ILB","MLB"}
miss["air_w"]=np.where(miss.position.isin(SK), miss.airshare.clip(lower=0).fillna(0), 0.0)
miss["qb_out_w"]=np.where((miss.position=="QB")&(miss.qb_att>=15),1.0,0.0)
miss["def_w"]=np.where(miss.position.isin(DEFP), miss.def_pct_prior.fillna(0), 0.0)
ti = miss.groupby(["season","week","team"]).agg(air_out=("air_w","sum"), qb_out=("qb_out_w","max"), def_out=("def_w","sum")).reset_index()
nv2our={"LA":"LAR","OAK":"OAK","LV":"LV","SD":"LAC","STL":"LAR"}
ti["ab"]=ti.team.replace(nv2our)
inj_feat = ti[["season","week","ab","air_out","qb_out","def_out"]]

# ---- attach injuries to matchup (our abbrev), build team-game long ----
m = m.merge(inj_feat.rename(columns={"ab":"home_ab","air_out":"h_air_out","qb_out":"h_qb_out","def_out":"h_def_out"}), on=["season","week","home_ab"], how="left")
m = m.merge(inj_feat.rename(columns={"ab":"away_ab","air_out":"a_air_out","qb_out":"a_qb_out","def_out":"a_def_out"}), on=["season","week","away_ab"], how="left")
for c in ["h_air_out","h_qb_out","h_def_out","a_air_out","a_qb_out","a_def_out"]:
    m[c]=m[c].fillna(0)
m["over"]=np.where(m.total_diff>0,1,np.where(m.total_diff<0,0,np.nan))

def side(df, o, opp):
    sgn=1 if o=="home" else -1
    return pd.DataFrame(dict(
        season=df.season, week=df.week, unique_id=df.unique_id, side=o,
        resid_pts=df[f"resid_{o}_pts"],   # actual team pts - implied
        # own offense rates
        off_ppd=df[f"{o}_off_pts_per_drive_s2d"], off_pass_epa=df[f"{o}_off_pass_epa_neutral_s2d"],
        off_rush_epa=df[f"{o}_off_rush_epa_neutral_s2d"], off_explosive=df[f"{o}_off_explosive_pass_rate_s2d"],
        off_proe=df.get(f"{o}_off_proe_s2d"), pace=df[f"{o}_off_plays_per_game_s2d"],
        # opp defense rates
        opp_def_ppd=df[f"{opp}_def_pts_per_drive_allowed_s2d"], opp_def_pass_epa=df[f"{opp}_def_pass_epa_allowed_neutral_s2d"],
        opp_def_rush_epa=df[f"{opp}_def_rush_epa_allowed_neutral_s2d"], opp_pressure=df.get(f"{opp}_def_pressure_rate_s2d"),
        opp_blitz=df.get(f"{opp}_def_blitz_rate_s2d"),
        # injuries: own offense injuries (hurt own scoring), opp defense injuries (help own scoring)
        own_air_out=df[f"{'h' if o=='home' else 'a'}_air_out"], own_qb_out=df[f"{'h' if o=='home' else 'a'}_qb_out"],
        opp_def_out=df[f"{'a' if o=='home' else 'h'}_def_out"],
        # context
        wind=df.wind_mph, is_outdoor=(~df.dome_closed.astype("boolean").fillna(False)).astype(int),
        primetime=df.primetime, week_n=df.week, ou_line=df.ou_vegas_line,
        total_diff=df.total_diff, over=df.over))
tg = pd.concat([side(m,"home","away"), side(m,"away","home")], ignore_index=True)
tg = tg[(tg.week>=4)].copy()
FEATS=["off_ppd","off_pass_epa","off_rush_epa","off_explosive","off_proe","pace","opp_def_ppd",
       "opp_def_pass_epa","opp_def_rush_epa","opp_pressure","opp_blitz","own_air_out","own_qb_out",
       "opp_def_out","wind","is_outdoor","primetime","week_n","ou_line"]
for f in FEATS: tg[f]=pd.to_numeric(tg[f], errors="coerce")
tg=tg.dropna(subset=["resid_pts"])
L(f"[build] team-game rows (wk>=4): {len(tg)} | injury features attached")

L("\n"+"="*90); L("WALK-FORWARD: predict team-points RESIDUAL (actual - market-implied) from features"); L("="*90)
preds=[]
for Y in range(2021,2026):
    tr=tg[tg.season<Y]; te=tg[tg.season==Y]
    if len(tr)<500: continue
    gb=HistGradientBoostingRegressor(max_depth=3,learning_rate=0.05,max_iter=400,l2_regularization=1.0,min_samples_leaf=40,random_state=0).fit(tr[FEATS],tr.resid_pts)
    p=gb.predict(te[FEATS]); t=te.copy(); t["pred"]=p; preds.append(t)
P=pd.concat(preds)
# OOS skill: corr(pred, actual resid); MAE vs predicting 0 (market is right)
mae_model=np.abs(P.pred-P.resid_pts).mean(); mae_zero=np.abs(P.resid_pts).mean()
L(f"  OOS corr(pred resid, actual resid) = {np.corrcoef(P.pred,P.resid_pts)[0,1]:+.3f}")
L(f"  OOS MAE: model={mae_model:.2f} vs predict-0(market)={mae_zero:.2f}  (lower than market => skill)")

# permutation importance (what drives scoring deviation), test 2025
tr=tg[tg.season<=2024]; te=tg[tg.season==2025]
gb=HistGradientBoostingRegressor(max_depth=3,learning_rate=0.05,max_iter=400,l2_regularization=1.0,min_samples_leaf=40,random_state=0).fit(tr[FEATS],tr.resid_pts)
pi=permutation_importance(gb,te[FEATS],te.resid_pts,n_repeats=15,random_state=0,scoring="neg_mean_absolute_error")
imp=pd.DataFrame({"f":FEATS,"imp":pi.importances_mean}).sort_values("imp",ascending=False)
L("\n  WHAT predicts a team scoring above/below the implied total (perm importance, 2025):")
for _,r in imp.head(12).iterrows(): L(f"     {r.f:16s} {r.imp:+.4f}")

# ---- aggregate to game total: does predicted total-residual beat the O/U? ----
L("\n"+"="*90); L("Does the model's predicted TOTAL residual beat the O/U line? (walk-forward)"); L("="*90)
gp=P.pivot_table(index=["season","week","unique_id"], columns="side", values=["pred","over","total_diff"], aggfunc="first")
gp.columns=[f"{a}_{b}" for a,b in gp.columns]; gp=gp.reset_index()
gp["pred_total_resid"]=gp["pred_home"]+gp["pred_away"]
gp["over_res"]=gp["over_home"]   # same for the game
for thr in [0,1,2,3]:
    bo=gp[gp.pred_total_resid>=thr]; bu=gp[gp.pred_total_resid<=-thr]
    won=pd.concat([bo.over_res, 1-bu.over_res]).dropna(); k=int((won==1).sum()); n=int(won.isin([0,1]).sum())
    L(f"  |pred total resid|>={thr}: "+fmt(bet_summary(k,n,f"thr{thr}")))
L("  per-season at thr=2:")
for Y in sorted(gp.season.unique()):
    ss=gp[gp.season==Y]; bo=ss[ss.pred_total_resid>=2]; bu=ss[ss.pred_total_resid<=-2]
    won=pd.concat([bo.over_res,1-bu.over_res]).dropna(); k=int((won==1).sum()); n=int(won.isin([0,1]).sum())
    L("    "+fmt(bet_summary(k,n,str(int(Y)))))
