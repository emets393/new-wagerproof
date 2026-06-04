"""
Leakage audit for cfb_api_training_data adjusted stats.

Question: is each row's adjusted_epa computed strictly BEFORE that game (clean,
season-to-date through week N-1) or does it INCLUDE the game itself (leak)?

Method (no external API needed):
  Build per-team chronological series. For each game, the team's "current" adjusted_epa
  is the value in that row; its "lagged" value is the same team's value in its PREVIOUS game.
  A guaranteed-pregame predictor = lagged. If the CURRENT value predicts THIS game's
  result materially better than the LAGGED value, the current value is contaminated.

Also: compare a net-EPA margin predictor's correlation with actual margin vs the market
spread's correlation. No clean pregame fundamental should beat the closing market.
"""
import os
import numpy as np
import pandas as pd

HERE = os.path.dirname(os.path.abspath(__file__))
df = pd.read_parquet(os.path.join(HERE, "data", "cfb_api_training_data.parquet"))

# --- clean types ---
df["away_points"] = pd.to_numeric(df["away_points"], errors="coerce")
df["home_points"] = pd.to_numeric(df["home_points"], errors="coerce")
df = df.dropna(subset=["home_points", "away_points"]).copy()
df["home_margin"] = df["home_points"] - df["away_points"]   # >0 = home won
df["total_pts"] = df["home_points"] + df["away_points"]

# --- build long per-team table (one row per team-game) ---
def side(df, who):
    o = "home" if who == "home" else "away"
    opp = "away" if who == "home" else "home"
    g = pd.DataFrame({
        "season": df["season"], "week": df["week"], "id": df["id"],
        "team": df[f"{o}_team"],
        "epa": df[f"{o}_adjusted_epa"],
        "epa_allowed": df[f"{o}_adjusted_epa_allowed"],
        "team_pts": df[f"{o}_points"],
        "opp_pts": df[f"{opp}_points"],
    })
    g["team_margin"] = g["team_pts"] - g["opp_pts"]
    return g

long = pd.concat([side(df, "home"), side(df, "away")], ignore_index=True)
long = long.sort_values(["season", "team", "week", "id"]).reset_index(drop=True)

# lagged (previous game) values within season+team
for c in ["epa", "epa_allowed"]:
    long[f"{c}_lag"] = long.groupby(["season", "team"])[c].shift(1)

# net offense quality vs own margin
def corr(a, b):
    m = a.notna() & b.notna()
    if m.sum() < 30:
        return np.nan, m.sum()
    return np.corrcoef(a[m], b[m])[0, 1], int(m.sum())

print("=" * 70)
print("TEST 1: does CURRENT-week epa predict its OWN game better than LAGGED?")
print("(weeks 2+, so a lagged value exists; team_margin is this game's result)")
print("=" * 70)
w2 = long[long["week"] >= 2]
cur_c, n1 = corr(w2["epa"], w2["team_margin"])
lag_c, n2 = corr(w2["epa_lag"], w2["team_margin"])
print(f"  corr(current epa , team_margin) = {cur_c:.3f}  (n={n1})")
print(f"  corr(lagged  epa , team_margin) = {lag_c:.3f}  (n={n2})")
print(f"  -> gap = {cur_c - lag_c:+.3f}  (large positive gap = current value contains this game = LEAK)")

print()
print("  By week (current vs lagged corr with own-game margin):")
for wk in range(2, 13):
    sub = long[long["week"] == wk]
    cc, ncc = corr(sub["epa"], sub["team_margin"])
    lc, nlc = corr(sub["epa_lag"], sub["team_margin"])
    if not np.isnan(cc) and not np.isnan(lc):
        print(f"    wk {wk:2d}: current {cc:.3f} | lagged {lc:.3f} | gap {cc-lc:+.3f} (n={ncc})")

print()
print("=" * 70)
print("TEST 2: net-EPA margin predictor vs MARKET spread (corr with actual margin)")
print("no clean pregame fundamental should beat the closing market")
print("=" * 70)
# net: home scores more when its offense is strong AND the opponent defense is weak
# (epa_allowed HIGH = weak defense), so opponent's allowed term ADDS to a team's expected output.
df["net_epa"] = ((df["home_adjusted_epa"] + df["away_adjusted_epa_allowed"])
                 - (df["away_adjusted_epa"] + df["home_adjusted_epa_allowed"]))
# market: spread convention check below
nc, nn = corr(df["net_epa"], df["home_margin"])
# spread sign: in this table spread<0 when home favored (Alabama -19.5). home_margin>0 home wins.
# so -spread should correlate positively with home_margin.
sc, sn = corr(-df["spread"], df["home_margin"])
print(f"  corr(net_epa     , home_margin) = {nc:.3f}  (n={nn})")
print(f"  corr(-spread     , home_margin) = {sc:.3f}  (n={sn})   <- market benchmark")
print(f"  -> if net_epa corr >> market corr, the EPA is seeing the future (LEAK)")

print()
print("  Same, WEEK 1 only (epa cannot contain in-season info; pure preseason prior):")
w1 = df[df["week"] == 1]
nc1, _ = corr(w1["net_epa"], w1["home_margin"])
sc1, _ = corr(-w1["spread"], w1["home_margin"])
print(f"    corr(net_epa, margin)={nc1:.3f} | corr(-spread, margin)={sc1:.3f} | n={len(w1)}")
