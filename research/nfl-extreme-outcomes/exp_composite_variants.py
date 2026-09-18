#!/usr/bin/env python3
"""IS THE COMPOSITE BUILT WRONG?  (owner, 2026-09-18)  Four builds of the team composite, same test:
  V1  the six-facet equal-weight composite from exp_composite.py
  V2  RICH facets (pass: YPA, completion over expected, YAC%, deep%, sack%, drops%; rush: success, explosive%,
      YACO/att, YBCO/att, MTF/att; line: pressure allowed / generated over expected; both sides) equal weight
  V3  V2 facets, weights FITTED to actual margin, walk-forward (train < season)
  V4  V2 facets, weights fitted to the RESIDUAL vs the OPENER, walk-forward — learns what the opener misses
Each reports: r with the closing line, r with margin, r with the residual vs open, and the bet at the
top/bottom decile of the composite edge vs the opener, per season. If no build finds a residual, the
composite is right and the market simply prices it."""
import numpy as np, pandas as pd, warnings
from sklearn.linear_model import Ridge
warnings.filterwarnings("ignore")
FP = "data/fpdata/"; num = lambda s: pd.to_numeric(s, errors="coerce")
NICK = {"Cardinals":"ARI","Falcons":"ATL","Ravens":"BAL","Bills":"BUF","Panthers":"CAR","Bears":"CHI","Bengals":"CIN","Browns":"CLE","Cowboys":"DAL","Broncos":"DEN","Lions":"DET","Packers":"GB","Texans":"HOU","Colts":"IND","Jaguars":"JAX","Chiefs":"KC","Rams":"LAR","Chargers":"LAC","Raiders":"LV","Dolphins":"MIA","Vikings":"MIN","Patriots":"NE","Saints":"NO","Giants":"NYG","Jets":"NYJ","Eagles":"PHI","Steelers":"PIT","Seahawks":"SEA","49ers":"SF","Buccaneers":"TB","Titans":"TEN","Commanders":"WAS","Football Team":"WAS","Redskins":"WAS"}
def load(t):
    d = pd.read_parquet(FP + t + ".parquet"); d = d[d.__season >= 2021].rename(columns={"__season":"season","__week":"week"}); d["team"] = d.teamNickname.map(NICK); return d
PT, PO, RT, RO = load("passingAdvanced__team"), load("passingAdvanced__opponent"), load("rushingAdvanced__team"), load("rushingAdvanced__opponent")
K = ["season","week","team"]
def cols(d, p, w):
    o = d[K].copy(); o[w] = num(d[f"{p}{'PassingDropbacksTotal' if w.startswith('db') else 'RushingAttemptsTotal'}"]); return o
F = cols(PT, "teamStats", "db")
for c, src in (("p_rating","PassingPasserRating"), ("p_ypa","PassingYardsPerAttempt"), ("p_cpoe","PassingCompletionsOverExpected"), ("p_yac","PassingYardsAfterCatchPercentage"), ("p_deep","PassingDeepThrowAttemptsPercentage"), ("p_sack","PassingSackedPercentage"), ("p_drop","PassingDropsPercentage"), ("ol_press","PassingPressuredPercentage"), ("ol_pressoe","PassingPressuredOverExpected")): F[c] = num(PT["teamStats" + src])
F = F.merge(cols(PO, "opponentStats", "db_d").assign(**{c: num(PO["opponentStats" + s]) for c, s in (("d_rating","PassingPasserRating"), ("d_ypa","PassingYardsPerAttempt"), ("d_cpoe","PassingCompletionsOverExpected"), ("d_yac","PassingYardsAfterCatchPercentage"), ("d_sack","PassingSackedPercentage"), ("dl_press","PassingPressuredPercentage"), ("dl_pressoe","PassingPressuredOverExpected"))}), on=K, how="left")
F = F.merge(cols(RT, "teamStats", "att").assign(**{c: num(RT["teamStats" + s]) for c, s in (("r_succ","RushingAttemptsSuccessPercentage"), ("r_expl","RushingRunsExplosivePercentage"), ("r_yaco","RushingYardsAfterContactPerAttempt"), ("r_ybco","RushingYardsBeforeContactPerAttempt"), ("r_mtf","RushingMissedTacklesForcedPerAttempt"), ("r_stuff","RushingAttemptsStuffsPercentage"))}), on=K, how="left")
F = F.merge(cols(RO, "opponentStats", "att_d").assign(**{c: num(RO["opponentStats" + s]) for c, s in (("rd_succ","RushingAttemptsSuccessPercentage"), ("rd_expl","RushingRunsExplosivePercentage"), ("rd_yaco","RushingYardsAfterContactPerAttempt"), ("rd_ybco","RushingYardsBeforeContactPerAttempt"), ("rd_mtf","RushingMissedTacklesForcedPerAttempt"), ("rd_stuff","RushingAttemptsStuffsPercentage"))}), on=K, how="left")
# sign: +1 = higher is better for the team; weight column for the entering average
SPEC = {"p_rating":("db",+1),"p_ypa":("db",+1),"p_cpoe":("db",+1),"p_yac":("db",+1),"p_deep":("db",+1),"p_sack":("db",-1),"p_drop":("db",-1),"ol_press":("db",-1),"ol_pressoe":("db",-1),
        "d_rating":("db_d",-1),"d_ypa":("db_d",-1),"d_cpoe":("db_d",-1),"d_yac":("db_d",-1),"d_sack":("db_d",+1),"dl_press":("db_d",+1),"dl_pressoe":("db_d",+1),
        "r_succ":("att",+1),"r_expl":("att",+1),"r_yaco":("att",+1),"r_ybco":("att",+1),"r_mtf":("att",+1),"r_stuff":("att",-1),
        "rd_succ":("att_d",-1),"rd_expl":("att_d",-1),"rd_yaco":("att_d",-1),"rd_ybco":("att_d",-1),"rd_mtf":("att_d",-1),"rd_stuff":("att_d",+1)}
d = F.sort_values(["team","season","week"]).copy(); Z = d[K].copy()
for m, (w, sgn) in SPEC.items():
    d["_n"] = d[m] * d[w]; pri = d.groupby(["team","season"]).agg(a=("_n","sum"), b=(w,"sum")); pri["r"] = pri.a / pri.b
    p = pd.Series([pri.r.get((t, s - 1), np.nan) for t, s in zip(d.team, d.season)], index=d.index); k = 4 * d[w].mean()
    g = d.groupby(["team","season"]); cs = g["_n"].cumsum() - d["_n"]; cn = g[w].cumsum() - d[w]
    v = (cs + k * p.fillna(0)) / (cn + k * p.notna()); v[(cn == 0) & p.isna()] = np.nan
    Z[m] = sgn * (v - v.groupby([d.season, d.week]).transform("mean")) / v.groupby([d.season, d.week]).transform("std")
FE = list(SPEC)
m = pd.read_parquet("data/matchup.parquet")[["season","week","home_ab","away_ab","home_score","away_score","home_spread","nv_total_line"]]
m["home_ab"] = m.home_ab.replace({"LA":"LAR"}); m["away_ab"] = m.away_ab.replace({"LA":"LAR"})
od = pd.read_parquet("data/odds_consensus.parquet")[["season","home_ab","away_ab","open_spread"]]
G = m.merge(od, on=["season","home_ab","away_ab"], how="left")
G = G.merge(Z.rename(columns={"team":"home_ab", **{c: "h_" + c for c in FE}}), on=["season","week","home_ab"], how="inner").merge(Z.rename(columns={"team":"away_ab", **{c: "a_" + c for c in FE}}), on=["season","week","away_ab"], how="inner")
G = G[(G.week >= 2) & G.home_score.notna() & G.home_spread.notna()].copy(); G["margin"] = G.home_score - G.away_score; G["line_margin"] = -G.home_spread
for c in FE: G["g_" + c] = G["h_" + c] - G["a_" + c]
GF = ["g_" + c for c in FE]; G[GF] = G[GF].fillna(0)
G["resid_open"] = G.margin + G.open_spread; G["resid_close"] = G.margin + G.home_spread
V1 = ["g_p_rating","g_d_rating","g_r_succ","g_rd_succ","g_ol_press","g_r_ybco","g_dl_press","g_rd_stuff"]
G["V1"] = G[V1].mean(axis=1); G["V2"] = G[GF].mean(axis=1)
def fitted(target, name):
    G[name] = np.nan
    for yr in (2022, 2023, 2024, 2025):
        tr = G[(G.season < yr)].dropna(subset=[target]); te = G.season == yr
        if len(tr) < 150: continue
        r = Ridge(alpha=30.0).fit(tr[GF], tr[target]); G.loc[te, name] = r.predict(G.loc[te, GF])
fitted("margin", "V3"); fitted("resid_open", "V4")
print(f"{len(G)} games; openers on {G.open_spread.notna().sum()} (2023+)\n")
print(f"  {'build':52s} | r(line)  r(margin)  r(resid vs open)  r(resid vs close) | bet top/bottom decile vs OPENER by season")
for name, lab in (("V1","six facets, equal weight"), ("V2","28 facets, equal weight"), ("V3","28 facets, weights fitted to margin (walk-fwd)"), ("V4","28 facets, weights fitted to the opener RESIDUAL (walk-fwd)")):
    x = G.dropna(subset=[name]); xo = x.dropna(subset=["open_spread"])
    rl, rm = np.corrcoef(x[name], x.line_margin)[0,1], np.corrcoef(x[name], x.margin)[0,1]
    ro, rc = np.corrcoef(xo[name], xo.resid_open)[0,1], np.corrcoef(x[name], x.resid_close)[0,1]
    per = []
    for yr in (2023, 2024, 2025):
        y = xo[xo.season == yr].copy()
        if name == "V4": y["edge"] = y[name]                                   # already a residual prediction
        else:
            b = np.polyfit(x[(x.season < yr)][name], x[(x.season < yr)].margin, 1)[0]; y["edge"] = b * y[name] + y.open_spread   # implied margin vs the opener
        q = y.edge.abs().quantile(0.8); z = y[y.edge.abs() >= q]; res = z.margin + z.open_spread; ok = res != 0
        won = np.where(z.edge > 0, res > 0, res < 0)[ok]; per.append(f"{yr} {100*won.mean():4.1f}% n={len(won):2d}")
    print(f"  {lab:52s} | {rl:+.3f}   {rm:+.3f}     {ro:+.3f}            {rc:+.3f}      | " + "  ".join(per))
print("\n  (a build that is 'right' tracks the line strongly; a build with SIGNAL would show r(resid) > ~.10 and top-quintile bets > 55% in most seasons)")
