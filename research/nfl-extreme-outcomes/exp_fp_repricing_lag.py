#!/usr/bin/env python3
"""Repricing-lag test (gap-model v2 angle 1).

Signal: net unit CHANGE vs last season (current entering-game composites minus
last season's full-season composite). Hypothesis: market prices last year's
units early; teams whose units genuinely changed are mispriced in weeks 4-8
and correctly priced by late season (weeks 12-18 = placebo window).
Grade ATS vs nflverse closing spread, 2022-2025. Pre-registered cells:
top/bottom quartile net_delta in the early window; decay check in late window.
"""
import numpy as np
import pandas as pd

AB_NV = {"ARZ": "ARI", "BLT": "BAL", "CLV": "CLE", "HST": "HOU"}
OFF = ["pass_pro", "recv_corps", "run_block", "rb_room", "qb_resilience"]
DEF = ["pass_rush", "run_front", "tackling"]      # coverage raw excluded (r=0.13)
ALL = OFF + DEF

uc = pd.read_parquet("data/fpdata/unit_composites.parquet")
uc["ab_nv"] = uc.ab.map(lambda a: AB_NV.get(a, a))

# last season's full-season realized composite per unit
prior = (uc.groupby(["ab_nv", "__season"])[[u + "_game" for u in ALL]].mean()
         .rename(columns={u + "_game": u + "_prior" for u in ALL}).reset_index())
prior["season"] = prior.__season + 1
uc = uc.merge(prior.drop(columns="__season"), left_on=["ab_nv", "__season"],
              right_on=["ab_nv", "season"], how="left")
for u in ALL:
    uc[u + "_delta"] = uc[u] * (1 + 6 / uc.groupby(["ab_nv", "__season"]).cumcount().clip(lower=1)) - uc[u + "_prior"]
# simpler: unshrunk current estimate minus prior; fall back to shrunk if unstable
for u in ALL:
    uc[u + "_delta"] = uc[u] - uc[u + "_prior"] * 6 / 6   # shrunk current - prior (conservative)
uc["net_delta"] = uc[[u + "_delta" for u in ALL]].mean(axis=1)

g = pd.read_csv("https://github.com/nflverse/nflverse-data/releases/download/schedules/games.csv",
                low_memory=False)
g = g[(g.game_type == "REG") & g.result.notna() & g.spread_line.notna() & (g.season >= 2022) & (g.season <= 2025)]
rows = []
for _, r in g.iterrows():
    for team, opp, home in ((r.home_team, r.away_team, 1), (r.away_team, r.home_team, 0)):
        line = -r.spread_line if home else r.spread_line
        margin = r.result if home else -r.result
        rows.append(dict(season=r.season, week=r.week, team=team, opp=opp,
                         cov=np.nan if margin + line == 0 else float(margin + line > 0)))
p = pd.DataFrame(rows)
p = p.merge(uc[["ab_nv", "__season", "__week", "net_delta"]],
            left_on=["team", "season", "week"], right_on=["ab_nv", "__season", "__week"], how="inner")
p = p.merge(uc[["ab_nv", "__season", "__week", "net_delta"]].rename(
    columns={"net_delta": "opp_delta"}),
    left_on=["opp", "season", "week"], right_on=["ab_nv", "__season", "__week"], how="inner",
    suffixes=("", "_o"))
p["rel_delta"] = p.net_delta - p.opp_delta       # own change relative to opponent's change
p = p.dropna(subset=["rel_delta", "cov"])
print(f"panel: {len(p)} team-games")


def cell(name, d, m):
    c = d[m]["cov"].dropna()
    if len(c) < 25:
        print(f"  {name:52s} n={len(c)}")
        return
    z = (c.mean() - .5) * 2 * np.sqrt(len(c))
    print(f"  {name:52s} {int(c.sum()):4d}-{int(len(c)-c.sum()):4d} ({100*c.mean():.1f}%)  z={z:+.2f}")


for label, lo, hi in (("EARLY (wk 4-8) — the lag window", 4, 8),
                      ("MID (wk 9-11)", 9, 11),
                      ("LATE (wk 12-18) — placebo: market caught up", 12, 18)):
    d = p[(p.week >= lo) & (p.week <= hi)].copy()
    q = d.rel_delta.rank(pct=True)
    print(f"== {label} (n={len(d)}) ==")
    cell("most-IMPROVED vs opp (top quartile rel_delta)", d, q >= 0.75)
    cell("most-DECLINED vs opp (bottom quartile)", d, q <= 0.25)
    cell("  dose: top decile", d, q >= 0.90)
    print()

d = p[(p.week >= 4) & (p.week <= 8)]
q = d.rel_delta.rank(pct=True)
print("per-season, EARLY top-quartile improved:")
for s in (2022, 2023, 2024, 2025):
    c = d[(d.season == s) & (q >= 0.75)]["cov"].dropna()
    if len(c):
        print(f"  {s}: {int(c.sum())}-{int(len(c)-c.sum())} ({100*c.mean():.0f}%)")
