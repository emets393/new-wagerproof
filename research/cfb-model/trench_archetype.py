"""
TRENCH mismatch (sharp's #1 factor) + ARCHETYPE matchups, as ATS/totals spots vs OPEN, 2021-25, FP-controlled.
Trench = run-block (line_yards) + pass-protection/pass-rush (sacks from box, havoc). Extreme mismatch -> cover?
Archetype = offensive style cluster vs defensive style cluster; test specific clashes.
"""
import os
import numpy as np
import pandas as pd
from sklearn.cluster import KMeans

HERE = os.path.dirname(os.path.abspath(__file__))
gm = pd.read_parquet(os.path.join(HERE, "data", "model_games.parquet"))
df = gm[gm.spread_open.notna() & gm.actual_margin.notna() & (gm.season >= 2021)].copy()
df["home_cover"] = (df.actual_margin + df.spread_open) > 0
df["over"] = (df.actual_total > df.total_open).astype(int)
TS = [2021, 2022, 2023, 2024, 2025]
def roi(h, n): return (h * 0.909 - (n - h)) / n * 100 if n else 0.0
def cn(x): return pd.to_numeric(df[x], errors="coerce") if x in df.columns else pd.Series(np.nan, index=df.index)

# ---- TRENCH advantage ----
# home offense run block vs away run defense + home pass pro (low havoc faced) vs away pass rush
h_run = cn("home_adj_line_yards") - cn("away_adj_line_yards_allowed")
a_run = cn("away_adj_line_yards") - cn("home_adj_line_yards_allowed")
h_pass = cn("away_def_havoc") - cn("home_off_havoc")   # away pass-rush vs home pass-pro (lower havoc faced = better)
a_pass = cn("home_def_havoc") - cn("away_off_havoc")
df["home_trench"] = (h_run - a_run)   # net run-block edge to home
df["home_trench_pass"] = -(cn("away_def_havoc") - cn("home_def_havoc"))  # relative pressure generation
tr = df["home_trench"]
print(f"universe {len(df)} | home cover base {100*df.home_cover.mean():.1f}%")
def ats(name, mask, side):
    b = df[mask.fillna(False)]; n = len(b)
    if n < 30: print(f"  {name:<44} n={n} thin"); return None
    hit = b.home_cover if side == "home" else ~b.home_cover; h = int(hit.sum())
    per = "/".join(f"{100*(b.home_cover[b.season==s] if side=='home' else ~b.home_cover[b.season==s]).mean():.0f}" if (b.season==s).sum()>=8 else "--" for s in TS)
    print(f"  {name:<44} n={n:<4} ATS={100*h/n:.1f}% roi={roi(h,n):+.1f}  [{per}]")
    return abs(100*h/n - 50)

print("\n=== TRENCH MISMATCH (sharp's #1 factor) ===")
ats("home big run-block edge (top20%) -> home", tr >= tr.quantile(0.80), "home")
ats("away big run-block edge (top20%) -> away", tr <= tr.quantile(0.20), "away")
ats("home big trench edge & home favorite", (tr >= tr.quantile(0.80)) & (df.spread_open < 0), "home")
ats("home dominant DL (def havoc top20%) -> home", cn("home_def_havoc") >= cn("home_def_havoc").quantile(0.80), "home")

# ---- ARCHETYPE clusters ----
off_cols = ["home_adj_epa", "home_adj_rushing_epa", "home_adj_passing_epa", "home_adj_explosiveness", "home_pass_rate"]
off_cols = [c for c in off_cols if c in df.columns]
print("\n=== ARCHETYPE matchups ===")
# build team-season offensive style from home cols (use both home+away rows for fitting)
feat = df[["home_adj_epa", "home_adj_explosiveness", "home_pace_off_plays"]].dropna()
if "home_pass_rate" in df.columns:
    pass
fit = df[["home_adj_rushing_epa", "home_adj_passing_epa", "home_adj_explosiveness"]].dropna()
km = KMeans(n_clusters=4, n_init=5, random_state=0).fit(fit)
df.loc[fit.index, "h_arch"] = km.labels_
deff = df[["away_adj_epa_allowed", "away_adj_explosiveness_allowed", "away_def_havoc"]].dropna()
kmd = KMeans(n_clusters=4, n_init=5, random_state=0).fit(deff)
df.loc[deff.index, "a_darch"] = kmd.labels_
print("  offense-archetype x defense-archetype home-cover% (n>=40):")
res = []
for oa in range(4):
    for da in range(4):
        m = (df.h_arch == oa) & (df.a_darch == da)
        n = int(m.sum())
        if n >= 40:
            cov = 100 * df.home_cover[m].mean()
            res.append((oa, da, n, cov))
for oa, da, n, cov in sorted(res, key=lambda x: -abs(x[3] - 50))[:6]:
    print(f"    off{oa} vs def{da}: n={n} home-cover {cov:.1f}%")
