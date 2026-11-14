#!/usr/bin/env python3
"""THE opener definition for NFL. One place, so nothing can disagree with anything else.

OWNER RULE (2026-10-06, verbatim intent): "the earliest numbers you should be using are the Monday
morning lines for thursday through sunday games and Tuesday lines for the following monday night
game."

So the opener is anchored to the DAY OF WEEK relative to the game, not a days-out number:
  * a game Thu / Fri / Sat / Sun -> the first snapshot on or after MONDAY 00:00 ET of that game week
  * a MONDAY game                -> the first snapshot on or after TUESDAY 00:00 ET, i.e. the Tuesday
                                    six days earlier, because Monday's own line cannot post until the
                                    previous Monday night game is done
  * a Tue / Wed game (11 in 2023-26) -> treated like Thu-Sun, anchored to the preceding Monday

WHY THIS REPLACES WHAT WAS THERE. build_odds.py originally took each book's earliest snapshot EVER.
Books post season-long lookahead lines in July, so the "opener" driving reg_edge, the published
pick price and the GRADING basis was a July futures number for most games. An 11-day cap was a
first patch; it still had no relationship to when a week's board actually posts. This does.

Everything downstream must import from here rather than re-deriving a window.
"""
from __future__ import annotations

import pandas as pd

ET = "America/New_York"


def week_anchor(kickoff_utc: pd.Series) -> pd.Series:
    """The earliest instant a game's line is allowed to count as its opener (UTC)."""
    k = pd.to_datetime(kickoff_utc, utc=True).dt.tz_convert(ET)
    dow = k.dt.dayofweek                      # Mon=0 .. Sun=6
    # Monday games anchor to the Tuesday 6 days earlier; everything else to its own week's Monday.
    back = pd.Series(dow.values, index=k.index).where(dow != 0, 6)
    anchor_date = (k - pd.to_timedelta(back, unit="D")).dt.normalize()
    return anchor_date.dt.tz_convert("UTC")


def opener_snaps(snaps: pd.DataFrame, kickoff_col="commence_time", snap_col="snap_ts") -> pd.DataFrame:
    """Keep only snapshots inside [week_anchor, kickoff). Adds anchor + hours_after_anchor.

    Also adds `game_date` (ET calendar date of kickoff). The feed's commence_time DRIFTS between
    snapshots for the same game, so grouping on it splits one game into several rows — it gave 590
    "games" for a 272-game 2023 season. Group on (season, home, away, game_date) instead.
    """
    d = snaps.copy()
    d[snap_col] = pd.to_datetime(d[snap_col], utc=True)
    d[kickoff_col] = pd.to_datetime(d[kickoff_col], utc=True)
    d["game_date"] = d[kickoff_col].dt.tz_convert(ET).dt.normalize().dt.tz_localize(None)
    d["week_anchor"] = week_anchor(d[kickoff_col])
    keep = (d[snap_col] >= d["week_anchor"]) & (d[snap_col] < d[kickoff_col])
    d = d[keep].copy()
    d["hours_after_anchor"] = (d[snap_col] - d["week_anchor"]).dt.total_seconds() / 3600.0
    return d


if __name__ == "__main__":
    import numpy as np, pathlib, requests
    ROOT = pathlib.Path("/Users/chrishabib/Documents/new-wagerproof")
    env = {}
    for line in (ROOT / ".env.local").read_text().splitlines():
        if "=" in line and not line.strip().startswith("#"):
            a, b = line.split("=", 1); env[a.strip()] = b.strip()
    pat = env["SUPABASE_PAT"]

    def q(sql):
        r = requests.post("https://api.supabase.com/v1/projects/jpxnjuwglavsjbgbasnl/database/query",
                          headers={"Authorization": f"Bearer {pat}", "Content-Type": "application/json"},
                          json={"query": sql}, timeout=300)
        if not r.ok:
            raise SystemExit(r.text[:400])
        return pd.DataFrame(r.json())

    print("pulling pregame total snapshots 2023-2026 ...")
    s = q("""select season, home_team, away_team, commence_time, snap_ts, book, total_point
             from nfl_historical_odds
             where snap_ts < commence_time and total_point is not null""")
    print(f"  {len(s):,} snapshots")
    s["snap_ts"] = pd.to_datetime(s.snap_ts, utc=True)
    s["commence_time"] = pd.to_datetime(s.commence_time, utc=True)
    o = opener_snaps(s)
    print(f"  {len(o):,} inside the Monday/Tuesday anchor window\n")
    g = ["season", "home_team", "away_team", "commence_time"]
    allg = s.groupby(g).size().rename("snaps").reset_index()
    ing = o.groupby(g).size().rename("in_window").reset_index()
    cov = allg.merge(ing, on=g, how="left").fillna({"in_window": 0})
    print("=== coverage: games with at least one snapshot in the opener window ===")
    print(f"{'season':<8}{'games':>7}{'with opener':>13}{'pct':>8}")
    for sea, x in cov.groupby("season"):
        n = len(x); have = int((x.in_window > 0).sum())
        print(f"{int(sea):<8}{n:>7}{have:>13}{100*have/n:>7.1f}%")
    # how soon after the anchor does the first number land, and how far before kickoff is it?
    first = o.sort_values("snap_ts").groupby(g).first().reset_index()
    first["days_before_kick"] = (first.commence_time - first.snap_ts).dt.total_seconds() / 86400.0
    print("\n=== when the opener actually lands ===")
    print(f"{'season':<8}{'hrs after anchor (med)':>24}{'days before kickoff (med)':>27}")
    for sea, x in first.groupby("season"):
        print(f"{int(sea):<8}{x.hours_after_anchor.median():>24.1f}{x.days_before_kick.median():>27.2f}")
    print("\n=== sanity: Monday-night games must anchor to a TUESDAY ===")
    first["kick_dow"] = first.commence_time.dt.tz_convert(ET).dt.day_name()
    first["anchor_dow"] = first.week_anchor.dt.tz_convert(ET).dt.day_name()
    print(pd.crosstab(first.kick_dow, first.anchor_dow).to_string())


def build_opener_table(snaps: pd.DataFrame, value_cols=("total_point", "spread_home")) -> pd.DataFrame:
    """Consensus opener per game: each book's FIRST in-window snapshot, then the median across books.

    Per-book-first-then-median (not the single earliest snapshot) because one book posting early
    should not define the market. Values snap to the half-point grid: an even book count straddling
    44/44.5 medians to 44.25, a number no book posts.
    """
    o = opener_snaps(snaps)
    g = ["season", "home_team", "away_team", "game_date"]
    per_book = o.sort_values("snap_ts").groupby(g + ["book"], as_index=False).first()
    half = lambda v: (v * 2).round() / 2
    out = per_book.groupby(g).agg(
        n_books=("book", "nunique"),
        open_ts=("snap_ts", "min"),
        commence_time=("commence_time", "min"),
        week_anchor=("week_anchor", "first"),
        **{f"open_{c}": (c, "median") for c in value_cols if c in per_book.columns},
    ).reset_index()
    for c in value_cols:
        if f"open_{c}" in out.columns:
            out[f"open_{c}"] = half(out[f"open_{c}"])
    out["open_days_before_kick"] = (out.commence_time - out.open_ts).dt.total_seconds() / 86400.0
    return out
