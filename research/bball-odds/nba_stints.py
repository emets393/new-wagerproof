#!/usr/bin/env python3
"""Reconstruct 5-man lineup stints from NBA play-by-play, with a hard QC gate.

Everything downstream -- RAPM, on/off, lineup-level ratings -- is built on the claim that
we know who was on the floor at every moment. ESPN's feed is not the NBA's official one and
is known to occasionally drop or mis-order substitutions, so that claim has to be EARNED,
not assumed. This file earns it or fails loudly.

WHY THIS EXISTS AT ALL. The box-score player model (nba_player_ceiling.py) scored ~+4%
correlation against the market with negative R2 -- i.e. nothing. The diagnosis was not
"the NBA market is unbeatable"; it was that we had built the NCAAB model on possession-level
data (plays_ncaab, lineups_ncaab, player_rapm_ncaab) and the NBA model on box scores alone.
Per-36 rates and shrunken raw plus-minus are the known-inferior proxies for exactly the
thing RAPM was invented to measure. This is the missing layer.

THE ALGORITHM for period-starting lineups. A substitution tells you who ENTERED, so anyone
who appears in the period before entering must have STARTED it:

    walk the period's events in order, tracking `entered`
    on a sub  -> the EXITING player, if he never entered this period, was a starter
    otherwise -> the acting player, if he never entered this period, was a starter

Only `athlete_id_1` is trusted on non-substitution events. Secondary athlete fields are
sometimes the opponent (the blocker on a blocked shot, the stealer on a turnover), and one
wrong team attribution silently corrupts a whole stint. Being slow to find all five is
recoverable; assigning a player to the wrong bench is not.

The known blind spot: a player who starts a period, records nothing, and is never subbed
out is invisible to this rule. That is what the fallbacks and the QC gate below are for.

QC GATE. `game_rosters` carries an explicit `starter` flag, which is an INDEPENDENT source
for period 1. Agreement between the inferred period-1 five and that flag is the honest
accuracy measure -- self-consistency would prove nothing. If reconstruction is poor, RAPM
built on it would be confidently wrong, which is worse than not having it, so this script
refuses to write its output below GATE_MIN.

Writes data/parquet/nba_stints.parquet (one row per contiguous 10-man interval).
"""
import glob
import os
import sys
import warnings
from collections import defaultdict

import numpy as np
import pandas as pd

warnings.filterwarnings("ignore")

ROOT = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(ROOT, "data", "parquet")
RAW = os.path.join(ROOT, "data", "raw", "nba_pbp")

# Fraction of (game, period, team) blocks that must resolve to exactly five players.
# Below this, stint attribution is too noisy for RAPM and the script aborts rather than
# writing a table that looks usable.
GATE_MIN = 0.97

# hoopR labels seasons by END year; nba_model_features labels by START year. Getting this
# backwards would misalign every downstream join by a full season without erroring.
SEASON_MAP = {2021: 2020, 2022: 2021, 2023: 2022, 2024: 2023, 2025: 2024, 2026: 2025}

EVENT_COLS = ["game_id", "season", "period_number", "type_text", "team_id",
              "athlete_id_1", "athlete_id_2", "home_team_id", "away_team_id",
              "home_score", "away_score", "start_game_seconds_remaining",
              "scoring_play", "score_value", "sequence_number", "game_play_number"]


def load_pbp():
    frames = []
    for f in sorted(glob.glob(f"{RAW}/pbp_*.parquet")):
        d = pd.read_parquet(f, columns=EVENT_COLS)
        frames.append(d)
    d = pd.concat(frames, ignore_index=True)
    d["season_start"] = d["season"].map(SEASON_MAP)
    assert d["season_start"].notna().all(), "UNMAPPED SEASON -- check SEASON_MAP"
    return d.sort_values(["game_id", "period_number", "game_play_number"]).reset_index(
        drop=True)


def infer_period_starters(ev):
    """{(game, period, team): [starters]} via the appears-before-entering rule."""
    starters = defaultdict(list)
    entered = defaultdict(set)

    gid = ev["game_id"].to_numpy()
    per = ev["period_number"].to_numpy()
    typ = ev["type_text"].to_numpy()
    tid = ev["team_id"].to_numpy()
    a1 = ev["athlete_id_1"].to_numpy()
    a2 = ev["athlete_id_2"].to_numpy()

    for i in range(len(ev)):
        t = tid[i]
        if not np.isfinite(t):
            continue
        key = (gid[i], per[i], t)
        if typ[i] == "Substitution":
            out_p, in_p = a2[i], a1[i]
            if np.isfinite(out_p) and out_p not in entered[key] \
                    and out_p not in starters[key]:
                starters[key].append(out_p)
            if np.isfinite(in_p):
                entered[key].add(in_p)
        else:
            p = a1[i]
            # only athlete_id_1 is trusted: secondary fields can belong to the opponent
            if np.isfinite(p) and p not in entered[key] and p not in starters[key]:
                starters[key].append(p)
    return starters


def build_stints(ev, starters):
    """Walk each game, maintaining both on-court fives, emitting one row per interval."""
    rows = []
    gid = ev["game_id"].to_numpy()
    per = ev["period_number"].to_numpy()
    typ = ev["type_text"].to_numpy()
    tid = ev["team_id"].to_numpy()
    a1 = ev["athlete_id_1"].to_numpy()
    a2 = ev["athlete_id_2"].to_numpy()
    hid = ev["home_team_id"].to_numpy()
    aid = ev["away_team_id"].to_numpy()
    hs = ev["home_score"].to_numpy(dtype=float)
    as_ = ev["away_score"].to_numpy(dtype=float)
    clk = ev["start_game_seconds_remaining"].to_numpy(dtype=float)
    seas = ev["season_start"].to_numpy()

    n = len(ev)
    i = 0
    bad_blocks = tot_blocks = 0
    while i < n:
        g = gid[i]
        j = i
        while j < n and gid[j] == g:
            j += 1
        # --- one game, rows i:j -------------------------------------------------------
        h_team, a_team = hid[i], aid[i]
        cur = {h_team: set(), a_team: set()}
        k = i
        while k < j:
            p = per[k]
            m = k
            while m < j and per[m] == p:
                m += 1
            # period start: reset to the inferred five for each team
            for t in (h_team, a_team):
                st = starters.get((g, p, t), [])
                tot_blocks += 1
                if len(st) != 5:
                    bad_blocks += 1
                    # carry forward whoever we already had, then top up from the inferred
                    # list. A short block degrades that stint rather than the whole game.
                    keep = list(cur[t])[:max(0, 5 - len(st))]
                    st = list(dict.fromkeys(list(st) + keep))[:5]
                cur[t] = set(st[:5])

            seg_start = clk[k]
            seg_h, seg_a = hs[k], as_[k]
            for q in range(k, m):
                if typ[q] == "Substitution" and np.isfinite(tid[q]):
                    t = tid[q]
                    if t not in cur:
                        continue
                    if len(cur[h_team]) == 5 and len(cur[a_team]) == 5 \
                            and clk[q] < seg_start:
                        rows.append((
                            g, seas[q], p, seg_start, clk[q],
                            hs[q] - seg_h, as_[q] - seg_a,
                            tuple(sorted(cur[h_team])), tuple(sorted(cur[a_team]))))
                    seg_start, seg_h, seg_a = clk[q], hs[q], as_[q]
                    if np.isfinite(a2[q]):
                        cur[t].discard(a2[q])
                    if np.isfinite(a1[q]):
                        cur[t].add(a1[q])
            # close the period
            last = m - 1
            if len(cur[h_team]) == 5 and len(cur[a_team]) == 5 and clk[last] < seg_start:
                rows.append((
                    g, seas[last], p, seg_start, clk[last],
                    hs[last] - seg_h, as_[last] - seg_a,
                    tuple(sorted(cur[h_team])), tuple(sorted(cur[a_team]))))
            k = m
        i = j

    S = pd.DataFrame(rows, columns=[
        "game_id", "season", "period", "sec_start", "sec_end",
        "h_pts", "a_pts", "h_lineup", "a_lineup"])
    S["seconds"] = S["sec_start"] - S["sec_end"]
    return S, bad_blocks, tot_blocks


def qc_against_rosters(starters):
    """Independent check: inferred period-1 five vs the game_rosters `starter` flag."""
    frames = []
    for f in sorted(glob.glob(f"{RAW}/rosters_*.parquet")):
        frames.append(pd.read_parquet(f))
    R = pd.concat(frames, ignore_index=True)
    R = R[R["starter"].fillna(False).astype(bool)]
    truth = R.groupby(["game_id", "team_id"])["athlete_id"].apply(
        lambda s: set(pd.to_numeric(s, errors="coerce").dropna()))

    hits = tot = exact = 0
    for (g, t), five in truth.items():
        inf = starters.get((float(g), 1, float(t))) or starters.get((g, 1, t))
        if not inf:
            continue
        inf = set(inf[:5])
        tot += 1
        hits += len(inf & five)
        exact += int(inf == five)
    return hits / max(5 * tot, 1), exact / max(tot, 1), tot


def main():
    print("loading play-by-play ...", flush=True)
    ev = load_pbp()
    print(f"  {len(ev):,} events, {ev['game_id'].nunique():,} games", flush=True)

    print("inferring period-starting lineups ...", flush=True)
    starters = infer_period_starters(ev)

    print("QC vs game_rosters starter flag (independent source) ...", flush=True)
    player_acc, exact_acc, n_chk = qc_against_rosters(starters)
    print(f"  period-1 player-level accuracy : {100*player_acc:.2f}%")
    print(f"  period-1 exact-five accuracy   : {100*exact_acc:.2f}%  (n={n_chk:,})")

    print("building stints ...", flush=True)
    S, bad, tot = build_stints(ev, starters)
    ok = 1 - bad / max(tot, 1)
    print(f"  blocks resolving to exactly 5  : {100*ok:.2f}%  ({tot-bad:,}/{tot:,})")
    print(f"  stints                         : {len(S):,}")

    # regulation is 2,880 seconds; coverage below ~95% means we are dropping real minutes
    gt = S.groupby("game_id")["seconds"].sum()
    print(f"  median seconds covered per game: {gt.median():,.0f} (regulation 2,880)")

    if ok < GATE_MIN or player_acc < GATE_MIN:
        print(f"\nQC GATE FAILED (need >={100*GATE_MIN:.0f}% on both). Refusing to write "
              f"nba_stints.parquet -- RAPM on bad stints is confidently wrong, which is "
              f"worse than no RAPM.", flush=True)
        sys.exit(1)

    S["h_lineup"] = S["h_lineup"].astype(str)
    S["a_lineup"] = S["a_lineup"].astype(str)
    path = f"{OUT}/nba_stints.parquet"
    S.to_parquet(path, index=False)
    print(f"\nQC GATE PASSED. wrote {path}", flush=True)


if __name__ == "__main__":
    main()
