#!/usr/bin/env python3
"""
capture-dummy-data.py — regenerate the DEBUG "Dummy Data Mode" fixtures.

It's the sports offseason, so the current-week input views the app joins
through (`v_input_values_with_epa`, `cfb_live_weekly_inputs`,
`nba_input_values_view`, `v_cbb_input_values`) are empty and the Games tab /
game-detail widgets render blank. This script pulls a coherent slate of REAL
historical rows from the live CFB + Main Supabase projects (anon keys, same
public constants the app ships in SupabaseConfig.swift) and emits Swift
initializer literals into:

    WagerproofKit/Sources/WagerproofServices/DummyData/DummyDataGenerated.swift

Those literals are compiled into the DEBUG binary only and served when the
"Dummy Data Mode" toggle (Settings → Secret Settings) is on. See the approved
plan in .claude/plans and CLAUDE.md memory for the wider architecture.

Coverage / fidelity:
  - NFL : nfl_betting_lines (odds + splits + labels + dates) ⨝ latest-run
          nfl_predictions_epa (model probs) ⨝ production_weather. Fully real.
  - NBA : a real game_date slate from nba_predictions (teams, model-fair lines,
          win probs, score preds). No posted vegas odds exist historically, so
          the displayed spread/total/ML are rounded from the model's fair lines
          (real model output). Injuries are pulled REAL from nba_injury_report.
  - NCAAB: a real slate from ncaab_predictions (teams, REAL vegas odds, model
          preds) ⨝ ncaab_team_mapping (logos/abbrev). Cards fully real.
  - Polymarket: a few REAL price_history curves captured from polymarket_markets
          and reused for the dummy matchups (real market-movement shapes).

CFB and the NBA/NCAAB situational-trends + model-accuracy widgets have no
historical rows in the offseason; those fixtures are hand-authored in the
sibling DummyData*.swift files (matching the real table schemas).

Usage:  python3 scripts/wagerproof-migration/capture-dummy-data.py
"""

import json
import urllib.request
import urllib.parse
from collections import defaultdict

CFB_URL = "https://jpxnjuwglavsjbgbasnl.supabase.co/rest/v1"
CFB_KEY = (
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Impw"
    "eG5qdXdnbGF2c2piZ2Jhc25sIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI2OTc4NjEsImV4"
    "cCI6MjA2ODI3Mzg2MX0.BjOHMysQh3wST-_UR6bJxHngRThlAmOOx4FfSVKRzWo"
)
MAIN_URL = "https://gnjrklxotmbvnxbnnqgq.supabase.co/rest/v1"
MAIN_KEY = (
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imdu"
    "anJrbHhvdG1idm54Ym5ucWdxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDk0MDMzOTMsImV4"
    "cCI6MjA2NDk3OTM5M30.5jjBRWuvBoXhoYeLPMuvgAOB7izKqXLx7_D3lEfoXLQ"
)

OUT_PATH = (
    "WagerproofKit/Sources/WagerproofServices/DummyData/DummyDataGenerated.swift"
)

NBA_ABBR = {
    "Atlanta Hawks": "ATL", "Boston Celtics": "BOS", "Brooklyn Nets": "BKN",
    "Charlotte Hornets": "CHA", "Chicago Bulls": "CHI", "Cleveland Cavaliers": "CLE",
    "Dallas Mavericks": "DAL", "Denver Nuggets": "DEN", "Detroit Pistons": "DET",
    "Golden State Warriors": "GSW", "Houston Rockets": "HOU", "Indiana Pacers": "IND",
    "LA Clippers": "LAC", "Los Angeles Clippers": "LAC", "Los Angeles Lakers": "LAL",
    "Memphis Grizzlies": "MEM", "Miami Heat": "MIA", "Milwaukee Bucks": "MIL",
    "Minnesota Timberwolves": "MIN", "New Orleans Pelicans": "NOP",
    "New York Knicks": "NYK", "Oklahoma City Thunder": "OKC", "Orlando Magic": "ORL",
    "Philadelphia 76ers": "PHI", "Phoenix Suns": "PHX", "Portland Trail Blazers": "POR",
    "Sacramento Kings": "SAC", "San Antonio Spurs": "SAS", "Toronto Raptors": "TOR",
    "Utah Jazz": "UTA", "Washington Wizards": "WAS",
}


def get(base, key, path):
    url = f"{base}/{path}"
    req = urllib.request.Request(url, headers={"apikey": key, "Authorization": f"Bearer {key}"})
    with urllib.request.urlopen(req, timeout=60) as r:
        return json.loads(r.read().decode())


# ---- Swift literal helpers ------------------------------------------------

def s_str(v):
    """Optional String -> Swift `"..."` or `nil`."""
    if v is None:
        return "nil"
    t = str(v).replace("\\", "\\\\").replace('"', '\\"')
    return f'"{t}"'


def s_strq(v):
    """Non-optional String -> always quoted (empty string if None)."""
    t = "" if v is None else str(v)
    t = t.replace("\\", "\\\\").replace('"', '\\"')
    return f'"{t}"'


def s_int(v):
    return "nil" if v is None else str(int(round(float(v))))


def s_double(v, places=3):
    if v is None:
        return "nil"
    return f"{float(v):.{places}f}"


def s_bool(v):
    if v is None:
        return "nil"
    return "true" if v else "false"


def pct_str(v):
    """Numeric handle/bets fraction -> 2-decimal String literal (model wants String?)."""
    if v is None:
        return "nil"
    return f'"{float(v):.2f}"'


def round_half(v):
    if v is None:
        return None
    return round(float(v) * 2) / 2.0


def round_odds(v):
    """Round a fair moneyline to a tidy American-odds integer (nearest 5)."""
    if v is None:
        return None
    n = int(round(float(v) / 5.0) * 5)
    if -100 < n < 100:  # keep it a valid American price
        n = 100 if n >= 0 else -100
    return n


def confidence_spread(model_fair_home_spread, vegas_home_spread):
    if model_fair_home_spread is None or vegas_home_spread is None:
        return None
    diff = abs(model_fair_home_spread - vegas_home_spread)
    if model_fair_home_spread < vegas_home_spread:
        return 0.5 + min(diff * 0.05, 0.35)
    return 0.5 - min(diff * 0.05, 0.35)


def confidence_ou(model_fair_total, vegas_total):
    if model_fair_total is None or vegas_total is None:
        return None
    d = model_fair_total - vegas_total
    if d > 0:
        return 0.5 + min(abs(d) * 0.02, 0.35)
    return 0.5 - min(abs(d) * 0.02, 0.35)


# ---- NFL ------------------------------------------------------------------

def build_nfl():
    preds = get(CFB_URL, CFB_KEY, "nfl_predictions_epa?select=*")
    lines = get(CFB_URL, CFB_KEY, "nfl_betting_lines?select=*")
    weather = get(CFB_URL, CFB_KEY, "production_weather?select=*")

    # Latest betting line per training_key (max as_of_ts).
    line_by_key = {}
    for row in lines:
        k = row.get("training_key")
        if not k:
            continue
        cur = line_by_key.get(k)
        if cur is None or (row.get("as_of_ts") or "") > (cur.get("as_of_ts") or ""):
            line_by_key[k] = row

    weather_by_key = {w.get("training_key"): w for w in weather if w.get("training_key")}

    # Build prediction training_key = home_team + away_team + season + week
    # (matches nfl_betting_lines.training_key, e.g. "New EnglandSeattle202522").
    # Dedup predictions to the latest as_of_ts per game (the table holds one
    # row per model run) so we get one card per real matchup, not per run.
    pred_by_key = {}
    for p in preds:
        if not p.get("home_team") or not p.get("away_team"):
            continue
        season, week = p.get("season"), p.get("week")
        key = f"{p['home_team']}{p['away_team']}{season}{week}"
        if key not in line_by_key:
            continue  # need real odds to render a useful card
        cur = pred_by_key.get(key)
        if cur is None or (p.get("as_of_ts") or "") > (cur.get("as_of_ts") or ""):
            pred_by_key[key] = p

    by_week = defaultdict(list)
    for key, p in pred_by_key.items():
        by_week[(p.get("season"), p.get("week"))].append((p, line_by_key[key]))

    if not by_week:
        return []
    # Pick the regular-season week with the most fully-joined games (a full
    # NFL week is ~16 games); cap so the slate stays a realistic size.
    best = max(by_week.items(), key=lambda kv: len(kv[1]))
    games = sorted(best[1], key=lambda pl: pl[0].get("game_date") or "")[:16]
    print(f"  NFL: season {best[0][0]} week {best[0][1]} -> {len(games)} games")

    out = []
    for p, line in games:
        season, week = p.get("season"), p.get("week")
        key = f"{p['home_team']}{p['away_team']}{season}{week}"
        w = weather_by_key.get(key)
        home_spread = line.get("home_spread")
        out.append({
            "id": key,
            "away": p["away_team"], "home": p["home_team"],
            "home_ml": line.get("home_ml"), "away_ml": line.get("away_ml"),
            "home_spread": home_spread,
            "away_spread": (-home_spread if home_spread is not None else None),
            "over_line": line.get("over_line"),
            "game_date": p.get("game_date") or line.get("game_date") or "",
            "game_time": line.get("game_time_et") or p.get("game_date") or "",
            "training_key": key,
            "ml_prob": p.get("home_away_ml_prob"),
            "spread_prob": p.get("home_away_spread_cover_prob"),
            "ou_prob": p.get("ou_result_prob"),
            "run_id": p.get("run_id"),
            "temp": (w or {}).get("temperature"),
            "precip": (w or {}).get("precipitation_pct"),
            "wind": (w or {}).get("wind_speed"),
            "icon": (w or {}).get("icon"),
            "spread_label": line.get("spread_splits_label"),
            "total_label": line.get("total_splits_label"),
            "ml_label": line.get("ml_splits_label"),
            "home_ml_handle": line.get("home_ml_handle"), "away_ml_handle": line.get("away_ml_handle"),
            "home_ml_bets": line.get("home_ml_bets"), "away_ml_bets": line.get("away_ml_bets"),
            "home_spread_handle": line.get("home_spread_handle"), "away_spread_handle": line.get("away_spread_handle"),
            "home_spread_bets": line.get("home_spread_bets"), "away_spread_bets": line.get("away_spread_bets"),
            "over_handle": line.get("over_handle"), "under_handle": line.get("under_handle"),
            "over_bets": line.get("over_bets"), "under_bets": line.get("under_bets"),
        })
    return out


def emit_nfl(games):
    lines = ["    static let nfl: [NFLPrediction] = ["]
    for g in games:
        lines.append("        NFLPrediction(")
        lines.append(f"            id: {s_strq(g['id'])},")
        lines.append(f"            awayTeam: {s_strq(g['away'])},")
        lines.append(f"            homeTeam: {s_strq(g['home'])},")
        lines.append(f"            homeMl: {s_int(g['home_ml'])},")
        lines.append(f"            awayMl: {s_int(g['away_ml'])},")
        lines.append(f"            homeSpread: {s_double(g['home_spread'], 1)},")
        lines.append(f"            awaySpread: {s_double(g['away_spread'], 1)},")
        lines.append(f"            overLine: {s_double(g['over_line'], 1)},")
        lines.append(f"            gameDate: {s_strq(g['game_date'])},")
        lines.append(f"            gameTime: {s_strq(g['game_time'])},")
        lines.append(f"            trainingKey: {s_strq(g['training_key'])},")
        lines.append(f"            uniqueId: {s_strq(g['training_key'])},")
        lines.append(f"            homeAwayMlProb: {s_double(g['ml_prob'])},")
        lines.append(f"            homeAwaySpreadCoverProb: {s_double(g['spread_prob'])},")
        lines.append(f"            ouResultProb: {s_double(g['ou_prob'])},")
        lines.append(f"            runId: {s_str(g['run_id'])},")
        lines.append(f"            temperature: {s_double(g['temp'], 1)},")
        lines.append(f"            precipitation: {s_double(g['precip'], 1)},")
        lines.append(f"            windSpeed: {s_double(g['wind'], 1)},")
        lines.append(f"            icon: {s_str(g['icon'])},")
        lines.append(f"            spreadSplitsLabel: {s_str(g['spread_label'])},")
        lines.append(f"            totalSplitsLabel: {s_str(g['total_label'])},")
        lines.append(f"            mlSplitsLabel: {s_str(g['ml_label'])},")
        lines.append(f"            homeMlHandle: {pct_str(g['home_ml_handle'])},")
        lines.append(f"            awayMlHandle: {pct_str(g['away_ml_handle'])},")
        lines.append(f"            homeMlBets: {pct_str(g['home_ml_bets'])},")
        lines.append(f"            awayMlBets: {pct_str(g['away_ml_bets'])},")
        lines.append(f"            homeSpreadHandle: {pct_str(g['home_spread_handle'])},")
        lines.append(f"            awaySpreadHandle: {pct_str(g['away_spread_handle'])},")
        lines.append(f"            homeSpreadBets: {pct_str(g['home_spread_bets'])},")
        lines.append(f"            awaySpreadBets: {pct_str(g['away_spread_bets'])},")
        lines.append(f"            overHandle: {pct_str(g['over_handle'])},")
        lines.append(f"            underHandle: {pct_str(g['under_handle'])},")
        lines.append(f"            overBets: {pct_str(g['over_bets'])},")
        lines.append(f"            underBets: {pct_str(g['under_bets'])}")
        lines.append("        ),")
    lines.append("    ]")
    return "\n".join(lines)


# ---- NBA ------------------------------------------------------------------

def build_nba():
    preds = get(CFB_URL, CFB_KEY, "nba_predictions?select=*&order=as_of_ts_utc.desc")
    # Latest row per game_id, grouped by date.
    latest = {}
    for p in preds:
        gid = p.get("game_id")
        if gid is None:
            continue
        if gid not in latest:  # already sorted desc by as_of_ts_utc
            latest[gid] = p
    by_date = defaultdict(list)
    for p in latest.values():
        by_date[p.get("game_date")].append(p)
    if not by_date:
        return [], []
    best = max(by_date.items(), key=lambda kv: len(kv[1]))
    games = sorted(best[1], key=lambda p: p.get("game_id"))[:10]
    print(f"  NBA: game_date {best[0]} -> {len(games)} games")

    out = []
    team_names = set()
    for p in games:
        gid = int(p["game_id"])
        home, away = p.get("home_team", ""), p.get("away_team", "")
        team_names.add(home)
        team_names.add(away)
        mf_spread = p.get("model_fair_home_spread")
        mf_total = p.get("model_fair_total")
        vegas_spread = round_half(mf_spread)
        vegas_total = round_half(mf_total)
        out.append({
            "id": str(gid), "game_id": gid, "away": away, "home": home,
            "away_abbr": NBA_ABBR.get(away, away[:3].upper()),
            "home_abbr": NBA_ABBR.get(home, home[:3].upper()),
            "home_ml": round_odds(p.get("model_fair_home_moneyline")),
            "away_ml": round_odds(p.get("model_fair_away_moneyline")),
            "home_spread": vegas_spread,
            "away_spread": (-vegas_spread if vegas_spread is not None else None),
            "over_line": vegas_total,
            "game_date": p.get("game_date") or "",
            "ml_prob": p.get("home_win_prob"),
            "spread_prob": confidence_spread(mf_spread, vegas_spread),
            "ou_prob": confidence_ou(mf_total, vegas_total),
            "run_id": p.get("run_id"),
            "home_score": p.get("home_score_pred"), "away_score": p.get("away_score_pred"),
            "mf_spread": mf_spread, "mf_total": mf_total,
        })

    # Real injuries for the teams in this slate (a few rows per team).
    injuries = []
    seen = defaultdict(int)
    try:
        names = ",".join(f'"{urllib.parse.quote(n)}"' for n in team_names if n)
        inj = get(CFB_URL, CFB_KEY,
                  f"nba_injury_report?select=player_name,avg_pie_season,status,team_id,team_name,team_abbr"
                  f"&team_name=in.({names})&order=avg_pie_season.desc&limit=400")
        for r in inj:
            tn = r.get("team_name")
            if not tn or seen[tn] >= 4:
                continue
            seen[tn] += 1
            injuries.append(r)
    except Exception as e:
        print(f"  NBA injuries fetch skipped: {e}")
    print(f"  NBA: {len(injuries)} injury rows across {len(seen)} teams")
    return out, injuries


def emit_nba(games):
    lines = ["    static let nba: [NBAGame] = ["]
    for g in games:
        lines.append("        NBAGame(")
        lines.append(f"            id: {s_strq(g['id'])},")
        lines.append(f"            gameId: {g['game_id']},")
        lines.append(f"            awayTeam: {s_strq(g['away'])},")
        lines.append(f"            homeTeam: {s_strq(g['home'])},")
        lines.append(f"            awayAbbr: {s_strq(g['away_abbr'])},")
        lines.append(f"            homeAbbr: {s_strq(g['home_abbr'])},")
        lines.append(f"            homeMl: {s_int(g['home_ml'])},")
        lines.append(f"            awayMl: {s_int(g['away_ml'])},")
        lines.append(f"            homeSpread: {s_double(g['home_spread'], 1)},")
        lines.append(f"            awaySpread: {s_double(g['away_spread'], 1)},")
        lines.append(f"            overLine: {s_double(g['over_line'], 1)},")
        lines.append(f"            gameDate: {s_strq(g['game_date'])},")
        lines.append(f"            gameTime: {s_strq(g['game_date'])},")
        lines.append(f"            trainingKey: {s_strq(g['id'])},")
        lines.append(f"            uniqueId: {s_strq(g['id'])},")
        lines.append(f"            homeAwayMlProb: {s_double(g['ml_prob'])},")
        lines.append(f"            homeAwaySpreadCoverProb: {s_double(g['spread_prob'])},")
        lines.append(f"            ouResultProb: {s_double(g['ou_prob'])},")
        lines.append(f"            runId: {s_str(g['run_id'])},")
        lines.append(f"            homeScorePred: {s_double(g['home_score'], 1)},")
        lines.append(f"            awayScorePred: {s_double(g['away_score'], 1)},")
        lines.append(f"            modelFairHomeSpread: {s_double(g['mf_spread'])},")
        lines.append(f"            modelFairTotal: {s_double(g['mf_total'])}")
        lines.append("        ),")
    lines.append("    ]")
    return "\n".join(lines)


def emit_nba_injuries(injuries):
    # Keyed by team name so the matchup-overview short-circuit can split
    # home/away. NBAInjuryReport has a public memberwise init.
    lines = ["    static let nbaInjuriesByTeam: [String: [NBAInjuryReport]] = ["]
    by_team = defaultdict(list)
    for r in injuries:
        by_team[r.get("team_name")].append(r)
    for team, rows in by_team.items():
        lines.append(f"        {s_strq(team)}: [")
        for r in rows:
            pie = r.get("avg_pie_season")
            pie_str = "nil" if pie is None else f'"{pie}"'
            lines.append("            NBAInjuryReport(")
            lines.append(f"                playerName: {s_strq(r.get('player_name'))},")
            lines.append(f"                avgPieSeason: {pie_str},")
            lines.append(f"                status: {s_strq(r.get('status'))},")
            lines.append(f"                teamId: {s_int(r.get('team_id'))},")
            lines.append(f"                teamName: {s_strq(r.get('team_name'))},")
            lines.append(f"                teamAbbr: {s_strq(r.get('team_abbr'))}")
            lines.append("            ),")
        lines.append("        ],")
    lines.append("    ]")
    return "\n".join(lines)


# ---- NCAAB ----------------------------------------------------------------

def build_ncaab():
    preds = get(CFB_URL, CFB_KEY, "ncaab_predictions?select=*&order=as_of_ts_utc.desc")
    mapping = get(CFB_URL, CFB_KEY, "ncaab_team_mapping?select=api_team_id,team_abbrev,espn_team_id")
    map_by_id = {}
    for m in mapping:
        espn = m.get("espn_team_id")
        logo = None
        try:
            if espn is not None:
                logo = f"https://a.espncdn.com/i/teamlogos/ncaa/500/{int(espn)}.png"
        except (ValueError, TypeError):
            logo = None
        map_by_id[m.get("api_team_id")] = (m.get("team_abbrev"), logo)

    latest = {}
    for p in preds:
        gid = p.get("game_id")
        if gid is None:
            continue
        if gid not in latest:
            latest[gid] = p
    by_date = defaultdict(list)
    for p in latest.values():
        by_date[p.get("game_date_et")].append(p)
    if not by_date:
        return []
    best = max(by_date.items(), key=lambda kv: len(kv[1]))
    games = sorted(best[1], key=lambda p: p.get("game_id"))[:10]
    print(f"  NCAAB: game_date_et {best[0]} -> {len(games)} games")

    out = []
    for p in games:
        gid = int(p["game_id"])
        home_map = map_by_id.get(p.get("home_team_id"), (None, None))
        away_map = map_by_id.get(p.get("away_team_id"), (None, None))
        vegas_spread = p.get("vegas_home_spread")
        mf_spread = p.get("model_fair_home_spread")
        out.append({
            "id": str(gid), "game_id": gid,
            "away": p.get("away_team", ""), "home": p.get("home_team", ""),
            "home_ml": p.get("vegas_home_moneyline"), "away_ml": p.get("vegas_away_moneyline"),
            "home_spread": vegas_spread,
            "away_spread": (-vegas_spread if vegas_spread is not None else None),
            "over_line": p.get("vegas_total"),
            "game_date": p.get("game_date_et") or "",
            "game_time": p.get("start_utc") or p.get("tipoff_time_et") or "",
            "conf_game": p.get("conference_game"), "neutral": p.get("neutral_site"),
            "ml_prob": p.get("home_win_prob"),
            "spread_prob": confidence_spread(mf_spread, vegas_spread),
            "ou_prob": confidence_ou(p.get("pred_total_points"), p.get("vegas_total")),
            "pred_margin": p.get("pred_home_margin"), "pred_total": p.get("pred_total_points"),
            "run_id": p.get("run_id"),
            "home_score": p.get("home_score_pred"), "away_score": p.get("away_score_pred"),
            "mf_spread": mf_spread,
            "home_logo": home_map[1], "away_logo": away_map[1],
            "home_abbrev": home_map[0], "away_abbrev": away_map[0],
        })
    return out


def emit_ncaab(games):
    lines = ["    static let ncaab: [NCAABGame] = ["]
    for g in games:
        lines.append("        NCAABGame(")
        lines.append(f"            id: {s_strq(g['id'])},")
        lines.append(f"            gameId: {g['game_id']},")
        lines.append(f"            awayTeam: {s_strq(g['away'])},")
        lines.append(f"            homeTeam: {s_strq(g['home'])},")
        lines.append(f"            homeMl: {s_int(g['home_ml'])},")
        lines.append(f"            awayMl: {s_int(g['away_ml'])},")
        lines.append(f"            homeSpread: {s_double(g['home_spread'], 1)},")
        lines.append(f"            awaySpread: {s_double(g['away_spread'], 1)},")
        lines.append(f"            overLine: {s_double(g['over_line'], 1)},")
        lines.append(f"            gameDate: {s_strq(g['game_date'])},")
        lines.append(f"            gameTime: {s_strq(g['game_time'])},")
        lines.append(f"            trainingKey: {s_strq(g['id'])},")
        lines.append(f"            uniqueId: {s_strq(g['id'])},")
        lines.append(f"            homeRanking: nil,")
        lines.append(f"            awayRanking: nil,")
        lines.append(f"            conferenceGame: {s_bool(g['conf_game'])},")
        lines.append(f"            neutralSite: {s_bool(g['neutral'])},")
        lines.append(f"            homeAwayMlProb: {s_double(g['ml_prob'])},")
        lines.append(f"            homeAwaySpreadCoverProb: {s_double(g['spread_prob'])},")
        lines.append(f"            ouResultProb: {s_double(g['ou_prob'])},")
        lines.append(f"            predHomeMargin: {s_double(g['pred_margin'])},")
        lines.append(f"            predTotalPoints: {s_double(g['pred_total'])},")
        lines.append(f"            runId: {s_str(g['run_id'])},")
        lines.append(f"            homeScorePred: {s_double(g['home_score'], 1)},")
        lines.append(f"            awayScorePred: {s_double(g['away_score'], 1)},")
        lines.append(f"            modelFairHomeSpread: {s_double(g['mf_spread'])},")
        lines.append(f"            homeTeamLogo: {s_str(g['home_logo'])},")
        lines.append(f"            awayTeamLogo: {s_str(g['away_logo'])},")
        lines.append(f"            homeTeamAbbrev: {s_str(g['home_abbrev'])},")
        lines.append(f"            awayTeamAbbrev: {s_str(g['away_abbrev'])}")
        lines.append("        ),")
    lines.append("    ]")
    return "\n".join(lines)


# ---- Polymarket curves (real movement shapes) -----------------------------

def build_polymarket_curves():
    try:
        rows = get(MAIN_URL, MAIN_KEY,
                   "polymarket_markets?select=current_away_odds,current_home_odds,price_history"
                   "&market_type=eq.moneyline&order=last_updated.desc&limit=300")
    except Exception as e:
        print(f"  Polymarket fetch skipped: {e}")
        return []
    candidates = []
    for r in rows:
        ph = r.get("price_history")
        if not isinstance(ph, list) or len(ph) < 8:
            continue
        pts = [(int(pt["t"]), float(pt["p"])) for pt in ph
               if isinstance(pt, dict) and "t" in pt and "p" in pt]
        if len(pts) < 8:
            continue
        prices = [p for _, p in pts]
        movement = max(prices) - min(prices)
        candidates.append({
            "away": r.get("current_away_odds"),
            "home": r.get("current_home_odds"),
            "pts": pts[:60],
            "movement": movement,
        })
    # Prefer curves with visible movement so the chart isn't a flat line.
    candidates.sort(key=lambda c: c["movement"], reverse=True)
    curves = candidates[:4]
    print(f"  Polymarket: captured {len(curves)} real moneyline curves "
          f"(movement {[round(c['movement'], 2) for c in curves]})")
    return curves


def emit_polymarket(curves):
    lines = ["    /// Real moneyline price-movement curves captured from",
             "    /// `polymarket_markets`, reused for the dummy matchups so every",
             "    /// game-detail Polymarket widget renders a real-shaped chart.",
             "    static let polymarketCurves: [PolymarketCurve] = ["]
    for c in curves:
        pts = ", ".join(f"({t}, {p:.4f})" for t, p in c["pts"])
        lines.append("        PolymarketCurve(")
        lines.append(f"            currentAwayOdds: {s_double(c['away'], 4)},")
        lines.append(f"            currentHomeOdds: {s_double(c['home'], 4)},")
        lines.append(f"            points: [{pts}]")
        lines.append("        ),")
    lines.append("    ]")
    return "\n".join(lines)


# ---- Main -----------------------------------------------------------------

def main():
    print("Capturing real historical data for Dummy Data Mode fixtures…")
    nfl = build_nfl()
    nba, injuries = build_nba()
    ncaab = build_ncaab()
    curves = build_polymarket_curves()

    header = '''// swiftlint:disable all
// GENERATED FILE — do not edit by hand.
// Regenerate with: python3 scripts/wagerproof-migration/capture-dummy-data.py
//
// Real historical slates captured from the live Supabase projects for the
// DEBUG-only "Dummy Data Mode" (Settings → Secret Settings). See
// scripts/wagerproof-migration/capture-dummy-data.py for provenance and the
// offseason data-availability notes. Compiled into DEBUG builds only.
#if DEBUG
import Foundation
import WagerproofModels

/// A captured real Polymarket moneyline price curve, reused for dummy
/// matchups by `DummyData.polymarket(...)`.
struct PolymarketCurve: Sendable {
    let currentAwayOdds: Double?
    let currentHomeOdds: Double?
    /// `(unix_seconds, away_yes_price)` observations.
    let points: [(Int, Double)]
}

/// Card slates + injury + Polymarket fixtures captured from real rows.
/// Trends / model-accuracy / CFB fixtures are hand-authored in DummyData.swift.
enum DummyDataGenerated {
'''
    body = "\n\n".join([
        emit_nfl(nfl),
        emit_nba(nba),
        emit_nba_injuries(injuries),
        emit_ncaab(ncaab),
        emit_polymarket(curves),
    ])
    footer = "\n}\n#endif\n"

    with open(OUT_PATH, "w") as f:
        f.write(header + body + footer)
    print(f"Wrote {OUT_PATH}")
    print(f"  NFL {len(nfl)} · NBA {len(nba)} (+{len(injuries)} injuries) · "
          f"NCAAB {len(ncaab)} · Polymarket curves {len(curves)}")


if __name__ == "__main__":
    main()
