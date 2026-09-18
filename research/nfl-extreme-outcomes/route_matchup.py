#!/usr/bin/env python3
"""ROUTE-LEVEL MATCHUP CROSS (owner 2026-09-17).

The missing join. matchup_report.py showed a player's separation BY ROUTE and a defense's
separation allowed BY COVERAGE — but never crossed them. This does the football logic:

    player edge on route R   = his separation on R      - league separation on R
    defense hole on route R  = what THIS defense allows on R - league allowed on R
    STACKED EDGE             = player edge + defense hole        (both in separation pts)

A receiver who wins on crossers, facing a defense that cannot cover crossers, is a
different bet from the same receiver facing a defense that smothers them. Same for break
types (vertical / horizontal / shallow) and alignment.

Every defense figure is volume-weighted and prints its route count so thin cells are visible.

Usage: python3 route_matchup.py AWAY HOME
"""
import sys

import numpy as np
import pandas as pd

pd.options.mode.chained_assignment = None
FLAT = "data/fpdata/flat/"
num = lambda s: pd.to_numeric(s, errors="coerce")
AB_NV = {"ARZ": "ARI", "BLT": "BAL", "CLV": "CLE", "HST": "HOU"}
AWAY, HOME = (sys.argv[1], sys.argv[2]) if len(sys.argv) > 2 else ("DET", "BUF")
SEASONS = [2025, 2026]
SEP = "playerStatsReceivingSeparationScorePercentage"
NRT = "playerStatsReceivingSeparationRoutesTotal"
TPR = "playerStatsReceivingTargetsPerRoute"
YPR = "playerStatsReceivingAveragesPerRouteYardsTotal"
MINR_DEF = 40      # min routes for a defense cell to be trusted
MINR_PL = 15       # min routes for a player cell


def load(path):
    d = pd.read_parquet(FLAT + path)
    d = d[d.__season.isin(SEASONS)].copy()
    d["nm"] = d.playerFirstName + " " + d.playerLastName
    d["opp"] = d.opponentAbbreviation.map(lambda a: AB_NV.get(a, a))
    return d


def wmean(df, val, wt):
    w = num(df[wt]); v = num(df[val])
    m = w.notna() & v.notna()
    return (v[m] * w[m]).sum() / w[m].sum() if w[m].sum() else np.nan


def profile(d, buckets, key, stat=SEP):
    """Weighted stat per key per bucket, plus route counts.
    Separation is a fraction -> scale to %; targets-per-route is already a rate -> do NOT."""
    sc = 100 if stat == SEP else 1
    rows = []
    for k, g in d.groupby(key):
        r = {key: k}
        for b in buckets:
            c, n = f"{b}__{stat}", f"{b}__{NRT}"
            if c in g.columns:
                N = num(g[n]).sum()
                r[b] = sc * wmean(g, c, n) if N >= 1 else np.nan
                r[b + "_n"] = N
        rows.append(r)
    return pd.DataFrame(rows).set_index(key)


def league(d, buckets, stat=SEP):
    sc = 100 if stat == SEP else 1
    return {b: sc * wmean(d, f"{b}__{stat}", f"{b}__{NRT}")
            for b in buckets if f"{b}__{stat}" in d.columns}


def cross(path, buckets, label, players, short=lambda s: s):
    d = load(path)
    bl = [b for b in buckets if f"{b}__{SEP}" in d.columns]
    lg = league(d, bl)
    DEF = profile(d, bl, "opp")
    PL = profile(d, bl, "nm")
    PLT = profile(d, bl, "nm", stat=TPR)     # targets per route (usage, not just openness)
    lgt = league(d, bl, stat=TPR)

    print("\n" + "=" * 112)
    print(f"  {label}")
    print("=" * 112)
    print(f"\n  DEFENSE — separation allowed vs league (+ = receivers get open on that route)")
    print(f"   {'defense':9s}" + "".join(f"{short(b)[:9]:>11s}" for b in bl))
    print(f"   {'LEAGUE':9s}" + "".join(f"{lg[b]:10.1f}%" for b in bl))
    for t in (AWAY, HOME):
        if t not in DEF.index:
            continue
        print(f"   {t:9s}" + "".join(
            f"{DEF.loc[t, b] - lg[b]:+10.1f}" if DEF.loc[t, b + '_n'] >= MINR_DEF else f"{'thin':>10s}"
            for b in bl))
        print(f"   {'  (routes)':9s}" + "".join(f"{DEF.loc[t, b+'_n']:10.0f}" for b in bl))

    print(f"\n  STACKED EDGE = player's edge on the route + that defense's hole on the same route")
    print(f"   {'player':21s} {'vs':4s}" + "".join(f"{short(b)[:9]:>11s}" for b in bl))
    for nm, opp_def in players:
        if nm not in PL.index or opp_def not in DEF.index:
            continue
        cells, detail = [], []
        for b in bl:
            pe = PL.loc[nm, b] - lg[b] if PL.loc[nm, b + "_n"] >= MINR_PL else np.nan
            de = DEF.loc[opp_def, b] - lg[b] if DEF.loc[opp_def, b + "_n"] >= MINR_DEF else np.nan
            tot = pe + de if pd.notna(pe) and pd.notna(de) else np.nan
            cells.append(tot)
            if pd.notna(tot):
                detail.append((b, tot, pe, de, PL.loc[nm, b + "_n"],
                               PLT.loc[nm, b] - lgt[b] if PLT.loc[nm, b + "_n"] >= MINR_PL else np.nan))
        print(f"   {nm[:21]:21s} {opp_def:4s}" + "".join(
            f"{v:+10.1f}" if pd.notna(v) else f"{'--':>11s}" for v in cells))
        detail.sort(key=lambda x: -x[1])
        for b, tot, pe, de, n, tu in detail[:2]:
            if tot > 4:
                u = (f", {PLT.loc[nm, b]:.3f} tgt/route vs lg {lgt[b]:.3f}"
                     if pd.notna(PLT.loc[nm, b]) else "")
                print(f"        \u2605 {short(b)}: player {pe:+.1f} + defense {de:+.1f} = {tot:+.1f}"
                      f"  ({n:.0f} routes{u})")


BUF_P = ["Dalton Kincaid", "DJ Moore", "Khalil Shakir", "Keon Coleman", "Dawson Knox"]
DET_P = ["Amon-Ra St. Brown", "Jameson Williams", "Sam LaPorta", "Isaac TeSlaa"]
# roster guard: keep a name only if his MOST RECENT game row is with that team (Montgomery incident)
_ra = pd.read_parquet("data/fpdata/player_receiving-advanced.parquet")
_ra["nm"] = _ra.playerFirstName + " " + _ra.playerLastName
_last = _ra.sort_values(["__season", "__week"]).groupby("nm").tail(1).set_index("nm").teamAbbreviation.map(lambda a: AB_NV.get(a, a))
BUF_P = [p for p in BUF_P if _last.get(p) == "BUF"]
DET_P = [p for p in DET_P if _last.get(p) == "DET"]
PLAYERS = [(p, HOME) for p in (DET_P if AWAY == "DET" else BUF_P)] + \
          [(p, AWAY) for p in (BUF_P if HOME == "BUF" else DET_P)]

cross("player_receiving-separation-by-routes.parquet",
      ["RouteSlant", "RouteOut", "RouteInDig", "RouteCrossers", "RouteGo", "RoutePost",
       "RouteCorner", "RouteFlat", "RouteHitch", "RouteScreens"],
      "ROUTE-TYPE MATCHUP", PLAYERS, short=lambda s: s.replace("Route", ""))
cross("player_receiving-separation-by-breaks.parquet",
      ["BreaksVertical", "BreaksHorizontal", "BreaksShallowUnderneath", "BreaksStatic"],
      "BREAK-TYPE MATCHUP", PLAYERS, short=lambda s: s.replace("Breaks", ""))
cross("player_receiving-separation-by-alignment.parquet",
      ["Slot", "Wide", "Inline", "Backfield"],
      "ALIGNMENT MATCHUP", PLAYERS)
