"""Current NFL head coach per team, from nflverse's schedule feed.

nflverse pre-fills home_coach/away_coach on FUTURE games, so offseason hires
are correct before a snap is played (2026: Coen JAX, Harbaugh NYG, Minter BAL).

nfl_coach_trends.current_team is the franchise a career-history row belongs
to — every coach a team EVER had — NOT current employment. Keying team->coach
on it put Urban Meyer on the Jaguars (2026-08-31 incident). Consumers must map
team->coach through here and join trend rows by coach NAME.

Used by gen_nfl_regression_report.py and gen_nfl_outliers_trend_cards.py.
"""
import pandas as pd

GAMES_CSV = "https://github.com/nflverse/nfldata/raw/master/data/games.csv"


def current_coaches(season: int) -> dict[str, str]:
    """Team abbr -> current head coach name for the given season."""
    df = pd.read_csv(GAMES_CSV,
                     usecols=["season", "home_team", "home_coach", "away_team", "away_coach"])
    df = df[df.season == season]
    m: dict[str, str] = {}
    for _, r in df.iterrows():
        if isinstance(r["home_coach"], str):
            m[r["home_team"]] = r["home_coach"]
        if isinstance(r["away_coach"], str):
            m[r["away_team"]] = r["away_coach"]
    return m
