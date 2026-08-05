#!/usr/bin/env python3
"""Player-level shooting heat, college edition. The S10 port.

WHY COLLEGE. S10 in the NBA is real but thin: 54.0% on 446 bets, +3.2%. It survives the
close, which is the hard part, but it lives one bad season from being noise. College is the
same idea in a market we have already caught underpricing player information -- the identical
absence signal that dies at the NBA close is worth +10.4% in CBB (S1). And the sample is
4.4x: 22,643 games with prices AND shot data, against the NBA's 5,278.

WHAT IS MEASURED, per player, leak-safe -- identical logic to nba_player_regression.py:

  own_finish   his OWN long-run points-above-expectation per shot, expanding over strictly
               prior games. SKILL, not luck. Subtracting a LEAGUE average instead would flag
               every good finisher as permanently lucky.
  rec_finish   the same over his trailing ROLL games, shifted one.
  heat         rec_finish - own_finish. Points per shot above his OWN sustainable rate.

WHAT IS DIFFERENT FROM THE NBA FILE, and why it is acceptable:

  Expectation is built from RANGE buckets (rim / jumper / three_pointer), not shot x/y.
  plays_ncaab has coordinates but no shooter id; player_shots_ncaab has the shooter id but
  no coordinates, and the two CBBD id namespaces do not bridge (verified per-game: shot
  shooters run 116..169 where box athletes run 322689..). Coarser, but rim-vs-jumper-vs-three
  is the dominant axis of shot quality, and the own-baseline subtraction absorbs a player's
  standing shot mix anyway -- the expectation term only has to handle mix DRIFT.

  Rotation = "took a shot in the team's previous dated game", not "played the previous game
  per the box score", for the same id-namespace reason. This costs nothing: heat is weighted
  by recent shot volume, so a player who takes no shots contributes exactly zero either way.

  Free throws are absent from the shots feed. Heat is field-goal finishing only. Stated so
  nobody later reads it as total scoring.

PRE-REGISTERED, before any grading (a wrong sign is a result, not a knob):
  P1  team heat predicts the side NEGATIVE -- hot shooting regresses and the market has
      already priced the results it produced. So: FADE the hotter team.
  P2  CONCENTRATED heat fades harder than diffuse heat at equal total. This is the whole
      reason for going to player level. In the NBA it held; if it fails here, player
      granularity bought nothing over the team aggregate and I will say exactly that.

THRESHOLDS ARE SET BY COVERAGE, NOT BY OUTCOME. ROLL/MIN_FGA/MIN_REC below were picked to
retain roughly the same share of the rotation as the NBA file does (a college season is
~31 games to the NBA's 82, so career-attempt floors scale down), and they are fixed before
anything is graded. Tuning them against ROI would be fitting the answer.

Writes data/parquet/ncaab_player_heat.parquet, keyed (gameId, teamId).
"""
import glob
import os
import warnings

import numpy as np
import pandas as pd

warnings.filterwarnings("ignore")

ROOT = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(ROOT, "data", "parquet")

ROLL = 10          # games in the "recent" window
MIN_FGA = 80       # prior attempts before a player's own finishing baseline is trusted
MIN_REC = 20       # attempts inside the recent window before "heat" means anything
PTS = {"rim": 2, "jumper": 2, "three_pointer": 3}


def dates():
    """gameId -> date. Only games the market frame prices, because that is the only place a
    date exists. cbbd gameId is chronological within season for three of the four seasons but
    NOT 2025-26 (spearman .40 -- the id space jumps to 209k+ on a different scheme), so the
    id can never be used as the time key. Every rolling window below is keyed on a real date.
    """
    g = pd.read_parquet(f"{OUT}/games_ncaab.parquet").dropna(subset=["cbbd_id"])
    g["gameId"] = g["cbbd_id"].astype("int64")
    g["date"] = pd.to_datetime(g["commence_time"], utc=True)
    return g.sort_values("date").drop_duplicates("gameId")[["gameId", "date"]]


def home_map():
    """gameId -> home teamId, from the play feed. The shots table has teamId but no side."""
    parts = []
    for p in sorted(glob.glob(f"{OUT}/plays_ncaab_*.parquet")):
        d = pd.read_parquet(p, columns=["gameId", "isHomeTeam", "teamId"])
        parts.append(d.dropna(subset=["teamId"]).drop_duplicates(["gameId", "teamId"]))
    d = pd.concat(parts, ignore_index=True).drop_duplicates(["gameId", "teamId"])
    d["teamId"] = d["teamId"].astype("int64")
    d["is_home"] = d["isHomeTeam"].astype(str).str.lower().eq("true")
    return d[["gameId", "teamId", "is_home"]]


def expected(S):
    """Expected points per shot from the league make rate for that range, EXPANDING over
    strictly prior dates. A full-sample rate would leak, and prior-seasons-only would throw
    away 2022-23 entirely. The early-date instability is harmless because those games are
    also the ones where no player has MIN_FGA of history yet.
    """
    d = S.groupby(["date", "range"], as_index=False).agg(m=("made", "sum"), n=("made", "size"))
    d = d.sort_values("date")
    g = d.groupby("range", sort=False)
    d["pm"] = g["m"].cumsum() - d["m"]        # strictly prior makes
    d["pn"] = g["n"].cumsum() - d["n"]        # strictly prior attempts
    d["rate"] = np.where(d["pn"] >= 500, d["pm"] / d["pn"].clip(lower=1), np.nan)
    S = S.merge(d[["date", "range", "rate"]], on=["date", "range"], how="left")
    S["val"] = S["range"].map(PTS).astype(float)
    S["pts"] = np.where(S["made"], S["val"], 0.0)
    S["xp"] = S["rate"] * S["val"]
    return S.dropna(subset=["xp"])


def roll_base(P, key, pre="", min_fga=MIN_FGA, min_rec=MIN_REC):
    """Own expanding baseline + shifted rolling recent form, volume-weighted.

    Volume weighting matters: a 2-attempt night must not swing a per-shot rate as hard as a
    20-attempt night, which an unweighted mean of `fin` would let it do. Sums, then divide.

    `pre` selects which shot subset to run on ("" = all, "ua_" = unassisted, "as_" =
    assisted), so the self-created and teammate-created versions of heat cannot drift apart
    in their leak handling. Floors scale down for the subsets, which have fewer attempts.
    """
    P = P.sort_values([key, "date"]).reset_index(drop=True)
    g = P.groupby(key, sort=False)
    for c in ("fga", "apts", "xpts"):
        P[f"{pre}c_{c}"] = g[f"{pre}{c}"].cumsum() - P[f"{pre}{c}"]
        P[f"{pre}r_{c}"] = g[f"{pre}{c}"].transform(
            lambda s: s.shift(1).rolling(ROLL, min_periods=3).sum())

    cf, ca, cx = (P[f"{pre}c_{c}"] for c in ("fga", "apts", "xpts"))
    rf, ra, rx = (P[f"{pre}r_{c}"] for c in ("fga", "apts", "xpts"))
    P[f"{pre}own_finish"] = (ca - cx) / cf.clip(lower=1)
    P[f"{pre}own_x"] = cx / cf.clip(lower=1)
    P.loc[cf < min_fga, [f"{pre}own_finish", f"{pre}own_x"]] = np.nan

    P[f"{pre}rec_finish"] = (ra - rx) / rf.clip(lower=1)
    P.loc[rf < min_rec, f"{pre}rec_finish"] = np.nan

    P[f"{pre}heat"] = P[f"{pre}rec_finish"] - P[f"{pre}own_finish"]
    P[f"{pre}rec_fga"] = rf / ROLL

    first = P.groupby(key).head(1)
    assert first[[f"{pre}r_fga", f"{pre}rec_finish"]].isna().all().all(), \
        f"RECENT FORM LEAKED INTO THE FIRST {key} GAME ({pre or 'all'})"
    assert first[f"{pre}c_fga"].eq(0).all(), \
        f"{key} CAREER BASELINE INCLUDES TONIGHT ({pre or 'all'})"
    return P


def player_games(S):
    """Per player-game aggregates, plus self-creation drift.

    WHO CREATED THE SHOT. `assisted` is only ever true on a MADE shot -- 800,880 of 1,558,480
    makes, 51.4%, which is exactly the real college assist rate. It is NOT a property of an
    attempt. So a per-channel FINISHING rate cannot be built from it: splitting attempts into
    "assisted" and "unassisted" would quietly file every miss as unassisted and the two
    buckets would not be comparable.

    What IS well defined is the share of a player's MAKES that were assisted, against his own
    baseline. That is the mechanism question restated correctly: when a player runs hot, is
    the offence feeding him more than usual (context, which decays) or is he creating it
    himself (skill, which persists)? PRE-REGISTERED: heat that arrives alongside a RISE in
    assisted share should regress harder than heat with flat or falling assisted share.
    """
    P = S.groupby(["gameId", "shooter_id", "teamId"], as_index=False).agg(
        fga=("made", "size"), apts=("pts", "sum"), xpts=("xp", "sum"),
        date=("date", "first"), fgm=("made", "sum"), ast=("assisted", "sum"))
    P = roll_base(P, "shooter_id")

    g = P.groupby("shooter_id", sort=False)
    for c in ("fgm", "ast"):
        P[f"c_{c}"] = g[c].cumsum() - P[c]
        P[f"r_{c}"] = g[c].transform(lambda s: s.shift(1).rolling(ROLL, min_periods=3).sum())
    own_ast = P["c_ast"] / P["c_fgm"].clip(lower=1)
    rec_ast = P["r_ast"] / P["r_fgm"].clip(lower=1)
    P["ast_drift"] = np.where((P["c_fgm"] >= MIN_FGA // 3) & (P["r_fgm"] >= MIN_REC // 3),
                              rec_ast - own_ast, np.nan)
    return P


def team_games(S):
    """The P2 control: the identical metric computed on the TEAM's shots pooled, which is
    what you get if you average the roster before measuring instead of after. In the NBA this
    loses money in the same cell where the player version wins.
    """
    T = S.groupby(["gameId", "teamId"], as_index=False).agg(
        fga=("made", "size"), apts=("pts", "sum"), xpts=("xp", "sum"),
        date=("date", "first"))
    T = roll_base(T, "teamId")
    return T[["gameId", "teamId", "heat", "own_finish", "rec_finish"]].rename(
        columns={"heat": "t_heat", "own_finish": "t_own", "rec_finish": "t_rec"})


def aggregate(P):
    """Player rows -> one row per team-game. Vectorised: 45k college team-games is 4x the
    NBA's group count and a per-group python function is the slow part of that file.
    """
    # Projected available = took a shot in the team's PREVIOUS dated game. Strictly pregame.
    P = P.sort_values(["shooter_id", "teamId", "date"]).reset_index(drop=True)
    prev = P.groupby(["shooter_id", "teamId"])["date"].shift(1)
    tg = P[["teamId", "date"]].drop_duplicates().sort_values(["teamId", "date"])
    tg["prev_team_date"] = tg.groupby("teamId")["date"].shift(1)
    P = P.merge(tg, on=["teamId", "date"], how="left")
    P["played_prev"] = prev.to_numpy() == P["prev_team_date"].to_numpy()

    R = P[P["played_prev"]].copy()
    # weight by recent shot VOLUME, not minutes: a hot player regresses only to the extent he
    # keeps taking the shots. A hot low-usage big is not a fade.
    w = R["rec_fga"].fillna(0.0).clip(lower=0.0).to_numpy(float)
    h = R["heat"].to_numpy(float)
    rf = R["rec_finish"].to_numpy(float)
    ox = R["own_x"].to_numpy(float)
    okh = np.isfinite(h) & (w > 0)
    okx = np.isfinite(ox) & (w > 0)
    okr = np.isfinite(rf) & (w > 0)

    R["_c"] = np.where(okh, h * w, 0.0)            # points/game above his own rate
    R["_pos"] = np.clip(R["_c"], 0, None)
    R["_pos2"] = R["_pos"] ** 2
    R["_nh"] = okh.astype(int)
    # the "merely scoring a lot" control: recent finishing with NO own-baseline subtraction.
    # In the NBA this loses 7.9% -- subtracting his own sustainable rate is the whole trick.
    R["_raw"] = np.where(okr, rf * w, 0.0)
    R["_xw"] = np.where(okx, ox * w, 0.0)
    R["_wx"] = np.where(okx, w, 0.0)
    ad = R["ast_drift"].to_numpy(float)
    oka = np.isfinite(ad) & (w > 0)
    R["_ad"] = np.where(oka, ad * w, 0.0)
    R["_wa"] = np.where(oka, w, 0.0)

    T = R.groupby(["gameId", "teamId"], as_index=False).agg(
        n_rot=("_nh", "size"), n_heat=("_nh", "sum"),
        p_heat=("_c", "sum"), p_top=("_c", "max"),
        _pos=("_pos", "sum"), _pos2=("_pos2", "sum"),
        p_raw=("_raw", "sum"), _xw=("_xw", "sum"), _wx=("_wx", "sum"),
        _ad=("_ad", "sum"), _wa=("_wa", "sum"))
    # volume-weighted mean drift, not a sum: this is a share, so a bigger rotation must not
    # look like more drift
    T["p_astdr"] = np.where(T["_wa"] > 0, T["_ad"] / T["_wa"].clip(lower=1e-9), np.nan)
    # P2's variable: is the heat one guy or the whole roster? HHI over positive
    # contributions, 1.0 = a single player carrying all of it.
    T["p_conc"] = np.where(T["_pos"] > 0, T["_pos2"] / T["_pos"].clip(lower=1e-9) ** 2, np.nan)
    T["p_ownx"] = np.where(T["_wx"] > 0, T["_xw"] / T["_wx"].clip(lower=1e-9), np.nan)
    T.loc[T["n_heat"] < 4, ["p_heat", "p_conc", "p_top", "p_raw",
                            "p_astdr"]] = np.nan
    return T.drop(columns=["_pos", "_pos2", "_xw", "_wx", "_ad", "_wa"])


def main():
    S = pd.read_parquet(f"{OUT}/player_shots_ncaab.parquet")
    D = dates()
    S = S.merge(D, on="gameId", how="inner")
    S["teamId"] = S["teamId"].astype("int64")
    print(f"shots on dated games: {len(S):,} over {S.gameId.nunique():,} games", flush=True)

    S = expected(S)
    print(f"  with an expectation: {len(S):,}", flush=True)

    P = player_games(S)
    print(f"player-games: {len(P):,} over {P.shooter_id.nunique():,} shooters | "
          f"own baseline {100*P['own_finish'].notna().mean():.1f}% | "
          f"heat {100*P['heat'].notna().mean():.1f}%", flush=True)
    print(f"  heat sd {P['heat'].std():.4f} pts/shot, own_finish sd "
          f"{P['own_finish'].std():.4f} (skill spread -- if this is ~0 the whole "
          f"own-baseline correction is pointless)", flush=True)

    T = aggregate(P)
    T = T.merge(team_games(S), on=["gameId", "teamId"], how="left")
    T = T.merge(home_map(), on=["gameId", "teamId"], how="inner")
    print(f"team-games: {len(T):,} | p_heat coverage {100*T['p_heat'].notna().mean():.1f}% | "
          f"home flag {100*T['is_home'].mean():.1f}%", flush=True)

    path = f"{OUT}/ncaab_player_heat.parquet"
    T.to_parquet(path, index=False)
    print(f"\nwrote {path}", flush=True)
    print(T[["p_heat", "p_astdr", "p_conc", "p_raw", "p_ownx", "t_heat"]]
          .describe().to_string())


if __name__ == "__main__":
    main()
