"""
Live PRE-GAME odds collector (CFB) — captures UPCOMING-game odds into ncaaf_odds_history.

The live counterpart to fetch_odds_history.py: same table, same FG markets (h2h/spreads/totals),
same game_id = Odds-API event id (no CFBD match needed), same pre-game rule. Uses the cheap BULK
/odds endpoint (one call returns all upcoming events + odds), so no per-event fan-out.

CADENCE (run hourly via Render): future-day games 3x/day (8/14/20 ET), today's games every hour,
PRE-GAME ONLY (any event with commence_time <= now is dropped — no live in-play lines). One bulk
call per run (~3 credits), so idle hours are cheap.

NOTE: CFB 1H + team-total odds ride the separate fetch_event_odds.py path — that still needs the
same upcoming + pre-game treatment for the live 1H/TT signals.

Run:  python3 live_odds_cfb.py [--write] [--force]
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

ROOT = Path(__file__).resolve().parent
WRITE = "--write" in sys.argv
FORCE = "--force" in sys.argv                    # ignore cadence (testing)
SET_HOURS = (8, 14, 20)
MARKETS = "h2h,spreads,totals"
TABLE = "ncaaf_odds_history"
ODDS_BASE = "https://api.the-odds-api.com/v4/sports/americanfootball_ncaaf"
SUPA = "https://jpxnjuwglavsjbgbasnl.supabase.co/rest/v1"


def _env(name):
    if os.environ.get(name):
        return os.environ[name]
    for line in (ROOT.parent.parent / ".env.local").read_text().splitlines():
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


def parse(events, snap_iso, now, season):
    """Bulk /odds payload -> one ncaaf_odds_history row per (event, book), with the
    pre-game + cadence filter applied. game_id = Odds-API event id (matches the backfill)."""
    snap = dt.datetime.fromisoformat(snap_iso.replace("Z", "+00:00"))
    rows = []
    for ev in events:
        ct = dt.datetime.fromisoformat(ev["commence_time"].replace("Z", "+00:00"))
        if ct <= snap:                                   # PRE-GAME ONLY (drops live odds)
            continue
        is_today = ct.astimezone(ET).date() == now.date()
        if not (is_today or now.hour in SET_HOURS or FORCE):   # cadence: future days only at SET_HOURS
            continue
        home, away = ev["home_team"], ev["away_team"]
        for bk in ev.get("bookmakers", []):
            r = {"season": season, "snapshot": snap_iso, "commence_time": ev["commence_time"],
                 "game_id": ev["id"], "home_team": home, "away_team": away, "book": bk["key"],
                 "home_ml": None, "away_ml": None, "spread_home": None, "spread_home_price": None,
                 "spread_away_price": None, "total": None, "over_price": None, "under_price": None,
                 "hrs_to_kick": round((ct - snap).total_seconds() / 3600, 1)}
            for mk in bk.get("markets", []):
                if mk["key"] == "h2h":
                    for o in mk["outcomes"]:
                        if o["name"] == home: r["home_ml"] = o.get("price")
                        elif o["name"] == away: r["away_ml"] = o.get("price")
                elif mk["key"] == "spreads":
                    for o in mk["outcomes"]:
                        if o["name"] == home: r["spread_home"], r["spread_home_price"] = o.get("point"), o.get("price")
                        elif o["name"] == away: r["spread_away_price"] = o.get("price")
                elif mk["key"] == "totals":
                    for o in mk["outcomes"]:
                        if o["name"] == "Over": r["total"], r["over_price"] = o.get("point"), o.get("price")
                        elif o["name"] == "Under": r["under_price"] = o.get("price")
            rows.append(r)
    return rows


def main():
    ok = _env("ODDS_API_KEY")
    now = dt.datetime.now(ET)
    season = now.year if now.month >= 3 else now.year - 1     # CFB season label (Aug–Jan)

    r = get(f"{ODDS_BASE}/odds",
            {"apiKey": ok, "markets": MARKETS, "regions": "us", "oddsFormat": "american"})
    events = r.json()
    snap_iso = now.astimezone(dt.timezone.utc).isoformat()
    rows = parse(events, snap_iso, now, season)
    print(f"[cfb] {len(events)} upcoming events | {len(rows)} book-rows qualify "
          f"(hour={now.hour} ET; today=hourly, future=3x@{SET_HOURS}) | quota={r.headers.get('x-requests-remaining')}")

    if not WRITE:
        if rows:
            print("  sample row:", {k: v for k, v in rows[0].items() if v is not None})
        print("[dry-run] no write. Re-run with --write to insert.")
        return
    if not rows:
        print("[idle] nothing qualifies this hour — no rows written.")
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
