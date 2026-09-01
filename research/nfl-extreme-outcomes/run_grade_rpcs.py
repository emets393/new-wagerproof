"""Run the heavy grading RPCs over a DIRECT DB connection (psycopg2), so the daily
grade cron never depends on the `psql` binary being present on the Render runtime.

These RPCs scan large prop/pick tables and exceed PostgREST's 8s API timeout, so they
must run over DATABASE_URL (the Supabase pooler/direct URI from the wagerproof-model-secrets
env group) or through the Supabase Management API (SUPABASE_PAT).

  1) grade_nfl_props(season, week) + grade_nfl_props_dnp_void  -> nfl_player_props.result
  2) refresh_all_signal_performance(season)  -> grades NFL+CFB picks, rolls up signal_performance
  3) refresh_{nfl,cfb}_analysis_base(season) -> appends completed games to the trends warehouse

Credential resolution (2026-09-01 hardening — the cron failed all season-opening weekend
with the RPCs never running; see .claude/docs/agents/14_SEASON_2026_PIPELINE_READINESS.md
op-hardening item): try DATABASE_URL first; if the connection or SQL fails, FALL BACK to
the Management API instead of crashing the whole grade run. Management API calls retry
transient 5xx/429/network errors. Only when every available path fails does this exit 1 —
and it says exactly which call failed with what status, so the Render log names the fix.

If neither credential is set, prints a clear note and exits 0 (so the rest of the grade
run still succeeds).

Usage:  python3 run_grade_rpcs.py <season>
"""
import os
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parent


def env_var(name):
    if os.environ.get(name):
        return os.environ[name]
    env = ROOT.parent.parent / ".env.local"
    if env.exists():
        for line in env.read_text().splitlines():
            if line.startswith(name + "="):
                return line.split("=", 1)[1].strip() or None
    return None


def run_direct(url, season):
    """psycopg2 over DATABASE_URL. Raises on any failure (caller falls back)."""
    import psycopg2

    conn = psycopg2.connect(url, connect_timeout=30)
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

        print(f">>> grade_nfl_props_dnp_void weeks 1-22 (season {season})")
        cur.execute(
            "select gs.w as week, grade_nfl_props_dnp_void(%s, gs.w) as voided "
            "from generate_series(1,22) gs(w);", (season,))
        voided = [(w, v) for w, v in cur.fetchall() if v]
        print(f"    voided (DNP) weeks: {voided if voided else '(none)'}")

        print(f">>> refresh_all_signal_performance(season {season})")
        cur.execute("select * from refresh_all_signal_performance(%s);", (season,))
        try:
            print(f"    {cur.fetchall()}")
        except Exception:
            print("    done")

        # Append completed games into the historical-trends warehouses (Stage 1;
        # Stage 2 = refresh_analysis_asof.sh, run after in grade_week.sh).
        print(f">>> refresh_nfl_analysis_base(season {season})")
        cur.execute("select public.refresh_nfl_analysis_base(%s);", (season,))
        print(f"    appended {cur.fetchone()[0]} NFL exploded rows")
        print(f">>> refresh_cfb_analysis_base(season {season})")
        cur.execute("select public.refresh_cfb_analysis_base(%s);", (season,))
        print(f"    appended {cur.fetchone()[0]} CFB exploded rows")
    conn.close()


def run_mgmt_api(pat, season):
    """Supabase Management API path (no DB password needed). Returns 0/1."""
    import requests

    ok = True
    # Parity with run_direct: props + DNP voids + signal rollup + BOTH analysis-base refreshes.
    for label, sql in ((f"grade_nfl_props {season}",
                        "; ".join(f"SELECT grade_nfl_props({season}, {w})" for w in range(1, 23))),
                       (f"grade_nfl_props_dnp_void {season}",
                        "; ".join(f"SELECT grade_nfl_props_dnp_void({season}, {w})" for w in range(1, 23))),
                       (f"refresh_all_signal_performance {season}",
                        f"SELECT refresh_all_signal_performance({season})"),
                       (f"refresh_nfl_analysis_base {season}",
                        f"SELECT public.refresh_nfl_analysis_base({season})"),
                       (f"refresh_cfb_analysis_base {season}",
                        f"SELECT public.refresh_cfb_analysis_base({season})")):
        # Retry transient failures (5xx/429/network) — a single Supabase 502 used to
        # fail the whole grade run. 4xx (bad PAT, SQL error) is real: no retry.
        good, last = False, "no attempt"
        for attempt in range(4):
            try:
                r = requests.post(
                    "https://api.supabase.com/v1/projects/jpxnjuwglavsjbgbasnl/database/query",
                    headers={"Authorization": f"Bearer {pat}", "User-Agent": "SupabaseCLI/1.0",
                             "Content-Type": "application/json"},
                    json={"query": sql}, timeout=300)
                # Management API answers 200 OR 201 on success (201 observed live 2026-08-07).
                if r.status_code in (200, 201):
                    good = True
                    break
                last = f"HTTP {r.status_code} — {r.text[:200]}"
                if r.status_code < 500 and r.status_code != 429:
                    break
            except requests.RequestException as e:
                last = f"{type(e).__name__}: {e}"
            time.sleep(3 * (attempt + 1))
        print(f"  [mgmt-api] {label}: " + ("ok" if good else f"FAILED after retries ({last})"))
        ok = ok and good
    return 0 if ok else 1


def main():
    season = int(sys.argv[1]) if len(sys.argv) > 1 else int(os.environ.get("NFL_SEASON", 2026))
    url = env_var("DATABASE_URL")
    pat = env_var("SUPABASE_PAT")

    if url:
        try:
            run_direct(url, season)
            return 0
        except ImportError:
            print("  [direct] psycopg2 not installed — trying Management API fallback")
        except Exception as e:
            # A set-but-broken DATABASE_URL used to crash here uncaught, exit-1-ing the
            # grade cron daily with the RPCs never running. Fall back instead.
            print(f"  [direct] DATABASE_URL path failed ({type(e).__name__}: {e}) — "
                  f"trying Management API fallback")
        if not pat:
            print("  [FAIL] direct path failed and SUPABASE_PAT is not set — grading RPCs did not run.")
            return 1

    if pat:
        return run_mgmt_api(pat, season)

    print("  [skip] neither DATABASE_URL nor SUPABASE_PAT set — grading RPCs not run.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
