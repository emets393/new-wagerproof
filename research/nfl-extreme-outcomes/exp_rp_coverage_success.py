#!/usr/bin/env python3
"""RECEPTION PERCEPTION REPLICATION + MATCHUP EFFICIENCY PRIOR (owner's PDF, 2026-09-18).

Harmon & Scott (2022): player + year fixed effects on 308 WR-seasons; log(yds/game) ~ success vs
man (+1.56%/pt), vs zone (+0.59%, n.s.), vs press; log(rec/game) ~ man +0.98%, zone +1.04%;
zone's effect on production DOUBLES from outside-90% to slot-80%; man's effect is constant.

PART A — replicate on our data. Unit = WR-season 2021-2025 (FP), >= 150 routes. Success analog =
FP separation score vs Man / vs Zone (separation-by-coverage table, route-weighted). Controls:
contested target %, routes/game, slot share, age proxy unavailable (season FE + player FE absorb
most of it). OLS with player + season fixed effects (within transformation). Report the man/zone
coefficients and the slot interaction so the two datasets can be compared directly.

PART B — the MATCHUP EFFICIENCY PRIOR, per player-game, entering-week:
   prior = p_man(opp) * S_man(player) + p_zone(opp) * S_zone(player) * (1 + slot_share)
   with S = separation vs that coverage minus league, and a yards-per-route version, both K=4
   seeded. Into the reception_yds / receptions / pass_yds (team WR-corps aggregate) prop models,
   judged by the ALL-CONFIGS protocol at best-book (share of configs profitable per season,
   with vs without the prior)."""
import itertools, warnings, numpy as np, pandas as pd
warnings.filterwarnings("ignore")
FP = "data/fpdata/"; num = lambda s: pd.to_numeric(s, errors="coerce"); K = 4.0
NICK = {"Cardinals":"ARI","Falcons":"ATL","Ravens":"BAL","Bills":"BUF","Panthers":"CAR","Bears":"CHI","Bengals":"CIN","Browns":"CLE","Cowboys":"DAL","Broncos":"DEN","Lions":"DET","Packers":"GB","Texans":"HOU","Colts":"IND","Jaguars":"JAX","Chiefs":"KC","Rams":"LA","Chargers":"LAC","Raiders":"LV","Dolphins":"MIA","Vikings":"MIN","Patriots":"NE","Saints":"NO","Giants":"NYG","Jets":"NYJ","Eagles":"PHI","Steelers":"PIT","Seahawks":"SEA","49ers":"SF","Buccaneers":"TB","Titans":"TEN","Commanders":"WAS"}
AB = {"ARZ":"ARI","BLT":"BAL","CLV":"CLE","HST":"HOU"}
def tk(d):
    s = d.teamAbbreviation if "teamAbbreviation" in d.columns and d.teamAbbreviation.notna().any() else d.teamNickname.map(NICK); return s.map(lambda a: AB.get(a, a))
def load(t, flat=False):
    d = pd.read_parquet(FP + ("flat/" if flat else "") + t + ".parquet"); d = d[d.__season >= 2021].copy(); d["team"] = tk(d)
    d["opp"] = d.opponentAbbreviation.map(lambda a: AB.get(a, a)) if "opponentAbbreviation" in d.columns else None
    if "playerPlayerId" in d.columns: d["pid"] = d.playerPlayerId.astype(str)
    return d.rename(columns={"__season":"season","__week":"week"})
SEP, NRT, YPR = "playerStatsReceivingSeparationScorePercentage", "playerStatsReceivingSeparationRoutesTotal", "playerStatsReceivingAveragesPerRouteYardsTotal"
ra = load("player_receiving-advanced"); sc = load("player_receiving-separation-by-coverage", True); sa = load("player_receiving-separation-by-alignment", True); mz = load("receivingManVsZone__player", True)
for b in ("Man","Zone"): sc[f"sep_{b}"], sc[f"n_{b}"] = num(sc[f"{b}__{SEP}"]), num(sc[f"{b}__{NRT}"])
for b in ("Slot","Wide","Inline","Backfield"): sa[f"al_{b}"] = num(sa[f"{b}__{NRT}"])
sa["slot_share"] = sa.al_Slot / sa[[f"al_{b}" for b in ("Slot","Wide","Inline","Backfield")]].sum(axis=1).replace(0, np.nan)
for b in ("Man","Zone"): mz[f"yprr_{b}"], mz[f"nr_{b}"] = num(mz[f"{b}__{YPR}"]), num(mz[f"{b}__playerStatsReceivingRoutesTotal"])
G = ra.merge(sc[["pid","season","week","sep_Man","n_Man","sep_Zone","n_Zone"]], on=["pid","season","week"], how="left").merge(sa[["pid","season","week","slot_share"]], on=["pid","season","week"], how="left").merge(mz[["pid","season","week","yprr_Man","nr_Man","yprr_Zone","nr_Zone"]], on=["pid","season","week"], how="left")
for c in ("playerStatsReceivingRoutesTotal","playerStatsReceivingTargetsTotal","playerStatsReceivingReceptionsTotal","playerStatsReceivingYardsTotal","playerStatsReceivingTargetsContestedTotal"): G[c] = num(G[c])

# ================================================================ PART A — season panel with player + year fixed effects
S = G[G.playerPosition == "WR"].groupby(["pid","season"]).apply(lambda g: pd.Series(dict(nm=g.playerFirstName.iloc[0] + " " + g.playerLastName.iloc[0], games=len(g), routes=g.playerStatsReceivingRoutesTotal.sum(), yds=g.playerStatsReceivingYardsTotal.sum(), rec=g.playerStatsReceivingReceptionsTotal.sum(), tgt=g.playerStatsReceivingTargetsTotal.sum(),
    S_man=100 * (g.sep_Man * g.n_Man).sum() / max(g.n_Man.sum(), 1), S_zone=100 * (g.sep_Zone * g.n_Zone).sum() / max(g.n_Zone.sum(), 1), n_man=g.n_Man.sum(), n_zone=g.n_Zone.sum(),
    contested=100 * g.playerStatsReceivingTargetsContestedTotal.sum() / max(g.playerStatsReceivingTargetsTotal.sum(), 1), slot=100 * (g.slot_share * g.playerStatsReceivingRoutesTotal).sum() / max(g.playerStatsReceivingRoutesTotal.sum(), 1)))).reset_index()
S = S[(S.routes >= 150) & (S.games >= 6) & (S.n_man >= 20) & (S.n_zone >= 40) & (S.yds > 0)].copy(); S["rpg"] = S.routes / S.games
multi = S.groupby("pid").size(); S = S[S.pid.isin(multi[multi >= 2].index)]     # fixed effects need repeat observations
print("=" * 100); print(f"PART A — REPLICATION: {len(S)} WR-seasons ({S.pid.nunique()} players with 2+ seasons), 2021-25, player + season fixed effects"); print("=" * 100)
print(f"  our 'success' analog = FP separation score vs coverage.  means: vs man {S.S_man.mean():.1f}%, vs zone {S.S_zone.mean():.1f}% (RP: success 67% / 78%)")
def fe_ols(df, y, X):
    d = df.copy(); d["y"] = np.log(d[y] / d.games)
    cols = ["y"] + X
    for c in cols: d[c] = d[c] - d.groupby("pid")[c].transform("mean") - d.groupby("season")[c].transform("mean") + d[c].mean()   # two-way within transform
    A = np.column_stack([d[X].values, np.ones(len(d))]); b = np.linalg.lstsq(A, d.y.values, rcond=None)[0]; res = d.y.values - A @ b
    dof = len(d) - A.shape[1] - d.pid.nunique() - d.season.nunique(); se = np.sqrt(np.diag(np.linalg.pinv(A.T @ A)) * (res ** 2).sum() / max(dof, 1))
    return b, se, 1 - (res ** 2).sum() / ((d.y - d.y.mean()) ** 2).sum()
X = ["S_man","S_zone","contested","rpg","slot"]
print(f"  {'outcome':16s} | {'sep vs man':>14s} | {'sep vs zone':>14s} | {'contested':>10s} | {'routes/g':>10s} | {'slot %':>10s} | within R²   (RP paper: man +1.56%/pt yds, +0.98% rec, +0.85% tgt; zone +0.59 / +1.04 / +0.55)")
for y, lab in (("yds","yards/game"), ("rec","rec/game"), ("tgt","targets/game")):
    b, se, r2 = fe_ols(S, y, X); print(f"  {lab:16s} | " + " | ".join(f"{100*b[i]:+6.2f}% ({b[i]/se[i]:+4.1f})" for i in range(5)) + f" | {r2:.3f}")
print("  (coefficient = % change in the per-game outcome per +1 point of separation; t-stat in parentheses)")
# slot interaction: does zone-success matter more for slot receivers?
S["S_zone_x_slot"] = S.S_zone * (S.slot / 100); S["S_man_x_slot"] = S.S_man * (S.slot / 100)
b, se, r2 = fe_ols(S, "yds", X + ["S_zone_x_slot","S_man_x_slot"])
for sl in (10, 30, 50, 70): print(f"  yards/game: effect of +1 sep vs ZONE at slot={sl}%: {100*(b[1] + b[5]*sl/100):+.2f}%   vs MAN: {100*(b[0] + b[6]*sl/100):+.2f}%" + ("   (RP: zone doubles from outside-90% to slot-80%; man constant)" if sl == 70 else ""))

# ================================================================ PART B — matchup efficiency prior into the prop models
print("\n" + "=" * 100); print("PART B — MATCHUP EFFICIENCY PRIOR as a prop feature (all configs, best-book)"); print("=" * 100)
# entering-week player coverage skill (K=4 seeded, route-weighted), league-centered
def entering_rate(df, key, num_c, den_c, kplays):
    d = df.sort_values([key,"season","week"]).copy(); pri = d.groupby([key,"season"]).agg(a=(num_c,"sum"), b=(den_c,"sum")); pri["r"] = pri.a / pri.b.replace(0, np.nan)
    p = pd.Series([pri.r.get((i, s - 1), np.nan) for i, s in zip(d[key], d.season)], index=d.index); g = d.groupby([key,"season"])
    cs = g[num_c].cumsum() - d[num_c]; cn = g[den_c].cumsum() - d[den_c]; v = (cs + kplays * p.fillna(0)) / (cn + kplays * p.notna()); v[(cn == 0) & p.isna()] = np.nan; return v.reindex(df.index)
G2 = G.copy()
for b in ("Man","Zone"):
    G2[f"sepw_{b}"] = G2[f"sep_{b}"] * G2[f"n_{b}"]; G2[f"yprw_{b}"] = G2[f"yprr_{b}"] * G2[f"nr_{b}"]
    G2[f"e_sep_{b}"] = 100 * entering_rate(G2, "pid", f"sepw_{b}", f"n_{b}", 4 * G2[f"n_{b}"].mean()); G2[f"e_yprr_{b}"] = entering_rate(G2, "pid", f"yprw_{b}", f"nr_{b}", 4 * G2[f"nr_{b}"].mean())
lg_sep = {b: 100 * (G2[f"sep_{b}"] * G2[f"n_{b}"]).sum() / G2[f"n_{b}"].sum() for b in ("Man","Zone")}; lg_ypr = {b: (G2[f"yprr_{b}"] * G2[f"nr_{b}"]).sum() / G2[f"nr_{b}"].sum() for b in ("Man","Zone")}
G2["slotw"] = G2.slot_share * G2.playerStatsReceivingRoutesTotal; G2["e_slot"] = entering_rate(G2, "pid", "slotw", "playerStatsReceivingRoutesTotal", 4 * 25)
cv = load("coverageMatrix__opponent"); cv["man"] = num(cv.opponentStatsCoverageSchemeManPassingDropbacksPercentage); cv["db"] = num(cv.opponentStatsPassingDropbacksTotal); cv["manw"] = cv.man * cv.db
cv["e_man"] = entering_rate(cv, "team", "manw", "db", 4 * 35); lg_man = (cv.man * cv.db).sum() / cv.db.sum()
G2 = G2.merge(cv[["team","season","week","e_man"]].rename(columns={"team":"opp"}), on=["opp","season","week"], how="left"); G2["e_man"] = G2.e_man.fillna(lg_man)
G2["prior_sep"] = G2.e_man * (G2.e_sep_Man - lg_sep["Man"]) + (1 - G2.e_man) * (G2.e_sep_Zone - lg_sep["Zone"]) * (1 + G2.e_slot.fillna(0.3))
G2["prior_ypr"] = G2.e_man * (G2.e_yprr_Man - lg_ypr["Man"]) + (1 - G2.e_man) * (G2.e_yprr_Zone - lg_ypr["Zone"]) * (1 + G2.e_slot.fillna(0.3))
G2["man_gap"] = (G2.e_sep_Man - lg_sep["Man"]) * (G2.e_man - lg_man) * 10          # extra man-skill x extra man faced
PRI = ["prior_sep","prior_ypr","man_gap"]
cw = pd.read_parquet(FP + "player_crosswalk.parquet")[["player_id","playerPlayerId"]].drop_duplicates("player_id"); cw["pid"] = cw.playerPlayerId.astype(str)
PR = G2[["pid","season","week"] + PRI].merge(cw[["player_id","pid"]], on="pid")[["player_id","season","week"] + PRI]
# QB version: team WR-corps prior, route-weighted
G2["rw"] = G2.playerStatsReceivingRoutesTotal
TP = G2.groupby(["team","season","week"]).apply(lambda g: pd.Series({f"team_{c}": (g[c] * g.rw).sum() / max(g.rw.sum(), 1) for c in PRI})).reset_index()
src = open("exp_prop_holdout.py").read().split('print("=" * 120)')[0]
ns = {}; exec(compile(src, "ho", "exec"), ns); prep2, PE, CTX, fit_year, gbest = ns["prep2"], ns["PE"], ns["CTX"], ns["fit_year"], ns["gbest"]
for mkt, pos, thrs, base_fs, extra in (("player_reception_yds", ["WR","TE"], (6, 12, 18), PE.NARROW_RECV, PRI), ("player_receptions", ["WR","TE"], (0.4, 0.7, 1.0), PE.NARROW_RECV, PRI), ("player_pass_yds", ["QB"], (10, 20, 30), None, [f"team_{c}" for c in PRI])):
    d, F0 = prep2(mkt, pos, None)
    if pos == ["QB"]: d = d.merge(TP, on=["team","season","week"], how="left")
    else: d = d.merge(PR, on=["player_id","season","week"], how="left")
    base = [c for c in dict.fromkeys(base_fs if base_fs else PE.SETS[mkt]) if c in d.columns and d[c].notna().mean() > 0.35]; cov = d[d.season >= 2024][extra].notna().mean().mean()
    d[base + extra] = d[base + extra].apply(lambda s: s.fillna(s.median())).fillna(0)
    res = []
    for lam, thr, ctx, pr in itertools.product((60, 200, 600), thrs, (False, True), (False, True)):
        F = base + (CTX if ctx else []) + (extra if pr else []); r = {}
        for yr in (2024, 2025): w, n, roi = gbest(fit_year(d, F, lam, yr), thr); r[yr] = roi if n >= 40 else np.nan
        res.append(dict(pr=pr, roi24=r[2024], roi25=r[2025]))
    R = pd.DataFrame(res).dropna()
    for pr in (False, True):
        x = R[R.pr == pr]; print(f"  {mkt.replace('player_',''):14s} {'+'.join(pos):5s} {'WITH matchup prior' if pr else 'without           '} (coverage {cov:.0%}): 2024 {100*(x.roi24>0).mean():3.0f}% configs>0, median {100*x.roi24.median():+5.1f}% | 2025 {100*(x.roi25>0).mean():3.0f}%, median {100*x.roi25.median():+5.1f}% | both {100*((x.roi24>0)&(x.roi25>0)).mean():3.0f}%")
print("done")
