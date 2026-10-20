#!/usr/bin/env python3
"""Hourly Action Network splits capture -> action_public_splits (CFB Supabase).

Runs in GitHub Actions, NOT on Render: see .github/workflows/action-splits-hourly.yml.
Stdlib only, on purpose — no pip step, so the job is a 20-second checkout-and-run.

    python3 snapshot_action.py                 both leagues, current week, infer season
    python3 snapshot_action.py --season 2026 --league nfl
    python3 snapshot_action.py --dry-run       fetch and diff, write nothing

WHY HOURLY, WHEN THE SPLITS BARELY MOVE
---------------------------------------
`bets_*`, `money_*` and the opening line SETTLE — re-reading a finished week returns the
same figures, which is why the research CSV could be rebuilt from hand-pastes at all. The
capture-time columns do not: `away_close`/`home_close`/`*_price` are the best price on the
board AT THE MOMENT YOU LOOK, and `tickets` climbs until kickoff. Those were unrecoverable
history under the manual path, and they are the half that makes a timing study possible:
when the money arrives relative to the move, and what the closing side actually was.

SO THIS TABLE IS A CHANGE LOG, NOT A SNAPSHOT LOG
-------------------------------------------------
An hourly full dump would be ~230 rows x 2 leagues x 24h, and 95% of it identical to the
row before. We insert a row only when something about that game-market CHANGED since its
last stored row, which keeps a season in the low tens of thousands instead of the low
millions. Nothing is lost: consecutive rows bracket every interval we observed, so the
last row before kickoff IS the closing state. ⛔ Do not "fix" this into an unconditional
insert — fetch_event_odds_live.py went OOM on Render in October 2026 because a
season-growth table was read whole, and this one would grow 20x faster.

The diff reads one row per key from `action_public_splits_latest` (a DISTINCT ON view), so
the comparison cost is flat in season length rather than linear.

FAILING LOUD
------------
A thin result here is a bad query, not a quiet week: `bookIds` is camelCase and the full
book list is load-bearing — `book_ids=` returns no games and a short list returns games
with `markets: {}`, no odds, no error. So games-but-no-rows EXITS NON-ZERO rather than
writing blanks, which is what a GitHub Actions failure email is for. Out of season there
are no games at all, and that exits 0 quietly.
"""
import argparse
import datetime as dt
import json
import os
import sys
import urllib.error
import urllib.request

from fetch_action import SPORT, get, rows_for_game

TABLE = "action_public_splits"
VIEW = "action_public_splits_latest"
DEFAULT_URL = "https://jpxnjuwglavsjbgbasnl.supabase.co"

KEY_COLS = ("sport", "season", "week", "market", "away", "home")
# the mutable half: a change in any of these is what earns a new row
VAL_COLS = ("away_open", "home_open", "away_close", "away_price", "home_close",
            "home_price", "bets_away", "bets_home", "money_away", "money_home",
            "tickets", "away_move", "home_move", "money_minus_bets_away")


def supa():
    url = (os.environ.get("CFB_SUPABASE_URL") or DEFAULT_URL).rstrip("/")
    key = os.environ.get("SUPABASE_SERVICE_KEY")
    if not key:
        sys.exit("SUPABASE_SERVICE_KEY not set")
    return f"{url}/rest/v1", {"apikey": key, "Authorization": f"Bearer {key}",
                              "Content-Type": "application/json"}


def rest(method, path, hdr, body=None, extra=None):
    req = urllib.request.Request(path, method=method,
                                 data=None if body is None else json.dumps(body).encode(),
                                 headers={**hdr, **(extra or {})})
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            raw = r.read().decode()
            return json.loads(raw) if raw else None
    except urllib.error.HTTPError as e:
        sys.exit(f"{method} {path.split('/rest/v1/')[-1][:80]} -> "
                 f"{e.code} {e.read().decode()[:300]}")


def f(v):
    """CSV-shaped value ('' for absent) -> float or None, rounded for comparison.

    Rounding is the point: the API hands back 3 and 3.0 interchangeably and a bare string
    compare would log a "change" every hour on a line that never moved.
    """
    if v is None or v == "":
        return None
    return round(float(v), 4)


def current_season(today):
    """Football season label: Aug-Dec is this year, Jan-Feb is last year's season."""
    return today.year if today.month >= 8 else today.year - 1


def fetch(league, season):
    """Current week for one league, as {key: {col: value}}."""
    d = get(league, season, None)        # week=None -> whatever the site is showing
    games = d.get("games") or []
    rows, skipped = {}, 0
    for g in games:
        for r in rows_for_game(g, SPORT[league], season):
            if r.get("week") in (None, ""):
                skipped += 1         # unkeyable without a week; never silently stored
                continue
            # ⛔ Strip the team names. The feed ships "Army " with a trailing space, and the
            # key includes the names — an untrimmed variant forks into a second key and the
            # change log starts double-logging the same game-market. Trimmed here only: the
            # CSV path keeps the raw names, because join_results.py matches them fuzzily.
            key = tuple(r[c].strip() if isinstance(r[c], str) else r[c] for c in KEY_COLS)
            rows[key] = {c: f(r[c]) for c in VAL_COLS}
    return games, rows, skipped


def stored(base, hdr, sport, season, weeks):
    """Latest stored row per key, for the weeks we just fetched."""
    if not weeks:
        return {}
    wk = ",".join(str(w) for w in sorted(weeks))
    cols = ",".join(KEY_COLS + VAL_COLS)
    q = (f"{base}/{VIEW}?select={cols}&sport=eq.{sport}&season=eq.{season}"
         f"&week=in.({wk})&limit=5000")
    out = {}
    for r in rest("GET", q, hdr) or []:
        # season/week are ints on the fresh side, so cast — a "2026" key never matches 2026
        key = (r["sport"], int(r["season"]), int(r["week"]),
               r["market"], r["away"], r["home"])
        out[key] = {c: f(r[c]) for c in VAL_COLS}
    return out


def main():
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--season", type=int, default=None)
    ap.add_argument("--league", choices=sorted(SPORT), action="append",
                    help="repeatable; default both")
    ap.add_argument("--dry-run", action="store_true")
    a = ap.parse_args()

    season = a.season or current_season(dt.date.today())
    leagues = a.league or sorted(SPORT)
    base, hdr = supa()
    snap = dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds")
    total_new, total_games = 0, 0

    for league in leagues:
        sport = SPORT[league]
        games, fresh, skipped = fetch(league, season)
        total_games += len(games)
        if games and not fresh:
            sys.exit(f"⛔ [{sport}] {len(games)} games carried NO usable rows — the query "
                     f"is wrong (bookIds?) or the response shape changed. Writing nothing.")
        if not fresh:
            print(f"[{sport} {season}] no games on the board — out of season, nothing to do")
            continue

        weeks = sorted({k[2] for k in fresh})
        have = stored(base, hdr, sport, season, weeks)
        changed = [k for k, v in fresh.items() if have.get(k) != v]
        new = [k for k in changed if k not in have]

        if not a.dry_run and changed:
            payload = [dict(zip(KEY_COLS, k), snap_ts=snap, **fresh[k]) for k in changed]
            for i in range(0, len(payload), 500):
                rest("POST", f"{base}/{TABLE}", hdr, payload[i:i + 500],
                     {"Prefer": "return=minimal"})
        total_new += len(changed)
        print(f"[{sport} {season} wk{','.join(str(w) for w in weeks)}] "
              f"{len(games)} games, {len(fresh)} game-markets, "
              f"{len(changed)} written ({len(new)} new, {len(changed) - len(new)} moved)"
              + (f", {skipped} skipped with no week" if skipped else "")
              + (" [dry run]" if a.dry_run else ""))

    print(f"[snapshot] {total_games} games, {total_new} rows -> {TABLE} @ {snap}")


if __name__ == "__main__":
    main()
