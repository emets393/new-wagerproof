"""
CFB totals baseline — walk-forward, graded HONESTLY vs the opening total (bet at open).

- Train on all seasons strictly BEFORE the test season (true walk-forward).
- Predict actual_total from fundamentals + situational features (NO line as a feature).
- Bet OVER/UNDER when |pred - total_open| >= threshold; grade vs total_open.
- Opening totals exist 2021-2025 only -> betting eval on those; 2016-2019 train-only.
- Report per-season (never just pooled), model MAE vs market MAE, hit% + ROI at -110.
"""
import os
import numpy as np
import pandas as pd
from sklearn.ensemble import HistGradientBoostingRegressor

HERE = os.path.dirname(os.path.abspath(__file__))
gm = pd.read_parquet(os.path.join(HERE, "data", "model_games.parquet"))

# ---- feature columns: pregame only, exclude labels/lines/ids/names ----
EXCLUDE = {"game_id", "season", "date", "homeTeam", "awayTeam", "homeConference",
           "awayConference", "homePoints", "awayPoints", "venueId",
           "actual_total", "actual_margin", "spread_close", "spread_open",
           "total_close", "total_open"}
num = gm.select_dtypes(include=[np.number, "Int64", "boolean"]).copy()
FEATS = [c for c in num.columns if c not in EXCLUDE]
gm[FEATS] = gm[FEATS].apply(pd.to_numeric, errors="coerce")

TEST_SEASONS = [2021, 2022, 2023, 2024, 2025]
THRESH = 4.0  # points of edge vs the open to fire a bet

def roi(hits, n):
    # -110: win +0.909, lose -1
    return (hits * 0.909 - (n - hits)) / n * 100 if n else 0.0

rows = []
allpicks = []
for S in TEST_SEASONS:
    tr = gm[(gm["season"] < S) & gm["actual_total"].notna()]
    te = gm[(gm["season"] == S) & gm["total_open"].notna() & gm["actual_total"].notna()].copy()
    m = HistGradientBoostingRegressor(max_iter=300, learning_rate=0.05,
                                      max_depth=4, l2_regularization=1.0, random_state=0)
    m.fit(tr[FEATS], tr["actual_total"])
    te["pred"] = m.predict(te[FEATS])
    te["edge"] = te["pred"] - te["total_open"]
    # model vs market accuracy
    mae_model = (te["pred"] - te["actual_total"]).abs().mean()
    mae_mkt = (te["total_open"] - te["actual_total"]).abs().mean()
    # bets
    b = te[te["edge"].abs() >= THRESH].copy()
    b["bet_over"] = b["edge"] > 0
    b["win"] = np.where(b["bet_over"], b["actual_total"] > b["total_open"],
                        b["actual_total"] < b["total_open"])
    b["push"] = b["actual_total"] == b["total_open"]
    b = b[~b["push"]]
    hits = int(b["win"].sum()); n = len(b)
    rows.append({"season": S, "test_n": len(te), "mae_model": round(mae_model, 2),
                 "mae_mkt": round(mae_mkt, 2), "bets": n, "hit%": round(100 * hits / n, 1) if n else 0,
                 "roi%": round(roi(hits, n), 1)})
    allpicks.append(b)

res = pd.DataFrame(rows)
print("=" * 78)
print(f"CFB TOTALS BASELINE — walk-forward, bet at OPEN, |edge|>={THRESH}, grade vs open")
print("=" * 78)
print(res.to_string(index=False))

pk = pd.concat(allpicks)
H, N = int(pk["win"].sum()), len(pk)
print(f"\nPOOLED 2021-2025: {N} bets, {100*H/N:.1f}% hit, {roi(H,N):+.1f}% ROI")
mm = (pk["pred"] - pk["actual_total"]).abs().mean()
print(f"Model MAE {res['mae_model'].mean():.2f} vs Market MAE {res['mae_mkt'].mean():.2f} "
      f"({'model worse' if res['mae_model'].mean() > res['mae_mkt'].mean() else 'model better'} on raw prediction)")

# threshold sweep (pooled, honest vs open)
print("\nThreshold sweep (pooled 2021-2025, grade vs open):")
print(f"{'thr':>4}{'bets':>7}{'hit%':>7}{'roi%':>8}")
big = []
for S in TEST_SEASONS:
    tr = gm[(gm["season"] < S) & gm["actual_total"].notna()]
    te = gm[(gm["season"] == S) & gm["total_open"].notna() & gm["actual_total"].notna()].copy()
    m = HistGradientBoostingRegressor(max_iter=300, learning_rate=0.05, max_depth=4,
                                      l2_regularization=1.0, random_state=0).fit(tr[FEATS], tr["actual_total"])
    te["pred"] = m.predict(te[FEATS]); te["edge"] = te["pred"] - te["total_open"]
    big.append(te)
allte = pd.concat(big)
for thr in [1, 2, 3, 4, 5, 6, 7, 8, 10]:
    b = allte[allte["edge"].abs() >= thr].copy()
    b["win"] = np.where(b["edge"] > 0, b["actual_total"] > b["total_open"], b["actual_total"] < b["total_open"])
    b = b[b["actual_total"] != b["total_open"]]
    n = len(b); h = int(b["win"].sum())
    print(f"{thr:>4}{n:>7}{100*h/n if n else 0:>7.1f}{roi(h,n):>8.1f}")
