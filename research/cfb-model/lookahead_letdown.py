"""
Look-ahead & letdown TOTALS spots (effect on points scored this week).
LOOK-AHEAD: a (ranked) team faces a weak opp now but a ranked opp NEXT week -> trap/looking past.
LETDOWN:   a team just played a ranked opp / ranked-vs-ranked / a big primetime game LAST week.
Tested both directions (over & under) vs OPEN, 2021-2025, per-season + FP control.
Rivalry proxied by 'ranked' (no clean rivalry table available).
"""
import os
import numpy as np
import pandas as pd

HERE = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.join(HERE, "data", "cfbd")
YEARS = [2016, 2017, 2018, 2019, 2021, 2022, 2023, 2024, 2025]
TS = [2021, 2022, 2023, 2024, 2025]

rk = pd.read_parquet(os.path.join(DATA, "rankings_weekly.parquet")).rename(columns={"year": "season"})
rk = rk[rk.poll == "AP Top 25"]; ranked = set(zip(rk.season, rk.asof_week, rk.team))

rows = []
for y in YEARS:
    g = pd.read_parquet(os.path.join(DATA, f"games_{y}.parquet"))
    g = g[(g.seasonType == "regular") & g.homePoints.notna() & g.awayPoints.notna()]
    kt = pd.to_datetime(g["startDate"], utc=True, errors="coerce") - pd.Timedelta(hours=4)
    g = g.assign(_hour=kt.dt.hour, _dow=kt.dt.dayofweek)
    for _, r in g.iterrows():
        night = 1 if (r["_hour"] >= 19 or r["_hour"] <= 2) else 0
        primetime = 1 if (night and r["_dow"] == 5) else 0
        for who, opp in (("home", "away"), ("away", "home")):
            rows.append({"season": y, "week": int(r["week"]), "team": r[f"{who}Team"], "opp": r[f"{opp}Team"],
                         "pf": r[f"{who}Points"], "pa": r[f"{opp}Points"], "night": night, "primetime": primetime})
tg = pd.DataFrame(rows)
tg["opp_ranked"] = [1 if (s, w, o) in ranked else 0 for s, w, o in zip(tg.season, tg.week, tg.opp)]
tg["self_ranked"] = [1 if (s, w, t) in ranked else 0 for s, w, t in zip(tg.season, tg.week, tg.team)]
tg = tg.sort_values(["team", "season", "week"]); gb = tg.groupby(["team", "season"], group_keys=False)
for col in ["opp_ranked", "self_ranked", "night", "primetime"]:
    tg[f"last_{col}"] = gb[col].shift(1)
tg["next_opp_ranked"] = gb["opp_ranked"].shift(-1)

# spot flags (per team-game) — these are TEAM states that should affect the GAME total
tg["LA_selfRanked_nextRanked"] = ((tg.self_ranked == 1) & (tg.opp_ranked == 0) & (tg.next_opp_ranked == 1)).astype(int)
tg["LA_any_nextRanked"] = ((tg.opp_ranked == 0) & (tg.next_opp_ranked == 1)).astype(int)
tg["LD_after_ranked"] = (tg.last_opp_ranked == 1).astype(int)
tg["LD_after_rankedVranked"] = ((tg.last_opp_ranked == 1) & (tg.last_self_ranked == 1)).astype(int)
tg["LD_after_primetime"] = (tg.last_primetime == 1).astype(int)
tg["LD_after_PT_rankedVranked"] = ((tg.last_primetime == 1) & (tg.last_opp_ranked == 1) & (tg.last_self_ranked == 1)).astype(int)
SPOTS = ["LA_selfRanked_nextRanked", "LA_any_nextRanked", "LD_after_ranked",
         "LD_after_rankedVranked", "LD_after_primetime", "LD_after_PT_rankedVranked"]

gm = pd.read_parquet(os.path.join(HERE, "data", "model_games.parquet"))
df = gm[gm.total_open.notna() & gm.actual_total.notna() & (gm.season >= 2021)].copy()
df = df[df.actual_total != df.total_open]; df["over"] = (df.actual_total > df.total_open).astype(int)
base = df.over.mean() * 100
sp = tg[["season", "week", "team"] + SPOTS]
for side in ["homeTeam", "awayTeam"]:
    df = df.merge(sp.rename(columns={"team": side, **{s: f"{side[:4]}_{s}" for s in SPOTS}}),
                  on=["season", "week", side], how="left")
for s in SPOTS:
    df[f"either_{s}"] = ((df[f"home_{s}"].fillna(0) + df[f"away_{s}"].fillna(0)) >= 1).astype(int)

def roi(h, n): return (h * 0.909 - (n - h)) / n * 100 if n else 0.0
print(f"base OVER {base:.1f}% (n={len(df)})")
print(f"{'spot (either team)':>32}{'n':>5}{'over%':>7}{'roi':>7}{'avgTot':>8}{'line':>7}  per-season")
res = []
for s in SPOTS:
    m = (df[f"either_{s}"] == 1); n = int(m.sum())
    if n < 20:
        print(f"{s:>32}{n:>5}  (thin)"); continue
    b = df[m]; h = int(b.over.sum())
    per = "/".join(f"{100*b.over[b.season==ss].mean():.0f}" if (b.season==ss).sum()>=6 else "--" for ss in TS)
    lean = "UNDER" if 100*h/n < base else "OVER"
    print(f"{s:>32}{n:>5}{100*h/n:>7.1f}{roi(h,n):>7.1f}{b.actual_total.mean():>8.1f}{b.total_open.mean():>7.1f}  [{per}] {lean}")
    res.append((s, n, abs(100*h/n - base)))

rng = np.random.default_rng(7); arr = df.over.values
real = sum(1 for _, n, d in res if n >= 40 and d >= 4)
null = [sum(1 for s in SPOTS if (df[f"either_{s}"] == 1).sum() >= 40 and
        abs(100*pd.Series(rng.permutation(arr), index=df.index)[df[f"either_{s}"] == 1].mean() - base) >= 4) for _ in range(300)]
null = np.array(null)
print(f"\nFP: real {real} vs null mean {null.mean():.1f}/95th {np.percentile(null,95):.0f} => {'ENRICHED' if real > np.percentile(null,95) else 'within chance'}")
