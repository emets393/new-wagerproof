"""
Permutation importance for the totals model (what drives the total prediction),
evaluated out-of-sample on 2024+2025 (train on prior seasons).
"""
import os
import numpy as np
import pandas as pd
from sklearn.ensemble import HistGradientBoostingRegressor
from sklearn.inspection import permutation_importance

HERE = os.path.dirname(os.path.abspath(__file__))
gm = pd.read_parquet(os.path.join(HERE, "data", "model_games.parquet"))
EXCLUDE = {"game_id", "season", "date", "homeTeam", "awayTeam", "homeConference", "awayConference",
           "homePoints", "awayPoints", "venueId", "actual_total", "actual_margin",
           "spread_close", "spread_open", "total_close", "total_open"}
num = gm.select_dtypes(include=[np.number, "Int64", "boolean"])
FEATS = [c for c in num.columns if c not in EXCLUDE]
gm[FEATS] = gm[FEATS].apply(pd.to_numeric, errors="coerce")

tr = gm[(gm["season"] < 2024) & gm["actual_total"].notna()]
te = gm[(gm["season"] >= 2024) & gm["actual_total"].notna()].copy()
m = HistGradientBoostingRegressor(max_iter=300, learning_rate=0.05, max_depth=4,
                                  l2_regularization=1.0, random_state=0).fit(tr[FEATS], tr["actual_total"])
pi = permutation_importance(m, te[FEATS], te["actual_total"], n_repeats=8, random_state=0,
                            scoring="neg_mean_absolute_error")
imp = pd.DataFrame({"feature": FEATS, "imp": pi.importances_mean}).sort_values("imp", ascending=False)
print("TOP 25 features by permutation importance (totals, OOS 2024-25):")
print(imp.head(25).to_string(index=False))
print("\nSituational features ranking (where do they land?):")
sit = imp[imp["feature"].str.contains("bye|short|streak|consec|last_|next_|travel|rank|letdown|lookahead|elev|neutral|conf", case=False)]
print(sit.head(20).to_string(index=False))
