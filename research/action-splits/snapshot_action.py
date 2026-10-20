#!/usr/bin/env python3
"""Hourly Action Network splits capture -> action_public_splits (CFB Supabase).

NFL, CFB, NBA and NCAAB. Runs in GitHub Actions, NOT on Render: see
.github/workflows/action-splits-hourly.yml. Stdlib only, on purpose — no pip step, so the
job is a 20-second checkout-and-run.

    python3 snapshot_action.py                 every league, current slate, infer season
    python3 snapshot_action.py --league nba
    python3 snapshot_action.py --dry-run       fetch and diff, write nothing

WHY HOURLY, WHEN THE SPLITS BARELY MOVE
---------------------------------------
`bets_*`, `money_*` and the opening line SETTLE — re-reading a finished game returns the
same figures, which is why the research CSV could be rebuilt from hand-pastes at all. The
capture-time columns do not: `away_close`/`home_close`/`*_price` are the best price on the
board AT THE MOMENT YOU LOOK, and `tickets` climbs until kickoff. Those were unrecoverable
history under the manual path, and they are the half that makes a timing study possible:
when the money arrives relative to the move, and what the closing side actually was.

SO THIS TABLE IS A CHANGE LOG, NOT A SNAPSHOT LOG
-------------------------------------------------
An hourly full dump across four leagues would be thousands of rows a day with ~95% of each
one identical to the row before. We insert a row only when something about that game-market
CHANGED since its last stored row. Nothing is lost: consecutive rows bracket every interval
we observed, so the last row before kickoff IS the closing state. ⛔ Do not "fix" this into
an unconditional insert — fetch_event_odds_live.py went OOM on Render in October 2026
because a season-growth table was read whole, and this one would grow far faster.

The diff reads one row per key from `action_public_splits_latest` (a DISTINCT ON view), so
the comparison cost is flat in season length rather than linear.

⛔ THE KEY IS (game_id, market)
------------------------------
Action Network's own game id, not the team names and not the week. Football is keyed by week
and basketball has no week at all (`week` comes back null), and two NBA teams meet several
times a season — a name-and-week key silently collapses different games into one row. The
football CSV path still matches names fuzzily because the hand-pasted era carried no id;
this path has one, so it uses it.

TWO LEAGUE SHAPES, FOUR TRAPS
-----------------------------
Football is WEEK-based (`season=YYYY&week=N`); basketball is DATE-based (`date=YYYYMMDD`,
the ET slate date) and ⛔ the date must be passed ALONE — adding `season=` to a basketball
query returns zero games. We request today and tomorrow ET, because a line is posted the day
before and the pre-tip arc is the whole point of capturing hourly.

⛔ `bookIds` is camelCase and the FULL ten-id list is load-bearing: `book_ids=` returns no
games, and a short list returns games with `markets: {}` — no odds, no splits, NO ERROR.

⛔ Basketball seasons are labelled by START year by Action Network and by END year by every
other piece of basketball work in this repo, so they are shifted +1 on the way in. Football
is unshifted. See `season_shift` below and the note in fetch_nba.py.

FAILING LOUD, WITHOUT CRYING WOLF
---------------------------------
Games on the board with nothing parseable is the `bookIds` failure above, so it exits
non-zero and GitHub emails the owner. The one case that is NOT a defect is a date whose
games are too far out for any book to have posted a market — real on an NCAAB November
morning. So the hard failure needs a game tipping within 36 hours; anything further out
prints a warning and moves on. Out of season there are no games at all, and that exits 0.
"""
import argparse
import datetime as dt
import json
import os
import sys
import urllib.error
import urllib.request
from zoneinfo import ZoneInfo

from fetch_action import API, BOOK_IDS, UA, get, rows_for_game

TABLE = "action_public_splits"
VIEW = "action_public_splits_latest"
DEFAULT_URL = "https://jpxnjuwglavsjbgbasnl.supabase.co"
ET = ZoneInfo("America/New_York")

# slug on the endpoint -> how to query it and what to store.
#   mode "week": season+week params, `season` as given, week keyed (NFL, CFB)
#   mode "date": date param ALONE, `season` shifted to the END year (NBA, NCAAB)
LEAGUES = {
    "nfl":   {"sport": "nfl",   "mode": "week", "season_shift": 0},
    "ncaaf": {"sport": "cfb",   "mode": "week", "season_shift": 0},
    "nba":   {"sport": "nba",   "mode": "date", "season_shift": 1},
    "ncaab": {"sport": "ncaab", "mode": "date", "season_shift": 1},
}

# attributes of the game, stable between captures — stored, never diffed
ATTR_COLS = ("sport", "season", "week", "slate_date", "start_time", "game_type",
             "away", "home")
# the mutable half: a change in any of these is what earns a new row
VAL_COLS = ("away_open", "home_open", "away_close", "away_price", "home_close",
            "home_price", "bets_away", "bets_home", "money_away", "money_home",
            "tickets", "away_move", "home_move", "money_minus_bets_away")

HARD_FAIL_HOURS = 36        # see FAILING LOUD above


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


def get_date(league, day):
    """Basketball: one ET slate date. ⛔ `date` travels ALONE — see the docstring."""
    from urllib.parse import urlencode
    q = urlencode({"period": "game", "date": f"{day:%Y%m%d}",
                   "bookIds": ",".join(str(b) for b in BOOK_IDS)})
    req = urllib.request.Request(f"{API.format(league=league)}?{q}",
                                 headers={"User-Agent": UA,
                                          "Referer": "https://www.actionnetwork.com/",
                                          "Accept": "application/json"})
    with urllib.request.urlopen(req, timeout=45) as r:
        return json.loads(r.read().decode())


def f(v):
    """CSV-shaped value ('' for absent) -> float or None, rounded for comparison.

    Rounding is the point: the API hands back 3 and 3.0 interchangeably and a bare string
    compare would log a "change" every hour on a line that never moved.
    """
    if v is None or v == "":
        return None
    return round(float(v), 4)


def current_season(today):
    """Football season label: Aug-Dec is this year, Jan-Jul is last year's season."""
    return today.year if today.month >= 8 else today.year - 1


def parse_games(payload, cfg, season, slate_date):
    """One payload -> {(game_id, market): {attrs + values}}, plus what we skipped."""
    rows, skipped, soonest = {}, 0, None
    for g in payload.get("games") or []:
        gid = g.get("id")
        start = g.get("start_time")
        if start:
            try:
                tip = dt.datetime.fromisoformat(start.replace("Z", "+00:00"))
                soonest = tip if soonest is None else min(soonest, tip)
            except ValueError:
                pass
        # the season label travels in the payload; the CLI value is only a fallback
        gs = g.get("season")
        row_season = int(gs) + cfg["season_shift"] if gs is not None else season
        # basketball has no week and takes its slate day from the `date` we asked for —
        # ⛔ never from slicing start_time, which is UTC and rolls a 7pm ET tip to the
        # next day. Football has a week and we derive its ET date for convenience only.
        day = slate_date
        if day is None and start:
            try:
                day = dt.datetime.fromisoformat(start.replace("Z", "+00:00")) \
                        .astimezone(ET).date()
            except ValueError:
                day = None
        parsed = rows_for_game(g, cfg["sport"], row_season)
        if gid is None:
            skipped += len(parsed)      # unkeyable without an id; never silently stored
            continue
        for r in parsed:
            key = (int(gid), r["market"])
            rows[key] = {
                "sport": cfg["sport"], "season": row_season,
                "week": r["week"] if r.get("week") not in (None, "") else None,
                "slate_date": day.isoformat() if day else None,
                "start_time": start, "game_type": g.get("type"),
                # ⛔ trim: the feed ships "Army " with a trailing space
                "away": (r["away"] or "").strip(), "home": (r["home"] or "").strip(),
                **{c: f(r[c]) for c in VAL_COLS},
            }
    return rows, skipped, soonest


def fetch(league, cfg, season, today):
    """Everything currently on the board for one league."""
    rows, skipped, soonest, games = {}, 0, None, 0
    if cfg["mode"] == "week":
        payloads = [(get(league, season, None), None)]       # week=None -> current week
    else:
        payloads = [(get_date(league, today + dt.timedelta(days=n)),
                     today + dt.timedelta(days=n)) for n in (0, 1)]
    for payload, day in payloads:
        games += len(payload.get("games") or [])
        r, sk, soon = parse_games(payload, cfg, season, day)
        rows.update(r)
        skipped += sk
        if soon is not None:
            soonest = soon if soonest is None else min(soonest, soon)
    return games, rows, skipped, soonest


def stored(base, hdr, keys):
    """Latest stored row per key, for the games we just fetched."""
    if not keys:
        return {}
    ids = sorted({str(k[0]) for k in keys})
    cols = ",".join(("game_id", "market") + VAL_COLS)
    out = {}
    for i in range(0, len(ids), 300):           # keep the URL well inside any limit
        chunk = ",".join(ids[i:i + 300])
        q = f"{base}/{VIEW}?select={cols}&game_id=in.({chunk})&limit=20000"
        for r in rest("GET", q, hdr) or []:
            out[(int(r["game_id"]), r["market"])] = {c: f(r[c]) for c in VAL_COLS}
    return out


def main():
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--season", type=int, default=None,
                    help="football season label; basketball takes it from the payload")
    ap.add_argument("--league", choices=sorted(LEAGUES), action="append",
                    help="repeatable; default every league")
    ap.add_argument("--dry-run", action="store_true")
    a = ap.parse_args()

    today = dt.datetime.now(ET).date()
    season = a.season or current_season(today)
    leagues = a.league or list(LEAGUES)
    base, hdr = supa()
    now = dt.datetime.now(dt.timezone.utc)
    snap = now.isoformat(timespec="seconds")
    total_new, total_games = 0, 0

    for league in leagues:
        cfg = LEAGUES[league]
        games, fresh, skipped, soonest = fetch(league, cfg, season, today)
        total_games += games

        if games and not fresh:
            hrs = (soonest - now).total_seconds() / 3600 if soonest else None
            msg = (f"[{cfg['sport']}] {games} games on the board carried NO usable rows")
            if hrs is not None and hrs > HARD_FAIL_HOURS:
                # no book has posted a market yet — normal this far out, not a defect
                print(f"  WARN {msg}; soonest tips in {hrs:.0f}h, no markets posted yet")
                continue
            sys.exit(f"⛔ {msg} — the query is wrong (bookIds?) or the response shape "
                     f"changed. Writing nothing.")
        if not fresh:
            print(f"[{cfg['sport']}] nothing on the board — out of season")
            continue

        have = stored(base, hdr, set(fresh))
        changed = [k for k, v in fresh.items()
                   if have.get(k) != {c: v[c] for c in VAL_COLS}]
        new = [k for k in changed if k not in have]

        if not a.dry_run and changed:
            payload = [dict(fresh[k], game_id=k[0], market=k[1], snap_ts=snap)
                       for k in changed]
            for i in range(0, len(payload), 500):
                rest("POST", f"{base}/{TABLE}", hdr, payload[i:i + 500],
                     {"Prefer": "return=minimal"})
        total_new += len(changed)

        span = sorted({r["week"] for r in fresh.values() if r["week"] is not None}) \
            or sorted({r["slate_date"] for r in fresh.values() if r["slate_date"]})
        print(f"[{cfg['sport']} {season if cfg['mode'] == 'week' else ''} "
              f"{','.join(str(s) for s in span)}] {games} games, {len(fresh)} "
              f"game-markets, {len(changed)} written ({len(new)} new, "
              f"{len(changed) - len(new)} moved)"
              + (f", {skipped} skipped with no game id" if skipped else "")
              + (" [dry run]" if a.dry_run else ""))

    print(f"[snapshot] {total_games} games, {total_new} rows -> {TABLE} @ {snap}")


if __name__ == "__main__":
    main()
