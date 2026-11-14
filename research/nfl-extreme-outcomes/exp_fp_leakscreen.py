#!/usr/bin/env python3
"""Leak screen for Fantasy Points charted data (law: leak-screen-line-vs-result).

For each candidate PREGAME feature (entering-game aggregates, strictly prior
weeks), require |corr(feature, closing line/total)| >= |corr(feature, result)|.
A pregame-legitimate feature is priced; one that "predicts" results better than
the market knew is leaking realized outcomes. Also check lag-1 autocorrelation:
a real team trait persists week to week (high autocorr); same-game noise doesn't.
"""
import numpy as np
import pandas as pd

AB = {"ARZ": "ARI", "BLT": "BAL", "CLV": "CLE", "HST": "HOU"}   # FP -> nflverse

g = pd.read_csv("https://github.com/nflverse/nflverse-data/releases/download/schedules/games.csv",
                low_memory=False)
g = g[(g.game_type == "REG") & g.result.notna() & (g.season >= 2021)]

cov = pd.read_parquet("data/fpdata/coverageMatrix__opponent.parquet")
cov["ab"] = cov.teamNickname.map(lambda n: None)  # placeholder; use abbrev below
# The row's TEAM is the defense; abbreviation lives on team side via location/nickname
# — the frame carries opponentAbbreviation (their opponent), so derive own abbr from
# nickname->abbr map built from opponent columns.
nick2ab = {}
for _, r in cov.iterrows():
    nick2ab.setdefault(r.opponentAbbreviation, r.opponentAbbreviation)
# own abbreviation: FP includes teamLocation/teamNickname; build map from games where
# team X appears as someone's opponent. Simplest: use teamNickname->abbr via a static map.
NICK = {"Cardinals":"ARZ","Falcons":"ATL","Ravens":"BLT","Bills":"BUF","Panthers":"CAR",
"Bears":"CHI","Bengals":"CIN","Browns":"CLV","Cowboys":"DAL","Broncos":"DEN","Lions":"DET",
"Packers":"GB","Texans":"HST","Colts":"IND","Jaguars":"JAX","Chiefs":"KC","Rams":"LA",
"Chargers":"LAC","Raiders":"LV","Dolphins":"MIA","Vikings":"MIN","Patriots":"NE",
"Saints":"NO","Giants":"NYG","Jets":"NYJ","Eagles":"PHI","Steelers":"PIT","Seahawks":"SEA",
"49ers":"SF","Buccaneers":"TB","Titans":"TEN","Commanders":"WAS","Football Team":"WAS",
"Washington":"WAS"}
cov["ab"] = cov.teamNickname.map(NICK)
cov["ab_nv"] = cov.ab.map(lambda a: AB.get(a, a))

F = {
    "man_pct": "opponentStatsCoverageSchemeManPassingDropbacksPercentage",
    "two_high_pct": "opponentStatsCoverageSchemeTwoHighPassingDropbacksPercentage",
    "fp_per_db_man": "opponentStatsCoverageSchemeManFantasyPointsPprPassing",
}
cov = cov.sort_values(["ab", "gameSeason", "gameWeek"])
for k, c in F.items():
    cov[k] = pd.to_numeric(cov[c], errors="coerce")
    # entering-game feature: expanding mean of PRIOR games this season
    cov["pre_" + k] = cov.groupby(["ab", "gameSeason"])[k].transform(
        lambda s: s.shift(1).expanding(min_periods=3).mean())

rows = []
for _, r in g.iterrows():
    for team, opp, home in ((r.home_team, r.away_team, True), (r.away_team, r.home_team, False)):
        rows.append(dict(season=r.season, week=r.week, ab_nv=team, opp=opp, home=home,
                         line=-r.spread_line if home else r.spread_line,
                         total=r.total_line, margin=r.result if home else -r.result,
                         pts_total=r.total))
p = pd.DataFrame(rows).merge(
    cov[["ab_nv", "gameSeason", "gameWeek", "man_pct", "two_high_pct", "fp_per_db_man",
         "pre_man_pct", "pre_two_high_pct", "pre_fp_per_db_man"]],
    left_on=["ab_nv", "season", "week"], right_on=["ab_nv", "gameSeason", "gameWeek"], how="inner")
print(f"joined {len(p)} team-games\n")

print(f"{'feature':22s} {'|r| line':>9s} {'|r| result':>11s} {'lag1 auto':>10s}  verdict")
for k in F:
    pre = "pre_" + k
    d = p.dropna(subset=[pre])
    r_line = abs(np.corrcoef(d[pre], d.line)[0, 1]) if k != "fp_per_db_man" else abs(np.corrcoef(d[pre], d.total)[0, 1])
    r_res = abs(np.corrcoef(d[pre], d.margin)[0, 1]) if k != "fp_per_db_man" else abs(np.corrcoef(d[pre], d.pts_total)[0, 1])
    auto = cov.groupby(["ab", "gameSeason"])[k].apply(lambda s: s.autocorr(1)).mean()
    verdict = "OK (pregame-legit)" if r_line >= r_res - 0.02 else "SUSPECT — investigate"
    print(f"{pre:22s} {r_line:9.3f} {r_res:11.3f} {auto:10.3f}  {verdict}")
print("\n(lag-1 autocorr >> 0 = persistent team trait, the signature of real scheme identity)")
