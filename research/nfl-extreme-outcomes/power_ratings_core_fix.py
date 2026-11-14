#!/usr/bin/env python3
"""A/B the power ratings' production CORE source (blend audit follow-up, 2026-09-17).

  cumulative  data/team_week.parquet — the prod table as shipped: `_s2d` never resets by season
  seasonal    data/team_week_seasonal.parquet — real season-to-date, K=4 prior-seeded (build_team_week_seasonal.py)
  none        CORE features (and their matchup differentials) removed entirely

Same frozen spec otherwise (FINAL feats, ridge 80, played-only injuries, rolling totals
calibration), graded vs the OPENER. Run with no args to see all three.
Usage: python3 power_ratings_core_fix.py [cumulative|seasonal|none]
"""
import io, contextlib, importlib.util as iu, os, subprocess, sys
import numpy as np
import pandas as pd

if len(sys.argv) < 2:
    for m in ("cumulative", "seasonal", "none"):
        print(subprocess.run([sys.executable, __file__, m], capture_output=True, text=True).stdout, end="")
    sys.exit()
MODE = sys.argv[1]
if MODE == "seasonal":
    os.environ["TEAM_WEEK"] = "data/team_week_seasonal.parquet"
spec = iu.spec_from_file_location("pm", "power_ratings_modulators.py"); PM = iu.module_from_spec(spec)
with contextlib.redirect_stdout(io.StringIO()):
    spec.loader.exec_module(PM)
CORE = {"O_epa_pass", "O_epa_run", "O_ppd", "O_proe", "D_epa_pass", "D_epa_run", "D_ppd"}
feats = PM.FINAL
if MODE == "none":
    feats = [c for c in feats if c not in CORE and c.replace("opp_", "") not in CORE and c not in ("mx_epa_pass", "mx_epa_run", "mx_ppd")]
G = PM.fit(feats)


def rec(d, wcol, pcol):
    d = d[~d[pcol]]
    p = d[wcol].mean(); u = (d[wcol] * 0.909 - (~d[wcol])).sum()
    return f"{100*p:5.1f}% n={len(d):3d} {u:+6.1f}u"


ncore = len([c for c in feats if c in CORE or c.replace("opp_", "") in CORE])
print(f"\n=== CORE = {MODE.upper():10s} ({len(feats)} feats, {ncore} CORE-derived) — graded vs OPEN ===")
print(f"  spreads |gap|>=2 all  {rec(G[G.e.abs() >= 2], 'sp_won', 'sp_push')}   HOME lean {rec(G[G.e >= 2], 'sp_won', 'sp_push')}   AWAY lean {rec(G[G.e <= -2], 'sp_won', 'sp_push')}")
print(f"  spreads |gap|>=3 all  {rec(G[G.e.abs() >= 3], 'sp_won', 'sp_push')}")
print(f"  totals  |gap|>=3      {rec(G[G.te.abs() >= 3], 'to_won', 'to_push')}   |gap|>=4  {rec(G[G.te.abs() >= 4], 'to_won', 'to_push')}")
print("  per season, spreads >=2 / totals >=3: " + "  ".join(
    f"{s}: {100*G[(G.season==s)&(G.e.abs()>=2)&~G.sp_push].sp_won.mean():.1f}/{100*G[(G.season==s)&(G.te.abs()>=3)&~G.to_push].to_won.mean():.1f}"
    for s in (2023, 2024, 2025)))
# early-season only (weeks 2-5): where a seeded season-to-date should matter most
e = G[(G.week >= 2) & (G.week <= 5)]
print(f"  weeks 2-5 only: spreads >=2 {rec(e[e.e.abs() >= 2], 'sp_won', 'sp_push')}   totals >=3 {rec(e[e.te.abs() >= 3], 'to_won', 'to_push')}")
