#!/usr/bin/env python3
"""Backfill one historical season of Fantasy Points data into Supabase `fp_data`, with guards.

fp_load.py defaults to the current + prior season because the full 2021+ warehouse is large and a
past bulk jsonb load pushed this instance's disk into read-only (see the mlb-props-odds-backfill
memory). This wrapper makes a historical season safe to add:

  * measures database size before and after and prints the real cost per row
  * REFUSES to start if the database is already above --ceiling-gb
  * REFUSES to start if the projected post-load size would cross that ceiling
  * verifies the database is still writable afterwards, which is the failure mode that actually
    hurt us — a read-only instance breaks every writer, not just this one

Run one season at a time, newest first, so that stopping early still leaves the most useful data:
    python3 fp_backfill.py 2024
    python3 fp_backfill.py 2023   ... etc

The load itself is fp_load.py, which upserts on (tool, scope, season, week, entity_id), so a
re-run is idempotent and an interrupted run can simply be repeated.
"""
import json, os, pathlib, subprocess, sys, time, urllib.error, urllib.request

HERE = pathlib.Path(__file__).resolve().parent
REF = "jpxnjuwglavsjbgbasnl"
# Supabase does not expose the disk ceiling over the Management API, so it is a parameter. The
# default is deliberately conservative: stop well short of a plausible 8 GB allocation and let a
# human confirm the real number from the dashboard before going further.
DEFAULT_CEILING_GB = 7.0


def pat():
    for fn in (HERE.parent.parent / ".env.local", HERE.parent.parent / ".env"):
        if fn.exists():
            for line in fn.read_text().splitlines():
                if line.startswith("SUPABASE_PAT="):
                    return line.split("=", 1)[1].strip()
    k = os.environ.get("SUPABASE_PAT")
    if not k:
        sys.exit("[fp-backfill] SUPABASE_PAT missing (needed to measure database size)")
    return k


def q(sql):
    r = urllib.request.Request(
        f"https://api.supabase.com/v1/projects/{REF}/database/query",
        data=json.dumps({"query": sql}).encode(),
        headers={"Authorization": f"Bearer {pat()}", "Content-Type": "application/json",
                 "User-Agent": "SupabaseCLI/2.107.0"})
    try:
        return json.load(urllib.request.urlopen(r))
    except urllib.error.HTTPError as e:
        sys.exit(f"[fp-backfill] management query failed: {e.read().decode()[:300]}")


def db_gb():
    return float(q("select pg_database_size(current_database()) b")[0]["b"]) / 1e9


def writable():
    """A disk-full instance goes read-only; that is the state worth proving we are not in."""
    q("create table if not exists public._fp_write_probe (id int primary key)")
    q("insert into public._fp_write_probe values (1) on conflict (id) do nothing")
    q("drop table public._fp_write_probe")
    return True


def main():
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    season = int(sys.argv[1])
    ceiling = float(os.environ.get("FP_CEILING_GB", DEFAULT_CEILING_GB))

    have = q(f"select count(*) n from public.fp_data where season = {season}")[0]["n"]
    rows_on_disk = len(list((HERE / "data/fpdata/raw").rglob(f"{season}_w*.json")))
    if rows_on_disk == 0:
        sys.exit(f"[fp-backfill] no raw cells on disk for {season} — nothing to load")

    before = db_gb()
    fp_before = q("select count(*) n, pg_total_relation_size('public.fp_data') b from public.fp_data")[0]
    per_row = float(fp_before["b"]) / max(int(fp_before["n"]), 1)
    # Project from the seasons ALREADY loaded rather than from the parquet mirror. Reading 124
    # parquet files through pandas just to count rows cost more memory than the load itself and
    # got this script OOM-killed mid-season; row counts per season are stable (~340k) so the
    # loaded seasons are a better and free estimator.
    est = q("""select round(avg(n)) r from (
                 select count(*) n from public.fp_data group by season having count(*) > 50000) t""")
    seen = int(est[0]["r"]) if est and est[0].get("r") else 0
    already = int(have)
    projected_gb = max(seen - already, 0) * per_row / 1e9

    print(f"[fp-backfill] season {season}: {rows_on_disk} raw cells, {have:,} rows already loaded")
    print(f"[fp-backfill] database now {before:.2f} GB | fp_data {int(fp_before['n']):,} rows "
          f"@ {per_row:.0f} B/row")
    if seen:
        print(f"[fp-backfill] projected +{seen:,} rows ≈ +{projected_gb:.2f} GB "
              f"-> {before + projected_gb:.2f} GB (ceiling {ceiling:.1f} GB)")

    if before >= ceiling:
        sys.exit(f"[fp-backfill] ABORT: already at {before:.2f} GB, at or above the {ceiling:.1f} GB ceiling")
    if projected_gb and before + projected_gb > ceiling:
        sys.exit(f"[fp-backfill] ABORT: projected {before + projected_gb:.2f} GB would cross the "
                 f"{ceiling:.1f} GB ceiling. Raise FP_CEILING_GB only after confirming the real "
                 f"disk allocation in the Supabase dashboard.")

    t0 = time.time()
    r = subprocess.run([sys.executable, str(HERE / "fp_load.py"), "--seasons", f"{season}-{season}"],
                       cwd=HERE)
    if r.returncode != 0:
        print(f"[fp-backfill] fp_load exited {r.returncode} — re-running this season is safe (upsert)")

    after = db_gb()
    fp_after = q("select count(*) n, pg_total_relation_size('public.fp_data') b from public.fp_data")[0]
    added = int(fp_after["n"]) - int(fp_before["n"])
    print(f"\n[fp-backfill] added {added:,} rows in {time.time()-t0:.0f}s")
    print(f"[fp-backfill] database {before:.2f} -> {after:.2f} GB (+{after-before:.2f} GB)")
    if added:
        print(f"[fp-backfill] actual cost {(float(fp_after['b'])-float(fp_before['b']))/added:.0f} B/row")
    writable()
    print(f"[fp-backfill] write probe OK — instance is not read-only")
    print(f"[fp-backfill] headroom to ceiling: {ceiling - after:.2f} GB")


if __name__ == "__main__":
    main()
