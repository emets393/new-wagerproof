"""
Does a POSSESSION-ADAPTATION feature improve the TOTALS MODEL's accuracy (not betting)? Add per-game-drives
pace norms (slow_norm/fast_norm/gap/sum) — which encode the slow-team-controls-tempo asymmetry the tree can
learn — to the feature set. Walk-forward; compare MAE + game-ranking (corr of pred vs actual = rockfight/shootout
classification) + tercile (low/mid/high scoring) accuracy. Mirrors model_archetype_test.py.
"""
import glob
import numpy as np
import pandas as pd
from sklearn.ensemble import HistGradientBoostingRegressor
from scipy.stats import spearmanr

gm = pd.read_parquet("data/model_games.parquet")
EX = {"game_id","season","date","homeTeam","awayTeam","homeConference","awayConference","homePoints","awayPoints",
      "venueId","actual_total","actual_margin","spread_close","spread_open","total_close","total_open"}
num = gm.select_dtypes(include=[np.number,"Int64","boolean"]); BASE = [c for c in num.columns if c not in EX]
gm[BASE] = gm[BASE].apply(pd.to_numeric, errors="coerce")

# build as-of drives-based pace norms
ga = pd.concat([pd.read_parquet(f) for f in glob.glob("data/cfbd/game_advanced_*.parquet")], ignore_index=True)
ga = ga[ga.seasonType == "regular"][["season","week","gameId","team","offense.drives"]]
gt = ga.groupby(["season","week","gameId"]).agg(tot_drives=("offense.drives","sum"), nt=("team","nunique")).reset_index()
gt = gt[gt.nt == 2]
tg = ga.merge(gt[["season","gameId","tot_drives"]], on=["season","gameId"]).sort_values(["team","season","week"])
g = tg.groupby(["team","season"], group_keys=False)
tg["pace_norm"] = g["tot_drives"].apply(lambda s: s.shift().expanding().mean()); tg["pace_np"] = g.cumcount()
asof = tg[["season","gameId","team","pace_norm","pace_np"]].drop_duplicates(["season","gameId","team"])
gm = gm.merge(asof.rename(columns={"gameId":"game_id","team":"homeTeam","pace_norm":"h_pace","pace_np":"h_pnp"}), on=["season","game_id","homeTeam"], how="left")
gm = gm.merge(asof.rename(columns={"gameId":"game_id","team":"awayTeam","pace_norm":"a_pace","pace_np":"a_pnp"}), on=["season","game_id","awayTeam"], how="left")
gm["pace_slow"] = gm[["h_pace","a_pace"]].min(axis=1)
gm["pace_fast"] = gm[["h_pace","a_pace"]].max(axis=1)
gm["pace_gap"] = gm.pace_fast - gm.pace_slow
gm["pace_sum"] = gm.h_pace + gm.a_pace
PACE = ["h_pace","a_pace","pace_slow","pace_fast","pace_gap","pace_sum"]
AUG = BASE + PACE
TS = [2021,2022,2023,2024,2025]

def run(feats, tag):
    rows = []
    for S in TS:
        tr = gm[(gm.season < S) & gm.actual_total.notna()]
        te = gm[(gm.season == S) & gm.total_close.notna() & gm.actual_total.notna()].copy()
        m = HistGradientBoostingRegressor(max_iter=300, learning_rate=0.05, max_depth=4, l2_regularization=1.0, random_state=0).fit(tr[feats], tr.actual_total)
        te["pred"] = m.predict(te[feats]); rows.append(te)
    A = pd.concat(rows)
    mae = (A.pred - A.actual_total).abs().mean()
    # ranking ability (game-type): corr of pred with actual
    pear = A.pred.corr(A.actual_total); spear = spearmanr(A.pred, A.actual_total).correlation
    # market MAE for reference
    mkt_mae = (A.total_close - A.actual_total).abs().mean()
    # tercile (rockfight/mid/shootout) accuracy
    at = pd.qcut(A.actual_total, 3, labels=[0,1,2]); pt = pd.qcut(A.pred, 3, labels=[0,1,2])
    acc = (at.astype(int) == pt.astype(int)).mean()
    print(f"{tag:<12} MAE {mae:.3f} | corr(pred,actual) pear {pear:.3f}/spear {spear:.3f} | tercile-acc {100*acc:.1f}% (mkt MAE {mkt_mae:.2f})")
    return A

print("Walk-forward totals model, does drives-based PACE help accuracy?\n")
Ab = run(BASE, "BASE")
Aa = run(AUG, "+PACE")
m = Ab.merge(Aa[["season","game_id","pred"]], on=["season","game_id"], suffixes=("_b","_a"))
print(f"\nmean |pred change| base->+pace: {(m.pred_a-m.pred_b).abs().mean():.2f} pts")
# does pace help MOST where pace_gap is large (mismatch games)?
mm = gm[["season","game_id","pace_gap"]].merge(m, on=["season","game_id"])
big = mm[mm.pace_gap >= mm.pace_gap.quantile(0.75)]
print(f"MAE on big-pace-gap games (mismatch): BASE {(big.pred_b-big.actual_total).abs().mean():.3f} | +PACE {(big.pred_a-big.actual_total).abs().mean():.3f}")
