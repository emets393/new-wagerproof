"""
'Consistently mispriced teams' + HOME/AWAY splits.
Per team, season-to-date cover margin (actual margin + their spread) overall and split by venue.
Q1: does a team's prior ATS cover-margin predict its NEXT cover? (market too slow on some teams)
Q2: is it venue-specific (team beats spread at home but not away)?
All leak-safe (prior games only). Grade vs OPEN, 2021-2025.
"""
import os
import numpy as np
import pandas as pd

HERE = os.path.dirname(os.path.abspath(__file__))
gm = pd.read_parquet(os.path.join(HERE, "data", "model_games.parquet"))
df = gm[gm.spread_open.notna() & gm.actual_margin.notna() & (gm.season >= 2021)].copy()
TS = [2021, 2022, 2023, 2024, 2025]
def roi(h, n): return (h * 0.909 - (n - h)) / n * 100 if n else 0.0

# team-game cover results (their perspective)
rows = []
for _, r in df.iterrows():
    rows.append({"season": r.season, "week": r.week, "team": r.homeTeam, "venue": "home",
                 "cover_margin": r.actual_margin + r.spread_open, "covered": int(r.actual_margin + r.spread_open > 0)})
    rows.append({"season": r.season, "week": r.week, "team": r.awayTeam, "venue": "away",
                 "cover_margin": -(r.actual_margin + r.spread_open), "covered": int(-(r.actual_margin + r.spread_open) > 0)})
tg = pd.DataFrame(rows).sort_values(["team", "season", "week"])
g = tg.groupby(["team", "season"], group_keys=False)
cs = lambda s: s.shift().expanding().mean()
tg["ats_all"] = g["cover_margin"].transform(cs)       # prior avg cover margin (all venues)
tg["cov_all"] = g["covered"].transform(cs)            # prior cover RATE
# venue-specific (prior games at THIS venue)
gv = tg.groupby(["team", "season", "venue"], group_keys=False)
tg["ats_venue"] = gv["cover_margin"].transform(cs)
tg["cov_venue"] = gv["covered"].transform(cs)
tg["gp"] = g.cumcount()

# attach to games: home team's home-venue history + away team's away-venue history
h = tg[tg.venue == "home"][["season", "week", "team", "ats_all", "cov_all", "ats_venue", "cov_venue", "gp"]]
a = tg[tg.venue == "away"][["season", "week", "team", "ats_all", "cov_all", "ats_venue", "cov_venue", "gp"]]
df = df.merge(h.rename(columns={"team": "homeTeam", "ats_all": "h_ats", "cov_all": "h_cov", "ats_venue": "h_atsV", "cov_venue": "h_covV", "gp": "h_gp"}), on=["season", "week", "homeTeam"], how="left")
df = df.merge(a.rename(columns={"team": "awayTeam", "ats_all": "a_ats", "cov_all": "a_cov", "ats_venue": "a_atsV", "cov_venue": "a_covV", "gp": "a_gp"}), on=["season", "week", "awayTeam"], how="left")
df["home_cover"] = (df.actual_margin + df.spread_open) > 0
df = df[(df.h_gp >= 3) & (df.a_gp >= 3)]

def ev(name, mask, side):
    b = df[mask.fillna(False)]; n = len(b)
    if n < 30: print(f"  {name:<46} n={n} (thin)"); return
    hit = b.home_cover if side == "home" else ~b.home_cover
    h = int(hit.sum()); per = "/".join(f"{100*(b.home_cover[b.season==s] if side=='home' else ~b.home_cover[b.season==s]).mean():.0f}" if (b.season==s).sum()>=8 else "--" for s in TS)
    print(f"  {name:<46} n={n:<4} ATS={100*h/n:.1f}% roi={roi(h,n):+.1f}  [{per}]")

print("Q1: does prior ATS cover-margin predict next cover? (persistence)")
print("  -- back teams that have been COVERING (overall) --")
ev("home covering well (h_ats>=4) -> bet home", df.h_ats >= 4, "home")
ev("away covering well (a_ats>=4) -> bet away", df.a_ats >= 4, "away")
ev("home covering poorly (h_ats<=-4) -> fade home(away)", df.h_ats <= -4, "away")
ev("away covering poorly (a_ats<=-4) -> fade away(home)", df.a_ats <= -4, "home")
print("\nQ2: VENUE-SPECIFIC (home team's HOME ATS history, away team's AWAY ATS history)")
ev("home strong AT HOME (h_atsV>=5) -> bet home", df.h_atsV >= 5, "home")
ev("away strong ON ROAD (a_atsV>=5) -> bet away", df.a_atsV >= 5, "away")
ev("home weak AT HOME (h_atsV<=-5) -> fade(away)", df.h_atsV <= -5, "away")
ev("away weak ON ROAD (a_atsV<=-5) -> fade(home)", df.a_atsV <= -5, "home")
print("\n  combined: home strong-home vs away weak-road")
ev("h_atsV>=3 & a_atsV<=-3 -> bet home", (df.h_atsV >= 3) & (df.a_atsV <= -3), "home")
ev("a_atsV>=3 & h_atsV<=-3 -> bet away", (df.a_atsV >= 3) & (df.h_atsV <= -3), "away")
