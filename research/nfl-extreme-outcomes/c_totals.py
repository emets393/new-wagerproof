"""
Avenue G (totals forensics) + H (referee). The wind signal is the headline.
Betting framing for UNDER/OVER at -110, per-season replication, robustness on threshold.
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

# totals outcomes (1=win): bet UNDER wins if total_diff<0; OVER wins if >0; push if ==0
m["under_win"] = np.where(m["total_diff"] < 0, 1.0, np.where(m["total_diff"] > 0, 0.0, np.nan))
m["over_win"] = 1 - m["under_win"]
m["is_outdoor"] = (m["roof"].isin(["outdoors", "open"])).astype(int)
m["big_under"] = (m["total_diff"] <= -21).astype(int)
m["big_over"] = (m["total_diff"] >= 21).astype(int)


def season_bet(label, mask, outcome, price=-110, minn=0):
    sub = m[mask]
    rows = []
    for s in sorted(sub["season"].unique()):
        ss = sub[sub["season"] == s]
        oc = ss[outcome].dropna()
        wins = int((oc == 1).sum()); n = int(oc.isin([0, 1]).sum())
        rows.append(bet_summary(wins, n, str(int(s)), price))
    oc = sub[outcome].dropna()
    wins = int((oc == 1).sum()); n = int(oc.isin([0, 1]).sum())
    allr = bet_summary(wins, n, "ALL", price)
    L(f"\n  >> {label}")
    for r in rows + [allr]:
        L("     " + fmt(r))
    return allr


def describe(label, mask):
    sub = m[mask]; n = len(sub)
    if n == 0:
        L(f"  {label:28s} n=0"); return
    over = (sub["total_diff"] > 0).mean()
    k = int((sub["total_diff"] > 0).sum())
    lo, hi = wilson_ci(k, n)
    L(f"  {label:28s} n={n:4d} over%={over*100:5.1f} CI[{lo*100:4.1f},{hi*100:4.1f}] "
      f"mean_td={sub['total_diff'].mean():+6.2f} mean|miss|={sub['total_miss'].mean():5.2f} "
      f"bigU%={sub['big_under'].mean()*100:4.1f} bigO%={sub['big_over'].mean()*100:4.1f}")


L("="*92); L("AVENUE G — TOTALS FORENSICS"); L("="*92)
L(f"  BASELINE: over%={(m['total_diff']>0).mean()*100:.1f} mean_td={m['total_diff'].mean():+.2f} "
  f"mean|miss|={m['total_miss'].mean():.2f}")

L("\n[G1] MEAN-REVERSION by closing total level:")
for lab, lo, hi in [("very low (<=38)", 0, 38), ("low (38.5-42)", 38.5, 42), ("mid (42.5-46)", 42.5, 46),
                    ("high (46.5-50)", 46.5, 50), ("very high (50.5+)", 50.5, 999)]:
    describe(lab, (m["ou_vegas_line"] >= lo) & (m["ou_vegas_line"] <= hi))

L("\n[G2] WIND dose-response (OUTDOOR games only):")
od = m[m["is_outdoor"] == 1]
L(f"  outdoor n={len(od)}; with wind value: {od['wind_mph'].notna().sum()}")
for lab, lo, hi in [("calm (0-5)", 0, 5), ("light (5-10)", 5, 10), ("mod (10-15)", 10, 15),
                    ("strong (15-20)", 15, 20), ("gale (20+)", 20, 999)]:
    describe(f"wind {lab}", (m["is_outdoor"] == 1) & (m["wind_mph"] >= lo) & (m["wind_mph"] < hi))

L("\n[G3] BET THE UNDER at wind>=threshold (outdoor only), per-season + robustness:")
for thr in [12, 13, 14, 15, 16, 18, 20]:
    season_bet(f"UNDER, outdoor wind>={thr}mph", (m["is_outdoor"] == 1) & (m["wind_mph"] >= thr), "under_win")

L("\n[G4] PRECIPITATION (outdoor):")
describe("precip_pct>=0.5 outdoor", (m["is_outdoor"] == 1) & (m["precipitation_pct"] >= 0.5))
describe("precip_pct>=0.7 outdoor", (m["is_outdoor"] == 1) & (m["precipitation_pct"] >= 0.7))
describe("any precip_type outdoor", (m["is_outdoor"] == 1) & (m["precipitation_type"].notna()))
L("\n[G5] TEMPERATURE (outdoor):")
for lab, lo, hi in [("freezing (<=32)", -50, 32), ("cold (33-45)", 33, 45), ("mild (46-65)", 46, 65),
                    ("warm (66-80)", 66, 80), ("hot (81+)", 81, 200)]:
    describe(f"temp {lab}", (m["is_outdoor"] == 1) & (m["temp_f"] >= lo) & (m["temp_f"] <= hi))

L("\n[G6] ROOF type:")
for r in ["dome", "closed", "outdoors", "open"]:
    describe(f"roof={r}", m["roof"] == r)
describe("dome+closed (indoor)", m["dome_closed"] == 1)
describe("outdoor+open", m["is_outdoor"] == 1)
season_bet("OVER in domes/closed", m["dome_closed"] == 1, "over_win")

L("\n[G7] PACE / scheme (does fast pace -> over?):")
m["pace_sum"] = m["home_off_plays_per_game_s2d"] + m["away_off_plays_per_game_s2d"]
m["explosive_sum"] = (m["home_off_explosive_pass_s2d"] + m["away_off_explosive_pass_s2d"])
for col, lab in [("pace_sum", "combined plays/game"), ("explosive_sum", "combined explosive pass")]:
    q = m[col].quantile([.25, .75])
    describe(f"{lab} top quartile", m[col] >= q.iloc[1])
    describe(f"{lab} bot quartile", m[col] <= q.iloc[0])

L("\n[G8] SCORING ENVIRONMENT (PR sum, ppd sum vs total):")
m["ppd_sum"] = m["home_off_ppd_s2d"] + m["away_off_ppd_s2d"]
describe("ppd_sum top quartile", m["ppd_sum"] >= m["ppd_sum"].quantile(.75))
describe("ppd_sum bot quartile", m["ppd_sum"] <= m["ppd_sum"].quantile(.25))

L("\n"+"="*92); L("AVENUE H — REFEREE (ref_total_pts_avg)"); L("="*92)
L(f"  ref_total_pts_avg: nn={m['ref_total_pts_avg'].notna().sum()} "
  f"mean={m['ref_total_pts_avg'].mean():.1f} sd={m['ref_total_pts_avg'].std():.1f} "
  f"range=[{m['ref_total_pts_avg'].min():.0f},{m['ref_total_pts_avg'].max():.0f}]")
L("  CAVEAT: verify leak-safety (is this career-to-date or full-sample average?)")
for lab, lo, hi in [("low ref (<=43)", 0, 43), ("mid (43-46)", 43, 46), ("high (46-49)", 46, 49),
                    ("very high (49+)", 49, 999)]:
    describe(f"ref {lab}", (m["ref_total_pts_avg"] >= lo) & (m["ref_total_pts_avg"] < hi))
L(f"\n  corr(ref_total_pts_avg, actual_total) = "
  f"{m[['ref_total_pts_avg','actual_total']].dropna().corr().iloc[0,1]:.3f}")
L(f"  corr(ref_total_pts_avg, ou_vegas_line) = "
  f"{m[['ref_total_pts_avg','ou_vegas_line']].dropna().corr().iloc[0,1]:.3f}  (is it already in the line?)")
L(f"  corr(ref_total_pts_avg, total_diff) = "
  f"{m[['ref_total_pts_avg','total_diff']].dropna().corr().iloc[0,1]:.3f}  (residual signal?)")
# bet OVER when high-ref crew
season_bet("OVER when ref_total_pts_avg>=48", m["ref_total_pts_avg"] >= 48, "over_win")
season_bet("UNDER when ref_total_pts_avg<=42", m["ref_total_pts_avg"] <= 42, "under_win")
