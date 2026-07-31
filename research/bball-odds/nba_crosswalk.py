#!/usr/bin/env python3
"""ESPN <-> balldontlie game-ID crosswalk for the NBA.

Everything granular in this project (PBP, stints, RAPM, shots, rosters) is keyed by ESPN
game_id, and everything market-facing (odds, model features, results) is keyed by
balldontlie game.id. Without a VERIFIED map between them, the RAPM work cannot touch a
betting test at all.

The join is date + the unordered pair of team abbreviations, and the abbreviations differ
between the two feeds in a handful of predictable places (GS/GSW, NY/NYK, SA/SAS, NO/NOP,
WSH/WAS, PHX/PHO, UTAH/UTA). Both sides are normalised to a single canonical set first.

WHY NOT JOIN ON TEAM ID: neither feed's team ids mean anything to the other, and building
an id map would need this same abbreviation join anyway. Abbreviations are the primitive.

WHY THE PAIR IS UNORDERED: home/away is occasionally disagreed on for neutral-site games
(NBA Cup finals, Paris/Mexico City games). Matching on the unordered pair and then checking
home agreement separately turns a silent mismatch into a reported number.

A crosswalk with a plausible-looking 96% coverage and 4% WRONG rows is far worse than one
that refuses to guess, so anything ambiguous (same two teams, same date, twice) is dropped
rather than resolved by heuristic.

Writes data/parquet/nba_game_crosswalk.parquet -- (espn_game_id, bdl_game_id, date).
"""
import glob
import os
import sys
import warnings

import pandas as pd

warnings.filterwarnings("ignore")

ROOT = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(ROOT, "data", "parquet")
RAW = os.path.join(ROOT, "data", "raw", "nba_pbp")

# Canonical form is whatever balldontlie uses; ESPN's variants map onto it.
ABBR = {"GS": "GSW", "NY": "NYK", "SA": "SAS", "NO": "NOP", "WSH": "WAS",
        "PHX": "PHO", "UTAH": "UTA", "NOP": "NOP", "BKN": "BKN", "BRK": "BKN",
        "CHA": "CHA", "CHO": "CHA"}

MIN_COVERAGE = 0.97


def norm(s):
    return s.astype(str).str.upper().str.strip().map(lambda x: ABBR.get(x, x))


def espn_games():
    frames = []
    for f in sorted(glob.glob(f"{RAW}/pbp_*.parquet")):
        d = pd.read_parquet(f, columns=["game_id", "game_date", "home_team_abbrev",
                                        "away_team_abbrev"]).drop_duplicates("game_id")
        frames.append(d)
    E = pd.concat(frames, ignore_index=True).drop_duplicates("game_id")
    E["date"] = pd.to_datetime(E["game_date"]).dt.date
    E["h"] = norm(E["home_team_abbrev"])
    E["a"] = norm(E["away_team_abbrev"])
    return E


def main():
    E = espn_games()
    B = pd.read_parquet(f"{OUT}/bdl_games.parquet")[
        ["id", "date", "home_team.abbreviation", "visitor_team.abbreviation", "status"]]
    B = B[B["status"].astype(str).str.contains("Final", case=False, na=False)].copy()
    B["date"] = pd.to_datetime(B["date"]).dt.date
    B["h"] = norm(B["home_team.abbreviation"])
    B["a"] = norm(B["visitor_team.abbreviation"])

    # unordered pair key: neutral-site games sometimes flip home/away between feeds
    for D in (E, B):
        D["pair"] = D[["h", "a"]].min(axis=1) + "_" + D[["h", "a"]].max(axis=1)
        D["key"] = D["date"].astype(str) + "_" + D["pair"]

    # drop keys that are not unique on EITHER side rather than guessing between them
    dup_e = set(E.loc[E["key"].duplicated(keep=False), "key"])
    dup_b = set(B.loc[B["key"].duplicated(keep=False), "key"])
    bad = dup_e | dup_b
    if bad:
        print(f"  {len(bad)} ambiguous date+pair keys dropped (duplicate on one side)")

    X = E[~E["key"].isin(bad)].merge(B[~B["key"].isin(bad)], on="key",
                                     how="inner", suffixes=("_e", "_b"))
    same_home = (X["h_e"] == X["h_b"]).mean()

    cov_b = len(X) / len(B)
    cov_e = len(X) / len(E)
    print(f"espn games : {len(E):,}")
    print(f"bdl  games : {len(B):,} (Final only)")
    print(f"matched    : {len(X):,}   bdl coverage {100*cov_b:.2f}%   "
          f"espn coverage {100*cov_e:.2f}%")
    print(f"home/away agreement on matched rows: {100*same_home:.2f}%")

    # independent validation: the two feeds should agree on the FINAL SCORE. Team+date
    # agreement alone could still line up the wrong pair of records; scores cannot.
    PB = pd.concat([pd.read_parquet(f, columns=["game_id", "team_id", "home_away",
                                                "team_score"]).drop_duplicates(
                        ["game_id", "team_id"])
                    for f in sorted(glob.glob(f"{RAW}/player_box_*.parquet"))],
                   ignore_index=True).drop_duplicates(["game_id", "team_id"])
    sc = PB.pivot_table(index="game_id", columns="home_away", values="team_score",
                        aggfunc="first")
    if {"home", "away"}.issubset(sc.columns):
        sc = sc.reset_index()[["game_id", "home", "away"]]
        BS = pd.read_parquet(f"{OUT}/bdl_games.parquet")[
            ["id", "home_team_score", "visitor_team_score"]]
        V = X[["game_id", "id", "h_e", "h_b"]].merge(sc, on="game_id", how="inner") \
                                              .merge(BS, on="id", how="inner")
        # if the feeds disagree on which side is home, compare the swapped pair
        flip = V["h_e"] != V["h_b"]
        eh = V["home"].where(~flip, V["away"])
        ea = V["away"].where(~flip, V["home"])
        agree = ((eh == V["home_team_score"]) & (ea == V["visitor_team_score"])).mean()
        print(f"final-score agreement (independent check): {100*agree:.2f}%  "
              f"(n={len(V):,})")
        if agree < 0.99:
            print("\nSCORE CHECK FAILED -- the crosswalk is lining up wrong games. "
                  "Refusing to write it.")
            sys.exit(1)

    if cov_b < MIN_COVERAGE:
        print(f"\nCOVERAGE GATE FAILED (need >={100*MIN_COVERAGE:.0f}% of bdl games). "
              f"Refusing to write a crosswalk that silently loses a season.")
        sys.exit(1)

    C = X[["game_id", "id", "date_b"]].rename(columns={
        "game_id": "espn_game_id", "id": "bdl_game_id", "date_b": "date"})
    path = f"{OUT}/nba_game_crosswalk.parquet"
    C.to_parquet(path, index=False)
    print(f"\nwrote {path}: {len(C):,} rows")


if __name__ == "__main__":
    main()
