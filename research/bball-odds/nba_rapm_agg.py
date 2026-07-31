#!/usr/bin/env python3
"""Turn player RAPM into team-game features the market can be tested against.

The box-score player model (nba_player_ceiling.py) scored ~+4% correlation with negative R2
in every cell. The diagnosis was that per-36 rates and shrunken plus-minus are inferior
proxies for on-court impact, and that the NBA side of this project simply never had the
possession-level layer the NCAAB side has had all along. nba_stints.py + nba_rapm.py built
that layer. This file is the bridge from it to a bettable test.

EVERYTHING STAYS IN ESPN ID SPACE. Minutes come from hoopR's own player_box rather than
balldontlie, so no player-ID crosswalk is needed -- only the game-level one in
nba_crosswalk.py (verified against final scores, 99.96%).

THREE FAMILIES OF FEATURE, and the third is the actual hypothesis:

  LEVEL   minute-weighted team RAPM. "How good is this roster." The market has all summer
          to price this, and team ratings ARE aggregated roster quality, so a large score
          here would be suspicious rather than encouraging.
  SHOCK   tonight's LEVEL minus the team's own trailing 10-game baseline. Deviation from
          normal, which the book prices from a season-long team number and cannot pre-price.
  OUT     the RAPM of rotation players who are NOT available tonight, in points per 48.
          This is the quantity the box-score model was groping at with counting stats. A
          team losing its best defender and its sixth man can look identical in per-36
          terms and completely different here -- and the totals version separates them
          again, because a departed rim protector RAISES the expected total while a
          departed scorer lowers it.

WEIGHTINGS mirror the earlier ceiling test so the two are directly comparable:
  sem_  semi-oracle: actual availability (the game_rosters active/DNP flags) x PRIOR
        rolling minutes. Honest and purchasable -- an availability feed is public hours
        before tip. This is the real ceiling.
  prj_  projected: played-last-game x prior rolling minutes. Bettable today with no feed
        at all. The sem-minus-prj gap is the dollar value of an availability feed.
  Actual minutes played are deliberately NOT used: they encode game length and garbage
  time, which leaks the outcome. That mistake inflated the previous run's "oracle" 6x.

LEAK DISCIPLINE. Rolling minutes use only strictly-prior games. RAPM ratings are stamped
with the month they become usable and joined backwards-only. Team baselines are shifted
before rolling. Asserted, not assumed.

Writes data/parquet/nba_rapm_team_agg.parquet -- keyed (bdl_game_id, team_id).
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

# Shrink a rating toward league-average by how many prior minutes stand behind it. RAPM is
# already ridge-shrunk, but a 90-minute rookie's coefficient is still mostly noise and would
# otherwise enter a team aggregate with the same authority as a 6,000-minute star's.
SHRINK_MIN = 600.0

# A "rotation player" averages at least this many prior minutes. 16 is not a taste call --
# it is where a measured leak disappears. The number of players who did not play is over
# half determined by the final margin (corr(|margin|, #DNP) = -0.50 with no threshold),
# because blowouts empty both benches. Filtering by prior minutes kills it:
#     >=0  -0.50   >=8  -0.16   >=12 -0.07   >=16 -0.004   >=20 +0.02
# Meanwhile corr(margin, #out) holds steady near -0.08 throughout, which is the real
# basketball effect (shorthanded teams lose by more) rather than the artifact.
ROT_MIN = 16.0
TOPN = 8           # rotation depth for the top-N views


def load_box():
    frames = []
    for f in sorted(glob.glob(f"{RAW}/player_box_*.parquet")):
        frames.append(pd.read_parquet(f, columns=[
            "game_id", "game_date", "athlete_id", "team_id", "minutes", "starter",
            "did_not_play", "active", "home_away"]))
    B = pd.concat(frames, ignore_index=True)
    B["athlete_id"] = pd.to_numeric(B["athlete_id"], errors="coerce")
    B["minutes"] = pd.to_numeric(B["minutes"], errors="coerce").fillna(0.0)
    B["date"] = pd.to_datetime(B["game_date"])
    B = B.dropna(subset=["athlete_id"])
    B = B.drop_duplicates(["game_id", "athlete_id"])
    return B.sort_values(["athlete_id", "date", "game_id"]).reset_index(drop=True)


def prior_minutes(B):
    """Leak-safe prior minute profile per player: career mean and last-10 mean."""
    g = B.groupby("athlete_id", sort=False)
    # cumsum-minus-self is the same number as .expanding().sum().shift() and ~100x faster
    B["pmin_tot"] = g["minutes"].cumsum() - B["minutes"]
    B["pgp"] = g.cumcount()
    B["min_career"] = B["pmin_tot"] / B["pgp"].replace(0, np.nan)
    B["min_l10"] = g["minutes"].transform(
        lambda s: s.shift(1).rolling(10, min_periods=1).mean())
    B["played_prev"] = g["minutes"].transform(lambda s: s.shift(1)).fillna(0.0)
    # `did_not_play` is the ONLY trustworthy availability column. The `active` flag is
    # broken in this feed: 60,448 rows carry active=False and 99.2% of them played, so
    # reading it as an inactive list marks a third of the league out every night.
    B["dnp"] = B["did_not_play"].fillna(False).astype(bool)
    B["dnp_prev"] = g["dnp"].transform(lambda s: s.shift(1)).fillna(False).astype(bool)

    first = B.groupby("athlete_id", sort=False).head(1)
    assert (first["pmin_tot"] == 0).all(), "PRIOR MINUTES LEAKED INTO FIRST GAME"
    assert first["min_l10"].isna().all(), "ROLLING MINUTES LEAKED INTO FIRST GAME"
    return B


def attach_rapm(B):
    """Backwards-only join of the monthly rating available before each game."""
    R = pd.read_parquet(f"{OUT}/nba_player_rapm.parquet")
    R["asof"] = pd.PeriodIndex(R["asof_month"], freq="M").to_timestamp()
    # merge_asof dispatches on the `by` dtype and refuses a float/int mix -- RAPM ids came
    # out of the stint lineups as floats, box-score ids are ints
    R["pid"] = R["player_id"].astype("int64")
    R = R.sort_values("asof")
    B["month"] = B["date"].dt.to_period("M").dt.to_timestamp()
    B["pid"] = B["athlete_id"].astype("int64")

    left = B[["pid", "month"]].reset_index().sort_values("month")
    out = pd.merge_asof(left, R.drop(columns=["player_id"]),
                        left_on="month", right_on="asof", by="pid",
                        direction="backward", allow_exact_matches=True)
    out = out.set_index("index").sort_index()

    # a rating fit on stints strictly before month M is usable IN month M, so an exact
    # match is correct; anything later would be lookahead
    assert (out["asof"].dropna() <= out["month"].loc[out["asof"].dropna().index]).all(), \
        "RAPM RATING FROM THE FUTURE LEAKED INTO A GAME"

    k = out["prior_minutes"].fillna(0.0) / (out["prior_minutes"].fillna(0.0) + SHRINK_MIN)
    B["rapm_m"] = (out["rapm_margin"].fillna(0.0) * k).to_numpy()
    B["rapm_t"] = (out["rapm_total"].fillna(0.0) * k).to_numpy()
    B["has_rapm"] = out["rapm_margin"].notna().to_numpy()
    return B


def aggregate(B):
    """One row per (espn_game_id, team_id) under each weighting."""
    B = B.copy()
    B["base_min"] = B["min_l10"].fillna(B["min_career"]).fillna(0.0)

    # THREE AVAILABILITY TIERS, from most informed to least, so the report can separate
    # "this works" from "this works only if you know something you cannot know in time".
    #   sem  exact availability. An injury report gives you most of this by tip, but not
    #        all of it -- warmup scratches land after our T-60 line.
    #   dur  out tonight AND out last game. A player who missed the previous game is
    #        public knowledge days ahead, so this tier is unambiguously bettable at T-60.
    #        Same-day surprises are treated as PRESENT, which is the conservative error.
    #   prj  played last game. No feed at all.
    B["sem_w"] = np.where(~B["dnp"], B["base_min"], 0.0)
    B["dur_w"] = np.where(~(B["dnp"] & B["dnp_prev"]), B["base_min"], 0.0)
    B["prj_w"] = np.where(B["played_prev"] > 0, B["base_min"], 0.0)
    # rotation membership is a PRIOR fact, so it is identical under both weightings and
    # can be used to define who is "missing" without peeking at tonight
    B["is_rot"] = B["base_min"] >= ROT_MIN

    rows = []
    for (g, t), d in B.groupby(["game_id", "team_id"], sort=False):
        r = {"game_id": g, "team_id": t}
        rot = d[d["is_rot"]]
        for w in ("sem", "dur", "prj"):
            ww = d[f"{w}_w"].to_numpy(dtype=float)
            tot = ww.sum()
            if tot <= 0:
                continue
            sh = ww / tot
            m, tt = d["rapm_m"].to_numpy(), d["rapm_t"].to_numpy()
            # x5 converts a per-player per-48 rating into the team's expected per-48
            # contribution, since five players are on the floor at all times
            r[f"{w}_lvl_m"] = 5.0 * float((sh * m).sum())
            r[f"{w}_lvl_t"] = 5.0 * float((sh * tt).sum())
            o = np.argsort(-ww)[:TOPN]
            s2 = ww[o] / max(ww[o].sum(), 1e-9)
            r[f"{w}_top_m"] = 5.0 * float((s2 * m[o]).sum())
            r[f"{w}_top_t"] = 5.0 * float((s2 * tt[o]).sum())
            r[f"{w}_best_m"] = float(m[o].max()) if len(o) else 0.0
            r[f"{w}_best_t"] = float(tt[o].max()) if len(o) else 0.0
            r[f"{w}_worst_t"] = float(tt[o].min()) if len(o) else 0.0
            r[f"{w}_hhi"] = float((sh ** 2).sum())
            r[f"{w}_n"] = int((ww > 0).sum())
            r[f"{w}_covered"] = float(sh[d["has_rapm"].to_numpy()].sum())

            # OUT: rotation players carrying zero weight tonight, valued in points per 48.
            # Weighted by their own prior share of the team's rotation minutes so that
            # losing a 34-minute starter is not the same event as losing a 13-minute
            # backup.
            if len(rot):
                rw = rot["base_min"].to_numpy(dtype=float)
                gone = rot[f"{w}_w"].to_numpy(dtype=float) <= 0
                den = max(rw.sum(), 1e-9)
                r[f"{w}_out_m"] = 5.0 * float((rw[gone] / den *
                                               rot["rapm_m"].to_numpy()[gone]).sum())
                r[f"{w}_out_t"] = 5.0 * float((rw[gone] / den *
                                               rot["rapm_t"].to_numpy()[gone]).sum())
                r[f"{w}_out_min"] = float(rw[gone].sum())
                r[f"{w}_out_n"] = int(gone.sum())
                r[f"{w}_out_best_m"] = float(
                    rot["rapm_m"].to_numpy()[gone].max()) if gone.any() else 0.0
            else:
                for suf in ("out_m", "out_t", "out_min", "out_n", "out_best_m"):
                    r[f"{w}_{suf}"] = 0.0
        rows.append(r)
    return pd.DataFrame(rows)


def add_shock(G, dates):
    """Re-express each LEVEL as a deviation from the team's OWN trailing baseline."""
    G = G.merge(dates, on="game_id", how="left").sort_values(
        ["team_id", "date", "game_id"]).reset_index(drop=True)
    cols = [c for c in G.columns if ("_lvl_" in c or "_top_" in c)]
    g = G.groupby("team_id", sort=False)
    new = {}
    for c in cols:
        base = g[c].transform(lambda s: s.shift(1).rolling(10, min_periods=3).mean())
        new[f"shk_{c}"] = G[c] - base
    return pd.concat([G, pd.DataFrame(new, index=G.index)], axis=1)


def main():
    print("loading player box (ESPN id space) ...", flush=True)
    B = load_box()
    print(f"  {len(B):,} player-games, {B['game_id'].nunique():,} games", flush=True)

    B = prior_minutes(B)
    B = attach_rapm(B)
    cov = B.loc[B["minutes"] > 0, "has_rapm"].mean()
    print(f"  RAPM coverage on players who actually played: {100*cov:.1f}%", flush=True)

    print("aggregating to team-games ...", flush=True)
    G = aggregate(B)
    dates = B[["game_id", "date"]].drop_duplicates("game_id")
    G = add_shock(G, dates)

    C = pd.read_parquet(f"{OUT}/nba_game_crosswalk.parquet")
    G = G.merge(C[["espn_game_id", "bdl_game_id"]], left_on="game_id",
                right_on="espn_game_id", how="inner")
    G = G.rename(columns={"bdl_game_id": "game.id"}).drop(columns=["espn_game_id"])

    path = f"{OUT}/nba_rapm_team_agg.parquet"
    G.to_parquet(path, index=False)
    feat = [c for c in G.columns if c.startswith(("sem_", "dur_", "prj_", "shk_"))]
    print(f"\nwrote {path}: {len(G):,} team-games x {len(feat)} features", flush=True)

    # sanity: team LEVEL should look like a power rating -- a few points either side of
    # zero, with the best teams on top. A 40-point spread would mean the x5 scaling or the
    # shrinkage is wrong.
    q = G["sem_lvl_m"].describe(percentiles=[.01, .25, .5, .75, .99])
    print("\nsem_lvl_m (team margin rating, pts/48) distribution:")
    print(q.to_string())
    print("\nsem_out_m (impact of missing rotation players, pts/48):")
    print(G["sem_out_m"].describe(percentiles=[.01, .5, .99]).to_string())


if __name__ == "__main__":
    main()
