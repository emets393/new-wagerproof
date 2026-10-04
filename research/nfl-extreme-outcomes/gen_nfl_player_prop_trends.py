"""Generate nfl_player_prop_trends — per-player prop OVER trends for the Outliers tab.

How often a player goes OVER their posted prop line, by market, in situations.
Markets (hit = OVER; ATD hit = scored): player_pass_yds, player_pass_tds,
player_receptions, player_reception_yds, player_rush_yds, player_anytime_td,
plus the 3 volume markets player_pass_attempts, player_rush_attempts,
player_pass_completions (T-60 close from props_rows_extra + actuals from player_offense).
NO defensive/ST props ever. Props data only exists 2024-2025 (coverage flagged).

Dimensions: overall, home, away, division, non_division, primetime, regular.
Matchups: per-opponent prop record cross-season (2024–25). Windows: last 3/5/7.

Usage:  python3 gen_nfl_player_prop_trends.py [--no-load]
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
GAMES_CSV = "https://github.com/nflverse/nfldata/raw/master/data/games.csv"


def _resolve_window():
    """(season, through_week) — env wins, otherwise RESOLVED from the logged games.

    The defaults used to be `NFL_SEASON=2025` / `NFL_WEEK=12`, which is the same
    hardcoded-window pattern that let this table rot: run without env (as the daily grade
    chain does, since it is season-scoped and exports no week) and it silently rebuilt a
    2025 wk11 view and stamped it as current. Resolving means a bare run is always right.

    through_week = the newest week with player game logs, i.e. the last week whose results
    exist. Nothing to add beyond that, and claiming more in through_week is what made the
    stale table look fresh.
    """
    season = os.environ.get("NFL_SEASON")
    if os.environ.get("NFL_WEEK") and season:
        return int(season), int(os.environ["NFL_WEEK"]) - 1
    import datetime as _dt
    _now = _dt.datetime.now(_dt.timezone.utc)
    season = int(season) if season else (_now.year if _now.month >= 3 else _now.year - 1)
    key = ""
    for line in (ROOT.parent.parent / ".env.local").read_text().splitlines():
        if line.startswith("SUPABASE_SERVICE_KEY="):
            key = line.split("=", 1)[1].strip(); break
    try:
        rows = requests.get(
            f"{BASE_URL}/nfl_player_game_logs", timeout=60,
            headers={"apikey": key, "Authorization": f"Bearer {key}"},
            params={"season": f"eq.{season}", "select": "week",
                    "order": "week.desc", "limit": "1"}).json()
        wk = int(rows[0]["week"]) if isinstance(rows, list) and rows else 1
    except Exception as e:
        sys.exit(f"[window] cannot resolve the current week ({e}) — set NFL_SEASON/NFL_WEEK")
    print(f"[window] resolved season={season} through_week={wk} (newest logged game week)")
    return season, wk


SEASON, THROUGH_WEEK = _resolve_window()

PROP_MKT = {"player_pass_yds": ("O", "U"), "player_pass_tds": ("O", "U"),
            "player_receptions": ("O", "U"), "player_reception_yds": ("O", "U"),
            "player_rush_yds": ("O", "U"), "player_anytime_td": ("Y", "N"),
            # volume markets (over/under vs the T-60 close) — trends only, descriptive
            "player_pass_attempts": ("O", "U"), "player_rush_attempts": ("O", "U"),
            "player_pass_completions": ("O", "U")}
# volume-market actual stat in player_offense
EXTRA_STAT = {"player_pass_attempts": "attempts", "player_rush_attempts": "carries",
              "player_pass_completions": "completions"}
T60_MINS = 60.0
DIMS = ["overall", "home", "away", "division", "non_division", "primetime", "regular"]
WINDOWS = [3, 5, 7]
NORM = {"LAR": "LA", "WSH": "WAS", "JAC": "JAX", "OAK": "LV", "SD": "LAC", "STL": "LA"}
TEAM_NAMES = {
    "Arizona Cardinals": "ARI", "Atlanta Falcons": "ATL", "Baltimore Ravens": "BAL",
    "Buffalo Bills": "BUF", "Carolina Panthers": "CAR", "Chicago Bears": "CHI",
    "Cincinnati Bengals": "CIN", "Cleveland Browns": "CLE", "Dallas Cowboys": "DAL",
    "Denver Broncos": "DEN", "Detroit Lions": "DET", "Green Bay Packers": "GB",
    "Houston Texans": "HOU", "Indianapolis Colts": "IND", "Jacksonville Jaguars": "JAX",
    "Kansas City Chiefs": "KC", "Los Angeles Rams": "LA", "Los Angeles Chargers": "LAC",
    "Las Vegas Raiders": "LV", "Miami Dolphins": "MIA", "Minnesota Vikings": "MIN",
    "New England Patriots": "NE", "New Orleans Saints": "NO", "New York Giants": "NYG",
    "New York Jets": "NYJ", "Philadelphia Eagles": "PHI", "Pittsburgh Steelers": "PIT",
    "Seattle Seahawks": "SEA", "San Francisco 49ers": "SF", "Tampa Bay Buccaneers": "TB",
    "Tennessee Titans": "TEN", "Washington Commanders": "WAS"}


def load_key():
    for line in (ROOT.parent.parent / ".env.local").read_text().splitlines():
        if line.startswith("SUPABASE_SERVICE_KEY="):
            return line.split("=", 1)[1].strip()
    sys.exit("SUPABASE_SERVICE_KEY not found in .env.local")


def pct(h, n):
    return round(h / n, 3) if n else None


def _primetime(t):
    if not isinstance(t, str) or ":" not in t:
        return False
    try:
        return int(t.split(":")[0]) >= 19
    except ValueError:
        return False


def game_context():
    """{(season,week,home_ab,away_ab): (div_game, is_primetime)} from nflverse, 2024-25."""
    g = pd.read_csv(io.StringIO(requests.get(GAMES_CSV, timeout=90).text))
    # Derived, not a hardcoded [2024, 2025]: that list silently gave every 2026 game
    # (False, False), so the division and primetime dims quietly described nothing.
    g = g[(g.season >= 2024) & (g.season <= SEASON)].copy()
    g["home_ab"] = g.home_team.replace(NORM)
    g["away_ab"] = g.away_team.replace(NORM)
    return {(int(r.season), int(r.week), r.home_ab, r.away_ab):
            (bool(r.div_game == 1) if pd.notna(r.div_game) else False,
             _primetime(getattr(r, "gametime", None)))
            for r in g.itertuples()}


def attempts_games():
    """Per (player, volume-market, game): T-60 consensus close line + realized actual, so the
    attempts/completions markets get the same OVER-trend treatment as the original 6. Same
    raw columns build_logs consumes (home_team/away_team full names -> mapped there)."""
    ex = pd.read_parquet(DATA / "props_rows_extra.parquet")
    ex = ex[ex.market.isin(EXTRA_STAT)].copy()
    if ex.empty:
        return ex
    ex["snap"] = pd.to_datetime(ex.snapshot_time, utc=True)
    ex["comm"] = pd.to_datetime(ex.commence_time, utc=True)
    ex["mins"] = (ex.comm - ex.snap).dt.total_seconds() / 60.0
    keys = ["season", "week", "player_id", "player_name", "position", "team", "market",
            "home_team", "away_team"]
    snaps = ex.groupby(keys + ["snap", "mins"]).line.median().reset_index().sort_values(keys + ["snap"])
    act = snaps[snaps.mins >= T60_MINS]                       # actionable close only
    cl = act.groupby(keys).line.last().reset_index().rename(columns={"line": "close_line"})
    po = pd.read_parquet(DATA / "player_offense.parquet")[
        ["season", "week", "player_id", "attempts", "carries", "completions"]]
    cl = cl.merge(po, on=["season", "week", "player_id"], how="left")
    cl["actual"] = np.select(
        [cl.market == "player_pass_attempts", cl.market == "player_rush_attempts"],
        [cl.attempts, cl.carries], default=cl.completions)
    cl["result_close"] = None                                # non-ATD result is computed from actual
    return cl[keys + ["close_line", "actual", "result_close"]]


# Game-log column behind each market's actual (nfl_player_game_logs).
GAMELOG_STAT = {"player_pass_yds": "pass_yds", "player_pass_tds": "pass_tds",
                "player_receptions": "receptions", "player_reception_yds": "rec_yds",
                "player_rush_yds": "rush_yds", "player_pass_attempts": "pass_attempts",
                "player_rush_attempts": "carries", "player_pass_completions": "completions"}
ABBR_NAME = {v: k for k, v in TEAM_NAMES.items()}


def current_season_rows(key):
    """Rows for THIS season in `props_frame` shape — line + actual per (player, market, game).

    WHY (owner, 2026-10-04). props_frame.parquet and props_rows_extra.parquet are
    backfills that stop at 2025, so this generator shipped `recent_game_log` with
    ZERO 2026 games while `through_season/through_week` advertised (2026, 3). Four
    weeks into the season the app's "last 10 games" strip was ten bars of LAST
    season, and every hit rate and career-vs-opponent record described 2025.

    Actuals come from `nfl_player_game_logs` (current, and the same table the iOS
    enrichment merges). Lines come from our own `nfl_slate_props` boards — the
    `close_line` we published that week, which is the number users saw. A game with
    no posted line yields no row, so it contributes no basis rather than a guess.

    Rejected: `nfl_player_prop_lines_history` is the raw capture (784k rows for three
    weeks of 2026 and growing weekly), which needs server-side aggregation to be
    worth paging. Our own board rows already record the T-60 consensus.
    """
    hdr = {"apikey": key, "Authorization": f"Bearer {key}"}

    def get(table, params):
        r = requests.get(f"{BASE_URL}/{table}", headers=hdr, timeout=120, params=params)
        j = r.json()
        return j if isinstance(j, list) else []

    logs = get("nfl_player_game_logs",
               {"season": f"eq.{SEASON}", "week": f"lte.{THROUGH_WEEK}", "limit": "20000",
                "select": ("player_id,player_name,position,team,opponent,home_away,season,week,"
                           + ",".join(sorted(set(GAMELOG_STAT.values()))) + ",anytime_td")})
    closes = {}
    for wk in range(1, THROUGH_WEEK + 1):
        for r in get("nfl_slate_props",
                     {"season": f"eq.{SEASON}", "week": f"eq.{wk}", "limit": "5000",
                      "select": "player_id,market,close_line"}):
            if r.get("close_line") is not None:
                closes[(str(r["player_id"]), r["market"], wk)] = float(r["close_line"])
    if not logs:
        print(f"  [current-season] no {SEASON} game logs through wk{THROUGH_WEEK} — "
              f"trends will be prior seasons only")
        return pd.DataFrame()

    rows = []
    for g in logs:
        tm = NORM.get(g["team"], g["team"])
        op = NORM.get(g["opponent"], g["opponent"])
        if tm not in ABBR_NAME or op not in ABBR_NAME:
            continue                                  # unmapped abbr -> skip, never guess a game
        is_home = str(g.get("home_away", "")).lower().startswith("h")
        home_ab, away_ab = (tm, op) if is_home else (op, tm)
        wk = int(g["week"])
        for market, col in GAMELOG_STAT.items():
            line = closes.get((str(g["player_id"]), market, wk))
            if line is None or g.get(col) is None:
                continue                              # no posted line = no basis for a trend
            rows.append(dict(
                season=int(g["season"]), week=wk, player_id=g["player_id"],
                player_name=g["player_name"], position=g["position"], team=tm,
                home_team=ABBR_NAME[home_ab], away_team=ABBR_NAME[away_ab],
                market=market, close_line=line, actual=float(g[col]), result_close=None))
        if g.get("anytime_td") is not None:
            rows.append(dict(
                season=int(g["season"]), week=wk, player_id=g["player_id"],
                player_name=g["player_name"], position=g["position"], team=tm,
                home_team=ABBR_NAME[home_ab], away_team=ABBR_NAME[away_ab],
                market="player_anytime_td", close_line=np.nan,
                actual=float(g["anytime_td"]),
                result_close=("yes" if float(g["anytime_td"]) >= 1 else "no")))
    d = pd.DataFrame(rows)
    if not d.empty:
        print(f"  [current-season] {len(d)} {SEASON} rows through wk{THROUGH_WEEK} "
              f"({d.week.nunique()} weeks, {d.player_id.nunique()} players, "
              f"{d.market.nunique()} markets)")
    return d


def build_logs():
    pf = pd.read_parquet(DATA / "props_frame.parquet")
    pf = pf[pf.market.isin(PROP_MKT)].copy()
    ag = attempts_games()
    if not ag.empty:
        pf = pd.concat([pf, ag], ignore_index=True)          # volume markets alongside the 6
    cur = current_season_rows(load_key())                    # backfills end at 2025
    if not cur.empty:
        pf = pd.concat([pf, cur], ignore_index=True)
    pf = pf[(pf.season < SEASON) | ((pf.season == SEASON) & (pf.week <= THROUGH_WEEK))]
    pf["home_ab"] = pf.home_team.map(TEAM_NAMES)
    pf["away_ab"] = pf.away_team.map(TEAM_NAMES)
    ctx = game_context()

    # consensus per (player, market, game): median close line + realized actual/result
    grp = pf.groupby(["season", "week", "player_id", "player_name", "position", "team",
                      "home_ab", "away_ab", "market"]).agg(
        close_line=("close_line", "median"), actual=("actual", "first"),
        result_close=("result_close", "first")).reset_index()

    logs = {}   # player_id -> {game_key: game record}
    meta = {}
    for r in grp.itertuples():
        # books add markets without warning (player_rush_attempts 2026-09-05) —
        # a market this trends card doesn't model is skipped, never a KeyError.
        if r.market not in PROP_MKT:
            continue
        hit_l, loss_l = PROP_MKT[r.market]
        if r.market == "player_anytime_td":
            res = "Y" if r.result_close == "yes" else ("N" if r.result_close == "no" else None)
        else:
            if pd.isna(r.actual) or pd.isna(r.close_line):
                res = None
            else:
                res = "O" if r.actual > r.close_line else ("U" if r.actual < r.close_line else "P")
        if res is None:
            continue
        is_home = (r.team == r.home_ab)
        is_div, is_pt = ctx.get((int(r.season), int(r.week), r.home_ab, r.away_ab), (False, False))
        gk = (int(r.season), int(r.week))
        pl = logs.setdefault(r.player_id, {})
        rec = pl.setdefault(gk, dict(
            season=int(r.season), week=int(r.week),
            opp=(r.away_ab if is_home else r.home_ab), is_home=is_home, is_div=is_div,
            is_primetime=is_pt, markets={}, actuals={}, lines={}))
        rec["markets"][r.market] = res
        # Preserve the values behind the grade so the client can render an
        # amount-based bar chart instead of reducing every result to O/U.
        if pd.notna(r.actual):
            rec["actuals"][r.market] = round(float(r.actual), 2)
        elif r.market == "player_anytime_td":
            rec["actuals"][r.market] = 1 if res == "Y" else 0
        if pd.notna(r.close_line):
            rec["lines"][r.market] = round(float(r.close_line), 2)
        meta[r.player_id] = (r.player_name, r.position, r.team)
    # to newest-first game lists
    out = {}
    for pid, games in logs.items():
        out[pid] = sorted(games.values(), key=lambda g: (g["season"], g["week"]), reverse=True)
    return out, meta


def _dim_ok(g, dim):
    return {"overall": True, "home": g["is_home"], "away": not g["is_home"],
            "division": g["is_div"], "non_division": not g["is_div"],
            "primetime": g["is_primetime"], "regular": not g["is_primetime"]}[dim]


def compute_splits(gl):
    present = sorted({m for g in gl for m in g["markets"]})
    out = {}
    for mkt in present:
        hit_l, loss_l = PROP_MKT[mkt]
        out[mkt] = {}
        for dim in DIMS:
            games = [g for g in gl if _dim_ok(g, dim) and g["markets"].get(mkt) is not None]
            out[mkt][dim] = {}
            for w in WINDOWS:
                win = games[:w]
                h = sum(1 for g in win if g["markets"][mkt] == hit_l)
                l = sum(1 for g in win if g["markets"][mkt] == loss_l)
                p = sum(1 for g in win if g["markets"][mkt] == "P")
                out[mkt][dim][str(w)] = {"h": h, "l": l, "p": p, "n": h + l, "pct": pct(h, h + l)}
    return out, present


def compute_matchups(gl):
    """Player's record per market vs each opponent, CROSS-SEASON (all meetings, all years)."""
    by_opp = {}
    for g in gl:
        by_opp.setdefault(g["opp"], []).append(g)
    out = {}
    for opp, games in by_opp.items():
        rec = {"meetings": len(games)}
        any_mkt = False
        for mkt, (hit_l, loss_l) in PROP_MKT.items():
            dec = [g for g in games if g["markets"].get(mkt) in (hit_l, loss_l)]
            if not dec:
                continue
            h = sum(1 for g in dec if g["markets"][mkt] == hit_l)
            rec[mkt] = {"h": h, "n": len(dec), "pct": pct(h, len(dec))}
            any_mkt = True
        if any_mkt:
            out[opp] = rec
    return out


def current_roster_map():
    """gsis_id -> CURRENT team from the live nflverse weekly roster. The historical
    props frame only knows a player's team in his LAST LOGGED GAME, which goes stale
    every offseason (2026-08-27: Geno Smith shipped as LV; he's a Jet). Latest-week
    row per player wins; a player on NO current roster maps to None so he can never
    attach to a live slate game."""
    import datetime as _dt
    _today = _dt.date.today()
    ros_season = _today.year - (1 if _today.month < 3 else 0)   # NFL season rolls over in March
    for yr in (ros_season, ros_season - 1):
        try:
            ros = pd.read_parquet(
                f"https://github.com/nflverse/nflverse-data/releases/download/weekly_rosters/roster_weekly_{yr}.parquet")
            ros = ros.sort_values("week").groupby("gsis_id").tail(1)
            print(f"  [roster] current teams from roster_weekly_{yr} ({ros.gsis_id.nunique()} players)")
            return dict(zip(ros.gsis_id, ros.team.map(lambda t: NORM.get(t, t))))
        except Exception as e:
            print(f"  [roster] roster_weekly_{yr} unavailable ({e}); trying fallback")
    return None


def build():
    logs, meta = build_logs()
    roster = current_roster_map()
    rows = []
    for pid, gl in logs.items():
        splits, present = compute_splits(gl)
        if not present:
            continue
        name, pos, team = meta[pid]
        if roster is not None:
            team = roster.get(pid)   # None = not on any current roster -> never attaches to a slate
        rows.append(dict(
            player_id=pid, player_name=name, position=pos, current_team=team,
            markets=present, career_games=len(gl),
            through_season=SEASON, through_week=THROUGH_WEEK, coverage="2024-2025",
            splits=splits, matchups=compute_matchups(gl), recent_game_log=gl[:10]))
    return pd.DataFrame(rows)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--no-load", action="store_true")
    args = ap.parse_args()
    df = build()
    print(f"{len(df)} players with prop trends | games {df.career_games.min()}-{df.career_games.max()}")
    top = df.sort_values("career_games", ascending=False).head(6)
    print(top[["player_name", "position", "current_team", "career_games"]].to_string(index=False))
    if args.no_load:
        s = df[df.player_name.str.contains("Henry", na=False)].head(1)
        s = s.iloc[0] if len(s) else df.sort_values("career_games", ascending=False).iloc[0]
        print(f"\nsample {s.player_name} markets={s.markets}")
        mk = "player_rush_yds" if "player_rush_yds" in s.splits else s.markets[0]
        print(f"{mk} splits:", json.dumps(s.splits[mk], indent=0)[:500])
        return
    recs = json.loads(df.to_json(orient="records"))
    key = load_key()
    hdr = {"apikey": key, "Authorization": f"Bearer {key}",
           "Content-Type": "application/json", "Prefer": "return=minimal"}
    # SNAPSHOT semantics: exactly ONE generation may live in this table. Wiping only our own
    # (season, week) pair let generations accumulate (2026-08-05: three coexisted — stale
    # slate-era rows shipped to consumers). Delete EVERYTHING before insert.
    requests.delete(f"{BASE_URL}/nfl_player_prop_trends?through_season=gte.0",
                    headers=hdr, timeout=60)
    for i in range(0, len(recs), 200):
        resp = requests.post(f"{BASE_URL}/nfl_player_prop_trends", headers=hdr, json=recs[i:i + 200], timeout=120)
        if resp.status_code != 201:
            sys.exit(f"insert: {resp.status_code} {resp.text[:300]}")
        print(f"  loaded {min(i+200,len(recs))}/{len(recs)}", end="\r")
    print(f"\nloaded {len(recs)} rows -> nfl_player_prop_trends")


if __name__ == "__main__":
    main()
