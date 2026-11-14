#!/usr/bin/env python3
"""PATCH fp_cards onto nfl_prop_player_pages without touching any other column.

WHY THIS EXISTS. The card blobs are built by fp_prop_payload.py into a parquet, and the only thing
that moves them into the database is gen_nfl_prop_player_pages.py — which DELETEs and reinserts the
whole week (line ~758). That is fine on the Render box that has the parquet AND fresh inputs, but
it is the wrong tool twice over:

  * on a box whose FP warehouse is a week behind prod, a full rebuild regresses every other column
    on all ~387 rows to fix one;
  * when the weekly job fails or is skipped, fp_cards is simply never written, and the hourly
    rebuild's carry-forward (fp_cards_layer._from_db) has nothing to carry — which is exactly how
    2026 week 5 ended up with 0 of 387 populated while a perfectly good payload sat on disk.

So: read the payload, PATCH one column, leave the rest alone. Additive, re-runnable, and safe to
point at a week that already has cards.

Usage:
  push_fp_cards.py --season 2026 --week 5              # dry run, reports coverage
  push_fp_cards.py --season 2026 --week 5 --write      # PATCH
"""
import argparse
import json
import os
import sys
from pathlib import Path

import requests

HERE = Path(__file__).resolve().parent
BASE = "https://jpxnjuwglavsjbgbasnl.supabase.co/rest/v1"
TABLE = "nfl_prop_player_pages"


def key():
    k = os.environ.get("SUPABASE_SERVICE_KEY")
    if k:
        return k
    env = HERE / ".." / ".." / ".env.local"
    if env.exists():
        for ln in env.read_text().splitlines():
            if ln.startswith("SUPABASE_SERVICE_KEY="):
                return ln.split("=", 1)[1].strip().strip('"')
    sys.exit("no SUPABASE_SERVICE_KEY")


def page_rows(h, season, week):
    """Every page row for the slate: player_id -> whether it already has cards."""
    out, off = {}, 0
    while True:
        r = requests.get(f"{BASE}/{TABLE}?season=eq.{season}&week=eq.{week}"
                         f"&select=player_id,player_name,fp_cards&limit=500&offset={off}",
                         headers=h, timeout=90)
        r.raise_for_status()
        j = r.json()
        for row in j:
            out[str(row["player_id"])] = (row.get("player_name"), row.get("fp_cards") is not None)
        if len(j) < 500:
            return out
        off += 500


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--season", type=int, required=True)
    ap.add_argument("--week", type=int, required=True)
    ap.add_argument("--write", action="store_true")
    a = ap.parse_args()

    sys.path.insert(0, str(HERE))
    import fp_cards_layer as FC
    cards = FC.fetch_cards(a.season, a.week)
    if not cards:
        sys.exit(f"[push] no card blobs for {a.season} wk{a.week} — build the payload first "
                 f"(fp_prop_payload.py --season {a.season} --upcoming {a.week})")

    k = key()
    h = {"apikey": k, "Authorization": f"Bearer {k}"}
    rows = page_rows(h, a.season, a.week)
    if not rows:
        sys.exit(f"[push] no page rows for {a.season} wk{a.week} — run the page generator first")

    both = sorted(set(cards) & set(rows))
    no_page = sorted(set(cards) - set(rows))
    no_cards = sorted(set(rows) - set(cards))
    already = sum(1 for p in both if rows[p][1])

    print(f"[push] {a.season} wk{a.week}")
    print(f"  payload players with blobs : {len(cards)}")
    print(f"  page rows on the slate     : {len(rows)}")
    print(f"  matched (will patch)       : {len(both)}  ({already} already have cards)")
    print(f"  blobs with no page row     : {len(no_page)}  (no posted line — correct to drop)")
    print(f"  page rows with no blobs    : {len(no_cards)}  (thin warehouse coverage)")
    if not a.write:
        print("\n  dry run — pass --write to PATCH")
        return

    hdr = {**h, "Content-Type": "application/json", "Prefer": "return=minimal"}
    ok = fail = 0
    for i, pid in enumerate(both, 1):
        r = requests.patch(f"{BASE}/{TABLE}?season=eq.{a.season}&week=eq.{a.week}"
                           f"&player_id=eq.{pid}", headers=hdr,
                           data=json.dumps({"fp_cards": cards[pid]}), timeout=60)
        if r.status_code in (200, 204):
            ok += 1
        else:
            fail += 1
            if fail <= 3:
                print(f"  ! {pid} ({rows[pid][0]}): {r.status_code} {r.text[:140]}")
        if i % 100 == 0:
            print(f"  … {i}/{len(both)}")
    print(f"[push] patched {ok}, failed {fail}")

    after = page_rows(h, a.season, a.week)
    n = sum(1 for v in after.values() if v[1])
    print(f"[push] verify: {n} of {len(after)} page rows now carry fp_cards")


if __name__ == "__main__":
    main()
