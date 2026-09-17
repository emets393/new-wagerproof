#!/usr/bin/env python3
"""First complete-data FP study: WR/TE prop overs vs opposing defense's
man-coverage rate (entering game, leak-safe s2d).

Theory: separation-limited receivers get erased by heavy man; quick separators
feast on it. The prop line (set from recent box scores) doesn't condition on
the coverage matchup. Grade actual vs close line, player_reception_yds +
player_receptions, 2023-2025 (props warehouse floor).
"""
import numpy as np
import pandas as pd

NICK = {"Cardinals":"ARZ","Falcons":"ATL","Ravens":"BLT","Bills":"BUF","Panthers":"CAR",
"Bears":"CHI","Bengals":"CIN","Browns":"CLV","Cowboys":"DAL","Broncos":"DEN","Lions":"DET",
"Packers":"GB","Texans":"HST","Colts":"IND","Jaguars":"JAX","Chiefs":"KC","Rams":"LA",
"Chargers":"LAC","Raiders":"LV","Dolphins":"MIA","Vikings":"MIN","Patriots":"NE",
"Saints":"NO","Giants":"NYG","Jets":"NYJ","Eagles":"PHI","Steelers":"PIT","Seahawks":"SEA",
"49ers":"SF","Buccaneers":"TB","Titans":"TEN","Commanders":"WAS","Football Team":"WAS"}
AB_NV = {"ARZ":"ARI","BLT":"BAL","CLV":"CLE","HST":"HOU"}   # FP -> nflverse/props abbr

cov = pd.read_parquet("data/fpdata/team_defense_coverage-matrix.parquet")
cov["man"] = pd.to_numeric(cov["opponentStatsCoverageSchemeManPassingDropbacksPercentage"], errors="coerce")
cov["ab"] = cov.teamNickname.map(NICK)
cov = cov.sort_values(["ab", "__season", "__week"])
cov["pre_man"] = cov.groupby(["ab", "__season"]).man.transform(
    lambda s: s.shift(1).expanding(min_periods=3).mean())
defman = cov[["ab", "__season", "__week", "pre_man"]].rename(columns={"ab": "def_ab"})

# receiver separation identity: entering-game separation score (who beats coverage)
sep = pd.read_parquet("data/fpdata/player_receiving-separation-by-alignment.parquet")
sep["sep_score"] = pd.to_numeric(sep["playerStatsReceivingSeparationScorePercentage"], errors="coerce")
sep = sep.sort_values(["playerPlayerId", "__season", "__week"])
sep["pre_sep"] = sep.groupby(["playerPlayerId", "__season"]).sep_score.transform(
    lambda s: s.shift(1).expanding(min_periods=3).mean())

cw = pd.read_parquet("data/fpdata/player_crosswalk.parquet")[["player_id", "playerPlayerId"]]
panel = pd.read_parquet("data/nfl_prop_v3_panel.parquet")
line_col = next(c for c in panel.columns if "close" in c.lower() and "line" in c.lower())
pan = panel[panel.market.isin(["player_reception_yds", "player_receptions"])].merge(cw, on="player_id")

# v3 panel carries close_line only 2024+; rebuild 2023 closes from the raw
# snapshot warehouse (last pre-kickoff snapshot per player/market/event, median
# across books) so the study spans the full props era.
raw = pd.read_parquet("data/props_rows.parquet")
raw = raw[(raw.season == 2023) & raw.market.isin(["player_reception_yds", "player_receptions"])]
raw = raw[raw.snapshot_time <= raw.commence_time]
last = (raw.sort_values("snapshot_time")
        .groupby(["player_id", "market", "season", "week", "bookmaker"], as_index=False).last())
cl23 = (last.groupby(["player_id", "market", "season", "week"], as_index=False)
        .line.median().rename(columns={"line": "cl23"}))
pan = pan.merge(cl23, on=["player_id", "market", "season", "week"], how="left")
pan[line_col] = pan[line_col].fillna(pan.cl23)

# opponent defense abbr: panel has 'opp' (nflverse abbr) — map FP->nflverse on defman
defman["def_ab_nv"] = defman.def_ab.map(lambda a: AB_NV.get(a, a))
j = pan.merge(defman, left_on=["opp", "season", "week"],
              right_on=["def_ab_nv", "__season", "__week"], how="inner")
j = j.merge(sep[["playerPlayerId", "__season", "__week", "pre_sep"]],
            left_on=["playerPlayerId", "season", "week"],
            right_on=["playerPlayerId", "__season", "__week"], how="left")
j = j.dropna(subset=["pre_man", "actual", line_col])
j["over"] = np.where(j.actual == j[line_col], np.nan, (j.actual > j[line_col]).astype(float))
print(f"joined: {len(j)} prop-games, seasons {j.season.min()}-{j.season.max()}\n")

def cell(d, name, m, min_n=40):
    c = d[m]["over"].dropna()
    if len(c) < min_n:
        print(f"  {name:56s} n={len(c)}")
        return
    z = (c.mean() - 0.5) * 2 * np.sqrt(len(c))
    print(f"  {name:56s} {int(c.sum()):5d}-{int(len(c)-c.sum()):5d} ({100*c.mean():.1f}%)  z={z:+.2f}")

for mkt in ("player_reception_yds", "player_receptions"):
    d = j[j.market == mkt].copy()
    print(f"== {mkt} (base over {100*d.over.mean():.1f}%, n={int(d.over.notna().sum())}) ==")
    man_q = d.pre_man.rank(pct=True)
    d["man_hi"] = man_q >= 0.75
    d["man_lo"] = man_q <= 0.25
    sep_q = d.pre_sep.rank(pct=True)
    cell(d, "vs TOP-quartile man defense (all receivers)", d.man_hi)
    cell(d, "vs BOTTOM-quartile man defense (all receivers)", d.man_lo)
    cell(d, "elite separator (top-25% sep) vs man-heavy D", d.man_hi & (sep_q >= 0.75))
    cell(d, "poor separator (bot-25% sep) vs man-heavy D", d.man_hi & (sep_q <= 0.25))
    cell(d, "elite separator vs zone-heavy D", d.man_lo & (sep_q >= 0.75))
    cell(d, "poor separator vs zone-heavy D", d.man_lo & (sep_q <= 0.25))
    print()
