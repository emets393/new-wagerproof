"""Hunt for NEW player-prop signals -- OVER-biased -- using advanced + L3/L5 features
the current P1-P11 flags don't touch (PROPS_BRIEF1 was under-heavy & form-only).

Fresh feature families (ALL entering-week / non-leaky via shift):
  (A) offensive usage trend  -- targets/carries/attempts/snap-share L3 vs season
  (B) NGS advanced L3        -- separation, cushion, air-yards share, CPOE, RYOE
  (C) opponent defense       -- team_week EPA/success/explosive ALLOWED (shifted entering)
  (D) defensive L3 allowed    -- yds/rec/TD this defense gave up to the POSITION, last 3
  (E) line movement by market -- open->close & gameday deltas per prop type

Honesty: only 2 prop seasons exist (2024-25), so durability = BOTH seasons beat the
bet's real break-even AND pooled n is usable. ROI uses each bet's actual over price.
Grade vs the CLOSE line/price (signals read close consensus). BE shown per market.
"""
import numpy as np
import pandas as pd

DATA = "data"
OU_MARKETS = ["player_reception_yds", "player_receptions", "player_rush_yds",
              "player_pass_yds", "player_pass_tds"]
# market -> (offense usage stat, position group it applies to, ngs source)
MKT = {
    "player_reception_yds": ("receiving_yards", "targets", {"WR", "TE", "RB"}, "rec"),
    "player_receptions":    ("receptions", "targets", {"WR", "TE", "RB"}, "rec"),
    "player_rush_yds":      ("rushing_yards", "carries", {"RB", "QB"}, "rush"),
    "player_pass_yds":      ("passing_yards", "attempts", {"QB"}, "pass"),
    "player_pass_tds":      ("passing_tds", "attempts", {"QB"}, "pass"),
}


def amer_profit(odds):
    odds = np.asarray(odds, dtype=float)
    # odds==0 is a missing/corrupt price (receptions & pass_tds carry these) -> NaN, not inf
    return np.where(odds == 0, np.nan,
                    np.where(odds > 0, odds / 100.0, 100.0 / np.abs(np.where(odds == 0, 1, odds))))


def schedule():
    g = pd.read_parquet(f"{DATA}/nflverse_games.parquet")[
        ["season", "week", "home_team", "away_team"]]
    a = g.rename(columns={"home_team": "team", "away_team": "opp"})
    b = g.rename(columns={"away_team": "team", "home_team": "opp"})
    return pd.concat([a, b])[["season", "week", "team", "opp"]]


def entering_roll(df, key, col, n):
    """Mean of the prior `n` games (excludes current) within `key`, chronological."""
    return df.groupby(key)[col].transform(
        lambda x: x.shift(1).rolling(n, min_periods=1).mean())


def build_spine():
    pf = pd.read_parquet(f"{DATA}/props_frame.parquet")
    pf = pf[pf.market.isin(OU_MARKETS) & pf.result_close.isin(["over", "under"])].copy()
    agg = pf.groupby(["season", "week", "player_id", "player_name", "position",
                      "team", "opp", "market"]).agg(
        close_line=("close_line", "median"), open_line=("open_line", "median"),
        over_odds=("close_over", "median"),
        line_delta=("line_delta", "median"), gameday_delta=("gameday_delta", "median"),
        earlyweek_delta=("earlyweek_delta", "median"),
        l3_avg=("l3_avg", "first"), l5_avg=("l5_avg", "first"),
        szn_avg=("szn_avg", "first"), gp_prior=("gp_prior", "first"),
        def_matchup_idx=("def_matchup_idx", "first"),
        team_skill_out=("team_skill_out", "first"),
        result=("result_close", "first")).reset_index()
    agg["over"] = (agg.result == "over").astype(int)
    agg["pos_grp"] = agg.position.replace({"FB": "RB"})
    return agg


def add_offense(spine):
    po = pd.read_parquet(f"{DATA}/player_offense.parquet")
    po = po.merge(schedule(), on=["season", "week", "team"], how="left")
    po = po.sort_values(["player_id", "season", "week"])
    for stat in ["targets", "carries", "attempts", "receptions",
                 "receiving_yards", "rushing_yards", "passing_yards"]:
        po[f"{stat}_l3"] = entering_roll(po, "player_id", stat, 3)
        po[f"{stat}_szn"] = po.groupby(["player_id", "season"])[stat].transform(
            lambda x: x.shift(1).expanding().mean())
    keep = ["season", "week", "player_id"] + [c for c in po.columns if c.endswith(("_l3", "_szn"))]
    return spine.merge(po[keep].drop_duplicates(["season", "week", "player_id"]),
                       on=["season", "week", "player_id"], how="left")


def add_ngs(spine):
    rec = pd.read_parquet(f"{DATA}/ngs_receiving.parquet").sort_values(
        ["player_id", "season", "week"])
    for c in ["avg_separation", "avg_cushion", "percent_share_of_intended_air_yards",
              "avg_yac_above_expectation", "avg_intended_air_yards"]:
        rec[f"ngs_{c}_l3"] = entering_roll(rec, "player_id", c, 3)
    pas = pd.read_parquet(f"{DATA}/ngs_passing.parquet").sort_values(
        ["player_id", "season", "week"])
    for c in ["completion_percentage_above_expectation", "aggressiveness",
              "avg_intended_air_yards"]:
        pas[f"ngs_{c}_l3"] = entering_roll(pas, "player_id", c, 3)
    rsh = pd.read_parquet(f"{DATA}/ngs_rushing.parquet").sort_values(
        ["player_id", "season", "week"])
    for c in ["rush_yards_over_expected_per_att", "efficiency",
              "percent_attempts_gte_eight_defenders"]:
        rsh[f"ngs_{c}_l3"] = entering_roll(rsh, "player_id", c, 3)
    for d in (rec, pas, rsh):
        cols = ["season", "week", "player_id"] + [c for c in d.columns if c.startswith("ngs_")]
        spine = spine.merge(d[cols].drop_duplicates(["season", "week", "player_id"]),
                            on=["season", "week", "player_id"], how="left")
    return spine


TW2ABBR = {
    "Arizona": "ARI", "Atlanta": "ATL", "Baltimore": "BAL", "Buffalo": "BUF",
    "Carolina": "CAR", "Chicago": "CHI", "Cincinnati": "CIN", "Cleveland": "CLE",
    "Dallas": "DAL", "Denver": "DEN", "Detroit": "DET", "Green Bay": "GB",
    "Houston": "HOU", "Indianapolis": "IND", "Jacksonville": "JAX", "Kansas City": "KC",
    "LA Chargers": "LAC", "LA Rams": "LAR", "Las Vegas": "LV", "Miami": "MIA",
    "Minnesota": "MIN", "NY Giants": "NYG", "NY Jets": "NYJ", "New England": "NE",
    "New Orleans": "NO", "Oakland": "OAK", "Philadelphia": "PHI", "Pittsburgh": "PIT",
    "San Francisco": "SF", "Seattle": "SEA", "Tampa Bay": "TB", "Tennessee": "TEN",
    "Washington": "WAS"}


def add_def_team(spine):
    """Opponent team defense, EPA/success/explosive ALLOWED, shifted to entering-week."""
    tw = pd.read_parquet(f"{DATA}/team_week.parquet").sort_values(["team", "season", "week"])
    dcols = [c for c in tw.columns if c.startswith("def_") and c.endswith("_s2d")]
    for c in dcols:
        tw[c + "_ent"] = tw.groupby(["team", "season"])[c].shift(1)
    tw["opp"] = tw.team.map(TW2ABBR)
    keep = ["season", "week", "opp"] + [c + "_ent" for c in dcols]
    d = tw[keep].copy()
    d.columns = [c.replace("def_", "oppdef_") for c in d.columns]
    return spine.merge(d, on=["season", "week", "opp"], how="left")


def add_def_l3(spine):
    """What the OPPONENT defense allowed to the player's POSITION GROUP, last 3 games."""
    po = pd.read_parquet(f"{DATA}/player_offense.parquet").merge(
        schedule(), on=["season", "week", "team"], how="left")
    po["pos_grp"] = po.position.replace({"FB": "RB"})
    po = po[po.pos_grp.isin(["WR", "TE", "RB", "QB"])]
    # per game, what 'opp' (the defense) allowed to this position group
    allowed = po.groupby(["season", "week", "opp", "pos_grp"]).agg(
        a_recyds=("receiving_yards", "sum"), a_rec=("receptions", "sum"),
        a_rushyds=("rushing_yards", "sum"), a_passyds=("passing_yards", "sum"),
        a_rectd=("receiving_tds", "sum")).reset_index().rename(columns={"opp": "def"})
    allowed = allowed.sort_values(["def", "pos_grp", "season", "week"])
    for c in ["a_recyds", "a_rec", "a_rushyds", "a_passyds", "a_rectd"]:
        allowed[c + "_l3"] = allowed.groupby(["def", "pos_grp"])[c].transform(
            lambda x: x.shift(1).rolling(3, min_periods=1).mean())
    keep = ["season", "week", "def", "pos_grp"] + [c + "_l3" for c in
            ["a_recyds", "a_rec", "a_rushyds", "a_passyds", "a_rectd"]]
    return spine.merge(allowed[keep], left_on=["season", "week", "opp", "pos_grp"],
                       right_on=["season", "week", "def", "pos_grp"], how="left")


def rep(label, sub):
    sub = sub.dropna(subset=["over", "over_odds"])
    sub = sub[sub.over_odds != 0]            # drop corrupt 0-price rows (receptions/pass_tds)
    n = len(sub)
    if n < 60:
        return None
    prof = amer_profit(sub.over_odds.values)
    win = sub.over.values
    roi = np.mean(np.where(win == 1, prof, -1.0)) * 100
    hit = win.mean() * 100
    seas = []
    for s in (2024, 2025):
        ss = sub[sub.season == s]
        if len(ss) >= 25:
            be = (100.0 / (amer_profit(ss.over_odds.values) + 1)).mean()  # avg break-even %
            seas.append((ss.over.mean() * 100, ss.over.mean() * 100 >= be, len(ss)))
        else:
            seas.append((None, False, len(ss)))
    avg_be = (100.0 / (amer_profit(sub.over_odds.values) + 1)).mean()
    good = sum(1 for h, ok, _ in seas if ok)
    star = "  <<<" if (hit >= avg_be + 2 and good == 2 and all(
        (h is not None and h >= 50) for h, _, _ in seas)) else ""
    sh = " ".join(f"{h:.0f}%/{nn}" if h is not None else f"-/{nn}" for h, _, nn in seas)
    print(f"  {label:44s} n={n:4d} hit={hit:5.1f}% (BE{avg_be:4.1f}) ROI={roi:+6.1f}% "
          f"[{sh}]{star}")
    return hit


def q(s, p):
    return s.quantile(p)


def mine_market(spine, market):
    d = spine[spine.market == market].copy()
    usage, _, _, ngsrc = MKT[market]
    print(f"\n{'='*96}\n{market}  (n={len(d)}, over-rate={d.over.mean()*100:.1f}%)\n{'='*96}")

    # (E) line movement
    print(" -- line movement --")
    rep("line steamed UP (delta>0)", d[d.line_delta > 0])
    rep("line steamed UP >=0.5", d[d.line_delta >= 0.5])
    rep("line dropped (delta<0)", d[d.line_delta < 0])
    rep("gameday steam UP", d[d.gameday_delta > 0])

    # (A) offensive usage trend
    print(" -- offensive usage L3 vs season --")
    if f"{usage}_l3" in d:
        d["use_trend"] = d[f"{usage}_l3"] - d[f"{usage}_szn"]
        rep(f"{usage} L3 rising (>0 vs szn)", d[d.use_trend > 0])
        rep(f"{usage} L3 surging (top 25%)", d[d.use_trend >= q(d.use_trend, .75)])
    # stat form vs line
    d["line_vs_l3"] = d.close_line - d.l3_avg
    rep("line ABOVE L3 form (trust line)", d[d.line_vs_l3 > 0])
    rep("line BELOW L3 form (line lags)", d[d.line_vs_l3 < 0])
    rep("line well below L3 (bottom 25%)", d[d.line_vs_l3 <= q(d.line_vs_l3, .25)])

    # (B) NGS advanced
    print(" -- NGS advanced L3 --")
    ngs_base = {"rec": "ngs_avg_separation_l3", "pass": "ngs_aggressiveness_l3",
                "rush": "ngs_efficiency_l3"}.get(ngsrc)
    if ngs_base and ngs_base in d:
        rep("NGS-covered baseline (featured player)", d[d[ngs_base].notna()])
    if ngsrc == "rec":
        for c, lab in [("ngs_avg_separation_l3", "separation high(top25%)"),
                       ("ngs_avg_cushion_l3", "cushion high(top25%)"),
                       ("ngs_percent_share_of_intended_air_yards_l3", "airyard-share high(top25%)"),
                       ("ngs_avg_yac_above_expectation_l3", "YAC+exp high(top25%)")]:
            if c in d:
                rep(lab, d[d[c] >= q(d[c], .75)])
    if ngsrc == "pass":
        for c, lab in [("ngs_completion_percentage_above_expectation_l3", "CPOE high(top25%)"),
                       ("ngs_aggressiveness_l3", "aggressiveness high(top25%)"),
                       ("ngs_avg_intended_air_yards_l3", "intended airyds high(top25%)")]:
            if c in d:
                rep(lab, d[d[c] >= q(d[c], .75)])
    if ngsrc == "rush":
        for c, lab in [("ngs_rush_yards_over_expected_per_att_l3", "RYOE/att high(top25%)"),
                       ("ngs_efficiency_l3", "efficiency high(top25%)"),
                       ("ngs_percent_attempts_gte_eight_defenders_l3", "8+box high(top25%)"),
                       ("ngs_percent_attempts_gte_eight_defenders_l3", "8+box low(bot25%)")]:
            if c in d:
                if "low" in lab:
                    rep(lab, d[d[c] <= q(d[c], .25)])
                else:
                    rep(lab, d[d[c] >= q(d[c], .75)])

    # (C) opponent defense EPA/success allowed (higher allowed -> OVER)
    print(" -- opponent defense (EPA/success/explosive ALLOWED, entering) --")
    soft = {"player_reception_yds": "oppdef_pass_epa_allowed_neutral_s2d_ent",
            "player_receptions": "oppdef_pass_success_allowed_s2d_ent",
            "player_rush_yds": "oppdef_rush_epa_allowed_neutral_s2d_ent",
            "player_pass_yds": "oppdef_pass_epa_allowed_neutral_s2d_ent",
            "player_pass_tds": "oppdef_pass_epa_allowed_neutral_s2d_ent"}.get(market)
    if soft and soft in d:
        rep("vs soft def (allowed top25%)", d[d[soft] >= q(d[soft], .75)])
        rep("vs stout def (allowed bot25%)", d[d[soft] <= q(d[soft], .25)])
    if "oppdef_explosive_pass_allowed_s2d_ent" in d and ngsrc in ("rec", "pass"):
        c = "oppdef_explosive_pass_allowed_s2d_ent"
        rep("vs explosive-pass-prone def(top25%)", d[d[c] >= q(d[c], .75)])

    # (D) defensive L3 allowed to position
    print(" -- opponent L3 allowed to this POSITION --")
    dl3 = {"player_reception_yds": "a_recyds_l3", "player_receptions": "a_rec_l3",
           "player_rush_yds": "a_rushyds_l3", "player_pass_yds": "a_passyds_l3",
           "player_pass_tds": "a_passyds_l3"}.get(market)
    if dl3 and dl3 in d:
        rep(f"def L3 allowed {dl3} top25%", d[d[dl3] >= q(d[dl3], .75)])
        rep(f"def L3 allowed {dl3} bot25%", d[d[dl3] <= q(d[dl3], .25)])

    # combo: soft matchup + rising usage
    if f"{usage}_l3" in d and dl3 in d:
        print(" -- COMBO: rising usage + soft L3 matchup --")
        m = (d.use_trend > 0) & (d[dl3] >= q(d[dl3], .6))
        rep("usage rising & def L3 soft(top40%)", d[m])


def main():
    s = build_spine()
    s = add_offense(s)
    s = add_ngs(s)
    s = add_def_team(s)
    s = add_def_l3(s)
    print(f"spine rows: {len(s)}  | feature cols: {s.shape[1]}")
    print(f"per-season: {s.season.value_counts().sort_index().to_dict()}")
    for m in OU_MARKETS:
        mine_market(s, m)


if __name__ == "__main__":
    main()
