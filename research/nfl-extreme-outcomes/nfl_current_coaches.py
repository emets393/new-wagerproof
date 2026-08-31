"""Current NFL head coach per team.

PRIMARY: ESPN's per-season coaches API — the one source found that tracks
offseason hires promptly (2026-08-31: it alone had Mike LaFleur on ARI;
nflverse's schedule feed still said Jonathan Gannon).
FALLBACK: nflverse games.csv (home_coach/away_coach pre-filled on future
games) — right for most teams, but lags recent changes.

nfl_coach_trends.current_team is the franchise a career-history row belongs
to — every coach a team EVER had — NOT current employment. Keying team->coach
on it put Urban Meyer on the Jaguars. Consumers must map team->coach through
here and join trend rows by coach NAME.

Used by gen_nfl_regression_report.py and gen_nfl_outliers_trend_cards.py.
"""
import requests

GAMES_CSV = "https://github.com/nflverse/nfldata/raw/master/data/games.csv"
ESPN_TEAMS = "https://site.api.espn.com/apis/site/v2/sports/football/nfl/teams"
ESPN_COACHES = ("https://sports.core.api.espn.com/v2/sports/football/leagues/nfl/"
                "seasons/{season}/teams/{tid}/coaches?limit=5")
# ESPN abbr -> nflverse-style abbr used across our slate tables
NORM = {"LAR": "LA", "WSH": "WAS", "JAC": "JAX"}


def _espn_coaches(season: int) -> dict[str, str]:
    s = requests.Session()
    teams = s.get(ESPN_TEAMS, timeout=30).json()
    pairs = []
    for t in teams["sports"][0]["leagues"][0]["teams"]:
        tm = t["team"]
        pairs.append((tm["id"], NORM.get(tm["abbreviation"], tm["abbreviation"])))
    m: dict[str, str] = {}
    for tid, ab in pairs:
        items = s.get(ESPN_COACHES.format(season=season, tid=tid), timeout=30).json().get("items", [])
        if not items:
            continue
        c = s.get(items[0]["$ref"], timeout=30).json()
        name = f"{c.get('firstName', '')} {c.get('lastName', '')}".strip()
        if name:
            m[ab] = name
    if len(m) < 28:   # partial ESPN response -> caller falls back rather than half-map
        raise RuntimeError(f"ESPN returned only {len(m)} teams")
    return m


def _nflverse_coaches(season: int) -> dict[str, str]:
    import pandas as pd
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


def current_coaches(season: int) -> dict[str, str]:
    """Team abbr -> current head coach name for the given season."""
    try:
        return _espn_coaches(season)
    except Exception as e:
        print(f"[coaches] ESPN unavailable ({e}) — falling back to nflverse schedule feed")
        return _nflverse_coaches(season)
