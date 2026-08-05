"""Auto-resolve the current NFL (season, week) for the weekly runner — prints "SEASON WEEK".

Owner rule: the target week is the FIRST regular-season week with any ungraded game.
Preseason -> week 1 every run until week 1 completes, then week 2, and so on. No static
week edits, ever. Mirrors resolve_cfb_week.py's role in run_cfb_week.sh.

Source = data/nflverse_games.parquet (cached by fetch.py; nflverse publishes the full
season schedule with null results preseason, so this works before any 2026 kickoff).
"""
import os
import sys
import pandas as pd

HERE = os.path.dirname(os.path.abspath(__file__))


def resolve():
    g = pd.read_parquet(os.path.join(HERE, "data", "nflverse_games.parquet"))
    g = g[g.game_type == "REG"]
    season = int(g.season.max())
    s = g[g.season == season]
    open_weeks = s.loc[s.result.isna(), "week"]
    # season fully graded -> stay on its last week until next season's schedule lands
    week = int(open_weeks.min()) if len(open_weeks) else int(s.week.max())
    return season, week


if __name__ == "__main__":
    try:
        season, week = resolve()
    except Exception as e:
        print(f"[resolve_nfl_week] {e} -> defaulting 2026 1", file=sys.stderr)
        season, week = 2026, 1
    print(season, week)
