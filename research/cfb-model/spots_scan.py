"""
Situational TOTALS spot scan with permutation-null FP control (NFL b3 discipline).

For each named condition, compute OVER rate vs the OPENING total (2021-2025, opens exist).
A "passer" = |over_rate-50| >= 4pp with n >= 40 (bettable lean, either direction).
Permutation null: shuffle the over/under outcome K times, recount passers by chance.
If real passers >> null, there is genuine situational signal. Survivors get per-season breakdown.
"""
import os
import numpy as np
import pandas as pd

HERE = os.path.dirname(os.path.abspath(__file__))
gm = pd.read_parquet(os.path.join(HERE, "data", "model_games.parquet"))
df = gm[gm["total_open"].notna() & gm["actual_total"].notna() & (gm["season"] >= 2021)].copy()
df["over"] = (df["actual_total"] > df["total_open"]).astype(int)
df = df[df["actual_total"] != df["total_open"]]  # drop pushes
print(f"universe: {len(df)} games 2021-2025 with open totals, base over-rate {100*df['over'].mean():.1f}%")

# helper getters with NaN-safe
def col(c):
    return pd.to_numeric(df[c], errors="coerce") if c in df.columns else pd.Series(np.nan, index=df.index)

q = df["total_open"].quantile
soe_hi = df["sum_off_epa"].quantile(0.75)
soe_lo = df["sum_off_epa"].quantile(0.25)
trav_hi = col("away_travel_miles").quantile(0.85)
ndiff = col("net_rating_diff").abs()

CONDS = {
    "home_off_bye": col("home_off_bye") == 1,
    "away_off_bye": col("away_off_bye") == 1,
    "either_off_bye": (col("home_off_bye") == 1) | (col("away_off_bye") == 1),
    "home_short_week": col("home_short_week") == 1,
    "away_short_week": col("away_short_week") == 1,
    "ranked_matchup": col("ranked_matchup") == 1,
    "one_ranked": (col("home_self_rank_is").fillna(0) + col("away_self_rank_is").fillna(0)) == 1,
    "no_ranked": (col("home_self_rank_is").fillna(0) + col("away_self_rank_is").fillna(0)) == 0,
    "home_off_ranked(letdown)": col("home_last_opp_rank_is") == 1,
    "away_off_ranked(letdown)": col("away_last_opp_rank_is") == 1,
    "home_next_ranked(lookahd)": col("home_next_opp_rank_is") == 1,
    "away_next_ranked(lookahd)": col("away_next_opp_rank_is") == 1,
    "away_high_travel": col("away_travel_miles") >= trav_hi,
    "neutral_site": col("neutralSite").astype("boolean").fillna(False),
    "conference_game": col("conferenceGame").astype("boolean").fillna(False),
    "nonconf_game": ~col("conferenceGame").astype("boolean").fillna(True),
    "home_dome": col("home_elev").notna() & (col("home_adj_epa").notna()),  # placeholder; dome flag below
    "high_total_env": df["total_open"] >= q(0.75),
    "low_total_env": df["total_open"] <= q(0.25),
    "both_strong_off": df["sum_off_epa"] >= soe_hi,
    "both_weak_off": df["sum_off_epa"] <= soe_lo,
    "big_mismatch": ndiff >= ndiff.quantile(0.80),
    "even_matchup": ndiff <= ndiff.quantile(0.20),
    "early_season(wk<=4)": col("week") <= 4,
    "late_season(wk>=11)": col("week") >= 11,
    "home_blowout_win_last": col("home_last_blowout_win") == 1,
    "away_blowout_win_last": col("away_last_blowout_win") == 1,
    "home_blowout_loss_last": col("home_last_blowout_loss") == 1,
    "home_long_rest": col("home_days_rest") >= 10,
    "home_hot_streak": col("home_win_streak") >= 3,
    "away_hot_streak": col("away_win_streak") >= 3,
}

def evaluate(over_series):
    res = []
    for name, mask in CONDS.items():
        m = mask.fillna(False).astype(bool)
        n = int(m.sum())
        if n < 40:
            continue
        orate = 100 * over_series[m].mean()
        res.append((name, n, orate, abs(orate - 50)))
    return res

real = evaluate(df["over"])
passers = [r for r in real if r[3] >= 4]
print(f"\nconditions tested (n>=40): {len(real)} | passers (|over-50|>=4pp): {len(passers)}")

# permutation null
rng = np.random.default_rng(0)
K = 300
null_counts = []
ov = df["over"].values
for _ in range(K):
    sh = pd.Series(rng.permutation(ov), index=df.index)
    null_counts.append(len([r for r in evaluate(sh) if r[3] >= 4]))
null_counts = np.array(null_counts)
print(f"null passers: mean {null_counts.mean():.1f}, 95th pct {np.percentile(null_counts,95):.0f}, max {null_counts.max()}")
print(f"-> real {len(passers)} vs null95 {np.percentile(null_counts,95):.0f} "
      f"=> {'ENRICHED (signal)' if len(passers) > np.percentile(null_counts,95) else 'within chance (noise)'}")

print("\nPassers (sorted by deviation), with per-season over-rate:")
for name, n, orate, dev in sorted(passers, key=lambda x: -x[3]):
    m = CONDS[name].fillna(False).astype(bool)
    lean = "OVER" if orate > 50 else "UNDER"
    per = []
    for s in [2021, 2022, 2023, 2024, 2025]:
        ms = m & (df["season"] == s)
        ns = int(ms.sum())
        per.append(f"{100*df['over'][ms].mean():.0f}" if ns >= 10 else "--")
    print(f"  {name:<28} n={n:<4} over={orate:4.1f}% lean={lean:<5} [{'/'.join(per)}]")
