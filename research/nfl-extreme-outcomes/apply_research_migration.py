"""Apply SQL migrations to the research Supabase project (jpxnjuwglavsjbgbasnl).

Uses DATABASE_URL when available (direct postgres). Falls back to probing known
Supabase SQL endpoints with the service role key.

Usage:
  python3 apply_research_migration.py supabase/migrations/20260622120000_nfl_outliers_trend_cards.sql
"""
from __future__ import annotations

import json
import os
import sys
import urllib.error
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent.parent  # repo root (new-wagerproof)
RESEARCH_REF = "jpxnjuwglavsjbgbasnl"
BASE = f"https://{RESEARCH_REF}.supabase.co"


def load_service_key() -> str:
    if os.environ.get("SUPABASE_SERVICE_KEY"):
        return os.environ["SUPABASE_SERVICE_KEY"]
    env = ROOT / ".env.local"
    if env.exists():
        for line in env.read_text().splitlines():
            if line.startswith("SUPABASE_SERVICE_KEY="):
                return line.split("=", 1)[1].strip()
    sys.exit("SUPABASE_SERVICE_KEY not found")


def database_url() -> str | None:
    if os.environ.get("DATABASE_URL"):
        return os.environ["DATABASE_URL"]
    env = ROOT / ".env.local"
    if env.exists():
        for line in env.read_text().splitlines():
            if line.startswith("DATABASE_URL="):
                return line.split("=", 1)[1].strip()
    return None


def apply_via_psycopg2(url: str, ddl: str) -> bool:
    try:
        import psycopg2
    except ImportError:
        return False
    conn = psycopg2.connect(url)
    conn.autocommit = True
    with conn.cursor() as cur:
        cur.execute(ddl)
    conn.close()
    return True


def apply_via_http(key: str, ddl: str) -> bool:
    """Try Supabase dashboard / pg-meta style endpoints (service role)."""
    payloads = [
        ("POST", f"{BASE}/pg/query", {"query": ddl}),
        ("POST", f"{BASE}/api/pg-meta/default/query", {"query": ddl}),
        ("POST", f"{BASE}/api/platform/pg-meta/{RESEARCH_REF}/query", {"query": ddl}),
    ]
    headers = {
        "apikey": key,
        "Authorization": f"Bearer {key}",
        "Content-Type": "application/json",
    }
    for method, url, body in payloads:
        req = urllib.request.Request(
            url, data=json.dumps(body).encode(), headers=headers, method=method,
        )
        try:
            with urllib.request.urlopen(req, timeout=60) as resp:
                if resp.status in (200, 201, 204):
                    print(f"applied via {url}")
                    return True
        except urllib.error.HTTPError as e:
            err = e.read(300).decode(errors="replace")
            print(f"  {url} -> {e.code} {err[:120]}")
        except Exception as e:
            print(f"  {url} -> {e}")
    return False


def table_exists(key: str, table: str) -> bool:
    url = f"{BASE}/rest/v1/{table}?limit=0"
    req = urllib.request.Request(url, headers={"apikey": key, "Authorization": f"Bearer {key}"})
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            return resp.status == 200
    except urllib.error.HTTPError as e:
        return e.code == 200


def main():
    if len(sys.argv) < 2:
        sys.exit(f"usage: {sys.argv[0]} <path-to.sql>")
    sql_path = Path(sys.argv[1])
    if not sql_path.is_absolute():
        sql_path = ROOT / sql_path
    ddl = sql_path.read_text()
    key = load_service_key()

    if table_exists(key, "nfl_outliers_trend_cards"):
        print("nfl_outliers_trend_cards already exists")
        return

    url = database_url()
    if url and apply_via_psycopg2(url, ddl):
        print(f"applied {sql_path.name} via DATABASE_URL")
        return

    if apply_via_http(key, ddl):
        return

    sys.exit(
        f"Could not apply {sql_path.name}. Add DATABASE_URL to .env.local "
        f"(Supabase pooler URI for {RESEARCH_REF}) or run the SQL in the dashboard."
    )


if __name__ == "__main__":
    main()
