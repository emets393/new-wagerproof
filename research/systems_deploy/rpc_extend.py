"""Extend cfb_analysis / nfl_analysis RPCs with as-of Systems filter predicates.

Dumps the live function, injects new `AND (p_filters->>'key' IS NULL OR ...)` predicates before the
season_min anchor (idempotent — skips if already present), and CREATE OR REPLACE via Management API.
All new predicates reference columns that exist in BOTH base tables, so one block serves both sports.

Usage: SUPABASE_PAT=sbp_xxx python3 rpc_extend.py
"""
import json
import os
import sys
import urllib.request

PAT = os.environ.get("SUPABASE_PAT") or sys.exit("set SUPABASE_PAT")
API = "https://api.supabase.com/v1/projects/jpxnjuwglavsjbgbasnl/database/query"
ANCHOR = "(p_filters->>'season_min' IS NULL OR b.season >= (p_filters->>'season_min')::int)"


def q(sql):
    req = urllib.request.Request(API, data=json.dumps({"query": sql}).encode(), method="POST",
        headers={"Authorization": f"Bearer {PAT}", "Content-Type": "application/json",
                 "User-Agent": "SupabaseCLI/1.0"})
    try:
        return json.load(urllib.request.urlopen(req, timeout=120))
    except urllib.error.HTTPError as e:
        sys.exit(f"Management API {e.code}: {e.read().decode()[:500]}")


# ---- new predicates ----
RANGE = {  # key -> column (adds _min/_max)
    "win_pct": "team_win_pct", "ats_win_pct": "team_ats_win_pct", "over_pct": "team_over_pct",
    "win_streak": "team_win_streak", "loss_streak": "team_loss_streak",
    "ats_win_streak": "team_ats_win_streak", "over_streak": "team_over_streak",
    "under_streak": "team_under_streak", "avg_cover_margin": "team_avg_cover_margin",
    "ppg": "team_ppg", "pa_pg": "team_pa_pg", "point_diff_pg": "team_point_diff_pg",
    "prev_wins": "team_prev_wins", "prev_win_pct": "team_prev_win_pct",
    "opp_win_pct": "opp_win_pct", "opp_ats_win_pct": "opp_ats_win_pct",
    "opp_over_pct": "opp_over_pct", "opp_win_streak": "opp_win_streak",
    "opp_prev_win_pct": "opp_prev_win_pct",
}
BOOL_COL = {  # key -> boolean column
    "above_500": None,   # special (expr)
    "made_playoffs_prev": "team_made_playoffs_prev",
    "opp_made_playoffs_prev": "opp_made_playoffs_prev",
    "h2h_last_home": "h2h_last_home", "h2h_last_fav": "h2h_last_fav",
    "h2h_same_season": "h2h_same_season",
}
INT_COL = {  # key -> 1/0 column
    "h2h_last_win": "h2h_last_win", "h2h_last_ats_win": "h2h_last_ats_win",
    "h2h_last_over": "h2h_last_over",
}
EXPR_BOOL = {  # key -> boolean expression
    "above_500": "b.team_win_pct > 0.5",
    "win_pct_gt_opp": "b.team_win_pct > b.opp_win_pct",
    "more_wins_than_opp_prev": "b.team_prev_wins > b.opp_prev_wins",
    "h2h_spread_lower": "b.h2h_last_spread < b.fg_spread",
    "h2h_spread_higher": "b.h2h_last_spread > b.fg_spread",
}


def build_block():
    preds = [f"min_games guard::{''}"]  # placeholder removed below
    preds = []
    preds.append("(p_filters->>'min_games' IS NULL OR b.team_gp_s2d >= (p_filters->>'min_games')::int)")
    for k, col in RANGE.items():
        preds.append(f"(p_filters->>'{k}_min' IS NULL OR b.{col} >= (p_filters->>'{k}_min')::numeric)")
        preds.append(f"(p_filters->>'{k}_max' IS NULL OR b.{col} <= (p_filters->>'{k}_max')::numeric)")
    for k, col in BOOL_COL.items():
        if col:
            preds.append(f"(p_filters->>'{k}' IS NULL OR b.{col} = (p_filters->>'{k}')::boolean)")
    for k, col in INT_COL.items():
        preds.append(f"(p_filters->>'{k}' IS NULL OR b.{col} = (p_filters->>'{k}')::int)")
    for k, expr in EXPR_BOOL.items():
        preds.append(f"(p_filters->>'{k}' IS NULL OR ({expr}) = (p_filters->>'{k}')::boolean)")
    return preds


def extend(fn):
    d = q(f"select pg_get_functiondef('{fn}'::regprocedure) as def")
    body = d[0]["def"]
    name = fn.split(".")[1].split("(")[0]
    if "p_filters->>'win_pct_min'" in body:
        print(f"  {name}: already extended, skipping")
        return
    if body.count(ANCHOR) != 1:
        sys.exit(f"  {name}: anchor found {body.count(ANCHOR)}x (expected 1) — aborting")
    preds = build_block()
    block = preds[0] + "".join("\n    AND " + p for p in preds[1:])
    new_body = body.replace(ANCHOR, block + "\n    AND " + ANCHOR, 1)
    os.makedirs("rpc_extended", exist_ok=True)
    open(f"rpc_extended/{name}.sql", "w").write(new_body)
    q(new_body)
    print(f"  {name}: extended (+{len(preds)} predicates)")


def probe(fn_name):
    def overall(filt):
        r = q(f"select ({fn_name}('fg_spread','{json.dumps(filt)}'::jsonb)->'overall') o")
        return r[0]["o"]
    base = overall({})
    print(f"  [{fn_name}] baseline overall n={base['n']}")
    for f in [{"win_pct_min": 0.7}, {"above_500": True}, {"above_500": False},
              {"h2h_last_win": 1}, {"win_streak_min": 3}, {"over_pct_min": 0.6}]:
        o = overall(f)
        print(f"     {f} -> n={o['n']} hit%={o['hit_pct']}")


def main():
    for fn in ["public.cfb_analysis(text,jsonb)", "public.nfl_analysis(text,jsonb)"]:
        print(f"=== {fn} ===")
        extend(fn)
    print("\n--- probes (each filter should drop n / shift hit%) ---")
    probe("cfb_analysis")
    probe("nfl_analysis")


if __name__ == "__main__":
    main()
