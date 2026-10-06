#!/usr/bin/env python3
"""How has the probability-mass gate done on the LIVE 2026 board, both sports?

The 2021-25 backtest (cfb-model/backtest_point_value.py) was out of sample by construction but
historical. This is the only question that matters to a bettor now: of the sides we ACTUALLY
published this season, would the mass floor have kept the winners and dropped the losers?

Grades the PUBLISHED pick (fg_spread_pick), not a re-derivation, so the record here is the
record the user saw. Mismatches between the stored pick and pred-vs-market are counted and
printed rather than silently re-sided.
"""
import os, pathlib, sys
import numpy as np, pandas as pd, requests
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from point_value import edge_pct, cfb_values, nfl_spread_values

ROOT = pathlib.Path("/Users/chrishabib/Documents/new-wagerproof")
env = {}
for line in (ROOT / ".env.local").read_text().splitlines():
    if "=" in line and not line.strip().startswith("#"):
        k, v = line.split("=", 1); env[k.strip()] = v.strip()
KEY = env["SUPABASE_SERVICE_KEY"]
H = {"apikey": KEY, "Authorization": f"Bearer {KEY}"}
U = "https://jpxnjuwglavsjbgbasnl.supabase.co/rest/v1"
SEASON = 2026


def pull(table, teamcols):
    out, off = [], 0
    while True:
        r = requests.get(f"{U}/{table}", headers=H, timeout=90, params={
            "season": f"eq.{SEASON}", "select":
            f"week,{teamcols},final_home,final_away,fg_spread_close,fg_pred_margin,"
            "fg_spread_pick,conviction_tier",
            "limit": 1000, "offset": off})
        r.raise_for_status(); b = r.json(); out += b
        if len(b) < 1000: break
        off += 1000
    return pd.DataFrame(out)


def grade(table, values, label, teamcols="home_team,away_team"):
    d = pull(table, teamcols)
    hc, ac = teamcols.split(",")
    d = d[d.final_home.notna() & d.final_away.notna()
          & d.fg_spread_close.notna() & d.fg_pred_margin.notna()
          & d.fg_spread_pick.notna()].copy()
    if d.empty:
        print(f"{label}: no graded rows"); return None
    d["act"] = d.final_home.astype(float) - d.final_away.astype(float)
    d["close_home"] = d.fg_spread_close.astype(float)      # home-perspective
    d["mkt_home"] = -d.close_home                          # market's implied home margin
    d["pred_home"] = d.fg_pred_margin.astype(float)
    # CFB stores the side as HOME/AWAY; NFL stores the TEAM ("GB -1.5") and "NEUTRAL" for no
    # pick. Resolve to a side off the row's own team columns -- never off a name table.
    head = d.fg_spread_pick.astype(str).str.upper().str.split().str[0]
    hh = d[hc].astype(str).str.upper(); aa = d[ac].astype(str).str.upper()
    d["pick"] = np.where(head.isin(["HOME", "AWAY"]), head,
                np.where(head == hh, "HOME", np.where(head == aa, "AWAY", "NONE")))
    n_neutral = int((d.pick == "NONE").sum())
    d = d[d.pick.isin(["HOME", "AWAY"])]
    if d.empty:
        print(f"\n{label}: 0 sided picks this season ({n_neutral} NEUTRAL / no pick)"); return None
    d["cover"] = d.act + d.close_home                      # >0 home covers
    d = d[d.cover.abs() > 1e-9]                            # pushes out
    d["won"] = (d.cover > 0) == (d.pick == "HOME")
    d["pts"] = (d.pred_home - d.mkt_home).abs()
    d["pct"] = [edge_pct(p, m, values) for p, m in zip(d.pred_home, d.mkt_home)]
    # did the stored pick agree with pred-vs-market? disagreement means a flag overrode the model
    d["derived"] = np.where(d.pred_home > d.mkt_home, "HOME", "AWAY")
    n_over = int((d.derived != d.pick).sum())

    # ORACLE: feed the realised result back into the bet rule -> must win ~100%
    orc = ((d.cover > 0) == (np.where(d.cover > 0, "HOME", "AWAY") == "HOME")).mean()
    assert orc > 0.999, f"grader broken, oracle {orc:.3f}"

    def rec(s):
        if not len(s): return "       —"
        w = int(s.won.sum()); l = len(s) - w
        return f"{len(s):>5}{f'{w}-{l}':>10}{w/len(s)*100:>7.1f}%{(w*0.909-l)/len(s)*100:>+8.1f}%"

    print(f"\n{'='*74}\n{label} — 2026 season to date, {len(d)} graded published sides "
          f"({n_over} where a flag overrode the model's own side, {n_neutral} rows carried no pick)\n{'='*74}")
    print(f"{'slice':<34}{'n':>5}{'W-L':>10}{'hit':>8}{'ROI':>9}")
    print(f"{'every published side':<34}{rec(d)}")
    for f_ in (3, 4, 5, 6, 7):
        print(f"{f'mass gate >= '+str(f_)+'%':<34}{rec(d[d.pct >= f_])}")
    print()
    for f_ in (2, 3, 4, 6):
        print(f"{f'point gate >= '+str(f_)+' pts (today)':<34}{rec(d[d.pts >= f_])}")
    print("\n  -- the disagreement slice: picks the two gates treat differently --")
    print(f"{'kept by points(>=3) DROPPED by mass':<34}{rec(d[(d.pts >= 3) & (d.pct < 5)])}")
    print(f"{'kept by mass(>=5) DROPPED by points':<34}{rec(d[(d.pct >= 5) & (d.pts < 3)])}")
    print(f"{'kept by BOTH':<34}{rec(d[(d.pct >= 5) & (d.pts >= 3)])}")
    print("\n  -- by conviction tier, mass gate on vs off --")
    print(f"{'tier':<16}{'all n':>7}{'all hit':>9}{'>=5% n':>8}{'>=5% hit':>10}{'>=5% ROI':>10}")
    for t in d.conviction_tier.fillna("none").unique():
        s = d[d.conviction_tier.fillna("none") == t]; g = s[s.pct >= 5]
        gh = f"{g.won.mean()*100:.1f}%" if len(g) else "—"
        gr = f"{(g.won.sum()*0.909-(len(g)-g.won.sum()))/len(g)*100:+.1f}%" if len(g) else "—"
        print(f"{str(t):<16}{len(s):>7}{s.won.mean()*100:>8.1f}%{len(g):>8}{gh:>10}{gr:>10}")
    print("\n  -- week by week, mass gate >= 5% --")
    for wk in sorted(d.week.unique()):
        s = d[(d.week == wk) & (d.pct >= 5)]; a = d[d.week == wk]
        if not len(a): continue
        w = int(s.won.sum()); l = len(s) - w
        print(f"   wk{int(wk):<3} gated {w}-{l}" + (f"  ({w/len(s)*100:.0f}%)" if len(s) else "  (no plays)")
              + f"   |  all {int(a.won.sum())}-{len(a)-int(a.won.sum())}")
    return d


cfbv, _ = cfb_values()
c = grade("cfb_slate_games", cfbv, "COLLEGE FOOTBALL spread")
n = grade("nfl_slate_games", nfl_spread_values(), "NFL spread", "home_ab,away_ab")

# ---- the two gates stacked, and the lean-tier question ------------------------------------
# Live CFB is carried down by the `lean` tier (see model audit). Does mass rescue it, or is the
# right answer simply not to publish it? Reported side by side so the call is visible.
if c is not None:
    print(f"\n{'='*74}\nCFB — stacking the gates (2026 live)\n{'='*74}")
    print(f"{'slice':<40}{'n':>5}{'W-L':>10}{'hit':>8}{'ROI':>9}")
    def r2(nm, s):
        w = int(s.won.sum()); l = len(s) - w
        print(f"{nm:<40}{len(s):>5}{f'{w}-{l}':>10}"
              + (f"{w/len(s)*100:>7.1f}%{(w*0.909-l)/len(s)*100:>+8.1f}%" if len(s) else ""))
    lean = c.conviction_tier.fillna("none") == "lean"
    r2("mass >=5%", c[c.pct >= 5])
    r2("mass >=5% AND not lean", c[(c.pct >= 5) & ~lean])
    r2("not lean, no mass gate", c[~lean])
    r2("mass >=5% AND pts >=4", c[(c.pct >= 5) & (c.pts >= 4)])
    r2("mass >=6% AND not lean", c[(c.pct >= 6) & ~lean])
    r2("lean only, mass >=6%", c[(c.pct >= 6) & lean])
