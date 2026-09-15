"""Auto-resolve the current NFL (season, week) for the weekly runner — prints "SEASON WEEK".

Owner rule: the target week is the FIRST regular-season week with any game still to kick off
(no result AND kickoff in the future — see open_games).
Preseason -> week 1 every run until week 1 completes, then week 2, and so on. No static
week edits, ever. Mirrors resolve_cfb_week.py's role in run_cfb_week.sh.

Source = data/nflverse_games.parquet (cached by fetch.py; nflverse publishes the full
season schedule with null results preseason, so this works before any 2026 kickoff).
"""
import os
import sys
import pandas as pd

HERE = os.path.dirname(os.path.abspath(__file__))


def open_games(s, now=None):
    """Games still bettable pregame: no result AND kickoff in the future.

    Result-only was wrong on Monday nights: nflverse posts the MNF result hours after
    the game, so the runner kept targeting the finished week, the model frame already
    had every score, consensus_totals predicted 0 rows and crashed on `bet_quality`
    (2026-09-15 02:55 UTC). A kicked-off game is not a slate row either way, so the
    week rolls forward the moment its last game kicks off. Missing gametime falls back
    to the result-only rule for that row."""
    now = now or pd.Timestamp.now(tz="UTC")
    ko = pd.to_datetime(s.gameday.astype(str) + " " + s.gametime.fillna("").astype(str), errors="coerce")
    ko = ko.dt.tz_localize("America/New_York", ambiguous="NaT", nonexistent="NaT").dt.tz_convert("UTC")
    future = ko.isna() | (ko > now)
    return s[s.result.isna() & future]


SCHED_URL = "https://github.com/nflverse/nfldata/raw/master/data/games.csv"


def load_games():
    """Cached schedule if fetch.py has run, else a live pull. The runner resolves the
    week BEFORE fetch.py, and Render cron filesystems are fresh clones, so the cache
    never existed at resolve time there — the except-branch default (2026 1) silently
    ran every Render refresh against week 1 (caught 2026-09-15 03:10 UTC)."""
    path = os.path.join(HERE, "data", "nflverse_games.parquet")
    if os.path.exists(path):
        return pd.read_parquet(path)
    import io
    import requests
    r = requests.get(SCHED_URL, timeout=120)
    r.raise_for_status()
    g = pd.read_csv(io.StringIO(r.text))
    if "home_score" not in g.columns:
        raise RuntimeError("nflverse games.csv did not parse (no home_score column)")
    return g


def resolve():
    g = load_games()
    g = g[g.game_type == "REG"]
    season = int(g.season.max())
    s = g[g.season == season]
    open_weeks = open_games(s)["week"]
    # season fully played -> stay on its last week until next season's schedule lands
    week = int(open_weeks.min()) if len(open_weeks) else int(s.week.max())
    return season, week


if __name__ == "__main__":
    try:
        season, week = resolve()
    except Exception as e:
        # A silent default is how every Render run targeted week 1 for a night; fail loud
        # instead — run_nfl_week.sh is set -e and the next scheduled run retries.
        sys.exit(f"[resolve_nfl_week] cannot resolve the week: {e}")
    print(season, week)
