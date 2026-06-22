"""
PUBLIC BETTING SPLITS probe (ncaaf_betting_lines, 2025 wk2-6, n=403).
The direct measure of public bias. Test fading the public:
  - bets% heavy on a side (square money) -> fade
  - bets/handle DIVERGENCE (high bets%, low handle% = public-heavy/sharp-light) -> fade public side
For spreads AND totals. Small sample (probe) -> if it works, capture live in 2026.
"""
import os
import numpy as np
import pandas as pd

HERE = os.path.dirname(os.path.abspath(__file__))
l = pd.read_parquet(os.path.join(HERE, "data", "ncaaf_betting_lines.parquet"))
g = pd.read_parquet(os.path.join(HERE, "data", "cfb_games.parquet"))
g = g[(g.season == 2025) & g.completed & g.home_points.notna()].copy()

# join on VSIN team names + week
res = g[["week", "vsin_home_team", "vsin_away_team", "home_points", "away_points"]].dropna(subset=["vsin_home_team"])
d = l.merge(res, left_on=["week", "home_team", "away_team"], right_on=["week", "vsin_home_team", "vsin_away_team"], how="inner")
print(f"joined games: {len(d)}")
d["home_margin"] = d.home_points - d.away_points
d["home_cover"] = (d.home_margin + d.home_spread) > 0       # home_spread<0 = home favored
d["total"] = d.home_points + d.away_points
d = d[d.over_line.notna()]
d["over"] = d.total > d.over_line
def roi(h, n): return (h * 0.909 - (n - h)) / n * 100 if n else 0.0

def show(name, mask, hit):
    m = mask.fillna(False); n = int(m.sum())
    if n < 20: print(f"  {name:<44} n={n} (thin)"); return
    h = int(hit[m].sum()); print(f"  {name:<44} n={n:<4} {100*h/n:.1f}%  roi={roi(h,n):+.1f}")

print("\n=== SPREADS: fade the public bets% side ===")
# public side = more bets. fade = bet the other side.
pub_home = d.home_spread_bets > d.away_spread_bets
# fade public: if public on home, bet away (win = ~home_cover); if public on away, bet home (win=home_cover)
fade_hit = np.where(pub_home, ~d.home_cover, d.home_cover)
show("fade public bets% (any lean)", pd.Series(True, index=d.index), pd.Series(fade_hit, index=d.index))
show("fade STRONG public (bets%>=65%)", (d[["home_spread_bets", "away_spread_bets"]].max(axis=1) >= 0.65), pd.Series(fade_hit, index=d.index))
show("fade EXTREME public (bets%>=70%)", (d[["home_spread_bets", "away_spread_bets"]].max(axis=1) >= 0.70), pd.Series(fade_hit, index=d.index))

print("\n=== SPREADS: bets/handle divergence (public-heavy, sharp-light) ===")
# on home side: bets% high but handle% lower -> public on home, fade home (bet away)
home_pub_div = (d.home_spread_bets - d.home_spread_handle)   # >0 = more bets than money on home (square)
away_pub_div = (d.away_spread_bets - d.away_spread_handle)
# fade the side with biggest positive bets-minus-handle (square side)
fade_home = home_pub_div > away_pub_div   # home is squarer -> bet away
divmag = np.maximum(home_pub_div, away_pub_div)
fade_div_hit = np.where(fade_home, ~d.home_cover, d.home_cover)
for thr in [0.05, 0.10, 0.15]:
    show(f"fade square side (bets-handle gap>={thr})", (divmag >= thr), pd.Series(fade_div_hit, index=d.index))

print("\n=== TOTALS: fade public over/under ===")
pub_over = d.over_bets > d.under_bets
fade_tot_hit = np.where(pub_over, ~d.over, d.over)   # public over -> bet under
show("fade public total side (any)", pd.Series(True, index=d.index), pd.Series(fade_tot_hit, index=d.index))
show("fade STRONG public total (>=65%)", (d[["over_bets", "under_bets"]].max(axis=1) >= 0.65), pd.Series(fade_tot_hit, index=d.index))
# totals bets/handle divergence
over_div = d.over_bets - d.over_handle
show("fade public OVER (over bets-handle>=.10)", (over_div >= 0.10), pd.Series((~d.over).values, index=d.index))
show("public UNDER bets-handle>=.10 -> bet over", ((d.under_bets - d.under_handle) >= 0.10), pd.Series(d.over.values, index=d.index))
