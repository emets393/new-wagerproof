"""
TEAM-TOTAL MODEL. Predict a team's actual points from self-offense + opponent-defense fundamentals + ADAPTATION
features (as-of run-identity, pace) — walk-forward. Benchmark vs the market's contrived implied team total
((total_close - team_spread)/2). If the model beats the market split (lower MAE) AND its edge predicts team-total
over/under, that's signal. Tests pure-fundamentals AND market-anchored (+ open lines) variants.
"""
import glob
import numpy as np
import pandas as pd
from sklearn.ensemble import HistGradientBoostingRegressor

gm = pd.read_parquet("data/model_games.parquet")
# paired home_/away_ feature bases
homecols = [c for c in gm.columns if c.startswith("home_")]
bases = [c[5:] for c in homecols if ("away_" + c[5:]) in gm.columns]
GAME = ["week", "neutralSite", "conferenceGame"]  # game-level context

# as-of run identity + pace
box = pd.concat([pd.read_parquet(f) for f in glob.glob("data/cfbd/teamgame_box_*.parquet")], ignore_index=True)
box["run_rate"] = box.rush_att / (box.rush_att + box.pass_att); box["sec_play"] = box.poss_secs / box.plays
box = box.merge(gm[["season", "game_id", "date"]], on=["season", "game_id"], how="left").sort_values(["season", "team", "date"])
g = box.groupby(["season", "team"], group_keys=False)
box["id_run"] = g["run_rate"].apply(lambda s: s.shift().expanding().mean())
box["id_pace"] = g["sec_play"].apply(lambda s: s.shift().expanding().mean())
idd = box[["season", "game_id", "team", "id_run", "id_pace"]]

# build per-team-game: self_* / opp_* + target team points + market context
rows = []
for _, r in gm.iterrows():
    for who, opp in [("home", "away"), ("away", "home")]:
        d = {"season": r.season, "game_id": r.game_id, "team": r[f"{who}Team"], "week": r.week,
             "neutralSite": int(bool(r.neutralSite)), "conferenceGame": int(bool(r.conferenceGame)),
             "pts": r.homePoints if who == "home" else r.awayPoints,
             "total_open": r.total_open, "total_close": r.total_close,
             "team_spread_open": r.spread_open if who == "home" else -r.spread_open,
             "team_spread_close": r.spread_close if who == "home" else -r.spread_close}
        for b in bases:
            d["self_" + b] = r[f"{who}_{b}"]; d["opp_" + b] = r[f"{opp}_{b}"]
        rows.append(d)
T = pd.DataFrame(rows).merge(idd, on=["season", "game_id", "team"], how="left")
T = T[T.pts.notna() & T.total_close.notna()].copy()
T["implied_close"] = (T.total_close - T.team_spread_close) / 2
T["implied_open"] = (T.total_open - T.team_spread_open) / 2

selfopp = [c for c in T.columns if c.startswith("self_") or c.startswith("opp_")]
for c in selfopp + GAME + ["id_run", "id_pace"]:
    T[c] = pd.to_numeric(T[c], errors="coerce")
FUND = [c for c in selfopp if c not in (
    "self_net_rating", "opp_net_rating")] + GAME + ["id_run", "id_pace"]  # fundamentals + adaptation
MKT = FUND + ["total_open", "team_spread_open"]                          # + market anchor (open lines)
TS = [2021, 2022, 2023, 2024, 2025]
def roi(w, n): return (w * 0.909 - (n - w)) / n * 100 if n else 0.0
def per(b, w): return "/".join(f"{100*w[b.season==s].mean():.0f}" if (b.season==s).sum()>=10 else "--" for s in TS)

def run(feats, tag):
    parts = []
    for S in TS:
        tr = T[(T.season < S) & T.pts.notna()]; te = T[T.season == S].copy()
        m = HistGradientBoostingRegressor(max_iter=350, learning_rate=0.05, max_depth=5, l2_regularization=1.0, random_state=0).fit(tr[feats], tr.pts)
        te["pred"] = m.predict(te[feats]); parts.append(te)
    A = pd.concat(parts)
    mae = (A.pred - A.pts).abs().mean(); mkt_mae = (A.implied_close - A.pts).abs().mean()
    print(f"\n{tag}: team-pts MAE {mae:.3f} | market implied MAE {mkt_mae:.3f}  ({'MODEL BEATS MARKET' if mae<mkt_mae else 'market better'})")
    A = A[A.pts != A.implied_close].copy()
    A["edge"] = A.pred - A.implied_close; A["over"] = (A.pts > A.implied_close).astype(int)
    print(f"  corr(edge, team-total result) {np.corrcoef(A.edge, A.over)[0,1]:+.3f}")
    for thr in [2, 3, 4, 5]:
        ov = A[A.edge >= thr]; un = A[A.edge <= -thr]
        print(f"  edge>=+{thr}: OVER {100*ov.over.mean():.1f}% n={len(ov):<4} 2025 {100*ov[ov.season==2025].over.mean():.0f}({(ov.season==2025).sum()}) | "
              f"edge<=-{thr}: UNDER {100*(1-un.over).mean():.1f}% n={len(un):<4} 2025 {100*(1-un[un.season==2025].over).mean():.0f}({(un.season==2025).sum()})")
    return A

print(f"team-games: {len(T)} | features: {len(FUND)} fund(+adapt)")
run(FUND, "PURE FUNDAMENTALS+ADAPTATION")
run(MKT, "MARKET-ANCHORED (+open lines)")
