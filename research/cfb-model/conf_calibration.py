"""
Conference calibration: the opponent adjustment over-rates G5 (model over-rates G5 by ~2.5 in
cross-conf games). Add a leak-safe CONFERENCE-STRENGTH signal so the model can discount G5 ratings,
and a CONFERENCE-RELATIVE rating ("good within your conference"). Test: does it fix the mixed bias
AND unlock betting edge in soft G5-G5 / mixed markets?
"""
import os
import numpy as np
import pandas as pd
from sklearn.ensemble import HistGradientBoostingRegressor

HERE = os.path.dirname(os.path.abspath(__file__))
gm = pd.read_parquet(os.path.join(HERE, "data", "model_games.parquet"))
TS = [2021, 2022, 2023, 2024, 2025]; P5 = {"SEC", "Big Ten", "Big 12", "ACC", "Pac-12"}
def roi(h, n): return (h * 0.909 - (n - h)) / n * 100 if n else 0.0

# conference strength = prior-year final SP+ averaged by conference (leak-safe, stable, coarse)
import cfbd
sp_rows = []
for y in range(2015, 2026):
    try:
        for r in cfbd.get("/ratings/sp", year=y):
            sp_rows.append({"year": y, "team": r["team"], "conf": r.get("conference"), "sp": r.get("rating")})
    except Exception:
        pass
sp = pd.DataFrame(sp_rows)
conf_str = sp.groupby(["year", "conf"]).sp.mean().reset_index().rename(columns={"sp": "conf_str"})
conf_str["season"] = conf_str["year"] + 1  # prior-year -> leak-safe for current
conf_str = conf_str[["season", "conf", "conf_str"]]

# map team's conference strength (by that season's conference)
for side in ["home", "away"]:
    gm = gm.merge(conf_str.rename(columns={"conf": f"{side}Conference", "conf_str": f"{side}_conf_str"}),
                  on=["season", f"{side}Conference"], how="left")
gm["conf_str_diff"] = gm["home_conf_str"] - gm["away_conf_str"]
# conference-relative net rating: team net_rating minus its conference's avg net_rating that week
nr = gm[["season", "homeConference", "home_net_rating"]].rename(columns={"homeConference": "conf", "home_net_rating": "nr"})
nr2 = gm[["season", "awayConference", "away_net_rating"]].rename(columns={"awayConference": "conf", "away_net_rating": "nr"})
confavg = pd.concat([nr, nr2]).groupby(["season", "conf"]).nr.mean().reset_index().rename(columns={"nr": "conf_avg_nr"})
for side in ["home", "away"]:
    gm = gm.merge(confavg.rename(columns={"conf": f"{side}Conference", "conf_avg_nr": f"{side}_conf_avg_nr"}),
                  on=["season", f"{side}Conference"], how="left")
    gm[f"{side}_rel_nr"] = pd.to_numeric(gm[f"{side}_net_rating"], errors="coerce") - gm[f"{side}_conf_avg_nr"]

NEW = ["home_conf_str", "away_conf_str", "conf_str_diff", "home_rel_nr", "away_rel_nr"]
EXCLUDE = {"game_id", "season", "date", "homeTeam", "awayTeam", "homeConference", "awayConference",
           "homePoints", "awayPoints", "venueId", "actual_total", "actual_margin",
           "spread_close", "spread_open", "total_close", "total_open"}
num = gm.select_dtypes(include=[np.number, "Int64", "boolean"]); BASE = [c for c in num.columns if c not in EXCLUDE and c not in NEW]
gm[BASE + NEW] = gm[BASE + NEW].apply(pd.to_numeric, errors="coerce")

def run(feats, label):
    P = []
    for S in TS:
        tr = gm[(gm.season < S) & gm.actual_margin.notna()]
        te = gm[(gm.season == S) & gm.spread_open.notna() & gm.actual_margin.notna()].copy()
        te["pred"] = HistGradientBoostingRegressor(max_iter=300, learning_rate=0.05, max_depth=4,
            l2_regularization=1.0, random_state=0).fit(tr[feats], tr.actual_margin).predict(te[feats])
        P.append(te)
    A = pd.concat(P); A["edge"] = A.pred + A.spread_open; A = A[(A.actual_margin + A.spread_open) != 0]
    A["aw"] = (A.actual_margin + A.spread_open) < 0
    A["tier"] = np.where(A.homeConference.isin(P5) & A.awayConference.isin(P5), "P5", np.where(~A.homeConference.isin(P5) & ~A.awayConference.isin(P5), "G5", "MIX"))
    # mixed bias
    mix = A[A.tier == "MIX"].copy(); mix["p5h"] = mix.homeConference.isin(P5)
    mix["pred_p5"] = np.where(mix.p5h, mix.pred, -mix.pred); mix["act_p5"] = np.where(mix.p5h, mix.actual_margin, -mix.actual_margin)
    bias = mix.pred_p5.mean() - mix.act_p5.mean()
    print(f"{label}")
    print(f"  MAE by tier: P5 {A[A.tier=='P5'].eval('abs(pred-actual_margin)').mean():.2f} "
          f"G5 {A[A.tier=='G5'].eval('abs(pred-actual_margin)').mean():.2f} MIX {A[A.tier=='MIX'].eval('abs(pred-actual_margin)').mean():.2f} | mixed P5-bias {bias:+.2f}")
    # betting by tier: best away/home edge
    for t in ["P5", "G5", "MIX"]:
        b = A[(A.tier == t) & (A.edge.abs() >= 4)]
        # bet model side: edge<0 away, edge>0 home
        hit = np.where(b.edge < 0, b.aw, ~b.aw); n = len(b); h = int(hit.sum())
        print(f"    {t} edge>=4 (both sides): n={n} {100*h/n if n else 0:.1f}% | away-only e<=-4: ", end="")
        ba = A[(A.tier == t) & (A.edge <= -4)]; print(f"{len(ba)} {100*ba.aw.mean() if len(ba) else 0:.1f}%")

run(BASE, "BASE (no conf calibration):")
run(BASE + NEW, "+ CONF STRENGTH + RELATIVE:")
