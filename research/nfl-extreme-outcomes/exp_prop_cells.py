#!/usr/bin/env python3
"""Pre-registered receiving-prop CELL battery (owner dimensions, 2026-09-17).
Each cell = player trait x opponent trait; grade over/under vs close, 2023-25.
Cells > regression (which reproduces the line). Report record, z, per-season."""
import numpy as np
import pandas as pd

AB_NV = {"ARZ": "ARI", "BLT": "BAL", "CLV": "CLE", "HST": "HOU"}
NICK = {"Cardinals":"ARZ","Falcons":"ATL","Ravens":"BLT","Bills":"BUF","Panthers":"CAR","Bears":"CHI",
"Bengals":"CIN","Browns":"CLV","Cowboys":"DAL","Broncos":"DEN","Lions":"DET","Packers":"GB","Texans":"HST",
"Colts":"IND","Jaguars":"JAX","Chiefs":"KC","Rams":"LA","Chargers":"LAC","Raiders":"LV","Dolphins":"MIA",
"Vikings":"MIN","Patriots":"NE","Saints":"NO","Giants":"NYG","Jets":"NYJ","Eagles":"PHI","Steelers":"PIT",
"Seahawks":"SEA","49ers":"SF","Buccaneers":"TB","Titans":"TEN","Commanders":"WAS"}


def num(s):
    return pd.to_numeric(s, errors="coerce")


panel = pd.read_parquet("data/nfl_prop_v3_panel.parquet")
panel = panel[panel.market.isin(["player_reception_yds", "player_receptions"])].copy()
cw = pd.read_parquet("data/fpdata/player_crosswalk.parquet")[["player_id", "playerPlayerId"]].drop_duplicates("player_id")
panel = panel.merge(cw, on="player_id", how="left")

# player entering-game granular traits
ra = pd.read_parquet("data/fpdata/player_receiving-advanced.parquet")
T = {"slot_pct": "playerStatsReceivingAlignmentSlotRoutesPercentage",
     "tprr": "playerStatsReceivingTargetsPerRoute",
     "firstread_sh": "marketShareReceivingTargetedReadFirst",
     "yprr": "playerStatsReceivingAveragesPerRouteYardsTotal"}
for k, c in T.items():
    ra[k] = num(ra[c])
ra = ra.sort_values(["playerPlayerId", "__season", "__week"])
for k in T:
    ra["p_" + k] = ra.groupby(["playerPlayerId", "__season"])[k].transform(lambda s: s.shift(1).expanding(min_periods=3).mean())
# separation (validated anchor)
sep = pd.read_parquet("data/fpdata/player_receiving-separation-by-alignment.parquet")
sep["ss"] = num(sep.playerStatsReceivingSeparationScorePercentage)
sep = sep.sort_values(["playerPlayerId", "__season", "__week"])
sep["p_sep"] = sep.groupby(["playerPlayerId", "__season"]).ss.transform(lambda s: s.shift(1).expanding(min_periods=3).mean())
panel = panel.merge(ra[["playerPlayerId", "__season", "__week"] + ["p_" + k for k in T]],
                    left_on=["playerPlayerId", "season", "week"], right_on=["playerPlayerId", "__season", "__week"], how="left")
panel = panel.merge(sep[["playerPlayerId", "__season", "__week", "p_sep"]],
                    left_on=["playerPlayerId", "season", "week"], right_on=["playerPlayerId", "__season", "__week"], how="left", suffixes=("", "_s"))

# opponent defense coverage diet (entering game)
cov = pd.read_parquet("data/fpdata/team_defense_coverage-matrix.parquet")
cov["ab_nv"] = cov.teamNickname.map(NICK).map(lambda a: AB_NV.get(a, a))
for k, c in (("man", "opponentStatsCoverageSchemeManPassingDropbacksPercentage"),
             ("zone", "opponentStatsCoverageSchemeZonePassingDropbacksPercentage"),
             ("twohigh", "opponentStatsCoverageSchemeTwoHighPassingDropbacksPercentage")):
    cov[k] = num(cov[c])
cov = cov.sort_values(["ab_nv", "__season", "__week"])
for k in ("man", "zone", "twohigh"):
    cov["d_" + k] = cov.groupby(["ab_nv", "__season"])[k].transform(lambda s: s.shift(1).expanding(min_periods=2).mean())
panel = panel.merge(cov[["ab_nv", "__season", "__week", "d_man", "d_zone", "d_twohigh"]],
                    left_on=["opp", "season", "week"], right_on=["ab_nv", "__season", "__week"], how="left", suffixes=("", "_d"))

panel = panel[(panel.week >= 4) & panel.close_line.notna() & (panel.close_line>0)].copy()
panel["over"] = np.where(panel.actual == panel.close_line, np.nan, (panel.actual > panel.close_line).astype(float))
RB = panel[panel.position == "RB"]
WR = panel[panel.position.isin(["WR", "TE"])]


def cell(name, d, m, mkt, target="over", min_n=40):
    dd = d[(d.market == mkt) & m]
    c = dd[target].dropna()
    if len(c) < min_n:
        print(f"  {name:52s} n={len(c)}")
        return
    z = (c.mean() - .5) * 2 * np.sqrt(len(c))
    line = f"  {name:52s} {int(c.sum()):4d}-{int(len(c)-c.sum()):4d} ({100*c.mean():.1f}%)  z={z:+.2f}"
    if abs(z) >= 1.8:
        for s in (2023, 2024, 2025):
            cc = dd[dd.season == s][target].dropna()
            if len(cc) >= 15:
                line += f"  [{s}:{100*cc.mean():.0f}%]"
    print(line)


for MKT in ("player_reception_yds", "player_receptions"):
    print(f"\n===== {MKT} =====")
    q_slot = WR.p_slot_pct.rank(pct=True)
    q_sep = WR.p_sep.rank(pct=True)
    q_fr = WR.p_firstread_sh.rank(pct=True)
    q_tprr = WR.p_tprr.rank(pct=True)
    dman = WR.d_man.rank(pct=True); dzone = WR.d_zone.rank(pct=True); d2h = WR.d_twohigh.rank(pct=True)
    print(" WR/TE:")
    cell("elite separator (top25%) vs man-heavy D", WR, (q_sep >= .75) & (dman >= .67), MKT)
    cell("poor separator (bot25%) vs man-heavy D -> UNDER", WR, (q_sep <= .25) & (dman >= .67), MKT)
    cell("slot WR (top25%) vs zone-heavy D", WR, (q_slot >= .75) & (dzone >= .67), MKT)
    cell("slot WR vs man-heavy D", WR, (q_slot >= .75) & (dman >= .67), MKT)
    cell("high first-read share (top25%) vs man D", WR, (q_fr >= .75) & (dman >= .67), MKT)
    cell("high first-read share overall (top25%)", WR, (q_fr >= .75), MKT)
    cell("high TPRR (top25%) vs soft/zone D", WR, (q_tprr >= .75) & (dzone >= .67), MKT)
    cell("wide WR (top25% wide, i.e. deep) vs two-high -> UNDER", WR, (q_slot <= .25) & (d2h >= .67), MKT)
    if MKT == "player_receptions":
        print(" RB receiving:")
        q_fr_rb = RB.p_firstread_sh.rank(pct=True)
        d2h_rb = RB.d_twohigh.rank(pct=True)
        cell("RB receiving vs two-high D (checkdowns) -> OVER", RB, (RB.d_twohigh.rank(pct=True) >= .67), MKT)
        cell("RB receiving vs man-heavy D (RB-LB iso) -> OVER", RB, (RB.d_man.rank(pct=True) >= .67), MKT)
