#!/usr/bin/env python3
"""
Second-half (halftime-posted) odds backfill — NFL + NCAAF.

2H markets (spreads_h2 / totals_h2 / h2h_h2) exist only DURING halftime, so this
walks The Odds API's HISTORICAL snapshots (5-min grid, additional-markets wall
2023-05-03) and probes each game at kickoff+offsets to catch the live 2H prices.

Mechanics:
  1. events: one historical events call per game-day (1 credit) -> event ids +
     exact commence times.
  2. probes: per event, historical event-odds at a kickoff+offset ladder
     (NFL 90/100/110 min, NCAAF 95/105/120 — halftime windows). A book's quote
     counts as LIVE only if its last_update is within 4 min of the snapshot
     (in-play books leave stale suspended quotes).
  3. append rows to data/{sport}_2h_raw.parquet; processed event ids checkpointed
     so reruns resume. Quota guard aborts below 50k remaining.

Usage: python3 fetch_2h.py nfl 2025-09-04 2025-09-16    # sport start end
Run build_frame.py afterwards for the per-game open/close consensus frame.
"""
import json
import os
import sys
import time
from datetime import datetime, timedelta, timezone

import pandas as pd
import requests

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", ".."))
DATA = os.path.join(HERE, "data")
os.makedirs(DATA, exist_ok=True)

SPORT_KEY = {"nfl": "americanfootball_nfl", "ncaaf": "americanfootball_ncaaf"}
# minutes after kickoff to probe for halftime; football 1H runs ~85-110 real minutes
LADDER = {"nfl": (90, 100, 110), "ncaaf": (95, 105, 120)}
# game-days worth an events call. Windows are [day 06:00 UTC, day+1 06:00), so a
# US night game (00:20 UTC next day) belongs to ITS OWN local day's window:
# NFL Thu(TNF)/Fri/Sat/Sun/Mon; NCAAF plays basically any day incl. bowls -> all 7.
GAME_DOW = {"nfl": {3, 4, 5, 6, 0}, "ncaaf": {0, 1, 2, 3, 4, 5, 6}}
MARKETS = "spreads_h2,totals_h2,h2h_h2"
FRESH_SEC = 240
MIN_QUOTA = 50_000


def api_key():
    for fn in (os.path.join(ROOT, ".env.local"), os.path.join(ROOT, "research", ".env")):
        if os.path.exists(fn):
            for line in open(fn):
                if line.startswith("ODDS_API_KEY="):
                    return line.split("=", 1)[1].strip()
    raise SystemExit("no ODDS_API_KEY")


KEY = api_key()
_quota = [None]


def get(url, params):
    for attempt in range(4):
        try:
            r = requests.get(url, params={**params, "apiKey": KEY}, timeout=45)
            rem = r.headers.get("x-requests-remaining")
            if rem is not None:
                _quota[0] = int(float(rem))
                if _quota[0] < MIN_QUOTA:
                    raise SystemExit(f"quota guard: {_quota[0]} remaining < {MIN_QUOTA}")
            if r.status_code == 429:
                time.sleep(5 * (attempt + 1)); continue
            if r.status_code == 404:
                return None
            r.raise_for_status()
            return r.json()
        except requests.RequestException:
            time.sleep(3 * (attempt + 1))
    return None


def day_events(sport, day):
    """Events commencing within [day 06:00 UTC, day+1 06:00) seen at day 06:00 snapshot
    plus the 23:00 snapshot (late-added games)."""
    seen = {}
    for hh in ("06:00:00", "23:00:00"):
        j = get(f"https://api.the-odds-api.com/v4/historical/sports/{SPORT_KEY[sport]}/events",
                {"date": f"{day}T{hh}Z"})
        for e in (j or {}).get("data", []):
            ct = e.get("commence_time", "")
            if f"{day}T06" <= ct < (datetime.fromisoformat(day) + timedelta(days=1)).strftime("%Y-%m-%dT06"):
                seen[e["id"]] = e
    return list(seen.values())


def probe(sport, ev):
    """Snapshot the halftime ladder; return raw quote rows with fresh-only flag."""
    rows = []
    ko = datetime.fromisoformat(ev["commence_time"].replace("Z", "+00:00"))
    for mins in LADDER[sport]:
        ts = (ko + timedelta(minutes=mins)).strftime("%Y-%m-%dT%H:%M:%SZ")
        j = get(f"https://api.the-odds-api.com/v4/historical/sports/{SPORT_KEY[sport]}"
                f"/events/{ev['id']}/odds",
                {"regions": "us", "markets": MARKETS, "oddsFormat": "american", "date": ts})
        if not j or not j.get("data"):
            continue
        snap = j.get("timestamp")
        snap_dt = datetime.fromisoformat(snap.replace("Z", "+00:00"))
        for bk in j["data"].get("bookmakers", []):
            for m in bk.get("markets", []):
                lu = m.get("last_update")
                fresh = False
                if lu:
                    lu_dt = datetime.fromisoformat(lu.replace("Z", "+00:00"))
                    fresh = abs((snap_dt - lu_dt).total_seconds()) <= FRESH_SEC
                for o in m.get("outcomes", []):
                    rows.append(dict(
                        sport=sport, event_id=ev["id"], home=ev["home_team"],
                        away=ev["away_team"], commence=ev["commence_time"],
                        probe_min=mins, snap_ts=snap, book=bk["key"], market=m["key"],
                        name=o["name"], point=o.get("point"), price=o.get("price"),
                        last_update=lu, fresh=fresh))
    return rows


def main():
    sport, start, end = sys.argv[1], sys.argv[2], sys.argv[3]
    assert sport in SPORT_KEY
    raw_path = os.path.join(DATA, f"{sport}_2h_raw.parquet")
    ck_path = os.path.join(DATA, f"{sport}_done.json")
    done = set(json.load(open(ck_path))) if os.path.exists(ck_path) else set()

    day = datetime.fromisoformat(start)
    endd = datetime.fromisoformat(end)
    buf, n_ev, n_hit = [], 0, 0
    while day <= endd:
        ds = day.strftime("%Y-%m-%d")
        if day.weekday() in GAME_DOW[sport]:
            for ev in day_events(sport, ds):
                if ev["id"] in done:
                    continue
                rows = probe(sport, ev)
                done.add(ev["id"]); n_ev += 1
                if any(r["fresh"] for r in rows):
                    n_hit += 1
                buf.extend(rows)
                if len(buf) >= 4000:
                    df = pd.DataFrame(buf)
                    if os.path.exists(raw_path):
                        df = pd.concat([pd.read_parquet(raw_path), df], ignore_index=True)
                    df.to_parquet(raw_path, index=False)
                    json.dump(sorted(done), open(ck_path, "w"))
                    buf = []
            print(f"{ds}: cum events {n_ev}, with live 2H {n_hit}, quota {_quota[0]}", flush=True)
        day += timedelta(days=1)
    if buf:
        df = pd.DataFrame(buf)
        if os.path.exists(raw_path):
            df = pd.concat([pd.read_parquet(raw_path), df], ignore_index=True)
        df.to_parquet(raw_path, index=False)
    json.dump(sorted(done), open(ck_path, "w"))
    print(f"DONE {sport} {start}->{end}: {n_ev} events, {n_hit} with live 2H "
          f"({100*n_hit/max(n_ev,1):.0f}%), quota left {_quota[0]}")


if __name__ == "__main__":
    main()
