#!/usr/bin/env python3
"""FACET COMPOSITE (owner, 2026-09-18): six facets per team from the Fantasy Points team tables —
pass offense, pass defense, rush offense, rush defense, O-line, D-line — each an entering-week
(K=4 prior-season-seeded, volume-weighted) z-score vs the league; OFF = mean(pass off, rush off,
O-line), DEF = mean(pass def, rush def, D-line), TEAM = OFF + DEF.  gap = TEAM_home − TEAM_away.
Questions, per season 2022-25:
  1. how many points of margin is a unit of gap worth? (slope) and how tightly? (r) — vs the line
  2. does the gap carry anything the line does not? r(gap, margin residual vs close / vs open)
  3. bet the better composite at |gap| ≥ t: win% vs open and vs close
  4. totals: TOT = OFF_h + OFF_a − DEF_h − DEF_a → slope on actual total, residual vs the total line
  5. gap decile → avg margin, avg line, avg residual (the plain-language table)
No model. No fitting except one slope. Everything else is a correlation or a win rate."""
import numpy as np, pandas as pd, warnings
warnings.filterwarnings("ignore")
FP = "data/fpdata/"; num = lambda s: pd.to_numeric(s, errors="coerce")
NICK = {"Cardinals":"ARI","Falcons":"ATL","Ravens":"BAL","Bills":"BUF","Panthers":"CAR","Bears":"CHI","Bengals":"CIN","Browns":"CLE","Cowboys":"DAL","Broncos":"DEN","Lions":"DET","Packers":"GB","Texans":"HOU","Colts":"IND","Jaguars":"JAX","Chiefs":"KC","Rams":"LAR","Chargers":"LAC","Raiders":"LV","Dolphins":"MIA","Vikings":"MIN","Patriots":"NE","Saints":"NO","Giants":"NYG","Jets":"NYJ","Eagles":"PHI","Steelers":"PIT","Seahawks":"SEA","49ers":"SF","Buccaneers":"TB","Titans":"TEN","Commanders":"WAS","Football Team":"WAS","Redskins":"WAS"}
def load(t):
    d = pd.read_parquet(FP + t + ".parquet"); d = d[d.__season >= 2021].rename(columns={"__season":"season","__week":"week"}); d["team"] = d.teamNickname.map(NICK); return d
PT, PO, RT, RO, LM = load("passingAdvanced__team"), load("passingAdvanced__opponent"), load("rushingAdvanced__team"), load("rushingAdvanced__opponent"), load("lineMatchups__team")
K = ["season","week","team"]
F = PT[K].copy()
F["db"] = num(PT.teamStatsPassingDropbacksTotal); F["pass_off"] = num(PT.teamStatsPassingPasserRating)
F["ol_press"] = num(PT.teamStatsPassingPressuredPercentage)                                  # pressure ALLOWED (lower = better line)
F = F.merge(PO[K].assign(db_d=num(PO.opponentStatsPassingDropbacksTotal), pass_def=num(PO.opponentStatsPassingPasserRating), dl_press=num(PO.opponentStatsPassingPressuredPercentage)), on=K, how="left")   # opp rating allowed; pressure GENERATED
F = F.merge(RT[K].assign(att=num(RT.teamStatsRushingAttemptsTotal), rush_off=num(RT.teamStatsRushingAttemptsSuccessPercentage), ol_ybco=num(RT.teamStatsRushingYardsBeforeContactPerAttempt)), on=K, how="left")
F = F.merge(RO[K].assign(att_d=num(RO.opponentStatsRushingAttemptsTotal), rush_def=num(RO.opponentStatsRushingAttemptsSuccessPercentage), dl_stuff=num(RO.opponentStatsRushingAttemptsStuffsPercentage)), on=K, how="left")
FACETS = {"pass_off": ("db", +1), "pass_def": ("db_d", -1), "rush_off": ("att", +1), "rush_def": ("att_d", -1), "ol_press": ("db", -1), "ol_ybco": ("att", +1), "dl_press": ("db_d", +1), "dl_stuff": ("att_d", +1)}
def entering(df):
    d = df.sort_values(["team","season","week"]).copy(); out = pd.DataFrame(index=d.index)
    for m, (w, sgn) in FACETS.items():
        d["_n"] = d[m] * d[w]; pri = d.groupby(["team","season"]).agg(a=("_n","sum"), b=(w,"sum")); pri["r"] = pri.a / pri.b
        p = pd.Series([pri.r.get((t, s - 1), np.nan) for t, s in zip(d.team, d.season)], index=d.index); k = 4 * d[w].mean()
        g = d.groupby(["team","season"]); cs = g["_n"].cumsum() - d["_n"]; cn = g[w].cumsum() - d[w]
        v = (cs + k * p.fillna(0)) / (cn + k * p.notna()); v[(cn == 0) & p.isna()] = np.nan; out["e_" + m] = v
    return out.reindex(df.index)
E = pd.concat([F[K], entering(F)], axis=1)
# z-score each facet within season-week across the 32 teams (so the composite is 'how much better than the league this week'), signed so higher = better
for m, (w, sgn) in FACETS.items():
    E["z_" + m] = sgn * (E["e_" + m] - E.groupby(["season","week"])["e_" + m].transform("mean")) / E.groupby(["season","week"])["e_" + m].transform("std")
E["OFF"] = E[["z_pass_off","z_rush_off"]].mean(axis=1) * 2/3 + E[["z_ol_press","z_ol_ybco"]].mean(axis=1) / 3     # pass off, rush off, O-line equally
E["DEF"] = E[["z_pass_def","z_rush_def"]].mean(axis=1) * 2/3 + E[["z_dl_press","z_dl_stuff"]].mean(axis=1) / 3
E["TEAM"] = E.OFF + E.DEF
m = pd.read_parquet("data/matchup.parquet")[["season","week","home_ab","away_ab","home_score","away_score","home_spread","nv_total_line"]]
m["home_ab"] = m.home_ab.replace({"LA":"LAR"}); m["away_ab"] = m.away_ab.replace({"LA":"LAR"})
od = pd.read_parquet("data/odds_consensus.parquet")[["season","home_ab","away_ab","open_spread","open_total"]]
G = m.merge(od, on=["season","home_ab","away_ab"], how="left")
G = G.merge(E[K + ["OFF","DEF","TEAM"]].rename(columns={"team":"home_ab","OFF":"OFF_h","DEF":"DEF_h","TEAM":"TEAM_h"}), on=["season","week","home_ab"], how="inner")
G = G.merge(E[K + ["OFF","DEF","TEAM"]].rename(columns={"team":"away_ab","OFF":"OFF_a","DEF":"DEF_a","TEAM":"TEAM_a"}), on=["season","week","away_ab"], how="inner")
G = G[(G.week >= 2) & G.home_score.notna() & G.home_spread.notna()].dropna(subset=["TEAM_h","TEAM_a"]).copy()
G["margin"] = G.home_score - G.away_score; G["total"] = G.home_score + G.away_score
G["gap"] = G.TEAM_h - G.TEAM_a; G["tot_comp"] = G.OFF_h + G.OFF_a - G.DEF_h - G.DEF_a
G["line_margin"] = -G.home_spread; G["resid_close"] = G.margin + G.home_spread; G["resid_open"] = G.margin + G.open_spread
G["tot_resid"] = G.total - G.nv_total_line; G["tot_resid_open"] = G.total - G.open_total
YRS = (2022, 2023, 2024, 2025); G = G[G.season.isin(YRS)]
print(f"{len(G)} games 2022-25 with entering composites both sides.  gap sd {G.gap.std():.2f}\n")
print("1. POINTS PER UNIT OF GAP — slope of actual margin on gap, and how tightly it tracks (r), vs the closing line")
for yr in list(YRS) + ["pooled"]:
    x = G if yr == "pooled" else G[G.season == yr]; b = np.polyfit(x.gap, x.margin, 1)[0]; bl = np.polyfit(x.gap, x.line_margin, 1)[0]
    print(f"  {str(yr):6s} n={len(x):4d} | gap→margin {b:+.2f} pts/unit, r={np.corrcoef(x.gap, x.margin)[0,1]:+.3f} | gap→LINE {bl:+.2f} pts/unit, r={np.corrcoef(x.gap, x.line_margin)[0,1]:+.3f} | line→margin r={np.corrcoef(x.line_margin, x.margin)[0,1]:+.3f}")
print("\n2. WHAT THE LINE DOES NOT CARRY — r(gap, margin residual)")
for yr in list(YRS) + ["pooled"]:
    x = G if yr == "pooled" else G[G.season == yr]; xo = x.dropna(subset=["resid_open"])
    print(f"  {str(yr):6s} vs close r={np.corrcoef(x.gap, x.resid_close)[0,1]:+.3f} | vs open r={np.corrcoef(xo.gap, xo.resid_open)[0,1]:+.3f} (n={len(xo)})")
print("\n3. BET THE BETTER COMPOSITE at |gap| ≥ t (units of composite; win% at -110, push = no action)")
def bet(x, col, line, thr):
    x = x[x[col].abs() >= thr]; res = x.margin + x[line]; res = res[res.notna()]; x = x.loc[res.index]; ok = res != 0
    won = np.where(x[col] > 0, res > 0, res < 0)[ok]; return len(won), 100 * won.mean() if len(won) else np.nan
for thr in (0.5, 1.0, 1.5, 2.0):
    line = f"  |gap|≥{thr}: "
    for yr in YRS:
        x = G[G.season == yr]; n1, w1 = bet(x, "gap", "home_spread", thr); n2, w2 = bet(x, "gap", "open_spread", thr); line += f"{yr} close {w1:4.1f}% open {w2:4.1f}% n={n1:3d} | "
    n1, w1 = bet(G, "gap", "home_spread", thr); n2, w2 = bet(G, "gap", "open_spread", thr); print(line + f"pooled close {w1:.1f}% open {w2:.1f}% n={n1}")
print("\n4. TOTALS — offensive strength minus defensive strength, both teams: slope on actual total, and the residual vs the total line")
for yr in list(YRS) + ["pooled"]:
    x = G if yr == "pooled" else G[G.season == yr]; b = np.polyfit(x.tot_comp, x.total, 1)[0]; bl = np.polyfit(x.tot_comp, x.nv_total_line, 1)[0]
    print(f"  {str(yr):6s} comp→total {b:+.2f} pts/unit r={np.corrcoef(x.tot_comp, x.total)[0,1]:+.3f} | comp→LINE {bl:+.2f} r={np.corrcoef(x.tot_comp, x.nv_total_line)[0,1]:+.3f} | comp vs residual r={np.corrcoef(x.tot_comp, x.tot_resid)[0,1]:+.3f}")
def tbet(x, thr, line):
    x = x[x.tot_comp.abs() >= thr].dropna(subset=[line]); res = x.total - x[line]; ok = res != 0; won = np.where(x.tot_comp > 0, res > 0, res < 0)[ok]; return len(won), 100 * won.mean() if len(won) else np.nan
for thr in (0.5, 1.0, 1.5):
    line = f"  |comp|≥{thr} (over if offenses > defenses): "
    for yr in YRS: n1, w1 = tbet(G[G.season == yr], thr, "nv_total_line"); line += f"{yr} {w1:4.1f}% n={n1:3d} | "
    n1, w1 = tbet(G, thr, "nv_total_line"); print(line + f"pooled {w1:.1f}% n={n1}")
print("\n5. GAP DECILE → what actually happens (pooled): avg composite gap, avg actual margin, avg closing line (home perspective), avg residual")
G["dec"] = pd.qcut(G.gap, 10, labels=False) + 1
print(G.groupby("dec").agg(gap=("gap","mean"), margin=("margin","mean"), line=("line_margin","mean"), resid=("resid_close","mean"), n=("gap","size")).round(2).to_string())
print("\n6. FACET BY FACET — which facet gap tracks margin, and which has anything left after the line (pooled r)")
for f in ("pass_off","pass_def","rush_off","rush_def","ol_press","ol_ybco","dl_press","dl_stuff"):
    h = E[K + ["z_" + f]].rename(columns={"team":"home_ab","z_" + f: "h"}); a = E[K + ["z_" + f]].rename(columns={"team":"away_ab","z_" + f: "a"})
    x = G.merge(h, on=["season","week","home_ab"]).merge(a, on=["season","week","away_ab"]); d = x.h - x.a
    print(f"  {f:9s} r(margin)={np.corrcoef(d, x.margin)[0,1]:+.3f}  r(line)={np.corrcoef(d, x.line_margin)[0,1]:+.3f}  r(residual vs close)={np.corrcoef(d, x.resid_close)[0,1]:+.3f}")
