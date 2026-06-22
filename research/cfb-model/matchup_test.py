"""
Test explicit MATCHUP features: pair each team's offense facet vs the opponent's defense-allowed
in that facet. Per facet: home_exp = home_off + away_def_allowed ; away_exp = away_off + home_def_allowed.
matchup_diff = home_exp - away_exp (sides signal); matchup_sum = home_exp + away_exp (totals signal).
Plus field-position and points-per-opportunity matchups.
A/B vs base model on MAE AND the betting spots (the priors lesson: accuracy != betting edge).
"""
import os
import numpy as np
import pandas as pd
from sklearn.ensemble import HistGradientBoostingRegressor

HERE = os.path.dirname(os.path.abspath(__file__))
gm = pd.read_parquet(os.path.join(HERE, "data", "model_games.parquet"))
TS = [2021, 2022, 2023, 2024, 2025]; P5 = {"SEC", "Big Ten", "Big 12", "ACC", "Pac-12"}
def roi(h, n): return (h * 0.909 - (n - h)) / n * 100 if n else 0.0

FACETS = ["adj_epa", "adj_rushing_epa", "adj_passing_epa", "adj_success", "adj_standard_down_success",
          "adj_passing_down_success", "adj_explosiveness", "adj_rush_explosiveness",
          "adj_pass_explosiveness", "adj_line_yards", "adj_second_level_yards", "adj_open_field_yards"]
MATCH = []
for f in FACETS:
    ho = pd.to_numeric(gm[f"home_{f}"], errors="coerce"); hda = pd.to_numeric(gm[f"home_{f}_allowed"], errors="coerce")
    ao = pd.to_numeric(gm[f"away_{f}"], errors="coerce"); ada = pd.to_numeric(gm[f"away_{f}_allowed"], errors="coerce")
    home_exp = ho + ada            # home offense vs away defense allowed
    away_exp = ao + hda
    gm[f"mdiff_{f}"] = home_exp - away_exp
    gm[f"msum_{f}"] = home_exp + away_exp
    MATCH += [f"mdiff_{f}", f"msum_{f}"]
# ppo + field position matchups
for off, dfa, nm in [("off_ppo", "def_ppo", "ppo"), ("off_start", "def_start", "fp")]:
    he = pd.to_numeric(gm[f"home_{off}"], errors="coerce") + pd.to_numeric(gm[f"away_{dfa}"], errors="coerce")
    ae = pd.to_numeric(gm[f"away_{off}"], errors="coerce") + pd.to_numeric(gm[f"home_{dfa}"], errors="coerce")
    gm[f"mdiff_{nm}"] = he - ae; gm[f"msum_{nm}"] = he + ae
    MATCH += [f"mdiff_{nm}", f"msum_{nm}"]

EXCLUDE = {"game_id", "season", "date", "homeTeam", "awayTeam", "homeConference", "awayConference",
           "homePoints", "awayPoints", "venueId", "actual_total", "actual_margin",
           "spread_close", "spread_open", "total_close", "total_open"}
num = gm.select_dtypes(include=[np.number, "Int64", "boolean"]); BASE = [c for c in num.columns if c not in EXCLUDE and c not in MATCH]
gm[BASE + MATCH] = gm[BASE + MATCH].apply(pd.to_numeric, errors="coerce")

def run(feats, target, label):
    P = []
    for S in TS:
        tr = gm[(gm.season < S) & gm[target].notna()]
        col = "total_open" if target == "actual_total" else "spread_open"
        te = gm[(gm.season == S) & gm[col].notna() & gm[target].notna()].copy()
        te["pred"] = HistGradientBoostingRegressor(max_iter=300, learning_rate=0.05, max_depth=4,
            l2_regularization=1.0, random_state=0).fit(tr[feats], tr[target]).predict(te[feats])
        P.append(te)
    A = pd.concat(P)
    if target == "actual_total":
        A["edge"] = A.pred - A.total_open; A = A[A.actual_total != A.total_open]
        mae = (A.pred - A.actual_total).abs().mean()
        u = A[A.edge <= -3]; uh = int((u.actual_total < u.total_open).sum())
        print(f"{label:<16} MAE={mae:.3f} | under e<=-3: {len(u)} {100*uh/len(u):.1f}% {roi(uh,len(u)):+.1f}%")
    else:
        A["edge"] = A.pred + A.spread_open; A = A[(A.actual_margin + A.spread_open) != 0]
        A["aw"] = (A.actual_margin + A.spread_open) < 0; A["p5"] = A.homeConference.isin(P5) & A.awayConference.isin(P5)
        mae = (A.pred - A.actual_margin).abs().mean()
        b = A[(A.edge <= -4) & A.p5]; bh = int(b.aw.sum())
        print(f"{label:<16} MAE={mae:.3f} | P5 away e<=-4: {len(b)} {100*bh/len(b):.1f}% {roi(bh,len(b)):+.1f}%")

print("TOTALS:")
run(BASE, "actual_total", "  base"); run(BASE + MATCH, "actual_total", "  + matchups")
print("SIDES:")
run(BASE, "actual_margin", "  base"); run(BASE + MATCH, "actual_margin", "  + matchups")
