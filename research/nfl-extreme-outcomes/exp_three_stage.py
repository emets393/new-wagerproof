#!/usr/bin/env python3
"""THREE-STAGE MATCHUP (owner, 2026-09-18), built literally, readout at every stage.
 STAGE 1  STRATEGY: what does this offense do more of against THIS defense?  Usage = pass rate over
          expected (PROE) this game.  Defense described two ways: SCHEME (man-heavy vs zone-heavy;
          two-high vs single-high, entering shares) and TIER (good / neutral / bad pass defense and
          run defense by entering rating-allowed / success-allowed, terciles each week).
          Readout: how much an offense's pass rate moves vs its own norm by scheme x tier cell, and
          how well this game's PROE can be predicted (walk-forward r).
 STAGE 2  EFFICIENCY vs the cell: pass yards/attempt and rush success this game vs own norm, by cell
          (league) and the team's own history vs that cell (entering, shrunk). Walk-forward r.
 STAGE 3  EXPECTED POINTS over league average per team = f(predicted usage, predicted pass eff,
          predicted rush eff) fit on prior seasons; both teams -> total and spread; vs the lines.
Entering values K=4 prior-season-seeded. Team-game rows 2021-25 from Fantasy Points team tables."""
import numpy as np, pandas as pd, warnings
warnings.filterwarnings("ignore")
FP = "data/fpdata/"; num = lambda s: pd.to_numeric(s, errors="coerce")
NICK = {"Cardinals":"ARI","Falcons":"ATL","Ravens":"BAL","Bills":"BUF","Panthers":"CAR","Bears":"CHI","Bengals":"CIN","Browns":"CLE","Cowboys":"DAL","Broncos":"DEN","Lions":"DET","Packers":"GB","Texans":"HOU","Colts":"IND","Jaguars":"JAX","Chiefs":"KC","Rams":"LAR","Chargers":"LAC","Raiders":"LV","Dolphins":"MIA","Vikings":"MIN","Patriots":"NE","Saints":"NO","Giants":"NYG","Jets":"NYJ","Eagles":"PHI","Steelers":"PIT","Seahawks":"SEA","49ers":"SF","Buccaneers":"TB","Titans":"TEN","Commanders":"WAS","Football Team":"WAS","Redskins":"WAS"}
def load(t):
    d = pd.read_parquet(FP + t + ".parquet"); d = d[d.__season >= 2021].rename(columns={"__season":"season","__week":"week"}); d["team"] = d.teamNickname.map(NICK); return d
K = ["season","week","team"]
PT, PO, RT, RO, CV, PR = load("passingAdvanced__team"), load("passingAdvanced__opponent"), load("rushingAdvanced__team"), load("rushingAdvanced__opponent"), load("coverageMatrix__opponent"), load("proeReport__team")
T = PR[K].copy(); T["snaps"] = num(PR.teamStatsSnapsOffenseTotal); T["db"] = num(PR.teamStatsPassingDropbacksTotal); T["proe"] = (T.db - num(PR.teamStatsPassingDropbacksExpected)) / T.snaps
T = T.merge(PT[K].assign(att=num(PT.teamStatsPassingAttemptsTotal), ypa=num(PT.teamStatsPassingYardsPerAttempt), rating=num(PT.teamStatsPassingPasserRating)), on=K, how="left")
T = T.merge(RT[K].assign(ratt=num(RT.teamStatsRushingAttemptsTotal), rsucc=num(RT.teamStatsRushingAttemptsSuccessPercentage), ypc=num(RT.teamStatsRushingYardsPerAttempt)), on=K, how="left")
Dd = CV[K].copy(); Dd["ddb"] = num(CV.opponentStatsPassingDropbacksTotal) if "opponentStatsPassingDropbacksTotal" in CV.columns else np.nan
Dd["man"] = num(CV.opponentStatsCoverageSchemeManPassingDropbacksPercentage); Dd["twohigh"] = num(CV.opponentStatsCoverageSchemeTwoHighPassingDropbacksPercentage)
Dd = Dd.merge(PO[K].assign(ddb2=num(PO.opponentStatsPassingDropbacksTotal), d_rating=num(PO.opponentStatsPassingPasserRating), d_ypa=num(PO.opponentStatsPassingYardsPerAttempt)), on=K, how="left"); Dd["ddb"] = Dd.ddb.fillna(Dd.ddb2)
Dd = Dd.merge(RO[K].assign(dratt=num(RO.opponentStatsRushingAttemptsTotal), d_rsucc=num(RO.opponentStatsRushingAttemptsSuccessPercentage)), on=K, how="left")
def entering(df, spec):
    d = df.sort_values(["team","season","week"]).copy(); out = pd.DataFrame(index=d.index)
    for m, w in spec:
        d["_n"] = d[m] * d[w]; pri = d.groupby(["team","season"]).agg(a=("_n","sum"), b=(w,"sum")); pri["r"] = pri.a / pri.b
        p = pd.Series([pri.r.get((t, s - 1), np.nan) for t, s in zip(d.team, d.season)], index=d.index); k = 4 * d[w].mean()
        g = d.groupby(["team","season"]); cs = g["_n"].cumsum() - d["_n"]; cn = g[w].cumsum() - d[w]
        v = (cs + k * p.fillna(0)) / (cn + k * p.notna()); v[(cn == 0) & p.isna()] = np.nan; out["e_" + m] = v
    return out.reindex(df.index)
T = pd.concat([T, entering(T, [("proe","snaps"), ("ypa","att"), ("rating","att"), ("rsucc","ratt"), ("ypc","ratt")])], axis=1)
Dd = pd.concat([Dd, entering(Dd, [("man","ddb"), ("twohigh","ddb"), ("d_rating","ddb"), ("d_ypa","ddb"), ("d_rsucc","dratt")])], axis=1)
# defense SCHEME and TIER labels, entering, terciles within each season-week
for c, lab in (("e_man","scheme_man"), ("e_twohigh","scheme_2high")):
    Dd[lab] = Dd.groupby(["season","week"])[c].transform(lambda s: pd.qcut(s.rank(method="first"), 3, labels=["low","mid","high"]) if s.notna().sum() >= 9 else pd.Series(index=s.index, dtype=object))
Dd["tier_pass"] = Dd.groupby(["season","week"]).e_d_rating.transform(lambda s: pd.qcut(s.rank(method="first"), 3, labels=["GOOD","neutral","BAD"]) if s.notna().sum() >= 9 else pd.Series(index=s.index, dtype=object))   # low rating allowed = GOOD
Dd["tier_run"] = Dd.groupby(["season","week"]).e_d_rsucc.transform(lambda s: pd.qcut(s.rank(method="first"), 3, labels=["GOOD","neutral","BAD"]) if s.notna().sum() >= 9 else pd.Series(index=s.index, dtype=object))
# pair offense with the defense it faced
m = pd.read_parquet("data/matchup.parquet")[["season","week","home_ab","away_ab","home_score","away_score","home_spread","nv_total_line"]]
m["home_ab"] = m.home_ab.replace({"LA":"LAR"}); m["away_ab"] = m.away_ab.replace({"LA":"LAR"})
od = pd.read_parquet("data/odds_consensus.parquet")[["season","home_ab","away_ab","open_spread","open_total"]]; m = m.merge(od, on=["season","home_ab","away_ab"], how="left")
h = m.rename(columns={"home_ab":"team","away_ab":"opp","home_score":"pts","away_score":"opp_pts"}).assign(is_home=1)
a = m.rename(columns={"away_ab":"team","home_ab":"opp","away_score":"pts","home_score":"opp_pts"}).assign(is_home=0)
G = pd.concat([h, a])[["season","week","team","opp","pts","opp_pts","is_home","home_spread","nv_total_line","open_spread","open_total"]]
F = T.merge(G, on=K, how="inner").merge(Dd.drop(columns=["ddb","ddb2","man","twohigh","d_rating","d_ypa","dratt","d_rsucc"], errors="ignore").rename(columns={"team":"opp"}), on=["season","week","opp"], how="left")
F = F[(F.week >= 2) & F.pts.notna()].dropna(subset=["e_proe","e_ypa","e_rsucc","e_man","e_d_rating","e_d_rsucc"]).copy()
F["d_proe"] = F.proe - F.e_proe; F["d_ypa"] = F.ypa - F.e_ypa; F["d_rsucc"] = F.rsucc - F.e_rsucc
F["lg_pts"] = F.groupby("season").pts.transform("mean"); F["pts_over"] = F.pts - F.lg_pts
YRS = (2022, 2023, 2024, 2025); print(f"{len(F)} team-games with entering values on both sides\n")
def wf(target, feats, label, df=None):
    df = F if df is None else df; out = []
    for yr in YRS:
        tr = df[(df.season < yr)].dropna(subset=feats + [target]); te = df[df.season == yr].dropna(subset=feats + [target])
        A = np.column_stack([tr[feats].values, np.ones(len(tr))]); b = np.linalg.lstsq(A, tr[target].values, rcond=None)[0]
        pred = np.column_stack([te[feats].values, np.ones(len(te))]) @ b; out.append(f"{yr} r={np.corrcoef(pred, te[target])[0,1]:+.3f}")
    print(f"  {label:60s} " + "  ".join(out))
# ============================================================ STAGE 1
print("=" * 110); print("STAGE 1 — STRATEGY: does the offense change its pass rate for the defense it faces?"); print("=" * 110)
print("  pass rate over expected THIS GAME minus the offense's own entering norm (pts of PROE, x100), by the DEFENSE's cell:")
for sch, lab in (("scheme_man", "man-heavy (high) vs zone-heavy (low)"), ("scheme_2high", "two-high (high) vs single-high (low)")):
    print(f"\n  {lab}  x  pass-defense tier:"); tab = F.pivot_table(index=sch, columns="tier_pass", values="d_proe", aggfunc=["mean","count"])
    print((100 * tab["mean"]).round(2).to_string()); print("  n:"); print(tab["count"].to_string())
print("\n  run-defense tier: PROE deviation when the opponent's run defense is GOOD / neutral / BAD")
print(pd.DataFrame({"mean_x100": 100 * F.groupby("tier_run").d_proe.mean(), "n": F.groupby("tier_run").d_proe.count()}).round(2).to_string())
print("\n  predictability of THIS game's pass rate (walk-forward, out-of-sample r):")
wf("proe", ["e_proe"], "own tendency only")
wf("proe", ["e_proe","e_man","e_twohigh"], "+ opponent scheme shares")
wf("proe", ["e_proe","e_d_rating","e_d_rsucc"], "+ opponent quality (pass & run defense)")
wf("proe", ["e_proe","e_man","e_twohigh","e_d_rating","e_d_rsucc","is_home"], "+ scheme + quality + home")
# ============================================================ STAGE 2
print("\n" + "=" * 110); print("STAGE 2 — EFFICIENCY vs the cell: how much better/worse offenses do against each defense type and tier"); print("=" * 110)
print("  pass yards/attempt THIS GAME minus own norm, by man-heavy x pass-defense tier:"); tab = F.pivot_table(index="scheme_man", columns="tier_pass", values="d_ypa", aggfunc="mean"); print(tab.round(2).to_string())
print("\n  rush success THIS GAME minus own norm (x100), by run-defense tier:"); print((100 * F.groupby("tier_run").d_rsucc.mean()).round(2).to_string())
# the team's OWN history vs the cell (entering, shrunk to 0 with k=3 games)
F["cell"] = F.scheme_man.astype(str) + "|" + F.tier_pass.astype(str)
F = F.sort_values(["team","season","week"]); g = F.groupby(["team","cell"]); F["own_vs_cell"] = (g.d_ypa.cumsum() - F.d_ypa) / ((g.cumcount()) + 3)
print("\n  predictability of THIS game's pass yards/attempt (walk-forward r):")
wf("ypa", ["e_ypa"], "own norm only")
wf("ypa", ["e_ypa","e_d_ypa"], "+ opponent pass defense (yards/att allowed)")
wf("ypa", ["e_ypa","e_d_ypa","e_man","e_twohigh"], "+ opponent scheme")
wf("ypa", ["e_ypa","e_d_ypa","e_man","e_twohigh","own_vs_cell"], "+ the team's own history vs that scheme x tier cell")
print("  predictability of THIS game's rush success:")
wf("rsucc", ["e_rsucc"], "own norm only"); wf("rsucc", ["e_rsucc","e_d_rsucc"], "+ opponent run defense"); wf("rsucc", ["e_rsucc","e_d_rsucc","e_man","e_twohigh"], "+ opponent scheme")
# ============================================================ STAGE 3
print("\n" + "=" * 110); print("STAGE 3 — EXPECTED POINTS over league average from predicted usage + predicted pass/rush efficiency, both teams -> total & spread"); print("=" * 110)
U = ["e_proe","e_man","e_twohigh","e_d_rating","e_d_rsucc","is_home"]; PE = ["e_ypa","e_d_ypa","e_man","e_twohigh","own_vs_cell"]; RE = ["e_rsucc","e_d_rsucc","e_man","e_twohigh"]
F["p_usage"] = np.nan; F["p_pass"] = np.nan; F["p_rush"] = np.nan; F["xpts"] = np.nan
for yr in YRS:
    tr = F[F.season < yr]; te = F.season == yr
    for tgt, feats, out in (("proe", U, "p_usage"), ("ypa", PE, "p_pass"), ("rsucc", RE, "p_rush")):
        t2 = tr.dropna(subset=feats + [tgt]); A = np.column_stack([t2[feats].values, np.ones(len(t2))]); b = np.linalg.lstsq(A, t2[tgt].values, rcond=None)[0]
        X = F.loc[te, feats].fillna(t2[feats].median()); F.loc[te, out] = np.column_stack([X.values, np.ones(len(X))]) @ b
    # points model on PRIOR seasons uses the same three predicted quantities (built walk-forward inside prior seasons too -> use their entering proxies to avoid refit leakage)
    t3 = tr.dropna(subset=["e_proe","e_ypa","e_rsucc","pts_over"]); A = np.column_stack([t3[["e_proe","e_ypa","e_rsucc","is_home"]].values, np.ones(len(t3))]); b = np.linalg.lstsq(A, t3.pts_over.values, rcond=None)[0]
    X = F.loc[te, ["p_usage","p_pass","p_rush","is_home"]].fillna(0); F.loc[te, "xpts"] = np.column_stack([X.values, np.ones(len(X))]) @ b
S = F[F.season.isin(YRS)].dropna(subset=["xpts"]); print("  xpts rows by season:", S.groupby("season").size().to_dict(), "| entering rows by season:", F.groupby("season").size().to_dict())
hm = S[S.is_home == 1][["season","week","team","opp","xpts","pts","opp_pts","home_spread","nv_total_line","open_spread","open_total"]].rename(columns={"xpts":"x_h","team":"home","opp":"away"})
aw = S[S.is_home == 0][["season","week","team","xpts"]].rename(columns={"xpts":"x_a","team":"away"})
M = hm.merge(aw, on=["season","week","away"], how="inner"); M["x_total"] = M.x_h + M.x_a; M["x_margin"] = M.x_h - M.x_a
M["margin"] = M.pts - M.opp_pts; M["total"] = M.pts + M.opp_pts; M["lg_total"] = M.groupby("season").total.transform("mean")
M["x_over"] = M.x_total; M["x_total"] = M.lg_total + M.x_over          # x_h/x_a are points OVER league average per team
print(f"  {len(M)} games.  r(expected, actual) | r(expected, LINE) | r(expected, residual vs close) | r(expected, residual vs open)")
for yr in list(YRS) + ["pooled"]:
    x = M if yr == "pooled" else M[M.season == yr]; xo = x.dropna(subset=["open_total"])
    print(f"  {str(yr):6s} TOTAL : {np.corrcoef(x.x_total, x.total)[0,1]:+.3f} | {np.corrcoef(x.x_total, x.nv_total_line)[0,1]:+.3f} | {np.corrcoef(x.x_total, x.total - x.nv_total_line)[0,1]:+.3f} | {np.corrcoef(xo.x_total, xo.total - xo.open_total)[0,1] if len(xo) > 30 else np.nan:+.3f}    "
          f"SPREAD: {np.corrcoef(x.x_margin, x.margin)[0,1]:+.3f} | {np.corrcoef(x.x_margin, -x.home_spread)[0,1]:+.3f} | {np.corrcoef(x.x_margin, x.margin + x.home_spread)[0,1]:+.3f} | {np.corrcoef(xo.x_margin, xo.margin + xo.open_spread)[0,1] if len(xo) > 30 else np.nan:+.3f}")
print("\n  bet test — 'both offenses expected above average' (owner's theory): OVER when x_total > league avg total by t, UNDER when below; graded vs the closing total")
for t in (1, 2, 3, 4):
    line = f"  |x_total − lg| ≥ {t}: "
    for yr in YRS:
        x = M[M.season == yr]; z = x[x.x_over.abs() >= t]; res = z.total - z.nv_total_line; ok = res != 0; won = np.where(z.x_over > 0, res > 0, res < 0)[ok]; line += f"{yr} {100*won.mean() if len(won) else np.nan:4.1f}% n={len(won):3d} | "
    print(line)
print("  bet test — expected total vs the CLOSING total itself: OVER when x_total > line by t")
for t in (2, 4, 6):
    line = f"  |x_total − line| ≥ {t}: "
    for yr in YRS:
        x = M[M.season == yr]; z = x[(x.x_total - x.nv_total_line).abs() >= t]; res = z.total - z.nv_total_line; ok = res != 0; won = np.where(z.x_total > z.nv_total_line, res > 0, res < 0)[ok]; line += f"{yr} {100*won.mean() if len(won) else np.nan:4.1f}% n={len(won):3d} | "
    print(line)
print("  bet test — expected margin vs the OPENER: home when x_margin + open > t")
for t in (2, 4, 6):
    line = f"  |x_margin + open| ≥ {t}: "
    for yr in YRS:
        x = M[M.season == yr].dropna(subset=["open_spread"]); e = x.x_margin + x.open_spread; z = x[e.abs() >= t]; e = e[z.index]; res = z.margin + z.open_spread; ok = res != 0; won = np.where(e > 0, res > 0, res < 0)[ok]; line += f"{yr} {100*won.mean() if len(won) else np.nan:4.1f}% n={len(won):3d} | "
    print(line)
