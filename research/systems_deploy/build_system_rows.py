"""Generate {nfl,cfb,mlb}_system_rows RPCs + refactor the aggregates to consume them.

Anti-drift design for the Systems leaderboard: the aggregate page RPCs and the nightly
grading job must NEVER disagree, so the filter WHERE + hit/profit math is extracted from
each LIVE {sport}_analysis definition into a shared rows-returning function, and the
aggregate is rewritten to `SELECT * FROM {sport}_system_rows(...)`. One WHERE, two readers.

system_rows adds, per matching base row:
  hit / bet_profit / under_profit  (identical expressions to the live aggregate)
  opp_hit / opp_profit             (mirror row's outcome+profit — powers 'fade' verdicts;
                                    LATERAL LIMIT 1 so duplicate mirror rows can't fan out)
MLB also carries `true AS keep_game` because its aggregate mutates that column in-place.

Run AFTER dumping live defs to rpc_live_20260722/. Emits system_rows/*.sql (create fns +
rewritten aggregates). Deployment + equivalence testing handled by the caller.
"""
import json
import os
import re
import sys
import urllib.request
from pathlib import Path

HERE = Path(__file__).resolve().parent
LIVE = HERE / "rpc_live_20260722"
OUT = HERE / "system_rows"
OUT.mkdir(exist_ok=True)

API = "https://api.supabase.com/v1/projects/jpxnjuwglavsjbgbasnl/database/query"
PAT = os.environ["SUPABASE_PAT"]


def q(sql):
    req = urllib.request.Request(API, data=json.dumps({"query": sql}).encode(), method="POST",
                                 headers={"Authorization": f"Bearer {PAT}", "Content-Type": "application/json",
                                          "User-Agent": "SupabaseCLI/1.0"})
    return json.load(urllib.request.urlopen(req, timeout=120))


SPORTS = {
    "nfl": {"base": "nfl_analysis_base", "game_key": "unique_id", "team_col": "team_abbr",
            "side_types": "('fg_spread','fg_ml','h1_spread','h1_ml')"},
    # CFB identifies teams by full school name — there is no team_abbr column.
    "cfb": {"base": "cfb_analysis_base", "game_key": "unique_id", "team_col": "team",
            "side_types": "('fg_spread','fg_ml','h1_spread','h1_ml')"},
    "mlb": {"base": "mlb_analysis_base", "game_key": "game_pk", "team_col": "team_abbr",
            "side_types": "('ml','rl','f5_ml','f5_rl')"},
}


def hoist_filters(where):
    """Replace per-row p_filters extractions with one-shot columns from a 1-row
    cross-joined subquery (SQL fns never constant-fold params: ~25-90ms/call saved)."""
    keys_t = sorted(set(re.findall(r"p_filters->>'([a-z0-9_]+)'", where)))
    keys_j = sorted(set(re.findall(r"p_filters->'([a-z0-9_]+)'", where)) - set(keys_t))
    w = re.sub(r"p_filters->>'([a-z0-9_]+)'", r'f."\1_t"', where)
    w = re.sub(r"p_filters->'([a-z0-9_]+)'", r'f."\1_j"', w)
    cols = [f"p_filters->>'{k}' AS \"{k}_t\"" for k in keys_t] + \
           [f"p_filters->'{k}' AS \"{k}_j\"" for k in keys_j]
    sub = "CROSS JOIN LATERAL (SELECT " + ",\n    ".join(cols) + " OFFSET 0) f"
    return w, sub


def must_count(hay, needle, n, label):
    c = hay.count(needle)
    if c != n:
        sys.exit(f"ANCHOR FAIL [{label}]: expected {n}x {needle!r}, found {c}")


for sport, cfg in SPORTS.items():
    src = (LIVE / f"{sport}_analysis.sql").read_text()
    base = cfg["base"]

    # ── extract the computed-cols block (between 'SELECT b.*,' and 'FROM {base} b') ──
    must_count(src, "SELECT b.*,", 1, sport)
    must_count(src, f"FROM {base} b\n  WHERE", 1, sport)
    comp = src.split("SELECT b.*,", 1)[1].split(f"FROM {base} b\n  WHERE", 1)[0].rstrip().rstrip(",")

    # ── extract the WHERE body (from that anchor to the ';' that ends the temp-table stmt) ──
    after = src.split(f"FROM {base} b\n  WHERE", 1)[1]
    m = re.search(r";\s*\n", after)
    where = after[:m.start()]

    # ── column list of the base table, in attnum order, with real types ──
    cols = q(f"""select a.attname, format_type(a.atttypid, a.atttypmod) as t
                 from pg_attribute a where a.attrelid='public.{base}'::regclass
                 and a.attnum>0 and not a.attisdropped order by a.attnum;""")
    col_defs = ",\n  ".join(f'"{c["attname"]}" {c["t"]}' for c in cols)

    # opponent-mirror versions of the hit/bet_profit expressions (b. -> o.)
    hit_expr = comp.split("END AS hit")[0] + "END"
    must_count(comp, "END AS hit", 1, f"{sport} hit anchor")
    profit_expr = comp.split("END AS hit,", 1)[1].split("END AS bet_profit")[0] + "END"
    must_count(comp, "END AS bet_profit", 1, f"{sport} profit anchor")
    o_hit = hit_expr.replace("b.", "o.")
    o_profit = profit_expr.replace("b.", "o.")

    where_hoisted, f_sub = hoist_filters(where)
    fn = f"""CREATE OR REPLACE FUNCTION public.{sport}_system_rows(p_bet_type text, p_filters jsonb DEFAULT '{{}}'::jsonb, p_include_opp boolean DEFAULT true)
 RETURNS TABLE(
  {col_defs},
  hit integer,
  bet_profit numeric,
  under_profit numeric,{'''
  keep_game boolean,''' if sport == 'mlb' else ''}
  opp_hit integer,
  opp_profit numeric)
 LANGUAGE sql
 STABLE
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT b.*,
    {comp},
    opp.o_hit::integer AS opp_hit,
    opp.o_profit::numeric AS opp_profit
  FROM {base} b
  {f_sub}
  LEFT JOIN LATERAL (
    SELECT
      {o_hit} AS o_hit,
      {o_profit} AS o_profit
    FROM {base} o
    -- upper(): case-blind so a mixed-case duplicate row can never self-match.
    -- ORDER BY: deterministic mirror if a >2-row game ever appears.
    WHERE p_include_opp AND p_bet_type IN {cfg['side_types']}
      AND o.{cfg['game_key']} = b.{cfg['game_key']} AND upper(o.{cfg['team_col']}) <> upper(b.{cfg['team_col']})
    ORDER BY o.{cfg['team_col']}
    LIMIT 1
  ) opp ON true
  WHERE {where_hoisted};
$function$"""
    (OUT / f"{sport}_system_rows.sql").write_text(fn)

    # ── rewritten aggregate: temp table now sources from system_rows ──
    head, _rest = src.split("SELECT b.*,", 1)
    tail = after[m.end():]
    agg = (head
           + f"SELECT * FROM public.{sport}_system_rows(p_bet_type, p_filters, false);\n"
           + tail)
    # sanity: the rewritten aggregate must keep its DELETE + aggregation logic
    must_count(agg, "DELETE FROM _f WHERE hit IS NULL", 1, f"{sport} agg delete")
    (OUT / f"{sport}_analysis_refactored.sql").write_text(agg)
    print(f"{sport}: {len(cols)} base cols; system_rows + refactored aggregate written")

print("done")
