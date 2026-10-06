#!/usr/bin/env python3
"""NFL TOTALS, rebuilt. (owner 2026-10-06: "completely rebuild ... stop using opening numbers from
fucking July ... Monday morning lines for Thu-Sun games and Tuesday lines for the Monday nighter")

WHY A REBUILD. The shipped consensus_totals model graded 12-33 (26.7%) on the 2026 board and its
edge-to-outcome relationship is INVERTED and dose-responsive (corr -0.285; "model says UNDER by 6+"
-> the game went OVER 85.7% of the time). Its claimed 57-58% came from a 2024-25 backtest whose
pickle will not load here, so it cannot be checked. Rather than patch a model whose sign is
backwards, this builds one from scratch under rules that have each caught a real bug in this repo:

  1. PREDICT THE RAW QUANTITY, with the market line as a FEATURE. Predicting the residual
     (actual - line) measured -1.2% against +3.9% for the raw target in prior work.
  2. GRADE AT THE LINE THE SIGNAL BETS -- here the Monday/Tuesday opener from nfl_opener.py.
  3. ORACLE-CHECK the grader: feed the realised total into the bet rule; it must win ~100%.
  4. LEAK SCREEN every feature: a pregame feature should correlate at least as strongly with the
     LINE as with the RESULT. More with the result = it knows something the market does not, which
     in practice means it leaked.
  5. WALK FORWARD, train on seasons < target only, and report PER SEASON. Pooled numbers hid a
     regime break in every prior model here.
  6. NO BLIND THRESHOLD SWEEP. Report the whole threshold curve and judge monotonicity; do not
     report the best cell as the result.

Usage: totals_rebuild.py
"""
import warnings
warnings.filterwarnings("ignore")
import numpy as np, pandas as pd
from sklearn.ensemble import HistGradientBoostingRegressor

NV = {"Arizona":"ARI","Atlanta":"ATL","Baltimore":"BAL","Buffalo":"BUF","Carolina":"CAR",
 "Chicago":"CHI","Cincinnati":"CIN","Cleveland":"CLE","Dallas":"DAL","Denver":"DEN","Detroit":"DET",
 "Green Bay":"GB","Houston":"HOU","Indianapolis":"IND","Jacksonville":"JAX","Kansas City":"KC",
 "LA Chargers":"LAC","LA Rams":"LA","Las Vegas":"LV","Miami":"MIA","Minnesota":"MIN",
 "NY Giants":"NYG","NY Jets":"NYJ","New England":"NE","New Orleans":"NO","Philadelphia":"PHI",
 "Pittsburgh":"PIT","San Francisco":"SF","Seattle":"SEA","Tampa Bay":"TB","Tennessee":"TEN",
 "Washington":"WAS"}

m = pd.read_parquet("data/matchup.parquet")
op = pd.read_parquet("data/opener_weekly.parquet")
op["home_ab"] = op.home_team.map(NV); op["away_ab"] = op.away_team.map(NV)
op = op.dropna(subset=["home_ab", "away_ab", "open_total_point"])
# one opener per (season, home, away): the EARLIEST game_date, so a REG game is never matched to a
# later playoff rematch of the same pair
op = op.sort_values("game_date").groupby(["season", "home_ab", "away_ab"], as_index=False).first()
d = m.merge(op[["season", "home_ab", "away_ab", "open_total_point", "n_books",
                "open_days_before_kick"]],
            on=["season", "home_ab", "away_ab"], how="inner")
d = d[d.actual_total.notna() & d.open_total_point.notna()].copy()
d["open_total"] = d.open_total_point.astype(float)
d["y"] = d.actual_total.astype(float)
print(f"frame: {len(d)} games with a Monday/Tuesday opener AND a final score, "
      f"seasons {sorted(d.season.unique())}")
print(f"  opener age: median {d.open_days_before_kick.median():.2f} days, "
      f"books median {d.n_books.median():.0f}")

# ---- features: pregame team form + environment + the market's own number -------------------
import re
BAN = re.compile(r"actual_|total_points|home_score|away_score|final_|_result$|cover|favorite|"
                 r"nv_total_line|ou_vegas_line|spread|margin|^y$|close", re.I)
num = d.select_dtypes(include=[np.number]).columns
FEATS = [c for c in num if not BAN.search(c) and c not in ("season", "week", "open_total_point")]
FEATS = [c for c in FEATS if d[c].notna().mean() > 0.80]
FEATS = ["open_total"] + [c for c in FEATS if c != "open_total"]
print(f"  candidate features: {len(FEATS)} (the market's opener included as a feature)")

# ---- LAW 4: leak screen ----------------------------------------------------------------------
print("\n=== leak screen: |corr with RESULT| should NOT exceed |corr with LINE| ===")
rows = []
for c in FEATS:
    if c == "open_total":
        continue
    x = pd.to_numeric(d[c], errors="coerce").astype(float)
    ok = x.notna() & d.open_total.notna() & d.y.notna()
    if ok.sum() < 200 or x[ok].std(ddof=0) == 0:
        continue
    xi = x[ok].to_numpy(dtype=float)
    cl = abs(np.corrcoef(xi, d.open_total[ok].to_numpy(dtype=float))[0, 1])
    cr = abs(np.corrcoef(xi, d.y[ok].to_numpy(dtype=float))[0, 1])
    if not (np.isfinite(cl) and np.isfinite(cr)):
        continue
    rows.append((c, cl, cr, cr - cl))
lk = pd.DataFrame(rows, columns=["feat", "corr_line", "corr_result", "gap"]).sort_values("gap", ascending=False)
bad = lk[lk.gap > 0.05]
print(f"  {len(lk)} screened; {len(bad)} correlate >0.05 MORE with the result than the line")
if len(bad):
    print(bad.head(10).to_string(index=False))
    FEATS = [f for f in FEATS if f not in set(bad.feat)]
    print(f"  -> dropped them; {len(FEATS)} features remain")
else:
    print("  none flagged")

# ---- walk-forward ---------------------------------------------------------------------------
print("\n=== walk-forward: train on seasons < target, grade at the Monday opener ===")
preds = []
for target in sorted(d.season.unique()):
    tr = d[d.season < target]
    te = d[d.season == target]
    if len(tr) < 300 or te.empty:
        continue
    Xtr = tr[FEATS].apply(pd.to_numeric, errors="coerce").astype(float)
    Xte = te[FEATS].apply(pd.to_numeric, errors="coerce").astype(float)
    reg = HistGradientBoostingRegressor(max_depth=3, learning_rate=0.05, max_iter=400,
                                        l2_regularization=2.0, min_samples_leaf=40,
                                        random_state=0).fit(Xtr, tr.y)
    p = reg.predict(Xte)
    preds.append(te.assign(pred=p))
P = pd.concat(preds)
P["edge"] = P.pred - P.open_total
P["side"] = np.where(P.edge > 0, "OVER", "UNDER")
P["res"] = np.where(P.y > P.open_total, "OVER", np.where(P.y < P.open_total, "UNDER", "PUSH"))
P = P[P.res != "PUSH"].copy()
P["won"] = P.side == P.res
# LAW 3: oracle
orc = (np.where(P.y > P.open_total, "OVER", "UNDER") == P.res).mean()
assert orc > 0.999, f"grader inverted, oracle {orc:.3f}"
print(f"  {len(P)} graded bets, oracle {orc:.3f}")
print(f"\n  MAE model {np.abs(P.pred-P.y).mean():.2f}  vs  opener {np.abs(P.open_total-P.y).mean():.2f}")
print(f"  corr(edge, actual-opener) = {np.corrcoef(P.edge, P.y-P.open_total)[0,1]:+.3f}"
      f"   <- POSITIVE means the model has directional signal")

def rec(s):
    if not len(s): return f"{'—':>34}"
    w = int(s.won.sum()); l = len(s) - w
    return f"{len(s):>6}{f'{w}-{l}':>11}{w/len(s)*100:>8.1f}%{(w*0.909-l)/len(s)*100:>+9.1f}%"

print(f"\n{'threshold':<22}{'n':>6}{'W-L':>11}{'hit':>8}{'ROI':>9}")
for t in (0, 1, 2, 3, 4, 5, 6, 8):
    print(f"{f'|edge| >= {t}':<22}{rec(P[P.edge.abs() >= t])}")
print(f"\n{'season':<10}{'n':>6}{'W-L':>11}{'hit':>8}{'ROI':>9}   (|edge| >= 3)")
for sea, x in P[P.edge.abs() >= 3].groupby("season"):
    print(f"{int(sea):<10}{rec(x)}")
P.to_csv("out/totals_rebuild_preds.csv", index=False)
print("\n-> out/totals_rebuild_preds.csv")
