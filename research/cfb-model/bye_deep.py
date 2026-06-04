"""
Deep bye-week dig: pre-bye and post-bye, ATS and totals, by tier and role (fav/dog).
Pre-bye = team's NEXT game is >=13 days later. Post-bye = off_bye (>=13 days rest). vs OPEN, 2021-25.
"""
import os
import numpy as np
import pandas as pd

HERE = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.join(HERE, "data", "cfbd")
YEARS = [2016, 2017, 2018, 2019, 2021, 2022, 2023, 2024, 2025]; TS = [2021, 2022, 2023, 2024, 2025]
P5 = {"SEC", "Big Ten", "Big 12", "ACC", "Pac-12"}
def roi(h, n): return (h * 0.909 - (n - h)) / n * 100 if n else 0.0

# build team-game sequence with dates -> pre/post bye
rows = []
for y in YEARS:
    g = pd.read_parquet(os.path.join(DATA, f"games_{y}.parquet"))
    g = g[(g.seasonType == "regular") & g.homePoints.notna()]
    g["d"] = pd.to_datetime(g.startDate, utc=True, errors="coerce")
    for _, r in g.iterrows():
        for who in ("home", "away"):
            rows.append({"season": y, "week": int(r.week), "team": r[f"{who}Team"], "date": r.d})
tg = pd.DataFrame(rows).sort_values(["team", "season", "date"])
gb = tg.groupby(["team", "season"], group_keys=False)
tg["prev"] = gb["date"].shift(1); tg["nxt"] = gb["date"].shift(-1)
tg["post_bye"] = ((tg.date - tg.prev).dt.days >= 13).astype(int)
tg["pre_bye"] = ((tg.nxt - tg.date).dt.days >= 13).astype(int)

gm = pd.read_parquet(os.path.join(HERE, "data", "model_games.parquet"))
df = gm[gm.spread_open.notna() & gm.actual_margin.notna() & (gm.season >= 2021)].copy()
df["home_cover"] = (df.actual_margin + df.spread_open) > 0
df["over"] = (df.actual_total > df.total_open).astype(int)
for side in ["homeTeam", "awayTeam"]:
    df = df.merge(tg[["season", "week", "team", "pre_bye", "post_bye"]].drop_duplicates(["season", "week", "team"]).rename(
        columns={"team": side, "pre_bye": f"{side[:4]}_pre", "post_bye": f"{side[:4]}_post"}),
        on=["season", "week", side], how="left")
for c in ["home_pre", "home_post", "away_pre", "away_post"]:
    df[c] = df[c].fillna(0)
df["tier"] = np.where(df.homeConference.isin(P5) & df.awayConference.isin(P5), "P5", np.where(~df.homeConference.isin(P5) & ~df.awayConference.isin(P5), "G5", "MIX"))

def ev(name, mask, side, mkt="ats"):
    b = df[mask.fillna(False) if hasattr(mask, "fillna") else mask]; n = len(b)
    if n < 30: print(f"  {name:<40} n={n} (thin)"); return
    if mkt == "ats":
        hit = b.home_cover if side == "home" else ~b.home_cover
    else:
        b = b[b.actual_total != b.total_open]; hit = (b.over == 1) if side == "OVER" else (b.over == 0)
        n = len(b)
    h = int(hit.sum()); per = "/".join(f"{100*hit[b.season==s].mean():.0f}" if (b.season==s).sum()>=8 else "--" for s in TS)
    print(f"  {name:<40} n={n:<4} {100*h/n:.1f}% roi={roi(h,n):+.1f}  [{per}]")

print("=== POST-BYE (team coming off bye) ===")
ev("post-bye team ATS (bet them) home", df.home_post == 1, "home")
ev("post-bye team ATS (bet them) away", df.away_post == 1, "away")
ev("post-bye HOME favorite ATS", (df.home_post == 1) & (df.spread_open < 0), "home")
ev("post-bye P5 team ATS home", (df.home_post == 1) & (df.tier == "P5"), "home")
ev("post-bye -> totals UNDER", (df.home_post == 1) | (df.away_post == 1), "UNDER", "tot")
print("=== PRE-BYE (team plays then has bye) ===")
ev("pre-bye team ATS (bet them) home", df.home_pre == 1, "home")
ev("pre-bye team ATS (bet them) away", df.away_pre == 1, "away")
ev("pre-bye HOME ATS (classic spot)", df.home_pre == 1, "home")
ev("pre-bye -> totals UNDER (flat/looking ahead)", (df.home_pre == 1) | (df.away_pre == 1), "UNDER", "tot")
ev("pre-bye -> totals OVER", (df.home_pre == 1) | (df.away_pre == 1), "OVER", "tot")
print("=== BYE MISMATCH (one off bye, other not) ===")
ev("home off bye, away not (bet home)", (df.home_post == 1) & (df.away_post == 0), "home")
ev("away off bye, home not (bet away)", (df.away_post == 1) & (df.home_post == 0), "away")
