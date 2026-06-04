"""
Round 2 over-spot mining (mechanism-grounded). Bet OVER vs OPEN, 2021-2025, FP-controlled.
Report n, over% vs open, vs close, per-season, avg total. Flag spots that beat the close.
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
def c(x): return pd.to_numeric(df[x], errors="coerce") if x in df.columns else pd.Series(np.nan, index=df.index)

# derived
hp, ap = c("home_pace_off_plays"), c("away_pace_off_plays")
df["_pace_max"] = np.maximum(hp, ap); df["_pace_diff"] = (hp - ap).abs(); df["_pace_sum"] = hp + ap
spr = c("spread_open")
fav_epa = np.where(spr < 0, c("home_adj_epa"), c("away_adj_epa"))
df["_fav_epa"] = fav_epa
# one-sided air: best (offense vs opposing pass D weakness)
home_air = c("home_adj_epa") + c("away_adj_epa_allowed")
away_air = c("away_adj_epa") + c("home_adj_epa_allowed")
df["_air_max"] = np.maximum(home_air, away_air)
pmax75 = df["_pace_max"].quantile(0.75); pdiff75 = df["_pace_diff"].quantile(0.75)
fav90 = pd.Series(fav_epa).quantile(0.85); air85 = df["_air_max"].quantile(0.85)
ep = c("expected_plays"); ep66 = ep.quantile(0.66)

CONDS = {
    "fast team present (pace_max top25%)": df["_pace_max"] >= pmax75,
    "pace MISMATCH (diff top25%)": df["_pace_diff"] >= pdiff75,
    "pace mismatch & open<=50": (df["_pace_diff"] >= pdiff75) & (df["total_open"] <= 50),
    "blowout-over: |spr|>=21 & elite fav O": (spr.abs() >= 21) & (pd.Series(fav_epa) >= fav90),
    "blowout-over: |spr|>=24 & elite fav O": (spr.abs() >= 24) & (pd.Series(fav_epa) >= fav90),
    "extreme one-sided air (top15%)": df["_air_max"] >= air85,
    "extreme air & open<=52": (df["_air_max"] >= air85) & (df["total_open"] <= 52),
    "dome(indoors) & fast": (c("wx_indoors") == 1) & (ep >= ep66),
    "both_last_under (form reversion)": (c("home_last_total") < c("home_last_total").median()) &
                                        (c("away_last_total") < c("away_last_total").median()),
    "warm & calm & fast": (c("wx_temp") >= 70) & (c("wx_wind") < 6) & (ep >= ep66),
    "low_total<=48 & fast (known spot)": (df["total_open"] <= 48) & (ep >= ep66),
}

print(f"universe {len(df)} | base OVER {base:.1f}%")
print(f"{'condition':>40}{'n':>6}{'over%':>7}{'roi%':>8}{'vsClose':>8}  per-season")
results = []
for name, mask in CONDS.items():
    m = mask.fillna(False); n = int(m.sum())
    if n < 30:
        print(f"{name:>40}{n:>6}   (thin)"); continue
    b = df[m]; h = int(b["over"].sum())
    bc = b[b.actual_total != b.total_close]; hc = int((bc.actual_total > bc.total_close).sum()); nc = len(bc)
    per = "/".join(f"{100*b['over'][b.season==s].mean():.0f}" if (b.season==s).sum()>=10 else "--" for s in TS)
    vc = 100*hc/nc if nc else 0
    flag = " BEATS-CLOSE" if (100*h/n > 52.4 and vc > 52.4) else ""
    print(f"{name:>40}{n:>6}{100*h/n:>7.1f}{roi(h,n):>8.1f}{vc:>8.1f}  [{per}]{flag}")
    results.append((name, n, abs(100*h/n - base)))

rng = np.random.default_rng(3); arr = df["over"].values
real = sum(1 for _, n, d in results if n >= 40 and d >= 4)
null = [sum(1 for nm, mk in CONDS.items() if mk.fillna(False).sum() >= 40 and
            abs(100*pd.Series(rng.permutation(arr), index=df.index)[mk.fillna(False)].mean() - base) >= 4)
        for _ in range(300)]
null = np.array(null)
print(f"\nFP: real {real} vs null mean {null.mean():.1f}/95th {np.percentile(null,95):.0f} "
      f"=> {'ENRICHED' if real > np.percentile(null,95) else 'within chance'}")
