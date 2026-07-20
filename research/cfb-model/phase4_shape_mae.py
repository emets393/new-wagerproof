"""Phase 4 — do SCHEME/SHAPE features (orthogonal to team-average efficiency, which the market prices)
lower the model's per-market MAE? Walk-forward: train on prior seasons, test each season 2021-2025.
Baseline = efficiency + ratings (what the close reflects). +Shape = pace, run/pass identity, explosiveness
(boom-bust), trench matchup, havoc. Keep only shape groups that lower MAE. Compare to market MAE for context.
Mirrors CBB's finding that roster-SHAPE moved the margin model where efficiency recompute gave ~0."""
import numpy as np, pandas as pd, warnings
from sklearn.ensemble import HistGradientBoostingRegressor
warnings.filterwarnings("ignore")

g = pd.read_parquet("data/model_games.parquet").sort_values(["season", "week"]).reset_index(drop=True)

# ── feature sets ──
BASE = ["net_rating_diff", "elo_diff", "talent_diff",
        "home_adj_epa", "home_adj_epa_allowed", "away_adj_epa", "away_adj_epa_allowed",
        "home_adj_success", "home_adj_success_allowed", "away_adj_success", "away_adj_success_allowed",
        "home_off_ppo", "home_def_ppo", "away_off_ppo", "away_def_ppo",
        "home_days_rest", "away_days_rest"]
g["neutral"] = g.neutralSite.astype(int)
BASE += ["neutral"]

SHAPE = {
    "pace":   ["home_plays_pg", "away_plays_pg", "home_poss_secs_pg", "away_poss_secs_pg"],
    "identity": ["home_pass_rate", "away_pass_rate",
                 "home_adj_rushing_epa", "home_adj_passing_epa", "away_adj_rushing_epa", "away_adj_passing_epa"],
    "explosive": ["home_adj_explosiveness", "away_adj_explosiveness",
                  "home_adj_pass_explosiveness", "away_adj_pass_explosiveness",
                  "home_adj_explosiveness_allowed", "away_adj_explosiveness_allowed"],
    "trench": ["home_adj_line_yards", "home_adj_line_yards_allowed", "away_adj_line_yards", "away_adj_line_yards_allowed",
               "home_off_havoc", "away_off_havoc", "home_def_havoc", "away_def_havoc",
               "home_def_havoc_f7", "away_def_havoc_f7", "home_adj_open_field_yards", "away_adj_open_field_yards"],
}
ALLSHAPE = [c for v in SHAPE.values() for c in v]

def mae_wf(feats, target, test_seasons):
    maes = []
    for ts in test_seasons:
        tr = g[g.season < ts]; te = g[g.season == ts]
        Xtr, ytr = tr[feats], tr[target]; Xte, yte = te[feats], te[target]
        ok = ytr.notna()
        m = HistGradientBoostingRegressor(max_iter=400, learning_rate=0.05, max_leaf_nodes=15,
                                          min_samples_leaf=60, l2_regularization=1.0, random_state=0)
        m.fit(Xtr[ok], ytr[ok])
        p = m.predict(Xte)
        maes.append(np.mean(np.abs(p - yte)))
    return np.mean(maes)

TESTS = [2021, 2022, 2023, 2024, 2025]

# market MAE baselines
mkt_margin = np.mean([np.mean(np.abs((-g[g.season == s].spread_close) - g[g.season == s].actual_margin).dropna()) for s in TESTS])
mkt_total = np.mean([np.mean(np.abs(g[g.season == s].total_close - g[g.season == s].actual_total).dropna()) for s in TESTS])

print("=" * 90)
print("PHASE 4 — SHAPE FEATURES → walk-forward MAE (test seasons 2021-25; lower = better)")
print("=" * 90)
for target, mkt, lbl in [("actual_margin", mkt_margin, "MARGIN (spread)"), ("actual_total", mkt_total, "TOTAL")]:
    base = mae_wf(BASE, target, TESTS)
    full = mae_wf(BASE + ALLSHAPE, target, TESTS)
    print(f"\n### {lbl}   market MAE {mkt:.3f}")
    print(f"  baseline (efficiency+ratings): {base:.3f}")
    print(f"  + ALL shape:                   {full:.3f}   (delta {full-base:+.3f})")
    for grp, cols in SHAPE.items():
        m = mae_wf(BASE + cols, target, TESTS)
        print(f"    + {grp:9s} only:              {m:.3f}   (delta {m-base:+.3f})")

# ── team-points model (team total analog): team offense vs opp defense + shape ──
print("\n" + "=" * 90); print("TEAM POINTS (team-total analog) — team perspective"); print("=" * 90)
def side(s):
    o, d = ("home", "away") if s == "home" else ("away", "home")
    df = pd.DataFrame({"season": g.season, "week": g.week,
                       "team_pts": g[f"{o}Points"], "neutral": g.neutral})
    base = ["net_rating_diff", "elo_diff", "talent_diff"]
    df["str_diff"] = (g[f"{o}_net_rating"] - g[f"{d}_net_rating"])
    for c in ["adj_epa", "adj_success", "off_ppo"]:
        df["o_" + c] = g[f"{o}_{c}"]
    for c in ["adj_epa_allowed", "adj_success_allowed", "def_ppo"]:
        df["d_" + c] = g[f"{d}_{c}"]
    for c in ["plays_pg", "poss_secs_pg", "pass_rate", "adj_explosiveness", "adj_rushing_epa", "adj_passing_epa"]:
        df["shp_o_" + c] = g[f"{o}_{c}"]
    for c in ["adj_explosiveness_allowed", "adj_line_yards_allowed", "def_havoc"]:
        df["shp_d_" + c] = g[f"{d}_{c}"]
    return df
tp = pd.concat([side("home"), side("away")], ignore_index=True).sort_values(["season", "week"]).reset_index(drop=True)
tbase = [c for c in tp.columns if c.startswith(("str_diff", "o_", "d_", "net_", "elo_", "talent_")) or c == "neutral"]
tshape = [c for c in tp.columns if c.startswith("shp_")]
def mae_tp(feats, tsts):
    ms = []
    for ts in tsts:
        tr = tp[tp.season < ts]; te = tp[tp.season == ts]; ok = tr.team_pts.notna()
        m = HistGradientBoostingRegressor(max_iter=400, learning_rate=0.05, max_leaf_nodes=15, min_samples_leaf=60, l2_regularization=1.0, random_state=0).fit(tr[feats][ok], tr.team_pts[ok])
        ms.append(np.mean(np.abs(m.predict(te[feats]) - te.team_pts)))
    return np.mean(ms)
b = mae_tp(tbase, TESTS); f = mae_tp(tbase + tshape, TESTS)
print(f"  baseline: {b:.3f}   + shape: {f:.3f}   (delta {f-b:+.3f})")
