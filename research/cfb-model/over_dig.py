"""
Deep dig for OVER trends in CFB (bet OVER vs OPEN, 2021-2025, honest).
Dimensions not yet tested: conference, early-season, team over-tendency, extreme tempo,
good-offense+bad-defense (proper), total-line level. Data-driven (rank, don't assume) + FP control.
"""
import os
import numpy as np
import pandas as pd

HERE = os.path.dirname(os.path.abspath(__file__))
gm = pd.read_parquet(os.path.join(HERE, "data", "model_games.parquet"))
df = gm[gm["total_open"].notna() & gm["actual_total"].notna() & (gm["season"] >= 2021)].copy()
df = df[df["actual_total"] != df["total_open"]].reset_index(drop=True)
df["over"] = (df["actual_total"] > df["total_open"]).astype(int)
base = df["over"].mean() * 100
TS = [2021, 2022, 2023, 2024, 2025]
def roi(h, n): return (h * 0.909 - (n - h)) / n * 100 if n else 0.0
def cnum(x): return pd.to_numeric(df[x], errors="coerce") if x in df.columns else pd.Series(np.nan, index=df.index)
print(f"universe {len(df)} | base OVER {base:.1f}%")

# ---- 1) CONFERENCE over-rates (data-driven rank) ----
print("\n=== CONFERENCE over-rate (home perspective; n>=80) ===")
rows = []
for conf in pd.concat([df["homeConference"], df["awayConference"]]).dropna().unique():
    m = (df["homeConference"] == conf) | (df["awayConference"] == conf)
    n = int(m.sum())
    if n >= 80:
        rows.append((conf, n, 100 * df["over"][m].mean()))
for conf, n, ov in sorted(rows, key=lambda x: -x[2]):
    mm = (df["homeConference"] == conf) | (df["awayConference"] == conf)
    per = "/".join(f"{100*df['over'][mm&(df.season==s)].mean():.0f}" if (mm&(df.season==s)).sum()>=10 else "--" for s in TS)
    flag = " <<" if abs(ov - base) >= 4 else ""
    print(f"  {conf:<22} n={n:<4} over={ov:4.1f}%  [{per}]{flag}")

# ---- 2) BOTH teams in high-scoring conf (top-3 by over-rate) ----
top_confs = [c for c, n, ov in sorted(rows, key=lambda x: -x[2])[:4]]
print(f"\ntop over-conferences: {top_confs}")

# ---- team trailing over-tendency (leak-safe rolling) ----
# build per-team chronological over outcomes from this universe
tg = pd.concat([
    df[["season", "week", "homeTeam", "over"]].rename(columns={"homeTeam": "team"}),
    df[["season", "week", "awayTeam", "over"]].rename(columns={"awayTeam": "team"}),
]).sort_values(["team", "season", "week"])
tg["team_over_tend"] = (tg.groupby(["team", "season"])["over"]
                        .transform(lambda s: s.shift(1).expanding().mean()))
# map back: a game is high-over-tendency if BOTH teams trend over
ot = tg.drop_duplicates(["season", "week", "team"])[["season", "week", "team", "team_over_tend"]]
df = df.merge(ot.rename(columns={"team": "homeTeam", "team_over_tend": "home_ot"}),
              on=["season", "week", "homeTeam"], how="left")
df = df.merge(ot.rename(columns={"team": "awayTeam", "team_over_tend": "away_ot"}),
              on=["season", "week", "awayTeam"], how="left")

# ---- 3) condition library ----
ep = cnum("expected_plays"); epd = ep.quantile(0.90)
o_hi = pd.concat([cnum("home_adj_epa"), cnum("away_adj_epa")]).quantile(0.70)
d_weak = pd.concat([cnum("home_adj_epa_allowed"), cnum("away_adj_epa_allowed")]).quantile(0.70)
CONDS = {
    "both_top_over_conf": df["homeConference"].isin(top_confs) & df["awayConference"].isin(top_confs),
    "early_wk1-3": cnum("week") <= 3,
    "early_wk1-4": cnum("week") <= 4,
    "extreme_tempo(top10%)": ep >= epd,
    "both_good_O_and_weak_D": (cnum("home_adj_epa") >= o_hi) & (cnum("away_adj_epa") >= o_hi) &
                              (cnum("home_adj_epa_allowed") >= d_weak) & (cnum("away_adj_epa_allowed") >= d_weak),
    "both_teams_over_machines(>0.55)": (df["home_ot"] >= 0.55) & (df["away_ot"] >= 0.55),
    "low_total_open<=44": df["total_open"] <= 44,
    "low_total<=44 & fast": (df["total_open"] <= 47) & (ep >= ep.quantile(0.75)),
    "early & both_good_O": (cnum("week") <= 4) & (cnum("home_adj_epa") >= o_hi) & (cnum("away_adj_epa") >= o_hi),
    "early & top_over_conf": (cnum("week") <= 4) & (df["homeConference"].isin(top_confs) | df["awayConference"].isin(top_confs)),
}
print("\n=== OVER condition scan (bet OVER vs open) ===")
print(f"{'condition':>34}{'n':>6}{'over%':>7}{'roi%':>8}{'avgTot':>8}  per-season")
results = []
for name, mask in CONDS.items():
    m = mask.fillna(False); n = int(m.sum())
    if n < 25:
        print(f"{name:>34}{n:>6}   (thin)"); continue
    ov = 100 * df["over"][m].mean(); h = int(df["over"][m].sum())
    per = "/".join(f"{100*df['over'][m&(df.season==s)].mean():.0f}" if (m&(df.season==s)).sum()>=10 else "--" for s in TS)
    print(f"{name:>34}{n:>6}{ov:>7.1f}{roi(h,n):>8.1f}{df['actual_total'][m].mean():>8.1f}  [{per}]")
    results.append((name, n, abs(ov - base)))

# FP control
rng = np.random.default_rng(2); ov_arr = df["over"].values
real = sum(1 for _, n, d in results if n >= 40 and d >= 4)
null = []
for _ in range(300):
    sh = pd.Series(rng.permutation(ov_arr), index=df.index)
    null.append(sum(1 for name, mask in CONDS.items()
                    if mask.fillna(False).sum() >= 40 and abs(100*sh[mask.fillna(False)].mean() - base) >= 4))
null = np.array(null)
print(f"\nFP: real {real} vs null mean {null.mean():.1f}/95th {np.percentile(null,95):.0f} "
      f"=> {'ENRICHED' if real > np.percentile(null,95) else 'within chance'}")
