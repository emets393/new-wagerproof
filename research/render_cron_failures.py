#!/usr/bin/env python3
"""Which Render cron jobs are failing, and which are failing REPEATEDLY?

WHY. On 2026-11-06 nba-props-live started failing on an upsert and failed every hour for 18
straight runs — 18:11Z through 11:11Z — and nobody was paged. It only surfaced because the owner
happened to ask about it the next afternoon. ncaab-situational-trends had been failing daily since
11-05 the same way. A cron that fails does not email, and nothing in this repo looked at run
outcomes, so the only signal was a red dot on a dashboard nobody has open at 4am.

A single failure is usually an availability blip and is not worth waking anyone. A job failing
TWICE IN A ROW is a bug: it will keep failing until someone reads the traceback. That distinction
is the whole point of this check, so it is what the exit codes encode.

⛔ WHERE RUN OUTCOMES LIVE. `/cron-jobs/{id}/runs` is POST-ONLY — it STARTS a run. Outcomes come
from `/services/{id}/events`, type `cron_job_run_ended`, and the status strings are `successful`
and `unsuccessful` — NOT "succeeded"/"success". Matching the wrong string reports every healthy
job as broken, which is exactly how this was first misread.

EXIT CODES ARE PART OF THE CONTRACT. health_sweep.py reds only on 2 (same shape as
render_drift.py — see the note there about a missing dependency painting a whole green sweep RED).
  0 = checked, nothing failing repeatedly (isolated failures are printed, not alarmed)
  1 = COULD NOT CHECK (missing key/network) — not actionable, must not alarm
  2 = a job has failed 2+ times in a row — actionable
"""
import json
import os
import sys
import datetime as dt
import urllib.request
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

CANNOT_CHECK, FAILING = 1, 2

LOOKBACK_H = 36        # long enough to catch a once-daily job twice
REPEAT_RED = 2         # consecutive failures that mean "bug", not "blip"

# ⛔ A WATCHDOG CANNOT BE ITS OWN ALARM.
# This check runs inside football-health-sweep, and reporting a RED makes the sweep exit 1.
# So its own failure becomes its own next input: once the sweep has failed twice for ANY
# reason, this check reports "football-health-sweep: 2 in a row" forever and the run can
# never go green again, no matter what it is actually measuring. Observed 2026-11-08/09 --
# the sweep failed on a cry-wolf bug that was ALREADY FIXED, then stayed red on nothing but
# itself while all 17 other checks passed. A permanently-red alarm is the same failure as a
# cry-wolf alarm: the owner learns to ignore it.
# Render sets these in the cron runtime; SELF_NAME covers a local run.
SELF_ID = os.environ.get("RENDER_SERVICE_ID", "")
SELF_NAME = os.environ.get("RENDER_SERVICE_NAME", "football-health-sweep")


def key():
    k = os.environ.get("RENDER_API_KEY")
    if k:
        return k
    env = ROOT / ".env.local"
    if env.exists():
        for ln in env.read_text().splitlines():
            if ln.startswith("RENDER_API_KEY="):
                return ln.split("=", 1)[1].strip().strip('"')
    return None


def api(path, k):
    req = urllib.request.Request("https://api.render.com/v1" + path,
                                 headers={"Authorization": f"Bearer {k}", "Accept": "application/json"})
    with urllib.request.urlopen(req, timeout=60) as r:
        return json.loads(r.read())


def main():
    k = key()
    if not k:
        print("[cron] no RENDER_API_KEY — skipped")
        return CANNOT_CHECK

    # MUST PAGINATE: limit=100 does not return every service (see render_drift.py — a single
    # call came back 49 of 50 and silently dropped a job).
    svcs, cursor = [], None
    try:
        while True:
            url = "/services?limit=100" + (f"&cursor={cursor}" if cursor else "")
            page = api(url, k)
            if not page:
                break
            svcs += [p["service"] for p in page]
            cursor = page[-1]["cursor"]
            if len(page) < 100:
                break
    except Exception as e:
        print(f"[cron] service list failed ({e}) — cannot check")
        return CANNOT_CHECK

    # Exclude self from the DECISION (see SELF_ID above); its runs are still reported
    # below so a genuinely broken sweep is visible in the log, just never self-latching.
    crons = [s for s in svcs if s["type"] == "cron_job"]
    mine = [s for s in crons if s["id"] == SELF_ID or s["name"] == SELF_NAME]
    crons = [s for s in crons if s not in mine]
    cut = dt.datetime.now(dt.timezone.utc) - dt.timedelta(hours=LOOKBACK_H)

    runs = defaultdict(list)           # name -> [(ts, ok)] newest first
    unreachable = []
    for s in crons:
        try:
            evs = api(f"/services/{s['id']}/events?limit=50", k)
        except Exception as e:
            unreachable.append(f"{s['name']} ({type(e).__name__})")
            continue
        for e in evs:
            ev = e["event"]
            if ev.get("type") != "cron_job_run_ended":
                continue
            t = dt.datetime.fromisoformat(ev["timestamp"].replace("Z", "+00:00"))
            if t < cut:
                continue
            status = str(ev.get("details", {}).get("status", ""))
            runs[s["name"]].append((t, status == "successful"))

    repeat, isolated = [], []
    for name, rs in runs.items():
        rs.sort(reverse=True)                        # newest first
        streak = 0
        for _, ok in rs:
            if ok:
                break
            streak += 1
        fails = sum(1 for _, ok in rs if not ok)
        # the newest FAILURE, not the newest run -- "latest 16:01Z" next to a job whose last
        # failure was at 15:03 reads as a fresh break that never happened
        last_fail = max((t for t, ok in rs if not ok), default=None)
        if streak >= REPEAT_RED:
            repeat.append((streak, fails, len(rs), name, last_fail))
        elif fails:
            isolated.append((fails, len(rs), name, last_fail))

    total_runs = sum(len(v) for v in runs.values())
    print(f"[cron] {len(crons)} cron jobs, {total_runs} runs in the last {LOOKBACK_H}h"
          + (f" (excluding self: {mine[0]['name']})" if mine else ""))

    for streak, fails, n, name, last in sorted(repeat, reverse=True):
        print(f"  FAILING  {name}: {streak} in a row (and {fails} of its last {n}), "
              f"latest {last:%m-%d %H:%M}Z")
    for fails, n, name, last in sorted(isolated, reverse=True):
        # it is passing NOW (streak 0), so it is not actionable -- but "blip" is the wrong word
        # for a job that failed 18 of its last 24, so say which it was.
        label = "recovered" if fails >= 3 else "blip     "
        print(f"  {label} {name}: {fails} of its last {n} failed, last failure "
              f"{last:%m-%d %H:%M}Z, passing now")
    if unreachable:
        print(f"  events unreadable for: {', '.join(unreachable[:6])}")

    if repeat:
        worst = max(repeat)
        print(f"\n{len(repeat)} job(s) failing repeatedly — worst is {worst[3]} at "
              f"{worst[0]} consecutive. Read its log: these do not self-heal.")
        return FAILING
    if isolated:
        print(f"  no repeat failures ({len(isolated)} job(s) above failed recently but pass now)")
    else:
        print("  all clean")
    return 0


if __name__ == "__main__":
    sys.exit(main())
