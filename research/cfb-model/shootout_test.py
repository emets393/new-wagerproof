"""
Test the user's OVER/shootout hypothesis:
  pass-heavy offenses vs weak pass defense and/or low QB pressure -> shootout (OVER),
  plus situational triggers (first conference game, primetime/night, heavy travel).

For each condition report: n, OVER% vs open, ROI, avg actual_total vs baseline (does the
MECHANISM hold — are these games actually higher-scoring?), and per-season OVER%.
Permutation null controls multiple comparisons. Graded vs OPEN, 2021-2025.
"""
import os
import numpy as np
import pandas as pd

HERE = os.path.dirname(os.path.abspath(__file__))
gm = pd.read_parquet(os.path.join(HERE, "data", "model_games.parquet"))
df = gm[gm["total_open"].notna() & gm["actual_total"].notna() & (gm["season"] >= 2021)].copy()
df = df[df["actual_total"] != df["total_open"]]
df["over"] = (df["actual_total"] > df["total_open"]).astype(int)
base_over = df["over"].mean() * 100
base_tot = df["actual_total"].mean()
TS = [2021, 2022, 2023, 2024, 2025]
print(f"universe {len(df)} games | base OVER {base_over:.1f}% | base avg total {base_tot:.1f}")

def c(x): return pd.to_numeric(df[x], errors="coerce") if x in df.columns else pd.Series(np.nan, index=df.index)
def roi(h, n): return (h * 0.909 - (n - h)) / n * 100 if n else 0.0

# tendency thresholds (top/bottom tercile within universe)
pr_hi = c("home_pass_rate").quantile(0.66)  # pass-heavy cut (apply to each side)
ppd_weak = pd.concat([c("home_adj_passing_epa_allowed"), c("away_adj_passing_epa_allowed")]).quantile(0.66)  # weak pass D = high allowed
press_lo = pd.concat([c("home_pressure_pg"), c("away_pressure_pg")]).quantile(0.34)  # low pressure

# per-side "air mismatch": team passes a lot AND opponent pass D weak OR opp pressure low
home_air = (c("home_pass_rate") >= pr_hi) & ((c("away_adj_passing_epa_allowed") >= ppd_weak) | (c("away_pressure_pg") <= press_lo))
away_air = (c("away_pass_rate") >= pr_hi) & ((c("home_adj_passing_epa_allowed") >= ppd_weak) | (c("home_pressure_pg") <= press_lo))

CONDS = {
    "both_pass_heavy": (c("home_pass_rate") >= pr_hi) & (c("away_pass_rate") >= pr_hi),
    "both_weak_pass_D": (c("home_adj_passing_epa_allowed") >= ppd_weak) & (c("away_adj_passing_epa_allowed") >= ppd_weak),
    "both_low_pressure": (c("home_pressure_pg") <= press_lo) & (c("away_pressure_pg") <= press_lo),
    "either_air_mismatch": home_air | away_air,
    "BOTH_air_mismatch(shootout)": home_air & away_air,
    "shootout + open<=52": (home_air & away_air) & (df["total_open"] <= 52),
    "pass_heavy + weak_D (either side)": ((c("home_pass_rate") >= pr_hi) & (c("away_adj_passing_epa_allowed") >= ppd_weak)) |
                                          ((c("away_pass_rate") >= pr_hi) & (c("home_adj_passing_epa_allowed") >= ppd_weak)),
    # situational
    "first_conf_game(either)": c("either_first_conf") == 1,
    "primetime(Sat night)": c("primetime") == 1,
    "night_game": c("night_game") == 1,
    "heavy_travel(away top15%)": c("away_travel_miles") >= c("away_travel_miles").quantile(0.85),
}

def perseason(mask, val="over"):
    return "/".join(f"{100*df[val][mask&(df.season==s)].mean():.0f}" if (mask&(df.season==s)).sum()>=10 else "--" for s in TS)

print(f"\n{'condition':>34}{'n':>6}{'OVER%':>7}{'roi%':>8}{'avgTot':>8}{'vsBase':>8}  per-season OVER%")
results = []
for name, mask in CONDS.items():
    m = mask.fillna(False); n = int(m.sum())
    if n < 25:
        print(f"{name:>34}{n:>6}   (thin)")
        continue
    ov = 100 * df["over"][m].mean(); h = int(df["over"][m].sum())
    at = df["actual_total"][m].mean()
    print(f"{name:>34}{n:>6}{ov:>7.1f}{roi(h,n):>8.1f}{at:>8.1f}{at-base_tot:>+8.1f}  [{perseason(m)}]")
    results.append((name, n, abs(ov - base_over)))

# permutation null on OVER outcome (FP control)
rng = np.random.default_rng(1)
ov_arr = df["over"].values
real_pass = sum(1 for _, n, dev in results if n >= 40 and dev >= 4)
null = []
for _ in range(300):
    sh = pd.Series(rng.permutation(ov_arr), index=df.index)
    cnt = 0
    for name, mask in CONDS.items():
        m = mask.fillna(False); n = int(m.sum())
        if n >= 40 and abs(100*sh[m].mean() - base_over) >= 4:
            cnt += 1
    null.append(cnt)
null = np.array(null)
print(f"\nFP control: real passers(|dev|>=4,n>=40) {real_pass} vs null mean {null.mean():.1f} / 95th {np.percentile(null,95):.0f}"
      f" => {'ENRICHED' if real_pass > np.percentile(null,95) else 'within chance'}")
