"""Generate nfl_referee_trends — per HEAD REFEREE career betting trends (Outliers tab).

Game-perspective, HOME-framed (a ref isn't tied to a team): under this referee, how
often does the HOME team cover / win, and how often does the game go OVER.
  - spread  = HOME covers     (career, nflverse 1999+)
  - moneyline = HOME wins      (career)
  - total   = game OVER        (career)
  - h1_spread = HOME covers 1H (2023-2025 only)
  - h1_total  = 1H OVER        (2023-2025 only)
NO team totals, NO matchups (per spec). away% is just the inverse of home%.

Dimensions: overall, division, non_division, primetime (kickoff >= 19:00 ET), regular.
Windows: last 5/10/15. Point-in-time via NFL_SEASON/NFL_WEEK (dry-run = through 2025 wk11).

Usage:  python3 gen_nfl_referee_trends.py [--no-load]
"""
import argparse
import io
import json
import os
import sys
from pathlib import Path

import pandas as pd
import requests

ROOT = Path(__file__).resolve().parent
DATA = ROOT / "data"
BASE_URL = "https://jpxnjuwglavsjbgbasnl.supabase.co/rest/v1"
SEASON = int(os.environ.get("NFL_SEASON", 2025))
THROUGH_WEEK = int(os.environ.get("NFL_WEEK", 12)) - 1
GAMES_CSV = "https://github.com/nflverse/nfldata/raw/master/data/games.csv"

# market -> (game_log field, hit-letter, loss-letter, coverage). HOME-framed.
MKT = {"spread": ("spread", "W", "L", "career"), "moneyline": ("su", "W", "L", "career"),
       "total": ("ou", "O", "U", "career"), "h1_spread": ("h1_ats", "W", "L", "2023-2025"),
       "h1_total": ("h1_ou", "O", "U", "2023-2025")}
MARKET_COVERAGE = {m: v[3] for m, v in MKT.items()}
DIMS = ["overall", "division", "non_division", "primetime", "regular"]
WINDOWS = [5, 10, 15]
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


def is_primetime(t):
    if not isinstance(t, str) or ":" not in t:
        return False
    try:
        return int(t.split(":")[0]) >= 19
    except ValueError:
        return False


def h1tt_lookup():
    f = pd.read_parquet(DATA / "h1tt_frame.parquet")
    return {(int(r.season), int(r.week), r.home_ab, r.away_ab): r for _, r in f.iterrows()}


def pct(h, n):
    return round(h / n, 3) if n else None


def build_logs():
    g = pd.read_csv(io.StringIO(requests.get(GAMES_CSV, timeout=90).text))
    g = g[g.home_score.notna() & g.away_score.notna()].copy()
    g = g[(g.season < SEASON) | ((g.season == SEASON) & (g.week <= THROUGH_WEEK))]
    g["home_ab"] = g.home_team.replace(NORM)
    g["away_ab"] = g.away_team.replace(NORM)
    h1tt = h1tt_lookup()
    logs = {}
    for r in g.sort_values(["season", "week"]).itertuples():
        ref = getattr(r, "referee", None)
        if not isinstance(ref, str) or not ref.strip():
            continue
        hm = int(r.home_score) - int(r.away_score)
        home_spread = -r.spread_line if pd.notna(r.spread_line) else None
        spread = wl(hm + home_spread) if home_spread is not None else None
        ou_res = ou((int(r.home_score) + int(r.away_score)) - r.total_line) if pd.notna(r.total_line) else None
        h1_ats = h1_ou = None
        hr = h1tt.get((int(r.season), int(r.week), r.home_ab, r.away_ab))
        if hr is not None and pd.notna(hr.h1_home) and pd.notna(hr.h1_away):
            if pd.notna(hr.h1_spread_close_h1_spread_home):
                h1_ats = wl((hr.h1_home - hr.h1_away) + hr.h1_spread_close_h1_spread_home)
            if pd.notna(hr.h1_total_close_h1_total_point):
                h1_ou = ou((hr.h1_home + hr.h1_away) - hr.h1_total_close_h1_total_point)
        logs.setdefault(ref, []).append(dict(
            season=int(r.season), week=int(r.week), date=str(r.gameday),
            home=r.home_ab, away=r.away_ab,
            is_div=bool(r.div_game == 1) if pd.notna(r.div_game) else False,
            is_primetime=is_primetime(getattr(r, "gametime", None)),
            spread=spread, su=wl(hm), ou=ou_res, h1_ats=h1_ats, h1_ou=h1_ou))
    for ref in logs:
        logs[ref].reverse()
    return logs


def _dim_ok(g, dim):
    return {"overall": True, "division": g["is_div"], "non_division": not g["is_div"],
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


def build():
    logs = build_logs()
    rows = []
    for ref, gl in logs.items():
        seasons = [g["season"] for g in gl]
        rows.append(dict(
            referee=ref, career_games=len(gl),
            first_season=min(seasons), last_season=max(seasons),
            through_season=SEASON, through_week=THROUGH_WEEK,
            splits=compute_splits(gl), market_coverage=MARKET_COVERAGE,
            recent_game_log=gl[:15]))
    return pd.DataFrame(rows)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--no-load", action="store_true")
    args = ap.parse_args()
    df = build()
    print(f"{len(df)} referees | career games {df.career_games.min()}-{df.career_games.max()} "
          f"(median {int(df.career_games.median())})")
    top = df.sort_values("career_games", ascending=False).head(6)
    print(top[["referee", "career_games", "first_season", "last_season"]].to_string(index=False))
    if args.no_load:
        s = df.sort_values("career_games", ascending=False).iloc[0]
        print(f"\nsample {s.referee} spread (HOME cover) splits:", json.dumps(s.splits["spread"], indent=0)[:400])
        return
    recs = json.loads(df.to_json(orient="records"))
    key = load_key()
    hdr = {"apikey": key, "Authorization": f"Bearer {key}",
           "Content-Type": "application/json", "Prefer": "return=minimal"}
    requests.delete(f"{BASE_URL}/nfl_referee_trends?through_season=eq.{SEASON}&through_week=eq.{THROUGH_WEEK}",
                    headers=hdr, timeout=60)
    for i in range(0, len(recs), 200):
        resp = requests.post(f"{BASE_URL}/nfl_referee_trends", headers=hdr, json=recs[i:i + 200], timeout=120)
        if resp.status_code != 201:
            sys.exit(f"insert: {resp.status_code} {resp.text[:300]}")
    print(f"loaded {len(recs)} rows -> nfl_referee_trends")


if __name__ == "__main__":
    main()
