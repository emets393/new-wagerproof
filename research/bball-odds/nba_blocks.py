#!/usr/bin/env python3
"""Attach the player-level feature blocks that were built and then never wired into the model.

THE GAP THIS CLOSES. The wide cache carries 433 modelling columns and roughly 41% of them are raw
box-score rates. Meanwhile ~43 MB of engineered player-level tables sit in data/parquet unused:
RAPM-valued availability, player shooting regression, style/archetype profiles, talent and luck
regressors, and rotation flags. The originator spread model reproduces the posted line at corr +0.92
but predicts the residual at corr +0.004 -- it spans the market's information and adds nothing
orthogonal to it. Pruning cannot fix that; only new information can, and this is the new information
we already paid to build.

WHAT GETS ATTACHED, and what deliberately does not:

    nba_rapm_team_agg        RAPM-valued team aggregates: level, top-player, concentration, and
                             crucially the *_out_* family -- absences valued by RAPM rather than by
                             the naive points-and-minutes the panel already has.
    nba_player_regression    p_heat / p_conc / p_top / p_ownx -- players shooting above their OWN
                             career finishing rate. This is the block behind the S10 heat-fade
                             signal, a validated NBA edge that the model has never seen.
    nba_regression_features  talent level/spread and luck/expected-eFG regressors.
    player_flags_nba         rotation and out-flag counts.
    style_nba                s_* and pct_* ONLY.

THE style_nba EXCLUSION IS NOT OPTIONAL. Its bare columns (`pace`, `p3_pct`, `ftr` ...) are the
SAME GAME's realised rates -- the leak screen caught them at +0.55 against the result. `s_*` are the
as-of season versions and `pct_*` their within-season percentiles; those are the pregame view. For
the same reason `nba_player_team_agg` is left out entirely for now: its `orc_*` family has leaked
before and 352 columns is too much to screen casually.

EVERY ATTACHED COLUMN IS LEAK-SCREENED before it is returned, and the screen is an ASSERT, not a
warning. A legitimate pregame feature correlates with the LINE at least as strongly as with the
RESULT; the reverse means it saw the box score.
"""
import os
import warnings

import numpy as np
import pandas as pd

warnings.filterwarnings("ignore")

ROOT = os.path.dirname(os.path.abspath(__file__))
PQ = os.path.join(ROOT, "data", "parquet")

# (file, block tag, game-key column, team-key column, column filter, team ids are ESPN's)
#
# THE TEAM-ID SPACES DIFFER AND NOTHING SAYS SO. Game ids line up everywhere (`game.id` /
# `game_key` are balldontlie's and overlap the cache on 5,278 of 5,279), but the three blocks built
# off the ESPN play-by-play carry ESPN team ids while the cache and the flags table carry bdl ones.
# They are both 1-30, so a naive join silently succeeds on the ~13% that happen to collide and
# returns garbage for the rest -- which is exactly what it did before this was caught.
SOURCES = [
    ("nba_rapm_team_agg", "rapm", "game.id", "team_id", lambda c: True, True),
    ("nba_player_regression", "preg", "game.id", "team_id", lambda c: True, True),
    ("nba_regression_features", "rgf", "game.id", "team_id", lambda c: True, True),
    ("player_flags_nba", "pfl", "game_key", "team_id", lambda c: True, False),
    # bare style columns are the same game's realised rates -- as-of views only
    ("style_nba", "sty", "game_key", None, lambda c: c.startswith(("s_", "pct_")), False),
]
DROP = {"date", "is_home", "season", "season_yr", "gidx", "espn_game_id", "game_id",
        "home_team_id", "team_key", "game_key", "game.id", "team_id"}


def espn_to_bdl(D):
    """Derive the ESPN -> balldontlie team-id map, rather than hardcoding a table nobody can check.

    `nba_player_regression` carries both an ESPN team id and an `is_home` flag, and the cache knows
    which bdl id was home. Joining on the shared game id therefore pins each ESPN id to exactly one
    bdl id. Asserted to be a 30-team bijection at 100% purity -- if either id space ever changes,
    this fails loudly instead of joining 13% of the frame and calling it sparse data.
    """
    p = pd.read_parquet(os.path.join(PQ, "nba_player_regression.parquet"))
    p = p.assign(g=pd.to_numeric(p["game.id"], errors="coerce"),
                 t=pd.to_numeric(p["team_id"], errors="coerce"))
    d = D.assign(g=pd.to_numeric(D["game.id"], errors="coerce"))
    m = p.merge(d[["g", "hid", "aid"]], on="g", how="inner")
    m["bdl"] = np.where(m["is_home"].astype(bool), m["hid"], m["aid"])
    top = m.groupby("t")["bdl"].agg(lambda s: s.value_counts().index[0])
    pur = m.groupby("t")["bdl"].agg(lambda s: s.value_counts().iloc[0] / len(s)).min()
    assert len(top) == 30 and top.nunique() == 30, f"team map is not a bijection ({len(top)} teams)"
    assert pur > 0.999, f"team map is ambiguous (purity {pur:.4f})"
    return {str(int(k)): str(int(v)) for k, v in top.items()}


def _load(name, gcol, tcol, keep):
    d = pd.read_parquet(os.path.join(PQ, f"{name}.parquet"))
    if tcol is None:                      # style keys team as "<team_id>_<season>"
        d["team_id"] = d["team_key"].astype(str).str.split("_").str[0]
        tcol = "team_id"
    d = d.rename(columns={gcol: "gid", tcol: "tid"})
    # every id space in this repo is a mix of int, float and str across files; normalise to str
    d["gid"] = pd.to_numeric(d["gid"], errors="coerce").astype("Int64").astype(str)
    d["tid"] = pd.to_numeric(d["tid"], errors="coerce").astype("Int64").astype(str)
    cols = [c for c in d.columns
            if c not in DROP and c not in ("gid", "tid")
            and keep(c) and pd.api.types.is_numeric_dtype(d[c])]
    return d.drop_duplicates(["gid", "tid"])[["gid", "tid"] + cols], cols


def attach(D):
    """Join every unused block for both teams. Returns (D, blocks) keyed by block tag."""
    n0 = len(D)
    tmap = espn_to_bdl(D)
    D = D.copy()
    D["_gid"] = pd.to_numeric(D["game.id"], errors="coerce").astype("Int64").astype(str)
    blocks = {}

    for name, tag, gcol, tcol, keep, is_espn in SOURCES:
        S, cols = _load(name, gcol, tcol, keep)
        if is_espn:
            S["tid"] = S["tid"].map(tmap)
        made = []
        for side, idc in (("h", "hid"), ("a", "aid")):
            key = pd.to_numeric(D[idc], errors="coerce").astype("Int64").astype(str)
            ren = {c: f"{side}_{tag}_{c}" for c in cols}
            T = S.rename(columns={**ren, "tid": idc + "_s"})
            D = D.merge(T.rename(columns={"gid": "_gid", idc + "_s": "_tid"}),
                        left_on=["_gid", key.rename("_tid")], right_on=["_gid", "_tid"],
                        how="left").drop(columns=["_tid"])
            made += list(ren.values())
        assert len(D) == n0, f"{name} join changed row count {n0} -> {len(D)}"

        # own/opp differences and sums: the panel melts h_/a_ pairs, but a diff is the construction
        # that actually carries a matchup, and the ablation showed levels alone do nothing.
        for c in cols:
            h, a = D[f"h_{tag}_{c}"], D[f"a_{tag}_{c}"]
            D[f"{tag}_{c}_d"] = h - a
            D[f"{tag}_{c}_s"] = h + a
            made += [f"{tag}_{c}_d", f"{tag}_{c}_s"]

        cov = D[f"h_{tag}_{cols[0]}"].notna().mean()
        blocks[tag] = made
        print(f"[blocks] {name:26s} {len(cols):3d} cols x2 sides + diffs = {len(made):3d} | "
              f"joined on {cov:.1%} of games", flush=True)

    return D.drop(columns=["_gid"]), blocks


def leak_screen(D, blocks, strict=True):
    """A pregame feature must correlate with the LINE at least as strongly as with the RESULT.

    Run on every attached column. `style_nba` bare rates and `player_team_agg.orc_*` have both been
    caught by exactly this test, so it is an assert rather than a print.
    """
    line = D["t60_spread_home_point"].astype(float)
    res = D["y_fg_marg_resid"].astype(float)
    tot_line = D["t60_total_point"].astype(float)
    tot_res = D["y_fg_tot_resid"].astype(float)
    bad = []
    for tag, cols in blocks.items():
        for c in cols:
            v = pd.to_numeric(D[c], errors="coerce")
            if v.notna().sum() < 500 or v.std() == 0:
                continue
            for ln, rs in ((line, res), (tot_line, tot_res)):
                rl, rr = abs(v.corr(ln)), abs(v.corr(rs))
                if rr > max(0.10, rl + 0.05):
                    bad.append((c, rl, rr))
                    break
    if bad:
        top = sorted(bad, key=lambda x: -x[2])[:12]
        msg = "\n".join(f"    {c:34s} line {rl:+.3f}  result {rr:+.3f}" for c, rl, rr in top)
        print(f"[blocks] LEAK SCREEN FLAGGED {len(bad)} columns:\n{msg}", flush=True)
        if strict:
            raise AssertionError(f"{len(bad)} attached columns know the result better than the line")
    else:
        n = sum(len(v) for v in blocks.values())
        print(f"[blocks] leak screen clean — {n} attached columns, 0 flagged", flush=True)
    return [c for c, _, _ in bad]


if __name__ == "__main__":
    D = pd.read_parquet(os.path.join(PQ, "_nba_wide_cache.parquet"))
    D, blocks = attach(D)
    flagged = leak_screen(D, blocks, strict=False)
    print(f"\n[blocks] total attached: {sum(len(v) for v in blocks.values())} columns "
          f"| flagged {len(flagged)}", flush=True)
