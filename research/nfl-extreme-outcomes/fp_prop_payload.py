#!/usr/bin/env python3
"""Build the per player-week Fantasy Points payload behind the prop cards.

Spec: .claude/docs/20_player_prop_cards.md (arms), 22_defensive_tendencies_available.md (defense).
This is the piece the card design blocks on: today nfl_prop_player_pages.research is NULL and
`fp_edge` carries the projection model, so none of the FP warehouse reaches the client.

WHAT IT EMITS — one row per (season, week, player_id), with JSON blobs matching the card's arms:
  baseline   arm 1: per market the fitted blend, its two components, n, and the rookie flag
  role       arm 2: snap / route / target / carry share + where he lines up
  efficiency arm 3: the per-position rate columns
  matchup    arm 4: what THIS defense allows to his position AND to his alignment (DEF_ALIGN)
  scheme     arm 5: his production vs man / zone / single-high / two-high, and the shells they run
  playsheet  the field diagram: 4 alignment families, with left/right where FP carries it
  routes     the route tree: his top families with sep-win, crossed with this defense's allowance

Arm 6 (SITUATION) is deliberately NOT here: home/away, primetime, divisional and the special
narratives come from the schedule, not FP, and nfl_prop_narratives.py already builds them.

EVERY NUMBER IS ENTERING-GAME. Each player and defense aggregate is shift(1).expanding() within
the season, so a week-W payload contains only weeks < W, and the only cross-season term is the
explicit prior-season component of the blend. A week-1 assertion at the end proves it.

⚠ TEAM CODES. FP uses ARZ / BLT / CLV / HST. AB_NV below is the map (kept identical to prop_engine);
drops those four teams and renders 0.0 instead of erroring. It has already caused one false finding.
⚠ IDS. FP's playerPlayerId joins to our gsis player_id through fpdata/player_crosswalk.parquet,
which covers 81% of the distinct players on the props board. Unmatched ids are COUNTED, not hidden.
⚠ THE CUBE. player_receiving-routes-run is a long-format cube — every row is a
(quarter x down x personnel x ...) cell, and there is NO alignment-only marginal in it (verified:
0 rows). Only one signature carries alignment x side and reconciles exactly to the flat per-game
route total (ratio 1.000 at p05 and p95 over 3,618 player-games), so the side split is read from
that signature alone and from nowhere else. Everything else alignment-related comes from the FLAT
receivingRoutesRun__player / receivingSeparationByAlignment__player tables.
"""
from __future__ import annotations
import argparse, json, sys
from functools import lru_cache
import numpy as np, pandas as pd
from pathlib import Path

from fp_hist import read_fp      # hist + current merge, so this runs on a Render clone too

# ⛔ Do NOT `import prop_engine` for its AB_NV / NICK maps: that module builds the whole prop
# feature panel at IMPORT time (~3 minutes, 1.7 GB), so importing it here hangs the build.
# These two dicts are copied from prop_engine.py:21-26 and must stay identical to it.

pd.options.mode.chained_assignment = None
HERE = Path(__file__).resolve().parent
FP = HERE / "data" / "fpdata"
OUT = HERE / "data" / "fp_prop_payload.parquet"
num = lambda s: pd.to_numeric(s, errors="coerce")
AB_NV = {"ARZ": "ARI", "BLT": "BAL", "CLV": "CLE", "HST": "HOU"}
NICK = {"Cardinals": "ARZ", "Falcons": "ATL", "Ravens": "BLT", "Bills": "BUF", "Panthers": "CAR",
        "Bears": "CHI", "Bengals": "CIN", "Browns": "CLV", "Cowboys": "DAL", "Broncos": "DEN",
        "Lions": "DET", "Packers": "GB", "Texans": "HST", "Colts": "IND", "Jaguars": "JAX",
        "Chiefs": "KC", "Rams": "LA", "Chargers": "LAC", "Raiders": "LV", "Dolphins": "MIA",
        "Vikings": "MIN", "Patriots": "NE", "Saints": "NO", "Giants": "NYG", "Jets": "NYJ",
        "Eagles": "PHI", "Steelers": "PIT", "Seahawks": "SEA", "49ers": "SF", "Buccaneers": "TB",
        "Titans": "TEN", "Commanders": "WAS"}

# fitted in prop_blend_fit.py — blended = (n*cur + k*prior)/(n+k), 13,475 player-games 2024-26
K = {"pass_yds": 1.5, "pass_tds": 4.25, "pass_attempts": 1.0, "rush_yds": 2.5,
     "rush_att": 1.0, "receptions": 2.75, "rec_yds": 4.0, "targets": 2.25}
MKT = {
    "pass_yds":      ("passingAdvanced__player",   "playerStatsPassingYardsTotal"),
    "pass_tds":      ("passingAdvanced__player",   "playerStatsPassingTouchdownsTotal"),
    "pass_attempts": ("passingAdvanced__player",   "playerStatsPassingAttemptsTotal"),
    "rush_yds":      ("rushingAdvanced__player",   "playerStatsRushingYardsTotal"),
    "rush_att":      ("rushingAdvanced__player",   "playerStatsRushingAttemptsTotal"),
    "receptions":    ("receivingAdvanced__player", "playerStatsReceivingReceptionsTotal"),
    "rec_yds":       ("receivingAdvanced__player", "playerStatsReceivingYardsTotal"),
    "targets":       ("receivingAdvanced__player", "playerStatsReceivingTargetsTotal"),
}
ROUTES = ["Go", "Post", "Corner", "Slant", "Hitch", "InDig", "Out", "Comeback",
          "Flat", "Crossers", "Screens", "Backfield"]
SHELLS = ["Man", "Zone", "SingleHigh", "TwoHigh"]
ALIGN = ["Slot", "Wide", "Inline", "Backfield"]
# the ONE cube signature that reconciles to the flat route total (see the docstring)
CUBE_DIMS = ["playStartClockQuarter", "playDownNumber", "playPassDropbackTypeName",
             "playPassPassResultName", "playOffensePersonnelKey",
             "playDefenseMiddleOfTheFieldLookPreName", "playDefenseMiddleOfTheFieldLookPostName",
             "playDefenseCoverageSchemeParent", "playPlayerAlignmentFamily",
             "playPlayerAlignmentSide", "playPassTargetedRouteFamily", "playPassThrowTypeParent",
             "playPassReceiverSeparationName"]
SIDE_SIG = {"playStartClockQuarter", "playDownNumber", "playOffensePersonnelKey",
            "playPlayerAlignmentFamily", "playPlayerAlignmentSide"}


def upcoming_opponents(season, week):
    """{team: opponent} for an unplayed week, from the nflverse schedule, in FP-ish codes.

    The upcoming opponent CANNOT be carried forward with the player's state — his last game's
    opponent is not Thursday's. This is the one field the synthetic row has to be told.
    """
    g = pd.read_parquet(HERE / "data" / "nflverse_games.parquet",
                        columns=["season", "week", "home_team", "away_team"])
    g = g[(g.season == season) & (g.week == week)]
    if not len(g):
        sys.exit(f"no week {week} on the {season} schedule — cannot build an upcoming payload")
    m = {}
    for r in g.itertuples(index=False):
        m[r.home_team] = r.away_team
        m[r.away_team] = r.home_team
    return m


def ab(s):
    """FP team code -> our abbreviation (Rams stay LA, as score_slate_props.N2A has them)."""
    return pd.Series(s).map(lambda x: AB_NV.get(x, x))


# ⛔ 165 COLUMNS ACROSS THE PLAYER TABLES ARE NaN-WHEN-ZERO, NOT NaN-WHEN-UNKNOWN.
# Measured on games where the player was actually involved (dropbacks/carries/routes > 0): these
# columns contain NO explicit 0.0 anywhere, so a null is a real zero and averaging only the non-nulls
# inflates brutally — ReceivingTouchdownsTotal 1.131 vs a true 0.141, ReceivingTargetsInEndzone 1.250
# vs 0.185, marketShareInside5RushingAttemptsTotal 0.680 vs 0.150, PassingTouchdownsTotal 1.809 vs
# 1.177. It is the same trap as the bucket rates, one level up.
#
# NOT EVERY NULL IS A ZERO. The distinction is whether the DENOMINATOR exists:
#   counts (`…Total`) and shares of counts (`marketShare…`) -> a null numerator IS zero
#   `…Percentage` whose denominator is the gate itself (TouchdownsPercentage = TD / carries) -> zero
#   `Average…`, `…PerAttempt`, `…PerReception`, `…PerRoute` and concept-split percentages -> UNDEFINED
#     when the event never happened (AverageTimeToScramble with no scrambles is not 0.0 seconds), so
#     they are left null on purpose.
# The opponent scope has the identical problem, and there it is worse than a wrong mean: a defense
# whose value is null drops out of the league RANK, so "3rd-most of 30" was printed where 32 teams
# exist and the two missing teams were the ones that allowed none.
ZERO_GATE = {"rushingAdvanced__opponent": "opponentStatsRushingAttemptsTotal",
             "receivingAdvanced__opponent": "opponentStatsReceivingTargetsTotal",
             "passingAdvanced__opponent": "opponentStatsPassingDropbacksTotal",
             "passingAdvanced__player": "playerStatsPassingDropbacksTotal",
             "passingBasic__player": "playerStatsPassingDropbacksTotal",
             "passingDepth__player": "playerStatsPassingDropbacksTotal",
             "rushingAdvanced__player": "playerStatsRushingAttemptsTotal",
             "rushingBasic__player": "playerStatsRushingAttemptsTotal",
             "rushingConcepts__player": "playerStatsRushingAttemptsTotal",
             "receivingAdvanced__player": "playerStatsReceivingRoutesTotal",
             "receivingRoutesRun__player": "playerStatsReceivingRoutesTotal",
             "rushingBellCow__player": "marketShareSnapsOffenseTotal",
             "offenseSnaps__player": "playerStatsSnapsOffenseTotal"}
_UNDEFINED_WHEN_ABSENT = ("Average", "PerAttempt", "PerReception", "PerRoute", "PerTarget",
                          "PerDropback", "Concept", "OverExpected", "Expected")


def _zero_fill_counts(d, gate):
    """Null -> 0 for count-like columns, but ONLY on rows where the player was involved."""
    if gate not in d.columns:
        return d
    involved = num(d[gate]) > 0
    for c in d.columns:
        if not c.startswith(("playerStats", "marketShare", "opponentStats")) or c == gate:
            continue
        if any(k in c for k in _UNDEFINED_WHEN_ABSENT):
            continue
        # Do NOT whitelist by suffix. The first version required Total / Percentage / marketShare
        # and so skipped `ReceivingTargetsInEndzone`, `ReceivingTouchdownsInEndzone`,
        # `ReceptionsContested` and `ReceptionsHero` — 25,096 nulls and not one explicit 0.0 among
        # them. The no-explicit-zero test below IS the test; the exclusion list above is what
        # protects the genuinely undefined ones.
        v = num(d[c])
        if (v == 0).sum() == 0 and v.isna().any():      # no explicit zero anywhere -> null IS zero
            d.loc[involved & v.isna(), c] = 0.0
    return d


SEASON_FILTER = None          # set by --season: keeps only {season-1, season}, see load()
UPCOMING_WEEK = None          # set by --upcoming: the UNPLAYED week to carry state forward to
FIRST_FP_SEASON = 2021        # earliest season the FP warehouse covers (separation tables: 2022)
WINDOW_MIN_GAMES = 4          # a defense needs 4 games before this season replaces last — see _def_entering


def load(name, cols=None):
    """Prefer fp_hist.read_fp so hist + this season merge the same way everywhere else does.

    ⚠ This builder needs the FULL warehouse. On a Render clone data/fpdata holds only the weeks
    that run's fp_pull wrote and data/fpdata_hist only 6 lean tables, so an entering-game mean
    built there silently covered a fraction of the season — and for the four bucket tables the
    props chain never pulls, read_fp raised and this returned an EMPTY frame, so the route tree,
    coverage shells and throw-depth blobs were simply absent while the job exited 0.
    Fixed 2026-10-07: set FP_SUPABASE=1 (and FP_SEASONS to current + prior) and fp_hist merges
    the tables from Supabase, where the bucket dicts have always been stored. render.yaml's
    nfl-prop-report-daily does this. A freshly pulled local cell still wins on overlap.
    """
    try:
        d = read_fp(name)
    except Exception:
        p = FP / f"{name}.parquet"
        if not p.exists():
            print(f"  ! missing {name}")
            return pd.DataFrame()
        d = pd.read_parquet(p)
    if name in ZERO_GATE:
        d = _zero_fill_counts(d.copy(), ZERO_GATE[name])
    if cols:
        d = d[[c for c in cols if c in d.columns]]
    d = d.rename(columns={"gameSeason": "season", "gameWeek": "week"})
    # A weekly run only needs this season and the one the blend's prior term comes from. Filtering
    # here instead of at the end is what makes the weekly job minutes rather than half an hour.
    if SEASON_FILTER and "season" in d.columns:
        d = d[d.season.isin(SEASON_FILTER)]
    return d


def entering(d, keys, cols, prefix="e_"):
    """shift(1).expanding().mean() within `keys` — a row never sees its own game.

    Done as (cumsum - own) / (count of prior non-null) rather than a per-column
    .transform(lambda) because the lambda form took minutes on 40 columns x 30k groups. Two
    groupby cumsums cover every column at once and give the identical answer (asserted in
    _self_test). Also emits `<prefix>n`, the number of PRIOR rows in the group — exactly the n
    the blend and every shrinkage below want.
    """
    d = d.sort_values(list(keys) + ["week"]).copy()
    if UPCOMING_WEEK is not None:
        # An UNPLAYED week has no FP rows, so without this the payload can only ever describe games
        # already finished — useless for a card. Append one all-NaN row per group at that week:
        # the cumulative pass below then gives it the mean over EVERY played week, which is exactly
        # "state carried forward", and e_n is the real games-played count. The row carries no stat
        # of its own, so it cannot contribute to its own mean.
        # ⛔ ONLY THE CURRENT SEASON GETS A CARRY-FORWARD ROW, and no real row is ever dropped.
        # The first version replaced week N in EVERY season, so asking for upcoming week 5 deleted
        # week 5 of the PRIOR season too — George Pickens' 2025 week-5 game (57 yards) vanished and
        # his prior-season term read 85.75 instead of 84.06. The prior season is played; it has a
        # real week N and must keep it.
        latest = d.season.max() if "season" in d.columns else None
        src = d[d.season == latest] if latest is not None else d
        syn = src.drop_duplicates(list(keys), keep="last").copy()
        syn["week"] = UPCOMING_WEEK
        syn[[c for c in cols if c in syn.columns]] = np.nan
        drop = (d.week == UPCOMING_WEEK) if latest is None else (
            (d.season == latest) & (d.week == UPCOMING_WEEK))
        d = pd.concat([d[~drop], syn], ignore_index=True)
        d = d.sort_values(list(keys) + ["week"])
    kv = [d[k] for k in keys]
    V = d[cols].apply(pd.to_numeric, errors="coerce")
    F = V.notna().astype("int64")
    # cumsum must run on the FILLED frame: groupby.cumsum() emits NaN at every NaN row, which
    # silently blanked the entering mean for anyone whose latest game had a missing stat.
    Vf = V.fillna(0.0)
    cs = Vf.groupby(kv).cumsum() - Vf
    cn = F.groupby(kv).cumsum() - F
    m = cs / cn.replace(0, np.nan)
    m.columns = [prefix + c for c in cols]
    d = pd.concat([d, m], axis=1)
    d[prefix + "n"] = d.groupby(list(keys), sort=False).cumcount()
    return d


def _self_test():
    """entering() must equal the shift/expanding form it replaced, and the carry-forward row must
    hold the mean over EVERY played week. Both run on every build; neither has a fixture to rot."""
    global UPCOMING_WEEK
    keep, d = UPCOMING_WEEK, pd.DataFrame(
        {"p": list("aabbbcc"), "season": 1, "week": [1, 2, 1, 2, 3, 1, 2],
         "v": [1.0, 3.0, np.nan, 2.0, 4.0, 5.0, np.nan]})
    try:
        UPCOMING_WEEK = None
        got = entering(d, ["p", "season"], ["v"]).sort_index()
        want = d.sort_values(["p", "season", "week"]).groupby(["p", "season"]).v.transform(
            lambda s: s.shift(1).expanding().mean()).sort_index()
        assert np.allclose(got.e_v.fillna(-9), want.fillna(-9)), (got.e_v.tolist(), want.tolist())

        UPCOMING_WEEK = 9
        up = entering(d, ["p", "season"], ["v"])
        up = up[up.week == 9].set_index("p")
        assert up.loc["a"].e_v == 2.0 and up.loc["a"].e_n == 2          # (1+3)/2 over 2 games
        assert up.loc["b"].e_v == 3.0 and up.loc["b"].e_n == 3          # (2+4)/2, NaN week skipped
        assert up.loc["c"].e_v == 5.0 and up.loc["c"].e_n == 2          # the only non-null value
        assert len(up) == 3, "one carry-forward row per group, no more"
    finally:
        UPCOMING_WEEK = keep
    print("  [self-test] entering() matches shift(1).expanding().mean(); carry-forward row correct")


def shrink(val, n, prior, k):
    """(n*val + k*prior)/(n+k), NaN-safe in both directions."""
    n = num(n).fillna(0.0)
    p = num(prior)
    v = num(val)
    v = v.where(v.notna(), p)
    p = p.where(p.notna(), v)
    out = (n * v + k * p) / (n + k)
    return out.where(v.notna() | p.notna())


# ⛔ IN THESE BUCKETS, A NULL RATE MEANS ZERO — NOT "UNKNOWN".
# Measured over 14,379 alignment cells with routes > 0: ZERO of them carry an explicit 0.0 for
# targets-per-route or yards-per-route, and 6,200 of the 6,204 null-TPR cells are also null for YPR.
# So a null is "he ran routes there and drew no target", which is a real zero. entering() skips
# nulls, so leaving them NaN averaged only his productive games: mean yards/route reads 2.69 when
# the truth is 1.28 — more than double.
# It was also ASYMMETRIC. The defense-side allowance divides summed yards by ALL routes faced, so it
# was already correct, and every card compared his inflated rate against their honest one.
# Only rates conditional on a route ARE zero-filled. SeparationWinsPercentage is NOT: a "win" needs
# a target, so its null is genuinely undefined (populated on 22-29% of cells) — which is also why
# SeparationScorePercentage, populated on 100%, is the separation field to lead with.
ZERO_WHEN_ROUTES = {"tpr", "ypr", "targets", "yds"}


@lru_cache(maxsize=8)
def _long(table, prefix, names, fields):
    """bucket_long() memoised by table — the route and alignment explosions are each needed by a
    player-side and a defense-side builder, and exploding 80k bucket dicts twice doubled the run."""
    d = load(table, ["gameSeason", "gameWeek", "playerPlayerId", "bucket"])
    if not len(d):
        return pd.DataFrame()
    L = bucket_long(d, prefix, list(names), dict(fields))
    for c in dict(fields):
        L[c] = num(L[c])
    if "routes" in L.columns:
        ran = num(L.routes) > 0
        for c in ZERO_WHEN_ROUTES & set(L.columns):
            L.loc[ran & L[c].isna(), c] = 0.0
        # ⛔ POOL, NEVER AVERAGE PER-GAME RATIOS. A game with 1 route of a family carried the same
        # weight as one with 13: TB's in-dig allowance read 1.40 yards/route (mean of 3.15, 0.00,
        # 2.44, 0.00 over 13, 10, 9 and 1 routes) when the pooled truth is 1.91 — a 27% error in the
        # defense's favour. Carrying the numerators lets every consumer divide two entering MEANS,
        # which is the pooled total/total with the same denominator.
        if "ypr" in L.columns:
            L["yds"] = num(L.routes) * num(L.ypr)
        if "tpr" in L.columns:
            L["tgt"] = num(L.routes) * num(L.tpr)
        # depth is a per-route RATE, so carry its numerator for the same reason as yds/tgt: a game
        # with 1 route of a family must not weigh the same as one with 13.
        if "depth" in L.columns:
            L["depth_w"] = num(L.routes) * num(L.depth)
    return L


# ⭐ DEPTH is the fourth dimension of a route tree and was missing (owner 2026-10-08: "how far
# they run those routes and if the defense allows those types of distances"). An out at 4 yards
# and an out at 14 are different routes against different coverage, and the engine could not tell
# them apart — it compared share and yards-per-route only. Carried on BOTH sides so the branch can
# say "he runs it at 12.4 yards, they allow 2.57 there".
ROUTE_FIELDS = (("routes", "playerStatsReceivingSeparationRoutesTotal"),
                ("tpr", "playerStatsReceivingTargetsPerRoute"),
                ("ypr", "playerStatsReceivingAveragesPerRouteYardsTotal"),
                ("depth", "playerStatsReceivingSeparationRoutesDepthPercentage"),
                ("sep_score", "playerStatsReceivingSeparationScorePercentage"),
                ("sep_win", "playerStatsReceivingSeparationWinsPercentage"))
# ⚠ The alignment bucket carries NO targets / receptions / yards totals — only routes,
# targets-per-route, yards-per-route and separation. Asking for the totals returned None on every
# row, num() made them NaN, and groupby().sum() turned an all-NaN group into 0.0 — so DEF_ALIGN
# published "0.0 yards allowed to the slot" for all 32 defenses and the alignment-weighted matchum
# arm silently never fired. Derive the totals from the rates instead (and see _reconcile_align).
ALIGN_FIELDS = (("routes", "playerStatsReceivingSeparationRoutesTotal"),
                ("tpr", "playerStatsReceivingTargetsPerRoute"),
                ("ypr", "playerStatsReceivingAveragesPerRouteYardsTotal"),
                ("sep_win", "playerStatsReceivingSeparationWinsPercentage"),
                ("sep_score", "playerStatsReceivingSeparationScorePercentage"))
routes_long = lambda: _long("receivingSeparationByRoutes__player",
                            "bucketReceivingSeparationRoute", tuple(ROUTES) + ("Overall",),
                            ROUTE_FIELDS)
def align_long():
    L = _long("receivingSeparationByAlignment__player", "bucketReceivingSeparation",
              tuple(ALIGN) + ("Overall",), ALIGN_FIELDS)
    if not len(L):
        return L
    L = L.copy()
    L["targets"] = L.routes * L.tpr
    L["yds"] = L.routes * L.ypr
    return L


def bucket_long(df, prefix, names, fields):
    """Explode a `bucket` dict column into long rows: one per (player-game, bucket name)."""
    out = []
    for r in df.itertuples():
        b = getattr(r, "bucket", None)
        if not isinstance(b, dict):
            continue
        for nm in names:
            c = b.get(f"{prefix}{nm}")
            if not isinstance(c, dict):
                continue
            rec = {"playerPlayerId": r.playerPlayerId, "season": r.season, "week": r.week,
                   "bucket": nm, "opp": c.get("opponentAbbreviation")}
            for alias, key in fields.items():
                rec[alias] = c.get(key)
            out.append(rec)
    return pd.DataFrame(out)


# ------------------------------------------------------------------ arm 1: baseline
def baselines():
    """Per market: the fitted blend of this-season-to-date and last season, plus its parts.

    Returns long rows (player, season, week, market) so the card can render only the market
    the user selected. `rookie` is True when there is NO prior-season component at all — the
    spec requires those arms to carry a `ROOKIE · n games` tag and render lighter.
    """
    frames, rows, dropped = {}, [], {}
    # A "rookie" is a PLAYER with no prior season, not a market with no prior value. Keying it off
    # the market made a 10-year WR's rush_yds arm read ROOKIE because he had no carries last year.
    seen = set()
    for tbl in set(t for t, _ in MKT.values()):
        frames[tbl] = load(tbl)
        if len(frames[tbl]):
            seen |= set(zip(frames[tbl].playerPlayerId, frames[tbl].season))
    # NOT min(seen): with --season the loads are filtered to {season-1, season}, so the observed
    # minimum is the prior season and every target-season row would read "no prior in warehouse".
    first_season = FIRST_FP_SEASON
    for mkt, (tbl, col) in MKT.items():
        if tbl not in frames:
            frames[tbl] = load(tbl)
        d = frames[tbl]
        if not len(d) or col not in d.columns:
            print(f"  ! baseline {mkt}: {col} missing from {tbl}")
            continue
        g = d[["playerPlayerId", "season", "week", "playerPosition", "teamAbbreviation",
               "opponentAbbreviation", col]].copy()
        g["v"] = num(g[col])
        # ⚠ A CAMEO IS NOT A GAME. Zero-filling is right — routes run with no yards IS zero yards —
        # but a per-GAME rate that counts a 3-route appearance as a 0-yard game is not describing
        # his role. CeeDee Lamb's 2025 week 3 was 3 routes, no targets: including it moved his
        # prior-season term from 82.8 to 76.9 yards a game.
        # The floor is 25% of HIS OWN median involvement that season, which adapts across positions
        # automatically (a 33-route receiver gets a floor of 8 routes, a 15-carry back gets 4) and
        # needs no hand-set per-position constant.
        gate = ZERO_GATE.get(tbl)
        if gate and gate in d.columns:
            g["_inv"] = num(d[gate])
            med = g.groupby(["playerPlayerId", "season"])["_inv"].transform("median")
            before = len(g)
            g = g[(g._inv >= 0.25 * med) | med.isna()]
            dropped[mkt] = before - len(g)
        g = g.dropna(subset=["playerPlayerId", "season", "week"])
        g = g.groupby(["playerPlayerId", "season", "week", "playerPosition", "teamAbbreviation",
                       "opponentAbbreviation"], as_index=False, dropna=False).v.mean()
        g = entering(g, ["playerPlayerId", "season"], ["v"])          # e_v = season-to-date entering
        # prior-season mean, attached to the NEXT season — the only cross-season term in the file
        pri = g.groupby(["playerPlayerId", "season"], as_index=False).v.mean()
        pri["season"] = pri.season + 1
        pri = pri.rename(columns={"v": "prior"})
        g = g.merge(pri, on=["playerPlayerId", "season"], how="left")
        k = K[mkt]
        g["blended"] = shrink(g.e_v, g.e_n, g.prior, k)
        # "no prior season" is TWO different things and the card must not conflate them: a real
        # rookie, and the earliest season this FP table covers (2021/2022), where everyone looks
        # like one. Tagging the latter ROOKIE would mislabel half the warehouse.
        was_here = pd.Series(list(zip(g.playerPlayerId, g.season - 1)), index=g.index).isin(seen)
        g["prior_unavailable"] = g.prior.isna() & (was_here | (g.season <= first_season))
        g["rookie"] = g.prior.isna() & ~was_here & (g.season > first_season)
        # the arm must print how current the number is (spec §2)
        # With no prior season the blend IS the current season — but only if he has played. A
        # rookie in week 1 has neither, so the weight is undefined, not 100%: printing "100% this
        # season" beside a blank number is the most misleading thing this arm could say.
        g["w_season"] = np.where(g.prior.isna(),
                                 np.where(g.e_n > 0, 1.0, np.nan),
                                 g.e_n / (g.e_n + k))
        g["market"] = mkt
        rows.append(
            g[["playerPlayerId", "season", "week", "playerPosition", "teamAbbreviation",
               "opponentAbbreviation", "market", "blended", "e_v", "prior", "e_n", "w_season",
               "rookie", "prior_unavailable"]].rename(columns={"e_v": "season_to_date",
                                                               "e_n": "games"}))
    out = pd.concat(rows, ignore_index=True)
    # report the rates on the TARGET season only: under --season the frame also holds season-1,
    # whose own prior season was filtered out, so it reads 100% rookie and drowns the real number.
    t = out[out.season == out.season.max()]
    print(f"  baseline: {len(out)} player-week-markets | {t.season.iloc[0]}: rookie "
          f"{t.rookie.mean():.0%}, no prior in warehouse {t.prior_unavailable.mean():.0%}"
          + (f" | cameos excluded: {sum(dropped.values())}" if dropped else ""))
    return out


# ------------------------------------------------------------------ arms 2+3: role, efficiency
def role_efficiency():
    """Role shares, where he lines up, and the per-position efficiency rates — FRESH TABLES ONLY.

    ⚠ Half the FP warehouse is FROZEN at 2026 week 1 (audited 2026-10-06: 48 of 69 tables, incl.
    offenseSnaps__player, receivingRoutesRun__player, receivingTargetShareReport__player,
    rushingConcepts__player, rushingBasic__player, passingDepth__player and
    fantasyPointsAllowed__player). The in-season pull covers only 21 tools. A card built on a
    frozen table would publish week-1 snap shares all season and look perfectly plausible, so
    every measure here is read from a table that IS current, even where a frozen one was the
    obvious home for it:
      snap share      <- rushingBellCow__player        (not offenseSnaps__player)
      target/route    <- receivingAdvanced__player      (not receivingTargetShareReport__player)
      alignment share <- receivingAdvanced__player's own Alignment*RoutesPercentage columns
      rush efficiency <- rushingAdvanced__player        (not rushingConcepts/rushingBasic)
      pass efficiency <- passingAdvanced__player        (not passingDepth__player)
    """
    recadv = load("receivingAdvanced__player", ["gameSeason", "gameWeek", "playerPlayerId",
        "playerPosition", "teamAbbreviation", "opponentAbbreviation",
        "marketShareReceivingRoutesTotal", "marketShareReceivingTargetsTotal",
        "marketShareReceivingYardsTotal", "marketShareReceivingTouchdownsTotal",
        "playerStatsReceivingAlignmentSlotRoutesPercentage",
        "playerStatsReceivingAlignmentWideRoutesPercentage",
        "playerStatsReceivingAlignmentInlineRoutesPercentage",
        "playerStatsReceivingAlignmentBackfieldRoutesPercentage",
        "playerStatsReceivingTargetsPerRoute", "playerStatsReceivingTargetsCatchablePercentage",
        "playerStatsReceivingTargetsContestedTotal", "playerStatsReceivingAverageDepthOfTarget",
        "playerStatsReceivingAveragesPerRouteYardsTotal", "playerStatsReceivingRoutesTotal",
        "playerStatsReceivingTargetsInEndzone", "playerStatsInside20ReceivingTargetsTotal",
        "playerStatsXfpPprTotal"])
    bell = load("rushingBellCow__player", ["gameSeason", "gameWeek", "playerPlayerId",
        "marketShareSnapsOffenseTotal", "marketShareRushingAttemptsTotal",
        "marketShareXfpPprTotal"])
    ru = load("rushingAdvanced__player", ["gameSeason", "gameWeek", "playerPlayerId",
        "playerStatsRushingAttemptsStuffsPercentage", "playerStatsRushingAttemptsSuccessPercentage",
        "playerStatsRushingYardsAfterContactPerAttempt",
        "playerStatsRushingRunsExplosivePercentage", "marketShareInside5RushingAttemptsTotal"])
    qb = load("passingAdvanced__player", ["gameSeason", "gameWeek", "playerPlayerId",
        "playerStatsPassingAttemptsCatchablePercentage", "playerStatsPassingDropbacksTotal",
        "playerStatsPassingHeroThrowPercentage", "playerStatsPassingDeepThrowAttemptsPercentage",
        "playerStatsPassingPressuredPercentage", "playerStatsPassingAttemptsInEndzoneTotal"])
    base = recadv.drop_duplicates(["playerPlayerId", "season", "week"])
    for extra in (bell, ru, qb):
        if len(extra):
            base = base.merge(extra.drop_duplicates(["playerPlayerId", "season", "week"]),
                              on=["season", "week", "playerPlayerId"], how="left")
    cols = [c for c in base.columns if c.startswith(("marketShare", "playerStats"))]
    base = entering(base, ["playerPlayerId", "season"], cols)
    print(f"  role/eff: {len(base)} player-weeks, {len(cols)} measures (fresh tables only)")
    return base


# ------------------------------------------------------------------ arm 5: scheme
def player_scheme():
    """His own production vs man / zone / single-high / two-high, entering-game."""
    d = load("receivingManVsZone__player", ["gameSeason", "gameWeek", "playerPlayerId", "bucket"])
    if not len(d):
        return pd.DataFrame()
    L = bucket_long(d, "bucket", SHELLS + ["Overall"], {
        "routes": "playerStatsReceivingRoutesTotal",
        "tpr": "playerStatsReceivingTargetsPerRoute",
        "ypr": "playerStatsReceivingAveragesPerRouteYardsTotal",
        "ppr": "playerStatsFantasyPointsPpr"})
    if not len(L):
        return pd.DataFrame()
    for c in ("routes", "tpr", "ypr", "ppr"):
        L[c] = num(L[c])
    L = entering(L, ["playerPlayerId", "season", "bucket"], ["routes", "tpr", "ypr", "ppr"])
    print(f"  scheme: {len(L)} player-week-shells")
    return L


def qb_scheme():
    """A QB's own production by coverage — arm 5 for the passing markets.

    `receivingManVsZone__player` is a RECEIVER table, so a QB's scheme arm came back empty on the
    first build (every value a dash on Dak's card). `qbCoverageMatchup__player` is the QB equivalent:
    PPR and dropback share per Man / Cover 2 / 3 / 4 / 6, one row per QB-game, current to 2026 wk4.
    """
    cols = ["gameSeason", "gameWeek", "playerPlayerId", "playerStatsPassingDropbacksTotal"]
    shells = ["Man", "Cover2", "Cover3", "Cover4", "Cover6"]
    for sh in shells:
        cols += [f"playerStatsCoverageScheme{sh}FantasyPointsPprTotal",
                 f"playerStatsCoverageScheme{sh}PassingDropbacksTotal",
                 f"playerStatsCoverageScheme{sh}PassingDropbacksPercentage"]
    d = load("qbCoverageMatchup__player", cols)
    if not len(d):
        return pd.DataFrame()
    rows = []
    for sh in shells:
        ppr = f"playerStatsCoverageScheme{sh}FantasyPointsPprTotal"
        db = f"playerStatsCoverageScheme{sh}PassingDropbacksTotal"
        sharec = f"playerStatsCoverageScheme{sh}PassingDropbacksPercentage"
        if ppr not in d.columns:
            continue
        x = d[["playerPlayerId", "season", "week"]].copy()
        x["bucket"] = sh
        x["ppr"] = num(d[ppr])
        x["dropbacks"] = num(d[db]) if db in d.columns else np.nan
        x["share"] = num(d[sharec]) if sharec in d.columns else np.nan
        # PPR per dropback is the comparable rate — a raw total just tracks how often he saw it
        x["ppr_per_db"] = x.ppr / x.dropbacks.replace(0, np.nan)
        rows.append(x)
    L = pd.concat(rows, ignore_index=True)
    L = entering(L, ["playerPlayerId", "season", "bucket"],
                 ["ppr", "dropbacks", "share", "ppr_per_db"])
    print(f"  qb scheme: {len(L)} qb-week-coverages")
    return L


# ------------------------------------------------------------------ the playsheet
def playsheet():
    """Where he lines up: the 4 alignment families, from the FRESH bucket table.

    receivingSeparationByAlignment__player is current to 2026 wk4 and its `bucket` dict carries
    routes, targets, receptions, yards AND separation for Slot / Wide / Inline / Backfield — so it
    replaces the frozen flat receivingRoutesRun__player for every alignment number on the card.

    Left / Right is a separate matter. The only source is player_receiving-routes-run, which is
    (a) FROZEN at 2026 wk1 and (b) a long-format cube with NO alignment-only marginal (0 rows).
    Exactly one signature carries alignment x side and reconciles to the flat per-game route total
    (ratio 1.000 at p05 and p95 over 3,618 player-games), so the side split is read from that and
    nothing else, and it carries `side_games` so a card can refuse to draw 8 spots on 2 games.
    """
    f = align_long()
    if len(f):
        f = entering(f, ["playerPlayerId", "season", "bucket"],
                     ["routes", "yds", "tgt", "sep_score", "sep_win"])
        f["e_ypr"] = f.e_yds / f.e_routes.replace(0, np.nan)   # pooled
        f["e_tpr"] = f.e_tgt / f.e_routes.replace(0, np.nan)
        f["e_targets"] = f.e_tgt

    side = pd.DataFrame()
    cube = load("player_receiving-routes-run")
    if len(cube) and "playPlayerAlignmentSide" in cube.columns:
        dims = [c for c in CUBE_DIMS if c in cube.columns]
        # vectorised: a row is THE signature iff it is populated on exactly those dimensions
        inside = [c for c in dims if c in SIDE_SIG]
        outside = [c for c in dims if c not in SIDE_SIG]
        sl = cube[cube[inside].notna().all(axis=1) & cube[outside].isna().all(axis=1)]
        if len(sl):
            sl = sl.assign(routes=num(sl.playerStatsReceivingRoutesTotal))
            g = (sl.groupby(["playerPlayerId", "season", "week", "playPlayerAlignmentFamily",
                             "playPlayerAlignmentSide"], as_index=False).routes.sum())
            g = entering(g, ["playerPlayerId", "season", "playPlayerAlignmentFamily",
                             "playPlayerAlignmentSide"], ["routes"])
            side = g.rename(columns={"playPlayerAlignmentFamily": "family",
                                     "playPlayerAlignmentSide": "side",
                                     "e_routes": "routes_prior", "e_n": "side_games"})[
                ["playerPlayerId", "season", "week", "family", "side", "routes_prior", "side_games"]]
    print(f"  playsheet: {len(f)} player-week-alignments | side rows {len(side)} "
          f"(side source frozen at 2026 wk1)")
    return f, side


# ------------------------------------------------------------------ the route tree
def player_routes():
    """His route tree: routes run, targets per route, yards per route and separation-win.

    Branches are his top families OVERALL — measured as the stable choice (top 3 = 52% of his
    routes, H1/H2 overlap 2.3 of 3), unlike "top 3 vs this defense", which is a median of 2 routes
    against one opponent and is the same trap as head-to-head production.
    """
    L = routes_long()
    if not len(L):
        return pd.DataFrame()
    L = entering(L, ["playerPlayerId", "season", "bucket"],
                 ["routes", "yds", "tgt", "depth_w", "sep_score", "sep_win"])
    L["e_ypr"] = L.e_yds / L.e_routes.replace(0, np.nan)      # pooled, not a mean of ratios
    L["e_tpr"] = L.e_tgt / L.e_routes.replace(0, np.nan)
    L["e_depth"] = L.e_depth_w / L.e_routes.replace(0, np.nan)
    # route SHARE of his tree, so a branch's thickness is a share and not a raw count
    real = L.bucket != "Overall"
    tot = (L.where(real).groupby([L.playerPlayerId, L.season, L.week]).e_routes.transform("sum"))
    L["share"] = (L.e_routes / tot.replace(0, np.nan)).where(real)
    print(f"  routes: {len(L)} player-week-routes")
    return L


COVERAGES = ["Man", "Cover2", "Cover3", "Cover4", "Cover6"]


def player_coverage():
    """His yards-per-route and separation against each SPECIFIC coverage, entering-game.

    receivingManVsZone__player only splits man / zone / single-high / two-high, which cannot answer
    "what does he do against what THIS defense plays" when the defense's identity is Cover 3 at 42%.
    wrCoverageMatchup__player carries routes, route share and yards-per-route per Man / Cover 2 / 3 /
    4 / 6; receivingSeparationByCoverage__player adds separation per the same buckets.
    """
    d = load("wrCoverageMatchup__player")
    rows = []
    for cv in COVERAGES:
        rt = f"playerStatsCoverageScheme{cv}ReceivingRoutesTotal"
        yr = f"playerStatsCoverageScheme{cv}ReceivingYardsPerRoute"
        pp = f"playerStatsCoverageScheme{cv}FantasyPointsPprTotal"
        if not len(d) or rt not in d.columns:
            continue
        x = d[["playerPlayerId", "season", "week"]].copy()
        x["bucket"] = cv
        x["routes"] = num(d[rt])
        x["ypr"] = num(d[yr])
        x["ppr"] = num(d[pp]) if pp in d.columns else np.nan
        # same zero-means-zero rule as the buckets: routes run but no yards is 0, not unknown
        ran = x.routes > 0
        for c in ("ypr", "ppr"):
            x.loc[ran & x[c].isna(), c] = 0.0
        rows.append(x)
    # wrCoverageMatchup carries no "Overall" bucket: his overall routes and yards-per-route are
    # TOP-LEVEL columns. Without this the coverage arms had no denominator and printed "season —".
    if len(d) and "playerStatsReceivingRoutesTotal" in d.columns:
        ov = d[["playerPlayerId", "season", "week"]].copy()
        ov["bucket"] = "Overall"
        ov["routes"] = num(d["playerStatsReceivingRoutesTotal"])
        ov["ypr"] = num(d["playerStatsReceivingAveragesPerRouteYardsTotal"])
        ov["ppr"] = num(d["playerStatsFantasyPointsPpr"]) if "playerStatsFantasyPointsPpr" in d.columns else np.nan
        ran = ov.routes > 0
        for c in ("ypr", "ppr"):
            ov.loc[ran & ov[c].isna(), c] = 0.0
        rows.append(ov)
    if not rows:
        return pd.DataFrame()
    C = pd.concat(rows, ignore_index=True)
    sep = _long("receivingSeparationByCoverage__player", "bucketReceivingSeparation",
                tuple(COVERAGES) + ("Overall",),
                (("routes", "playerStatsReceivingSeparationRoutesTotal"),
                                   ("tpr", "playerStatsReceivingTargetsPerRoute"),
                                   ("sep_score", "playerStatsReceivingSeparationScorePercentage")))
    if len(sep):
        C = C.merge(sep[["playerPlayerId", "season", "week", "bucket", "tpr", "sep_score"]],
                    on=["playerPlayerId", "season", "week", "bucket"], how="left")
    else:
        C["tpr"] = C["sep_score"] = np.nan
    C["yds"] = C.routes * C.ypr
    C["tgt"] = C.routes * num(C.tpr)
    C = entering(C, ["playerPlayerId", "season", "bucket"],
                 ["routes", "yds", "tgt", "ppr", "sep_score"])
    C["e_ypr"] = C.e_yds / C.e_routes.replace(0, np.nan)       # pooled
    C["e_tpr"] = C.e_tgt / C.e_routes.replace(0, np.nan)
    print(f"  player coverage: {len(C)} player-week-coverages")
    return C


CONCEPTS = ["Zone", "Man"]          # FP's run-concept split: zone vs man/gap blocking
DEPTHS = ["Under0", "0To9", "10To19", "Over20"]
DEPTH_LABEL = {"Under0": "behind the line", "0To9": "0-9 yards", "10To19": "10-19", "Over20": "20+"}


def rb_concept():
    """A RUNNING BACK'S "COVERAGE" IS THE RUN CONCEPT — zone vs man/gap — and both sides exist.

    This is the exact parallel of a receiver's coverage split: his yards per attempt and success rate
    on zone runs against what this defense allows on zone runs. `rushingAdvanced__player` carries his
    side, `rushingAdvanced__opponent` the defense's, and the defense there is `teamNickname`.
    """
    d = load("rushingAdvanced__player")
    if not len(d):
        return pd.DataFrame(), pd.DataFrame()
    rows = []
    for cp in CONCEPTS:
        att = f"playerStatsRushingConcept{cp}AttemptsTotal"
        ypa = f"playerStatsRushingConcept{cp}YardsPerAttempt"
        suc = f"playerStatsRushingConcept{cp}AttemptsSuccessPercentage"
        tds = f"playerStatsRushingConcept{cp}TouchdownsTotal"
        if att not in d.columns:
            continue
        x = d[["playerPlayerId", "season", "week"]].copy()
        x["bucket"] = cp
        x["att"] = num(d[att])
        x["ypa"] = num(d[ypa]) if ypa in d.columns else np.nan
        x["succ"] = num(d[suc]) if suc in d.columns else np.nan
        x["tds"] = num(d[tds]) if tds in d.columns else np.nan
        ran = x.att > 0
        for c in ("ypa", "succ", "tds"):
            x.loc[ran & x[c].isna(), c] = 0.0
        x["yds"] = x.att * x.ypa                     # pool, never average per-game ratios
        rows.append(x)
    ov = d[["playerPlayerId", "season", "week"]].copy()
    ov["bucket"] = "Overall"
    ov["att"] = num(d.playerStatsRushingAttemptsTotal)
    ov["ypa"] = num(d.playerStatsRushingYardsPerAttempt)
    ov["succ"] = num(d.playerStatsRushingAttemptsSuccessPercentage)
    ov["tds"] = num(d.playerStatsRushingTouchdownsTotal)
    ran = ov.att > 0
    for c in ("ypa", "succ", "tds"):
        ov.loc[ran & ov[c].isna(), c] = 0.0
    ov["yds"] = ov.att * ov.ypa
    rows.append(ov)
    C = pd.concat(rows, ignore_index=True)
    C = entering(C, ["playerPlayerId", "season", "bucket"], ["att", "yds", "succ", "tds"])
    C["e_ypa"] = C.e_yds / C.e_att.replace(0, np.nan)

    o = load("rushingAdvanced__opponent")
    if not len(o) or "teamNickname" not in o.columns:
        return C, pd.DataFrame()
    drows = []
    for cp in CONCEPTS:
        att = f"opponentStatsRushingConcept{cp}AttemptsTotal"
        yds = f"opponentStatsRushingConcept{cp}YardsTotal"
        suc = f"opponentStatsRushingConcept{cp}AttemptsSuccessPercentage"
        if att not in o.columns:
            continue
        x = o[["season", "week"]].copy()
        x["def_team"] = ab(o.teamNickname.map(NICK))          # defense = teamNickname
        x["bucket"] = cp
        x["att"] = num(o[att])
        x["yds"] = num(o[yds]) if yds in o.columns else np.nan
        x["succ"] = num(o[suc]) if suc in o.columns else np.nan
        drows.append(x)
    if not drows:
        return C, pd.DataFrame()
    Dc = pd.concat(drows, ignore_index=True)
    g = (Dc.groupby(["def_team", "season", "week", "bucket"], as_index=False)
           .agg(att=("att", lambda x: x.sum(min_count=1)),
                yds=("yds", lambda x: x.sum(min_count=1)), succ=("succ", "mean")))
    e = _def_entering(g, ["bucket"], ["att", "yds", "succ"], k=3.0)
    e["e_ypa"] = e.e_yds / e.e_att.replace(0, np.nan)
    e["ypa_lg"] = e.yds_lg / e.att_lg.replace(0, np.nan)
    e = _rank(e, ["season", "week", "bucket"], ["ypa", "succ"])
    print(f"  rb concept: {len(C)} player-week-concepts, {len(e)} defense-week-concepts")
    return C, e


def rb_consistency():
    """How often he GETS there, not just his average — the right shape for a rushing-yards card."""
    cols = [f"playerStatsRushingRuns{k}OrMorePercentage"
            for k in ("One", "Three", "Five", "Ten", "Fifteen", "Twenty")]
    extra = ["marketShareInside10RushingAttemptsTotal", "marketShareInside20RushingAttemptsTotal",
             "playerStatsInside10ReceivingTargetsTotal"]
    d = load("rushingBasic__player", ["gameSeason", "gameWeek", "playerPlayerId"] + cols + extra)
    if not len(d):
        return pd.DataFrame()
    keep = [c for c in cols + extra if c in d.columns]
    return entering(d.drop_duplicates(["playerPlayerId", "season", "week"]),
                    ["playerPlayerId", "season"], keep)


def qb_depth():
    """A QB'S "ROUTE TREE" IS THROW DEPTH, and the defense's allowance by depth is derivable.

    `passingDepth__player` buckets every QB-game into behind-the-line / 0-9 / 10-19 / 20+ with an
    Overall cell for the denominator. The defense side is NOT published per depth, so it is built the
    same way the per-route allowance was: group the QB rows on the opponent they faced.
    """
    d = load("passingDepth__player", ["gameSeason", "gameWeek", "playerPlayerId",
                                      "opponentAbbreviation", "bucket"])
    if not len(d):
        return pd.DataFrame(), pd.DataFrame()
    L = bucket_long(d, "bucket", DEPTHS + ["Overall"], {
        "att": "playerStatsPassingAttemptsTotal",
        "yds": "playerStatsPassingYardsTotal",
        "tds": "playerStatsPassingTouchdownsTotal",
        "comp": "playerStatsPassingCompletionsTotal",
        "catchable": "playerStatsPassingAttemptsCatchablePercentage"})
    if not len(L):
        return pd.DataFrame(), pd.DataFrame()
    for c in ("att", "yds", "tds", "comp", "catchable"):
        L[c] = num(L[c])
    thrown = L.att > 0
    for c in ("yds", "tds", "comp", "catchable"):
        L.loc[thrown & L[c].isna(), c] = 0.0
    P = entering(L, ["playerPlayerId", "season", "bucket"], ["att", "yds", "tds", "comp"])
    P["e_ypa"] = P.e_yds / P.e_att.replace(0, np.nan)
    P["e_comp_pct"] = P.e_comp / P.e_att.replace(0, np.nan)
    Dd = L.dropna(subset=["opp"]).copy()
    Dd["def_team"] = ab(Dd.opp)
    g = (Dd.groupby(["def_team", "season", "week", "bucket"], as_index=False)
           .agg(att=("att", lambda x: x.sum(min_count=1)),
                yds=("yds", lambda x: x.sum(min_count=1)),
                tds=("tds", lambda x: x.sum(min_count=1))))
    e = _def_entering(g, ["bucket"], ["att", "yds", "tds"], k=3.0)
    e["e_ypa"] = e.e_yds / e.e_att.replace(0, np.nan)
    e["ypa_lg"] = e.yds_lg / e.att_lg.replace(0, np.nan)
    e = _rank(e, ["season", "week", "bucket"], ["ypa", "att"])
    print(f"  qb depth: {len(P)} qb-week-depths, {len(e)} defense-week-depths")
    return P, e


SCRIPT_BUCKETS = ["Overall", "Neutral", "Leading", "Trailing", "FirstDown", "ThirdDown",
                  "Inside10", "Inside20", "Under5", "Over10", "FirstHalf", "SecondHalf"]


def team_script():
    """Pass rate by SITUATION per team — play-calling measured from behaviour, layer 3 + 6.

    `runPassReport__team.bucket` splits offensive snaps into pass and rush for Leading / Trailing /
    Neutral, 1st and 3rd down, Inside 10, Inside 20, yards-to-go bands and halves. That is the
    coaching layer without a coach database: what they actually DO in each spot.

    Pooled, not a mean of per-game rates: a game with 3 inside-10 snaps must not weigh the same as
    one with 12 (the same error that put a defense's in-dig allowance 27% off).
    """
    rp = load("runPassReport__team")
    if not len(rp):
        return pd.DataFrame()
    rows = []
    for r in rp.itertuples(index=False):
        b = getattr(r, "bucket", None)
        if not isinstance(b, dict):
            continue
        nk = NICK.get(getattr(r, "teamNickname", None))
        t = AB_NV.get(nk, nk)
        if t is None:
            continue
        for k in SCRIPT_BUCKETS:
            c = b.get("bucket" + k)
            if not isinstance(c, dict):
                continue
            rows.append({"team": t, "season": r.season, "week": r.week, "bucket": k,
                         "p": c.get("teamStatsSnapsOffensePass") or 0.0,
                         "r": c.get("teamStatsSnapsOffenseRush") or 0.0})
    if not rows:
        return pd.DataFrame()
    S = pd.DataFrame(rows)
    g = S.groupby(["team", "season", "week", "bucket"], as_index=False).agg(p=("p", "sum"),
                                                                            r=("r", "sum"))
    e = entering(g, ["team", "season", "bucket"], ["p", "r"])
    e["pass_rate"] = e.e_p / (e.e_p + e.e_r).replace(0, np.nan)      # pooled
    e["snaps"] = e.e_p + e.e_r
    e = _rank(e.rename(columns={"team": "def_team"}), ["season", "week", "bucket"], [])
    e = e.rename(columns={"def_team": "team"})
    # rank the pass rate itself within each bucket: 1 = passes the MOST in that situation
    e["pass_rate_rank"] = e.groupby(["season", "week", "bucket"]).pass_rate.rank(ascending=False,
                                                                                method="min")
    e["pass_rate_of"] = e.groupby(["season", "week", "bucket"]).pass_rate.transform(
        lambda x: x.notna().sum())
    print(f"  team script: {len(e)} team-week-situations")
    return e


def redzone():
    """THE RED ZONE AS ITS OWN DIMENSION — his role in it, his team's tendency, their allowance.

    Owner, 2026-10-07: for a back, does the team RUN more inside, against how the defense allows
    running inside; for pass catchers and the QB, does the team PASS more inside, against what the
    defense allows there. Three sides, one block, every position.

    The first red-zone question is never efficiency — it is WHETHER HE IS ON THE FIELD. A back with
    no inside-5 carries and a receiver with no end-zone targets cannot score however good he is, so
    the red-zone snap share leads.

    ⚠ `*__opponent` tables: the defense is `teamNickname`. `*__team`: that team is the offense.
    """
    # ---- his role inside
    sn = load("offenseSnaps__player", ["gameSeason", "gameWeek", "playerPlayerId",
        "marketShareInside5SnapsOffenseTotal", "marketShareInside10SnapsOffenseTotal",
        "marketShareInside20SnapsOffenseTotal", "teamStatsInside5SnapsOffenseTotal",
        "teamStatsInside10SnapsOffenseTotal", "teamStatsInside20SnapsOffenseTotal"])
    rb = load("rushingBasic__player", ["gameSeason", "gameWeek", "playerPlayerId",
        "playerStatsInside5RushingAttemptsTotal", "playerStatsInside10RushingAttemptsTotal",
        "marketShareInside5RushingAttemptsTotal", "marketShareInside10RushingAttemptsTotal",
        "playerStatsInside10ReceivingTargetsTotal", "playerStatsInside20ReceivingTargetsTotal"])
    ra = load("receivingAdvanced__player", ["gameSeason", "gameWeek", "playerPlayerId",
        "playerStatsReceivingTargetsInEndzone", "playerStatsReceivingTouchdownsInEndzone",
        "playerStatsInside20ReceivingTargetsTotal", "marketShareReceivingTouchdownsTotal"])
    pa = load("passingAdvanced__player", ["gameSeason", "gameWeek", "playerPlayerId",
        "playerStatsPassingAttemptsInEndzoneTotal"])
    base = sn.drop_duplicates(["playerPlayerId", "season", "week"])
    for x in (rb, ra, pa):
        if len(x):
            base = base.merge(x.drop_duplicates(["playerPlayerId", "season", "week"]),
                              on=["playerPlayerId", "season", "week"], how="left",
                              suffixes=("", "_dup"))
    base = base[[c for c in base.columns if not c.endswith("_dup")]]
    cols = [c for c in base.columns if c.startswith(("marketShare", "playerStats", "teamStats"))]
    P = entering(base, ["playerPlayerId", "season"], cols)

    # ---- his team's tendency inside, from the situational buckets + the team tables
    rt = load("rushingAdvanced__team", ["gameSeason", "gameWeek", "teamNickname",
                                        "teamStatsInside5RushingAttemptsTotal"])
    rct = load("receivingAdvanced__team", ["gameSeason", "gameWeek", "teamNickname",
        "teamStatsReceivingTargetsInEndzone", "teamStatsInside20ReceivingTargetsTotal"])
    pat = load("passingAdvanced__team", ["gameSeason", "gameWeek", "teamNickname",
                                         "teamStatsPassingAttemptsInEndzoneTotal"])
    tm = None
    for x in (rt, rct, pat):
        if not len(x):
            continue
        x = x.copy()
        x["team"] = ab(x.teamNickname.map(NICK))
        x = x.drop(columns=["teamNickname"])
        tm = x if tm is None else tm.merge(x, on=["team", "season", "week"], how="outer")
    T = pd.DataFrame()
    if tm is not None:
        tcols = [c for c in tm.columns if c.startswith("teamStats")]
        T = entering(tm, ["team", "season"], tcols)

    # ---- their allowance inside
    specs = [("rushingAdvanced__opponent", {"i5_carries_faced": "opponentStatsInside5RushingAttemptsTotal",
                                            "rush_tds_allowed": "opponentStatsRushingTouchdownsTotal"}),
             ("receivingAdvanced__opponent", {"ez_targets_faced": "opponentStatsReceivingTargetsInEndzone",
                                              "ez_tds_allowed": "opponentStatsReceivingTouchdownsInEndzone",
                                              "i20_targets_faced": "opponentStatsInside20ReceivingTargetsTotal"}),
             ("passingAdvanced__opponent", {"ez_attempts_faced": "opponentStatsPassingAttemptsInEndzoneTotal"})]
    parts = []
    for tbl, fields in specs:
        d = load(tbl)
        if not len(d) or "teamNickname" not in d.columns:
            continue
        x = d[["season", "week"]].copy()
        x["def_team"] = ab(d.teamNickname.map(NICK))         # defense = teamNickname
        for k, c in fields.items():
            if c in d.columns:
                x[k] = num(d[c])
        parts.append(x)
    Dz = pd.DataFrame()
    if parts:
        G = parts[0]
        for q in parts[1:]:
            G = G.merge(q, on=["def_team", "season", "week"], how="outer")
        keep = [c for c in G.columns if c not in ("def_team", "season", "week")]
        g = G.groupby(["def_team", "season", "week"], as_index=False)[keep].sum(min_count=1)
        Dz = _def_entering(g, [], keep, k=3.0)
        Dz = _rank(Dz, ["season", "week"], keep)
    print(f"  redzone: {len(P)} player-weeks, {len(T)} team-weeks, {len(Dz)} defense-weeks")
    return P, T, Dz


# ------------------------------------------------------------------ arm 4: the defense
def _def_entering(game_level, extra_keys, cols, k):
    """Entering-game mean per defense, shrunk toward an ENTERING-GAME league mean, weight k games.

    Spec §3 and 22_defensive_tendencies_available.md: a defense's "weakness" after two games is
    noise, so every allowance ships shrunk, with the game count beside it.

    ⛔ THE LEAGUE PRIOR IS ITSELF A LOOK-AHEAD IF YOU LET IT BE. The first version took the league
    mean over the WHOLE frame — every week of the season, including weeks after the one being
    served. That made the week-1 allowance equal to a number computed from games not yet played,
    and the week-1 leak assertion caught it. The prior here is the league mean over PRIOR WEEKS of
    the same season, seeded in week 1 by the PRIOR SEASON's league mean (the same cross-season term
    the baseline blend is allowed), so nothing in a week-W row comes from week >= W.
    """
    ek = list(extra_keys)
    e = entering(game_level, ["def_team", "season"] + ek, cols)
    # ⛔ DYNAMIC SEASON WINDOW (owner, 2026-10-07). Four games is a thin read on a defense, so
    # through a team's first 3 games its allowance is LAST season's own number; from its 4th game
    # this season's replaces it outright. The switch is per DEFENSE, not per week — byes mean a
    # team can sit on 3 games in week 5.
    own_pri = game_level.groupby(["def_team", "season"] + ek, as_index=False)[cols].mean()
    own_pri["season"] = own_pri.season + 1
    own_pri = own_pri.rename(columns={c: "own_" + c for c in cols})
    e = e.merge(own_pri, on=["def_team", "season"] + ek, how="left")
    thin = e.e_n < WINDOW_MIN_GAMES
    for c in cols:
        if ("own_" + c) in e.columns:
            e.loc[thin, "e_" + c] = e.loc[thin, "own_" + c]
    e["window"] = np.where(thin, "last season", "this season")
    # league mean per (season, week[, bucket]) -> entering mean over the season's prior weeks
    wk = game_level.groupby(["season", "week"] + ek, as_index=False)[cols].mean()
    wk = entering(wk, ["season"] + ek, cols, prefix="lg_")
    # prior-season league mean, attached to the next season as the week-1 seed
    pri = game_level.groupby(["season"] + ek, as_index=False)[cols].mean()
    pri["season"] = pri.season + 1
    pri = pri.rename(columns={c: "pri_" + c for c in cols})
    e = e.merge(wk[["season", "week"] + ek + ["lg_" + c for c in cols]],
                on=["season", "week"] + ek, how="left")
    e = e.merge(pri, on=["season"] + ek, how="left")
    for c in cols:
        prior = e["lg_" + c].where(e["lg_" + c].notna(), e["pri_" + c])
        e[c + "_allowed"] = shrink(e["e_" + c], e.e_n, prior, k)
        e[c + "_lg"] = prior
    return e


def _rank(e, within, cols):
    """Rank each defense within `within` on what it has ACTUALLY allowed. Rank 1 = allows the MOST.

    A narrative needs a rank, not a league average: "the Saints allow tons of yards on out routes"
    is only a sentence once it reads "31st of 32". Ranks are computed on the entering ACTUAL value
    (`e_<col>`), never the shrunk one — the shrunk value is a model estimate and ranking it would
    compress the very spread the sentence is about.
    """
    for c in cols:
        g = e.groupby(within)["e_" + c]
        e[c + "_rank"] = g.rank(ascending=False, method="min")
        e[c + "_of"] = g.transform(lambda x: x.notna().sum())
    return e


def defense_by_position():
    """What the opponent allows TO THAT POSITION — the ALLOW half of arm 4.

    ⚠ NOT from fantasyPointsAllowed__player. That is the natural home for this and it is FROZEN at
    2026 week 1, so it would publish a week-1 allowance all season. It is also laid out as a trap:
    `teamAbbreviation` is the SCORING player's own team and the defense is named only by
    `opponentNickname`, so a group-by on teamAbbreviation publishes each offense's production as its
    own defense's allowance — exactly inverted.

    Built instead by grouping the three FRESH per-player tables on `opponentAbbreviation`, which is
    the same arithmetic on current data: every player-game a defense faced, summed per position.
    """
    specs = [("receivingAdvanced__player", {
                "rec_yds": "playerStatsReceivingYardsTotal",
                "receptions": "playerStatsReceivingReceptionsTotal",
                "targets": "playerStatsReceivingTargetsTotal",
                "rec_tds": "playerStatsReceivingTouchdownsTotal",
                "ppr": "playerStatsFantasyPointsPpr"}),
             ("rushingAdvanced__player", {
                "rush_yds": "playerStatsRushingYardsTotal",
                "rush_att": "playerStatsRushingAttemptsTotal",
                "rush_tds": "playerStatsRushingTouchdownsTotal"}),
             ("passingAdvanced__player", {
                "pass_yds": "playerStatsPassingYardsTotal",
                "pass_tds": "playerStatsPassingTouchdownsTotal",
                "pass_att": "playerStatsPassingAttemptsTotal",
                "dropbacks_faced": "playerStatsPassingDropbacksTotal"})]
    parts = []
    for tbl, fields in specs:
        d = load(tbl, ["gameSeason", "gameWeek", "playerPlayerId", "playerPosition",
                       "opponentAbbreviation"] + list(fields.values()))
        if not len(d):
            continue
        d = d.rename(columns={v: k for k, v in fields.items() if v in d.columns})
        keep = [k for k in fields if k in d.columns]
        d["def_team"] = ab(d.opponentAbbreviation)
        d = d[d.playerPosition.isin(["QB", "RB", "WR", "TE"])]
        g = d.groupby(["def_team", "season", "week", "playerPosition"], as_index=False)[keep].sum()
        parts.append(g)
    if not parts:
        return pd.DataFrame()
    G = parts[0]
    for g in parts[1:]:
        G = G.merge(g, on=["def_team", "season", "week", "playerPosition"], how="outer")
    cols = [c for c in G.columns if c not in ("def_team", "season", "week", "playerPosition")]
    e = _def_entering(G, ["playerPosition"], cols, k=3.0)
    e = _rank(e, ["season", "week", "playerPosition"], cols)
    print(f"  def/position: {len(e)} defense-week-positions, {len(cols)} measures + ranks")
    return e


def defense_by_alignment():
    """DEF_ALIGN — what a defense allows to slot / wide / inline / backfield receivers.

    Measured spread (2025): slot 48-98 yds/g allowed, wide 76-127, corr(slot, wide) across defenses
    = +0.14. A defense that smothers the slot says almost nothing about the boundary, so this is a
    different matchup from the position allowance, not a cosmetic split.

    Source is the FRESH bucket table, grouped on the opponent carried INSIDE each bucket — the
    frozen flat routes-run table that first held these columns stops at 2026 wk1.
    """
    L = align_long()
    if not len(L):
        return pd.DataFrame()
    L = L.dropna(subset=["opp"])
    L["def_team"] = ab(L.opp)
    g = (L.groupby(["def_team", "season", "week", "bucket"], as_index=False)
          .agg(routes=("routes", lambda x: x.sum(min_count=1)),
               targets=("targets", lambda x: x.sum(min_count=1)),
               yds=("yds", lambda x: x.sum(min_count=1)),
               sep_win=("sep_win", "mean")))
    e = _def_entering(g, ["bucket"], ["routes", "targets", "yds", "sep_win"], k=3.0)
    e = _rank(e, ["season", "week", "bucket"], ["yds", "targets", "sep_win"])
    print(f"  def/alignment: {len(e)} defense-week-alignments + ranks")
    return e


def defense_by_route():
    """What each defense allows per route family — the colour on the route tree's branches.

    Built from the dedicated bucket table, NOT the cube: the cube records a route family on ~21%
    of rows and double-counts across its other dimensions. Here each receiver-game contributes
    its own routes and yards once, so summing per (defense, game, route) is a real total.
    """
    L = routes_long()
    if not len(L):
        return pd.DataFrame()
    L = L.dropna(subset=["opp"])
    L["def_team"] = ab(L.opp)
    L["yds"] = L.routes * L.ypr                      # weight by routes, never a mean of means
    g = (L.groupby(["def_team", "season", "week", "bucket"], as_index=False)
          .agg(routes=("routes", lambda x: x.sum(min_count=1)),
               yds=("yds", lambda x: x.sum(min_count=1)),
               depth_w=("depth_w", lambda x: x.sum(min_count=1)),
               sep_win=("sep_win", "mean")))
    # ⛔ SHRINK BY ROUTES FACED, NOT BY GAMES. With k in games every defense has the same count
    # early in a season, so a flat k damps every route identically — and the routes are wildly
    # uneven: entering wk5 2026 TB had faced 26.7 hitches a GAME but 5.0 slants and 2.0 comebacks.
    # A games-based k left "TB allow 0.20 y/rt on slants" (15 slants of evidence) carrying the same
    # weight as their hitch number (80 routes), and that single cell was the largest term in a
    # receiver's whole matchup read. 60 routes = one unit of evidence.
    e = _def_entering(g, ["bucket"], ["routes", "yds", "depth_w", "sep_win"], k=3.0)
    # pooled: both are entering MEANS over the same games, so the ratio is total yards / total routes
    e["e_ypr"] = e.e_yds / e.e_routes.replace(0, np.nan)
    e["ypr_lg"] = e.yds_lg / e.routes_lg.replace(0, np.nan)
    ev = e.e_routes * e.e_n                          # total routes of that family actually faced
    e["ypr_allowed"] = shrink(e.e_ypr, ev / 60.0, e.ypr_lg, 1.0)
    e["sep_win_allowed"] = shrink(e.e_sep_win, ev / 60.0, e.sep_win_lg, 1.0)
    e["route_evidence"] = ev
    e["ypr_lift"] = e.ypr_allowed - e.ypr_lg         # + = leaky on that route, - = stingy
    # average depth of the routes of this family they FACE — two defenses can allow the same
    # yards per route while conceding them at very different distances.
    e["depth_faced"] = e.e_depth_w / e.e_routes.replace(0, np.nan)
    e = _rank(e, ["season", "week", "bucket"], ["ypr", "sep_win"])
    print(f"  def/route: {len(e)} defense-week-routes")
    return e


def defense_shells():
    """Which coverage shells a defense RUNS, and its pass/run-defense traits — arms 4 and 5.

    ⛔ IN EVERY `*__opponent` TABLE THE DEFENSE IS `teamNickname`, NOT `opponentAbbreviation`.
    `opponentStats*` describes what the OPPONENT (the offense) did, which is what this defense
    allowed or faced. Verified decisively: `opponentStatsPassingDropbacksTotal` equals the opponent
    team's OWN dropbacks from passingAdvanced__team on 100.0% of 2,829 rows.

    The first version grouped on `opponentAbbreviation` and published, for every team, the coverage
    their OFFENSE faced as though it were the coverage their DEFENSE plays — a different team's
    identity under this team's name, on every card. Note this is the OPPOSITE convention from the
    player tables, where `opponentAbbreviation` on a player-game IS the defense he faced.
    """
    specs = [("coverageMatrix__opponent", "CoverageScheme",
              lambda c: "DropbacksPercentage" in c or "FantasyPointsPprPassing" in c),
             ("rushingAdvanced__opponent", "Rushing",
              lambda c: any(k in c for k in ("AttemptsStuffsPercentage", "AttemptsSuccessPercentage",
                                             "YardsAfterContactPerAttempt",
                                             "RunsExplosivePercentage", "TouchdownsPercentage"))),
             ("passingAdvanced__opponent", "Passing",
              lambda c: any(k in c for k in ("PressuredPercentage", "SackedPercentage",
                                             "CompletionsPercentage", "DeepThrowAttemptsPercentage",
                                             "AttemptsCatchablePercentage",
                                             "YardsAfterCatchPercentage",
                                             "TargetedReadCheckdownPercentage"))),
             ("receivingAdvanced__opponent", "Receiving",
              lambda c: "AlignmentSlotTargetsPercentage" in c or "AlignmentWideTargetsPercentage" in c
              or "AlignmentInlineTargetsPercentage" in c or "AlignmentBackfieldTargetsPercentage" in c)]
    parts = []
    for tbl, _, keep in specs:
        d = load(tbl)
        if not len(d) or "teamNickname" not in d.columns:
            continue
        cols = [c for c in d.columns if c.startswith("opponentStats") and keep(c)]
        if not cols:
            continue
        d = d.copy()
        d["def_team"] = ab(d.teamNickname.map(NICK))          # teamNickname IS the defense
        miss = d.def_team.isna().mean()
        if miss > 0.02:
            sys.exit(f"{tbl}: {miss:.1%} of rows have no defense — NICK map is wrong")
        for c in cols:
            d[c] = num(d[c])
        parts.append(d.groupby(["def_team", "season", "week"], as_index=False)[cols].mean())
    if not parts:
        return pd.DataFrame()
    G = parts[0]
    for g in parts[1:]:
        G = G.merge(g, on=["def_team", "season", "week"], how="outer")
    cols = [c for c in G.columns if c.startswith("opponentStats")]
    e = _def_entering(G, [], cols, k=3.0)
    e = _rank(e, ["season", "week"], cols)
    print(f"  def/shells+traits: {len(e)} defense-weeks, {len(cols)} measures + ranks")
    return e


# ------------------------------------------------------------------ assembly
# short plain keys for the client, so a renderer never has to know an FP column name.
ROLE_KEYS = {
    "snap_share": "e_marketShareSnapsOffenseTotal",
    "route_share": "e_marketShareReceivingRoutesTotal",
    "target_share": "e_marketShareReceivingTargetsTotal",
    "rec_yds_share": "e_marketShareReceivingYardsTotal",
    "rec_td_share": "e_marketShareReceivingTouchdownsTotal",
    "carry_share": "e_marketShareRushingAttemptsTotal",
    "rz5_carry_share": "e_marketShareInside5RushingAttemptsTotal",
    "xfp_share": "e_marketShareXfpPprTotal",
    "routes_per_game": "e_playerStatsReceivingRoutesTotal",
    "ez_targets": "e_playerStatsReceivingTargetsInEndzone",
    "rz20_targets": "e_playerStatsInside20ReceivingTargetsTotal",
    "align_slot_share": "e_playerStatsReceivingAlignmentSlotRoutesPercentage",
    "align_wide_share": "e_playerStatsReceivingAlignmentWideRoutesPercentage",
    "align_inline_share": "e_playerStatsReceivingAlignmentInlineRoutesPercentage",
    "align_backfield_share": "e_playerStatsReceivingAlignmentBackfieldRoutesPercentage",
}
EFF_KEYS = {
    "targets_per_route": "e_playerStatsReceivingTargetsPerRoute",
    "catchable_pct": "e_playerStatsReceivingTargetsCatchablePercentage",
    "contested_targets": "e_playerStatsReceivingTargetsContestedTotal",
    "adot": "e_playerStatsReceivingAverageDepthOfTarget",
    "yards_per_route": "e_playerStatsReceivingAveragesPerRouteYardsTotal",
    "xfp_ppr": "e_playerStatsXfpPprTotal",
    "rush_stuff_pct": "e_playerStatsRushingAttemptsStuffsPercentage",
    "rush_success_pct": "e_playerStatsRushingAttemptsSuccessPercentage",
    "yds_after_contact_per_att": "e_playerStatsRushingYardsAfterContactPerAttempt",
    "explosive_run_pct": "e_playerStatsRushingRunsExplosivePercentage",
    "pass_catchable_pct": "e_playerStatsPassingAttemptsCatchablePercentage",
    "dropbacks": "e_playerStatsPassingDropbacksTotal",
    "hero_throw_pct": "e_playerStatsPassingHeroThrowPercentage",
    "deep_throw_pct": "e_playerStatsPassingDeepThrowAttemptsPercentage",
    "pressured_pct": "e_playerStatsPassingPressuredPercentage",
    "ez_attempts": "e_playerStatsPassingAttemptsInEndzoneTotal",
}
ALIGN_SHARE = {"Slot": "align_slot_share", "Wide": "align_wide_share",
               "Inline": "align_inline_share", "Backfield": "align_backfield_share"}


# Keys that are SAMPLE SIZES, not measures. A block holding nothing but these is empty: the
# week-1 leak assertion caught `{"games": 0}` surviving _clean and making every week-1 scheme and
# playsheet block look like real content.
COUNT_ONLY = {"games", "def_games", "side_games", "align_weight", "route"}


def _only_metadata(d):
    """True when a block holds nothing but sample sizes, ranks and labels — no measure.

    A hand-listed COUNT_ONLY kept falling behind: every new block added another metadata key
    (`def_plays_of`, `def_routes_faced`, `def_rank`) and a week-1 block full of zeros slipped
    through the NaN filter looking like real content. Decide by SHAPE instead of by name.
    """
    return all(k in COUNT_ONLY or k.endswith(("_of", "_rank", "_games", "_faced"))
               for k in d)


def _clean(d):
    """Drop NaN so an arm with no FP data COLLAPSES instead of rendering a zero (spec §4)."""
    out = {}
    for k, v in d.items():
        if isinstance(v, dict):
            v = _clean(v)
            if v and not _only_metadata(v):
                out[k] = v
        elif isinstance(v, (list, tuple)):
            if len(v):
                out[k] = list(v)
        elif v is None or (isinstance(v, float) and not np.isfinite(v)):
            continue
        elif isinstance(v, (np.integer,)):
            out[k] = int(v)
        elif isinstance(v, (np.floating,)):
            out[k] = round(float(v), 4)
        elif isinstance(v, (np.bool_, bool)):
            out[k] = bool(v)
        else:
            out[k] = v
    return out


def _fin(x):
    """True only for a real, finite number — not for None, NaN, or a pandas NA."""
    try:
        return x is not None and np.isfinite(float(x))
    except (TypeError, ValueError):
        return False


def _pick(row, keys):
    return {k: row.get(c) for k, c in keys.items() if c in row}


def vacancies(role):
    """{(season, week, team): vacated usage} — what the injury report takes off the field.

    Owner 2026-10-08: "players who are out in a particular game means the share of production goes
    to other players. You haven't even considered that." Nothing read an injury report before this.

    The share is the teammate's ENTERING share (what he HAD been doing, from weeks < W) and the
    designation is pregame, so both are known before kickoff. Pairing them the other way round —
    taking the share from the week in question — would read an out player's zero usage as zero
    vacancy, which is backwards.
    """
    try:
        from fp_vacated import team_vacancies
    except Exception as e:
        print(f"  vacated: unavailable ({e})")
        return {}
    if role is None or not len(role):
        return {}
    seasons = sorted({int(x) for x in role.season.dropna().unique()})
    # the role frame is keyed by FP id; injuries are gsis, so come back through the crosswalk
    cw = pd.read_parquet(FP / "player_crosswalk.parquet").drop_duplicates("playerPlayerId")
    r = role.merge(cw[["playerPlayerId", "player_id"]], on="playerPlayerId", how="left")
    r = r[r.player_id.notna()]
    try:
        return team_vacancies(r, seasons)
    except Exception as e:
        print(f"  vacated: failed ({e})")
        return {}


def build(top_routes=4):
    print("[fp-payload] building", flush=True)
    _self_test()
    base = baselines()
    role = role_efficiency()
    sch = player_scheme()
    qsch = qb_scheme()
    pcov = player_coverage()
    rbc, rbcd = rb_concept()
    rbcons = rb_consistency()
    qbd, qbdd = qb_depth()
    rzp, rzt, rzd = redzone()
    tsc = team_script()
    sheet, side = playsheet()
    rt = player_routes()
    dpos = defense_by_position()
    dalign = defense_by_alignment()
    droute = defense_by_route()
    dshell = defense_shells()
    vac = vacancies(role)

    # the spine: every (player, season, week) that has a market baseline
    spine = base[["playerPlayerId", "season", "week", "playerPosition", "teamAbbreviation",
                  "opponentAbbreviation"]].drop_duplicates(["playerPlayerId", "season", "week"])
    spine["def_team"] = ab(spine.opponentAbbreviation)
    if UPCOMING_WEEK is not None:
        opp = upcoming_opponents(int(spine.season.max()), UPCOMING_WEEK)
        # our abbreviations on both sides of the lookup, since FP's ARZ/BLT/CLV/HST are already mapped
        opp = {AB_NV.get(k, k): AB_NV.get(v, v) for k, v in opp.items()}
        up = spine.week == UPCOMING_WEEK
        spine.loc[up, "def_team"] = ab(spine.loc[up, "teamAbbreviation"]).map(opp)
        drop = up & spine.def_team.isna()
        if drop.any():
            print(f"  upcoming wk{UPCOMING_WEEK}: dropped {drop.sum()} players on bye/not scheduled")
        spine = spine[~drop]
    key = ["playerPlayerId", "season", "week"]
    dkey = ["def_team", "season", "week"]
    # Group ONCE into plain python records. Holding DataFrames per group and calling .itertuples()
    # / .iloc[0] / .sort_values() inside the loop cost ~39 ms a row (6 minutes for one season);
    # to_dict("records") pays that cost once per group and the loop becomes dict access.
    G = lambda d, k: ({t: g.to_dict("records") for t, g in d.groupby(k)} if len(d) else {})
    G1 = lambda d, k: ({t: g.to_dict("records")[0] for t, g in d.groupby(k)} if len(d) else {})
    bmk, smk = G(base, key), G(sch, key)
    qmk = G(qsch, key) if len(qsch) else {}
    cmk = G(pcov, key) if len(pcov) else {}
    rcm = G(rbc, key) if len(rbc) else {}
    rcd = G1(rbcd, dkey + ["bucket"]) if len(rbcd) else {}
    rcn = G1(rbcons, key) if len(rbcons) else {}
    qdm = G(qbd, key) if len(qbd) else {}
    qdd = G1(qbdd, dkey + ["bucket"]) if len(qbdd) else {}
    rzpm = G1(rzp, key) if len(rzp) else {}
    rztm = G1(rzt, ["team", "season", "week"]) if len(rzt) else {}
    rzdm = G1(rzd, dkey) if len(rzd) else {}
    tsm = G(tsc, ["team", "season", "week"]) if len(tsc) else {}
    rmk = G(rt.sort_values("e_routes", ascending=False), key) if len(rt) else {}
    rol = G1(role, key)
    shm, sdm = G(sheet, key), G(side, key)
    dpm = G1(dpos, dkey + ["playerPosition"]) if len(dpos) else {}
    dam = G(dalign, dkey)
    drm = G1(droute, dkey + ["bucket"]) if len(droute) else {}
    dsm = G1(dshell, dkey)

    out, n_align_w = [], 0
    print(f"  spine: {len(spine)} player-weeks to assemble", flush=True)
    for i, t in enumerate(spine.itertuples(index=False)):
        if i and i % 2000 == 0:
            print(f"    {i}/{len(spine)}", flush=True)
        pk = (t.playerPlayerId, t.season, t.week)
        dk = (t.def_team, t.season, t.week)
        rrow = rol.get(pk, {})
        role_d = _pick(rrow, ROLE_KEYS)
        eff_d = _pick(rrow, EFF_KEYS)

        bl = {}
        for b in bmk[pk]:
            # A market with no blended number is not an arm. Emitting it left a WR carrying a
            # `pass_yds` key holding nothing but {games, rookie} — metadata a card would render as
            # a market he has.
            if not _fin(b["blended"]):
                continue
            bl[b["market"]] = {"blended": b["blended"], "season_to_date": b["season_to_date"],
                               "prior_season": b["prior"], "games": b["games"],
                               "weight_this_season": b["w_season"], "rookie": bool(b["rookie"]),
                               "prior_unavailable": bool(b["prior_unavailable"])}

        pos_allow = {}
        row = dpm.get(dk + (t.playerPosition,))
        if row is not None:
            pos_allow = {"games": row.get("e_n")}
            # The shrunk value ALONE is a lie dressed as a fact: at 3 games with k=3 it is a 50/50
            # blend with the league, so it reads "TB allows 140.9 yds/g to WRs" when they have
            # allowed 119.0. Emit all three parts so a card can say
            # "has allowed X · league Y · stabilised Z" instead of asserting Z.
            for c, v in row.items():
                if c.endswith("_allowed"):
                    base = c[:-8]
                    pos_allow[base] = v
                    pos_allow[base + "_actual"] = row.get("e_" + base)
                    pos_allow[base + "_league"] = row.get(base + "_lg")
                    pos_allow[base + "_rank"] = row.get(base + "_rank")
                    pos_allow[base + "_of"] = row.get(base + "_of")
            pos_allow["window"] = row.get("window")

        align_allow, align_w = {}, {}
        recs = dam.get(dk)
        if recs:
            wsum = 0.0
            for a in recs:
                align_allow[a["bucket"].lower()] = {
                    "yds": a["yds_allowed"], "targets": a["targets_allowed"],
                    "routes": a["routes_allowed"], "sep_win": a["sep_win_allowed"],
                    "yds_actual": a["e_yds"], "yds_league": a["yds_lg"],
                    "yds_rank": a.get("yds_rank"), "yds_of": a.get("yds_of"),
                    "sep_win_rank": a.get("sep_win_rank"),
                    "games": a["e_n"]}
                w = role_d.get(ALIGN_SHARE.get(a["bucket"]))
                # `x or np.nan` is NOT a null check: it turns a real 0.0 into NaN, which is exactly
                # how a zeroed DEF_ALIGN stayed invisible once already. Test finiteness directly.
                if _fin(w) and _fin(a["yds_allowed"]):
                    align_w["yds"] = align_w.get("yds", 0.0) + w * a["yds_allowed"]
                    if _fin(a["targets_allowed"]):
                        align_w["targets"] = align_w.get("targets", 0.0) + w * a["targets_allowed"]
                    wsum += w
            # The spec's rule: a 70%-slot receiver reads the slot number, a balanced one a blend.
            # NORMALISE, don't assume the shares sum to 1: each alignment share is an entering mean
            # over its OWN non-null games, so a player who lined up wide in some games and in the
            # slot in others can total 1.155 (Skyy Moore, 2025 wk10). `align_weight` is kept as the
            # diagnostic for exactly that.
            if wsum > 0.2:
                align_w = {k: v / wsum for k, v in align_w.items()}
                align_w["align_weight"] = wsum
                n_align_w += 1
            else:
                align_w = {}

        scheme_d, overall_sh = {}, None
        for s_ in smk.get(pk, ()):
            if s_["bucket"] == "Overall":
                overall_sh = {"yards_per_route": s_["e_ypr"], "targets_per_route": s_["e_tpr"],
                              "routes": s_["e_routes"], "ppr": s_["e_ppr"]}
                continue
            scheme_d[s_["bucket"]] = {"routes": s_["e_routes"], "targets_per_route": s_["e_tpr"],
                                      "yards_per_route": s_["e_ypr"], "ppr": s_["e_ppr"],
                                      "games": s_["e_n"]}
        for q in qmk.get(pk, ()):
            scheme_d[q["bucket"]] = {"ppr": q["e_ppr"], "dropbacks": q["e_dropbacks"],
                                     "dropback_share": q["e_share"],
                                     "ppr_per_dropback": q["e_ppr_per_db"], "games": q["e_n"]}
        shells, traits = {}, {}
        row = dsm.get(dk)
        if row is not None:
            for c, v in row.items():
                if not c.endswith("_allowed"):
                    continue
                base = c[:-8]
                nm = (base.replace("opponentStatsCoverageScheme", "")
                          .replace("PassingDropbacksPercentage", "_rate")
                          .replace("FantasyPointsPprPassing", "_ppr")
                          .replace("opponentStats", ""))
                tgt = shells if "CoverageScheme" in base else traits
                tgt[nm] = v
                tgt[nm + "_actual"] = row.get("e_" + base)
                tgt[nm + "_league"] = row.get(base + "_lg")
                tgt[nm + "_rank"] = row.get(base + "_rank")
                tgt[nm + "_of"] = row.get(base + "_of")

        # route tree: his top families overall, coloured by this defense's season-long allowance
        tree = []
        overall_rt = None
        for m in rmk.get(pk, ()):
            if m["bucket"] == "Overall":                  # the denominator, never a branch
                overall_rt = {"yards_per_route": m.get("e_ypr"),
                              "targets_per_route": m.get("e_tpr"), "depth": m.get("e_depth"),
                              "sep_score": m.get("e_sep_score"), "routes": m.get("e_routes")}
                continue
            if len(tree) >= top_routes:
                break
            # The tree is HIS tree. With no route history there is no branch to draw, so a leaf
            # carrying only the defense's allowance must not be emitted — in week 1 that is every
            # leaf, and it is what the leak assertion flagged.
            if not _fin(m["e_routes"]):
                continue
            leaf = {"route": m["bucket"], "share": m["share"], "routes": m["e_routes"],
                    "targets_per_route": m["e_tpr"], "yards_per_route": m["e_ypr"],
                    "depth": m.get("e_depth"),          # how far downfield HE runs this route
                    "sep_score": m.get("e_sep_score"), "sep_win": m["e_sep_win"],
                    "games": m["e_n"]}
            h = drm.get(dk + (m["bucket"],))
            if h is not None:
                leaf["def_yards_per_route"] = h.get("ypr_allowed")
                leaf["def_yards_per_route_actual"] = h.get("e_ypr")
                leaf["def_yards_per_route_league"] = h.get("ypr_lg")
                leaf["def_lift_vs_league"] = h.get("ypr_lift")
                leaf["def_sep_win_allowed"] = h.get("sep_win_allowed")
                leaf["def_routes_faced"] = h.get("route_evidence")
                leaf["def_rank"] = h.get("ypr_rank")
                leaf["def_of"] = h.get("ypr_of")
                leaf["def_sep_win_rank"] = h.get("sep_win_rank")
                leaf["def_depth_faced"] = h.get("depth_faced")   # at what distance they concede it
                leaf["def_games"] = h.get("e_n")
                # ⭐ the depth question the tree could not answer: is he running this route
                # DEEPER than the defense usually has to defend it?
                if _fin(m.get("e_depth")) and _fin(h.get("depth_faced")):
                    leaf["depth_vs_faced"] = m["e_depth"] - h["depth_faced"]
            leaf = _clean(leaf)
            if not _only_metadata(leaf):
                tree.append(leaf)

        # COVERAGE: his rate against each specific coverage, beside how often this defense plays it
        cov, overall_cv = {}, None
        for c in cmk.get(pk, ()):
            nm = c["bucket"]
            if nm == "Overall":
                overall_cv = {"yards_per_route": c.get("e_ypr"),
                              "targets_per_route": c.get("e_tpr"),
                              "sep_score": c.get("e_sep_score"), "routes": c.get("e_routes"),
                              "ppr": c.get("e_ppr")}
                continue
            blk = {"routes": c["e_routes"], "yards_per_route": c["e_ypr"],
                   "targets_per_route": c["e_tpr"], "sep_score": c["e_sep_score"],
                   "ppr": c["e_ppr"], "games": c["e_n"]}
            rate = shells.get(nm + "_rate_actual")
            if rate is not None:
                blk["def_plays_rate"] = rate
                blk["def_plays_rank"] = shells.get(nm + "_rate_rank")
                blk["def_plays_of"] = shells.get(nm + "_rate_of")
            cov[nm] = blk

        spots, sides = {}, {}
        overall_al = None
        for a in shm.get(pk, ()):
            if a["bucket"] == "Overall":
                overall_al = {"yards_per_route": a.get("e_ypr"),
                              "targets_per_route": a.get("e_tpr"),
                              "sep_score": a.get("e_sep_score"), "routes": a.get("e_routes")}
                continue
            spots[a["bucket"].lower()] = {
                "routes": a["e_routes"], "targets": a["e_targets"], "yds": a["e_yds"],
                "targets_per_route": a["e_tpr"], "yards_per_route": a["e_ypr"],
                "sep_score": a.get("e_sep_score"), "sep_win": a["e_sep_win"],
                "games": a["e_n"]}
        for s_ in sdm.get(pk, ()):
            sides[f"{s_['family']}_{s_['side']}"] = {"routes": s_["routes_prior"],
                                                     "games": s_["side_games"]}

        # RB: run concept is his coverage. His side beside what this defense allows on it.
        concept, concept_ovr = {}, None
        for c in rcm.get(pk, ()):
            blk = {"attempts": c["e_att"], "yards_per_attempt": c.get("e_ypa"),
                   "success": c["e_succ"], "tds": c["e_tds"], "games": c["e_n"]}
            if c["bucket"] == "Overall":
                concept_ovr = blk
                continue
            h = rcd.get(dk + (c["bucket"],))
            if h is not None:
                blk["def_yards_per_attempt"] = h.get("e_ypa")
                blk["def_yards_per_attempt_league"] = h.get("ypa_lg")
                blk["def_success_allowed"] = h.get("e_succ")
                blk["def_attempts_faced"] = h.get("e_att")
                blk["def_rank"] = h.get("ypa_rank")
                blk["def_of"] = h.get("ypa_of")
            concept[c["bucket"]] = blk
        cons = {}
        row = rcn.get(pk)
        if row is not None:
            for k_, lab in [("One", "runs_1plus"), ("Three", "runs_3plus"), ("Five", "runs_5plus"),
                            ("Ten", "runs_10plus"), ("Fifteen", "runs_15plus"),
                            ("Twenty", "runs_20plus")]:
                cons[lab] = row.get(f"e_playerStatsRushingRuns{k_}OrMorePercentage")
            cons["rz10_carry_share"] = row.get("e_marketShareInside10RushingAttemptsTotal")
            cons["rz20_carry_share"] = row.get("e_marketShareInside20RushingAttemptsTotal")

        # QB: throw depth is his route tree. His side beside what this defense allows at that depth.
        depth, depth_ovr = {}, None
        for c in qdm.get(pk, ()):
            blk = {"attempts": c["e_att"], "yards_per_attempt": c.get("e_ypa"),
                   "completion_pct": c.get("e_comp_pct"), "tds": c["e_tds"], "games": c["e_n"]}
            if c["bucket"] == "Overall":
                depth_ovr = blk
                continue
            h = qdd.get(dk + (c["bucket"],))
            if h is not None:
                blk["def_yards_per_attempt"] = h.get("e_ypa")
                blk["def_yards_per_attempt_league"] = h.get("ypa_lg")
                blk["def_attempts_faced"] = h.get("e_att")
                blk["def_rank"] = h.get("ypa_rank")
                blk["def_of"] = h.get("ypa_of")
            depth[c["bucket"]] = blk

        # RED ZONE — three sides in one block. The first question is whether he is even out there.
        rz = {}
        row = rzpm.get(pk)
        if row is not None:
            rz["him"] = {
                "rz5_snap_share": row.get("e_marketShareInside5SnapsOffenseTotal"),
                "rz10_snap_share": row.get("e_marketShareInside10SnapsOffenseTotal"),
                "rz20_snap_share": row.get("e_marketShareInside20SnapsOffenseTotal"),
                "rz5_carries": row.get("e_playerStatsInside5RushingAttemptsTotal"),
                "rz10_carries": row.get("e_playerStatsInside10RushingAttemptsTotal"),
                "rz5_carry_share": row.get("e_marketShareInside5RushingAttemptsTotal"),
                "rz10_carry_share": row.get("e_marketShareInside10RushingAttemptsTotal"),
                "ez_targets": row.get("e_playerStatsReceivingTargetsInEndzone"),
                "ez_tds": row.get("e_playerStatsReceivingTouchdownsInEndzone"),
                "rz20_targets": row.get("e_playerStatsInside20ReceivingTargetsTotal"),
                "rec_td_share": row.get("e_marketShareReceivingTouchdownsTotal"),
                "ez_attempts": row.get("e_playerStatsPassingAttemptsInEndzoneTotal")}
        trow = rztm.get((t.teamAbbreviation and ab(pd.Series([t.teamAbbreviation]))[0],
                         t.season, t.week))
        if trow is not None:
            rz["team"] = {"rz5_carries": trow.get("e_teamStatsInside5RushingAttemptsTotal"),
                          "ez_targets": trow.get("e_teamStatsReceivingTargetsInEndzone"),
                          "rz20_targets": trow.get("e_teamStatsInside20ReceivingTargetsTotal"),
                          "ez_attempts": trow.get("e_teamStatsPassingAttemptsInEndzoneTotal")}
        drow = rzdm.get(dk)
        if drow is not None:
            d_ = {}
            for k_ in ("i5_carries_faced", "rush_tds_allowed", "ez_targets_faced",
                       "ez_tds_allowed", "i20_targets_faced", "ez_attempts_faced"):
                if ("e_" + k_) in drow:
                    d_[k_] = drow.get("e_" + k_)
                    d_[k_ + "_league"] = drow.get(k_ + "_lg")
                    d_[k_ + "_rank"] = drow.get(k_ + "_rank")
                    d_[k_ + "_of"] = drow.get(k_ + "_of")
            rz["defense"] = d_
        # SITUATIONAL PLAY-CALLING — his own team's pass rate by spot, ranked in the league
        sit = {}
        own_ab = ab(pd.Series([t.teamAbbreviation]))[0]
        for b in tsm.get((own_ab, t.season, t.week), ()):
            sit[b["bucket"]] = {"pass_rate": b.get("pass_rate"), "snaps": b.get("snaps"),
                                "pass_rate_rank": b.get("pass_rate_rank"),
                                "pass_rate_of": b.get("pass_rate_of")}

        # ⭐ VACATED USAGE — what the injury report takes off the field around him. His own share
        # is excluded: a player who is himself out is not a prop, and counting him would read his
        # own absence as opportunity.
        vrec = dict(vac.get((int(t.season), int(t.week), own_ab)) or {})
        if vrec:
            vrec["out_players"] = [x for x in (vrec.get("out_players") or [])
                                   if x.get("name") != getattr(t, "player_name", None)]

        out.append({
            "season": int(t.season), "week": int(t.week),
            "playerPlayerId": t.playerPlayerId, "position": t.playerPosition,
            "team": t.teamAbbreviation, "opp": t.def_team,
            "baseline": json.dumps(_clean(bl)),
            "role": json.dumps(_clean(role_d)),
            "efficiency": json.dumps(_clean(eff_d)),
            "matchup": json.dumps(_clean({"vs_position": pos_allow, "vs_alignment": align_allow,
                                          "vs_his_alignment": align_w})),
            "scheme": json.dumps(_clean({"player": scheme_d, "player_overall": overall_sh,
                                         "defense_shells": shells, "defense_traits": traits})),
            "playsheet": json.dumps(_clean({"spots": spots, "sides": sides,
                                            "overall": overall_al})),
            "coverage": json.dumps(_clean({"by": cov, "overall": overall_cv})),
            "route_overall": json.dumps(_clean(overall_rt or {})),
            "run_concept": json.dumps(_clean({"by": concept, "overall": concept_ovr})),
            "run_consistency": json.dumps(_clean(cons)),
            "throw_depth": json.dumps(_clean({"by": depth, "overall": depth_ovr})),
            "redzone": json.dumps(_clean(rz)),
            "situational": json.dumps(_clean(sit)),
            "vacated": json.dumps(_clean(vrec)),
            "routes": json.dumps(tree),
        })
    P = pd.DataFrame(out)
    print(f"  assembled {len(P)} player-weeks | alignment-weighted matchup on {n_align_w}")
    return P


def attach_our_ids(P):
    """Map FP's playerPlayerId to our gsis player_id. Unmatched ids are REPORTED, never dropped."""
    cw = pd.read_parquet(FP / "player_crosswalk.parquet")[["player_id", "playerPlayerId"]]
    cw = cw.dropna().drop_duplicates("playerPlayerId")
    P = P.merge(cw, on="playerPlayerId", how="left")
    print(f"  crosswalk: {P.player_id.notna().mean():.0%} of payload rows carry a gsis player_id")
    return P


def assert_no_leak(P):
    """Week 1 must carry NOTHING from this season. Proven, not trusted.

    The payload is a pre-game surface; one shift() off and every arm on the card is a hindsight
    number that backtests beautifully and loses money. The standard is per blob, because they are
    not all the same kind of thing:
      role / efficiency / playsheet / routes  pure entering-game player state -> EMPTY in week 1
      baseline                                games == 0 and no season_to_date; prior_season is the
                                              one cross-season term the blend is allowed
      matchup / scheme.defense_shells         games == 0; their values may be the PRIOR SEASON's
                                              league mean, which is the same allowance
      scheme.player                           entering-game player state -> EMPTY in week 1
      vacated                                 DELIBERATELY EXEMPT. It pairs a teammate's entering
                                              share with THIS week's injury designation, and an
                                              injury report is pregame information, so a week-1
                                              value is legitimate rather than a leak. The entering
                                              half is what must not slip, and it comes from the
                                              role frame which IS asserted above.
    This has already caught two real leaks: `{"games": 0}` surviving the NaN filter, and a league
    shrinkage prior taken over the whole season including weeks not yet played.
    """
    w1 = P[P.week == 1]
    if not len(w1):
        print("  [leak] no week-1 rows in this slice — assertion skipped")
        return
    for col in ("role", "efficiency", "playsheet", "routes", "route_overall",
                "run_consistency", "situational"):
        bad = [i for i, s_ in zip(w1.index, w1[col]) if json.loads(s_) not in ({}, [])]
        assert not bad, f"week-1 {col} is non-empty on {len(bad)} rows (e.g. {w1[col][bad[0]][:200]})"
    for s_ in w1.baseline:
        for m, v in json.loads(s_).items():
            assert not v.get("games"), f"week-1 {m} counts {v['games']} games of this season"
            assert "season_to_date" not in v, f"week-1 {m} carries a season-to-date value"
            assert not v.get("weight_this_season"), f"week-1 {m} weights this season"
    for s_ in w1.scheme:
        d = json.loads(s_)
        assert not d.get("player"), f"week-1 scheme.player is non-empty: {str(d['player'])[:160]}"
        assert not d.get("player_overall"), "week-1 scheme.player_overall is non-empty"
    # These three blobs mix a PLAYER half and a DEFENSE half. The player half must be empty in
    # week 1; the defense half may legitimately hold the PRIOR SEASON's league mean, the same
    # allowance the baseline blend gets. So assert on the player keys, not on emptiness.
    PLAYER_SIDE = ("attempts", "yards_per_attempt", "success", "tds", "completion_pct",
                   "yards_per_route", "targets_per_route", "sep_score", "routes", "ppr")
    for s_ in w1.redzone:
        d = json.loads(s_)
        assert not d.get("him"), "week-1 redzone.him is non-empty"
        assert not d.get("team"), "week-1 redzone.team is non-empty"
    for col in ("coverage", "run_concept", "throw_depth"):
        for s_ in w1[col]:
            d = json.loads(s_)
            assert not d.get("overall"), f"week-1 {col}.overall is non-empty"
            for b, blk in (d.get("by") or {}).items():
                assert not blk.get("games"), f"week-1 {col}.{b} counts {blk['games']} games"
                bad = [k for k in PLAYER_SIDE if k in blk]
                assert not bad, f"week-1 {col}.{b} carries player-side {bad}"
    for s_ in w1.matchup:
        for half, block in json.loads(s_).items():
            for k, v in (block or {}).items():
                if isinstance(v, dict) and v.get("games"):
                    raise AssertionError(f"week-1 matchup.{half}.{k} counts {v['games']} games")
            if half == "vs_position" and block.get("games"):
                raise AssertionError(f"week-1 matchup.vs_position counts {block['games']} games")
    print(f"  [leak] week 1 clean on {len(w1)} rows: no this-season content in any blob")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--season", type=int, default=None, help="limit the output to one season")
    ap.add_argument("--routes", type=int, default=4, help="branches on the route tree")
    ap.add_argument("--upcoming", type=int, default=None,
                    help="an UNPLAYED week: carry every entering-game aggregate forward to it")
    ap.add_argument("--out", default=str(OUT))
    a = ap.parse_args()
    if a.season:
        globals()["SEASON_FILTER"] = {a.season - 1, a.season}
        print(f"[fp-payload] season filter {sorted(SEASON_FILTER)} "
              f"(prior season kept for the blend's prior term)")
    if a.upcoming:
        globals()["UPCOMING_WEEK"] = a.upcoming
        print(f"[fp-payload] upcoming week {a.upcoming}: state carried forward from played weeks")
    P = build(top_routes=a.routes)
    P = attach_our_ids(P)
    assert_no_leak(P)
    if a.season:
        P = P[P.season == a.season]
    if a.upcoming:
        P = P[P.week == a.upcoming]
    P.to_parquet(a.out, index=False)
    print(f"[fp-payload] wrote {a.out} | {len(P)} rows, seasons {sorted(P.season.unique())}")
    nz = {c: f"{(P[c] != ('[]' if c == 'routes' else '{}')).mean():.0%}"
          for c in ("baseline", "role", "efficiency", "matchup", "scheme", "playsheet", "routes",
                    "coverage", "route_overall", "run_concept", "run_consistency",
                    "throw_depth", "redzone", "situational")}
    print(f"[fp-payload] blob fill rates: {nz}")


if __name__ == "__main__":
    main()
