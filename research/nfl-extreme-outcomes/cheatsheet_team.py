#!/usr/bin/env python3
"""Team-level productivity measures for the cheat sheet, both sides of the ball.

⛔ NOT YARDS. Owner 2026-10-09: yards per game is volume x efficiency smeared together — a defence
leads the league in yards allowed because opponents run 70 plays on it. Where Fantasy Points
publishes an OVER-EXPECTED measure we lead with it, because it already strips the volume and
difficulty confound:
    passing    PassingCompletionsOverExpected
    receiving  ReceivingAveragesPerTargetYardsOverExpected
    rushing    RushingAttemptsSuccessPercentage   (no over-expected equivalent at team scope)

⛔ ORIENTATION. In every FP team table, `teamStats*` is what this team's OFFENCE did and
`opponentStats*` is what its DEFENCE allowed — the same split that makes lineMatchups readable.
A row therefore yields BOTH directions, and the cheat sheet renders them as separate tables.

Everything is entering-game: the value for week W uses weeks 1..W-1 only, so a sheet built on
Thursday never contains Sunday's result.
"""
import pandas as pd
from pathlib import Path

HERE = Path(__file__).resolve().parent
DATA = HERE / "data" / "fpdata"
AB = {"ARZ": "ARI", "BLT": "BAL", "CLV": "CLE", "HST": "HOU", "LAR": "LA"}

# ⛔ The __team tables key on teamNickname, not an abbreviation — only lineMatchups carries both.
# Reuse the payload's map rather than keeping a second copy that can drift.
import sys
sys.path.insert(0, str(HERE))
from fp_prop_payload import NICK, ab as _ab


def _team_col(d):
    if "teamAbbreviation" in d.columns:
        return _ab(d.teamAbbreviation)
    if "teamNickname" in d.columns:
        return _ab(d.teamNickname.map(NICK))
    raise KeyError("no team key on this frame")

# family -> (table, [(measure suffix, short key, higher_is_better_for_the_offence)])
MEASURES = {
    "rushing": ("rushingAdvanced", [
        ("RushingAttemptsSuccessPercentage",      "success_rate",     True),
        ("RushingAttemptsStuffsPercentage",       "stuff_rate",       False),
        ("RushingYardsAfterContactPerAttempt",    "yac_per_att",      True),
        ("RushingMissedTacklesForcedPerAttempt",  "mtf_per_att",      True),
        ("RushingRunsExplosivePercentage",        "explosive_rate",   True),
        ("RushingTouchdownsPercentage",           "td_rate",          True),
        ("RushingConceptZoneAttemptsSuccessPercentage", "zone_success", True),
        ("RushingConceptManAttemptsSuccessPercentage",  "man_success",  True),
        ("RushingConceptZoneAttemptsPercentage",  "zone_share",       None),
        ("RushingConceptManAttemptsPercentage",   "man_share",        None),
    ]),
    "passing": ("passingAdvanced", [
        ("PassingCompletionsOverExpected",        "cpoe",             True),
        ("PassingPressuredOverExpected",          "pressure_oe",      False),
        ("PassingSackedPercentage",               "sack_rate",        False),
        ("PassingAttemptsCatchablePercentage",    "pass_catchable_rate", True),
        ("PassingOffTargetThrowAttemptsPercentage", "off_target_rate", False),
        ("PassingDeepThrowAttemptsPercentage",    "deep_rate",        None),
        ("PassingTargetedReadCheckdownPercentage", "checkdown_rate",  None),
    ]),
    "receiving": ("receivingAdvanced", [
        ("ReceivingAveragesPerTargetYardsOverExpected", "yoe_per_target", True),
        ("ReceivingTargetsPerRoute",              "targets_per_route", True),
        ("ReceivingReceptionsPercentage",         "catch_rate",       True),
        ("ReceivingTargetsCatchablePercentage",   "target_catchable_rate", True),
        ("ReceivingTargetedReadFirstPercentage",  "first_read_rate",  None),
        ("ReceivingAlignmentSlotTargetsPercentage",     "slot_share",     None),
        ("ReceivingAlignmentWideTargetsPercentage",     "wide_share",     None),
        ("ReceivingAlignmentInlineTargetsPercentage",   "inline_share",   None),
        ("ReceivingAlignmentBackfieldTargetsPercentage","backfield_share",None),
    ]),
}


def _entering(d, keys, cols, upcoming=None):
    """Mean over PRIOR weeks only, with a carry-forward row at an unplayed week."""
    d = d.sort_values(list(keys) + ["week"]).copy()
    if upcoming is not None:
        latest = d.season.max()
        syn = d[d.season == latest].drop_duplicates(list(keys), keep="last").copy()
        syn["week"] = upcoming
        syn[cols] = pd.NA
        d = pd.concat([d[~((d.season == latest) & (d.week == upcoming))], syn], ignore_index=True)
        d = d.sort_values(list(keys) + ["week"])
    g = d.groupby(list(keys), sort=False)
    out = d[list(keys) + ["week"]].copy()
    for c in cols:
        v = pd.to_numeric(d[c], errors="coerce")
        out["e_" + c] = v.groupby([d[k] for k in keys]).transform(
            lambda s: s.shift(1).expanding().mean())
    out["e_n"] = g.cumcount()
    return out


def team_measures(season, week, side):
    """One row per team.

    ⛔ THE TWO SIDES LIVE IN DIFFERENT FILES, not two prefixes of one file. A `__team` parquet
    carries only `teamStats*` (that team's offence) and a `__opponent` parquet only
    `opponentStats*` (what that team's defence allowed). In BOTH, `teamNickname` is the team the
    row is about — so the defence table is keyed on the defence, which is the opposite of the
    convention in the player tables where `opponentAbbreviation` is the defence faced.
    """
    scope = "team" if side == "offense" else "opponent"
    pre = "teamStats" if side == "offense" else "opponentStats"
    frames = []
    for fam, (tbl, specs) in MEASURES.items():
        p = DATA / f"{tbl}__{scope}.parquet"
        if not p.exists():
            continue
        want = {f"{pre}{suf}": key for suf, key, _ in specs}
        d = pd.read_parquet(p)
        d = d.rename(columns={"gameSeason": "season", "gameWeek": "week"})
        have = [c for c in want if c in d.columns]
        if not have:
            continue
        d["team"] = _team_col(d)
        d = d[["team", "season", "week"] + have]
        e = _entering(d, ("team", "season"), have, upcoming=week)
        e = e[(e.season == season) & (e.week == week)]
        e = e.rename(columns={f"e_{c}": want[c] for c in have})
        frames.append(e[["team", "e_n"] + [want[c] for c in have]])
    if not frames:
        return pd.DataFrame()
    M = frames[0]
    for f in frames[1:]:
        dup = (set(M.columns) & set(f.columns)) - {"team", "e_n"}
        if dup:
            # a silent pandas _x/_y suffix shipped `catchable_rate_x` to production once
            raise KeyError(f"measure key collision across families: {sorted(dup)}")
        M = M.merge(f.drop(columns=["e_n"]), on="team", how="outer")
    return M
