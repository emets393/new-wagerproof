#!/usr/bin/env python3
"""Individual-player regression to the mean, aggregated to a team side. The PBP question.

WHY THIS EXISTS. The first pass at play-by-play used it for two things: who is missing
(absence valuation) and team-level shot quality. Both average over a roster, and averaging
is exactly what destroys the thing worth measuring. A team whose recent hot streak is ONE
high-minute player shooting 8 points per 100 above his own career finishing rate is a
completely different bet from a team where nine players are each a shade warm -- the first
regresses hard and fast, the second barely regresses at all. `d_luck_net` cannot tell those
apart. This file can.

WHAT IS MEASURED, per player, leak-safe:

  own_finish   his OWN long-run points-above-expectation per shot, expanding over strictly
               prior games. This is SKILL, not luck -- good finishers really do beat the
               location model every year, and subtracting a league-average expectation from
               them would flag them as permanently lucky. Requires MIN_FGA prior attempts.
  rec_finish   the same quantity over his trailing ROLL games, shifted by one.
  heat         rec_finish - own_finish. Points per shot he is currently getting ABOVE HIS
               OWN sustainable rate. This is the regression claim stated per player.
  own_x        his career expected points per shot: shot SELECTION quality, which is a
               stable trait and travels with him through role changes.

Aggregated to a team side over the players PROJECTED AVAILABLE (played the previous game,
>= 8 baseline minutes -- identical rule to nba_regression_build.team_talent so availability
logic never diverges between the two files), weighted by shot VOLUME rather than minutes,
because a hot player only regresses to the extent he keeps shooting.

PRE-REGISTERED SIGNS, before any fit (a wrong sign is a result, not a knob):
  P1  team heat should predict the residual NEGATIVE. Hot shooting regresses, and the market
      has priced the results it produced.
  P2  CONCENTRATED heat should predict more negatively than DIFFUSE heat at equal total.
      This is the entire reason for going to player level; if it fails, player granularity
      bought nothing over the team aggregate and I should say exactly that.
  P3  team own_x (career shot selection of tonight's actual rotation) should predict the
      residual POSITIVE, and should matter MOST when the rotation has recently changed,
      because that is when trailing team results are stalest.

Writes data/parquet/nba_player_regression.parquet, keyed (game_id, team_id).
"""
import os
import warnings

import numpy as np
import pandas as pd

warnings.filterwarnings("ignore")

from nba_out_isolate import add_base, make_rows, raw_box
from nba_regression_build import expected_points, shots

ROOT = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(ROOT, "data", "parquet")

ROLL = 10          # games in the "recent" window
MIN_FGA = 150      # prior attempts before a player's own finishing baseline is trusted
MIN_REC = 25       # attempts inside the recent window before "heat" means anything


def player_games(S):
    """Per player-game shot aggregates. athlete_id_1 is the shooter on a shooting play."""
    S = S.dropna(subset=["xp", "athlete_id_1"])
    P = S.groupby(["game_id", "athlete_id_1", "team_id"]).agg(
        fga=("made", "size"), apts=("pts", "sum"), xpts=("xp", "sum"),
        date=("date", "first")).reset_index()
    P = P.rename(columns={"athlete_id_1": "athlete_id"})
    P["athlete_id"] = P["athlete_id"].astype("int64")
    # points above the location model's expectation, per attempt
    P["fin"] = (P["apts"] - P["xpts"]) / P["fga"].clip(lower=1)
    P["xps"] = P["xpts"] / P["fga"].clip(lower=1)
    return P.sort_values(["athlete_id", "date"]).reset_index(drop=True)


def baselines(P):
    """Own long-run baseline (expanding, shifted) and recent form (rolling, shifted).

    Both are volume-weighted -- a 2-attempt night must not swing a per-shot rate as hard as
    a 20-attempt night, which an unweighted mean of `fin` would let it do.
    """
    g = P.groupby("athlete_id", sort=False)
    for c in ("fga", "apts", "xpts"):
        # expanding sums of STRICTLY prior games: cumsum minus tonight
        P[f"c_{c}"] = g[c].cumsum() - P[c]
        P[f"r_{c}"] = g[c].transform(
            lambda s: s.shift(1).rolling(ROLL, min_periods=3).sum())

    P["own_finish"] = (P["c_apts"] - P["c_xpts"]) / P["c_fga"].clip(lower=1)
    P["own_x"] = P["c_xpts"] / P["c_fga"].clip(lower=1)
    P.loc[P["c_fga"] < MIN_FGA, ["own_finish", "own_x"]] = np.nan

    P["rec_finish"] = (P["r_apts"] - P["r_xpts"]) / P["r_fga"].clip(lower=1)
    P.loc[P["r_fga"] < MIN_REC, "rec_finish"] = np.nan

    # the regression claim, per player: shooting above his OWN sustainable rate
    P["heat"] = P["rec_finish"] - P["own_finish"]
    P["rec_fga"] = P["r_fga"] / ROLL          # recent shot volume per game

    first = P.groupby("athlete_id").head(1)
    assert first[["r_fga", "rec_finish"]].isna().all().all(), \
        "PLAYER RECENT FORM LEAKED INTO HIS OWN FIRST GAME"
    assert (P["c_fga"] >= P["fga"] * 0).all() and first["c_fga"].eq(0).all(), \
        "PLAYER CAREER BASELINE INCLUDES TONIGHT"
    return P


def team_rows(P):
    """Aggregate to a team side over the players projected available tonight."""
    G = add_base(make_rows(raw_box(), "full"), "decay")
    # projected available = played the previous game. Strictly pregame, no same-day info.
    G = G.sort_values(["athlete_id", "season", "date"]).reset_index(drop=True)
    G["prev_played"] = (~G.groupby(["athlete_id", "season"])["out"].shift(1)
                        .fillna(True).astype(bool))
    G = G[(G["b"] >= 8.0) & G["prev_played"]].copy()
    G["athlete_id"] = G["athlete_id"].astype("int64")

    keep = ["game_id", "athlete_id", "heat", "own_x", "own_finish", "rec_fga", "rec_finish"]
    G = G.merge(P[keep], on=["game_id", "athlete_id"], how="left")

    # weight by recent shot VOLUME, not minutes: a hot player regresses only to the extent
    # he keeps taking the shots. A hot low-usage big is not a fade.
    G["w"] = G["rec_fga"].fillna(0.0).clip(lower=0.0)
    G = G[G["heat"].notna() | G["own_x"].notna()]

    # Every group MUST return the same keys. A Series with group-varying keys makes
    # groupby.apply hand back a MultiIndex Series instead of a frame, and the missing
    # column then only shows up as a KeyError three steps later.
    def agg(x):
        w = x["w"].to_numpy(dtype=float)
        h = x["heat"].to_numpy(dtype=float)
        ox = x["own_x"].to_numpy(dtype=float)
        mh = np.isfinite(h) & (w > 0)
        mx = np.isfinite(ox) & (w > 0)
        out = {"n_rot": len(x), "n_heat": int(mh.sum()), "p_heat": np.nan,
               "p_conc": np.nan, "p_top": np.nan, "p_ownx": np.nan}
        if mh.sum() >= 4:
            # points per game the rotation is currently getting above its own sustainable
            # rate: heat is per-shot, w is shots per game, so the product is points/game
            contrib = h[mh] * w[mh]
            out["p_heat"] = float(contrib.sum())
            pos = contrib[contrib > 0]
            # P2's variable: is the heat one guy or the whole roster? HHI over the positive
            # contributions, 1.0 = a single player carrying all of it.
            out["p_conc"] = float((pos ** 2).sum() / (pos.sum() ** 2)) if pos.sum() > 0 \
                else np.nan
            out["p_top"] = float(contrib.max())
        if mx.sum() >= 4:
            out["p_ownx"] = float(np.average(ox[mx], weights=w[mx]))
        return pd.Series(out)

    T = G.groupby(["game_id", "team_id"]).apply(agg).reset_index()
    return T


def main():
    print("building player-level shot aggregates...", flush=True)
    P = baselines(player_games(expected_points(shots())))
    print(f"  player-games: {len(P):,}  with own baseline: "
          f"{100*P['own_finish'].notna().mean():.1f}%  with heat: "
          f"{100*P['heat'].notna().mean():.1f}%", flush=True)
    print(f"  heat sd {P['heat'].std():.4f} pts/shot, own_finish sd "
          f"{P['own_finish'].std():.4f} (skill spread -- if this is ~0 the whole "
          f"own-baseline correction is pointless)", flush=True)

    print("aggregating to team sides...", flush=True)
    T = team_rows(P)
    print(f"  team-games: {len(T):,}  p_heat coverage "
          f"{100*T['p_heat'].notna().mean():.1f}%", flush=True)

    C = pd.read_parquet(f"{OUT}/nba_game_crosswalk.parquet").drop(columns=["date"])
    T = T.merge(C, left_on="game_id", right_on="espn_game_id", how="inner")
    R = pd.read_parquet(f"{OUT}/nba_regression_features.parquet")[
        ["game_id", "team_id", "is_home"]]
    T = T.merge(R, on=["game_id", "team_id"], how="inner")
    T = T.rename(columns={"bdl_game_id": "game.id"})
    path = f"{OUT}/nba_player_regression.parquet"
    T.to_parquet(path, index=False)
    print(f"\nwrote {path}: {len(T):,} team-games", flush=True)
    print(T[["p_heat", "p_conc", "p_top", "p_ownx", "n_rot"]].describe().to_string())


if __name__ == "__main__":
    main()
