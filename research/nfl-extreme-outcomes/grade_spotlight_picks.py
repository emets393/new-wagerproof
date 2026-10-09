#!/usr/bin/env python3
"""Grade the prop spotlight picks against what the players actually did.

These picks replace the retired regression-report prop picks (owner 2026-10-07), so this is the
record the spotlight is judged on. Runs daily: a week's games finish across four days, so it
grades whatever has a game log and leaves the rest alone.

⛔ GRADED AGAINST THE STAMPED LINE AND SIDE, never a recomputed one. nfl_prop_spotlight.line and
.side are what the reader was shown; re-deriving either at grading time would score a different
bet than the one published, which is how a losing flag quietly reads as a winner
(nfl-backtest-grading-framework). This script therefore never touches the payload or the model.

Usage:  grade_spotlight_picks.py [--season S] [--week W] [--regrade]
        no --week  -> every ungraded pick in the season (the daily cron's mode)
        --regrade  -> also rescore rows that already have a result, for a grader fix
"""
import argparse
import os
import sys

import requests

SUPA = "https://jpxnjuwglavsjbgbasnl.supabase.co/rest/v1"
HERE = os.path.dirname(os.path.abspath(__file__))

# market -> the nfl_player_game_logs column holding the realised number
STAT = {
    "player_pass_yds": "pass_yds", "player_pass_tds": "pass_tds",
    "player_pass_attempts": "pass_attempts", "player_pass_completions": "completions",
    "player_rush_yds": "rush_yds", "player_rush_attempts": "carries",
    "player_receptions": "receptions", "player_reception_yds": "rec_yds",
    "player_targets": "targets", "player_anytime_td": "anytime_td",
}


def key():
    k = os.environ.get("SUPABASE_SERVICE_KEY")
    if k:
        return k
    env = os.path.join(HERE, "..", "..", ".env.local")
    if os.path.exists(env):
        for ln in open(env):
            if ln.startswith("SUPABASE_SERVICE_KEY="):
                return ln.split("=", 1)[1].strip()
    sys.exit("no SUPABASE_SERVICE_KEY")


def fetch(table, params):
    k = key()
    h = {"apikey": k, "Authorization": f"Bearer {k}"}
    out, off = [], 0
    while True:
        r = requests.get(f"{SUPA}/{table}?{params}&limit=1000&offset={off}", headers=h, timeout=90)
        if r.status_code != 200:
            sys.exit(f"[grade] {table} ({r.status_code}): {r.text[:300]}")
        j = r.json()
        out += j
        if len(j) < 1000:
            return out
        off += 1000


def grade_one(side, line, actual, market):
    """('win'|'loss'|'push', actual) for one stamped pick.

    Anytime TD is a yes/no market with no line: the log column is 0/1 and `side` 'over' means
    the TD was scored. Everything else is a number against a line, and landing exactly on the
    line is a push, not a loss — a half-point line simply never produces one.
    """
    if market == "player_anytime_td":
        scored = float(actual) > 0
        return ("win" if scored else "loss") if side == "over" else ("loss" if scored else "win")
    if line is None:
        return None
    a, ln = float(actual), float(line)
    if a == ln:
        return "push"
    over = a > ln
    return "win" if (over == (side == "over")) else "loss"


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--season", type=int, default=int(os.environ.get("NFL_SEASON", 2026)))
    ap.add_argument("--week", type=int, default=int(os.environ.get("GRADE_WEEK", 0) or 0))
    ap.add_argument("--regrade", action="store_true",
                    help="rescore rows that already carry a result")
    ap.add_argument("--dry-run", action="store_true")
    a = ap.parse_args()

    q = f"season=eq.{a.season}&select=id,season,week,player_id,player_name,market,side,line,result"
    if a.week:
        q += f"&week=eq.{a.week}"
    if not a.regrade:
        q += "&result=is.null"
    picks = fetch("nfl_prop_spotlight", q)
    if not picks:
        print(f"[grade] no {'ungraded ' if not a.regrade else ''}picks for {a.season}"
              + (f" wk{a.week}" if a.week else ""))
        return

    weeks = sorted({p["week"] for p in picks})
    cols = ",".join(sorted(set(STAT.values())))
    logs = fetch("nfl_player_game_logs",
                 f"season=eq.{a.season}&week=in.({','.join(str(w) for w in weeks)})"
                 f"&select=season,week,player_id,{cols}")
    by = {(str(r["player_id"]), r["week"]): r for r in logs}
    print(f"[grade] {len(picks)} picks over weeks {weeks} | {len(logs)} game logs available")

    upd, pending, nomarket = [], 0, 0
    for p in picks:
        log = by.get((str(p["player_id"]), p["week"]))
        if log is None:
            pending += 1          # game not played yet, or the log ingest has not caught up
            continue
        stat = STAT.get(p["market"])
        if stat is None:
            nomarket += 1
            continue
        actual = log.get(stat)
        if actual is None:
            pending += 1
            continue
        res = grade_one(p["side"], p.get("line"), actual, p["market"])
        if res is None:
            nomarket += 1
            continue
        upd.append(dict(id=p["id"], actual_value=float(actual), result=res,
                        graded_at="now()", updated_at="now()"))

    tally = {}
    for u in upd:
        tally[u["result"]] = tally.get(u["result"], 0) + 1
    rec = f"{tally.get('win',0)}-{tally.get('loss',0)}" + (
        f"-{tally['push']}" if tally.get("push") else "")
    decided = tally.get("win", 0) + tally.get("loss", 0)
    hit = f"{100*tally.get('win',0)/decided:.1f}%" if decided else "n/a"
    print(f"[grade] gradable now: {len(upd)} -> {rec} ({hit})"
          f" | waiting on a game log: {pending}"
          + (f" | unmapped market: {nomarket}" if nomarket else ""))
    if a.dry_run or not upd:
        return

    k = key()
    hdr = {"apikey": k, "Authorization": f"Bearer {k}", "Content-Type": "application/json",
           "Prefer": "resolution=merge-duplicates,return=minimal"}
    # upsert on the primary key: every row already exists, so this is an id-matched update that
    # leaves the stamped pick (side/line/tells/narrative) untouched.
    for i in range(0, len(upd), 200):
        r = requests.post(f"{SUPA}/nfl_prop_spotlight?on_conflict=id", headers=hdr,
                          json=upd[i:i + 200], timeout=120)
        if r.status_code not in (200, 201, 204):
            sys.exit(f"[grade] write failed ({r.status_code}): {r.text[:300]}")
    print(f"[grade] wrote {len(upd)} results")


if __name__ == "__main__":
    main()
