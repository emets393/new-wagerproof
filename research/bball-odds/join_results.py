#!/usr/bin/env python3
"""Join odds events (openclose tables) to final/halftime scores.

Writes data/parquet/games_{sport}.parquet: one row per odds event_id with
home/away FG + 1H scores attached — the grading spine for all signal research.

Matching:
  NBA   — team display names normalize to identical keys (plus a short alias
          map for ESPN's "LA Clippers" style); join on UTC date of tip.
  NCAAB — Odds API names ("Gonzaga Bulldogs") -> ncaab_team_mapping.odds_api_format
          ("gonzaga-bulldogs") -> CBBD name ("Gonzaga"); join on ET date to
          absorb late-evening UTC rollover. Neutral-site home/away flips are
          retried swapped (scores re-swapped to the odds event's orientation).
"""
import os
import re
import sys

import pandas as pd

ROOT = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(ROOT, "data", "parquet")

NBA_ALIASES = {"laclippers": "losangelesclippers"}

# odds-name (normalized) -> CBBD name (normalized). Covers teams missing from
# ncaab_team_mapping (new D1 programs, school renames) and one bad row in the
# Supabase table (Southern Indiana wrongly slugged as southern-jaguars).
NCAAB_OVERRIDES = {
    "southernjaguars": "southern",
    "southernindianascreamingeagles": "southernindiana",
    "texasamcommercelions": "easttexasam",
    "houstonbaptisthuskies": "houstonchristian",
    "georgewashingtoncolonials": "georgewashington",
    "stfrancisbknterriers": "stfrancisbrooklyn",
    "hartfordhawks": "hartford",
}


def norm(s):
    return re.sub(r"[^a-z0-9]", "", str(s).lower())


def nearest_match(ev, r, id_col):
    """Match each odds event to the nearest same-matchup result within 36h.

    Absorbs UTC/ET date rollover and tip-time drift; also retries with
    home/away flipped (neutral sites), re-swapping scores to the odds event's
    orientation.
    """
    score_cols = ["home_score", "away_score", "home_h1", "away_h1", id_col]
    flipped = r.rename(columns={
        "home_key": "away_key", "away_key": "home_key",
        "home_score": "away_score", "away_score": "home_score",
        "home_h1": "away_h1", "away_h1": "home_h1"})
    cand = pd.concat([r, flipped], ignore_index=True)
    m = ev.merge(cand, on=["home_key", "away_key"], how="left", suffixes=("", "_r"))
    m["dt"] = (m["ts_r"] - m["ts"]).abs()
    m.loc[m["dt"] > pd.Timedelta(hours=36), score_cols] = None
    return m.sort_values("dt").drop_duplicates("event_id", keep="first")


def events_from_openclose(sport):
    frames = []
    import glob
    for p in sorted(glob.glob(f"{OUT}/openclose_{sport}_*.parquet")):
        season = os.path.basename(p).replace(f"openclose_{sport}_", "").replace(".parquet", "")
        df = pd.read_parquet(p, columns=["event_id", "commence_time", "home_team", "away_team"])
        df = df.drop_duplicates("event_id")
        df["season"] = season
        frames.append(df)
    ev = pd.concat(frames, ignore_index=True)
    ev["commence_time"] = pd.to_datetime(ev["commence_time"])
    return ev


def join_nba():
    ev = events_from_openclose("nba")
    res = pd.read_parquet(f"{OUT}/results_nba.parquet")

    for side in ("home", "away"):
        ev[f"{side}_key"] = ev[f"{side}_team"].map(norm).replace(NBA_ALIASES)
        res[f"{side}_key"] = res[f"{side}_team"].map(norm).replace(NBA_ALIASES)
    res["ts"] = pd.to_datetime(res["date_et"])  # actually full UTC date of tip
    ev["ts"] = ev["commence_time"].dt.tz_localize(None)

    r = res[["ts", "home_key", "away_key", "home_score", "away_score",
             "home_h1", "away_h1", "espn_id"]]
    m = nearest_match(ev, r, id_col="espn_id")
    finish(m, "nba", id_col="espn_id")


def join_ncaab():
    ev = events_from_openclose("ncaab")
    res = pd.read_parquet(f"{OUT}/results_ncaab.parquet")
    mapping = pd.read_parquet(f"{OUT}/ncaab_team_mapping.parquet")

    # keep='first' — the table has duplicate slugs (Southern Indiana bug); first row wins
    dedup = mapping.drop_duplicates("odds_api_format", keep="first")
    slug_to_cbbd = {norm(s): norm(n) for s, n in
                    zip(dedup["odds_api_format"], dedup["api_team_name"])}
    lookup = {**slug_to_cbbd, **NCAAB_OVERRIDES}
    for side in ("home", "away"):
        ev[f"{side}_key"] = ev[f"{side}_team"].map(norm).map(lookup)
        res[f"{side}_key"] = res[f"{side}_team"].map(norm)

    res["ts"] = pd.to_datetime(res["start_utc"]).dt.tz_localize(None)
    ev["ts"] = pd.to_datetime(ev["commence_time"]).dt.tz_localize(None)
    cols = ["ts", "home_key", "away_key", "home_score", "away_score",
            "home_h1", "away_h1", "cbbd_id"]
    r = res[cols].dropna(subset=["home_key", "away_key"])
    m = nearest_match(ev, r, id_col="cbbd_id")
    finish(m, "ncaab", id_col="cbbd_id")


def finish(m, sport, id_col):
    m = m.drop_duplicates("event_id")
    keep = ["event_id", "season", "commence_time", "home_team", "away_team",
            "home_score", "away_score", "home_h1", "away_h1", id_col]
    m[keep].to_parquet(f"{OUT}/games_{sport}.parquet", index=False)
    total = len(m)
    matched = m[id_col].notna().sum()
    h1 = m["home_h1"].notna().sum()
    print(f"games_{sport}: {total:,} odds events | matched {matched:,} ({matched/total*100:.1f}%) | "
          f"with 1H scores {h1:,} ({h1/total*100:.1f}%)", flush=True)
    per = m.assign(ok=m[id_col].notna()).groupby("season")["ok"].mean().round(3)
    print(per.to_string(), flush=True)


if __name__ == "__main__":
    what = sys.argv[1] if len(sys.argv) > 1 else "all"
    if what in ("nba", "all"):
        join_nba()
    if what in ("ncaab", "all"):
        join_ncaab()
