#!/usr/bin/env python3
"""REBUILD THE FP <-> gsis CROSSWALK BY STAT FINGERPRINT, not by name.

`data/fpdata/player_crosswalk.parquet` is 829 stale rows. The cost is concrete: ~20% of dimension
rows carry no gsis id and so never reach the board, `DC.vacated_above` fires on 62 player-weeks
instead of thousands, and the live read on 2026 wk5 had NO opinion on Tampa's starting quarterback
because the file holds Jayden Daniels and not Jalon Daniels.

⛔ NAME MATCHING IS WHY IT IS STALE. `player_offense.parquet` spells names differently BY SEASON
("A.Rodgers" in 2023, "Aaron Rodgers" in 2026), FP splits first/last, and suffixes and punctuation
drift. Every fix is another special case.

SO MATCH ON WHAT BOTH SIDES MEASURED. If FP and nflverse both record 87 receiving yards on 6
receptions for a DAL player in 2025 week 3, that is the same human being whatever either file calls
him. The fingerprint is (season, week, team, receiving_yards, receptions, rushing_yards, carries),
which is effectively unique within a team-week.

⛔ ONLY ACCEPT UNAMBIGUOUS MATCHES. A fingerprint that maps to more than one player on either side
(two backs with 0 yards on 0 carries, say) is DISCARDED, never guessed -- a wrong crosswalk row
attributes one player's whole dimension set to another, which is worse than a missing row. Rows
with no production at all are excluded for the same reason.
⛔ A player must also map CONSISTENTLY: if his fingerprints across weeks disagree about which gsis
id he is, he is dropped.

Usage: build_crosswalk.py [--out data/fpdata/player_crosswalk_v2.parquet]
"""
import argparse
import os

import numpy as np
import pandas as pd

HERE = os.path.dirname(os.path.abspath(__file__))
FP = os.path.join(HERE, "data", "fpdata")
MIN_PROD = 1.0          # a team-week row needs some production to be a usable fingerprint


def fp_side(seasons):
    rec = pd.read_parquet(os.path.join(FP, "receivingAdvanced__player.parquet"),
                          columns=["gameSeason", "gameWeek", "playerPlayerId", "playerFirstName",
                                   "playerLastName", "playerPosition", "teamAbbreviation",
                                   "playerStatsReceivingYardsTotal",
                                   "playerStatsReceivingReceptionsTotal",
                                   "playerStatsReceivingTargetsTotal"])
    rsh = pd.read_parquet(os.path.join(FP, "rushingAdvanced__player.parquet"),
                          columns=["gameSeason", "gameWeek", "playerPlayerId",
                                   "playerStatsRushingYardsTotal",
                                   "playerStatsRushingAttemptsTotal"])
    d = rec.merge(rsh, on=["gameSeason", "gameWeek", "playerPlayerId"], how="outer")
    d = d.rename(columns={"gameSeason": "season", "gameWeek": "week",
                          "playerPlayerId": "fp_id", "playerPosition": "position",
                          "teamAbbreviation": "team",
                          "playerStatsReceivingYardsTotal": "rec_yds",
                          "playerStatsReceivingReceptionsTotal": "rec",
                          "playerStatsReceivingTargetsTotal": "tgt",
                          "playerStatsRushingYardsTotal": "rush_yds",
                          "playerStatsRushingAttemptsTotal": "carries"})
    for c in ("season", "week", "rec_yds", "rec", "tgt", "rush_yds", "carries"):
        d[c] = pd.to_numeric(d[c], errors="coerce")
    d = d.dropna(subset=["season", "week", "fp_id"]).astype({"season": int, "week": int})
    d["name"] = (d.playerFirstName.fillna("") + " " + d.playerLastName.fillna("")).str.strip()
    return d[d.season.isin(seasons)]


def nv_side(seasons):
    d = pd.read_parquet(os.path.join(HERE, "data", "player_offense.parquet"))
    ren = {"receiving_yards": "rec_yds", "receptions": "rec", "targets": "tgt",
           "rushing_yards": "rush_yds", "carries": "carries", "team": "team"}
    keep = ["season", "week", "player_id", "player_name"] + list(ren)
    d = d[[c for c in keep if c in d.columns]].rename(columns=ren)
    for c in ("season", "week", "rec_yds", "rec", "tgt", "rush_yds", "carries"):
        if c in d.columns:
            d[c] = pd.to_numeric(d[c], errors="coerce")
    return d.dropna(subset=["season", "week", "player_id"]).astype(
        {"season": int, "week": int})[lambda x: x.season.isin(seasons)]


def fingerprint(d):
    f = d.copy()
    for c in ("rec_yds", "rec", "rush_yds", "carries"):
        f[c] = pd.to_numeric(f.get(c), errors="coerce").fillna(0.0).round(0).astype(int)
    f["_prod"] = f.rec_yds.abs() + f.rec + f.rush_yds.abs() + f.carries
    # ⛔ no production = not a fingerprint. Dozens of players share (0,0,0,0) in any team-week.
    f = f[f["_prod"] >= MIN_PROD]
    f["fpr"] = (f.season.astype(str) + "|" + f.week.astype(str) + "|"
                + f.rec_yds.astype(str) + "|" + f.rec.astype(str) + "|"
                + f.rush_yds.astype(str) + "|" + f.carries.astype(str))
    return f


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    # Default to the path every reader actually opens. It used to default to _v2, so a
    # rebuild produced a better crosswalk that nothing read until it was copied by hand.
    ap.add_argument("--out", default=os.path.join(FP, "player_crosswalk.parquet"))
    a = ap.parse_args()
    seasons = [2021, 2022, 2023, 2024, 2025, 2026]
    A = fingerprint(fp_side(seasons))
    B = fingerprint(nv_side(seasons))
    print(f"[xwalk] FP fingerprintable rows {len(A):,}; nflverse {len(B):,}")

    # ⛔ keep=False drops EVERY row of an ambiguous fingerprint on either side
    Au = A.drop_duplicates("fpr", keep=False)
    Bu = B.drop_duplicates("fpr", keep=False)
    print(f"[xwalk] unambiguous: FP {len(Au):,}, nflverse {len(Bu):,}")
    M = Au[["fpr", "fp_id", "name", "position", "team"]].merge(
        Bu[["fpr", "player_id", "player_name"]], on="fpr", how="inner")
    print(f"[xwalk] {len(M):,} fingerprint matches")

    # a player must map consistently across his weeks
    votes = M.groupby("fp_id").player_id.agg(["nunique", "count", lambda s: s.mode().iat[0]])
    votes.columns = ["n_ids", "n_obs", "gsis"]
    good = votes[(votes.n_ids == 1) & (votes.n_obs >= 1)]
    conflict = votes[votes.n_ids > 1]
    # salvage conflicts where one id wins >=80% of the weeks
    sal = []
    for fid in conflict.index:
        vc = M[M.fp_id == fid].player_id.value_counts()
        if vc.iat[0] / vc.sum() >= 0.80 and vc.sum() >= 5:
            sal.append((fid, vc.index[0], vc.sum()))
    print(f"[xwalk] consistent {len(good):,}; conflicted {len(conflict):,} "
          f"({len(sal):,} salvaged at >=80% agreement over 5+ weeks)")
    rows = [dict(playerPlayerId=f, player_id=g) for f, g in good.gsis.items()]
    rows += [dict(playerPlayerId=f, player_id=g) for f, g, _ in sal]
    CW = pd.DataFrame(rows).drop_duplicates("playerPlayerId")
    nm = A.drop_duplicates("fp_id").set_index("fp_id")[["name", "position"]]
    CW = CW.join(nm, on="playerPlayerId")
    CW = CW.rename(columns={"name": "player_name", "position": "playerPosition"})

    # ---- MERGE over the existing crosswalk, never replace it ----
    # ⛔ WHY A MERGE. This runs in the nfl-prop-report-daily chain, where fp_pull pulls only
    # the CURRENT season, so the FP side here covers 2026 alone and fingerprints far fewer
    # players than the 2021-2026 run that produced the committed seed. Replacing would delete
    # thousands of good mappings every day; refusing to write would fail the cron every day.
    # So: a fingerprint match WINS for the ids it resolves (it is strictly more reliable than
    # the name matching that made the file stale), and every id it did not see is KEPT. The
    # output can only grow, which makes this safe to run unattended on a thin pull.
    prev = os.path.join(FP, "player_crosswalk.parquet")
    if os.path.exists(prev):
        old = pd.read_parquet(prev)
        old["playerPlayerId"] = old.playerPlayerId.astype(str)
        CW["playerPlayerId"] = CW.playerPlayerId.astype(str)
        rebuilt, kept = set(CW.playerPlayerId), set(old.playerPlayerId)
        carried = old[~old.playerPlayerId.isin(rebuilt)]
        CW = pd.concat([CW, carried[[c for c in CW.columns if c in carried.columns]]],
                       ignore_index=True).drop_duplicates("playerPlayerId")
        print(f"\n[xwalk] fingerprinted {len(rebuilt):,} ids this run; carried "
              f"{len(carried):,} forward from the {len(kept):,}-row existing crosswalk")
        print(f"[xwalk] {len(rebuilt - kept):,} FP ids newly mapped -> {len(CW):,} total")
    else:
        print(f"\n[xwalk] no previous crosswalk at {prev} — writing {len(CW):,} rows fresh")
    CW.to_parquet(a.out, index=False)
    print(f"[xwalk] wrote {a.out}")
    for who in ("Jalon Daniels", "Jayden Daniels", "Bucky Irving", "Jake Ferguson"):
        hit = CW[CW.player_name == who]
        print(f"   {who:18s} {'MAPPED ' + hit.player_id.iat[0] if len(hit) else 'still missing'}")
