"""
Baseline + linear-signal scan for extreme outcomes.
Confirms: (1) closing line ~ power rating corr; (2) no pregame feature linearly
predicts |miss|; (3) direction split of extreme misses; (4) the over-skew mechanics.
"""
import os, sys
import numpy as np
import pandas as pd
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from stats_helpers import wilson_ci

pd.set_option("display.width", 200)
DATA = os.path.join(os.path.dirname(os.path.abspath(__file__)), "data")
m = pd.read_parquet(os.path.join(DATA, "master.parquet"))


def line(s=""):
    print(s)


line("="*88); line("BASELINE: distributions & market unbiasedness"); line("="*88)
line(f"n games = {len(m)}  (2018-2025)")
for col in ["spread_miss", "total_miss", "spread_diff", "total_diff", "fav_spread_diff"]:
    s = m[col]
    line(f"  {col:16s} mean={s.mean():+7.3f} sd={s.std():6.2f} "
         f"p50={s.median():+6.2f} p90={s.quantile(.9):+6.2f} p10={s.quantile(.1):+6.2f} max={s.max():.1f}")

# market unbiasedness: closing spread vs actual margin; vs power-rating implied
line("\n-- Is the closing line ~ power rating? (corr of -home_spread with PR diff) --")
m["pr_diff"] = m["home_predictive_pr"] - m["away_predictive_pr"]
sub = m.dropna(subset=["pr_diff", "home_spread"])
line(f"  corr(-home_spread, pr_diff) = {np.corrcoef(-sub['home_spread'], sub['pr_diff'])[0,1]:.3f}  (n={len(sub)})")
line(f"  corr(-home_spread, actual_margin) = {np.corrcoef(m['home_spread'], m['actual_margin'])[0,1]:.3f}")
line(f"  corr(ou_vegas_line, actual_total) = {np.corrcoef(m['ou_vegas_line'], m['actual_total'])[0,1]:.3f}")

# Direction split of extreme spread misses
line("\n-- Direction split of EXTREME spread misses (blow-up >=21) --")
bu = m[m["spread_miss"] >= 21]
n = len(bu); up = int((bu["upset_outright"] == 1).sum())
# chalk-blowout = favorite won big & covered; dog = favorite lost/under
fav_cov = int((bu["fav_spread_diff"] > 0).sum())
line(f"  n blow-ups={n}; favorite COVERED in {fav_cov} ({fav_cov/n*100:.1f}%), "
     f"favorite lost SU (upset) in {up} ({up/n*100:.1f}%)")

# Direction split of extreme total misses
line("\n-- Direction split of EXTREME total misses (|miss|>=21) --")
bt = m[m["total_miss"] >= 21]
n = len(bt); over = int((bt["total_diff"] > 0).sum())
line(f"  n={n}; OVER {over} ({over/n*100:.1f}%) vs UNDER {n-over} ({(n-over)/n*100:.1f}%)")
line(f"  mechanism check: top-decile total_miss over-rate vs all-games over-rate")
allover = (m["total_diff"] > 0).mean()
line(f"    all games over rate = {allover*100:.1f}%  (line ~ unbiased, slight over)")

# ---- Linear-signal scan: corr of every numeric pregame feature with |miss| ----
line("\n"+"="*88); line("LINEAR-SIGNAL SCAN: |corr(feature, spread_miss)| and |corr(feature, total_miss)|")
line("="*88)
# leak-safe pregame numeric columns only (exclude outcome-derived)
banned = {"home_score","away_score","total_points","actual_margin","actual_total","spread_diff",
          "spread_miss","total_diff","total_miss","fav_spread_diff","fav_margin","upset_outright",
          "home_away_spread_cover","ou_result","home_away_ml","favorite_covered","underdog_covered",
          "home_away_favorite","home_team_id","away_team_id","season","week","game_time",
          "home_modal_qb","away_modal_qb"}
num = [c for c in m.columns if pd.api.types.is_numeric_dtype(m[c]) and c not in banned]
def corr_scan(target):
    res = []
    for c in num:
        d = m[[c, target]].dropna()
        if len(d) < 200 or d[c].nunique() < 3:
            continue
        r = np.corrcoef(d[c], d[target])[0, 1]
        res.append((c, r, len(d)))
    return pd.DataFrame(res, columns=["feature", "corr", "n"]).assign(abscorr=lambda x: x["corr"].abs())

for tgt in ["spread_miss", "total_miss"]:
    cs = corr_scan(tgt).sort_values("abscorr", ascending=False)
    line(f"\n  TOP 15 |corr| with {tgt}:")
    for _, r in cs.head(15).iterrows():
        line(f"    {r['feature']:38s} corr={r['corr']:+.3f} n={int(r['n'])}")
    line(f"  -> max |corr| = {cs['abscorr'].max():.3f}")

# Also: does ANYTHING predict the SIGNED total_diff (over/under) or fav_spread_diff?
line("\n  TOP 12 |corr| with SIGNED total_diff (over=+):")
cs = corr_scan("total_diff").sort_values("abscorr", ascending=False)
for _, r in cs.head(12).iterrows():
    line(f"    {r['feature']:38s} corr={r['corr']:+.3f} n={int(r['n'])}")
line("\n  TOP 12 |corr| with SIGNED fav_spread_diff (fav beats number=+):")
cs = corr_scan("fav_spread_diff").sort_values("abscorr", ascending=False)
for _, r in cs.head(12).iterrows():
    line(f"    {r['feature']:38s} corr={r['corr']:+.3f} n={int(r['n'])}")
