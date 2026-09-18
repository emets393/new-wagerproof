#!/usr/bin/env python3
"""Load Fantasy Points Data cells -> Supabase `fp_data` (CFB warehouse), LEAN.

One row per player-game / team-game per tool+scope, identity columns typed and every
non-null stat field in a `stats` jsonb. Upsert on (tool, scope, season, week, entity_id).

Why lean: the full 2021+ warehouse is ~1M player-game rows x ~80 fields; a bulk jsonb load
of that size is what tripped the Supabase disk into read-only during the MLB props backfill
(memory: mlb-props-odds-backfill). So by default this loads the CURRENT and PRIOR season
only — what the props builder, agents and MCP need in-season — and the parquet files under
data/fpdata/ remain the research copy of everything back to 2021.

Usage:
  python3 fp_load.py                       # seasons {now-1, now}, all tool/scopes on disk
  python3 fp_load.py --seasons 2025-2026 --weeks 1-3 --tools receivingAdvanced
Reads the raw cells (data/fpdata/raw/<tool>/<scope>/<season>_w<week>.json) written by fp_pull.py.
"""
import argparse
import glob
import json
import os
import sys
import time

import requests

HERE = os.path.dirname(os.path.abspath(__file__))
RAW = os.path.join(HERE, "data", "fpdata", "raw")
SUPA = "https://jpxnjuwglavsjbgbasnl.supabase.co/rest/v1/fp_data"
IDENT_PREFIXES = ("game", "player", "team", "opponent")
STAT_PREFIXES = ("playerStats", "teamStats", "opponentStats", "marketShare")


def key():
    for fn in (os.path.join(HERE, "..", "..", ".env.local"), os.path.join(HERE, "..", "..", ".env")):
        if os.path.exists(fn):
            for line in open(fn):
                if line.startswith("SUPABASE_SERVICE_KEY="):
                    return line.split("=", 1)[1].strip()
    k = os.environ.get("SUPABASE_SERVICE_KEY")
    if not k:
        sys.exit("[fp-load] SUPABASE_SERVICE_KEY missing")
    return k


def team_abbrev_map():
    """location+nickname -> abbreviation, learned from any player-scope cell (team-scope rows
    carry no abbreviation column)."""
    m = {}
    for f in glob.glob(os.path.join(RAW, "*", "player", "*.json"))[:40]:
        for r in json.load(open(f)).get("rows", []):
            if r.get("teamAbbreviation") and r.get("teamLocation"):
                m[(r["teamLocation"], r["teamNickname"])] = r["teamAbbreviation"]
        if len(m) >= 32:
            break
    return m


def to_row(tool, scope, season, week, pulled_at, r, abbr):
    stats = {k: v for k, v in r.items()
             if (k.startswith(STAT_PREFIXES) or not k.startswith(IDENT_PREFIXES)) and v is not None}
    # roster filler (defenders/OL in a receiving tool) only carries gamesPlayed + Yes/No labels
    if not any(not (k.endswith("Label") or k.endswith("GamesPlayed")) for k in stats):
        return None
    if scope == "player":
        eid = r.get("playerPlayerId"); name = f"{r.get('playerFirstName') or ''} {r.get('playerLastName') or ''}".strip()
        team = r.get("teamAbbreviation")
    else:
        eid = r.get("teamTeamId"); name = f"{r.get('teamLocation') or ''} {r.get('teamNickname') or ''}".strip()
        team = abbr.get((r.get("teamLocation"), r.get("teamNickname")))
    if eid is None:
        return None
    return dict(tool=tool, scope=scope, season=season, week=week, game_id=r.get("gameGameId"),
                entity_id=str(eid), entity_name=name or None, position=r.get("playerPosition"),
                team=team, team_name=f"{r.get('teamLocation') or ''} {r.get('teamNickname') or ''}".strip() or None,
                opponent=r.get("opponentAbbreviation"), is_home=r.get("teamIsHomeTeam"),
                stats=stats, pulled_at=pulled_at)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--seasons"); ap.add_argument("--weeks"); ap.add_argument("--tools")
    a = ap.parse_args()
    def rng(s, lo, hi):
        if not s: return set(range(lo, hi + 1))
        if "-" in s: x, y = s.split("-"); return set(range(int(x), int(y) + 1))
        return {int(s)}
    now = time.gmtime().tm_year if time.gmtime().tm_mon >= 3 else time.gmtime().tm_year - 1
    seasons = rng(a.seasons, now - 1, now); weeks = rng(a.weeks, 1, 22)
    tools = set(a.tools.split(",")) if a.tools else None
    H = {"apikey": key(), "Authorization": f"Bearer {key()}", "Content-Type": "application/json",
         "Prefer": "resolution=merge-duplicates,return=minimal"}
    abbr = team_abbrev_map()
    files = sorted(glob.glob(os.path.join(RAW, "*", "*", "*.json")))
    n_rows = n_cells = 0; t0 = time.time()
    for f in files:
        tool, scope, fn = f.split(os.sep)[-3:]
        season, wk = fn[:-5].split("_w"); season, wk = int(season), int(wk)
        if season not in seasons or wk not in weeks or (tools and tool not in tools):
            continue
        d = json.load(open(f))
        rows = [x for x in (to_row(tool, scope, season, wk, d.get("pulled_at"), r, abbr) for r in d["rows"]) if x]
        if not rows:
            continue
        seen = {}
        for x in rows:                                  # one row per entity per cell
            seen[x["entity_id"]] = x
        rows = list(seen.values())
        for i in range(0, len(rows), 500):
            for attempt in range(4):
                r = requests.post(f"{SUPA}?on_conflict=tool,scope,season,week,entity_id", headers=H,
                                  json=rows[i:i + 500], timeout=120)
                if r.status_code in (200, 201):
                    break
                time.sleep(3 * (attempt + 1))
            else:
                sys.exit(f"[fp-load] upsert failed {tool}/{scope} {season} w{wk}: {r.status_code} {r.text[:200]}")
        n_rows += len(rows); n_cells += 1
    print(f"[fp-load] {n_cells} cells, {n_rows} rows -> fp_data (seasons {sorted(seasons)}) in {time.time() - t0:.0f}s")


if __name__ == "__main__":
    main()
