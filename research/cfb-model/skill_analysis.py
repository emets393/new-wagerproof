"""
Key skill-player availability edge (validated by sharp writeups). Detect primary RB / WR OUT,
test totals + sides vs OPEN, 2021-2025.
primary RB = most cumulative carries thru W-1; primary WR = most cumulative receptions thru W-1.
OUT = that player records ~0 usage in week W (didn't play). [live needs pregame status; market slow on it]
"""
import os
import numpy as np
import pandas as pd

HERE = os.path.dirname(os.path.abspath(__file__))
su = pd.read_parquet(os.path.join(HERE, "data", "cfbd", "skill_usage.parquet")).sort_values(["team", "season", "week"])
TS = [2021, 2022, 2023, 2024, 2025]
def roi(h, n): return (h * 0.909 - (n - h)) / n * 100 if n else 0.0

# establish primary RB/WR entering each week (most cumulative usage in prior weeks)
def primary(group, name_col, use_col):
    out = []
    cum = {}
    for _, r in group.iterrows():
        out.append(max(cum, key=cum.get) if cum else None)
        cum[r[name_col]] = cum.get(r[name_col], 0) + r[use_col]
    return out
su["prim_rb"] = su.groupby(["team", "season"], group_keys=False).apply(lambda g: pd.Series(primary(g, "rb", "rb_car"), index=g.index))
su["prim_wr"] = su.groupby(["team", "season"], group_keys=False).apply(lambda g: pd.Series(primary(g, "wr", "wr_rec"), index=g.index))
# OUT = established primary exists AND this week's primary is a DIFFERENT player AND the established one
#       isn't the current top (proxy for absence). Also require established player had real usage.
su["rb_out"] = ((su.prim_rb.notna()) & (su.rb != su.prim_rb)).astype(int)
su["wr_out"] = ((su.prim_wr.notna()) & (su.wr != su.prim_wr)).astype(int)

gm = pd.read_parquet(os.path.join(HERE, "data", "model_games.parquet"))
df = gm[gm.spread_open.notna() & gm.actual_margin.notna() & (gm.season >= 2021)].copy()
df["home_cover"] = (df.actual_margin + df.spread_open) > 0
df["over"] = (df.actual_total > df.total_open).astype(int)
for side in ["homeTeam", "awayTeam"]:
    df = df.merge(su[["season", "week", "team", "rb_out", "wr_out"]].drop_duplicates(["season", "week", "team"]).rename(
        columns={"team": side, "rb_out": f"{side[:4]}_rbout", "wr_out": f"{side[:4]}_wrout"}),
        on=["season", "week", side], how="left")
for c in ["home_rbout", "home_wrout", "away_rbout", "away_wrout"]:
    df[c] = df[c].fillna(0)
df["either_rbout"] = ((df.home_rbout + df.away_rbout) >= 1).astype(int)
df["either_wrout"] = ((df.home_wrout + df.away_wrout) >= 1).astype(int)
df["either_out"] = ((df.either_rbout + df.either_wrout) >= 1).astype(int)

def evt(name, mask, side):
    b = df[mask.fillna(False)]; b = b[b.actual_total != b.total_open]; n = len(b)
    if n < 25: print(f"  {name:<40} n={n} (thin)"); return
    hit = (b.over == 1) if side == "OVER" else (b.over == 0)
    h = int(hit.sum()); per = "/".join(f"{100*hit[b.season==s].mean():.0f}" if (b.season==s).sum()>=6 else "--" for s in TS)
    print(f"  {name:<40} n={n:<4} {100*h/n:.1f}% roi={roi(h,n):+.1f}  [{per}]")

def evs(name, mask, side):
    b = df[mask.fillna(False)]; n = len(b)
    if n < 25: print(f"  {name:<40} n={n} (thin)"); return
    hit = b.home_cover if side == "home" else ~b.home_cover
    h = int(hit.sum()); per = "/".join(f"{100*(b.home_cover[b.season==s] if side=='home' else ~b.home_cover[b.season==s]).mean():.0f}" if (b.season==s).sum()>=6 else "--" for s in TS)
    print(f"  {name:<40} n={n:<4} {100*h/n:.1f}% roi={roi(h,n):+.1f}  [{per}]")

print(f"games: {len(df)} | RB-out (either): {int(df.either_rbout.sum())} WR-out: {int(df.either_wrout.sum())}")
print("\n=== TOTALS when key skill player out (vs open) ===")
evt("WR out -> OVER (NFL analog)", df.either_wrout == 1, "OVER")
evt("WR out -> UNDER", df.either_wrout == 1, "UNDER")
evt("RB out -> UNDER", df.either_rbout == 1, "UNDER")
evt("RB out -> OVER", df.either_rbout == 1, "OVER")
print("\n=== SIDES: fade the team missing its star (bet opponent) ===")
evs("home RB out -> bet away", df.home_rbout == 1, "away")
evs("away RB out -> bet home", df.away_rbout == 1, "home")
evs("home WR out -> bet away", df.home_wrout == 1, "away")
evs("away WR out -> bet home", df.away_wrout == 1, "home")
