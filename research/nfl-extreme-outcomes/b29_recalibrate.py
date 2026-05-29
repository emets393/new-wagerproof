"""
RECALIBRATE the sim's scoring engine on our BEST inputs + ablate feature groups (like we did the GBM).
The b26 sim used only points-per-drive (thin) -> predicted actual margin 0.30. Here: predict each team's
GAME POINTS from a rich pregame feature set (predictive_pr + off/def EPA + ppd + pace + HFA), walk-forward,
then ablate which groups HELP vs HURT. The recalibrated expected points -> sim margin/total. Question the
user is right to force: with our best inputs, does the model-mean now (a) close the gap to the market's
predictive corr (0.458 margin / 0.32 total) and (b) beat the OPENER on spread/total, held-out 2024-25?
"""
import os, sys, warnings
import numpy as np, pandas as pd
warnings.filterwarnings("ignore")
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from stats_helpers import wilson_ci
from sklearn.ensemble import HistGradientBoostingRegressor
from sklearn.metrics import mean_absolute_error
DATA=os.path.join(os.path.dirname(os.path.abspath(__file__)),"data"); L=print
m=pd.read_parquet(os.path.join(DATA,"matchup.parquet")); od=pd.read_parquet(os.path.join(DATA,"odds_consensus.parquet"))
m["actual_margin"]=m.home_score-m.away_score; m["actual_total"]=m.home_score+m.away_score; m["mkt_margin"]=-m.home_spread
# long: 2 rows/game (team offense perspective) with own-off + opp-def features + team points
def grab(side,opp):
    r=pd.DataFrame()
    r["unique_id"]=m.unique_id; r["season"]=m.season; r["week"]=m.week; r["is_home"]=int(side=="home")
    r["team_points"]=m[f"{side}_score"]
    r["own_pr"]=m[f"{side}_predictive_pr"]; r["opp_pr"]=m[f"{opp}_predictive_pr"]
    r["own_off_ppd"]=m.get(f"{side}_off_ppd_s2d"); r["opp_def_ppd_allowed"]=m.get(f"{opp}_def_ppd_allowed_s2d")
    r["own_off_pass_epa"]=m.get(f"{side}_off_pass_epa_neutral_s2d"); r["own_off_rush_epa"]=m.get(f"{side}_off_rush_epa_neutral_s2d")
    r["opp_def_pass_epa_allowed"]=m.get(f"{opp}_def_pass_epa_allowed_neutral_s2d"); r["opp_def_rush_epa_allowed"]=m.get(f"{opp}_def_rush_epa_allowed_neutral_s2d")
    r["own_pace"]=m.get(f"{side}_off_pace_s2d"); r["opp_pace"]=m.get(f"{opp}_off_pace_s2d")
    return r
T=pd.concat([grab("home","away"),grab("away","home")],ignore_index=True)
GROUPS={"PR":["own_pr","opp_pr"],"PPD":["own_off_ppd","opp_def_ppd_allowed"],
        "EPA":["own_off_pass_epa","own_off_rush_epa","opp_def_pass_epa_allowed","opp_def_rush_epa_allowed"],
        "PACE":["own_pace","opp_pace"],"HFA":["is_home"]}
ALL=[f for g in GROUPS.values() for f in g]
for c in ALL: T[c]=pd.to_numeric(T[c],errors="coerce")
T=T[T.week>=4].dropna(subset=["team_points"]+ALL).copy()

def wf_predict(feats):
    T["pp"]=np.nan
    for Y in range(2021,2026):
        tr=T[T.season<Y]; te=T[T.season==Y]
        gb=HistGradientBoostingRegressor(max_depth=3,learning_rate=0.05,max_iter=300,l2_regularization=2.0,min_samples_leaf=40,random_state=0).fit(tr[feats],tr.team_points)
        T.loc[te.index,"pp"]=gb.predict(te[feats])
    return T.pp.copy()

def game_corrs(pp):
    g=T.assign(pp=pp).pivot_table(index="unique_id",columns="is_home",values="pp")
    g.columns=["away_pp","home_pp"]; g=g.merge(m[["unique_id","actual_margin","actual_total","mkt_margin","nv_total_line"]],on="unique_id")
    g["pred_margin"]=g.home_pp-g.away_pp; g["pred_total"]=g.home_pp+g.away_pp
    cm=np.corrcoef(g.pred_margin,g.actual_margin)[0,1]; ct=np.corrcoef(g.pred_total,g.actual_total)[0,1]
    return g,cm,ct

L("="*90); L("ABLATION — predict team game points (walk-forward OOS), which groups help? team-points MAE + game corr"); L("="*90)
cum=[]
for name,fs in GROUPS.items():
    cum=cum+fs; pp=wf_predict(cum); mae=mean_absolute_error(T.dropna(subset=["pp"]).team_points,T.dropna(subset=["pp"]).pp)
    _,cm,ct=game_corrs(pp); L(f"  +{name:5s} (feats={len(cum):2d}): team-pts MAE={mae:.2f}  game margin corr={cm:.3f}  total corr={ct:.3f}")
L(f"  [market benchmark] margin corr=0.458   total corr=0.320")
L("\n  leave-one-out (drop each group from FULL; corr DROP = it was helping):")
ppF=wf_predict(ALL); _,cmF,ctF=game_corrs(ppF)
for name,fs in GROUPS.items():
    sub=[f for f in ALL if f not in fs]; pp=wf_predict(sub); _,cm,ct=game_corrs(pp)
    L(f"    drop {name:5s}: margin corr {cm:.3f} ({cm-cmF:+.3f})  total corr {ct:.3f} ({ct-ctF:+.3f})")

# best model -> betting test vs OPENER (held-out 2024-25)
L("\n"+"="*90); L("RECALIBRATED model-mean vs the OPENER (held-out 2024-25) — does it beat the line now?"); L("="*90)
g,cm,ct=game_corrs(ppF)
d=g.merge(m[["unique_id","season","home_ab","away_ab"]],on="unique_id").merge(od[["season","home_ab","away_ab","open_spread","open_total"]],on=["season","home_ab","away_ab"],how="left")
d=d[d.season.isin([2024,2025])].dropna(subset=["open_spread","open_total"])
d["open_m"]=-d.open_spread; d["sp_edge"]=d.pred_margin-d.open_m; d["to_edge"]=d.pred_total-d.open_total
for thr in [2,3]:
    s=d[d.sp_edge.abs()>=thr]; hc=s.actual_margin>s.open_m; push=s.actual_margin==s.open_m; won=np.where(s.sp_edge>0,hc,~hc)[~push.values]; n=len(won);k=int(won.sum()); lo,hi=wilson_ci(k,n) if n else(0,0)
    L(f"  SPREAD |edge|>={thr} vs open: {(k/n*100 if n else 0):.1f}% (n={n}) CI[{lo*100:.0f},{hi*100:.0f}]")
for thr in [2,3]:
    s=d[d.to_edge.abs()>=thr]; ov=s.actual_total>s.open_total; push=s.actual_total==s.open_total; won=np.where(s.to_edge>0,ov,~ov)[~push.values]; n=len(won);k=int(won.sum()); lo,hi=wilson_ci(k,n) if n else(0,0)
    L(f"  TOTAL  |edge|>={thr} vs open: {(k/n*100 if n else 0):.1f}% (n={n}) CI[{lo*100:.0f},{hi*100:.0f}]")
