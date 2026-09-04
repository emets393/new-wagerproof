"""Football pipeline watchdog — catches SILENT failures before the owner does.

Render already emails when a cron exits non-zero. What it cannot catch is a cron that
exits 0 but wrote nothing, a feed that quietly went stale, or a game with no lines.
This sweep probes the DATA, not the jobs, and exits non-zero (-> Render failure email)
only when something is actually wrong — so the alert channel stays quiet-by-default.

Checks (football season, both sports):
  1. odds freshness    — latest line snapshot within 3h (the 15-min collectors are alive)
  2. slate presence    — current-week slate rows exist with upcoming games
  3. picks freshness   — pick cards regenerated within 26h (the 3x-daily rebuilds ran)
  4. missing lines     — upcoming games kicking within 48h that have NO spread posted
                         (catches provider event drops like UMass@Rutgers 2026-09-02)
  5. grading lag       — games final for >36h whose flags are still ungraded

Runs daily ~6:45am ET via render.yaml (football-health-sweep). Read-only.
"""
import os
import sys
import datetime as dt
from pathlib import Path

import requests

SUPA = "https://jpxnjuwglavsjbgbasnl.supabase.co/rest/v1"
NOW = dt.datetime.now(dt.timezone.utc)
RED, WARN, OK = [], [], []


def key():
    if os.environ.get("SUPABASE_SERVICE_KEY"):
        return os.environ["SUPABASE_SERVICE_KEY"]
    for fn in (Path(__file__).resolve().parent.parent / ".env.local",):
        if fn.exists():
            for line in fn.read_text().splitlines():
                if line.startswith("SUPABASE_SERVICE_KEY="):
                    return line.split("=", 1)[1].strip()
    sys.exit("SUPABASE_SERVICE_KEY not found")


H = {"apikey": key(), "Authorization": f"Bearer {key()}"}


def q(path, count=False):
    hdr = {**H, "Prefer": "count=exact"} if count else H
    r = requests.get(f"{SUPA}/{path}", headers=hdr, timeout=30)
    r.raise_for_status()
    if count:
        cr = r.headers.get("content-range", "*/0")
        return int(cr.split("/")[-1]) if cr.split("/")[-1] != "*" else 0
    return r.json()


def ts(v):
    # strip fractional seconds — py3.9 fromisoformat chokes on non-6-digit micros
    import re
    return dt.datetime.fromisoformat(re.sub(r"\.\d+", "", str(v).replace("Z", "+00:00")))


def check(label, ok, detail, warn_only=False):
    (OK if ok else (WARN if warn_only else RED)).append(f"{'OK ' if ok else ('WARN' if warn_only else 'RED')}  {label}: {detail}")


def main():
    season = NOW.year if NOW.month >= 3 else NOW.year - 1

    for sport, hist, tscol, slate, picks in (
            ("CFB", "ncaaf_odds_history", "snapshot", "cfb_slate_games", "cfb_slate_picks"),
            ("NFL", "nfl_historical_odds", "snap_ts", "nfl_slate_games", "nfl_slate_picks")):
        # 1. odds freshness. The collectors snapshot today's games hourly but future-day
        # games only 3x/day (8/14/20 ET), so on no-game days the overnight gap is ~12h BY
        # DESIGN — a 3h alarm there is a false positive (fired 2026-09-04, NFL off-week).
        # Threshold: 3h when that sport has a game within +/-24h, else 13h (covers the
        # set-hour gap; a dead collector still trips within a day).
        try:
            near = q(f"{slate}?select=game_id&season=eq.{season}"
                     f"&kickoff=gte.{(NOW - dt.timedelta(hours=24)).strftime('%Y-%m-%dT%H:%M:%SZ')}"
                     f"&kickoff=lte.{(NOW + dt.timedelta(hours=24)).strftime('%Y-%m-%dT%H:%M:%SZ')}", count=True)
            limit_h = 3 if near else 13
            snap = q(f"{hist}?select={tscol}&season=eq.{season}&order={tscol}.desc&limit=1")
            age_h = (NOW - ts(snap[0][tscol])).total_seconds() / 3600 if snap else 999
            check(f"{sport} odds feed", age_h < limit_h,
                  f"latest snapshot {age_h:.1f}h old (limit {limit_h}h, {near} game(s) within 24h)")
        except Exception as e:
            check(f"{sport} odds feed", False, f"probe failed: {e}")

        # 2-5 need the slate
        try:
            g = q(f"{slate}?select=game_id,week,kickoff,final_home,fg_spread_close&season=eq.{season}")
            if not g:
                check(f"{sport} slate", False, f"no {season} slate rows at all")
                continue
            wk = max(x["week"] for x in g)
            cur = [x for x in g if x["week"] == wk]
            upc = [x for x in cur if x.get("kickoff") and ts(x["kickoff"]) > NOW]
            check(f"{sport} slate", len(cur) > 0, f"week {wk}: {len(cur)} games, {len(upc)} upcoming")

            # 4. upcoming games inside 48h with no spread — the silent provider-drop case
            soon = [x for x in upc if ts(x["kickoff"]) < NOW + dt.timedelta(hours=48)]
            noline = [x["game_id"] for x in soon if x.get("fg_spread_close") is None]
            check(f"{sport} lines posted", not noline,
                  f"{len(noline)} of {len(soon)} games kicking <48h missing a spread"
                  + (f" (game_ids {noline[:5]})" if noline else ""))

            # 5. grading lag — final for >36h but playable pick cards still ungraded
            # (flags carry no result column; grading lands on the picks ledger)
            done = [x["game_id"] for x in cur if x.get("final_home") is not None
                    and x.get("kickoff") and ts(x["kickoff"]) < NOW - dt.timedelta(hours=36)]
            if done:
                ids = ",".join(str(i) for i in done)
                ungraded = q(f"{picks}?select=game_id&game_id=in.({ids})"
                             f"&has_play=eq.true&result=is.null", count=True)
                check(f"{sport} grading", ungraded == 0, f"{ungraded} ungraded playable picks on games final >36h", warn_only=True)
        except Exception as e:
            check(f"{sport} slate", False, f"probe failed: {e}")

        # 3. picks freshness — the 3x-daily rebuild actually wrote
        try:
            p = q(f"{picks}?select=created_at&season=eq.{season}&order=created_at.desc&limit=1")
            page_h = (NOW - ts(p[0]["created_at"])).total_seconds() / 3600 if p else 999
            check(f"{sport} pick cards", page_h < 26, f"last regenerated {page_h:.1f}h ago")
        except Exception as e:
            check(f"{sport} pick cards", False, f"probe failed: {e}")

    print(f"FOOTBALL HEALTH SWEEP — {NOW.isoformat(timespec='minutes')}")
    for line in RED + WARN + OK:
        print(" ", line)
    if RED:
        print(f"\n{len(RED)} RED check(s) — failing the run so Render alerts.")
        sys.exit(1)
    print(f"\nall green ({len(WARN)} warnings)")


if __name__ == "__main__":
    main()
