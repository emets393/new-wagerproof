"""
Live PRE-GAME odds collector (NFL) — the missing piece for live 2026 (LOCKED_MODELS.md §8).

Captures UPCOMING-game odds snapshots (full-game + 1H + team-total) into nfl_historical_odds —
the snap_ts series the models read for open / movement / close. The live counterpart to the
historical h1tt_backfill.py (same table, same markets, same per-event endpoint).

CADENCE (run hourly via Render):
  - games TODAY (not yet started)  -> snapshot every run  (hourly; last-before-kickoff = close)
  - games on a FUTURE day          -> snapshot only at the 3 SET hours (default 8/14/20 ET) = 3x/day
PRE-GAME ONLY: any event with commence_time <= now is skipped — we never record an in-play line.
COST GUARD: the per-event endpoint bills per market; if nothing qualifies this hour, no event
  calls are made (the free /events list is checked first).

Run:  python3 live_odds.py            # dry-run: pull + parse + print, no write
      python3 live_odds.py --write     # insert the snapshot rows
"""
import os
import sys
import time
import datetime as dt
from pathlib import Path
import requests

try:
    from zoneinfo import ZoneInfo
    ET = ZoneInfo("America/New_York")            # DST-correct hour/date bucketing
except Exception:
    ET = dt.timezone(dt.timedelta(hours=-4))

ROOT = Path(__file__).resolve().parent
WRITE = "--write" in sys.argv
FORCE = "--force" in sys.argv          # ignore the cadence (testing) — snapshot all pre-game games
SET_HOURS = (8, 14, 20)                          # ET hours that also snapshot future-day games
MARKETS = "spreads,totals,h2h,spreads_h1,totals_h1,h2h_h1,team_totals"
SPORT_KEY = "americanfootball_nfl"
TABLE = "nfl_historical_odds"
ODDS_BASE = f"https://api.the-odds-api.com/v4/sports/{SPORT_KEY}"
SUPA = "https://jpxnjuwglavsjbgbasnl.supabase.co/rest/v1"

# Odds-API full name -> nfl_historical_odds city-style. Strip the nickname, except these 4.
FULL2CITY = {"Los Angeles Chargers": "LA Chargers", "Los Angeles Rams": "LA Rams",
             "New York Giants": "NY Giants", "New York Jets": "NY Jets"}


def to_city(full):
    return FULL2CITY.get(full, " ".join(full.split()[:-1]))


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


def parse_event(payload, snap_iso, season):
    """Odds-API per-event payload -> one row per bookmaker for nfl_historical_odds."""
    home, away = payload["home_team"], payload["away_team"]
    ch, ca = to_city(home), to_city(away)
    rows = []
    for bk in payload.get("bookmakers", []):
        row = dict(season=season, snap_ts=snap_iso, commence_time=payload["commence_time"],
                   home_team=ch, away_team=ca, book=bk["key"])
        for mk in bk.get("markets", []):
            key = mk["key"]
            by_name = {o.get("name"): o for o in mk.get("outcomes", [])}
            if key == "spreads":
                row["spread_home"] = by_name.get(home, {}).get("point"); row["spread_home_price"] = by_name.get(home, {}).get("price")
                row["spread_away"] = by_name.get(away, {}).get("point"); row["spread_away_price"] = by_name.get(away, {}).get("price")
            elif key == "totals":
                row["total_point"] = by_name.get("Over", {}).get("point")
                row["total_over_price"] = by_name.get("Over", {}).get("price"); row["total_under_price"] = by_name.get("Under", {}).get("price")
            elif key == "h2h":
                row["ml_home"] = by_name.get(home, {}).get("price"); row["ml_away"] = by_name.get(away, {}).get("price")
            elif key == "spreads_h1":
                row["h1_spread_home"] = by_name.get(home, {}).get("point"); row["h1_spread_home_price"] = by_name.get(home, {}).get("price")
                row["h1_spread_away"] = by_name.get(away, {}).get("point"); row["h1_spread_away_price"] = by_name.get(away, {}).get("price")
            elif key == "totals_h1":
                row["h1_total_point"] = by_name.get("Over", {}).get("point")
                row["h1_total_over_price"] = by_name.get("Over", {}).get("price"); row["h1_total_under_price"] = by_name.get("Under", {}).get("price")
            elif key == "h2h_h1":
                row["h1_ml_home"] = by_name.get(home, {}).get("price"); row["h1_ml_away"] = by_name.get(away, {}).get("price")
            elif key == "team_totals":
                # outcomes carry name=Over/Under, description=<team>
                for o in mk.get("outcomes", []):
                    team, ou = o.get("description"), o.get("name")
                    if team == home and ou == "Over":  row["tt_home_point"] = o.get("point"); row["tt_home_over_price"] = o.get("price")
                    elif team == home and ou == "Under": row["tt_home_under_price"] = o.get("price")
                    elif team == away and ou == "Over":  row["tt_away_point"] = o.get("point"); row["tt_away_over_price"] = o.get("price")
                    elif team == away and ou == "Under": row["tt_away_under_price"] = o.get("price")
        rows.append(row)
    return rows


def main():
    ok = _env("ODDS_API_KEY")
    now = dt.datetime.now(ET)
    season = now.year if now.month >= 3 else now.year - 1     # NFL season label (Sep–Feb)

    # 1) upcoming events (the /events list is free and carries commence_time)
    ev_resp = get(f"{ODDS_BASE}/events", {"apiKey": ok})
    events = ev_resp.json()
    print(f"[events] {len(events)} upcoming | quota remaining={ev_resp.headers.get('x-requests-remaining')}")

    # 2) PRE-GAME filter + cadence (today = every hour; future day = only at SET_HOURS)
    todo = []
    for ev in events:
        comm = dt.datetime.fromisoformat(ev["commence_time"].replace("Z", "+00:00")).astimezone(ET)
        if comm <= now:                       # game started -> never capture (no live lines)
            continue
        is_today = comm.date() == now.date()
        if is_today or now.hour in SET_HOURS or FORCE:
            todo.append(ev)
    print(f"[cadence] hour={now.hour} ET -> {len(todo)} events to snapshot "
          f"(today=hourly, future=3x@{SET_HOURS})")
    if not todo:
        print("[idle] nothing qualifies this hour — no per-event calls made (cost saved).")
        return

    if not WRITE and len(todo) > 2:
        print(f"[dry-run] sampling 2/{len(todo)} events (each per-event call spends quota)")
        todo = todo[:2]

    # 3) per-event odds -> book-rows
    snap_iso = now.astimezone(dt.timezone.utc).isoformat()
    rows, remaining = [], None
    for ev in todo:
        r = get(f"{ODDS_BASE}/events/{ev['id']}/odds",
                {"apiKey": ok, "markets": MARKETS, "regions": "us", "oddsFormat": "american"})
        remaining = r.headers.get("x-requests-remaining")
        rows += parse_event(r.json(), snap_iso, season)
    print(f"[parse] {len(rows)} book-rows from {len(todo)} games | quota remaining={remaining}")

    if not WRITE:
        if rows:
            print("  sample row:", {k: v for k, v in rows[0].items() if v is not None})
        print("[dry-run] no write. Re-run with --write to insert.")
        return

    # 4) append the snapshot (new snap_ts rows; the models derive open/close/movement from the series)
    sk = _env("SUPABASE_SERVICE_KEY")
    hdr = {"apikey": sk, "Authorization": f"Bearer {sk}",
           "Content-Type": "application/json", "Prefer": "return=minimal"}
    for i in range(0, len(rows), 500):
        resp = requests.post(f"{SUPA}/{TABLE}", headers=hdr, json=rows[i:i + 500], timeout=60)
        resp.raise_for_status()
    print(f"[write] inserted {len(rows)} rows at snap_ts={snap_iso}")


if __name__ == "__main__":
    main()
