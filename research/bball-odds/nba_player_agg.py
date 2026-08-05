#!/usr/bin/env python3
"""Bottom-up NBA: player ratings aggregated to team level by minutes share.

The idea is the owner's: model individual players and roll them up, instead of modelling
teams directly. The reason it should work is mechanical, not statistical -- starters take
~90% of first-half minutes but only ~65% of full-game minutes, and the book prices the 1H
line as roughly a fixed fraction of the full-game line rather than re-deriving it from the
rotation. So a minutes-weighted player rating is structurally more informative about the
1H than about the FG, and the 1H price does not contain it. S8 (one moderate scorer out ->
1H spread 60.9%) is the crude binary version of this same effect already paying.

Second structural reason: player ratings survive the offseason, team ratings do not. In
October a team model has zero games of information. This one walks in with full career
history for most of the roster. Early season is the phase where team-level features are
weakest, so it is where this should help most.

THE CEILING TRICK. The expensive part of a bottom-up model is projecting who plays and for
how many minutes. So the roster aggregation is built TWICE:

  oracle    -- players who actually played, weighted by their ACTUAL minute share. This
               peeks at the box score and is completely unbettable. It is the upper bound
               on what any amount of minutes-projection work could deliver.
  projected -- players available in the team's previous game, weighted by their PRIOR
               rolling minute share. Honest, bettable, and what a live signal would see.

If oracle shows nothing, the approach is dead and the minutes model never gets built. If
oracle shows a lot, the oracle-minus-projected gap is the exact dollar value of building a
minutes model. Measuring the ceiling first is much cheaper than climbing to it.

LEAK DISCIPLINE. Every player statistic is a strictly-prior aggregate: the cumulative sum
up to but NOT INCLUDING the current game. Computed with cumsum-minus-self rather than
.expanding(), which is the same number and ~100x faster, and asserted below. The only
deliberate leak is the oracle weighting, which is quarantined behind the `orc_` prefix and
must never appear in a bettable feature set.

Rate stats are minutes-weighted (prior_sum(stat) / prior_sum(min) * 36), not game-averaged.
A player who logged 4 minutes in a blowout should not get the same weight in his own career
average as a 40-minute night.

Writes data/parquet/nba_player_team_agg.parquet, keyed (game.id, team.id).
"""
import os
import warnings

import numpy as np
import pandas as pd

warnings.filterwarnings("ignore")

ROOT = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(ROOT, "data", "parquet")

# Shrinkage constant, in units of prior minutes. A player with SHRINK_MIN minutes of
# history gets pulled halfway to the league mean; a rookie 3 games in sits nearly on the
# prior. 500 minutes is roughly 15 typical starter games -- about where NBA per-36 rates
# stop moving much year over year.
SHRINK_MIN = 500.0

# Counting stats available for every player-game (box score, 100% coverage).
BOX_RATE = ["pts", "reb", "ast", "stl", "blk", "turnover", "fga", "fg3a", "fta",
            "oreb", "dreb", "pf", "fgm", "fg3m", "ftm"]
# Advanced stats, only ~76% covered -- present for rotation players, missing for deep
# bench. Shrinkage handles the gap; a player with no advanced history sits on the prior.
ADV_MEAN = ["usage_percentage", "offensive_rating", "defensive_rating",
            "true_shooting_percentage", "pie", "net_rating",
            "assist_percentage", "rebound_percentage", "turnover_ratio",
            "effective_field_goal_percentage"]


def parse_min(s):
    """balldontlie sends minutes as '37' or occasionally '37:30'. Both appear."""
    s = s.astype(str).str.strip()
    mm = s.str.split(":", n=1, expand=True)
    out = pd.to_numeric(mm[0], errors="coerce")
    if mm.shape[1] > 1:
        out = out + pd.to_numeric(mm[1], errors="coerce").fillna(0) / 60.0
    return out.fillna(0.0)


def prior_sum(df, col, key):
    """Cumulative sum of `col` within `key`, EXCLUDING the current row.

    df must already be sorted by (key, date). This is the leak-safe primitive the whole
    file rests on -- if it ever includes the current row, every result becomes an oracle.
    """
    x = df[col].fillna(0.0)
    return df.groupby(key, sort=False)[col].transform(
        lambda s: s.fillna(0.0).cumsum()) - x


def prior_count(df, col, key):
    """Count of non-null `col` within `key`, excluding the current row."""
    v = df[col].notna().astype(float)
    return v.groupby(df[key], sort=False).cumsum() - v


def build_player_priors(P):
    """Per-player, strictly-prior, minutes-weighted rating table."""
    P = P.sort_values(["player.id", "date", "game.id"]).reset_index(drop=True)

    P["pmin"] = prior_sum(P, "min", "player.id")
    P["pgp"] = P.groupby("player.id", sort=False).cumcount().astype(float)

    # --- per-36 counting rates, minutes-weighted and shrunk to the league rate ---------
    for c in BOX_RATE:
        s = prior_sum(P, c, "player.id")
        lg = (s.sum() / max(P["pmin"].sum(), 1.0)) if P["pmin"].sum() > 0 else 0.0
        # shrink in the numerator/denominator, which is the natural conjugate form:
        # (observed + prior_strength * league_rate) / (minutes + prior_strength)
        P[f"pl_{c}36"] = 36.0 * (s + SHRINK_MIN * lg) / (P["pmin"] + SHRINK_MIN)

    # --- advanced per-game means, shrunk by games observed -----------------------------
    for c in ADV_MEAN:
        if c not in P.columns:
            continue
        s = prior_sum(P, c, "player.id")
        n = prior_count(P, c, "player.id")
        lg = P[c].mean()
        # 20 games of prior weight: advanced rates are noisier per-game than per-36 box
        # rates because they are ratios with small denominators in short outings.
        P[f"pl_{c}"] = (s + 20.0 * lg) / (n + 20.0)

    # plus/minus per 36 is the only direct on-court impact measure in the box score. It is
    # extremely noisy per game, so it carries the heaviest shrinkage of anything here.
    s = prior_sum(P, "plus_minus", "player.id")
    P["pl_pm36"] = 36.0 * s / (P["pmin"] + 4 * SHRINK_MIN)

    # recent form: last 10 games of minutes, to catch a player whose role just changed.
    # Rolling (not expanding) on purpose -- this is the one place recency beats career.
    P["pl_min_l10"] = P.groupby("player.id", sort=False)["min"].transform(
        lambda s: s.shift(1).rolling(10, min_periods=2).mean())
    P["pl_min_career"] = P["pmin"] / P["pgp"].replace(0, np.nan)

    return P


PL_COLS_CACHE = []


def aggregate(P, weight_col, prefix, keep_meta=False):
    """Collapse player rows to one row per (game.id, team.id) using `weight_col`.

    Two weighted views of the same roster:
      w*   -- whole rotation, weighted by minute share. Predicts the full game.
      st*  -- top 5 by weight only. Predicts the first half, where starters take ~90%
              of the minutes and the bench barely appears.
    The gap between them is the whole reason this file exists.
    """
    pl = [c for c in P.columns if c.startswith("pl_") and c not in
          ("pl_min_l10", "pl_min_career")]
    d = P[P[weight_col] > 0].copy()
    d["_w"] = d[weight_col]

    g = d.groupby(["game.id", "team.id"], sort=False)
    wsum = g["_w"].transform("sum")
    d["_ws"] = d["_w"] / wsum.replace(0, np.nan)

    recs = {}
    for c in pl:
        d["_t"] = d[c] * d["_ws"]
        recs[f"{prefix}w_{c[3:]}"] = g["_t"].sum()

    # starters = top 5 by weight within the team-game
    d["_rk"] = g["_w"].rank(ascending=False, method="first")
    s5 = d[d["_rk"] <= 5].copy()
    g5 = s5.groupby(["game.id", "team.id"], sort=False)
    w5 = g5["_w"].transform("sum")
    s5["_ws5"] = s5["_w"] / w5.replace(0, np.nan)
    for c in pl:
        s5["_t"] = s5[c] * s5["_ws5"]
        recs[f"{prefix}st_{c[3:]}"] = g5["_t"].sum()

    A = pd.DataFrame(recs).reset_index()

    # --- roster shape: who is available, how concentrated, how deep -------------------
    shape = g.agg(**{
        f"{prefix}n_avail": ("_w", "size"),
        f"{prefix}minsum": ("_w", "sum"),
    }).reset_index()
    # Herfindahl on minute share: 1.0 = one player takes everything, low = spread out.
    # A concentrated roster is more exposed to its stars, which matters for the 1H.
    hhi = d.assign(_h=d["_ws"] ** 2).groupby(
        ["game.id", "team.id"], sort=False)["_h"].sum().rename(
        f"{prefix}hhi").reset_index()
    # best player on the floor by prior per-36 scoring, and by prior minutes (role)
    best = g.agg(**{
        f"{prefix}best_pts36": ("pl_pts36", "max"),
        f"{prefix}best_pie": ("pl_pie", "max") if "pl_pie" in d.columns
        else ("pl_pts36", "max"),
    }).reset_index()
    # bench depth = rotation players 6-10 weighted scoring rate
    bn = d[(d["_rk"] > 5) & (d["_rk"] <= 10)]
    if len(bn):
        bench = bn.groupby(["game.id", "team.id"], sort=False)["pl_pts36"].mean().rename(
            f"{prefix}bench_pts36").reset_index()
    else:
        bench = shape[["game.id", "team.id"]].assign(**{f"{prefix}bench_pts36": np.nan})

    for extra in (shape, hhi, best, bench):
        A = A.merge(extra, on=["game.id", "team.id"], how="left")
    return A


def add_shock(G):
    """Re-express every roster aggregate as a deviation from the team's OWN baseline.

    The first version of this file measured roster QUALITY, and the market prices roster
    quality -- team ratings are aggregated roster quality and the book has had all summer
    to compute them. Unsurprisingly it scored zero.

    The quantity that can be mispriced is the SHOCK: how far tonight's roster sits from
    what this team normally puts on the floor. That is why S8 pays -- it does not say "this
    team is bad", it says "a 20ppg scorer is unexpectedly out tonight". A team missing its
    star still carries the season-long rating that earned the line.

    Baseline is the team's trailing 10-game mean of the SAME aggregate, strictly prior, so
    a shock is measured against the roster the market has been watching.
    """
    G = G.sort_values(["team.id", "date", "game.id"]).reset_index(drop=True)
    agg_cols = [c for c in G.columns if c.startswith(("orc_", "sem_", "prj_"))]
    g = G.groupby("team.id", sort=False)
    new = {}
    for c in agg_cols:
        base = g[c].transform(lambda s: s.shift(1).rolling(10, min_periods=3).mean())
        new[f"shk_{c}"] = G[c] - base
    return pd.concat([G, pd.DataFrame(new, index=G.index)], axis=1)


def main():
    print("loading player box + advanced ...", flush=True)
    B = pd.read_parquet(f"{OUT}/bdl_player_box.parquet")
    A = pd.read_parquet(f"{OUT}/bdl_player_advanced.parquet")
    adv_cols = [c for c in ADV_MEAN if c in A.columns]
    P = B.merge(A[["game.id", "player.id"] + adv_cols],
                on=["game.id", "player.id"], how="left")

    P["min"] = parse_min(P["min"])
    P["date"] = pd.to_datetime(P["game.date"])
    P = P[P["game.status"].astype(str).str.contains("Final", case=False, na=False)
          | P["game.status"].isna()].copy()
    print(f"  {len(P):,} player-games, {P['player.id'].nunique():,} players, "
          f"{P['game.id'].nunique():,} games", flush=True)

    P = build_player_priors(P)

    # ---- leak assertion: a player's first-ever row must have zero prior minutes -------
    first = P.groupby("player.id", sort=False).head(1)
    assert (first["pmin"] == 0).all(), "PRIOR MINUTES LEAKED INTO FIRST GAME"
    assert (first["pgp"] == 0).all(), "PRIOR GAME COUNT LEAKED INTO FIRST GAME"

    # ---- oracle weighting: actual minutes played this game. Deliberate leak. ----------
    # NOTE this leaks MORE than roster quality and is NOT a clean ceiling: minutes played
    # encodes how the game went. Total team minutes = 240 + 25 per overtime, and a blowout
    # benches starters and reshapes the whole share distribution. The first run of this
    # file scored +25 correlation on full-game totals -- the market exactly where that
    # leak is largest -- which is the signature of contamination, not skill. Kept only as
    # a diagnostic upper rail; `sem_` below is the honest ceiling.
    P["orc_w"] = P["min"]

    # ---- semi-oracle: actual AVAILABILITY, prior minute shares. ----------------------
    # This is the version we could actually buy. Who is active is public ~1h before tip on
    # the injury report, so knowing it is not cheating; knowing how long they ended up
    # playing is. Weighting an available player by his PRIOR rolling minutes carries no
    # information about tonight's outcome.
    P["sem_w"] = np.where(P["min"] > 0,
                          P["pl_min_l10"].fillna(P["pl_min_career"]).fillna(0), 0.0)

    # ---- projected weighting: prior rolling minutes, and availability from the team's
    # previous game. A player who did not appear last game is assumed unavailable, which
    # is what a naive pre-game roster guess would say without an injury feed.
    T = P.sort_values(["team.id", "date", "game.id"])
    T["played"] = (T["min"] > 0).astype(float)
    T["played_prev"] = T.groupby(["team.id", "player.id"], sort=False)["played"].shift(1)
    P = P.merge(T[["game.id", "player.id", "team.id", "played_prev"]],
                on=["game.id", "player.id", "team.id"], how="left")
    P["prj_w"] = np.where(P["played_prev"].fillna(0) > 0,
                          P["pl_min_l10"].fillna(P["pl_min_career"]).fillna(0), 0.0)

    print("aggregating oracle rosters ...", flush=True)
    O = aggregate(P, "orc_w", "orc_")
    print("aggregating semi-oracle rosters (real availability, prior minutes) ...",
          flush=True)
    S = aggregate(P, "sem_w", "sem_")
    print("aggregating projected rosters ...", flush=True)
    J = aggregate(P, "prj_w", "prj_")

    G = O.merge(S, on=["game.id", "team.id"], how="outer").merge(
        J, on=["game.id", "team.id"], how="outer")
    meta = P.groupby(["game.id", "team.id"], sort=False).agg(
        date=("date", "first"), season=("game.season", "first")).reset_index()
    G = G.merge(meta, on=["game.id", "team.id"], how="left")
    G = add_shock(G)

    path = f"{OUT}/nba_player_team_agg.parquet"
    G.to_parquet(path, index=False)
    nfeat = len([c for c in G.columns if c.startswith(("orc_", "sem_", "prj_", "shk_"))])
    print(f"\nwrote {path}: {G.shape[0]:,} team-games x {nfeat} player-derived features",
          flush=True)
    print(f"  oracle roster size  mean {G['orc_n_avail'].mean():.1f}")
    print(f"  projected roster    mean {G['prj_n_avail'].mean():.1f}")
    print("  sample cols:", [c for c in G.columns if c.startswith("orc_")][:6])


if __name__ == "__main__":
    main()
