"""
LUCK / REGRESSION signal (the sharp's #1 fade mechanism).
Build leak-safe season-to-date 'luck' per team:
  - pythag_luck = actual win% - Pythagorean win% (points^2.37). High = winning more than points justify.
  - close_luck  = (one-score wins - one-score losses) in games decided by <=8.
  - epa_luck    = cumulative (actual_margin - market-expected margin from CLOSE spread)  [overperformance]
Hypothesis: FADE high-luck (overrated, due to regress) teams ATS; back unlucky teams. vs OPEN, 2021-25.
"""
import os
import numpy as np
import pandas as pd

HERE = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.join(HERE, "data", "cfbd")
YEARS = [2016, 2017, 2018, 2019, 2021, 2022, 2023, 2024, 2025]; TS = [2021, 2022, 2023, 2024, 2025]
P5 = {"SEC", "Big Ten", "Big 12", "ACC", "Pac-12"}
def roi(h, n): return (h * 0.909 - (n - h)) / n * 100 if n else 0.0

# team-game results
rows = []
for y in YEARS:
    g = pd.read_parquet(os.path.join(DATA, f"games_{y}.parquet"))
    g = g[(g.seasonType == "regular") & g.homePoints.notna()]
    g["d"] = pd.to_datetime(g.startDate, utc=True, errors="coerce")
    for _, r in g.iterrows():
        for who, opp in (("home", "away"), ("away", "home")):
            pf, pa = r[f"{who}Points"], r[f"{opp}Points"]
            rows.append({"season": y, "week": int(r.week), "date": r.d, "team": r[f"{who}Team"],
                         "pf": pf, "pa": pa, "win": int(pf > pa), "margin": pf - pa,
                         "close": int(abs(pf - pa) <= 8)})
tg = pd.DataFrame(rows).sort_values(["team", "season", "date"])
gb = tg.groupby(["team", "season"], group_keys=False)
# cumulative THROUGH PRIOR games (shift) = leak-safe
tg["wc"] = tg.win * tg.close            # close win
tg["lc"] = (1 - tg.win) * tg.close      # close loss
cumshift = lambda s: s.shift().cumsum()
tg["cpf"] = gb["pf"].transform(cumshift)
tg["cpa"] = gb["pa"].transform(cumshift)
tg["cw"] = gb["win"].transform(cumshift)
tg["close_w"] = gb["wc"].transform(cumshift)
tg["close_l"] = gb["lc"].transform(cumshift)
tg["gp"] = gb.cumcount()
k = 2.37
tg["pythag"] = tg.cpf ** k / (tg.cpf ** k + tg.cpa ** k)
tg["winpct"] = tg.cw / tg.gp
tg["pythag_luck"] = tg.winpct - tg.pythag
tg["close_luck"] = tg.close_w - tg.close_l
tg = tg[tg.gp >= 3]  # need a few games

gm = pd.read_parquet(os.path.join(HERE, "data", "model_games.parquet"))
df = gm[gm.spread_open.notna() & gm.actual_margin.notna() & (gm.season >= 2021)].copy()
df["home_cover"] = (df.actual_margin + df.spread_open) > 0
for side in ["homeTeam", "awayTeam"]:
    df = df.merge(tg[["season", "week", "team", "pythag_luck", "close_luck", "gp"]].rename(
        columns={"team": side, "pythag_luck": f"{side[:4]}_pluck", "close_luck": f"{side[:4]}_cluck"}),
        on=["season", "week", side], how="left")
df["tier"] = np.where(df.homeConference.isin(P5) & df.awayConference.isin(P5), "P5", np.where(~df.homeConference.isin(P5) & ~df.awayConference.isin(P5), "G5", "MIX"))

def ev(name, mask, side):
    b = df[mask.fillna(False)]; n = len(b)
    if n < 30: print(f"  {name:<46} n={n} (thin)"); return
    hit = b.home_cover if side == "home" else ~b.home_cover
    h = int(hit.sum()); per = "/".join(f"{100*(b.home_cover[b.season==s] if side=='home' else ~b.home_cover[b.season==s]).mean():.0f}" if (b.season==s).sum()>=10 else "--" for s in TS)
    print(f"  {name:<46} n={n:<4} ATS={100*h/n:.1f}% roi={roi(h,n):+.1f}  [{per}]")

hp, ap = df.home_pluck, df.away_pluck
hc, ac = df.home_cluck, df.away_cluck
print("=== PYTHAG LUCK: fade the luckier team ===")
ev("home much luckier (pluck diff>=.15) -> bet away", (hp - ap) >= 0.15, "away")
ev("away much luckier (pluck diff>=.15) -> bet home", (ap - hp) >= 0.15, "home")
ev("home luckier (>=.10) -> away", (hp - ap) >= 0.10, "away")
ev("away luckier (>=.10) -> home", (ap - hp) >= 0.10, "home")
print("=== CLOSE-GAME LUCK: fade team with many close wins ===")
ev("home close-lucky (cluck diff>=3) -> away", (hc - ac) >= 3, "away")
ev("away close-lucky (cluck diff>=3) -> home", (ac - hc) >= 3, "home")
ev("home close-lucky (>=2) -> away", (hc - ac) >= 2, "away")
ev("away close-lucky (>=2) -> home", (ac - hc) >= 2, "home")
print("=== COMBINED (both luck measures agree) ===")
ev("home lucky both (pluck>=.08 & cluck>=2)->away", ((hp - ap) >= 0.08) & ((hc - ac) >= 2), "away")
ev("away lucky both ->home", ((ap - hp) >= 0.08) & ((ac - hc) >= 2), "home")
