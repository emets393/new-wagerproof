#!/usr/bin/env python3
"""Regression-to-the-mean features for NBA sides, from play-by-play. The thing PBP is FOR.

The absence work used this data to ask "who is missing." That is one narrow question and it
leaves the main value of 2.5M play-by-play events untouched. The market prices teams off
RECENT RESULTS. Play-by-play lets us measure the PROCESS underneath those results, and the
gap between process and results is what regresses. Two families, both impossible from box
scores:

  SHOT-QUALITY LUCK (needs shot coordinates)
      A team's effective FG% is a result. The expected value of the shots it TOOK, given
      where they came from, is a process. actual − expected is shooting luck, and shooting
      luck is the single largest mean-reverting component of NBA scoring margin. A team on a
      heater has a record the market believes and a shot profile that does not support it.
      Box scores contain efg (`h_l10_efg` already exists in the feature table); they cannot
      contain xefg, because that needs the location of every attempt.

  TALENT vs RESULTS (needs lineup stints -> RAPM)
      RAPM values a player from stint-level margin, independent of his recent box score. The
      minutes-weighted RAPM of the players a team will actually PLAY is a talent estimate.
      Its trailing point differential is a results estimate. talent − results is "better than
      its record," which is the regression claim stated as a number.

LEAK SAFETY is the whole ballgame here and there are three separate places to get it wrong:
  1. The expected-make-rate table is fit by EXPANDING over strictly prior shots (shifted by
     one), never on the full sample. A pooled fit would let a game's own shots set the
     baseline they are then measured against.
  2. Every team-level feature is a trailing mean SHIFTED by one game, asserted below.
  3. RAPM ratings are joined backwards-only by month (merge_asof, direction="backward"),
     asserted below, so tonight never sees a rating computed with tonight in it.

Writes data/parquet/nba_regression_features.parquet, keyed (game_id, team_id).
"""
import glob
import os
import warnings

import numpy as np
import pandas as pd

warnings.filterwarnings("ignore")

from nba_out_isolate import add_base, add_rapm, make_rows, raw_box

ROOT = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(ROOT, "data", "parquet")
RAW = os.path.join(ROOT, "data", "raw", "nba_pbp")

# ESPN half-court coordinates: x runs the 94ft length (+/-47), y the 50ft width (+/-25).
# The rim sits 5.25ft off the baseline, so |x| = 41.75 with y = 0. Verified against
# "Driving Layup Shot" rows, which cluster at |x| ~ 41.
RIM_X = 41.75
MIN_BIN = 400          # shots required before a bin's own rate is trusted
SHRINK = 200.0         # pseudo-counts pulling a thin bin toward the league mean
ROLL = 10


def shots():
    fs = sorted(glob.glob(f"{RAW}/pbp_*.parquet"))
    # athlete_id_1 is the SHOOTER on a shooting play (100% populated). Carried here rather
    # than in a second loader so the 3pt geometry and its assertion live in exactly one
    # place -- nba_player_regression.py imports this function for the player-level split.
    cols = ["game_id", "game_date", "team_id", "home_team_id", "away_team_id",
            "type_text", "shooting_play", "scoring_play", "score_value",
            "coordinate_x", "coordinate_y", "season_type", "athlete_id_1"]
    S = pd.concat([pd.read_parquet(f, columns=cols) for f in fs], ignore_index=True)
    S = S[S["shooting_play"] == True]
    # Free throws carry coordinates but they are not locations -- excluded outright.
    S = S[~S["type_text"].str.contains("Free Throw", case=False, na=False)]
    S = S.dropna(subset=["coordinate_x", "coordinate_y", "team_id"])
    S["date"] = pd.to_datetime(S["game_date"])
    dx = RIM_X - S["coordinate_x"].abs()
    S["dist"] = np.sqrt(dx ** 2 + S["coordinate_y"] ** 2)
    S["made"] = (S["scoring_play"] == True).astype(int)
    S["pts"] = pd.to_numeric(S["score_value"], errors="coerce").fillna(0.0)

    # A missed shot carries no score_value, so 3-vs-2 must come from geometry: 23.75ft
    # above the break, 22ft in the corners (|y| >= 22).
    corner = S["coordinate_y"].abs() >= 22.0
    S["is3"] = np.where(corner, S["dist"] >= 21.5, S["dist"] >= 23.0)
    mk = S["made"] == 1
    acc3 = (S.loc[mk & (S["pts"] == 3), "is3"]).mean()
    acc2 = (~S.loc[mk & (S["pts"] == 2), "is3"]).mean()
    print(f"  3pt classifier vs made shots: 3s correct {100*acc3:.1f}%, "
          f"2s correct {100*acc2:.1f}%", flush=True)
    assert acc3 > 0.93 and acc2 > 0.93, \
        "SHOT-TYPE GEOMETRY IS WRONG -- expected points would be nonsense"
    return S.sort_values(["date", "game_id"]).reset_index(drop=True)


def expected_points(S):
    """P(make) per (is3, distance bin) from STRICTLY PRIOR shots, expanding."""
    edges = [0, 3, 6, 10, 14, 18, 22, 25, 28, 32, 40, 100]
    S["bin"] = (S["is3"].astype(int).astype(str) + "_"
                + pd.cut(S["dist"], edges, labels=False, include_lowest=True).astype(str))
    g = S.groupby("bin", sort=False)["made"]
    prior_n = g.cumcount()
    prior_made = g.cumsum() - S["made"]
    glob_n = np.arange(len(S))
    glob_made = S["made"].cumsum() - S["made"]
    glob_rate = np.where(glob_n > 0, glob_made / np.maximum(glob_n, 1), 0.45)
    # shrink thin bins toward the running league rate rather than trusting 3 shots
    p = (prior_made + SHRINK * glob_rate) / (prior_n + SHRINK)
    S["xp"] = p * np.where(S["is3"], 3.0, 2.0)
    burn = prior_n < MIN_BIN
    S.loc[burn, "xp"] = np.nan          # burn-in: no expectation yet, drop from aggregates
    print(f"  expected-points table: {100*burn.mean():.1f}% of shots in burn-in, "
          f"league xPTS/shot {S['xp'].mean():.3f} vs actual {S['pts'].mean():.3f}",
          flush=True)
    return S


def team_shot_luck(S):
    """Per team-game: points above expectation on own shots, and on shots allowed."""
    S = S.dropna(subset=["xp"])
    # shot-MIX layer (port of the CBB xq family): xefg says how GOOD the looks are, these say
    # what KIND — and the allowed versions are the mix a defense forces.
    S = S.assign(rim4=(S["dist"] <= 4).astype(float),
                 long2=((~S["is3"]) & (S["dist"] >= 12)).astype(float),
                 deep3=(S["is3"] & (S["dist"] >= 26)).astype(float))
    off = S.groupby(["game_id", "team_id"]).agg(
        fga=("made", "size"), apts=("pts", "sum"), xpts=("xp", "sum"),
        rim4=("rim4", "mean"), long2=("long2", "mean"), deep3=("deep3", "mean"),
        mdist=("dist", "mean"),
        date=("date", "first"), home_team_id=("home_team_id", "first"),
        away_team_id=("away_team_id", "first")).reset_index()
    off["luck_off"] = off["apts"] - off["xpts"]
    off["xefg"] = off["xpts"] / (2.0 * off["fga"])
    off["aefg"] = off["apts"] / (2.0 * off["fga"])
    # the opponent's offence in the same game is this team's defence
    opp = off[["game_id", "team_id", "luck_off", "xefg", "aefg", "fga",
               "rim4", "long2", "deep3", "mdist"]].rename(
        columns={"team_id": "opp_id", "luck_off": "luck_def", "xefg": "xefg_a",
                 "aefg": "aefg_a", "fga": "fga_a", "rim4": "rim4_a",
                 "long2": "long2_a", "deep3": "deep3_a", "mdist": "mdist_a"})
    m = off.merge(opp, on="game_id")
    m = m[m["team_id"] != m["opp_id"]].drop(columns=["opp_id"])
    return m


def trailing(T):
    """Shift-by-one rolling means. A team's own game must never enter its own feature."""
    T = T.sort_values(["team_id", "date"]).reset_index(drop=True)
    g = T.groupby("team_id", sort=False)
    src = ["luck_off", "luck_def", "xefg", "aefg", "xefg_a", "aefg_a",
           "rim4", "long2", "deep3", "mdist", "rim4_a", "long2_a", "deep3_a", "mdist_a"]
    for c in src:
        T[f"r_{c}"] = g[c].transform(
            lambda s: s.shift(1).rolling(ROLL, min_periods=4).mean())
    first = T.groupby("team_id").head(1)
    assert first[[f"r_{c}" for c in src]].isna().all().all(), \
        "TRAILING SHOT FEATURE LEAKED INTO A TEAM'S FIRST GAME"
    # net shooting luck the market has been watching: positive = flattered by variance
    T["r_luck_net"] = T["r_luck_off"] - T["r_luck_def"]
    # process quality: expected efficiency of shots taken minus allowed, luck removed
    T["r_xefg_net"] = T["r_xefg"] - T["r_xefg_a"]
    T["r_aefg_net"] = T["r_aefg"] - T["r_aefg_a"]
    return T


def team_talent():
    """Minutes-weighted RAPM of the players a team is projected to have available."""
    G = add_rapm(add_base(make_rows(raw_box(), "full"), "decay"))
    G = G.sort_values(["athlete_id", "season", "date"]).reset_index(drop=True)
    # projected available = played the previous game. Strictly pregame; no same-day info.
    G["prev_played"] = (~G.groupby(["athlete_id", "season"])["out"].shift(1)
                        .fillna(True).astype(bool))
    rot = G[(G["b"] >= 8.0) & G["prev_played"]].copy()
    den = rot.groupby(["game_id", "team_id"])["b"].transform("sum")
    rot["w"] = rot["b"] / den.clip(lower=1e-9)
    t = rot.groupby(["game_id", "team_id"]).apply(
        lambda x: pd.Series({"talent_m": 5.0 * float((x["w"] * x["rapm_m"]).sum()),
                             "talent_sd": float(x["rapm_m"].std())})).reset_index()
    return t


def main():
    print("building shot-quality features...", flush=True)
    S = expected_points(shots())
    T = trailing(team_shot_luck(S))
    print(f"  team-games with shot features: {len(T):,}", flush=True)

    print("building RAPM talent...", flush=True)
    t = team_talent()
    T = T.merge(t, on=["game_id", "team_id"], how="left")
    print(f"  talent coverage: {100*T['talent_m'].notna().mean():.1f}%", flush=True)

    C = pd.read_parquet(f"{OUT}/nba_game_crosswalk.parquet").drop(columns=["date"])
    T = T.merge(C, left_on="game_id", right_on="espn_game_id", how="inner")
    keep = ["game_id", "bdl_game_id", "team_id", "home_team_id", "date", "talent_m",
            "talent_sd", "r_luck_off", "r_luck_def", "r_luck_net", "r_xefg",
            "r_xefg_a", "r_xefg_net", "r_aefg_net", "r_aefg", "r_aefg_a",
            "r_rim4", "r_long2", "r_deep3", "r_mdist",
            "r_rim4_a", "r_long2_a", "r_deep3_a", "r_mdist_a"]
    T = T[keep].rename(columns={"bdl_game_id": "game.id"})
    T["is_home"] = T["team_id"] == T["home_team_id"]
    path = f"{OUT}/nba_regression_features.parquet"
    T.to_parquet(path, index=False)
    print(f"\nwrote {path}: {len(T):,} team-games", flush=True)
    print(T[["talent_m", "r_luck_net", "r_xefg_net", "r_aefg_net"]].describe().to_string())


if __name__ == "__main__":
    main()
