"""Deploy as-of Systems features to *_analysis_base via the Supabase Management API.

Steps per sport: (1) ALTER base table (add columns, idempotent), (2) merge computed values in
batches (VALUES → UPDATE...FROM), (3) probe. Management API runs SQL (service key can't do DDL).

Usage:  SUPABASE_PAT=sbp_xxx python3 deploy_asof.py cfb|nfl
Token is read from env only (never written to disk). See 04_ASOF_AGGREGATION_SPEC.md.
"""
import json
import math
import os
import sys
import time
import urllib.request

import pyarrow.parquet as pq

REF = "jpxnjuwglavsjbgbasnl"
API = f"https://api.supabase.com/v1/projects/{REF}/database/query"
PAT = os.environ.get("SUPABASE_PAT") or sys.exit("set SUPABASE_PAT")

CFG = {
    "cfb": {"table": "cfb_analysis_base",
            "parquet": "../cfb-model/asof/asof_cfb.parquet",
            "alter": "../cfb-model/asof/asof_alter_cfb.sql",
            "gid_cast": "bigint"},
    "nfl": {"table": "nfl_analysis_base",
            "parquet": "../nfl-extreme-outcomes/asof/asof_nfl.parquet",
            "alter": "../nfl-extreme-outcomes/asof/asof_alter_nfl.sql",
            "gid_cast": "text"},
}

BOOLS = {"team_made_playoffs_prev", "opp_made_playoffs_prev", "h2h_same_season",
         "h2h_last_home", "h2h_last_fav"}


def pgtype(c):
    if c in BOOLS:
        return "boolean"
    if any(k in c for k in ["_pct", "_margin", "_ppg", "_pa_pg", "_point_diff", "_spread", "_total", "_ml"]):
        return "numeric"
    return "integer"


def q(sql, tries=3):
    body = json.dumps({"query": sql}).encode()
    req = urllib.request.Request(API, data=body, method="POST", headers={
        "Authorization": f"Bearer {PAT}", "Content-Type": "application/json",
        "User-Agent": "SupabaseCLI/1.0"})   # default UA -> Cloudflare 1010
    for a in range(tries):
        try:
            return json.load(urllib.request.urlopen(req, timeout=120))
        except urllib.error.HTTPError as e:
            msg = e.read().decode()[:400]
            if a == tries - 1:
                sys.exit(f"Management API {e.code}: {msg}")
            time.sleep(2)


def lit(v, typ):
    """Format a python value as a SQL text literal (cast happens in SET)."""
    if v is None or (isinstance(v, float) and math.isnan(v)):
        return "NULL"
    if typ == "boolean":
        return "'true'" if (v is True or v == 1) else "'false'"
    if typ == "integer":
        return f"'{int(round(float(v)))}'"
    return f"'{float(v)}'"


def main():
    sport = sys.argv[1] if len(sys.argv) > 1 else sys.exit("arg: cfb|nfl")
    cfg = CFG[sport]
    here = os.path.dirname(os.path.abspath(__file__))
    df = pq.read_table(os.path.join(here, cfg["parquet"])).to_pandas()
    feat = [c for c in df.columns if c not in ("game_id", "team")]
    print(f"[{sport}] {len(df)} rows, {len(feat)} feature cols -> {cfg['table']}")

    # 1) ALTER
    alter_sql = open(os.path.join(here, cfg["alter"])).read()
    q(alter_sql)
    print("  ALTER applied")

    # 2) merge in batches
    gcast = cfg["gid_cast"]
    setclause = ", ".join(f"{c} = v.{c}::{pgtype(c)}" for c in feat)
    collist = "game_id, team, " + ", ".join(feat)
    rows = df.to_dict("records")
    B = 400
    for i in range(0, len(rows), B):
        chunk = rows[i:i + B]
        vals = []
        for r in chunk:
            gid = str(r["game_id"]).replace("'", "''")
            team = str(r["team"]).replace("'", "''")
            cells = [f"'{gid}'", f"'{team}'"] + [lit(r[c], pgtype(c)) for c in feat]
            vals.append("(" + ", ".join(cells) + ")")
        sql = (f"UPDATE public.{cfg['table']} b SET {setclause} "
               f"FROM (VALUES {', '.join(vals)}) AS v({collist}) "
               f"WHERE b.game_id = v.game_id::{gcast} AND b.team = v.team;")
        q(sql)
        print(f"  merged {min(i + B, len(rows))}/{len(rows)}", end="\r")
    print(f"\n  merge complete ({len(rows)} rows)")

    # 3) probe
    t = cfg["table"]
    p = q(f"""select count(*) n,
                     count(team_win_pct) has_winpct,
                     round(avg(team_win_pct) filter (where team_gp_s2d >= 4)::numeric,3) win_pct_mid,
                     round(avg(team_over_pct) filter (where team_gp_s2d >= 4)::numeric,3) over_pct_mid,
                     count(h2h_last_win) has_h2h,
                     count(team_prev_win_pct) has_prev
              from public.{t};""")
    print("  PROBE:", p[0] if p else p)


if __name__ == "__main__":
    main()
