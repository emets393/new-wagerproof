"""CANDIDATE retrain: QB-availability feature in the locked CFB models.

Replicates cfb_forecast's exact training setup (same frame, features, nets,
HistGradientBoostingRegressor hyperparams) and adds two columns from the
box-truth labels (cfb_injury_feature_study): home_backup_qb / away_backup_qb.
Walk-forward per season (train < S), 2022-2025 (2021 has no prior season in
frame). Decision metrics per the pruning law:
  - margin/total MAE, overall AND on flagged games (bet-count matched)
  - sides ROI at FIXED SELECTIVITY (top-10% |edge| vs open) with vs without
Does NOT touch production code or pkls — candidate evidence only.
"""
import numpy as np
import pandas as pd
from pathlib import Path
from sklearn.ensemble import HistGradientBoostingRegressor

HERE = Path(__file__).resolve().parent
import sys
sys.path.insert(0, str(HERE))
import cfb_forecast as F

gm, feats, nets = F.load()
labels = pd.read_parquet(HERE / "data" / "starter_out_labels.parquet")
lab = labels[["season", "week", "team", "qb_backup_start"]].copy()
lab["qb_backup_start"] = lab.qb_backup_start.astype(int)

gm = gm.merge(lab.rename(columns={"team": "homeTeam", "qb_backup_start": "home_backup_qb"}),
              on=["season", "week", "homeTeam"], how="left")
gm = gm.merge(lab.rename(columns={"team": "awayTeam", "qb_backup_start": "away_backup_qb"}),
              on=["season", "week", "awayTeam"], how="left")
gm["home_backup_qb"] = gm.home_backup_qb.fillna(0).astype(int)
gm["away_backup_qb"] = gm.away_backup_qb.fillna(0).astype(int)
QB = ["home_backup_qb", "away_backup_qb"]
n_flag = int((gm.home_backup_qb | gm.away_backup_qb).sum())
print(f"frame: {len(gm)} games | flagged {n_flag}")

sfeats = feats + nets
SEASONS = [2022, 2023, 2024, 2025]

def run(name, tot_feats, side_feats):
    out = []
    for s in SEASONS:
        tr = gm[(gm.season < s) & gm.actual_total.notna()]
        te = gm[(gm.season == s) & gm.actual_total.notna() & gm.spread_open.notna()].copy()
        tm = HistGradientBoostingRegressor(max_iter=300, learning_rate=0.05, max_depth=4,
                                           l2_regularization=1.0, random_state=0).fit(tr[tot_feats], tr.actual_total)
        sm = HistGradientBoostingRegressor(max_iter=300, learning_rate=0.05, max_depth=4,
                                           l2_regularization=1.0, random_state=0).fit(tr[side_feats], tr.actual_margin)
        te["pt"] = tm.predict(te[tot_feats])
        te["pm"] = sm.predict(te[side_feats])
        te["flagged"] = (te.home_backup_qb == 1) | (te.away_backup_qb == 1)
        # sides bets at fixed selectivity: top-10% |pred_margin + spread_open|
        te["edge"] = te.pm + te.spread_open
        k = max(10, int(len(te) * 0.10))
        bets = te.reindex(te.edge.abs().sort_values(ascending=False).index).head(k)
        side_home = bets.edge > 0
        cover = np.where(side_home, bets.actual_margin + bets.spread_open > 0,
                                    bets.actual_margin + bets.spread_open < 0)
        push = (bets.actual_margin + bets.spread_open) == 0
        wins, n = int(cover[~push].sum()), int((~push).sum())
        out.append(dict(season=s,
                        mae_m=np.abs(te.pm - te.actual_margin).mean(),
                        mae_t=np.abs(te.pt - te.actual_total).mean(),
                        mae_m_flag=np.abs(te.loc[te.flagged, "pm"] - te.loc[te.flagged, "actual_margin"]).mean(),
                        mae_t_flag=np.abs(te.loc[te.flagged, "pt"] - te.loc[te.flagged, "actual_total"]).mean(),
                        n_flag=int(te.flagged.sum()), bet_w=wins, bet_n=n))
    df = pd.DataFrame(out)
    hit = df.bet_w.sum() / df.bet_n.sum()
    roi = (df.bet_w.sum() * 0.909 - (df.bet_n.sum() - df.bet_w.sum())) / df.bet_n.sum() * 100
    print(f"\n[{name}] margin MAE {df.mae_m.mean():.3f} | total MAE {df.mae_t.mean():.3f} | "
          f"flagged-game margin MAE {df.mae_m_flag.mean():.3f} (n={df.n_flag.sum()}) | "
          f"top-10% sides: {df.bet_w.sum()}/{df.bet_n.sum()} = {hit*100:.1f}% ({roi:+.1f}% ROI)")
    for r in df.itertuples():
        print(f"   {r.season}: mM {r.mae_m:.2f} mT {r.mae_t:.2f} | flagged mM {r.mae_m_flag:.2f} "
              f"(n={r.n_flag}) | bets {r.bet_w}/{r.bet_n}")
    return df

base = run("BASE (production feature set)", feats, sfeats)
plus = run("PLUS qb-availability", feats + QB, sfeats + QB)

d_m = base.mae_m.mean() - plus.mae_m.mean()
d_mf = base.mae_m_flag.mean() - plus.mae_m_flag.mean()
print(f"\nDELTA (base - plus, + = feature helps): margin MAE {d_m:+.3f} overall, "
      f"{d_mf:+.3f} on flagged games | total MAE {base.mae_t.mean()-plus.mae_t.mean():+.3f}")
