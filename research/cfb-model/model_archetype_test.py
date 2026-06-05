"""
Does feeding ARCHETYPE / game-environment features INTO the model help? Walk-forward (test 2022-25, since the
new player-derived features start 2021). Compare BASE totals model vs AUGMENTED (+ QB mobility, run/pass
identity, env score). Metrics: totals MAE (prediction quality) + close-graded ATS + the under-edge spot.
HistGradientBoosting handles NaN natively, so new features being absent pre-2021 is fine.
"""
import numpy as np
import pandas as pd
from sklearn.ensemble import HistGradientBoostingRegressor
import archetypes as AR

gm = pd.read_parquet("data/model_games.parquet")
EX = {"game_id","season","date","homeTeam","awayTeam","homeConference","awayConference","homePoints",
      "awayPoints","venueId","actual_total","actual_margin","spread_close","spread_open","total_close","total_open"}
num = gm.select_dtypes(include=[np.number,"Int64","boolean"]); BASE = [c for c in num.columns if c not in EX]
gm[BASE] = gm[BASE].apply(pd.to_numeric, errors="coerce")

# ---- build NEW archetype features (continuous) ----
pm = AR._asof_player_metrics()   # season,week,team -> rush_share, qb_rush_ypg
for who in ["home","away"]:
    r = pm.rename(columns={"team":f"{who}Team","rush_share":f"{who}_rush_share","qb_rush_ypg":f"{who}_qb_rush_ypg"})
    gm = gm.merge(r[["season","week",f"{who}Team",f"{who}_rush_share",f"{who}_qb_rush_ypg"]],
                  on=["season","week",f"{who}Team"], how="left")
# env score (cross-team composite) from the archetype engine tags
out, tg, AX = AR.build_archetypes()
def cnt(d,b,v): return (d[f"home_{b}"]==v).astype(int)+(d[f"away_{b}"]==v).astype(int)
out["env_score"] = (cnt(out,"A_style","Explosive")+cnt(out,"D_bigplay","Leaky")+cnt(out,"A_tempo","Up-tempo")
    +cnt(out,"D_front7","Weak-front")+cnt(out,"D_secondary","Weak-secondary")-cnt(out,"A_style","Methodical")
    -cnt(out,"D_run","Stout-runD")-cnt(out,"D_front7","Dominant-front")-cnt(out,"D_secondary","Lockdown-secondary")
    -cnt(out,"A_tempo","Slow")-cnt(out,"D_bigplay","BendDontBreak"))
gm = gm.merge(out[["season","game_id","env_score"]], on=["season","game_id"], how="left")

NEW = ["home_rush_share","away_rush_share","home_qb_rush_ypg","away_qb_rush_ypg","env_score"]
AUG = BASE + NEW
TS = [2022,2023,2024,2025]
def roi(w,n): return (w*0.909-(n-w))/n*100 if n else 0.0

def run(feats, tag):
    rows = []
    for S in TS:
        tr = gm[(gm.season<S) & gm.actual_total.notna()]
        te = gm[(gm.season==S) & gm.total_close.notna() & gm.actual_total.notna()].copy()
        m = HistGradientBoostingRegressor(max_iter=300,learning_rate=0.05,max_depth=4,l2_regularization=1.0,random_state=0).fit(tr[feats], tr.actual_total)
        te["pred"] = m.predict(te[feats]); rows.append(te)
    A = pd.concat(rows); A = A[A.actual_total != A.total_close]
    mae = (A.pred - A.actual_total).abs().mean()
    A["edge"] = A.pred - A.total_close
    # under-edge spot (our finding): bet under when pred well below close
    res = {}
    for thr in [2.5, 3.5]:
        b = A[A.edge <= -thr]; w = (b.actual_total < b.total_close)
        res[thr] = (len(b), 100*w.mean(), roi(int(w.sum()), len(b)))
    print(f"{tag:<12} totals MAE {mae:.3f} | UNDER edge<=-2.5: {res[2.5][1]:.1f}%({res[2.5][0]}) | <=-3.5: {res[3.5][1]:.1f}%({res[3.5][0]}) roi{res[3.5][2]:+.1f}")
    return A

print("Walk-forward totals model, 2022-25 (test where archetype features exist):\n")
Ab = run(BASE, "BASE")
Aa = run(AUG, "AUGMENTED")

# did the new features get USED / change predictions?
m = Ab.merge(Aa[["season","game_id","pred"]], on=["season","game_id"], suffixes=("_base","_aug"))
print(f"\nmean |pred change| base->aug: {(m.pred_aug-m.pred_base).abs().mean():.2f} pts (0 = model ignored new feats)")
