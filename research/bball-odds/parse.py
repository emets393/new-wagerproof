#!/usr/bin/env python3
"""Parse raw backfill JSON (data/{grid,h1tt,props}) into tidy parquet tables.

Outputs to data/parquet/:
  grid_{sport}_{season}.parquet   one row per snapshot x event x book (FG h2h/spread/total)
  h1tt_{sport}_{season}.parquet   one row per event x book (1H markets + team totals, T-60 close)
  props_nba_{season}.parquet      one row per event x book x market x player (T-60 close)

All prices are American odds. Spread points are from the HOME team's perspective.
In-play grid rows (commence_time <= snapshot time) are dropped per README notes.
"""
import argparse
import glob
import gzip
import json
import os
import sys

import pandas as pd

ROOT = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(ROOT, "data", "parquet")


def load(path):
    with gzip.open(path, "rt") as f:
        return json.load(f)


def write(rows, name):
    os.makedirs(OUT, exist_ok=True)
    df = pd.DataFrame(rows)
    for c in df.columns:
        if c.endswith("_price") or c.endswith("_point"):
            df[c] = df[c].astype("float32")
    path = os.path.join(OUT, f"{name}.parquet")
    df.to_parquet(path, index=False)
    print(f"  {name}: {len(df):,} rows -> {path}", flush=True)


def market_map(bookmaker):
    return {m["key"]: m["outcomes"] for m in bookmaker.get("markets", [])}


def two_way(outcomes, home, away):
    """h2h/spread outcomes keyed by team name -> (home_outcome, away_outcome)."""
    by_name = {o["name"]: o for o in outcomes}
    return by_name.get(home), by_name.get(away)


def over_under(outcomes):
    by_name = {o["name"]: o for o in outcomes}
    return by_name.get("Over"), by_name.get("Under")


def parse_grid(sport, season):
    rows = []
    files = sorted(glob.glob(f"{ROOT}/data/grid/{sport}/{season}/*.json.gz"))
    for path in files:
        snap = load(path)
        if snap.get("__unavailable__"):
            continue
        snap_ts = snap["timestamp"]
        for ev in snap.get("data", []):
            # In-play rows creep into snapshots — pregame only
            if ev["commence_time"] <= snap_ts:
                continue
            for bk in ev.get("bookmakers", []):
                m = market_map(bk)
                row = {
                    "snap_ts": snap_ts,
                    "event_id": ev["id"],
                    "commence_time": ev["commence_time"],
                    "home_team": ev["home_team"],
                    "away_team": ev["away_team"],
                    "book": bk["key"],
                }
                if "h2h" in m:
                    h, a = two_way(m["h2h"], ev["home_team"], ev["away_team"])
                    row["ml_home_price"] = h and h.get("price")
                    row["ml_away_price"] = a and a.get("price")
                if "spreads" in m:
                    h, a = two_way(m["spreads"], ev["home_team"], ev["away_team"])
                    row["spread_home_point"] = h and h.get("point")
                    row["spread_home_price"] = h and h.get("price")
                    row["spread_away_price"] = a and a.get("price")
                if "totals" in m:
                    o, u = over_under(m["totals"])
                    row["total_point"] = o and o.get("point")
                    row["total_over_price"] = o and o.get("price")
                    row["total_under_price"] = u and u.get("price")
                rows.append(row)
    write(rows, f"grid_{sport}_{season}")


def parse_h1tt(sport, season):
    rows = []
    files = sorted(glob.glob(f"{ROOT}/data/h1tt/{sport}/{season}/*.json.gz"))
    for path in files:
        js = load(path)
        if js.get("__unavailable__"):
            continue
        ev = js.get("data")
        if not ev or not ev.get("bookmakers"):
            continue
        snap_ts = js["timestamp"]
        home, away = ev["home_team"], ev["away_team"]
        for bk in ev["bookmakers"]:
            m = market_map(bk)
            row = {
                "snap_ts": snap_ts,
                "event_id": ev["id"],
                "commence_time": ev["commence_time"],
                "home_team": home,
                "away_team": away,
                "book": bk["key"],
            }
            if "h2h_h1" in m:
                h, a = two_way(m["h2h_h1"], home, away)
                row["h1_ml_home_price"] = h and h.get("price")
                row["h1_ml_away_price"] = a and a.get("price")
            if "spreads_h1" in m:
                h, a = two_way(m["spreads_h1"], home, away)
                row["h1_spread_home_point"] = h and h.get("point")
                row["h1_spread_home_price"] = h and h.get("price")
                row["h1_spread_away_price"] = a and a.get("price")
            if "totals_h1" in m:
                o, u = over_under(m["totals_h1"])
                row["h1_total_point"] = o and o.get("point")
                row["h1_total_over_price"] = o and o.get("price")
                row["h1_total_under_price"] = u and u.get("price")
            if "team_totals" in m:
                # outcomes: name=Over/Under, description=team name
                for side, team in (("home", home), ("away", away)):
                    o = next((x for x in m["team_totals"]
                              if x["name"] == "Over" and x.get("description") == team), None)
                    u = next((x for x in m["team_totals"]
                              if x["name"] == "Under" and x.get("description") == team), None)
                    row[f"tt_{side}_point"] = o and o.get("point")
                    row[f"tt_{side}_over_price"] = o and o.get("price")
                    row[f"tt_{side}_under_price"] = u and u.get("price")
            rows.append(row)
    write(rows, f"h1tt_{sport}_{season}")


def parse_props(season):
    rows = []
    files = sorted(glob.glob(f"{ROOT}/data/props/nba/{season}/*.json.gz"))
    for path in files:
        js = load(path)
        if js.get("__unavailable__"):
            continue
        ev = js.get("data")
        if not ev or not ev.get("bookmakers"):
            continue
        snap_ts = js["timestamp"]
        for bk in ev["bookmakers"]:
            for mkt in bk.get("markets", []):
                # Pair Over/Under per (player, point); alt lines stay separate rows
                paired = {}
                for o in mkt["outcomes"]:
                    key = (o.get("description"), o.get("point"))
                    paired.setdefault(key, {})[o["name"]] = o.get("price")
                for (player, point), sides in paired.items():
                    rows.append({
                        "snap_ts": snap_ts,
                        "event_id": ev["id"],
                        "commence_time": ev["commence_time"],
                        "home_team": ev["home_team"],
                        "away_team": ev["away_team"],
                        "book": bk["key"],
                        "market": mkt["key"],
                        "player": player,
                        "line_point": point,
                        "over_price": sides.get("Over"),
                        "under_price": sides.get("Under"),
                    })
    write(rows, f"props_nba_{season}")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("what", choices=["grid", "h1tt", "props", "all"])
    ap.add_argument("--sport", choices=["nba", "ncaab"])
    ap.add_argument("--season")
    args = ap.parse_args()

    def seasons(dataset, sport):
        return sorted(os.path.basename(p) for p in glob.glob(f"{ROOT}/data/{dataset}/{sport}/*"))

    if args.what in ("grid", "all"):
        for sport in ([args.sport] if args.sport else ["nba", "ncaab"]):
            for season in ([args.season] if args.season else seasons("grid", sport)):
                print(f"[grid {sport} {season}]", flush=True)
                parse_grid(sport, season)
    if args.what in ("h1tt", "all"):
        for sport in ([args.sport] if args.sport else ["nba", "ncaab"]):
            for season in ([args.season] if args.season else seasons("h1tt", sport)):
                print(f"[h1tt {sport} {season}]", flush=True)
                parse_h1tt(sport, season)
    if args.what in ("props", "all"):
        for season in ([args.season] if args.season else seasons("props", "nba")):
            print(f"[props nba {season}]", flush=True)
            parse_props(season)
    print("PARSE COMPLETE", flush=True)


if __name__ == "__main__":
    main()
