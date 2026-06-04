"""
GENUINE skill-player availability + opt-out detection from full per-player usage.
Establish each team's workhorse RB (avg car>=12) and target-hog WR (avg rec>=4.5 / tar>=7) thru W-1.
A star is OUT in week W if that SPECIFIC player records ~0 usage that week (absent from box).
Opt-out = postseason game where a season-long star is absent.
Test totals + sides vs OPEN, 2021-2025, per-season.
"""
import os
import numpy as np
import pandas as pd

HERE = os.path.dirname(os.path.abspath(__file__))
pu = pd.read_parquet(os.path.join(HERE, "data", "cfbd", "player_usage.parquet"))
reg = pu[pu.season_type == "regular"].copy()
TS = [2021, 2022, 2023, 2024, 2025]
def roi(h, n): return (h * 0.909 - (n - h)) / n * 100 if n else 0.0

# current-week usage lookup (aggregate to unique key)
usekey = reg.groupby(["season", "week", "team", "player"])[["car", "rec", "tar"]].sum()

# per (season, team, player) cumulative usage THRU PRIOR weeks (leak-safe)
reg = reg.sort_values(["season", "team", "player", "week"])
gp = reg.groupby(["season", "team", "player"], group_keys=False)
reg["cum_car"] = gp["car"].transform(lambda s: s.shift().cumsum())
reg["cum_rec"] = gp["rec"].transform(lambda s: s.shift().cumsum())
reg["gms"] = gp.cumcount()  # prior games with any usage

# for each (season, team, week): pick established workhorse RB and target-hog WR from prior usage
rows = []
for (season, team, week), grp in reg.groupby(["season", "team", "week"]):
    g = grp[grp.gms >= 2]
    rb = g[(g.cum_car / g.gms.clip(lower=1)) >= 12].sort_values("cum_car").tail(1)
    wr = g[(g.cum_rec / g.gms.clip(lower=1)) >= 4.5].sort_values("cum_rec").tail(1)
    rec = {"season": season, "team": team, "week": week, "star_rb": None, "star_wr": None}
    if len(rb):
        rec["star_rb"] = rb.iloc[0]["player"]
    if len(wr):
        rec["star_wr"] = wr.iloc[0]["player"]
    rows.append(rec)
stars = pd.DataFrame(rows)

def cur(season, week, team, player, col):
    if player is None:
        return np.nan
    try:
        return usekey.loc[(season, week, team, player), col]
    except Exception:
        return 0  # not in box this week = 0 usage = OUT

stars["rb_wk_car"] = [cur(s, w, t, p, "car") for s, w, t, p in zip(stars.season, stars.week, stars.team, stars.star_rb)]
stars["wr_wk_rec"] = [cur(s, w, t, p, "rec") for s, w, t, p in zip(stars.season, stars.week, stars.team, stars.star_wr)]
stars["rb_out"] = ((stars.star_rb.notna()) & (stars.rb_wk_car == 0)).astype(int)
stars["wr_out"] = ((stars.star_wr.notna()) & (stars.wr_wk_rec == 0)).astype(int)

gm = pd.read_parquet(os.path.join(HERE, "data", "model_games.parquet"))
df = gm[gm.spread_open.notna() & gm.actual_margin.notna() & (gm.season >= 2021)].copy()
df["home_cover"] = (df.actual_margin + df.spread_open) > 0
df["over"] = (df.actual_total > df.total_open).astype(int)
for side in ["homeTeam", "awayTeam"]:
    df = df.merge(stars[["season", "week", "team", "rb_out", "wr_out"]].drop_duplicates(["season", "week", "team"]).rename(
        columns={"team": side, "rb_out": f"{side[:4]}_rbout", "wr_out": f"{side[:4]}_wrout"}),
        on=["season", "week", side], how="left")
for c in ["home_rbout", "home_wrout", "away_rbout", "away_wrout"]:
    df[c] = df[c].fillna(0)
df["either_rbout"] = ((df.home_rbout + df.away_rbout) >= 1).astype(int)
df["either_wrout"] = ((df.home_wrout + df.away_wrout) >= 1).astype(int)

print(f"games {len(df)} | workhorse-RB out: {int(df.either_rbout.sum())} ({100*df.either_rbout.mean():.1f}%) | "
      f"target-WR out: {int(df.either_wrout.sum())} ({100*df.either_wrout.mean():.1f}%)")

def evt(name, m, side):
    b = df[m]; b = b[b.actual_total != b.total_open]; n = len(b)
    if n < 20: print(f"  {name:<40} n={n} (thin)"); return
    hit = (b.over == 1) if side == "OVER" else (b.over == 0); h = int(hit.sum())
    per = "/".join(f"{100*hit[b.season==s].mean():.0f}" if (b.season==s).sum()>=5 else "--" for s in TS)
    print(f"  {name:<40} n={n:<4} {100*h/n:.1f}% roi={roi(h,n):+.1f}  [{per}]")
def evs(name, m, side):
    b = df[m]; n = len(b)
    if n < 20: print(f"  {name:<40} n={n} (thin)"); return
    hit = b.home_cover if side == "home" else ~b.home_cover; h = int(hit.sum())
    per = "/".join(f"{100*(b.home_cover[b.season==s] if side=='home' else ~b.home_cover[b.season==s]).mean():.0f}" if (b.season==s).sum()>=5 else "--" for s in TS)
    print(f"  {name:<40} n={n:<4} {100*h/n:.1f}% roi={roi(h,n):+.1f}  [{per}]")

print("\n=== TOTALS (vs open) ===")
evt("workhorse RB out -> UNDER", df.either_rbout == 1, "UNDER")
evt("target WR out -> OVER (NFL analog)", df.either_wrout == 1, "OVER")
evt("target WR out -> UNDER", df.either_wrout == 1, "UNDER")
print("\n=== SIDES: fade team missing its star (vs open) ===")
evs("home workhorse RB out -> away", df.home_rbout == 1, "away")
evs("away workhorse RB out -> home", df.away_rbout == 1, "home")
evs("home target WR out -> away", df.home_wrout == 1, "away")
evs("away target WR out -> home", df.away_wrout == 1, "home")
evs("either star out: fade that team (combined)", (df.home_rbout + df.home_wrout) >= 1, "away")
