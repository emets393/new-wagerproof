"""Build the team-game panel for situational attribution.

The owner's framing, and it is a better one than every prior NBA search here: a scenario
should be measured as POINTS OF ATTRIBUTION -- how much does being in this spot move a
team's margin against the number, and how much does it move the game total -- and that
attribution should be allowed to differ by what KIND of team is in the spot. Not "does
this cell hit 55% ATS".

So this file explodes every game into two team-rows (the NFL `nfl_analysis_base` pattern)
and adds the three things the research frame never had:

  1. ROAD TRIP STRUCTURE   trip leg, trip length, games left on the trip, homestand leg,
                           and the schedule LOOKAHEAD (next game away? how many days?).
                           Lookahead is legal here -- the schedule is public months ahead,
                           so "one day off then another road game" is knowable pregame.
  2. OPPONENT-STYLE SEQUENCE  the pace/efficiency of the opponents faced in the last 3
                           games, so "third fast-paced opponent in a row" is expressible.
  3. ROSTER EXPERIENCE     minutes-weighted years-since-draft of the rotation. Not literal
                           age -- balldontlie carries draft_year, not birthdate -- but
                           veteran-ness is the variable the age question is really about,
                           and 21.6% of player-games are undrafted so coverage is tracked.

Everything trailing is leak-safe: computed on games strictly BEFORE the row's game.

Writes data/parquet/nba_dims_panel.parquet.
"""
from __future__ import annotations
import numpy as np
import pandas as pd

FRAME = "data/parquet/nba_hunt_frame2.parquet"
BDL = "data/parquet/bdl_player_box.parquet"
OUT = "data/parquet/nba_dims_panel.parquet"

# own/opponent box stats lifted per team perspective. l10 is the archetype window (what
# kind of team is this), l3 is the form window (what has it been doing lately).
BOX = [
    "pace", "off_eff", "def_eff", "efg", "efg_alwd", "p3a_rate", "p3a_rate_alwd",
    "p3_pct", "orb_pct", "drb_pct", "tov_rate", "tov_forced", "ftr", "ftr_alwd",
    "top_scorer_share", "hhi", "top3_min", "n_played", "ast_rate",
]
BOX_W = ["l3", "l10"]

# per-side context columns that carry an h_/a_ prefix in the frame
SIDE = [
    "rest_days", "b2b", "g_last7", "km_7d", "km_14d", "venues_7d",
    "trav_km", "trav_tz", "alt_m", "days_since_home",
]


def explode(df: pd.DataFrame) -> pd.DataFrame:
    """One row per team per game, with every outcome stated from that team's point of view."""
    rows = []
    for side in ("home", "away"):
        is_home = side == "home"
        p, o = ("h", "a") if is_home else ("a", "h")
        bp, bo = ("hb", "ab") if is_home else ("ab", "hb")
        d = pd.DataFrame(index=df.index)
        d["event_id"] = df["event_id"]
        d["season"] = df["season"]
        d["commence_time"] = df["commence_time"]
        d["team"] = df["home_team"] if is_home else df["away_team"]
        d["opp"] = df["away_team"] if is_home else df["home_team"]
        d["is_home"] = int(is_home)
        d["postseason"] = df.get("postseason", 0)

        own_pts = df["home_score"] if is_home else df["away_score"]
        opp_pts = df["away_score"] if is_home else df["home_score"]
        d["own_pts"] = own_pts
        d["opp_pts"] = opp_pts
        d["margin"] = own_pts - opp_pts
        d["game_total"] = own_pts + opp_pts

        # team-perspective spread. frame stores the HOME number, so the away team's is negated.
        sp_h = df["t60_spread_home_point"]
        d["spread"] = sp_h if is_home else -sp_h
        d["total_line"] = df["t60_total_point"]
        # THE outcome the owner asked for: points of plus/minus against the number.
        # positive = this team beat the spread by that many points.
        d["ats_pts"] = d["margin"] + d["spread"]
        d["tot_resid"] = d["game_total"] - d["total_line"]
        d["is_fav"] = (d["spread"] < 0).astype(int)
        d["ml_price"] = (df["t60_ml_home_price"] if is_home else df["t60_ml_away_price"])
        d["spread_price"] = (df["t60_spread_home_price"] if is_home else df["t60_spread_away_price"])
        d["tot_over_price"] = df["t60_total_over_price"]
        d["tot_under_price"] = df["t60_total_under_price"]
        d["open_spread"] = (df["open_spread_home_point"] if is_home
                            else -df["open_spread_home_point"])
        d["open_total"] = df["open_total_point"]

        for c in SIDE:
            if f"{p}_{c}" in df.columns:
                d[f"own_{c}"] = df[f"{p}_{c}"]
                d[f"opp_{c}"] = df[f"{o}_{c}"]
        for w in BOX_W:
            for c in BOX:
                if f"{bp}_{w}_{c}" in df.columns:
                    d[f"own_{w}_{c}"] = df[f"{bp}_{w}_{c}"]
                    d[f"opp_{w}_{c}"] = df[f"{bo}_{w}_{c}"]
        for c in ("gp", "season_frac"):
            if f"st_{p}_{c}" in df.columns:
                d[f"own_{c}"] = df[f"st_{p}_{c}"]
                d[f"opp_{c}"] = df[f"st_{o}_{c}"]
        for c in ("is_conference", "is_divisional", "is_cup"):
            if c in df.columns:
                d[c] = df[c]
        rows.append(d)
    out = pd.concat(rows, ignore_index=True)
    out["date"] = out["commence_time"].dt.tz_convert("America/New_York").dt.normalize().dt.tz_localize(None)
    return out.sort_values(["team", "commence_time"]).reset_index(drop=True)


def add_trip_structure(pan: pd.DataFrame) -> pd.DataFrame:
    """Road-trip position, homestand position, and the schedule lookahead.

    A 'trip' is a maximal run of consecutive away games for one team within one season.
    leg 1 is the first game of the trip. Home games get leg 0. The lookahead columns are
    what make the owner's spot expressible -- 'second game of a road trip, one day off,
    then another road game' is (trip_leg==2) & (next_rest==1) & (next_is_away==1).
    """
    pan = pan.sort_values(["team", "season", "commence_time"]).reset_index(drop=True)
    g = pan.groupby(["team", "season"], sort=False)

    away = 1 - pan["is_home"]
    # run id increments whenever the home/away state flips
    flip = g["is_home"].transform(lambda s: (s != s.shift()).cumsum())
    pan["_run"] = flip
    run = pan.groupby(["team", "season", "_run"], sort=False)
    pos = run.cumcount() + 1
    runlen = run["is_home"].transform("size")

    pan["trip_leg"] = np.where(away == 1, pos, 0)
    pan["trip_len"] = np.where(away == 1, runlen, 0)
    pan["trip_left"] = np.where(away == 1, runlen - pos, 0)
    pan["homestand_leg"] = np.where(pan["is_home"] == 1, pos, 0)
    pan["is_last_of_trip"] = ((away == 1) & (pos == runlen)).astype(int)

    # lookahead -- schedule is public, so this is pregame-knowable
    nxt = g["commence_time"].shift(-1)
    pan["next_rest"] = (nxt - pan["commence_time"]).dt.total_seconds() / 86400.0
    pan["next_rest"] = np.floor(pan["next_rest"]).clip(0, 10)
    pan["next_is_away"] = (1 - g["is_home"].shift(-1)).fillna(-1)
    # a genuine "sandwich": short rest before AND after
    pan["sandwich"] = ((pan["own_rest_days"] <= 1) & (pan["next_rest"] <= 1)).astype(int)

    # previous game result (leak-safe by construction: shift(1))
    for c, nm in (("margin", "prev_margin"), ("ats_pts", "prev_ats"),
                  ("tot_resid", "prev_tot_resid"), ("is_home", "prev_was_home")):
        pan[nm] = g[c].shift(1)
    pan["prev_blowout_win"] = (pan["prev_margin"] >= 15).astype(float)
    pan["prev_blowout_loss"] = (pan["prev_margin"] <= -15).astype(float)
    pan.loc[pan["prev_margin"].isna(), ["prev_blowout_win", "prev_blowout_loss"]] = np.nan
    return pan.drop(columns=["_run"])


def add_opponent_sequence(pan: pd.DataFrame) -> pd.DataFrame:
    """Style of the opponents faced in the recent past.

    'Third fast-paced team in a row' needs the pace of the teams I just played, valued as
    they were at the time -- which is exactly opp_l10_pace on my previous rows. shift(1)
    keeps it strictly prior.
    """
    pan = pan.sort_values(["team", "season", "commence_time"]).reset_index(drop=True)
    g = pan.groupby(["team", "season"], sort=False)
    for src, nm in (("opp_l10_pace", "seq_opp_pace"), ("opp_l10_off_eff", "seq_opp_off"),
                    ("opp_l10_def_eff", "seq_opp_def")):
        if src not in pan.columns:
            continue
        prior = g[src].shift(1)
        pan[f"{nm}3"] = prior.groupby([pan["team"], pan["season"]]).transform(
            lambda s: s.rolling(3, min_periods=2).mean())
    # how many of the last 3 opponents were top-third pace (league-relative, computed below)
    return pan


def add_experience(pan: pd.DataFrame) -> pd.DataFrame:
    """Minutes-weighted years-since-draft of the rotation, from the trailing 10 games.

    balldontlie has draft_year but no birthdate, so this is experience rather than age.
    That is arguably the variable the question is actually about -- a team of 8-year vets
    versus a team of rookies -- but it is not age and is not labelled as such. Undrafted
    players (21.6% of player-games) carry no draft_year and are excluded from the weighting;
    exp_cov records what share of the team's minutes the number is built from.
    """
    bdl = pd.read_parquet(BDL, columns=["min", "player.draft_year", "team.full_name",
                                        "game.date", "game.season"])
    bdl = bdl.rename(columns={"player.draft_year": "draft_year",
                              "team.full_name": "team", "game.date": "date",
                              "game.season": "syear"})
    # 'min' arrives as a string like '37' or '37:12' in places
    mins = bdl["min"].astype(str).str.split(":").str[0]
    bdl["mins"] = pd.to_numeric(mins, errors="coerce").fillna(0.0)
    bdl["date"] = pd.to_datetime(bdl["date"])
    bdl["exp"] = bdl["syear"] - bdl["draft_year"]
    bdl = bdl[bdl["mins"] > 0]

    ok = bdl["exp"].notna()
    num = (bdl["mins"] * bdl["exp"]).where(ok, 0).groupby([bdl["team"], bdl["date"]]).sum()
    den = bdl["mins"].where(ok, 0).groupby([bdl["team"], bdl["date"]]).sum()
    tot = bdl["mins"].groupby([bdl["team"], bdl["date"]]).sum()
    gm = pd.DataFrame({"exp_g": num / den.replace(0, np.nan), "cov_g": den / tot}).reset_index()

    pan = pan.merge(gm, on=["team", "date"], how="left")
    pan = pan.sort_values(["team", "season", "commence_time"]).reset_index(drop=True)
    g = pan.groupby(["team", "season"], sort=False)
    # trailing 10 games, shifted -- the rotation as it was before tonight
    pan["own_exp"] = g["exp_g"].transform(lambda s: s.shift(1).rolling(10, min_periods=3).mean())
    pan["exp_cov"] = g["cov_g"].transform(lambda s: s.shift(1).rolling(10, min_periods=3).mean())
    return pan.drop(columns=["exp_g", "cov_g"])


def attach_opponent_view(pan: pd.DataFrame) -> pd.DataFrame:
    """Give every row its opponent's situational columns.

    The owner's point is that the spot is a two-sided thing: a tired road team into a
    rested home team is a different game from a tired road team into an equally tired one.
    So every situation column gets an o_* twin taken from the opponent's own row.
    """
    keys = ["event_id", "team"]
    take = ["trip_leg", "trip_len", "trip_left", "homestand_leg", "is_last_of_trip",
            "next_rest", "next_is_away", "sandwich", "prev_margin", "prev_ats",
            "prev_blowout_win", "prev_blowout_loss", "own_exp",
            "seq_opp_pace3", "seq_opp_off3", "seq_opp_def3"]
    take = [c for c in take if c in pan.columns]
    mirror = pan[["event_id", "team"] + take].rename(
        columns={"team": "opp", **{c: f"o_{c}" for c in take}})
    return pan.merge(mirror, on=["event_id", "opp"], how="left")


def main() -> None:
    df = pd.read_parquet(FRAME)
    pan = explode(df)
    pan = add_trip_structure(pan)
    pan = add_opponent_sequence(pan)
    pan = add_experience(pan)
    pan = attach_opponent_view(pan)
    pan.to_parquet(OUT, index=False)

    print(f"panel {pan.shape[0]} team-games x {pan.shape[1]} cols -> {OUT}")
    print("\nexperience coverage (share of team minutes with a draft year):",
          round(float(pan["exp_cov"].mean()), 3))
    print("own_exp  mean %.2f  p10 %.2f  p90 %.2f  null %.1f%%" % (
        pan["own_exp"].mean(), pan["own_exp"].quantile(.10), pan["own_exp"].quantile(.90),
        100 * pan["own_exp"].isna().mean()))
    print("\ntrip_leg distribution:")
    print(pan["trip_leg"].value_counts().sort_index().head(9).to_string())
    print("\nlongest trips seen:", pan["trip_len"].max())
    print("\nnext_rest distribution (days to the team's next game):")
    print(pan["next_rest"].value_counts().sort_index().head(6).to_string())
    print("\nseq_opp_pace3 mean %.2f sd %.2f null %.1f%%" % (
        pan["seq_opp_pace3"].mean(), pan["seq_opp_pace3"].std(),
        100 * pan["seq_opp_pace3"].isna().mean()))
    print("\nsanity -- ats_pts should average ~0 and tot_resid ~0 if the lines are fair:")
    print("  ats_pts  mean %+.3f" % pan["ats_pts"].mean())
    print("  tot_resid mean %+.3f" % pan["tot_resid"].mean())


if __name__ == "__main__":
    main()
