"""Parse cached props snapshots -> rows for nfl_player_props.

Name matching is roster-scoped: candidate pool = players who logged offensive
stats for either team that season (player_offense), joined to xwalk name
variants (display/football/first+last). Unmatched names are logged, never
guessed. Output: data/props_rows.parquet + per-season CSVs for bulk load.

Usage: python3 props_parse.py
"""
import json, re, sys
from collections import Counter
from pathlib import Path

import pandas as pd

ROOT = Path(__file__).resolve().parent
CACHE = ROOT / "data" / "props_snapshots"

SKIP_PATTERNS = re.compile(r"(d/st|defense|special teams|no touchdown)", re.I)
SUFFIXES = re.compile(r"\s+(jr|sr|ii|iii|iv|v)\.?$", re.I)


def norm(name):
    s = SUFFIXES.sub("", name.lower().strip())
    return re.sub(r"[^a-z ]", "", s).strip()


def build_rosters():
    """(season, team) -> {normalized name variant: (gsis_id, position)}"""
    po = pd.read_parquet(ROOT / "data" / "player_offense.parquet")
    po = po[po.season.isin([2024, 2025])]
    xw = pd.read_parquet(ROOT / "data" / "players_xwalk.parquet")
    xw = xw.set_index("gsis_id")

    rosters = {}
    for (season, team), grp in po.groupby(["season", "team"]):
        d = {}
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
                if v in d and d[v][0] != pid:
                    d[v] = None  # ambiguous within roster -> never match
                elif v not in d or d[v] is None:
                    d.setdefault(v, (pid, pos))
        rosters[(season, team)] = d
    return rosters


def main():
    rosters = build_rosters()
    files = sorted(CACHE.glob("20*/*.json"))
    print(f"snapshot files: {len(files)}")

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
                if v in pool and pool[v][0] != hit[0]:
                    pool[v] = None  # same name on both teams -> ambiguous
                elif v not in pool or pool[v] is None:
                    pool.setdefault(v, (*hit, team))
        team_of = {}  # pid -> team for this matchup
        for v, hit in pool.items():
            if hit:
                team_of[hit[0]] = hit[2]

        def match(name):
            hit = pool.get(norm(name))
            return hit if hit else None

        for bk in data["bookmakers"]:
            for m in bk["markets"]:
                mkt = m["key"]
                if mkt == "player_anytime_td":
                    for o in m["outcomes"]:
                        player = o.get("description") or o["name"]
                        if SKIP_PATTERNS.search(player):
                            continue
                        hit = match(player)
                        if not hit:
                            unmatched[(season, player)] += 1
                            continue
                        rows.append((eid, game_date, season, week, bk["key"], mkt, player,
                                     hit[0], hit[1], None, o["price"], None, ht, at,
                                     data["commence_time"], snap, hit[2]))
                else:
                    pair = {}
                    for o in m["outcomes"]:
                        pair.setdefault((o.get("description"), o.get("point")), {})[o["name"]] = o["price"]
                    for (player, point), sides in pair.items():
                        if not player or SKIP_PATTERNS.search(player):
                            continue
                        hit = match(player)
                        if not hit:
                            unmatched[(season, player)] += 1
                            continue
                        rows.append((eid, game_date, season, week, bk["key"], mkt, player,
                                     hit[0], hit[1], point, sides.get("Over"), sides.get("Under"),
                                     ht, at, data["commence_time"], snap, hit[2]))

    cols = ["event_id", "game_date", "season", "week", "bookmaker", "market", "player_name",
            "player_id", "position", "line", "over_odds", "under_odds", "home_team",
            "away_team", "commence_time", "snapshot_time", "team"]
    df = pd.DataFrame(rows, columns=cols)
    # same (book,market,player,line,snapshot) can repeat if requested snaps resolved
    # to the same underlying API snapshot -> keep one
    df = df.drop_duplicates(subset=["event_id", "bookmaker", "market", "player_name", "line", "snapshot_time"])
    df.to_parquet(ROOT / "data" / "props_rows.parquet", index=False)
    for season, grp in df.groupby("season"):
        grp.to_csv(ROOT / "data" / f"props_rows_{season}.csv", index=False)
    print(f"rows: {len(df):,}  players: {df.player_id.nunique()}  "
          f"events: {df.event_id.nunique()}  snapshots: {df.snapshot_time.nunique()}")
    print(df.market.value_counts().to_string())
    if unmatched:
        top = unmatched.most_common(40)
        print(f"\nUNMATCHED names ({len(unmatched)} unique, {sum(unmatched.values())} occurrences) top 40:")
        for (season, name), n in top:
            print(f"  {season} {name}: {n}")
        pd.DataFrame([(s, n, c) for (s, n), c in unmatched.items()],
                     columns=["season", "name", "count"]).to_csv(ROOT / "data" / "props_unmatched.csv", index=False)


if __name__ == "__main__":
    main()
