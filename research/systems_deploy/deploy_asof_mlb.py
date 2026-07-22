"""Merge asof_mlb.parquet into mlb_analysis_base (MLB flavor of deploy_asof.py).

Separate from deploy_asof.py because MLB differs in both key (game_pk, team_abbr — not
game_id, team) and typing: MLB has numeric cols the generic heuristics misclassify
(team_rpg/rapg/run_diff_pg -> would round to int) plus a text col (opp_prev_result), so
column types come from information_schema instead of name patterns.

Usage: SUPABASE_PAT=sbp_xxx python3 deploy_asof_mlb.py
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
HERE = os.path.dirname(os.path.abspath(__file__))


def q(sql, tries=3):
    req = urllib.request.Request(API, data=json.dumps({"query": sql}).encode(), method="POST",
                                 headers={"Authorization": f"Bearer {PAT}", "Content-Type": "application/json",
                                          "User-Agent": "SupabaseCLI/1.0"})
    for a in range(tries):
        try:
            return json.load(urllib.request.urlopen(req, timeout=180))
        except urllib.error.HTTPError as e:
            msg = e.read().decode()[:400]
            if a == tries - 1:
                sys.exit(f"Management API {e.code}: {msg}")
            time.sleep(2)


def lit(v, typ):
    if v is None or (isinstance(v, float) and math.isnan(v)):
        return "NULL"
    if typ == "boolean":
        return "'true'" if (v is True or v == 1) else "'false'"
    if typ in ("integer", "bigint", "smallint"):
        return f"'{int(round(float(v)))}'"
    if typ == "text":
        return "'" + str(v).replace("'", "''") + "'"
    return f"'{float(v)}'"


def main():
    df = pq.read_table(os.path.join(HERE, "asof_mlb.parquet")).to_pandas()
    feat = [c for c in df.columns if c not in ("game_pk", "team_abbr")]

    types = {r["column_name"]: r["data_type"] for r in q(
        "select column_name, data_type from information_schema.columns "
        "where table_schema='public' and table_name='mlb_analysis_base';")}
    missing = [c for c in feat if c not in types]
    if missing:
        sys.exit(f"columns absent from table (run the ALTER first): {missing}")
    typ = {c: ("numeric" if types[c] == "numeric" else
               "boolean" if types[c] == "boolean" else
               "text" if types[c] == "text" else "integer") for c in feat}
    print(f"{len(df)} rows, {len(feat)} feature cols -> mlb_analysis_base")

    setclause = ", ".join(f"{c} = v.{c}::{typ[c]}" for c in feat)
    collist = "game_pk, team_abbr, " + ", ".join(feat)
    rows = df.to_dict("records")
    B = 400
    for i in range(0, len(rows), B):
        vals = []
        for r in rows[i:i + B]:
            cells = [f"'{int(r['game_pk'])}'", "'" + str(r["team_abbr"]).replace("'", "''") + "'"] \
                    + [lit(r[c], typ[c]) for c in feat]
            vals.append("(" + ", ".join(cells) + ")")
        q(f"UPDATE public.mlb_analysis_base b SET {setclause} "
          f"FROM (VALUES {', '.join(vals)}) AS v({collist}) "
          f"WHERE b.game_pk = v.game_pk::bigint AND b.team_abbr = v.team_abbr;")
        print(f"  merged {min(i + B, len(rows))}/{len(rows)}", end="\r", flush=True)
    print(f"\nmerge complete ({len(rows)} rows)")

    probe = q("""select count(*) n, count(team_win_pct) win_pct, count(team_win_streak) streak,
      count(opp_win_pct) opp, count(h2h_last_win) h2h,
      round(avg(team_win_pct) filter (where team_gp_s2d >= 20)::numeric, 3) mid_win_pct,
      count(*) filter (where team_win_streak >= 9) streak9
      from mlb_analysis_base;""")[0]
    print("probe:", probe)


if __name__ == "__main__":
    main()
