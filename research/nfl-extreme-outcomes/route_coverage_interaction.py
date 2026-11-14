#!/usr/bin/env python3
"""Are certain coverages vulnerable to certain ROUTES — and does separation amplify it?

Owner question (2026-10-06): "is a two-high shell more susceptible against a post route, and does
it increase productivity when that receiver creates x-amount of separation."

Two distinct claims, tested separately:
  MAIN EFFECT        coverage x route: does a route produce more against one shell than another,
                     after taking out how productive that route is in general?
  INTERACTION        does the payoff to SEPARATION differ by coverage x route? Separation helps
                     everywhere -- that is trivial. The real question is whether it pays MORE on
                     particular combinations.

Source: fpdata/player_receiving-routes-run.parquet, 2021-2026 targeted plays. Each row is one
(player, game, route) cell carrying its coverage shell, the pre-snap middle-of-field look, the
separation grade and yards-per-route. Verified 1 row per (player, game, route), so no double count.
"""
import warnings
warnings.filterwarnings("ignore")
import numpy as np, pandas as pd
from pathlib import Path

FP = Path(__file__).resolve().parent / "data" / "fpdata"
C = ["gameSeason","playPassTargetedRouteFamily","playDefenseCoverageSchemeParent",
     "playDefenseMiddleOfTheFieldLookPreName","playPassReceiverSeparationName",
     "playerStatsReceivingAveragesPerRouteYardsTotal","playerStatsReceivingTargetsPerRoute",
     "playerStatsReceivingTargetsTotal","playerPosition"]
d = pd.read_parquet(FP / "player_receiving-routes-run.parquet", columns=C)
d = d[d.playPassTargetedRouteFamily.notna()].copy()
d["ypr"] = pd.to_numeric(d.playerStatsReceivingAveragesPerRouteYardsTotal, errors="coerce")
d = d.dropna(subset=["ypr"])
d["mof"] = d.playDefenseMiddleOfTheFieldLookPreName.map({"Open": "two-high", "Closed": "single-high"})
d["route"] = d.playPassTargetedRouteFamily
d["sep"] = d.playPassReceiverSeparationName
print(f"{len(d):,} targeted route-plays, {sorted(d.gameSeason.unique())}\n")

MIN = 150
# ---- MAIN EFFECT: route x shell, versus that route's own overall level -----------------------
base = d.groupby("route").ypr.mean()
g = d[d.mof.notna()].groupby(["route", "mof"]).agg(n=("ypr", "size"), ypr=("ypr", "mean")).reset_index()
g = g[g.n >= MIN]
g["lift"] = g.ypr - g.route.map(base)
piv = g.pivot(index="route", columns="mof", values="lift")
npv = g.pivot(index="route", columns="mof", values="n")
piv = piv.dropna()
piv["gap"] = piv["two-high"] - piv["single-high"]
print("=== MAIN EFFECT: yards per route vs that route's overall average ===")
print(f"{'route':<20}{'vs two-high':>13}{'vs single-high':>16}{'gap':>8}{'n(2H)':>8}{'n(1H)':>8}")
for r in piv.sort_values("gap", ascending=False).index:
    print(f"{r:<20}{piv.loc[r,'two-high']:>+13.2f}{piv.loc[r,'single-high']:>+16.2f}"
          f"{piv.loc[r,'gap']:>+8.2f}{int(npv.loc[r,'two-high']):>8}{int(npv.loc[r,'single-high']):>8}")
print(f"\n  spread of the gap: {piv.gap.min():+.2f} to {piv.gap.max():+.2f} yards per route")

# ---- INTERACTION: does separation pay MORE on some route x shell cells? ----------------------
print("\n=== SEPARATION: yards per route by grade (the trivial part first) ===")
sg = d.groupby("sep").agg(n=("ypr","size"), ypr=("ypr","mean")).sort_values("ypr")
print(sg.round(2).to_string())
OPEN = ["Open", "Wide Open"]; TIGHT = ["Tight", "Step"]
d["open_flag"] = np.where(d.sep.isin(OPEN), "open", np.where(d.sep.isin(TIGHT), "tight", None))
k = d[d.open_flag.notna() & d.mof.notna()]
rows = []
for (r, m), x in k.groupby(["route", "mof"]):
    o = x[x.open_flag == "open"]; t = x[x.open_flag == "tight"]
    if len(o) < 60 or len(t) < 60:
        continue
    rows.append(dict(route=r, mof=m, n_open=len(o), n_tight=len(t),
                     payoff=o.ypr.mean() - t.ypr.mean()))
P = pd.DataFrame(rows)
if len(P):
    print("\n=== INTERACTION: what OPEN-vs-TIGHT is worth, by route x shell ===")
    print("(if separation paid the same everywhere this column would be flat)")
    pv = P.pivot(index="route", columns="mof", values="payoff").dropna()
    nn = P.pivot(index="route", columns="mof", values="n_open").reindex(pv.index)
    pv["diff"] = pv["two-high"] - pv["single-high"]
    print(f"\n{'route':<20}{'payoff vs 2H':>14}{'payoff vs 1H':>14}{'difference':>12}")
    for r in pv.sort_values("diff", ascending=False).index:
        print(f"{r:<20}{pv.loc[r,'two-high']:>+14.2f}{pv.loc[r,'single-high']:>+14.2f}{pv.loc[r,'diff']:>+12.2f}")
    print(f"\n  league-wide separation payoff: {P.payoff.mean():+.2f} ypr")
    print(f"  spread across route x shell cells: {P.payoff.min():+.2f} to {P.payoff.max():+.2f}")
