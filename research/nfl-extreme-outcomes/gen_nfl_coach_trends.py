"""Generate nfl_coach_trends — per HEAD COACH career betting trends for the Outliers tab.

Coaches use CAREER data (not season), windows last 5/10/15. Markets:
  - spread / moneyline / total  -> CAREER (nflverse games.csv, lines back to 1999)
  - team_total / h1_spread / h1_total -> 2023-2025 ONLY (our odds backfill; flagged in
    market_coverage so the site can note the limited history).

Dimensions: overall, home, away, favorite, underdog, division, non_division,
            primetime (kickoff >= 19:00 ET = TNF/SNF/MNF), regular.
Plus matchups: the coach's CAREER record vs each opponent TEAM.

Point-in-time: includes only games BEFORE the target slate (NFL_SEASON/NFL_WEEK;
defaults to the Wk12-2025 dry-run = everything through 2025 wk11).

Usage:  python3 gen_nfl_coach_trends.py [--no-load]
"""
import argparse
import io
import json
import os
import sys
from pathlib import Path

import numpy as np
import pandas as pd
import requests

ROOT = Path(__file__).resolve().parent
DATA = ROOT / "data"
BASE_URL = "https://jpxnjuwglavsjbgbasnl.supabase.co/rest/v1"
SEASON = int(os.environ.get("NFL_SEASON", 2025))
THROUGH_WEEK = int(os.environ.get("NFL_WEEK", 12)) - 1
GAMES_CSV = "https://github.com/nflverse/nfldata/raw/master/data/games.csv"

# market -> (game_log field, hit-letter, loss-letter, coverage)
MKT = {"spread": ("ats", "W", "L", "career"), "moneyline": ("su", "W", "L", "career"),
       "total": ("ou", "O", "U", "career"), "team_total": ("tt", "O", "U", "2023-2025"),
       "h1_spread": ("h1_ats", "W", "L", "2023-2025"), "h1_total": ("h1_ou", "O", "U", "2023-2025")}
MARKET_COVERAGE = {m: v[3] for m, v in MKT.items()}
DIMS = ["overall", "home", "away", "favorite", "underdog",
        "division", "non_division", "primetime", "regular"]
WINDOWS = [5, 10, 15]
# nflverse abbr drift -> our current convention (Rams/Commanders/Jaguars/Raiders/Chargers)
NORM = {"LAR": "LA", "WSH": "WAS", "JAC": "JAX", "OAK": "LV", "SD": "LAC", "STL": "LA"}


def load_key():
    for line in (ROOT.parent.parent / ".env.local").read_text().splitlines():
        if line.startswith("SUPABASE_SERVICE_KEY="):
            return line.split("=", 1)[1].strip()
    sys.exit("SUPABASE_SERVICE_KEY not found in .env.local")


def wl(m):
    return "W" if m > 0 else ("L" if m < 0 else "P")


def ou(m):
    return "O" if m > 0 else ("U" if m < 0 else "P")


def is_primetime(gametime):
    """Night game (kickoff >= 19:00 ET) = primetime (TNF/SNF/MNF)."""
    if not isinstance(gametime, str) or ":" not in gametime:
        return False
    try:
        return int(gametime.split(":")[0]) >= 19
    except ValueError:
        return False


def h1tt_lookup():
    """{(season,week,home_ab,away_ab): row} from h1tt_frame for 2023-25 1H/TT enrichment."""
    f = pd.read_parquet(DATA / "h1tt_frame.parquet")
    return {(int(r.season), int(r.week), r.home_ab, r.away_ab): r for _, r in f.iterrows()}


def build_logs():
    g = pd.read_csv(io.StringIO(requests.get(GAMES_CSV, timeout=90).text))
    g = g[g.home_score.notna() & g.away_score.notna()].copy()           # completed games
    g = g[(g.season < SEASON) | ((g.season == SEASON) & (g.week <= THROUGH_WEEK))]
    g["home_ab"] = g.home_team.replace(NORM)
    g["away_ab"] = g.away_team.replace(NORM)
    h1tt = h1tt_lookup()

    logs = {}
    for r in g.sort_values(["season", "week"]).itertuples():
        prime = is_primetime(getattr(r, "gametime", None))
        is_div = bool(r.div_game == 1) if pd.notna(r.div_game) else False
        spread_line = r.spread_line                                       # +ve = home favored
        total_line = r.total_line
        for is_home in (True, False):
            coach = r.home_coach if is_home else r.away_coach
            if not isinstance(coach, str) or not coach.strip():
                continue
            team = r.home_ab if is_home else r.away_ab
            opp = r.away_ab if is_home else r.home_ab
            tp = int(r.home_score if is_home else r.away_score)
            op = int(r.away_score if is_home else r.home_score)
            margin = tp - op
            # team spread (signed, negative = favored). nflverse spread_line +ve = home favored.
            team_spread = (-spread_line if is_home else spread_line) if pd.notna(spread_line) else None
            ats = wl(margin + team_spread) if team_spread is not None else None
            ou_res = ou((tp + op) - total_line) if pd.notna(total_line) else None
            # 1H / team-total enrichment (2023-25 only)
            tt = h1_ats = h1_ou = None
            hr = h1tt.get((int(r.season), int(r.week), r.home_ab, r.away_ab))
            if hr is not None:
                tt_line = hr.tt_home_close_tt_home_point if is_home else hr.tt_away_close_tt_away_point
                if pd.notna(tt_line):
                    tt = ou(tp - tt_line)
                th = hr.h1_home if is_home else hr.h1_away
                oh = hr.h1_away if is_home else hr.h1_home
                h1_sp = (hr.h1_spread_close_h1_spread_home if is_home
                         else -hr.h1_spread_close_h1_spread_home)
                if pd.notna(th) and pd.notna(oh) and pd.notna(h1_sp):
                    h1_ats = wl((th - oh) + h1_sp)
                h1_tot = hr.h1_total_close_h1_total_point
                if pd.notna(th) and pd.notna(oh) and pd.notna(h1_tot):
                    h1_ou = ou((th + oh) - h1_tot)
            logs.setdefault(coach, []).append(dict(
                season=int(r.season), week=int(r.week), date=str(r.gameday),
                team=team, opp=opp, is_home=is_home, is_div=is_div, is_primetime=prime,
                team_spread=round(float(team_spread), 1) if team_spread is not None else None,
                su=wl(margin), ats=ats, ou=ou_res, tt=tt, h1_ats=h1_ats, h1_ou=h1_ou))
    # newest-first per coach
    for c in logs:
        logs[c].reverse()
    return logs


def pct(h, n):
    return round(h / n, 3) if n else None


def _dim_ok(g, dim):
    return {"overall": True, "home": g["is_home"], "away": not g["is_home"],
            "favorite": g["team_spread"] is not None and g["team_spread"] < 0,
            "underdog": g["team_spread"] is not None and g["team_spread"] > 0,
            "division": g["is_div"], "non_division": not g["is_div"],
            "primetime": g["is_primetime"], "regular": not g["is_primetime"]}[dim]


def compute_splits(gl):
    out = {}
    for mkt, (fld, hit, loss, _) in MKT.items():
        out[mkt] = {}
        for dim in DIMS:
            games = [g for g in gl if _dim_ok(g, dim) and g.get(fld) is not None]
            out[mkt][dim] = {}
            for w in WINDOWS:
                win = games[:w]
                h = sum(1 for g in win if g[fld] == hit)
                l = sum(1 for g in win if g[fld] == loss)
                p = sum(1 for g in win if g[fld] == "P")
                out[mkt][dim][str(w)] = {"h": h, "l": l, "p": p, "n": h + l, "pct": pct(h, h + l)}
    return out


def compute_matchups(gl):
    """Coach's CAREER record vs each opponent team, per market."""
    by_opp = {}
    for g in gl:
        by_opp.setdefault(g["opp"], []).append(g)
    out = {}
    for opp, games in by_opp.items():
        rec = {"meetings": len(games)}
        for mkt, (fld, hit, loss, _) in MKT.items():
            dec = [g for g in games if g.get(fld) in (hit, loss)]
            h = sum(1 for g in dec if g[fld] == hit)
            rec[mkt] = {"h": h, "n": len(dec), "pct": pct(h, len(dec))}
        out[opp] = rec
    return out


def build():
    logs = build_logs()
    rows = []
    for coach, gl in logs.items():
        seasons = [g["season"] for g in gl]
        rows.append(dict(
            coach=coach, current_team=gl[0]["team"], career_games=len(gl),
            first_season=min(seasons), last_season=max(seasons),
            through_season=SEASON, through_week=THROUGH_WEEK,
            splits=compute_splits(gl), matchups=compute_matchups(gl),
            market_coverage=MARKET_COVERAGE,
            recent_game_log=gl[:15],
        ))
    return pd.DataFrame(rows)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--no-load", action="store_true")
    args = ap.parse_args()

    df = build()
    print(f"{len(df)} head coaches | career games: {df.career_games.min()}-{df.career_games.max()} "
          f"(median {int(df.career_games.median())})")
    top = df.sort_values("career_games", ascending=False).head(6)
    print(top[["coach", "current_team", "career_games", "first_season", "last_season"]].to_string(index=False))
    if args.no_load:
        s = df.sort_values("career_games", ascending=False).iloc[0]
        print(f"\nsample {s.coach} ({s.career_games} g) spread splits:",
              json.dumps(s.splits["spread"], indent=0)[:500])
        print(f"coverage: {s.market_coverage}")
        return

    recs = json.loads(df.to_json(orient="records"))
    key = load_key()
    hdr = {"apikey": key, "Authorization": f"Bearer {key}",
           "Content-Type": "application/json", "Prefer": "return=minimal"}
    requests.delete(f"{BASE_URL}/nfl_coach_trends?through_season=eq.{SEASON}&through_week=eq.{THROUGH_WEEK}",
                    headers=hdr, timeout=60)
    for i in range(0, len(recs), 200):
        resp = requests.post(f"{BASE_URL}/nfl_coach_trends", headers=hdr, json=recs[i:i + 200], timeout=120)
        if resp.status_code != 201:
            sys.exit(f"insert: {resp.status_code} {resp.text[:300]}")
    print(f"loaded {len(recs)} rows -> nfl_coach_trends")


if __name__ == "__main__":
    main()
