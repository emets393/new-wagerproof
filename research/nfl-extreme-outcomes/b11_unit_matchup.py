"""
Engineered UNIT-vs-UNIT facet matchup scores for SIDES — the player-availability-weighted version.
NEW vs Brief #2 (which used team SEASON aggregates): here the offensive unit score = quality of the
receivers ACTUALLY ACTIVE this week (NGS separation/air-yards, injured players removed), matched vs the
opponent's pass defense. Plus run-vs-runD and protection-vs-rush facets. Held-out test: select on
2018-23, evaluate ONLY on 2024-25 — does any engineered facet beat the spread?
Data gap: no defensive-PLAYER (CB/DL) grades -> offense is player-level, defense is team-level.
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
inj = pd.read_parquet(os.path.join(DATA, "injuries_raw.parquet"))
rec = pd.read_parquet(os.path.join(DATA, "ngs_receiving.parquet"))
pas = pd.read_parquet(os.path.join(DATA, "ngs_passing.parquet"))

# ---- per-receiver prior NGS (carry-forward) + team ----
rec = rec.sort_values(["player_id", "season", "week"]).copy()
rec["yac"] = pd.to_numeric(rec.avg_yac_above_expectation, errors="coerce")
rec["sep"] = pd.to_numeric(rec.avg_separation, errors="coerce")
def prior(df, col):
    return df.groupby(["player_id", "season"])[col].apply(lambda s: s.shift(1).expanding().mean()).reset_index(level=[0,1], drop=True)
rec["air_p"] = prior(rec, "percent_share_of_intended_air_yards"); rec["sep_p"] = prior(rec, "sep"); rec["yac_p"] = prior(rec, "yac")
# full week grid per (season, player_id) carrying forward prior + team
pl = rec[["season","player_id"]].drop_duplicates()
grid = pl.merge(pd.DataFrame({"week": range(1,23)}), how="cross").merge(
    rec[["season","player_id","week","air_p","sep_p","yac_p","team"]], on=["season","player_id","week"], how="left").sort_values(["season","player_id","week"])
for c in ["air_p","sep_p","yac_p","team"]:
    grid[c] = grid.groupby(["season","player_id"])[c].ffill()
# injured this week?
out = inj[inj.report_status.isin(["Out","Doubtful"])][["season","week","player_id"]].drop_duplicates(); out["out"]=1
grid = grid.merge(out, on=["season","week","player_id"], how="left"); grid["out"]=grid["out"].fillna(0)
act = grid[(grid.air_p>0) & (grid.out==0) & grid.team.notna()].copy()   # active receivers w/ history
# team-week ACTIVE receiving unit: air-share-weighted quality + active air-share retained
act["q"] = act.sep_p.fillna(act.sep_p.median()) + act.yac_p.fillna(0)
def wavg(g):
    w=g.air_p; return (g.q*w).sum()/w.sum() if w.sum()>0 else np.nan
ru = act.groupby(["season","week","team"]).apply(lambda g: pd.Series({
    "recv_quality": (g.q*g.air_p).sum()/g.air_p.sum() if g.air_p.sum()>0 else np.nan,
    "recv_airshare_active": g.air_p.sum()})).reset_index()
nv2our={"LA":"LAR","SD":"LAC","STL":"LAR"}; ru["ab"]=ru.team.replace(nv2our)
L(f"[build] team-week active-receiving-unit rows: {len(ru)}")

# ---- attach to games (home/away), build facet diffs ----
m=m.merge(ru.rename(columns={"ab":"home_ab","recv_quality":"h_recvq","recv_airshare_active":"h_recvair"})[["season","week","home_ab","h_recvq","h_recvair"]],on=["season","week","home_ab"],how="left")
m=m.merge(ru.rename(columns={"ab":"away_ab","recv_quality":"a_recvq","recv_airshare_active":"a_recvair"})[["season","week","away_ab","a_recvq","a_recvair"]],on=["season","week","away_ab"],how="left")
m["pr_diff"]=m.home_predictive_pr-m.away_predictive_pr; m["mkt_margin"]=-m.home_spread; m["actual_margin"]=m.home_score-m.away_score
# FACET matchup scores (offense unit vs OPP team defense) — home & away, then differential
# recv: active receiving unit vs opp pass D (def pass epa allowed: higher=worse D=offense edge)
m["h_recv_vs_passD"]=m.h_recvq + m.away_def_pass_epa_allowed_neutral_s2d*10 + m.h_recvair*0.05
m["a_recv_vs_passD"]=m.a_recvq + m.home_def_pass_epa_allowed_neutral_s2d*10 + m.a_recvair*0.05
# run: own rush success vs opp rush D allowed
m["h_run_vs_runD"]=m.home_off_rush_success_rate_s2d - m.away_def_rush_success_allowed_s2d
m["a_run_vs_runD"]=m.away_off_rush_success_rate_s2d - m.home_def_rush_success_allowed_s2d
# protection: own time-to-throw exposed to opp pressure (slow QB x high pressure = offense bad)
m["h_protect"]=-(m.home_off_time_to_throw_s2d.fillna(m.home_off_time_to_throw_s2d.median()) * m.away_def_pressure_rate_s2d.fillna(0))
m["a_protect"]=-(m.away_off_time_to_throw_s2d.fillna(m.away_off_time_to_throw_s2d.median()) * m.home_def_pressure_rate_s2d.fillna(0))
# explosive pass vs opp explosive allowed
m["h_expl_vs_passD"]=m.home_off_explosive_pass_rate_s2d - m.away_def_explosive_pass_allowed_s2d
m["a_expl_vs_passD"]=m.away_off_explosive_pass_rate_s2d - m.home_def_explosive_pass_allowed_s2d
# DIFFERENTIALS (home facet - away facet) -> margin features
m["recv_facet_diff"]=m.h_recv_vs_passD - m.a_recv_vs_passD
m["run_facet_diff"]=m.h_run_vs_runD - m.a_run_vs_runD
m["protect_facet_diff"]=m.h_protect - m.a_protect
m["expl_facet_diff"]=m.h_expl_vs_passD - m.a_expl_vs_passD
m["recvq_diff"]=m.h_recvq.fillna(0) - m.a_recvq.fillna(0)
m["recvair_diff"]=m.h_recvair.fillna(0) - m.a_recvair.fillna(0)

POOL=["pr_diff","home_predictive_pr","away_predictive_pr","recv_facet_diff","run_facet_diff",
      "protect_facet_diff","expl_facet_diff","recvq_diff","recvair_diff","home_last5_pr","away_last5_pr"]
POOL=[c for c in POOL if c in m.columns]
for c in POOL: m[c]=pd.to_numeric(m[c],errors="coerce")
W=m[m.week>=4].copy()
TR=W[W.season<=2022]; VA=W[W.season==2023]; TE=W[W.season.isin([2024,2025])]
L(f"  features: {POOL}\n  TRAIN {len(TR)} VAL {len(VA)} TEST {len(TE)}")

def fitpred(feats, tr, ev):
    gb=HistGradientBoostingRegressor(max_depth=3,learning_rate=0.06,max_iter=250,l2_regularization=2.0,min_samples_leaf=40,random_state=0).fit(tr[feats],tr.actual_margin); return gb.predict(ev[feats])
# forward select by VAL MAE
chosen=[]; best=1e9; imp=True
while imp and len(chosen)<8:
    imp=False; cand=None
    for f in [x for x in POOL if x not in chosen]:
        mae=mean_absolute_error(VA.actual_margin, fitpred(chosen+[f],TR,VA))
        if mae<best-0.02: best=mae; cand=f; imp=True
    if cand: chosen.append(cand)
L(f"\n[forward-selected on 2018-23]: {chosen} (VAL MAE={best:.2f})")
# held-out TEST: does it beat the spread?
def heldout(feats, label):
    p=fitpred(feats, pd.concat([TR,VA]), TE); te=TE.copy(); te["pred"]=p; te["disc"]=te.pred-te.mkt_margin
    te["hcov"]=np.where(te.actual_margin>te.mkt_margin,1.0,np.where(te.actual_margin<te.mkt_margin,0.0,np.nan))
    cm=np.corrcoef(te.pred,te.actual_margin)[0,1]; cl=np.corrcoef(te.mkt_margin,te.actual_margin)[0,1]
    L(f"  [{label}] TEST corr model={cm:.3f} market={cl:.3f}")
    for thr in [1,2,3]:
        h=te[te.disc>=thr]; a=te[te.disc<=-thr]; won=pd.concat([h.hcov,1-a.hcov]).dropna(); k=int((won==1).sum()); n=int(won.isin([0,1]).sum())
        L("     bet |disc|>=%d: %s"%(thr,fmt(bet_summary(k,n,f"thr{thr}"))))
L("\nHELD-OUT 2024-25 (the verdict):")
heldout(chosen, "selected facets")
heldout(["recv_facet_diff","run_facet_diff","protect_facet_diff","expl_facet_diff","recvq_diff","recvair_diff"], "engineered facets ONLY (no PR)")
heldout(["pr_diff"], "pr_diff only (baseline)")
# does adding facets to PR help vs PR alone? (ablation)
L("\n[ablation] does each facet, ADDED to pr_diff, reduce VAL MAE?")
base=mean_absolute_error(VA.actual_margin, fitpred(["pr_diff"],TR,VA)); L(f"  pr_diff-only VAL MAE={base:.2f}")
for f in ["recv_facet_diff","run_facet_diff","protect_facet_diff","expl_facet_diff","recvq_diff","recvair_diff"]:
    mae=mean_absolute_error(VA.actual_margin, fitpred(["pr_diff",f],TR,VA))
    L(f"  + {f:20s} VAL MAE={mae:.2f}  ({'HELPS' if mae<base-0.01 else 'no'})")
