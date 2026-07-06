"""Parse the extra-market snapshots (data/props_snapshots_extra/) -> nfl_player_props.

Markets: player_pass_attempts, player_pass_completions, player_rush_attempts — all
over/under line markets. Roster-scoped name matching (same as the original props_parse:
candidate pool = players who logged offensive stats for either team that season, via
players_xwalk name variants; unmatched names logged, never guessed).

Idempotent: deletes those three markets for the parsed seasons, then bulk-inserts.

Usage:  python3 props_parse_extra.py            # parse + load
        python3 props_parse_extra.py --no-load  # parse -> parquet only
"""
import argparse
import json
import math
import re
import sys
from collections import Counter
from pathlib import Path

import pandas as pd
import requests

ROOT = Path(__file__).resolve().parent
DATA = ROOT / "data"
CACHE = DATA / "props_snapshots_extra"
URL = "https://jpxnjuwglavsjbgbasnl.supabase.co/rest/v1"
MARKETS = {"player_pass_attempts", "player_pass_completions", "player_rush_attempts"}
BATCH = 5000
SKIP = re.compile(r"(d/st|defense|special teams)", re.I)
SUFFIXES = re.compile(r"\s+(jr|sr|ii|iii|iv|v)\.?$", re.I)


def norm(name):
    s = SUFFIXES.sub("", name.lower().strip())
    return re.sub(r"[^a-z ]", "", s).strip()


def load_key():
    for line in (ROOT.parent.parent / ".env.local").read_text().splitlines():
        if line.startswith("SUPABASE_SERVICE_KEY="):
            return line.split("=", 1)[1].strip()
    sys.exit("SUPABASE_SERVICE_KEY not found in .env.local")


def build_rosters():
    po = pd.read_parquet(DATA / "player_offense.parquet")
    po = po[po.season.isin([2024, 2025])]
    xw = pd.read_parquet(DATA / "players_xwalk.parquet").set_index("gsis_id")
    rosters = {}
    for (season, team), grp in po.groupby(["season", "team"]):
        d = {}
        for pid in grp.player_id.unique():
            pos = grp[grp.player_id == pid].position.iloc[-1]
            variants = set()
            if pid in xw.index:
                r = xw.loc[pid]
                for v in (r.display_name, f"{r.football_name} {r.last_name}",
                          f"{r.first_name} {r.last_name}", f"{r.common_first_name} {r.last_name}"):
                    if isinstance(v, str) and v.strip():
                        variants.add(norm(v))
                if isinstance(r.position, str):
                    pos = r.position
            for v in variants:
                if v in d and d[v] is not None and d[v][0] != pid:
                    d[v] = None
                elif v not in d or d[v] is None:
                    d.setdefault(v, (pid, pos))
        rosters[(season, team)] = d
    return rosters


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--no-load", action="store_true")
    args = ap.parse_args()

    rosters = build_rosters()
    files = sorted(CACHE.glob("20*/*.json"))
    print(f"extra snapshot files: {len(files)}")
    rows, unmatched = [], Counter()
    for f in files:
        game_id, eid, ts = f.stem.split("__")
        season, week, away, home = game_id.split("_", 3)
        season, week = int(season), int(week)
        payload = json.loads(f.read_text())
        data = payload.get("data")
        if not data or not data.get("bookmakers"):
            continue
        snap = payload.get("timestamp") or f"{ts[:4]}-{ts[4:6]}-{ts[6:8]}T{ts[9:11]}:{ts[11:13]}:00Z"
        game_date = data["commence_time"][:10]
        ht, at = data["home_team"], data["away_team"]

        pool = {}
        for team in (away, home):
            for v, hit in rosters.get((season, team), {}).items():
                if hit is None:
                    continue
                if v in pool and pool[v] is not None and pool[v][0] != hit[0]:
                    pool[v] = None
                elif v not in pool or pool[v] is None:
                    pool.setdefault(v, (*hit, team))

        for bk in data["bookmakers"]:
            for m in bk["markets"]:
                if m["key"] not in MARKETS:
                    continue
                pair = {}
                for o in m["outcomes"]:
                    pair.setdefault((o.get("description"), o.get("point")), {})[o["name"]] = o["price"]
                for (player, point), sides in pair.items():
                    if not player or SKIP.search(player):
                        continue
                    hit = pool.get(norm(player))
                    if not hit:
                        unmatched[(season, player)] += 1
                        continue
                    rows.append((eid, game_date, season, week, bk["key"], m["key"], player,
                                 hit[0], hit[1], point, sides.get("Over"), sides.get("Under"),
                                 ht, at, data["commence_time"], snap, hit[2]))

    cols = ["event_id", "game_date", "season", "week", "bookmaker", "market", "player_name",
            "player_id", "position", "line", "over_odds", "under_odds", "home_team",
            "away_team", "commence_time", "snapshot_time", "team"]
    df = pd.DataFrame(rows, columns=cols).drop_duplicates(
        subset=["event_id", "bookmaker", "market", "player_name", "line", "snapshot_time"])
    df.to_parquet(DATA / "props_rows_extra.parquet", index=False)
    print(f"rows: {len(df):,} | players: {df.player_id.nunique()} | markets: {df.market.value_counts().to_dict()}")
    if unmatched:
        print(f"unmatched names: {len(unmatched)} unique (top: {[n for (_, n), _ in unmatched.most_common(6)]})")
    if args.no_load or df.empty:
        return

    key = load_key()
    hdr = {"apikey": key, "Authorization": f"Bearer {key}",
           "Content-Type": "application/json", "Prefer": "return=minimal"}

    def req(method, url, **kw):                           # retry transient network errors
        import time
        for attempt in range(5):
            try:
                r = requests.request(method, url, headers=hdr, timeout=120, **kw)
            except requests.exceptions.RequestException:
                time.sleep(3 * (attempt + 1)); continue
            if r.status_code >= 500 or r.status_code == 429:
                time.sleep(3 * (attempt + 1)); continue
            return r
        sys.exit(f"{method} {url} failed after retries")

    for mkt in MARKETS:                                   # idempotent: clear then insert
        req("DELETE", f"{URL}/nfl_player_props?market=eq.{mkt}")
    for c in ("season", "week", "over_odds", "under_odds"):  # american odds are INT columns
        df[c] = df[c].astype("Int64")
    recs = json.loads(df.to_json(orient="records"))
    for b in range(math.ceil(len(recs) / BATCH)):
        chunk = recs[b * BATCH:(b + 1) * BATCH]
        r = req("POST", f"{URL}/nfl_player_props", data=json.dumps(chunk))
        if r.status_code not in (200, 201):
            sys.exit(f"batch {b} failed {r.status_code}: {r.text[:300]}")
    print(f"loaded {len(recs):,} rows -> nfl_player_props (3 new markets)")


if __name__ == "__main__":
    main()
