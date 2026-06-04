"""
DraftKings-only specific-number analysis (spreads & totals). NO consensus.
Build DK per-game open/close spread+total (+prices), join outcomes. Then GRANULAR (exact half-points):
  1. actual margin & total distributions (which numbers are 'key')
  2. cover/over rate by EXACT closing number
  3. key-number CROSSING (line moved across 3/7/10/etc.)
  4. granular movement amount -> cover/over
-> data/dk_frame.parquet
"""
import os, glob
import numpy as np
import pandas as pd

HERE = os.path.dirname(os.path.abspath(__file__))
gm = pd.read_parquet(os.path.join(HERE, "data", "model_games.parquet"))
cfbd = sorted(set(gm.homeTeam) | set(gm.awayTeam))
ALIAS = {"Appalachian State Mountaineers": "App State", "Hawaii Rainbow Warriors": "Hawai'i",
         "UMass Minutemen": "Massachusetts", "San Jose State Spartans": "San José State",
         "Southern Miss Golden Eagles": "Southern Miss"}
def to_cfbd(o):
    if o in ALIAS: return ALIAS[o]
    c = [x for x in cfbd if o.startswith(x + " ") or o == x]; c.sort(key=len, reverse=True)
    return c[0] if c else None

parts = []
for f in glob.glob(os.path.join(HERE, "data", "odds_history", "odds_*.parquet")):
    yr = int(os.path.basename(f).split("_")[1].split(".")[0]); d = pd.read_parquet(f); d["season"] = yr; parts.append(d)
od = pd.concat(parts, ignore_index=True)
od = od[od.book == "draftkings"].copy()
od["home_c"] = od.home_team.map(to_cfbd); od["away_c"] = od.away_team.map(to_cfbd)
od = od.dropna(subset=["home_c", "away_c", "hrs_to_kick"])
od = od[od.hrs_to_kick >= 0]

rows = []
for gid, d in od.groupby("game_id"):
    o = d.loc[d.hrs_to_kick.idxmax()]; c = d.loc[d.hrs_to_kick.idxmin()]
    rows.append({"season": d.season.iloc[0], "home": d.home_c.iloc[0], "away": d.away_c.iloc[0], "game_id": gid,
                 "sp_o": o.spread_home, "sp_c": c.spread_home, "tot_o": o.total, "tot_c": c.total,
                 "sp_hp_c": c.spread_home_price, "sp_ap_c": c.spread_away_price, "ov_c": c.over_price, "un_c": c.under_price,
                 "close_hrs": c.hrs_to_kick})
fr = pd.DataFrame(rows)
mg = gm[["season", "homeTeam", "awayTeam", "actual_margin", "actual_total"]].rename(columns={"homeTeam": "home", "awayTeam": "away"})
fr = fr.merge(mg, on=["season", "home", "away"], how="inner")
fr = fr[fr.close_hrs < 12]
fr.to_parquet(os.path.join(HERE, "data", "dk_frame.parquet"), index=False)
print(f"DK frame: {len(fr)} games")

# 1. DISTRIBUTIONS
print("\n=== ACTUAL MARGIN distribution (|margin|, the key spread numbers) ===")
am = fr.actual_margin.abs()
for v in range(1, 22):
    p = 100 * (am == v).mean()
    bar = "#" * int(p * 2)
    if p >= 1: print(f"  {v:>3}: {p:4.1f}% {bar}")
print("\n=== ACTUAL TOTAL distribution (common totals) ===")
at = fr.actual_total
for lo in range(20, 90, 7):
    print(f"  {lo}-{lo+6}: {100*((at>=lo)&(at<lo+7)).mean():4.1f}%")

# 2. COVER by EXACT closing spread (favorite perspective)
fr["fav_sp"] = -fr.sp_c.abs()    # favorite's spread (negative)
fr["fav_is_home"] = fr.sp_c < 0
fr["fav_margin"] = np.where(fr.fav_is_home, fr.actual_margin, -fr.actual_margin)
fr["fav_cover"] = (fr.fav_margin + fr.fav_sp) > 0
fr["push_sp"] = (fr.fav_margin + fr.fav_sp) == 0
print("\n=== FAVORITE cover% by EXACT closing spread (DK) ===")
print(f"{'fav_sp':>8}{'n':>6}{'fav_cov%':>9}{'push%':>7}")
for v in sorted(fr.fav_sp.unique()):
    b = fr[fr.fav_sp == v]
    if len(b) >= 40: print(f"{v:>8}{len(b):>6}{100*b.fav_cover.mean():>9.1f}{100*b.push_sp.mean():>7.1f}")
