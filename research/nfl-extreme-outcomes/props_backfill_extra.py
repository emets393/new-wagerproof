"""Backfill THREE more NFL player-prop markets at the EXACT same snapshots we already
captured for the original six: player_pass_attempts, player_pass_completions,
player_rush_attempts (over/under line + odds). 2024 + 2025 only (that's all the
original props cover).

Method: walk the existing raw snapshot cache (data/props_snapshots/<season>/
<game_id>__<eid>__<YYYYMMDDTHHMM>.json) and re-hit the historical per-event endpoint
at each of those timestamps for the new markets, so the new data lines up 1:1 for
movement analysis. Resumable — raw JSON cached to data/props_snapshots_extra/; a miss
is cached too so we never re-spend. Reads ODDS_API_KEY from .env.local (never printed).

Usage:
  python3 props_backfill_extra.py --dry-run     # count snapshots + credit estimate
  python3 props_backfill_extra.py --test        # fetch a single snapshot end-to-end
  python3 props_backfill_extra.py               # full run
"""
import argparse
import json
import sys
import time
from pathlib import Path

import requests

ROOT = Path(__file__).resolve().parent
SRC = ROOT / "data" / "props_snapshots"          # existing snapshots (timestamps to match)
CACHE = ROOT / "data" / "props_snapshots_extra"  # new-market snapshots
BASE = "https://api.the-odds-api.com/v4/historical/sports/americanfootball_nfl"
MARKETS = "player_pass_attempts,player_pass_completions,player_rush_attempts"
BOOKS = "draftkings,fanduel,betmgm,williamhill_us"
SEASONS = (2024, 2025)


def load_key():
    for line in (ROOT.parent.parent / ".env.local").read_text().splitlines():
        if line.startswith("ODDS_API_KEY="):
            return line.split("=", 1)[1].strip()
    sys.exit("ODDS_API_KEY not found in .env.local")


def ts_to_iso(ts):
    # 20251113T1600 -> 2025-11-13T16:00:00Z
    d, t = ts.split("T")
    return f"{d[:4]}-{d[4:6]}-{d[6:8]}T{t[:2]}:{t[2:4]}:00Z"


def snapshots():
    """Yield (season, game_id, eid, ts_iso, filename) for every existing snapshot."""
    out = []
    for s in SEASONS:
        for f in sorted((SRC / str(s)).glob("*.json")):
            stem = f.stem  # game_id__eid__ts
            parts = stem.split("__")
            if len(parts) != 3:
                continue
            game_id, eid, ts = parts
            out.append((s, game_id, eid, ts_to_iso(ts), f.name))
    return out


def get(key, url, params):
    for attempt in range(6):
        try:
            r = requests.get(url, params={**params, "apiKey": key}, timeout=45)
        except requests.exceptions.RequestException:      # timeout / connection reset — retry
            time.sleep(3 * (attempt + 1)); continue
        if r.status_code == 429:
            time.sleep(5 * (attempt + 1)); continue
        rem = r.headers.get("x-requests-remaining")
        if r.status_code in (404, 422):
            return None, rem
        r.raise_for_status()
        time.sleep(0.12)
        return r.json(), rem
    raise RuntimeError(f"failed 6x: {url}")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--test", action="store_true")
    args = ap.parse_args()

    snaps = snapshots()
    todo = []
    for s, gid, eid, iso, fn in snaps:
        out = CACHE / str(s) / fn
        if not out.exists():
            todo.append((s, gid, eid, iso, fn))
    print(f"existing snapshots: {len(snaps)} | already fetched: {len(snaps)-len(todo)} | "
          f"to fetch: {len(todo)} | est credits ~{len(todo)*30:,} (~30/call, 3 markets; empties=0)",
          flush=True)
    if args.dry_run:
        return
    if args.test:
        todo = todo[:1]

    key = load_key()
    done = fetched = empty = 0
    rem = None
    t0 = time.time()
    for s, gid, eid, iso, fn in todo:
        out = CACHE / str(s) / fn
        out.parent.mkdir(parents=True, exist_ok=True)
        try:
            payload, rem = get(key, f"{BASE}/events/{eid}/odds",
                               {"markets": MARKETS, "bookmakers": BOOKS,
                                "oddsFormat": "american", "date": iso})
        except Exception as e:                            # persistent failure -> skip (not cached; retries next run)
            print(f"  !! skip {fn}: {e}", flush=True)
            done += 1
            continue
        if payload is None:
            out.write_text(json.dumps({"data": None}))
        else:
            out.write_text(json.dumps(payload))
            fetched += 1
            if not payload.get("data", {}).get("bookmakers"):
                empty += 1
        done += 1
        if done % 100 == 0 or args.test:
            rate = done / max(time.time() - t0, 1)
            print(f"[{done}/{len(todo)}] {fn} fetched={fetched} empty={empty} "
                  f"remaining={rem} ({rate:.1f}/s)", flush=True)
    print(f"DONE fetched={fetched} empty={empty} of {len(todo)} | remaining={rem} "
          f"| elapsed={time.time()-t0:.0f}s", flush=True)


if __name__ == "__main__":
    main()
