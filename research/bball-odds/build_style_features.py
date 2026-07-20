#!/usr/bin/env python3
"""Team style profiles per game (strictly prior), NCAAB.

Offense (how a team scores): 3P share of points, paint share, FT share,
3PA rate, 3P%, FT rate, pace, oreb%.
Defense (what a team allows): opponent 3P%, opponent 3PA rate, opponent paint
points/100 poss, opponent FT rate (fouling), opponent eFG, opponent pace.

Each value = expanding mean of PRIOR games (shift-1), then percentile-ranked
within sport-season so "high/low" is relative to that season's environment.
(Rank thresholds use the season's full distribution — a threshold-only
simplification; the underlying values never see the current game.)

Output: data/parquet/style_ncaab.parquet, one row per team-game.
"""
import os

import numpy as np
import pandas as pd

ROOT = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(ROOT, "data", "parquet")

STYLE_COLS = ["pace", "p3_share", "paint_share", "ft_share", "p3a_rate", "p3_pct",
              "ftr", "oreb", "to_rate",
              "d_p3_pct", "d_p3a_rate", "d_paint100", "d_ftr", "d_efg",
              "d_to_forced", "d_oreb_allowed"]


def main():
    tb = pd.read_parquet(f"{OUT}/cbbd_team_box.parquet").drop_duplicates(
        ["gameId", "teamId"])
    t = pd.DataFrame({
        "game_key": tb["gameId"], "season": tb["season"],
        "date": pd.to_datetime(tb["startDate"]).dt.tz_localize(None),
        "team_key": tb["teamId"].astype(str) + "_" + tb["season"].astype(str),
        "is_home": tb["isHome"],
        "pace": tb["pace"],
        "p3_share": 3 * tb["teamStats.threePointFieldGoals.made"]
                    / tb["teamStats.points.total"].replace(0, np.nan),
        "paint_share": tb["teamStats.points.inPaint"]
                       / tb["teamStats.points.total"].replace(0, np.nan),
        "ft_share": tb["teamStats.freeThrows.made"]
                    / tb["teamStats.points.total"].replace(0, np.nan),
        "p3a_rate": tb["teamStats.threePointFieldGoals.attempted"]
                    / tb["teamStats.fieldGoals.attempted"].replace(0, np.nan),
        "p3_pct": tb["teamStats.threePointFieldGoals.pct"],
        "ftr": tb["teamStats.fourFactors.freeThrowRate"],
        "oreb": tb["teamStats.fourFactors.offensiveReboundPct"],
        "d_p3_pct": tb["opponentStats.threePointFieldGoals.pct"],
        "d_p3a_rate": tb["opponentStats.threePointFieldGoals.attempted"]
                      / tb["opponentStats.fieldGoals.attempted"].replace(0, np.nan),
        "d_paint100": tb["opponentStats.points.inPaint"]
                      / tb["opponentStats.possessions"].replace(0, np.nan) * 100,
        "d_ftr": tb["opponentStats.fourFactors.freeThrowRate"],
        "d_efg": tb["opponentStats.fourFactors.effectiveFieldGoalPct"],
        "to_rate": tb["teamStats.turnovers.total"]
                   / tb["teamStats.possessions"].replace(0, np.nan),
        "d_to_forced": tb["opponentStats.turnovers.total"]
                       / tb["opponentStats.possessions"].replace(0, np.nan),
        "d_oreb_allowed": tb["opponentStats.fourFactors.offensiveReboundPct"],
    })
    t = t.sort_values(["team_key", "date"])
    g = t.groupby("team_key")
    for c in STYLE_COLS:
        t[f"s_{c}"] = g[c].transform(lambda s: s.shift(1).expanding(min_periods=5).mean())
    for c in STYLE_COLS:
        t[f"pct_{c}"] = t.groupby("season")[f"s_{c}"].rank(pct=True)
    t.to_parquet(f"{OUT}/style_ncaab.parquet", index=False)
    print(f"style_ncaab: {len(t):,} team-games, coverage "
          f"{t['pct_pace'].notna().mean()*100:.1f}%", flush=True)


if __name__ == "__main__":
    main()
