#!/usr/bin/env python3
"""One retrying, duplicate-safe insert for the odds-snapshot collectors.

WHY THIS EXISTS. 2026-10-10 14:46 `cfb-live-odds-hourly` died on
`524 Server Error ... /rest/v1/ncaaf_odds_history` and exited 1, losing that 15-minute
snapshot outright (14:30 and 15:00 are in the table, 14:45 is not). One failure in 239
runs — a pure availability blip — but every FG collector wrote with a bare
`resp.raise_for_status()` and no retry, so any Supabase hiccup silently drops a snapshot.

⛔ WHY NOT A PLAIN RETRY, OR urllib3 Retry WITH POST ALLOWED. A 524 is a *gateway*
timeout: the request reached Postgres and may already have committed. These tables carry
only `PRIMARY KEY (id)` on a surrogate id — there is NO natural unique key — so nothing
stops a re-POST from inserting a second copy of every row, and a duplicated snapshot
silently double-weights that timestamp in every downstream line-movement aggregate.
Retrying an un-deduplicable POST is the dangerous fix, not the safe one.

So each attempt first DELETEs this snapshot. `snap_iso` is the calling process's own
microsecond ISO stamp, written into every row it builds, so the delete is scoped to rows
that run wrote and can never touch another snapshot.
"""
import time

import requests


def insert_snapshot(hdr, rows, snap_iso, supa, table, ts_col, attempts=3, batch=500):
    """POST `rows` to `supa/table`, scrubbing `ts_col == snap_iso` before each retry.

    hdr     already carries apikey/Authorization/Content-Type/Prefer.
    ts_col  differs per table — `snapshot` on ncaaf_odds_history, `snap_ts` on
            ncaaf_event_odds and nfl_historical_odds. Passing the wrong one makes the
            scrub a no-op, so it is required rather than defaulted.
    """
    for attempt in range(1, attempts + 1):
        try:
            for i in range(0, len(rows), batch):
                resp = requests.post(f"{supa}/{table}", headers=hdr,
                                     json=rows[i:i + batch], timeout=60)
                resp.raise_for_status()
            return
        except requests.exceptions.RequestException as e:
            if attempt == attempts:
                raise
            print(f"[write] attempt {attempt}/{attempts} failed ({e}); "
                  f"scrubbing {table} {ts_col}={snap_iso} and retrying", flush=True)
            # ⛔ snap_iso ENDS IN "+00:00" AND THE "+" MUST BE PERCENT-ENCODED. Interpolated
            # into the URL it decodes to a space and PostgREST answers `22007 invalid input
            # syntax for type timestamp with time zone: "...07471 00:00"`, so the scrub would
            # fail on every retry. Pass it as params and let requests encode it to %2B.
            # The scrub gets its OWN retries. The invariant below still holds — we never
            # re-POST until the scrub has succeeded — but giving it a single 60s attempt made
            # a transient blip fatal: 2026-11-07 15:18 cfb-live-odds-hourly died on
            # `ReadTimeoutError ... (read timeout=60)` raised from this very line, losing the
            # snapshot for the same reason the POST retry exists. A read timeout here is an
            # availability blip, not a reason to give up; the delete is idempotent (it is
            # scoped to this run's own snap_iso), so repeating it is always safe.
            for scrub in range(1, 4):
                try:
                    d = requests.delete(f"{supa}/{table}", headers=hdr, timeout=120,
                                        params={ts_col: f"eq.{snap_iso}"})
                    d.raise_for_status()
                    break
                except requests.exceptions.RequestException as se:
                    # If the scrub never succeeds we cannot know what is in the table — stop
                    # rather than stack a second partial copy on top of the first.
                    if scrub == 3:
                        raise RuntimeError(
                            f"scrub of {table} {ts_col}={snap_iso} failed {scrub}x ({se}); "
                            f"refusing to re-POST over an unknown partial write") from se
                    print(f"[write] scrub attempt {scrub}/3 failed ({se}); retrying", flush=True)
                    time.sleep(5 * scrub)
            time.sleep(5 * attempt)
