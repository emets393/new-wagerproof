"""
Coaching data: tenure, experience, first-year, and head-to-head. Test as ATS/totals signals.
Pull /coaches, map (season, school)->coach, build leak-safe career features (prior seasons only),
+ coach-vs-coach H2H. Test ATS spots vs OPEN, 2021-2025.
"""
import os
import numpy as np
import pandas as pd
import cfbd

HERE = os.path.dirname(os.path.abspath(__file__))
YEARS = list(range(2014, 2026))
TS = [2021, 2022, 2023, 2024, 2025]
def roi(h, n): return (h * 0.909 - (n - h)) / n * 100 if n else 0.0

cp = os.path.join(HERE, "data", "cfbd", "coaches.parquet")
if os.path.exists(cp):
    rows = pd.read_parquet(cp)
else:
    rr = []
    for y in YEARS:
        try:
            for c in cfbd.get("/coaches", year=y):
                name = f"{c.get('firstName','')} {c.get('lastName','')}".strip()
                for s in c.get("seasons", []):
                    rr.append({"coach": name, "hireDate": c.get("hireDate"), "season": s["year"],
                               "school": s["school"], "wins": s.get("wins", 0), "losses": s.get("losses", 0)})
        except Exception:
            pass
    rows = pd.DataFrame(rr).drop_duplicates(["coach", "season", "school"])
    rows.to_parquet(cp, index=False)
print(f"coach-seasons: {len(rows)}")

rows = rows.sort_values(["coach", "season"])
g = rows.groupby("coach", group_keys=False)
# leak-safe career stats entering the season (prior seasons only)
rows["car_w"] = g["wins"].transform(lambda s: s.shift(1).cumsum())
rows["car_l"] = g["losses"].transform(lambda s: s.shift(1).cumsum())
rows["car_winpct"] = rows["car_w"] / (rows["car_w"] + rows["car_l"])
rows["exp_seasons"] = g.cumcount()  # prior seasons coached (any school)
# tenure at current school (consecutive prior seasons at this school)
rows["tenure"] = rows.groupby(["coach", "school"]).cumcount()
rows["first_year_school"] = (rows["tenure"] == 0).astype(int)
# one PRIMARY coach per (season, school) = most games (handle mid-season changes)
rows["games"] = rows["wins"] + rows["losses"]
primary = rows.sort_values("games").drop_duplicates(["season", "school"], keep="last")
team_coach = primary.set_index(["season", "school"]).sort_index()

gm = pd.read_parquet(os.path.join(HERE, "data", "model_games.parquet"))
df = gm[gm.spread_open.notna() & gm.actual_margin.notna() & (gm.season >= 2021)].copy()
df["home_cover"] = (df.actual_margin + df.spread_open) > 0
def lk(season, team, col):
    try:
        return team_coach.loc[(season, team), col]
    except Exception:
        return np.nan
for side in ["homeTeam", "awayTeam"]:
    for col in ["coach", "car_winpct", "exp_seasons", "first_year_school"]:
        df[f"{side[:4]}_{col}"] = [lk(s, t, col) for s, t in zip(df.season, df[side])]

# coverage
print("coach mapped: home", df.home_coach.notna().mean().round(2), "away", df.away_coach.notna().mean().round(2))

print("\n=== COACHING ATS spots (vs open) ===")
def ev(name, mask, side):
    b = df[mask.fillna(False)]; n = len(b)
    if n < 30: print(f"  {name:<40} n={n} (thin)"); return
    hit = b.home_cover if side == "home" else ~b.home_cover
    h = int(hit.sum()); per = "/".join(f"{100*(b.home_cover[b.season==s] if side=='home' else ~b.home_cover[b.season==s]).mean():.0f}" if (b.season==s).sum()>=10 else "--" for s in TS)
    print(f"  {name:<40} n={n:<4} ATS={100*h/n:.1f}% roi={roi(h,n):+.1f}  [{per}]")

hexp, aexp = pd.to_numeric(df.home_exp_seasons, errors="coerce"), pd.to_numeric(df.away_exp_seasons, errors="coerce")
hw, aw = pd.to_numeric(df.home_car_winpct, errors="coerce"), pd.to_numeric(df.away_car_winpct, errors="coerce")
ev("first-year HOME coach (fade->away)", df.home_first_year_school == 1, "away")
ev("first-year AWAY coach (fade->home)", df.away_first_year_school == 1, "home")
ev("home coach big exp edge (>=5 yr) bet home", (hexp - aexp) >= 5, "home")
ev("away coach big exp edge (>=5 yr) bet away", (aexp - hexp) >= 5, "away")
ev("home coach better career winpct (+.15) home", (hw - aw) >= 0.15, "home")
ev("away coach better career winpct (+.15) away", (aw - hw) >= 0.15, "away")
ev("both veteran coaches (exp>=8)", (hexp >= 8) & (aexp >= 8), "home")
