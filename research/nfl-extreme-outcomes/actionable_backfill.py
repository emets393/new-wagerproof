"""Backfill the ACTIONABLE-CLOSE line: one snapshot per game at T-65 and T-120
before kickoff, 2023-25, all FG+1H+TT markets. Parses straight into the
odds_hist column schema -> data/odds_hist_t65.parquet / _t120.parquet so the
reval can treat these as the new 'close' snapshot (open stays from odds_hist).

Resumable: raw JSON cached under data/actionable_snapshots/<cutoff>/. Reads
ODDS_API_KEY from .env.local (never printed).

Usage:
  python3 actionable_backfill.py --dry-run        # game/credit estimate
  python3 actionable_backfill.py --test           # one game, both cutoffs
  python3 actionable_backfill.py                  # full run, then writes parquets
"""
import argparse, json, sys, time
from datetime import datetime, timedelta, timezone
from pathlib import Path

import pandas as pd
import requests

ROOT = Path(__file__).resolve().parent
DATA = ROOT / "data"
CACHE = DATA / "actionable_snapshots"
EVENTS_CACHE = DATA / "props_snapshots" / "events"
BASE = "https://api.the-odds-api.com/v4/historical/sports/americanfootball_nfl"
MARKETS = "spreads,totals,h2h,spreads_h1,totals_h1,h2h_h1,team_totals"
CUTOFFS = {"t65": 65, "t120": 120}

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


def build_games():
    """One row per (season, ET gameday, home, away) + modal commence_time."""
    d = pd.read_parquet(DATA / "odds_hist.parquet")
    d["comm"] = pd.to_datetime(d.commence_time, utc=True, format="ISO8601")
    d["gameday"] = d.comm.dt.tz_convert("America/New_York").dt.strftime("%Y-%m-%d")
    g = (d.groupby(["season", "gameday", "home_team", "away_team"])
         .comm.agg(lambda s: s.mode().iloc[0]).reset_index())
    g["home_ab"] = g.home_team.map(CITY_NAMES)
    g["away_ab"] = g.away_team.map(CITY_NAMES)
    g = g[g.home_ab.notna() & g.away_ab.notna()].copy()
    g["game_key"] = g.gameday + "_" + g.away_ab + "@" + g.home_ab
    return g.sort_values(["season", "gameday", "game_key"]).reset_index(drop=True)


class Fetcher:
    def __init__(self, key):
        self.key, self.calls, self.remaining = key, 0, None
        self.sess = requests.Session()

    def get(self, url, params):
        params = {**params, "apiKey": self.key}
        for attempt in range(5):
            r = self.sess.get(url, params=params, timeout=30)
            if r.status_code == 429:
                time.sleep(5 * (attempt + 1)); continue
            self.calls += 1
            if "x-requests-remaining" in r.headers:
                self.remaining = r.headers["x-requests-remaining"]
            if r.status_code in (404, 422):
                return None
            r.raise_for_status()
            time.sleep(0.12)
            return r.json()
        raise RuntimeError(f"rate-limited 5x: {url}")


def map_event_ids(fetcher, games):
    EVENTS_CACHE.mkdir(parents=True, exist_ok=True)
    mapping, unmatched = {}, []
    for gameday, grp in games.groupby("gameday"):
        cf = EVENTS_CACHE / f"{gameday}.json"
        if cf.exists():
            payload = json.loads(cf.read_text())
        else:
            payload = fetcher.get(f"{BASE}/events", {
                "date": f"{gameday}T11:00:00Z",
                "commenceTimeFrom": f"{gameday}T00:00:00Z",
                "commenceTimeTo": (datetime.strptime(gameday, "%Y-%m-%d")
                                   + timedelta(days=1)).strftime("%Y-%m-%dT12:00:00Z")})
            if payload is None:
                continue
            cf.write_text(json.dumps(payload))
        by_teams = {}
        for ev in payload.get("data", []):
            h, a = TEAM_NAMES.get(ev["home_team"]), TEAM_NAMES.get(ev["away_team"])
            if h and a:
                by_teams[(a, h)] = ev["id"]
        for _, gg in grp.iterrows():
            eid = by_teams.get((gg.away_ab, gg.home_ab))
            (mapping.__setitem__(gg.game_key, eid) if eid else unmatched.append(gg))
    for gg in unmatched:
        d0 = datetime.strptime(gg.gameday, "%Y-%m-%d")
        for off in (-1, 1, -2, 2):
            sib = f"{(d0 + timedelta(days=off)).strftime('%Y-%m-%d')}_{gg.away_ab}@{gg.home_ab}"
            if sib in mapping:
                mapping[gg.game_key] = mapping[sib]; break
    return mapping


def parse_snapshot(payload, season, comm, home_team, away_team, home_ab, away_ab):
    """Odds API per-event payload -> one odds_hist-schema row per bookmaker."""
    data = payload.get("data") or {}
    snap_ts = payload.get("timestamp")
    home_full = {v: k for k, v in TEAM_NAMES.items()}.get(home_ab)
    away_full = {v: k for k, v in TEAM_NAMES.items()}.get(away_ab)
    rows = []
    for bk in data.get("bookmakers", []):
        row = dict(season=season, snap_ts=snap_ts, commence_time=iso(comm),
                   home_team=home_team, away_team=away_team, book=bk["key"])
        mk = {m["key"]: m["outcomes"] for m in bk.get("markets", [])}

        def find(outs, **kw):
            for o in outs:
                if all(o.get(k) == v for k, v in kw.items()):
                    return o
            return {}

        if "spreads" in mk:
            h = find(mk["spreads"], name=home_full); a = find(mk["spreads"], name=away_full)
            row.update(spread_home=h.get("point"), spread_home_price=h.get("price"),
                       spread_away=a.get("point"), spread_away_price=a.get("price"))
        if "totals" in mk:
            ov = find(mk["totals"], name="Over"); un = find(mk["totals"], name="Under")
            row.update(total_point=ov.get("point"), total_over_price=ov.get("price"),
                       total_under_price=un.get("price"))
        if "h2h" in mk:
            row.update(ml_home=find(mk["h2h"], name=home_full).get("price"),
                       ml_away=find(mk["h2h"], name=away_full).get("price"))
        if "spreads_h1" in mk:
            h = find(mk["spreads_h1"], name=home_full); a = find(mk["spreads_h1"], name=away_full)
            row.update(h1_spread_home=h.get("point"), h1_spread_home_price=h.get("price"),
                       h1_spread_away=a.get("point"), h1_spread_away_price=a.get("price"))
        if "totals_h1" in mk:
            ov = find(mk["totals_h1"], name="Over"); un = find(mk["totals_h1"], name="Under")
            row.update(h1_total_point=ov.get("point"), h1_total_over_price=ov.get("price"),
                       h1_total_under_price=un.get("price"))
        if "h2h_h1" in mk:
            row.update(h1_ml_home=find(mk["h2h_h1"], name=home_full).get("price"),
                       h1_ml_away=find(mk["h2h_h1"], name=away_full).get("price"))
        if "team_totals" in mk:
            ho = find(mk["team_totals"], description=home_full, name="Over")
            hu = find(mk["team_totals"], description=home_full, name="Under")
            ao = find(mk["team_totals"], description=away_full, name="Over")
            au = find(mk["team_totals"], description=away_full, name="Under")
            row.update(tt_home_point=ho.get("point"), tt_home_over_price=ho.get("price"),
                       tt_home_under_price=hu.get("price"),
                       tt_away_point=ao.get("point"), tt_away_over_price=ao.get("price"),
                       tt_away_under_price=au.get("price"))
        rows.append(row)
    return rows


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--test", action="store_true")
    args = ap.parse_args()

    g = build_games()
    print(f"games={len(g)}  cutoffs={list(CUTOFFS)}  "
          f"est calls={len(g)*len(CUTOFFS):,}  est credits~{len(g)*len(CUTOFFS)*70:,} "
          f"(~70/call, 7 markets)", flush=True)
    if args.dry_run:
        return
    if args.test:
        g = g.head(1)

    fetcher = Fetcher(load_key())
    mapping = map_event_ids(fetcher, g)
    print(f"event ids mapped: {len([k for k in mapping if mapping[k]])}/{len(g)}  "
          f"remaining={fetcher.remaining}", flush=True)

    out = {c: [] for c in CUTOFFS}
    done = 0
    t0 = time.time()
    for r in g.itertuples():
        eid = mapping.get(r.game_key)
        if not eid:
            continue
        for cut, mins in CUTOFFS.items():
            cdir = CACHE / cut / str(r.season); cdir.mkdir(parents=True, exist_ok=True)
            fn = cdir / f"{r.game_key}__{eid}.json"
            if fn.exists():
                payload = json.loads(fn.read_text())
            else:
                req_ts = r.comm - pd.Timedelta(minutes=mins)
                payload = fetcher.get(f"{BASE}/events/{eid}/odds",
                                      {"markets": MARKETS, "regions": "us",
                                       "oddsFormat": "american", "date": iso(req_ts)})
                fn.write_text(json.dumps(payload if payload else {"data": None}))
            if payload and payload.get("data"):
                out[cut].extend(parse_snapshot(payload, int(r.season), r.comm,
                                               r.home_team, r.away_team, r.home_ab, r.away_ab))
        done += 1
        if done % 25 == 0 or args.test:
            rate = fetcher.calls / max(time.time() - t0, 1)
            print(f"[{done}/{len(g)}] {r.game_key} calls={fetcher.calls} "
                  f"remaining={fetcher.remaining} ({rate:.1f}/s) "
                  f"rows t65={len(out['t65'])} t120={len(out['t120'])}", flush=True)

    for cut in CUTOFFS:
        df = pd.DataFrame(out[cut])
        path = DATA / f"odds_hist_{cut}.parquet"
        df.to_parquet(path, index=False)
        print(f"WROTE {path}  rows={len(df)}  games={df.groupby(['season','home_team','away_team']).ngroups if len(df) else 0}", flush=True)
    print(f"DONE calls={fetcher.calls} remaining={fetcher.remaining} "
          f"elapsed={time.time()-t0:.0f}s", flush=True)


if __name__ == "__main__":
    main()
