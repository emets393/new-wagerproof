"""Filter-key parity audit: historical vs upcoming RPCs, all sports.

The trust rule this enforces: any filter key the historical engine ({sport}_system_rows —
the single WHERE shared by the page aggregates and the systems grader) understands must
ALSO be handled by {sport}_analysis_upcoming ("today's games that match"). A key the
upcoming RPC doesn't reference is a SILENT no-op: users see games that don't fit their
filter — the exact bug class this audit exists to prevent (win-streak incident, 2026-07-22).

Keys that genuinely can't be honored on a slate must appear in the upcoming SQL as an
honest zero-row clause (e.g. `p_filters->>'pre_bye' IS NULL OR false`) — the regex then
counts them as handled, which is the point: handled-honestly beats ignored.

Run anytime (and ALWAYS after adding a filter key):
    SUPABASE_PAT=sbp_xxx python3 audit_filter_keys.py
Exits 1 on any unexplained gap.
"""
import json
import os
import re
import sys
import urllib.request

API = "https://api.supabase.com/v1/projects/jpxnjuwglavsjbgbasnl/database/query"
PAT = os.environ.get("SUPABASE_PAT") or sys.exit("set SUPABASE_PAT")
KEY = re.compile(r"p_filters->>?'([a-z0-9_]+)'")

# Documented, intentional asymmetries. Keep this list SHORT and justified.
ALLOWED_MISSING_FROM_UPCOMING = {
    "nfl": set(),
    "cfb": set(),
    "mlb": set(),
}
# Upcoming-only keys (exist there but not in historical) that are fine:
ALLOWED_EXTRA_IN_UPCOMING = {
    "nfl": set(),
    "cfb": set(),
    "mlb": set(),
}


def q(sql):
    req = urllib.request.Request(API, data=json.dumps({"query": sql}).encode(), method="POST",
                                 headers={"Authorization": f"Bearer {PAT}", "Content-Type": "application/json",
                                          "User-Agent": "SupabaseCLI/1.0"})
    return json.load(urllib.request.urlopen(req, timeout=120))


def fndef(name):
    r = q(f"select pg_get_functiondef(p.oid) d from pg_proc p join pg_namespace n on n.oid=p.pronamespace "
          f"where n.nspname='public' and p.proname='{name}';")
    if not r:
        sys.exit(f"FUNCTION MISSING: {name}")
    return r[0]["d"]


fail = False
for sport in ("nfl", "cfb", "mlb"):
    hist = set(KEY.findall(fndef(f"{sport}_system_rows")))
    upc = set(KEY.findall(fndef(f"{sport}_analysis_upcoming")))
    missing = hist - upc - ALLOWED_MISSING_FROM_UPCOMING[sport]
    extra = upc - hist - ALLOWED_EXTRA_IN_UPCOMING[sport]
    status = "OK" if not missing else "FAIL"
    print(f"{sport.upper()}: historical {len(hist)} keys, upcoming {len(upc)} keys -> {status}")
    if missing:
        fail = True
        print(f"  !! keys the upcoming RPC would SILENTLY IGNORE: {sorted(missing)}")
        print("     Fix: add the clause to the upcoming RPC (honest zero-row clause if unsupportable).")
    if extra:
        print(f"  note: upcoming-only keys (usually fine, verify intent): {sorted(extra)}")

sys.exit(1 if fail else 0)
