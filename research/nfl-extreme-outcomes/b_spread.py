"""
Avenues A (spread-miss magnitude), B (direction / ATS cover edges),
C (power-rating vs spread divergence). Betting framing with n, hit, ROI, CI, per-season.
"""
import os, sys
import numpy as np
import pandas as pd
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from stats_helpers import wilson_ci, bet_summary, fmt

pd.set_option("display.width", 200)
DATA = os.path.join(os.path.dirname(os.path.abspath(__file__)), "data")
m = pd.read_parquet(os.path.join(DATA, "master.parquet"))
L = print

# ---- outcome columns (1=win,0=loss,NaN=push) at -110 ----
m["ats_home"] = np.where(m["spread_diff"] > 0, 1.0, np.where(m["spread_diff"] < 0, 0.0, np.nan))
m["ats_away"] = 1 - m["ats_home"]
m["ats_fav"] = np.where(m["home_fav"] == 1, m["ats_home"], m["ats_away"])
m["ats_dog"] = 1 - m["ats_fav"]
m["blowup"] = (m["spread_miss"] >= 21).astype(int)
m["abs_spread"] = m["home_spread"].abs()
m["pr_diff"] = m["home_predictive_pr"] - m["away_predictive_pr"]


def magnitude(label, mask):
    sub = m[mask]
    n = len(sub)
    if n == 0:
        L(f"  {label:34s} n=0"); return
    mm = sub["spread_miss"].mean()
    bu = sub["blowup"].mean(); k = int(sub["blowup"].sum())
    lo, hi = wilson_ci(k, n)
    L(f"  {label:34s} n={n:4d}  mean|miss|={mm:5.2f}  blowup%={bu*100:5.1f} "
      f"CI[{lo*100:4.1f},{hi*100:4.1f}]")


def season_table(label, mask, outcome, price=-110):
    sub = m[mask]
    L(f"\n  >> {label}  (price {price})")
    rows = []
    for s in sorted(sub["season"].unique()):
        ss = sub[sub["season"] == s]
        oc = ss[outcome].dropna()
        wins = int((oc == 1).sum()); n = int(oc.isin([0, 1]).sum())
        rows.append(bet_summary(wins, n, str(int(s)), price))
    oc = sub[outcome].dropna()
    wins = int((oc == 1).sum()); n = int(oc.isin([0, 1]).sum())
    allr = bet_summary(wins, n, "ALL", price)
    for r in rows + [allr]:
        L("     " + fmt(r))
    return allr


# ===================================================================
L("="*88); L("AVENUE A — SPREAD-MISS MAGNITUDE (variance): blow-up rate by condition")
L("="*88)
L(f"  BASELINE all games: mean|miss|={m['spread_miss'].mean():.2f}  blowup%={m['blowup'].mean()*100:.1f}")
L("\n-- by spread size --")
for lab, lo, hi in [("pick'em (0-1.5)", 0, 1.5), ("small (2-3)", 2, 3), ("med (3.5-6.5)", 3.5, 6.5),
                    ("big (7-9.5)", 7, 9.5), ("huge (10-13.5)", 10, 13.5), ("massive (14+)", 14, 99)]:
    magnitude(lab, (m["abs_spread"] >= lo) & (m["abs_spread"] <= hi))
L("\n-- home vs away favorite --")
magnitude("home favorite", (m["home_fav"] == 1) & (m["abs_spread"] > 0))
magnitude("away favorite", (m["home_fav"] == 0) & (m["abs_spread"] > 0))
L("\n-- divisional / conference --")
magnitude("divisional (div_game=1)", m["div_game"] == 1)
magnitude("non-divisional", m["div_game"] == 0)
L("\n-- rest / schedule spot --")
magnitude("Thursday game", m["is_thu"] == 1)
magnitude("Monday game", m["is_mon"] == 1)
magnitude("home off bye (rest>=10)", m["home_rest"] >= 10)
magnitude("away off bye (rest>=10)", m["away_rest"] >= 10)
magnitude("either short rest (<=4)", (m["home_rest"] <= 4) | (m["away_rest"] <= 4))
L("\n-- QB --")
magnitude("any backup QB (modal def)", m["any_backup_qb"] == 1)
magnitude("no backup QB", m["any_backup_qb"] == 0)
L("\n-- PR mismatch magnitude (|pr_diff|) --")
for lab, lo, hi in [("close (0-3)", 0, 3), ("mod (3-7)", 3, 7), ("big (7-12)", 7, 12), ("huge (12+)", 12, 99)]:
    magnitude(lab, (m["pr_diff"].abs() >= lo) & (m["pr_diff"].abs() < hi))
L("\n-- week bucket --")
magnitude("early (wk1-4)", m["week"].between(1, 4))
magnitude("mid (wk5-13)", m["week"].between(5, 13))
magnitude("late (wk14-18)", m["week"].between(14, 18))
magnitude("playoffs (wk19+)", m["week"] >= 19)
L("\n-- weather --")
magnitude("wind >= 15mph", m["wind_mph"] >= 15)
magnitude("wind >= 20mph", m["wind_mph"] >= 20)
magnitude("dome/closed", m["dome_closed"] == 1)
magnitude("primetime", m["primetime"] == 1)

# ===================================================================
L("\n"+"="*88); L("AVENUE B — DIRECTION / ATS COVER EDGES (per-season replication)")
L("="*88)
# The headline prior: +7.5..+9.5 dogs cover. Test all bands, both sides.
L("\n[B1] DOG cover rate by dog spread band (back the dog ATS):")
for lab, lo, hi in [("+1 to +2.5", 1, 2.5), ("+3 to +6.5", 3, 6.5), ("+7 to +7", 7, 7),
                    ("+7.5 to +9.5", 7.5, 9.5), ("+10 to +13.5", 10, 13.5), ("+14+", 14, 99)]:
    mask = (m["abs_spread"] >= lo) & (m["abs_spread"] <= hi)
    season_table(f"DOG {lab}", mask, "ats_dog")
L("\n[B1b] restrict +7.5..+9.5 dogs to 2023-25 (brief's window):")
season_table("DOG +7.5..9.5 (2023-25)", (m["abs_spread"].between(7.5, 9.5)) & (m["season"] >= 2023), "ats_dog")

L("\n[B2] HOME DOG vs ROAD DOG (does venue matter for the dog cover):")
season_table("HOME dogs (all)", (m["home_fav"] == 0) & (m["abs_spread"] > 0), "ats_dog")
season_table("ROAD dogs (all)", (m["home_fav"] == 1) & (m["abs_spread"] > 0), "ats_dog")
season_table("HOME dog +7.5..9.5", (m["home_fav"] == 0) & m["abs_spread"].between(7.5, 9.5), "ats_dog")
season_table("ROAD dog +7.5..9.5", (m["home_fav"] == 1) & m["abs_spread"].between(7.5, 9.5), "ats_dog")

L("\n[B3] ROAD FAVORITE ATS (is the road favorite a trap?):")
season_table("Road favorites (all)", (m["home_fav"] == 0) & (m["abs_spread"] > 0) & (m["home_away_favorite"]==0), "ats_fav")
# road fav = away team favored
season_table("Away-team favorites ATS", (m["home_spread"] > 0), "ats_away")
season_table("Big away favorites (>=7) ATS", (m["home_spread"] >= 7), "ats_away")

L("\n[B4] SHORT-REST / Thursday favorites (lay the points on short rest?):")
season_table("Favorite on Thursday ATS", (m["is_thu"] == 1), "ats_fav")
season_table("Heavy fav (>=7) divisional ATS", (m["abs_spread"] >= 7) & (m["div_game"] == 1), "ats_fav")
season_table("Divisional DOG ATS", (m["div_game"] == 1) & (m["abs_spread"] >= 3), "ats_dog")

# ===================================================================
L("\n"+"="*88); L("AVENUE C — POWER-RATING vs SPREAD DIVERGENCE")
L("="*88)
# Estimate HFA from data, build PR-implied margin, divergence = market vs PR
HFA = m["actual_margin"].mean()
L(f"  mean home margin (HFA proxy) = {HFA:.2f}")
m["pr_margin"] = m["pr_diff"] + HFA               # PR-implied home margin
m["mkt_margin"] = -m["home_spread"]               # market-implied home margin
m["diverge"] = m["mkt_margin"] - m["pr_margin"]   # >0: market higher on home than PR
L(f"  corr(pr_margin, actual_margin)  = {np.corrcoef(m['pr_margin'], m['actual_margin'])[0,1]:.3f}")
L(f"  corr(mkt_margin, actual_margin) = {np.corrcoef(m['mkt_margin'], m['actual_margin'])[0,1]:.3f}")
L(f"  divergence: mean={m['diverge'].mean():.2f} sd={m['diverge'].std():.2f} "
  f"p90={m['diverge'].quantile(.9):.2f} p10={m['diverge'].quantile(.1):.2f}")
# Rule: when PR likes home more than market (diverge<<0), back home ATS; when market likes home more (diverge>>0), back away
L("\n[C1] Back the PR side when |divergence| is large (does PR beat the closing line ATS?):")
for thr in [2, 3, 4, 5]:
    # PR likes home more -> back home ; PR likes away more -> back away
    home_side = m["diverge"] <= -thr   # market too low on home vs PR -> PR backs home
    away_side = m["diverge"] >= thr    # market too high on home vs PR -> PR backs away
    out = pd.concat([m.loc[home_side, "ats_home"], m.loc[away_side, "ats_away"]]).dropna()
    wins = int((out == 1).sum()); n = int(out.isin([0, 1]).sum())
    L("   " + fmt(bet_summary(wins, n, f"|diverge|>={thr}: back PR side", -110)))
L("\n[C2] Does divergence predict BLOW-UPS (variance)?")
for thr in [3, 5, 7]:
    hi = m[m["diverge"].abs() >= thr]; lo = m[m["diverge"].abs() < thr]
    L(f"   |diverge|>={thr}: blowup%={hi['blowup'].mean()*100:.1f} (n={len(hi)}) vs "
      f"<{thr}: {lo['blowup'].mean()*100:.1f} (n={len(lo)})")
L("\n[C3] When PR & market disagree on the FAVORITE, who wins SU?")
# games where PR favorite != market favorite
m["mkt_home_fav"] = (m["home_spread"] < 0)
m["pr_home_fav"] = (m["pr_margin"] > 0)
disagree = m[m["mkt_home_fav"] != m["pr_home_fav"]]
L(f"   games where PR & market pick different favorites: n={len(disagree)}")
if len(disagree):
    # did the PR-favorite win SU?
    pr_fav_won = np.where(disagree["pr_home_fav"], disagree["actual_margin"] > 0,
                          disagree["actual_margin"] < 0)
    L(f"   PR-favorite won SU: {pr_fav_won.mean()*100:.1f}%  (mkt-favorite won {100-pr_fav_won.mean()*100:.1f}%)")
