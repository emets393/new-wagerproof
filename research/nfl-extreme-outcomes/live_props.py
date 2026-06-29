"""
Live PRE-GAME player-props collector (NFL) — the live counterpart to the historical
props_backfill.py + props_parse.py + props_load.py chain, collapsed into one script
(mirrors how live_odds.py is the live counterpart to h1tt_backfill).

Captures UPCOMING-game player-prop snapshots into nfl_player_props — the snap series the
prop signals (P1-P13) read for form/movement/close. Same 6 markets + 4 books as the
backfill, same per-event endpoint, same roster-scoped name matching (never guesses a name).

CADENCE (run hourly via Render, identical to live_odds.py):
  - games TODAY (not yet started) -> snapshot every run (hourly; last-before-kickoff = close)
  - games on a FUTURE day         -> snapshot only at the 3 SET hours (default 8/14/20 ET) = 3x/day
PRE-GAME ONLY: any event with commence_time <= now is skipped (no in-play prop lines).
COST GUARD: per-event endpoint bills per market; the free /events list is checked first and
  if nothing qualifies this hour, zero per-event calls are made.

Run:  python3 live_props.py             # dry-run: pull + parse + print, no write
      python3 live_props.py --write     # insert the snapshot rows
      python3 live_props.py --parse-test data/props_snapshots/2025/<file>.json   # offline parse check
"""
import os
import io
import re
import sys
import time
import json
import datetime as dt
from pathlib import Path

import pandas as pd
import requests

try:
    from zoneinfo import ZoneInfo
    ET = ZoneInfo("America/New_York")
except Exception:
    ET = dt.timezone(dt.timedelta(hours=-4))

ROOT = Path(__file__).resolve().parent
WRITE = "--write" in sys.argv
FORCE = "--force" in sys.argv
SET_HOURS = (8, 14, 20)
# 6 markets, no defensive/ST TD props ever (user rule). Same set as props_backfill.py.
MARKETS = "player_pass_tds,player_pass_yds,player_receptions,player_reception_yds,player_rush_yds,player_anytime_td"
BOOKS = "draftkings,fanduel,betmgm,williamhill_us"   # the 4 US books the 915K backfill used
SPORT_KEY = "americanfootball_nfl"
TABLE = "nfl_player_props"
ODDS_BASE = f"https://api.the-odds-api.com/v4/sports/{SPORT_KEY}"
SUPA = "https://jpxnjuwglavsjbgbasnl.supabase.co/rest/v1"

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

SKIP_PATTERNS = re.compile(r"(d/st|defense|special teams|no touchdown)", re.I)
SUFFIXES = re.compile(r"\s+(jr|sr|ii|iii|iv|v)\.?$", re.I)


def _env(name):
    if os.environ.get(name):
        return os.environ[name]
    for line in (ROOT.parent.parent / ".env.local").read_text().splitlines():
        if line.startswith(name + "="):
            return line.split("=", 1)[1].strip()
    sys.exit(f"{name} not found (env or .env.local)")


def norm(name):
    s = SUFFIXES.sub("", name.lower().strip())
    return re.sub(r"[^a-z ]", "", s).strip()


def get(url, params):
    for attempt in range(4):
        try:
            r = requests.get(url, params=params, timeout=30)
            r.raise_for_status()
            return r
        except Exception:
            if attempt == 3:
                raise
            time.sleep(1.5 * (attempt + 1))


# ---------------------------------------------------------------------------
# Roster-scoped name matching (logic ported from props_parse.py). Pool = players
# rostered to each team, joined to name variants. Unmatched names are logged,
# never guessed. Two sources:
#   - LIVE: nfl_player_profiles (Supabase) -> self-contained, current rosters,
#     refreshed weekly. No gitignored parquet dependency, so the cron just runs.
#   - OFFLINE (--parse-test): player_offense + players_xwalk parquets, season-
#     accurate for validating against historical snapshots.
# ---------------------------------------------------------------------------
def _add_variant(d, v, pid, pos):
    if not v:
        return
    if v in d and d[v] is not None and d[v][0] != pid:
        d[v] = None                      # same name, two players -> never match
    else:
        d[v] = (pid, pos)


def build_rosters_profiles(key):
    """{team_ab: {name_variant: (gsis_id, position)}} from nfl_player_profiles."""
    hdr = {"apikey": key, "Authorization": f"Bearer {key}"}
    cols = "gsis_id,full_name,first_name,last_name,football_name,position,team,season"
    rows, offset = [], 0
    while True:
        batch = requests.get(f"{SUPA}/nfl_player_profiles?select={cols}&limit=1000&offset={offset}",
                             headers=hdr, timeout=30).json()
        if not isinstance(batch, list) or not batch:
            break
        rows.extend(batch)
        if len(batch) < 1000:
            break
        offset += 1000
    # newest season wins if a gsis_id appears twice
    rows.sort(key=lambda x: x.get("season") or 0)
    rosters = {}
    for p in rows:
        team, pid, pos = p.get("team"), p.get("gsis_id"), p.get("position")
        if not team or not pid:
            continue
        d = rosters.setdefault(team, {})
        for v in (p.get("full_name"),
                  f"{p.get('football_name') or ''} {p.get('last_name') or ''}",
                  f"{p.get('first_name') or ''} {p.get('last_name') or ''}"):
            _add_variant(d, norm(v), pid, pos)
    return rosters


def build_rosters_parquet(seasons):
    po = pd.read_parquet(ROOT / "data" / "player_offense.parquet")
    po = po[po.season.isin(seasons)]
    xw = pd.read_parquet(ROOT / "data" / "players_xwalk.parquet").set_index("gsis_id")
    rosters = {}  # team_ab -> {variant: (pid, pos)}  (None = ambiguous, never match)
    for season in sorted(set(seasons)):                      # oldest -> newest
        sub = po[po.season == season]
        for team, grp in sub.groupby("team"):
            d = rosters.setdefault(team, {})
            for pid in grp.player_id.unique():
                pos = grp[grp.player_id == pid].position.iloc[-1]
                variants = set()
                if pid in xw.index:
                    r = xw.loc[pid]
                    for v in (r.display_name, f"{r.football_name} {r.last_name}",
                              f"{r.first_name} {r.last_name}",
                              f"{r.common_first_name} {r.last_name}"):
                        if isinstance(v, str) and v.strip():
                            variants.add(norm(v))
                    if isinstance(r.position, str):
                        pos = r.position
                for v in variants:
                    if v in d and d[v] is not None and d[v][0] != pid:
                        d[v] = None
                    else:
                        d[v] = (pid, pos)
    return rosters


def event_pool(rosters, away_ab, home_ab):
    """Merge the two teams' rosters into one matchup pool (ambiguous cross-team -> None)."""
    pool = {}
    for team in (away_ab, home_ab):
        for v, hit in rosters.get(team, {}).items():
            if hit is None:
                continue
            if v in pool and pool[v] is not None and pool[v][0] != hit[0]:
                pool[v] = None
            else:
                pool[v] = (*hit, team)
    return pool


def week_map(season):
    """{(home_ab, away_ab): week} from the nflverse schedule for the season."""
    try:
        r = get("https://github.com/nflverse/nfldata/raw/master/data/games.csv", {})
        g = pd.read_csv(io.StringIO(r.text))
        g = g[g.season == season]
        return {(row.home_team, row.away_team): int(row.week) for row in g.itertuples()}
    except Exception:
        return {}


def parse_event(payload, snap_iso, season, week, pool, unmatched):
    """Per-event props payload -> nfl_player_props rows (17 cols), roster-matched."""
    home, away = payload["home_team"], payload["away_team"]
    eid = payload.get("id")
    game_date = payload["commence_time"][:10]
    rows = []

    def match(name):
        return pool.get(norm(name))

    for bk in payload.get("bookmakers", []):
        for m in bk.get("markets", []):
            mkt = m["key"]
            if mkt == "player_anytime_td":
                for o in m.get("outcomes", []):
                    player = o.get("description") or o.get("name")
                    if not player or SKIP_PATTERNS.search(player):
                        continue
                    hit = match(player)
                    if not hit:
                        unmatched[player] = unmatched.get(player, 0) + 1
                        continue
                    rows.append(dict(event_id=eid, game_date=game_date, season=season, week=week,
                                     bookmaker=bk["key"], market=mkt, player_name=player,
                                     player_id=hit[0], position=hit[1], line=None,
                                     over_odds=o.get("price"), under_odds=None,
                                     home_team=home, away_team=away,
                                     commence_time=payload["commence_time"],
                                     snapshot_time=snap_iso, team=hit[2]))
            else:
                pair = {}
                for o in m.get("outcomes", []):
                    pair.setdefault((o.get("description"), o.get("point")), {})[o.get("name")] = o.get("price")
                for (player, point), sides in pair.items():
                    if not player or SKIP_PATTERNS.search(player):
                        continue
                    hit = match(player)
                    if not hit:
                        unmatched[player] = unmatched.get(player, 0) + 1
                        continue
                    rows.append(dict(event_id=eid, game_date=game_date, season=season, week=week,
                                     bookmaker=bk["key"], market=mkt, player_name=player,
                                     player_id=hit[0], position=hit[1], line=point,
                                     over_odds=sides.get("Over"), under_odds=sides.get("Under"),
                                     home_team=home, away_team=away,
                                     commence_time=payload["commence_time"],
                                     snapshot_time=snap_iso, team=hit[2]))
    return rows


def parse_test(path):
    """Offline: parse a cached backfill snapshot to prove the parse+match logic, no API."""
    payload = json.loads(Path(path).read_text())
    data = payload.get("data")
    if not data or not data.get("bookmakers"):
        print("[parse-test] snapshot empty"); return
    season = int(Path(path).stem.split("_")[0])
    rosters = build_rosters_parquet([season, season - 1])
    away_ab = TEAM_NAMES.get(data["away_team"]); home_ab = TEAM_NAMES.get(data["home_team"])
    pool = event_pool(rosters, away_ab, home_ab)
    data["id"] = data.get("id", "test")
    unmatched = {}
    rows = parse_event(data, payload.get("timestamp", "test"), season, 0, pool, unmatched)
    df = pd.DataFrame(rows)
    print(f"[parse-test] {data['away_team']}@{data['home_team']} -> {len(rows)} rows, "
          f"{df.player_id.nunique() if len(df) else 0} players, markets={sorted(df.market.unique()) if len(df) else []}")
    print(f"  unmatched names: {len(unmatched)} {list(unmatched)[:8]}")
    if len(df):
        print(df[["market", "player_name", "position", "team", "line", "over_odds", "under_odds"]].head(8).to_string(index=False))


def main():
    if "--parse-test" in sys.argv:
        parse_test(sys.argv[sys.argv.index("--parse-test") + 1])
        return

    ok = _env("ODDS_API_KEY")
    now = dt.datetime.now(ET)
    season = now.year if now.month >= 3 else now.year - 1

    ev_resp = get(f"{ODDS_BASE}/events", {"apiKey": ok})
    events = ev_resp.json()
    print(f"[events] {len(events)} upcoming | quota remaining={ev_resp.headers.get('x-requests-remaining')}")

    todo = []
    for ev in events:
        comm = dt.datetime.fromisoformat(ev["commence_time"].replace("Z", "+00:00")).astimezone(ET)
        if comm <= now:
            continue
        if comm.date() == now.date() or now.hour in SET_HOURS or FORCE:
            todo.append(ev)
    print(f"[cadence] hour={now.hour} ET -> {len(todo)} events to snapshot "
          f"(today=hourly, future=3x@{SET_HOURS})")
    if not todo:
        print("[idle] nothing qualifies this hour — no per-event calls made (cost saved).")
        return

    if not WRITE and len(todo) > 2:
        print(f"[dry-run] sampling 2/{len(todo)} events (each per-event call spends quota)")
        todo = todo[:2]

    rosters = build_rosters_profiles(_env("SUPABASE_SERVICE_KEY"))
    wk = week_map(season)
    snap_iso = now.astimezone(dt.timezone.utc).isoformat()
    rows, remaining, unmatched = [], None, {}
    for ev in todo:
        ha = TEAM_NAMES.get(ev["home_team"]); aa = TEAM_NAMES.get(ev["away_team"])
        pool = event_pool(rosters, aa, ha)
        week = wk.get((ha, aa), 0)
        r = get(f"{ODDS_BASE}/events/{ev['id']}/odds",
                {"apiKey": ok, "markets": MARKETS, "bookmakers": BOOKS, "oddsFormat": "american"})
        remaining = r.headers.get("x-requests-remaining")
        rows += parse_event(r.json(), snap_iso, season, week, pool, unmatched)
    print(f"[parse] {len(rows)} book-rows from {len(todo)} games | "
          f"unmatched={len(unmatched)} | quota remaining={remaining}")

    if not WRITE:
        if rows:
            print("  sample:", {k: v for k, v in rows[0].items() if v is not None})
        if unmatched:
            print("  top unmatched:", sorted(unmatched.items(), key=lambda x: -x[1])[:8])
        print("[dry-run] no write. Re-run with --write to insert.")
        return

    sk = _env("SUPABASE_SERVICE_KEY")
    hdr = {"apikey": sk, "Authorization": f"Bearer {sk}",
           "Content-Type": "application/json", "Prefer": "return=minimal"}
    for i in range(0, len(rows), 500):
        resp = requests.post(f"{SUPA}/{TABLE}", headers=hdr, json=rows[i:i + 500], timeout=60)
        resp.raise_for_status()
    print(f"[write] inserted {len(rows)} rows at snap_ts={snap_iso}")


if __name__ == "__main__":
    main()
