"""
Stress-test the one live DK finding: the more-JUICED closing spread side covers ~53.5%.
Crux: does juice carry cover info BEYOND the number? (control for the spread)
Plus: key-number mechanism, favorite/dog split, both-minus vs plus-money, and the
line-shopping framing (flat -110 vs paying the actual juice).
"""
import os, sys
import numpy as np
import pandas as pd
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from stats_helpers import wilson_ci, bet_summary, fmt

DATA = os.path.join(os.path.dirname(os.path.abspath(__file__)), "data")
load = lambda n: pd.read_parquet(os.path.join(DATA, f"{n}.parquet"))
L = print
oh = load("odds_hist"); tm = load("team_mapping"); master = load("master")
name2ab = dict(zip(tm["team_name"], tm["Team Abbrev"]))
dk = oh[oh.book == "draftkings"].copy()
dk["snap_ts"] = pd.to_datetime(dk["snap_ts"], utc=True); dk["commence_time"] = pd.to_datetime(dk["commence_time"], utc=True)
dk = dk[dk["snap_ts"] < dk["commence_time"]]
dk["home_ab"] = dk["home_team"].map(name2ab); dk["away_ab"] = dk["away_team"].map(name2ab)
imp = lambda o: np.where(np.asarray(o, float) < 0, -np.asarray(o, float)/(-np.asarray(o, float)+100), 100/(np.asarray(o, float)+100))
ap = lambda p: (100.0/-p) if p < 0 else (p/100.0)

key = ["season", "home_ab", "away_ab"]
rows = []
for k, gg in dk.groupby(key):
    cl = gg.sort_values("snap_ts").iloc[-1]
    rows.append(dict(zip(key, k)) | dict(close_pt=cl["spread_home"], close_hp=cl["spread_home_price"],
                                         close_ap=cl["spread_away_price"]))
d = pd.DataFrame(rows).dropna(subset=["close_hp", "close_ap"])
d["close_lean"] = imp(d["close_hp"]) - imp(d["close_ap"])   # >0 home is juiced (expensive) side
m = master[key + ["spread_diff", "home_spread"]]
g = d.merge(m, on=key, how="inner")
g["home_cover"] = np.where(g["spread_diff"] > 0, 1.0, np.where(g["spread_diff"] < 0, 0.0, np.nan))
g["abs_spread"] = g["home_spread"].abs()
g["home_juiced"] = g["close_lean"] > 0
g["juiced_is_fav"] = ((g["home_juiced"]) & (g["home_spread"] < 0)) | ((~g["home_juiced"]) & (g["home_spread"] > 0))
g["both_minus"] = (g["close_hp"] < 0) & (g["close_ap"] < 0)


def back_juiced(sub, label, flat=False):
    s = sub[sub["close_lean"].abs() > 0.005]   # require a real lean
    won = np.where(s["close_lean"] > 0, s["home_cover"], 1 - s["home_cover"])
    price = np.where(s["close_lean"] > 0, s["close_hp"], s["close_ap"])
    ws = pd.Series(won, index=s.index).dropna(); k = int((ws == 1).sum()); n = int(ws.isin([0, 1]).sum())
    lo, hi = wilson_ci(k, n)
    if flat:
        prof = np.where(ws == 1, 100/110, -1.0); roi = prof.sum()/n if n else np.nan
        tag = "ROI@-110"
    else:
        pr = price[~np.isnan(won)]; prof = np.where(ws == 1, [ap(p) for p in pr], -1.0)
        roi = prof.sum()/n if n else np.nan; tag = "ROI@actual"
    L(f"  {label:40s} n={n:4d} cover%={ (k/n*100 if n else 0):5.1f} CI[{lo*100:4.1f},{hi*100:4.1f}] {tag}={roi*100:+5.1f}%")
    return k, n


L("="*92); L("CRUX — does juice add cover info BEYOND the number? (within same spread)"); L("="*92)
L("  For each spread value, do home-juiced games cover more than home-non-juiced games?")
rows = []
for sp, sub in g.dropna(subset=["home_cover"]).groupby("home_spread"):
    if len(sub) < 30:
        continue
    jh = sub[sub["close_lean"] > 0.005]["home_cover"]
    nj = sub[sub["close_lean"] < -0.005]["home_cover"]
    if len(jh) >= 12 and len(nj) >= 12:
        rows.append((sp, len(jh), jh.mean(), len(nj), nj.mean(), jh.mean()-nj.mean()))
r = pd.DataFrame(rows, columns=["spread","n_hj","cov_hj","n_nj","cov_nj","diff"])
L(f"  spreads with enough both-way data: {len(r)}")
L(f"  mean(home-cover | home-juiced) - mean(home-cover | home-not-juiced), pooled within-spread:")
if len(r):
    wmean = np.average(r["diff"], weights=(r["n_hj"]+r["n_nj"]))
    L(f"    weighted mean diff = {wmean*100:+.1f}pp   (positive => juice adds cover info beyond the number)")
    for _, row in r.sort_values("spread").iterrows():
        L(f"    spread {row['spread']:+5.1f}: juiced-home cover {row['cov_hj']*100:4.1f}% (n={int(row['n_hj'])}) vs "
          f"non-juiced {row['cov_nj']*100:4.1f}% (n={int(row['n_nj'])})  diff={row['diff']*100:+5.1f}pp")

L("\n"+"="*92); L("KEY-NUMBER mechanism — is the juice-cover effect concentrated near 3 / 7?"); L("="*92)
key_nums = g["abs_spread"].isin([2.5, 3.0, 3.5, 6.5, 7.0, 7.5])
back_juiced(g[key_nums], "back juiced side @ key numbers (2.5-3.5,6.5-7.5)")
back_juiced(g[~key_nums], "back juiced side @ non-key numbers")

L("\n"+"="*92); L("FAVORITE vs DOG — is the juiced side better when it's the favorite or the dog?"); L("="*92)
back_juiced(g[g["juiced_is_fav"]], "back juiced side WHEN it's the favorite")
back_juiced(g[~g["juiced_is_fav"]], "back juiced side WHEN it's the dog")

L("\n"+"="*92); L("PRICE TYPE — standard both-minus juice vs plus-money spreads"); L("="*92)
back_juiced(g[g["both_minus"]], "back juiced side (both-minus prices)")
back_juiced(g[~g["both_minus"]], "back juiced side (a plus-money side)")

L("\n"+"="*92); L("LINE-SHOPPING framing — same bet at flat -110 vs paying DK's juice"); L("="*92)
back_juiced(g, "back juiced side @ DK actual juice", flat=False)
back_juiced(g, "back juiced side IF bought at -110 elsewhere", flat=True)
