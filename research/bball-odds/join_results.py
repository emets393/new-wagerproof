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


def et_night(ts):
    """Calendar night in Eastern time for a naive-UTC tip timestamp."""
    return (pd.to_datetime(ts).dt.tz_localize("UTC")
            .dt.tz_convert("America/New_York").dt.strftime("%Y-%m-%d"))


def nearest_match(ev, r, id_col, window_h=36):
    """Match each odds event to the nearest same-matchup result within `window_h`.

    Also retries with home/away flipped (neutral sites), re-swapping scores to the
    odds event's orientation.

    The window is wide because the Odds API posts placeholder tip times for games that
    are not scheduled yet -- playoff series legs are routinely listed exactly 24h early
    -- and those are still the only same-matchup result in sight. What made the old
    version WRONG was not the width but the clock: the result side carried a bare DATE,
    and a UTC one at that, so every evening tip was filed a day late and its midnight
    stamp landed nearer the following night's event. Two teams meeting on consecutive
    nights then got crossed, and CLE/NYK 2023-10-31, CHA/BOS 2024-11-01 and MIA/CHI
    2026-02-01 all graded off the wrong leg. Both sides now carry a real tip timestamp,
    so the correct leg is ~0h away and always wins.
    """
    score_cols = ["home_score", "away_score", "home_h1", "away_h1", id_col]
    flipped = r.rename(columns={
        "home_key": "away_key", "away_key": "home_key",
        "home_score": "away_score", "away_score": "home_score",
        "home_h1": "away_h1", "away_h1": "home_h1"})
    cand = pd.concat([r, flipped], ignore_index=True)
    m = ev.merge(cand, on=["home_key", "away_key"], how="left", suffixes=("", "_r"))
    m["dt"] = (m["ts_r"] - m["ts"]).abs()
    m.loc[m["dt"] > pd.Timedelta(hours=window_h), score_cols] = None
    m = m.sort_values("dt").drop_duplicates("event_id", keep="first")

    ok = m[m[id_col].notna()]
    # A result serving two events is the Odds API's phantom duplicate listings: the same
    # game posted twice, 10-70 min apart. Expected; drop_phantom_events removes them.
    n_phantom = int(ok[id_col].duplicated().sum())
    if n_phantom:
        print(f"  {n_phantom} phantom duplicate odds listings share a result "
              f"(expected; dropped downstream by drop_phantom_events)", flush=True)
    # Anything matched across ET nights is the Odds API listing a game a day before it is
    # actually scheduled -- playoff series legs, and the odd regular-season reschedule.
    off = ok[et_night(ok["ts"]) != et_night(ok["ts_r"])]
    if len(off):
        print(f"  {len(off)} event(s) matched a result on an adjacent ET night "
              f"(placeholder tip times; nearest available same-matchup game)", flush=True)
    # A result shared by events on two different nights is the placeholder listing and
    # the real one, both pointing at the same game -- a phantom that spans midnight, so
    # drop_phantom_events (which keys on home team + ET date) cannot see it. Harmless in
    # the model frame, where the bdl join drops the listing that has no game on its date,
    # but it double-counts in any signal work that grades straight off games_*.parquet.
    nights = ok.assign(n=et_night(ok["ts"])).groupby(id_col)["n"].nunique()
    if (nights > 1).any():
        print(f"  {int((nights > 1).sum())} result(s) shared by events on two nights "
              f"(cross-midnight phantom listings)", flush=True)
    return m


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
    res["ts"] = pd.to_datetime(res["start_utc"])  # real UTC tip time, not a date
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
