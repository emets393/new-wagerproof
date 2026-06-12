"""Parse cached 1H + team-total snapshots into rows for nfl_historical_odds.

Output: data/h1tt_rows.parquet, one row per (season, snap_ts, game, book) with
the 15 new columns. Keyed by city-style team names + snap_ts exactly as stored
in nfl_historical_odds so the merge is a straight join.
"""
import json
from pathlib import Path

import pandas as pd

ROOT = Path(__file__).resolve().parent
CACHE = ROOT / "data" / "h1tt_snapshots"

# Odds API full names -> city-style names used in nfl_historical_odds
FULL2CITY = {
    "Arizona Cardinals": "Arizona", "Atlanta Falcons": "Atlanta",
    "Baltimore Ravens": "Baltimore", "Buffalo Bills": "Buffalo",
    "Carolina Panthers": "Carolina", "Chicago Bears": "Chicago",
    "Cincinnati Bengals": "Cincinnati", "Cleveland Browns": "Cleveland",
    "Dallas Cowboys": "Dallas", "Denver Broncos": "Denver",
    "Detroit Lions": "Detroit", "Green Bay Packers": "Green Bay",
    "Houston Texans": "Houston", "Indianapolis Colts": "Indianapolis",
    "Jacksonville Jaguars": "Jacksonville", "Kansas City Chiefs": "Kansas City",
    "Los Angeles Chargers": "LA Chargers", "Los Angeles Rams": "LA Rams",
    "Las Vegas Raiders": "Las Vegas", "Miami Dolphins": "Miami",
    "Minnesota Vikings": "Minnesota", "New York Giants": "NY Giants",
    "New York Jets": "NY Jets", "New England Patriots": "New England",
    "New Orleans Saints": "New Orleans", "Philadelphia Eagles": "Philadelphia",
    "Pittsburgh Steelers": "Pittsburgh", "San Francisco 49ers": "San Francisco",
    "Seattle Seahawks": "Seattle", "Tampa Bay Buccaneers": "Tampa Bay",
    "Tennessee Titans": "Tennessee", "Washington Commanders": "Washington",
}

COLS = ["h1_spread_home", "h1_spread_home_price", "h1_spread_away",
        "h1_spread_away_price", "h1_total_point", "h1_total_over_price",
        "h1_total_under_price", "h1_ml_home", "h1_ml_away",
        "tt_home_point", "tt_home_over_price", "tt_home_under_price",
        "tt_away_point", "tt_away_over_price", "tt_away_under_price"]


def parse_book(mkts, home_full, away_full):
    row = {}
    for m in mkts:
        out = m["outcomes"]
        if m["key"] == "spreads_h1":
            for o in out:
                side = "home" if o["name"] == home_full else "away"
                row[f"h1_spread_{side}"] = o.get("point")
                row[f"h1_spread_{side}_price"] = o.get("price")
        elif m["key"] == "totals_h1":
            for o in out:
                if o["name"] == "Over":
                    row["h1_total_point"] = o.get("point")
                    row["h1_total_over_price"] = o.get("price")
                else:
                    row["h1_total_under_price"] = o.get("price")
        elif m["key"] == "h2h_h1":
            for o in out:
                side = "home" if o["name"] == home_full else "away"
                row[f"h1_ml_{side}"] = o.get("price")
        elif m["key"] == "team_totals":
            for o in out:
                side = "home" if o.get("description") == home_full else "away"
                if o["name"] == "Over":
                    row[f"tt_{side}_point"] = o.get("point")
                    row[f"tt_{side}_over_price"] = o.get("price")
                else:
                    row[f"tt_{side}_under_price"] = o.get("price")
    return row


def main():
    rows = []
    files = misses = 0
    for season_dir in sorted(CACHE.iterdir()):
        if not season_dir.is_dir():
            continue
        season = int(season_dir.name)
        for fn in sorted(season_dir.glob("*.json")):
            files += 1
            p = json.loads(fn.read_text())
            d = p.get("data")
            if not d:
                misses += 1
                continue
            snap_ts = p["timestamp"].replace("Z", "+00:00")
            home, away = FULL2CITY[d["home_team"]], FULL2CITY[d["away_team"]]
            for bk in d.get("bookmakers", []):
                row = parse_book(bk["markets"], d["home_team"], d["away_team"])
                if not row:
                    continue
                rows.append({"season": season, "snap_ts": snap_ts,
                             "commence_time": d["commence_time"],
                             "home_team": home, "away_team": away,
                             "book": bk["key"], **row})
    df = pd.DataFrame(rows)
    for c in COLS:
        if c not in df.columns:
            df[c] = pd.NA
    df = df[["season", "snap_ts", "commence_time", "home_team", "away_team",
             "book"] + COLS]
    key = ["season", "snap_ts", "home_team", "away_team", "book"]
    dupes = df.duplicated(key).sum()
    if dupes:
        print(f"WARNING: {dupes} duplicate keys — keeping last")
        df = df.drop_duplicates(key, keep="last")
    df.to_parquet(ROOT / "data" / "h1tt_rows.parquet", index=False)
    print(f"files={files} misses={misses} rows={len(df):,}")
    print(df.groupby("season").agg(rows=("book", "size"),
                                   snaps=("snap_ts", "nunique"),
                                   books=("book", "nunique")))
    print("\nnon-null coverage:")
    print(df[COLS].notna().mean().round(3))


if __name__ == "__main__":
    main()
