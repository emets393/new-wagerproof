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
        # FALLBACK (2026-08-05): the Supabase Management API runs SQL with a personal
        # access token and no statement timeout — the proven path this repo uses for DDL.
        # Lets the daily grade cron run the heavy RPCs without the DB password.
        pat = os.environ.get("SUPABASE_PAT")
        if not pat:
            env = ROOT.parent.parent / ".env.local"
            if env.exists():
                for line in env.read_text().splitlines():
                    if line.startswith("SUPABASE_PAT="):
                        pat = line.split("=", 1)[1].strip()
        if pat:
            import requests
            ok = True
            for label, sql in ((f"grade_nfl_props {season}",
                                "; ".join(f"SELECT grade_nfl_props({season}, {w})" for w in range(1, 23))),
                               (f"refresh_all_signal_performance {season}",
                                f"SELECT refresh_all_signal_performance({season})")):
                r = requests.post(
                    "https://api.supabase.com/v1/projects/jpxnjuwglavsjbgbasnl/database/query",
                    headers={"Authorization": f"Bearer {pat}", "User-Agent": "SupabaseCLI/1.0",
                             "Content-Type": "application/json"},
                    json={"query": sql}, timeout=300)
                print(f"  [mgmt-api] {label}: HTTP {r.status_code}")
                ok = ok and r.status_code == 200
            return 0 if ok else 1
        print("  [skip] neither DATABASE_URL nor SUPABASE_PAT set — grading RPCs not run.")
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

        # Append completed games into the historical-trends warehouses (/nfl-analytics,
        # /cfb-analytics, Systems). Stage 1 = the per-game facts (these RPCs). Stage 2 =
        # asof_features_{nfl,cfb}.py fills the season-to-date/streak/h2h columns (run after,
        # in grade_week.sh). Scoped to the live season; idempotent full re-insert.
        print(f">>> refresh_nfl_analysis_base(season {season})")
        cur.execute("select public.refresh_nfl_analysis_base(%s);", (season,))
        print(f"    appended {cur.fetchone()[0]} NFL exploded rows")
        print(f">>> refresh_cfb_analysis_base(season {season})")
        cur.execute("select public.refresh_cfb_analysis_base(%s);", (season,))
        print(f"    appended {cur.fetchone()[0]} CFB exploded rows")
    conn.close()
    return 0


if __name__ == "__main__":
    sys.exit(main())
