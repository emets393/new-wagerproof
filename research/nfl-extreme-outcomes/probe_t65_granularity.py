"""Probe: does the Odds API have a usable T-65 historical snapshot for the
ADDITIONAL markets (h1/team-total) back in 2023? Decides if the actionable-close
backfill is viable. Costs only a handful of credits (a few per-event calls).

For one 2023 game it requests snapshots at T-65 and T-120 before kickoff and
reports (a) requested vs returned snapshot timestamp = granularity, and
(b) bookmaker/market counts = coverage. Read .env.local key, never prints it.
"""
import json, sys, time
from datetime import timezone
from pathlib import Path

import pandas as pd
import requests

ROOT = Path(__file__).resolve().parent
EVENTS_CACHE = ROOT / "data" / "props_snapshots" / "events"
BASE = "https://api.the-odds-api.com/v4/historical/sports/americanfootball_nfl"
ADDL_MARKETS = "spreads_h1,totals_h1,h2h_h1,team_totals"
FEAT_MARKETS = "spreads,totals,h2h"

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
CITY_NAMES = {
    "Arizona": "ARI", "Atlanta": "ATL", "Baltimore": "BAL", "Buffalo": "BUF",
    "Carolina": "CAR", "Chicago": "CHI", "Cincinnati": "CIN", "Cleveland": "CLE",
    "Dallas": "DAL", "Denver": "DEN", "Detroit": "DET", "Green Bay": "GB",
    "Houston": "HOU", "Indianapolis": "IND", "Jacksonville": "JAX", "Kansas City": "KC",
    "LA Chargers": "LAC", "LA Rams": "LA", "Las Vegas": "LV", "Miami": "MIA",
    "Minnesota": "MIN", "NY Giants": "NYG", "NY Jets": "NYJ", "New England": "NE",
    "New Orleans": "NO", "Philadelphia": "PHI", "Pittsburgh": "PIT", "San Francisco": "SF",
    "Seattle": "SEA", "Tampa Bay": "TB", "Tennessee": "TEN", "Washington": "WAS"}


def load_key():
    for line in (ROOT.parent.parent / ".env.local").read_text().splitlines():
        if line.startswith("ODDS_API_KEY="):
            return line.split("=", 1)[1].strip()
    sys.exit("ODDS_API_KEY not found in .env.local")


def iso(dt):
    return dt.astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def get(key, url, params):
    params = {**params, "apiKey": key}
    for attempt in range(5):
        r = requests.get(url, params=params, timeout=30)
        if r.status_code == 429:
            time.sleep(5 * (attempt + 1)); continue
        rem = r.headers.get("x-requests-remaining")
        if r.status_code in (404, 422):
            return None, rem
        r.raise_for_status()
        return r.json(), rem
    raise RuntimeError("rate-limited")


def main():
    key = load_key()
    d = pd.read_parquet(ROOT / "data" / "odds_hist.parquet")
    d["snap_dt"] = pd.to_datetime(d.snap_ts, utc=True, format="ISO8601")
    d["comm"] = pd.to_datetime(d.commence_time, utc=True, format="ISO8601")
    d["gameday"] = d.comm.dt.tz_convert("America/New_York").dt.strftime("%Y-%m-%d")
    d["home_ab"] = d.home_team.map(CITY_NAMES); d["away_ab"] = d.away_team.map(CITY_NAMES)
    d23 = d[(d.season == 2023) & d.h1_total_point.notna()].copy()

    # pick a game whose gameday events cache already exists (no extra events call)
    chosen = None
    for (gd, ha, aa), grp in d23.groupby(["gameday", "home_ab", "away_ab"]):
        if (EVENTS_CACHE / f"{gd}.json").exists():
            chosen = (gd, ha, aa, grp.comm.mode().iloc[0]); break
    if chosen is None:
        # fall back to first game; we'll make one events call
        g0 = d23.groupby(["gameday", "home_ab", "away_ab"]).comm.agg(lambda s: s.mode().iloc[0]).reset_index().iloc[0]
        chosen = (g0.gameday, g0.home_ab, g0.away_ab, g0.comm)
    gd, ha, aa, comm = chosen
    print(f"probe game: {aa}@{ha}  gameday={gd}  kickoff(UTC)={iso(comm)}")

    # resolve event id from cache (or one events call)
    cf = EVENTS_CACHE / f"{gd}.json"
    if cf.exists():
        payload = json.loads(cf.read_text())
    else:
        payload, rem = get(key, f"{BASE}/events",
                           {"date": f"{gd}T11:00:00Z",
                            "commenceTimeFrom": f"{gd}T00:00:00Z",
                            "commenceTimeTo": f"{gd}T23:59:59Z"})
    eid = None
    for ev in (payload or {}).get("data", []):
        if TEAM_NAMES.get(ev["home_team"]) == ha and TEAM_NAMES.get(ev["away_team"]) == aa:
            eid = ev["id"]; break
    if not eid:
        sys.exit("could not resolve event id for probe game")
    print(f"event_id resolved: {eid}\n")

    for label, mins in [("T-65", 65), ("T-120", 120)]:
        req_ts = comm - pd.Timedelta(minutes=mins)
        for mlabel, markets in [("ADDITIONAL h1/tt", ADDL_MARKETS), ("FEATURED", FEAT_MARKETS)]:
            res, rem = get(key, f"{BASE}/events/{eid}/odds",
                           {"markets": markets, "regions": "us",
                            "oddsFormat": "american", "date": iso(req_ts)})
            if res is None:
                print(f"  {label} {mlabel:18s}: no snapshot (404/422)  remaining={rem}")
                continue
            snap_ts = res.get("timestamp")
            data = res.get("data") or {}
            books = data.get("bookmakers", [])
            mkts = sorted({m["key"] for b in books for m in b.get("markets", [])})
            delta = ""
            if snap_ts:
                sdt = pd.to_datetime(snap_ts, utc=True)
                delta = f" (returned snap is {(comm - sdt).total_seconds()/60:.0f}min pre-kick)"
            print(f"  {label} req={iso(req_ts)}  {mlabel:18s}: snapshot={snap_ts}{delta}")
            print(f"        books={len(books)}  markets={mkts}  remaining={rem}")
        print()
    print("[probe done]")


if __name__ == "__main__":
    main()
