"""Run the heavy grading RPCs over a DIRECT DB connection (psycopg2), so the daily
grade cron never depends on the `psql` binary being present on the Render runtime.

These two RPCs scan large prop/pick tables and exceed PostgREST's 8s API timeout, so
they must run over DATABASE_URL (the Supabase pooler/direct URI provisioned in the
wagerproof-model-secrets env group) — exactly as grade_week.sh's old psql path did.

  1) grade_nfl_props(season, week)        for weeks 1-22  -> nfl_player_props.result
  2) refresh_all_signal_performance(season)               -> grades NFL+CFB picks, rolls up signal_performance

Idempotent (both RPCs only touch ungraded rows / rebuild for the season). If DATABASE_URL
is absent, prints a clear note and exits 0 (so the rest of the grade run still succeeds).

Usage:  python3 run_grade_rpcs.py <season>
"""
import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent


def database_url():
    if os.environ.get("DATABASE_URL"):
        return os.environ["DATABASE_URL"]
    env = ROOT.parent.parent / ".env.local"
    if env.exists():
        for line in env.read_text().splitlines():
            if line.startswith("DATABASE_URL="):
                return line.split("=", 1)[1].strip()
    return None


def main():
    season = int(sys.argv[1]) if len(sys.argv) > 1 else int(os.environ.get("NFL_SEASON", 2026))
    url = database_url()
    if not url:
        print("  [skip] DATABASE_URL not set — grading RPCs not run. "
              "Set DATABASE_URL (Supabase pooler URI) in the env group to enable.")
        return 0
    try:
        import psycopg2
    except ImportError:
        print("  [skip] psycopg2 not installed — add psycopg2-binary to requirements.txt.")
        return 0

    conn = psycopg2.connect(url)
    conn.autocommit = True
    with conn.cursor() as cur:
        # direct connection isn't under the API 8s cap, but set a generous bound anyway
        cur.execute("set statement_timeout = '300s';")

        print(f">>> grade_nfl_props weeks 1-22 (season {season})")
        cur.execute(
            "select gs.w as week, grade_nfl_props(%s, gs.w) as graded "
            "from generate_series(1,22) gs(w);", (season,))
        graded = [(w, g) for w, g in cur.fetchall() if g]
        print(f"    graded weeks: {graded if graded else '(none ungraded)'}")

        print(f">>> refresh_all_signal_performance(season {season})")
        cur.execute("select * from refresh_all_signal_performance(%s);", (season,))
        try:
            print(f"    {cur.fetchall()}")
        except psycopg2.ProgrammingError:
            print("    done")
    conn.close()
    return 0


if __name__ == "__main__":
    sys.exit(main())
