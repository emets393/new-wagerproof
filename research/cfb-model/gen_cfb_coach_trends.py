"""Generate cfb_coach_trends — per HEAD COACH career betting trends for the Outliers tab (mirror of
nfl_coach_trends so one Swift code path renders both sports).

Coaches use CAREER data, windows last 5/10/15. Markets & coverage:
  - spread / moneyline / total            -> our model frame, 2016-2025 (no 2020)
  - team_total / h1_spread / h1_total      -> 2023-2025 ONLY (event-odds archive; flagged in
    market_coverage so the site can note the limited history).

Dimensions (9): overall, home, away, favorite, underdog, division, non_division, primetime, regular.
  - CFB "division" = CONFERENCE game (CFBD conferenceGame flag). Keys stay literally
    division/non_division so the app shares the NFL code path (it labels them Conference/Non-conference).
  - primetime = kickoff hour >= 19:00 ET (same rule as NFL).
Plus matchups: the coach's CAREER record vs each opponent TEAM, per market (keyed by team_name).

Head coach per (team, season) comes from CFBD /coaches (the most-decisions coach that season), joined to
each team-game. Point-in-time: only games BEFORE the target slate (CFB_SEASON/CFB_WEEK; default Wk7-2025).

Usage:  python3 gen_cfb_coach_trends.py [season week] [--no-load]
"""
import sys
import json
import warnings

import pandas as pd

import dry_common as C
import trends_common as T

warnings.filterwarnings("ignore")
SEASON, _wk = C.season_week()
THRU = _wk - 1                         # coaches run "through" the week before the slate
NO_LOAD = "--no-load" in sys.argv

DIMS = ["overall", "home", "away", "favorite", "underdog",
        "division", "non_division", "primetime", "regular"]
WINDOWS = [5, 10, 15]
# FG markets cover the full model frame; derivatives only as deep as the event-odds archive.
MARKET_COVERAGE = {"spread": "2016-2025", "moneyline": "2016-2025", "total": "2016-2025",
                   "team_total": "2023-2025", "h1_spread": "2023-2025", "h1_total": "2023-2025"}


def build():
    team_logs = T.build_cross_season_logs(SEASON, THRU)
    coach_of = T.head_coach_map()

    # attribute every team-game to that (team, season)'s head coach -> per-coach career logs
    coach_logs, attributed, total = {}, 0, 0
    for games in team_logs.values():
        for g in games:
            total += 1
            coach = coach_of.get((g["team"], g["season"]))
            if not coach:
                continue
            attributed += 1
            coach_logs.setdefault(coach, []).append(g)
    # newest-first per coach (games come from many teams/seasons -> re-sort)
    for c in coach_logs:
        coach_logs[c].sort(key=lambda g: (g["season"], g["week"]), reverse=True)
    cov = round(100 * attributed / total, 1) if total else 0
    print(f"coach attribution: {attributed}/{total} team-games ({cov}%) mapped to a head coach")

    rows = []
    for coach, gl in coach_logs.items():
        seasons = [g["season"] for g in gl]
        rows.append(dict(
            coach=coach, current_team=gl[0]["team"], career_games=len(gl),
            first_season=min(seasons), last_season=max(seasons),
            through_season=SEASON, through_week=THRU,
            splits=T.compute_splits(gl, DIMS, WINDOWS, sk="team_spread"),
            matchups=T.compute_matchups(gl, markets=T.MKT, cap=None),
            market_coverage=MARKET_COVERAGE,
            recent_game_log=gl[:15]))
    return pd.DataFrame(rows)


df = build()
print(f"cfb_coach_trends: {len(df)} head coaches | career games {df.career_games.min()}-{df.career_games.max()} "
      f"(median {int(df.career_games.median())})")
print(df.sort_values("career_games", ascending=False)
      .head(6)[["coach", "current_team", "career_games", "first_season", "last_season"]].to_string(index=False))

if NO_LOAD:
    s = df.sort_values("career_games", ascending=False).iloc[0]
    print(f"\n  [no-load] {s.coach} ({s.career_games} g) spread splits:",
          json.dumps(s.splits["spread"], indent=0)[:500])
    print(f"  [no-load] coverage: {s.market_coverage}")
    sys.exit(0)

# Preflight: skip cleanly if the table isn't created yet (apply cfb_outliers_trends.sql).
import requests
if requests.get(f"{C.URL}/rest/v1/cfb_coach_trends?select=coach&limit=1", headers=C.H).status_code != 200:
    print("  ! cfb_coach_trends table missing — apply cfb_outliers_trends.sql first (load skipped)")
    sys.exit(0)
C.wipe("cfb_coach_trends", f"through_season=eq.{SEASON}&through_week=eq.{THRU}")
C.insert("cfb_coach_trends", df)
