#!/usr/bin/env python3
"""Unit composite scores from FP charted data (owner architecture, 2026-09-16).

One denoised rating per team-unit per week (entering-game, strictly prior
games, shrunk toward league mean by sample size):

  OFFENSE: pass_pro, recv_corps, run_block, rb_room, qb_resilience
  DEFENSE: pass_rush, coverage, run_front, tackling

Each composite = mean of z-scored stable inputs (sign-aligned so + = good for
that unit). Writes data/fpdata/unit_composites.parquet (team-season-week) and
prints a reliability report (split-half r per composite — the denoising test:
composites must beat their raw inputs, else this layer earns nothing).
"""
import numpy as np
import pandas as pd

NICK = {"Cardinals":"ARZ","Falcons":"ATL","Ravens":"BLT","Bills":"BUF","Panthers":"CAR",
"Bears":"CHI","Bengals":"CIN","Browns":"CLV","Cowboys":"DAL","Broncos":"DEN","Lions":"DET",
"Packers":"GB","Texans":"HST","Colts":"IND","Jaguars":"JAX","Chiefs":"KC","Rams":"LA",
"Chargers":"LAC","Raiders":"LV","Dolphins":"MIA","Vikings":"MIN","Patriots":"NE",
"Saints":"NO","Giants":"NYG","Jets":"NYJ","Eagles":"PHI","Steelers":"PIT","Seahawks":"SEA",
"49ers":"SF","Buccaneers":"TB","Titans":"TEN","Commanders":"WAS"}
DIR = "data/fpdata/"


def num(s):
    return pd.to_numeric(s, errors="coerce")


def team_game_inputs():
    """Per team-game raw unit inputs (realized, later shifted to entering-game)."""
    lm = pd.read_parquet(DIR + "lineMatchups__team.parquet")
    lm["ab"] = lm.teamNickname.map(NICK)
    t = lm[["ab", "__season", "__week"]].copy()
    t["pass_pro__pressure_oe"] = -num(lm["teamStatsPassingPressuredOverExpected"])      # less pressure allowed = good
    t["pass_rush__pressure_oe"] = num(lm["opponentStatsPassingPressuredOverExpected"])  # more pressure generated = good
    t["run_block__ybc"] = num(lm["teamStatsRushingYardsBeforeContactTotal"]) / num(lm["teamStatsRushingAttemptsTotal"]).replace(0, np.nan)
    t["run_front__ybc"] = -(num(lm["opponentStatsRushingYardsBeforeContactTotal"]) / num(lm["opponentStatsRushingAttemptsTotal"]).replace(0, np.nan))

    ro = pd.read_parquet(DIR + "team_offense_rushing-advanced.parquet")
    ro["ab"] = ro.teamNickname.map(NICK)
    rd = pd.read_parquet(DIR + "team_defense_rushing-advanced.parquet")
    rd["ab"] = rd.teamNickname.map(NICK)
    t = t.merge(ro.assign(run_block__stuff=-num(ro["teamStatsRushingAttemptsStuffsPercentage"]),
                          rb_room__yac=num(ro["teamStatsRushingYardsAfterContactPerAttempt"]))
                [["ab", "__season", "__week", "run_block__stuff", "rb_room__yac"]],
                on=["ab", "__season", "__week"], how="left")
    t = t.merge(rd.assign(run_front__stuff=num(rd["opponentStatsRushingAttemptsStuffsPercentage"]),
                          tackling__yac=-num(rd["opponentStatsRushingYardsAfterContactPerAttempt"]))
                [["ab", "__season", "__week", "run_front__stuff", "tackling__yac"]],
                on=["ab", "__season", "__week"], how="left")

    # receiving corps: target-weighted separation + YPRR (own), coverage: allowed (opp view)
    sep = pd.read_parquet(DIR + "player_receiving-separation-by-alignment.parquet")
    sep["ss"] = num(sep.playerStatsReceivingSeparationScorePercentage)
    sep["tgt"] = num(sep.playerStatsReceivingTargetsTotal)
    sep["yprr"] = num(sep.playerStatsReceivingAveragesPerRouteYardsTotal)
    def _wavg(g, col):
        gg = g.dropna(subset=[col, "tgt"])
        if not len(gg):
            return np.nan
        return np.average(gg[col], weights=gg.tgt.clip(lower=0.1))
    own = (sep.groupby(["teamAbbreviation", "__season", "__week"])
           .apply(lambda g: pd.Series({
               "recv_corps__sep": _wavg(g, "ss"),
               "recv_corps__yprr": _wavg(g, "yprr")}))
           .reset_index().rename(columns={"teamAbbreviation": "ab"}))
    allowed = (sep.groupby(["opponentAbbreviation", "__season", "__week"])
               .apply(lambda g: pd.Series({
                   "coverage__sep": -_wavg(g, "ss"),
                   "coverage__yprr": -_wavg(g, "yprr")}))
               .reset_index().rename(columns={"opponentAbbreviation": "ab"}))
    t = t.merge(own, on=["ab", "__season", "__week"], how="left")
    t = t.merge(allowed, on=["ab", "__season", "__week"], how="left")

    # QB resilience: sack rate when pressured (lower = good), team level
    qb = pd.read_parquet(DIR + "player_passing-advanced.parquet")
    qb["db"] = num(qb[[c for c in qb.columns if "Dropback" in c and "Total" in c][0]])
    qb["swp"] = num(qb["playerStatsPassingSackedPressuredPercentage"])
    qbt = (qb[qb.db >= 10].groupby(["teamAbbreviation", "__season", "__week"])
           .apply(lambda g: pd.Series({"qb_resilience__swp": -np.average(g.swp.fillna(g.swp.mean() or 0.24), weights=g.db)}))
           .reset_index().rename(columns={"teamAbbreviation": "ab"}))
    t = t.merge(qbt, on=["ab", "__season", "__week"], how="left")
    return t


UNITS = {
    "pass_pro": ["pass_pro__pressure_oe"],
    "pass_rush": ["pass_rush__pressure_oe"],
    "run_block": ["run_block__ybc", "run_block__stuff"],
    "run_front": ["run_front__ybc", "run_front__stuff"],
    "rb_room": ["rb_room__yac"],
    "tackling": ["tackling__yac"],
    "recv_corps": ["recv_corps__sep", "recv_corps__yprr"],
    "coverage": ["coverage__sep", "coverage__yprr"],
    "qb_resilience": ["qb_resilience__swp"],
}
SHRINK_N = 6   # pseudo-games of league-average in the entering-game mean


def main():
    t = team_game_inputs()
    # z-score inputs within season (league-relative)
    for cols in UNITS.values():
        for c in cols:
            t[c + "_z"] = t.groupby("__season")[c].transform(lambda s: (s - s.mean()) / s.std())
    # realized per-game composite = mean of its z inputs
    for u, cols in UNITS.items():
        t[u + "_game"] = t[[c + "_z" for c in cols]].mean(axis=1)
    # entering-game rating: shrunk expanding mean of prior games, within season
    t = t.sort_values(["ab", "__season", "__week"])
    for u in UNITS:
        g = t.groupby(["ab", "__season"])[u + "_game"]
        s = g.transform(lambda x: x.shift(1).expanding().sum())
        n = g.transform(lambda x: x.shift(1).expanding().count())
        t[u] = s / (n + SHRINK_N)          # shrunk toward 0 (league mean)
    out = t[["ab", "__season", "__week"] + list(UNITS) + [u + "_game" for u in UNITS]]
    out.to_parquet(DIR + "unit_composites.parquet")
    print(f"wrote unit_composites.parquet: {len(out)} team-weeks\n")

    print("RELIABILITY (split-half r across defense/team-seasons, realized per-game values):")
    for u in UNITS:
        pairs = []
        for _, g in t.dropna(subset=[u + "_game"]).groupby(["ab", "__season"]):
            if len(g) >= 10:
                pairs.append((g[g.__week % 2 == 0][u + "_game"].mean(),
                              g[g.__week % 2 == 1][u + "_game"].mean()))
        r = np.corrcoef([a for a, _ in pairs], [b for _, b in pairs])[0, 1] if len(pairs) > 10 else np.nan
        print(f"  {u:14s} r={r:+.3f}  (n={len(pairs)} team-seasons)")


if __name__ == "__main__":
    main()
