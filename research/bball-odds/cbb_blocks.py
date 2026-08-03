#!/usr/bin/env python3
"""Attach the CBB player-level blocks that were built and then never wired into a model.

THE GAP THIS CLOSES, and it is the same gap the NBA had. `sides_table_ncaab.parquet` carries 180
columns and every one of them is a team box rate, a KenPom rating, a style percentile, an
availability FLAG or a streak. Meanwhile ~40 MB of engineered PLAYER-level college tables sit in
data/parquet unused: shooting-regression heat, star shot profiles, lineup/rotation shape, RAPM and
on-off impact, and possession-level efficiency. Wiring exactly those blocks in -- not pruning -- is
what turned the NBA models around (see NBA_PRUNE.md and the originator model briefs), so the college
port starts here rather than with another parameter sweep.

WHAT IS DIFFERENT FROM THE NBA, and it is a real constraint rather than an oversight:

  * ONE TEAM-ID SPACE. Every college block is keyed by the CBBD `teamId` and the CBBD `gameId`
    (`cbbd_id` on the odds spine), so the ESPN->balldontlie bijection that `nba_blocks.py` has to
    derive empirically simply does not arise. The join is exact.
  * RAPM AND IMPACT ARE SEASON-LEVEL, NOT DATE-STAMPED. `nba_rapm_agg.py` stamps each rating with
    the month it becomes usable and joins backwards-only. The college tables have one row per
    (player, team, season) with no as-of stamp, so joining the CURRENT season's rating onto a
    January game hands the model a coefficient fitted partly on games it is being asked to predict.
    Lagging them by a season is the obvious fix and it was built, measured and switched back off --
    see LAGGED below. College roster turnover makes last-year's-team-average nearly uninformative.

EVERY ATTACHED COLUMN IS LEAK-SCREENED and the screen is an ASSERT, not a warning: a pregame feature
must correlate with the posted LINE at least as strongly as with the RESULT, or it saw the box score.
That test has already caught `style_nba`'s bare rates and `nba_player_team_agg.orc_*`; it is the
reason `style_ncaab` enters as `s_*`/`pct_*` only and the reason the possession and starter-unit
blocks are screened rather than assumed.
"""
import os
import warnings

import numpy as np
import pandas as pd

warnings.filterwarnings("ignore")

ROOT = os.path.dirname(os.path.abspath(__file__))
PQ = os.path.join(ROOT, "data", "parquet")

# (file, tag, game-key, team-key, column filter)
# Keys are all CBBD ids. `cbbd_id` on the odds spine IS `gameId` / `game_key`.
SOURCES = [
    # players shooting above their OWN season finishing rate -- the block behind the validated
    # college heat work (NCAAB_HEAT_BRIEF.md), never seen by any model.
    ("ncaab_player_heat", "heat", "gameId", "teamId", lambda c: True),
    # where the team's best player takes his shots: rim vs three.
    ("star_profiles_ncaab", "star", "gameId", "teamId", lambda c: True),
    # rotation shape: star dependence, top-2 minute share, depth, bench drop-off.
    ("lineup_profiles", "lup", "cbbd_id", "team_id", lambda c: True),
    # possession-level efficiency and shot location, built off the play-by-play.
    ("possession_team_games", "poss", "gameId", "teamId", lambda c: c.startswith("p_")),
    # coordinate-based xPTS generated/allowed + the actual-minus-expected finishing gap; the
    # fine distance-bin layer the 3-bucket poss profile can't see. Split-half: xq_alwd r=.71
    # (sticky skill), luck_alwd r=.35 (mostly noise -> regression). See build_shot_quality.py.
    ("shot_quality_ncaab", "xq", "gameId", "teamId", lambda c: c.startswith("p_")),
    ("starter_units", "stu", "gameId", "teamId", lambda c: c.startswith("p_")),
    # bare style columns are the SAME GAME's realised rates -- as-of views only.
    # `pct_*` USED TO BE ATTACHED HERE TOO and must not be: the sides table already carries all 16
    # of those percentiles under the identical names, so the block was duplicating them. Verified
    # numerically -- 32 of 32 own/opp column pairs identical, max abs difference 0.00e+00. Ridge
    # tolerates the collinearity, but two copies of one family draw twice the shrinkage budget of a
    # family with one, which silently upweighted style against everything else. See CBB_PRUNE.md.
    ("style_ncaab", "sty", "game_key", None, lambda c: c.startswith("s_")),
]
DROP = {"season", "date", "is_home", "isHomeTeam", "gidx", "season_lbl", "team_key",
        "game_key", "gameId", "teamId", "team_id", "cbbd_id", "game_id", "n_rot"}

# Season-level player tables, lagged one year so last season's rating is a pregame prior.
#
# MEASURED AND THEN SWITCHED OFF -- kept as scaffolding, not as a live block. Two things kill it:
# the tables only cover seasons 2024 and 2025, so lagging leaves 50% of the frame empty, and the
# aggregate barely tracks team quality at all (corr with the KenPom rating +0.098 for RAPM level,
# +0.063 for impact). That is college roster turnover: this aggregates the players who were on the
# roster LAST season, most of whom are gone. The construction that would work is last season's RAPM
# joined to THIS season's returning rotation -- a returning-talent measure rather than a
# last-year's-team measure -- which needs the player box to identify who came back. Not built.
LAGGED = []
LAGGED_SCAFFOLD = [
    ("player_rapm_ncaab", "rapm", ["rapm"], "secs"),
    ("player_impact_ncaab", "imp", ["impact", "on_net", "off_net"], "on_s"),
]


def _load(name, gcol, tcol, keep):
    d = pd.read_parquet(os.path.join(PQ, f"{name}.parquet"))
    if tcol is None:                       # style keys team as "<team_id>_<season>"
        d["team_id"] = d["team_key"].astype(str).str.split("_").str[0]
        tcol = "team_id"
    d = d.rename(columns={gcol: "gid", tcol: "tid"})
    for c in ("gid", "tid"):
        d[c] = pd.to_numeric(d[c], errors="coerce").astype("Int64")
    cols = [c for c in d.columns
            if c not in DROP and c not in ("gid", "tid") and keep(c)
            and pd.api.types.is_numeric_dtype(d[c]) and d[c].notna().mean() > 0.05]
    return d.dropna(subset=["gid", "tid"]).drop_duplicates(["gid", "tid"])[["gid", "tid"] + cols], cols


def _lagged_team(name, tag, vals, wcol):
    """Minute-weighted team aggregate of a season-level player rating, SHIFTED FORWARD ONE SEASON.

    Level, top-player and concentration, mirroring the three NBA RAPM families. The shift is what
    makes it pregame: a 2024-25 game sees the 2023-24 ratings of the players on that roster.
    """
    p = pd.read_parquet(os.path.join(PQ, f"{name}.parquet"))
    p = p.dropna(subset=["team_id", "season"] + vals)
    w = pd.to_numeric(p[wcol], errors="coerce").fillna(0.0).clip(lower=0)
    out = {}
    for v in vals:
        g = p.assign(_x=pd.to_numeric(p[v], errors="coerce"), _w=w).groupby(["team_id", "season"])
        out[f"{v}_lvl"] = g.apply(
            lambda d: np.average(d["_x"], weights=d["_w"]) if d["_w"].sum() > 0 else np.nan)
        out[f"{v}_top"] = g["_x"].max()
        out[f"{v}_sd"] = g["_x"].std()
    T = pd.DataFrame(out).reset_index()
    # END-YEAR season ints: +1 makes last year's rating available to this year's games.
    T["season"] = pd.to_numeric(T["season"], errors="coerce") + 1
    T = T.rename(columns={"team_id": "tid", "season": "syr"})
    T["tid"] = pd.to_numeric(T["tid"], errors="coerce").astype("Int64")
    T["syr"] = pd.to_numeric(T["syr"], errors="coerce").astype("Int64")
    cols = [c for c in T.columns if c not in ("tid", "syr")]
    return T.drop_duplicates(["tid", "syr"]), cols


def attach(D, verbose=True):
    """Join every unused block for both teams. Returns (D, blocks) keyed by block tag.

    `D` must carry `cbbd_id`, `h_team_id`, `a_team_id` and `season` (the "2024-25" label).
    """
    n0 = len(D)
    D = D.copy()
    D["_gid"] = pd.to_numeric(D["cbbd_id"], errors="coerce").astype("Int64")
    # "2024-25" -> 2025, the END-YEAR convention the player tables use.
    D["_syr"] = pd.to_numeric(D["season"].astype(str).str[:4], errors="coerce").astype("Int64") + 1
    blocks = {}

    def _pair(S, cols, tag, keys):
        nonlocal D
        made = []
        for side, idc in (("h", "h_team_id"), ("a", "a_team_id")):
            T = S.rename(columns={c: f"{side}_{tag}_{c}" for c in cols})
            left = ["_gid", idc] if "gid" in keys else ["_syr", idc]
            right = ["gid", "tid"] if "gid" in keys else ["syr", "tid"]
            D[idc] = pd.to_numeric(D[idc], errors="coerce").astype("Int64")
            D = D.merge(T, left_on=left, right_on=right, how="left").drop(columns=right)
            made += [f"{side}_{tag}_{c}" for c in cols]
        assert len(D) == n0, f"{tag} join changed row count {n0} -> {len(D)}"
        # own/opp differences and sums. The panel melts h_/a_ pairs, but a diff is the construction
        # that carries a matchup and the NBA ablation showed levels alone do very little.
        for c in cols:
            h, a = D[f"h_{tag}_{c}"], D[f"a_{tag}_{c}"]
            # `_d` / `_sum`, not `_s`: cbb_panel.classify() files a column as symmetric by testing
            # its LAST token, and `style_ncaab` already ships columns named `s_*`, so an `_s` suffix
            # would both collide and silently fall through to the game-level bucket.
            D[f"{tag}_{c}_d"] = h - a
            D[f"{tag}_{c}_sum"] = h + a
            made += [f"{tag}_{c}_d", f"{tag}_{c}_sum"]
        blocks[tag] = made
        if verbose:
            cov = D[f"h_{tag}_{cols[0]}"].notna().mean()
            print(f"[cbb-blocks] {tag:5s} {len(cols):3d} cols x2 sides + diffs = {len(made):3d} | "
                  f"joined on {cov:.1%} of games", flush=True)

    for name, tag, gcol, tcol, keep in SOURCES:
        S, cols = _load(name, gcol, tcol, keep)
        if not cols:
            print(f"[cbb-blocks] {tag:5s} SKIPPED — no usable columns", flush=True)
            continue
        _pair(S, cols, tag, ("gid",))

    for name, tag, vals, wcol in LAGGED:
        S, cols = _lagged_team(name, tag, vals, wcol)
        _pair(S, cols, tag, ("syr",))

    return D.drop(columns=["_gid", "_syr"]), blocks


def leak_screen(D, blocks, strict=True, min_n=800):
    """A pregame feature must correlate with the LINE at least as strongly as with the RESULT.

    Same test as `nba_blocks.leak_screen`, same thresholds, run against BOTH markets so a column
    that leaks the total but not the margin is still caught. Lag-1 autocorrelation is reported for
    flagged columns because a same-game realised quantity has essentially none, while a genuine
    as-of team property is highly autocorrelated -- that is what separates "it leaked" from "it is
    just a strong feature".
    """
    line = pd.to_numeric(D["t60_spread_home_point"], errors="coerce")
    res = pd.to_numeric(D["margin"], errors="coerce") + line
    tl = pd.to_numeric(D["t60_total_point"], errors="coerce")
    tr = (pd.to_numeric(D["home_score"], errors="coerce")
          + pd.to_numeric(D["away_score"], errors="coerce")) - tl
    bad = []
    for tag, cols in blocks.items():
        for c in cols:
            v = pd.to_numeric(D[c], errors="coerce")
            if v.notna().sum() < min_n or not np.isfinite(v.std()) or v.std() == 0:
                continue
            for ln, rs in ((line, res), (tl, tr)):
                rl, rr = abs(v.corr(ln)), abs(v.corr(rs))
                if rr > max(0.10, rl + 0.05):
                    bad.append((tag, c, rl, rr))
                    break
    if bad:
        top = sorted(bad, key=lambda x: -x[3])[:15]
        msg = "\n".join(f"    {t:5s} {c:30s} line {rl:+.3f}  result {rr:+.3f}"
                        for t, c, rl, rr in top)
        by = pd.Series([t for t, _, _, _ in bad]).value_counts().to_dict()
        print(f"[cbb-blocks] LEAK SCREEN FLAGGED {len(bad)} columns {by}:\n{msg}", flush=True)
        if strict:
            raise AssertionError(f"{len(bad)} attached columns know the result better than the line")
    else:
        n = sum(len(v) for v in blocks.values())
        print(f"[cbb-blocks] leak screen clean — {n} attached columns, 0 flagged", flush=True)
    return [c for _, c, _, _ in bad]


if __name__ == "__main__":
    D = pd.read_parquet(os.path.join(PQ, "sides_table_ncaab.parquet"))
    D, blocks = attach(D)
    flagged = leak_screen(D, blocks, strict=False)
    tot = sum(len(v) for v in blocks.values())
    print(f"\n[cbb-blocks] total attached {tot} columns | flagged {len(flagged)} "
          f"| clean {tot - len(flagged)}", flush=True)
