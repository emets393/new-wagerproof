#!/usr/bin/env python3
"""Dump live public.cfb_analysis(text,jsonb) into cab_builder/cfb_analysis_rpc.sql.

Uses the Supabase Management API (service role cannot run pg_get_functiondef).

  export SUPABASE_ACCESS_TOKEN=sbp_…   # https://supabase.com/dashboard/account/tokens
  python3 cab_builder/dump_cfb_analysis_rpc.py

Project ref is hardcoded to the CFB warehouse (jpxnjuwglavsjbgbasnl).
"""
from __future__ import annotations

import json
import os
import sys
import urllib.request

REF = "jpxnjuwglavsjbgbasnl"
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "cfb_analysis_rpc.sql")
SQL = "SELECT pg_get_functiondef('public.cfb_analysis(text,jsonb)'::regprocedure) AS def;"


def main():
    token = os.environ.get("SUPABASE_ACCESS_TOKEN")
    if not token:
        print(
            "Set SUPABASE_ACCESS_TOKEN (personal access token) to dump the live function.\n"
            "Until then, cfb_analysis_rpc.sql keeps the verified weather/dome predicate notes.",
            file=sys.stderr,
        )
        sys.exit(2)

    url = f"https://api.supabase.com/v1/projects/{REF}/database/query"
    req = urllib.request.Request(
        url,
        data=json.dumps({"query": SQL}).encode(),
        headers={
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
        },
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=60) as resp:
        payload = json.loads(resp.read().decode())

    # Management API returns a list of row dicts or {result: [...]}
    rows = payload if isinstance(payload, list) else payload.get("result") or payload.get("data") or []
    if not rows:
        raise SystemExit(f"unexpected response: {payload!r[:500]}")
    defn = rows[0].get("def") or rows[0].get("pg_get_functiondef")
    if not defn:
        raise SystemExit(f"no function def in row: {rows[0]!r}")

    # Ensure weather/dome predicates are present
    for needle in (
        "p_filters->>'weather'",
        "b.weather_condition",
        "p_filters->>'dome'",
        "b.dome",
    ):
        if needle not in defn:
            raise SystemExit(f"live function missing expected fragment: {needle}")

    header = (
        "-- Auto-dumped from warehouse jpxnjuwglavsjbgbasnl via dump_cfb_analysis_rpc.py\n"
        "-- Do not hand-edit; re-run the dump after any SQL change to cfb_analysis.\n\n"
    )
    with open(OUT, "w") as f:
        f.write(header)
        f.write(defn)
        if not defn.endswith(";\n"):
            f.write(";\n" if defn.endswith(";") else ";\n")
    print(f"wrote {OUT} ({len(defn):,} chars)")


if __name__ == "__main__":
    main()
