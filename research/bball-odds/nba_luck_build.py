#!/usr/bin/env python3
"""Team-level LUCK panel for the NBA — who has been getting bounces and who has not.

This is the MLB question ported to basketball, and it is a different question from the
player-heat work in nba_player_regression.py. Heat asks which PLAYER is finishing above his
own sustainable rate. This asks which TEAM's recent RESULTS overstate or understate how well
it actually played -- a team that lost four straight by three points is not the same team as
one that lost four straight by twenty, and the market does not always tell them apart.

THE ONE DESIGN RULE THAT MATTERS, inherited from control C4 of the heat work: every luck
metric is measured against that team's OWN expanding baseline, never a league average. A
team that always shoots 38% from three is not lucky when it shoots 38%; it is lucky when it
shoots 38% having historically shot 34%. Measuring against the league mean would relabel
every good shooting team as permanently lucky and destroy the signal. That control is the
single reason the player version worked and the naive version lost 7.9%.

Luck families built here, all leak-safe (rolling windows are SHIFTED, baselines EXPANDING
over strictly prior games only):

  SHOOTING LUCK    own 3P% vs own baseline; opponent 3P% ALLOWED vs own baseline. The
                   allowed version is the basketball BABIP -- defenses influence how many
                   threes they concede (rate, a skill) far more than whether those threes
                   drop (pct, mostly luck). So `three_rate_alwd` is the control and
                   `three_pct_alwd` is the luck.
  FINISHING LUCK   FT% vs own baseline. Nearly pure luck over 5-10 games.
  RESULT LUCK      Pythagorean -- actual win rate minus what the point differential implies
                   (exponent 13.91, the standard NBA fit). Plus close-game record, since
                   one-possession games are close to coin flips and a 5-1 record in them
                   is the cleanest "due to regress" signal there is.
  EFFICIENCY LUCK  points per possession vs own baseline, offense and defense.
  MARKET LUCK      recent ATS margin -- how the team has done against the SPREAD rather than
                   against opponents. This is the one that speaks directly to whether the
                   market has already adjusted.
  CONTROLS         strength of schedule faced in the window (a team that looks bad may have
                   played four contenders, which is not luck), and garbage-time share
                   (padding in decided games is not evidence of anything).

GARBAGE TIME. Every metric is computed twice: over all minutes, and over competitive minutes
only. Trailing box-score rates currently include blowout minutes, where both the shooting and
the personnel are unrepresentative. If the luck signal is real it should be CLEANER after
filtering; if filtering does nothing, that is worth knowing too.

Writes data/parquet/nba_team_luck.parquet, one row per team-game, plus a game-level frame
keyed on event_id with home/away differentials (for sides) and sums (for totals).
"""
import glob
import os
import warnings

import numpy as np
import pandas as pd

warnings.filterwarnings("ignore")

ROOT = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(ROOT, "data", "parquet")
RAW = os.path.join(ROOT, "data", "raw", "nba_pbp")

PYTH_EXP = 13.91        # standard NBA Pythagorean exponent
WINDOWS = (5, 10)       # trailing game counts
MIN_BASE = 15           # games required before a team's own baseline is trusted
CLOSE_PTS = 4           # margin defining a "close game"


# ---------------------------------------------------------------------------------------
# garbage time
# ---------------------------------------------------------------------------------------
def garbage_mask(p):
    """True where the game is already decided.

    Two thresholds rather than one, because a 20-point lead means something different with
    3 minutes left than with 11. Regulation only -- if a game reached overtime it was by
    definition not decided, so nothing in it is garbage.
    """
    per = pd.to_numeric(p["period_number"], errors="coerce")
    cm = pd.to_numeric(p["clock_minutes"], errors="coerce").fillna(0)
    cs = pd.to_numeric(p["clock_seconds"], errors="coerce").fillna(0)
    left_in_per = cm * 60 + cs
    secs_left = np.where(per <= 4, (4 - per) * 720 + left_in_per, 0.0)
    marg = (pd.to_numeric(p["home_score"], errors="coerce")
            - pd.to_numeric(p["away_score"], errors="coerce")).abs()
    return (((secs_left <= 360) & (marg >= 18))
            | ((secs_left <= 720) & (marg >= 25))).to_numpy()


def pbp_team_games():
    """Team-game shooting splits from play-by-play, all minutes AND competitive only."""
    cols = ["game_id", "game_date", "team_id", "home_team_id", "away_team_id",
            "type_text", "shooting_play", "scoring_play", "score_value",
            "period_number", "clock_minutes", "clock_seconds",
            "home_score", "away_score", "season_type"]
    P = pd.concat([pd.read_parquet(f, columns=cols)
                   for f in sorted(glob.glob(f"{RAW}/pbp_*.parquet"))], ignore_index=True)
    P = P[(P["shooting_play"] == True) & P["team_id"].notna()].copy()
    P["is_ft"] = P["type_text"].str.contains("Free Throw", case=False, na=False)
    P["made"] = (P["scoring_play"] == True).astype(float)
    P["is3"] = (pd.to_numeric(P["score_value"], errors="coerce") == 3) | \
               P["type_text"].str.contains("Three Point", case=False, na=False)
    P["gt"] = garbage_mask(P)

    def agg(df, tag):
        fg = df[~df["is_ft"]]
        ft = df[df["is_ft"]]
        a = fg.groupby(["game_id", "team_id"]).agg(
            **{f"fga{tag}": ("made", "size"), f"fgm{tag}": ("made", "sum")})
        t3 = fg[fg["is3"]].groupby(["game_id", "team_id"]).agg(
            **{f"fg3a{tag}": ("made", "size"), f"fg3m{tag}": ("made", "sum")})
        f = ft.groupby(["game_id", "team_id"]).agg(
            **{f"fta{tag}": ("made", "size"), f"ftm{tag}": ("made", "sum")})
        return a.join(t3, how="left").join(f, how="left")

    allm = agg(P, "")
    comp = agg(P[~P["gt"]], "_c")
    # home_team_id must be carried through the aggregation -- without it `is_home` is all
    # False downstream, the home frame comes out empty, and the game-level inner join
    # silently returns zero rows rather than erroring.
    G = P.groupby(["game_id", "team_id"]).agg(
        date=("game_date", "first"), gt_plays=("gt", "sum"), n_plays=("gt", "size"),
        home_team_id=("home_team_id", "first"),
        away_team_id=("away_team_id", "first")).join(allm).join(comp).reset_index()
    G["gt_share"] = G["gt_plays"] / G["n_plays"].clip(lower=1)
    return G


# ---------------------------------------------------------------------------------------
# panel
# ---------------------------------------------------------------------------------------
def base_panel():
    """One row per team-game: own stats, opponent stats, score, and the ESPN game key."""
    G = pbp_team_games()

    # opponent = the other team in the same game
    opp = G.copy()
    opp.columns = [c if c in ("game_id",) else f"o_{c}" for c in opp.columns]
    M = G.merge(opp, on="game_id")
    M = M[M["team_id"] != M["o_team_id"]].copy()

    R = pd.read_parquet(f"{OUT}/games_nba.parquet").dropna(subset=["espn_id"])
    R["game_id"] = pd.to_numeric(R["espn_id"], errors="coerce")
    # games_nba carries a handful of games TWICE under different event_ids -- the same
    # espn_id with commence_times an hour apart (an Odds API duplicate listing). Left
    # unhandled it fans every affected team-game out into two rows and the game count comes
    # out ABOVE the true number of games, which is the tell.
    R = R.sort_values("commence_time").drop_duplicates("game_id", keep="first")
    M["game_id"] = pd.to_numeric(M["game_id"], errors="coerce")
    M = M.merge(R[["game_id", "event_id", "season", "commence_time",
                   "home_team", "away_team", "home_score", "away_score"]], on="game_id")

    # which side is this row? PBP team_id vs the game's home id
    assert "home_team_id" in M.columns, "home_team_id lost in aggregation"
    M["is_home"] = (pd.to_numeric(M["team_id"], errors="coerce")
                    == pd.to_numeric(M["home_team_id"], errors="coerce"))
    assert M["is_home"].mean() > 0.4, f"is_home implausible ({M['is_home'].mean():.2f})"
    M["pts"] = np.where(M["is_home"], M["home_score"], M["away_score"])
    M["opp_pts"] = np.where(M["is_home"], M["away_score"], M["home_score"])
    M["margin"] = M["pts"] - M["opp_pts"]
    M["won"] = (M["margin"] > 0).astype(float)
    M["date"] = pd.to_datetime(M["commence_time"]).dt.tz_localize(None)

    for tag in ("", "_c"):
        M[f"three_pct{tag}"] = M[f"fg3m{tag}"] / M[f"fg3a{tag}"].clip(lower=1)
        M[f"three_rate{tag}"] = M[f"fg3a{tag}"] / M[f"fga{tag}"].clip(lower=1)
        M[f"ft_pct{tag}"] = M[f"ftm{tag}"] / M[f"fta{tag}"].clip(lower=1)
        M[f"efg{tag}"] = (M[f"fgm{tag}"] + 0.5 * M[f"fg3m{tag}"]) / M[f"fga{tag}"].clip(lower=1)
        M[f"three_pct_alwd{tag}"] = M[f"o_fg3m{tag}"] / M[f"o_fg3a{tag}"].clip(lower=1)
        M[f"three_rate_alwd{tag}"] = M[f"o_fg3a{tag}"] / M[f"o_fga{tag}"].clip(lower=1)
        M[f"efg_alwd{tag}"] = (M[f"o_fgm{tag}"] + 0.5 * M[f"o_fg3m{tag}"]) / \
                              M[f"o_fga{tag}"].clip(lower=1)

    # possessions and efficiency (box approximation; no TO column in PBP so this is
    # shot-and-FT based, which is fine for a WITHIN-team change measure)
    M["poss"] = M["fga"] + 0.44 * M["fta"]
    M["off_eff"] = M["pts"] / M["poss"].clip(lower=1)
    M["def_eff"] = M["opp_pts"] / (M["o_fga"] + 0.44 * M["o_fta"]).clip(lower=1)
    M["close"] = (M["margin"].abs() <= CLOSE_PTS).astype(float)
    M["close_win"] = M["close"] * M["won"]
    M = M.drop_duplicates(["game_id", "team_id"])
    assert len(M) == 2 * M["event_id"].nunique(), \
        f"panel is not exactly two rows per game ({len(M)} vs {2*M['event_id'].nunique()})"
    return M.sort_values(["team_id", "date"]).reset_index(drop=True)


LUCK_RAW = ["three_pct", "three_pct_alwd", "ft_pct", "efg", "efg_alwd",
            "off_eff", "def_eff", "three_rate", "three_rate_alwd"]


def luck_features(M):
    """recent-minus-own-baseline for every metric, at each window. All strictly prior."""
    g = M.groupby("team_id", sort=False)
    for c in LUCK_RAW + ["margin", "won", "pts", "opp_pts", "close", "close_win", "gt_share"] + \
             [f"{x}_c" for x in ("three_pct", "three_pct_alwd", "ft_pct", "efg", "efg_alwd")]:
        if c not in M.columns:
            continue
        pri = g[c].shift(1)
        M[f"base_{c}"] = pri.groupby(M["team_id"]).expanding().mean() \
                            .reset_index(level=0, drop=True)
        M[f"cnt_{c}"] = pri.groupby(M["team_id"]).expanding().count() \
                           .reset_index(level=0, drop=True)
        for w in WINDOWS:
            M[f"r{w}_{c}"] = pri.groupby(M["team_id"]).rolling(w, min_periods=w) \
                                .mean().reset_index(level=0, drop=True)

    for w in WINDOWS:
        for c in LUCK_RAW + [f"{x}_c" for x in ("three_pct", "three_pct_alwd", "ft_pct",
                                                "efg", "efg_alwd")]:
            if f"r{w}_{c}" not in M.columns:
                continue
            v = M[f"r{w}_{c}"] - M[f"base_{c}"]
            M[f"luck{w}_{c}"] = v.where(M[f"cnt_{c}"] >= MIN_BASE)

        # Pythagorean: how much the recent WIN RATE exceeds what the recent point
        # differential says it should have been. Positive = won more than it deserved.
        pf = M[f"r{w}_pts"] * w
        pa = M[f"r{w}_opp_pts"] * w
        exp_w = pf ** PYTH_EXP / (pf ** PYTH_EXP + pa ** PYTH_EXP)
        M[f"luck{w}_pyth"] = M[f"r{w}_won"] - exp_w

        # close-game luck: record in one-possession games minus a coin flip, scaled by how
        # many of them there were. A 3-0 run in close games is weaker evidence than 6-0.
        M[f"luck{w}_close"] = (M[f"r{w}_close_win"] - 0.5 * M[f"r{w}_close"])

        # margin luck: recent margin vs the team's own baseline margin
        M[f"luck{w}_margin"] = (M[f"r{w}_margin"] - M["base_margin"]).where(
            M["cnt_margin"] >= MIN_BASE)
    return M


def sos_and_market(M):
    """Opponent strength faced (the control) and ATS margin (the market-facing metric)."""
    # opponent's own baseline margin at the time of the game -> average quality faced
    key = M[["game_id", "team_id", "base_margin"]].rename(
        columns={"team_id": "o_team_id", "base_margin": "opp_quality"}) \
        .drop_duplicates(["game_id", "o_team_id"])
    M = M.merge(key, on=["game_id", "o_team_id"], how="left")
    g = M.groupby("team_id", sort=False)
    pri = g["opp_quality"].shift(1)
    for w in WINDOWS:
        M[f"sos{w}"] = pri.groupby(M["team_id"]).rolling(w, min_periods=w).mean() \
                          .reset_index(level=0, drop=True)

    # ATS margin: how the team did against the closing spread, its own recent history
    mv = pd.read_parquet(f"{OUT}/movement_games_nba.parquet")
    if "t60_spread_home_point" in mv.columns:
        mv = mv[["event_id", "t60_spread_home_point"]].drop_duplicates("event_id")
        M = M.merge(mv, on="event_id", how="left")
        sp = pd.to_numeric(M["t60_spread_home_point"], errors="coerce")
        # team's own spread: home number as-is, away number negated
        M["team_spread"] = np.where(M["is_home"], sp, -sp)
        M["ats_marg"] = M["margin"] + M["team_spread"]
        pri = M.groupby("team_id", sort=False)["ats_marg"].shift(1)
        for w in WINDOWS:
            M[f"luck{w}_ats"] = pri.groupby(M["team_id"]).rolling(w, min_periods=w).mean() \
                                   .reset_index(level=0, drop=True)
    return M


def to_game_level(M):
    """Home/away differentials (for sides) and sums (for totals), keyed on event_id."""
    feats = [c for c in M.columns if c.startswith("luck") or c.startswith("sos")] + \
            ["gt_share", "base_margin"]
    feats = [c for c in dict.fromkeys(feats) if c in M.columns]
    h = M[M["is_home"]].set_index("event_id")[feats].add_prefix("h_")
    a = M[~M["is_home"]].set_index("event_id")[feats].add_prefix("a_")
    G = h.join(a, how="inner")
    for c in feats:
        G[f"d_{c}"] = G[f"h_{c}"] - G[f"a_{c}"]     # sides
        G[f"s_{c}"] = G[f"h_{c}"] + G[f"a_{c}"]     # totals
    return G.reset_index()


def main():
    M = base_panel()
    print(f"team-games: {len(M):,}  games: {M['event_id'].nunique():,}", flush=True)
    M = luck_features(M)
    M = sos_and_market(M)
    M.to_parquet(f"{OUT}/nba_team_luck.parquet", index=False)

    G = to_game_level(M)
    G.to_parquet(f"{OUT}/nba_team_luck_games.parquet", index=False)
    nf = len([c for c in G.columns if c.startswith("d_")])
    print(f"game-level: {len(G):,} games, {nf} differential features", flush=True)

    # leak tripwire: a team's first game must have no trailing feature of any kind
    first = M.groupby("team_id").head(1)
    lk = [c for c in M.columns if c.startswith("luck") or c.startswith("sos")]
    bad = [c for c in lk if first[c].notna().any()]
    assert not bad, f"TRAILING FEATURE LEAKED INTO A TEAM'S FIRST GAME: {bad[:5]}"
    print("leak check passed", flush=True)


if __name__ == "__main__":
    main()
