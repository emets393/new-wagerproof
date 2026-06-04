"""
DEEP ATS spot mining: all totals-style spots applied to spreads + tight-spread trends,
standalone AND combined with the model away-edge. Grade ATS vs OPEN, 2021-25, per-season + FP.
"""
import os
import numpy as np
import pandas as pd
from sklearn.ensemble import HistGradientBoostingRegressor

HERE = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.join(HERE, "data", "cfbd")
YEARS = [2016, 2017, 2018, 2019, 2021, 2022, 2023, 2024, 2025]
TS = [2021, 2022, 2023, 2024, 2025]
def roi(h, n): return (h * 0.909 - (n - h)) / n * 100 if n else 0.0

# ---- sequence flags not already in model_games ----
rk = pd.read_parquet(os.path.join(DATA, "rankings_weekly.parquet")).rename(columns={"year": "season"})
rk = rk[rk.poll == "AP Top 25"]; ranked = set(zip(rk.season, rk.asof_week, rk.team))
import rivalry_spots as RIVMOD
rivpairs = {frozenset(p) for p in RIVMOD.RIVALRIES}
rows = []
for y in YEARS:
    g = pd.read_parquet(os.path.join(DATA, f"games_{y}.parquet"))
    g = g[(g.seasonType == "regular") & g.homePoints.notna() & g.awayPoints.notna()]
    kt = pd.to_datetime(g["startDate"], utc=True, errors="coerce") - pd.Timedelta(hours=4)
    g = g.assign(_h=kt.dt.hour, _d=kt.dt.dayofweek)
    for _, r in g.iterrows():
        pt = 1 if ((r["_h"] >= 19 or r["_h"] <= 2) and r["_d"] == 5) else 0
        for who, opp in (("home", "away"), ("away", "home")):
            rows.append({"season": y, "week": int(r["week"]), "team": r[f"{who}Team"], "opp": r[f"{opp}Team"],
                         "won": int(r[f"{who}Points"] > r[f"{opp}Points"]), "pt": pt})
tg = pd.DataFrame(rows)
tg["opp_ranked"] = [1 if (s, w, o) in ranked else 0 for s, w, o in zip(tg.season, tg.week, tg.opp)]
tg["self_ranked"] = [1 if (s, w, t) in ranked else 0 for s, w, t in zip(tg.season, tg.week, tg.team)]
tg["is_riv"] = [frozenset((t, o)) in rivpairs for t, o in zip(tg.team, tg.opp)]
tg = tg.sort_values(["team", "season", "week"]); gb = tg.groupby(["team", "season"], group_keys=False)
for c in ["won", "opp_ranked", "self_ranked", "pt", "is_riv"]:
    tg[f"last_{c}"] = gb[c].shift(1)
tg["rival_next"] = gb["is_riv"].shift(-1)
tg["s_ranked_upset"] = ((tg.last_self_ranked == 1) & (tg.last_won == 0) & (tg.last_opp_ranked == 0)).astype(int)
tg["s_pt_rr_letdown"] = ((tg.last_pt == 1) & (tg.last_opp_ranked == 1) & (tg.last_self_ranked == 1)).astype(int)
tg["s_rival_next"] = (tg.rival_next == True).astype(int)
SEQ = ["s_ranked_upset", "s_pt_rr_letdown", "s_rival_next"]

# ---- model away-edge ----
gm = pd.read_parquet(os.path.join(HERE, "data", "model_games.parquet"))
EXCLUDE = {"game_id", "season", "date", "homeTeam", "awayTeam", "homeConference", "awayConference",
           "homePoints", "awayPoints", "venueId", "actual_total", "actual_margin",
           "spread_close", "spread_open", "total_close", "total_open"}
num = gm.select_dtypes(include=[np.number, "Int64", "boolean"]); FEATS = [c for c in num.columns if c not in EXCLUDE]
gm[FEATS] = gm[FEATS].apply(pd.to_numeric, errors="coerce")
P = []
for S in TS:
    tr = gm[(gm.season < S) & gm.actual_margin.notna()]
    te = gm[(gm.season == S) & gm.spread_open.notna() & gm.actual_margin.notna()].copy()
    te["pred"] = HistGradientBoostingRegressor(max_iter=300, learning_rate=0.05, max_depth=4,
        l2_regularization=1.0, random_state=0).fit(tr[FEATS], tr.actual_margin).predict(te[FEATS])
    P.append(te)
A = pd.concat(P); A["medge"] = A["pred"] + A["spread_open"]
A = A[(A.actual_margin + A.spread_open) != 0].copy()
A["home_cover"] = (A.actual_margin + A.spread_open) > 0
P5 = {"SEC", "Big Ten", "Big 12", "ACC", "Pac-12"}
A["p5"] = A.homeConference.isin(P5) & A.awayConference.isin(P5)
for side in ["homeTeam", "awayTeam"]:
    A = A.merge(tg[["season", "week", "team"] + SEQ].rename(columns={"team": side, **{s: f"{side[:4]}_{s}" for s in SEQ}}),
                on=["season", "week", side], how="left")
sp = A["spread_open"]

def ev(name, mask, side):
    m = mask.fillna(False) if hasattr(mask, "fillna") else mask
    b = A[m]; n = len(b)
    if n < 30:
        print(f"  {name:<40} n={n} (thin)"); return None
    hit = b["home_cover"] if side == "home" else ~b["home_cover"]
    h = int(hit.sum())
    per = "/".join(f"{100*(b['home_cover'][b.season==s] if side=='home' else ~b['home_cover'][b.season==s]).mean():.0f}" if (b.season==s).sum()>=10 else "--" for s in TS)
    print(f"  {name:<40} n={n:<4} ATS={100*h/n:4.1f}% roi={roi(h,n):+5.1f}  [{per}]")
    return (name, n, abs(100*h/n - 50))

R = []
print("=== TIGHT SPREADS ===")
R += [ev("pick'em |spr|<=3, HOME", sp.abs() <= 3, "home")]
R += [ev("pick'em |spr|<=3, AWAY", sp.abs() <= 3, "away")]
R += [ev("|spr| 3-7, HOME", (sp.abs() > 3) & (sp.abs() <= 7), "home")]
R += [ev("tight<=3 & home dog (bet home)", (sp.abs() <= 3) & (sp > 0), "home")]
R += [ev("tight<=7 & model away edge<=-2", (sp.abs() <= 7) & (A.medge <= -2), "away")]
print("=== TOTALS-STYLE SITUATIONAL on ATS (either team -> bet that team or fade) ===")
R += [ev("ranked upset last wk -> back (bounce)", (A.home_s_ranked_upset == 1), "home")]
R += [ev("ranked upset last wk -> back (away)", (A.away_s_ranked_upset == 1), "away")]
R += [ev("PT rr letdown -> FADE (bet opp of home-in-spot)", (A.home_s_pt_rr_letdown == 1), "away")]
R += [ev("rival next wk -> FADE home (lookahd)", (A.home_s_rival_next == 1), "away")]
R += [ev("rival next wk -> FADE away (lookahd)", (A.away_s_rival_next == 1), "home")]
print("=== MODEL away-edge x TIER x tight ===")
R += [ev("P5 away edge<=-4", (A.medge <= -4) & A.p5, "away")]
R += [ev("P5 away edge<=-4 & tight<=7", (A.medge <= -4) & A.p5 & (sp.abs() <= 7), "away")]
R += [ev("P5 away edge<=-4 & spread>7 (bigger)", (A.medge <= -4) & A.p5 & (sp.abs() > 7), "away")]

R = [r for r in R if r]
rng = np.random.default_rng(21); hc = A["home_cover"].values
real = sum(1 for _, n, d in R if n >= 40 and d >= 4)
null = [sum(1 for _, n, d in R if n >= 40 and abs(100*pd.Series(rng.permutation(hc)).iloc[:n].mean()-50) >= 4) for _ in range(200)]
print(f"\nFP rough: real {real} vs null95 {np.percentile(null,95):.0f}")
