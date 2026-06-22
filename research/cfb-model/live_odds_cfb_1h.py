"""
Live PRE-GAME CFB 1H + team-total odds collector -> ncaaf_event_odds (DB).

Live counterpart to fetch_event_odds.py: per-event endpoint, markets team_totals/spreads_h1/
totals_h1/h2h_h1. But UPCOMING (not /historical/), pre-game + cadence, and it writes the DB table
(persistent on Render — unlike the historical parquet, which an hourly cron couldn't hand to the
weekly slate runner). A slate-time fetch step then materializes ncaaf_event_odds ->
data/event_odds/events_<season>.parquet so build_odds_frame reads it unchanged (the NFL pattern:
DB is the source of truth, parquet is a per-run projection).

CADENCE: future-day games 3x/day (8/14/20 ET), today's games hourly, PRE-GAME ONLY. Per-event
(4 markets) so it's scoped to OUR slate (model_games) to bound cost.

Run: python3 live_odds_cfb_1h.py [--write] [--force]
"""
import os
import sys
import time
import datetime as dt
from pathlib import Path
import requests

try:
    from zoneinfo import ZoneInfo
    ET = ZoneInfo("America/New_York")
except Exception:
    ET = dt.timezone(dt.timedelta(hours=-4))

HERE = Path(__file__).resolve().parent
WRITE = "--write" in sys.argv
FORCE = "--force" in sys.argv
SET_HOURS = (8, 14, 20)
MARKETS = "team_totals,spreads_h1,totals_h1,h2h_h1"
BASE = "https://api.the-odds-api.com/v4/sports/americanfootball_ncaaf"
SUPA = "https://jpxnjuwglavsjbgbasnl.supabase.co/rest/v1"
TABLE = "ncaaf_event_odds"
ALIAS = {"Appalachian State Mountaineers": "App State", "Hawaii Rainbow Warriors": "Hawai'i",
         "UMass Minutemen": "Massachusetts", "San Jose State Spartans": "San José State",
         "Southern Miss Golden Eagles": "Southern Miss"}


def _env(name):
    if os.environ.get(name):
        return os.environ[name]
    for line in (HERE.parent.parent / ".env.local").read_text().splitlines():
        if line.startswith(name + "="):
            return line.split("=", 1)[1].strip()
    sys.exit(f"{name} not found (env or .env.local)")


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


def main():
    ok = _env("ODDS_API_KEY")
    now = dt.datetime.now(ET)
    now_utc = now.astimezone(dt.timezone.utc)
    season = now.year if now.month >= 3 else now.year - 1

    # Our modeled slate lives in cfb_dryrun_games (DB) — persistent across Render jobs, unlike a
    # local model_games.parquet (the hourly odds cron has no build step to produce it).
    sk = _env("SUPABASE_SERVICE_KEY")
    sr = requests.get(
        f"{SUPA}/cfb_dryrun_games?select=game_id,home_team,away_team&season=eq.{season}",
        headers={"apikey": sk, "Authorization": f"Bearer {sk}"}, timeout=30)
    sr.raise_for_status()
    sg = sr.json()
    if not sg:
        print(f"[idle] no cfb_dryrun_games slate for {season} yet — nothing to capture.")
        return
    teams = sorted({g["home_team"] for g in sg} | {g["away_team"] for g in sg})

    def to_db(o):                                    # Odds-API full name -> CFBD name
        if o in ALIAS:
            return ALIAS[o]
        c = [x for x in teams if o.startswith(x + " ") or o == x]
        c.sort(key=len, reverse=True)
        return c[0] if c else None

    slate = {(g["home_team"], g["away_team"]): g["game_id"] for g in sg}

    ev = get(f"{BASE}/events", {"apiKey": ok}).json()
    todo = []
    for e in ev:
        comm = dt.datetime.fromisoformat(e["commence_time"].replace("Z", "+00:00"))
        if comm <= now_utc:                          # PRE-GAME ONLY
            continue
        gid = slate.get((to_db(e["home_team"]), to_db(e["away_team"])))
        if not gid:                                  # not on our modeled slate -> skip (cost)
            continue
        is_today = comm.astimezone(ET).date() == now.date()
        if is_today or now.hour in SET_HOURS or FORCE:
            todo.append((e["id"], gid, to_db(e["home_team"]), to_db(e["away_team"]), e["commence_time"]))
    print(f"[cfb-1h] {len(ev)} events, {len(todo)} of our slate qualify (hour={now.hour} ET)")
    if not todo:
        print("[idle] nothing qualifies — no per-event calls.")
        return
    if not WRITE and len(todo) > 2:
        print(f"[dry-run] sampling 2/{len(todo)} (each per-event call spends quota)")
        todo = todo[:2]

    snap_iso = now_utc.isoformat()
    rows, remaining = [], None
    for eid, gid, h, a, comm in todo:
        r = get(f"{BASE}/events/{eid}/odds",
                {"apiKey": ok, "regions": "us", "markets": MARKETS, "oddsFormat": "american"})
        remaining = r.headers.get("x-requests-remaining", remaining)
        for bk in r.json().get("bookmakers", []):
            for mkt in bk.get("markets", []):
                for o in mkt.get("outcomes", []):
                    rows.append({"season": season, "snap_ts": snap_iso, "commence_time": comm,
                                 "game_id": gid, "home": h, "away": a, "book": bk["key"],
                                 "market": mkt["key"], "name": o.get("name"),
                                 "description": o.get("description"),
                                 "price": o.get("price"), "point": o.get("point")})
    print(f"[parse] {len(rows)} outcome-rows from {len(todo)} games | quota remaining={remaining}")

    if not WRITE:
        if rows:
            print("  sample row:", rows[0])
        print("[dry-run] no write. Re-run with --write to insert.")
        return
    if not rows:
        print("[idle] no 1H/TT lines posted for these games yet.")
        return

    sk = _env("SUPABASE_SERVICE_KEY")
    hdr = {"apikey": sk, "Authorization": f"Bearer {sk}",
           "Content-Type": "application/json", "Prefer": "return=minimal"}
    for i in range(0, len(rows), 500):
        resp = requests.post(f"{SUPA}/{TABLE}", headers=hdr, json=rows[i:i + 500], timeout=60)
        resp.raise_for_status()
    print(f"[write] inserted {len(rows)} rows -> {TABLE} at snap_ts={snap_iso}")


if __name__ == "__main__":
    main()
