#!/usr/bin/env python3
"""TARGETS — the foundation model (owner, 2026-09-18). Not a betting market: the 'line' is replaced by his
own entering baseline (K=4-seeded average targets). WR/TE player-games 2022-25 with 1+ routes (any game he played — the 8-route cut used same-game info).
Families: role (entering targets, target share, route share, routes, aDOT, yards/route, first-read share),
volume (team entering dropbacks and PROE, spread, total, implied team total), opponent coverage (man,
two-high, blitz, pressure rates entering), injuries (teammate WR/TE target share out, QB out, RB out),
context (wind, temp, rest, home, divisional), and his coverage sensitivities (his share vs man/zone-heavy).
Readouts: (1) walk-forward accuracy by stack vs baseline-only, (2) family drop-one, (3) partial effects
vs baseline, (4) per-player profiles for 2026 receivers (predictability, bias, per-season-stable
tendencies), (5) forecast: learn through 2025 wk12 -> 2025 wk13-22 + 2026 wk1 (MAE, r, direction hit)."""
import io, contextlib, numpy as np, pandas as pd, warnings
from sklearn.ensemble import HistGradientBoostingRegressor
warnings.filterwarnings("ignore"); num = lambda s: pd.to_numeric(s, errors="coerce"); K = 4.0
from fp_hist import read_fp
NICK = {"Cardinals":"ARI","Falcons":"ATL","Ravens":"BAL","Bills":"BUF","Panthers":"CAR","Bears":"CHI","Bengals":"CIN","Browns":"CLE","Cowboys":"DAL","Broncos":"DEN","Lions":"DET","Packers":"GB","Texans":"HOU","Colts":"IND","Jaguars":"JAX","Chiefs":"KC","Rams":"LA","Chargers":"LAC","Raiders":"LV","Dolphins":"MIA","Vikings":"MIN","Patriots":"NE","Saints":"NO","Giants":"NYG","Jets":"NYJ","Eagles":"PHI","Steelers":"PIT","Seahawks":"SEA","49ers":"SF","Buccaneers":"TB","Titans":"TEN","Commanders":"WAS"}
AB = {"ARZ":"ARI","BLT":"BAL","CLV":"CLE","HST":"HOU","LAR":"LA"}
def tk(d): return (d.teamAbbreviation if "teamAbbreviation" in d.columns and d.teamAbbreviation.notna().any() else d.teamNickname.map(NICK)).map(lambda a: AB.get(a, a))
def load(t, flat=False):
    d = read_fp(t, flat); d = d[d.__season >= 2022].copy(); d["team"] = tk(d)
    if "opponentAbbreviation" in d.columns: d["opp"] = d.opponentAbbreviation.map(lambda a: AB.get(a, a))
    if "playerFirstName" in d.columns: d["nm"] = d.playerFirstName.astype(str) + " " + d.playerLastName.astype(str)
    return d.rename(columns={"__season":"season","__week":"week"})
def wavg(df, v, w):
    x, y = num(df[v]), num(df[w]); ok = x.notna() & y.notna() & (y > 0); return float((x[ok] * y[ok]).sum() / y[ok].sum()) if y[ok].sum() > 0 else np.nan
RV = load("player_receiving-advanced"); RV = RV[RV.playerPosition.isin(["WR","TE"])].copy(); RV["pid"] = RV.playerPlayerId.astype(str)
for c, s in (("tgt","playerStatsReceivingTargetsTotal"), ("rec","playerStatsReceivingReceptionsTotal"), ("yds","playerStatsReceivingYardsTotal"), ("routes","playerStatsReceivingRoutesTotal"), ("tsh","marketShareReceivingTargetsTotal"), ("rsh","marketShareReceivingRoutesTotal"), ("adot","playerStatsReceivingAverageDepthOfTarget"), ("yprr","playerStatsReceivingAveragesPerRouteYardsTotal"), ("first","marketShareReceivingTargetedReadFirst")): RV[c] = num(RV[s]) if s in RV.columns else np.nan
RV = RV[RV.routes >= 1].sort_values(["pid","season","week"]).reset_index(drop=True)
def entering(df, key, spec):
    out = pd.DataFrame(index=df.index)
    for m, w in spec:
        wcol = df[w] if w else pd.Series(1.0, index=df.index); n = df[m] * wcol; pri = pd.DataFrame({"a": n, "b": wcol, key: df[key], "season": df.season}).groupby([key, "season"]).agg(a=("a","sum"), b=("b","sum")); pri["r"] = pri.a / pri.b.replace(0, np.nan)
        p = pd.Series([pri.r.get((k, s - 1), np.nan) for k, s in zip(df[key], df.season)], index=df.index); kk = K * wcol.mean()
        g = pd.DataFrame({"n": n, "w": wcol, key: df[key], "season": df.season}).groupby([key, "season"]); cs = g.n.cumsum() - n; cn = g.w.cumsum() - wcol
        v = (cs + kk * p.fillna(0)) / (cn + kk * p.notna()); v[(cn == 0) & p.isna()] = np.nan; out["e_" + m] = v
    return out
E = entering(RV, "pid", [("tgt", None), ("routes", None), ("tsh", "routes"), ("rsh", None), ("adot", "tgt"), ("yprr", "routes"), ("first", "routes"), ("rec", None), ("yds", None)]); RV = pd.concat([RV, E], axis=1)
RV["res"] = RV.tgt - RV.e_tgt
# coverage sensitivity: his share vs man-heavy vs zone-heavy defenses (entering, from his own games)
CV = load("coverageMatrix__opponent"); CV["man"] = num(CV.opponentStatsCoverageSchemeManPassingDropbacksPercentage); CV["two"] = num(CV.opponentStatsCoverageSchemeTwoHighPassingDropbacksPercentage); CV["ddb"] = num(CV.opponentStatsPassingDropbacksTotal)
PO = load("passingAdvanced__opponent"); PO["press"] = num(PO.opponentStatsPassingPressuredPercentage); PO["ddb2"] = num(PO.opponentStatsPassingDropbacksTotal)
D = CV[["season","week","team","man","two","ddb"]].merge(PO[["season","week","team","press","ddb2"]], on=["season","week","team"], how="left").rename(columns={"team":"opp"}).sort_values(["opp","season","week"]).reset_index(drop=True)
D["ddb"] = D.ddb.fillna(D.ddb2); ED = entering(D, "opp", [("man","ddb"), ("two","ddb"), ("press","ddb")]); D = pd.concat([D, ED], axis=1)
RV = RV.merge(D[["season","week","opp","man","two","press","e_man","e_two","e_press"]], on=["season","week","opp"], how="left")
# his target share this game vs man faced (for sensitivity)
RV["tsh_x_man"] = RV.tsh * RV.man; RV["tsh_x_two"] = RV.tsh * RV.two
S = entering(RV, "pid", [("tsh_x_man","routes"), ("tsh_x_two","routes"), ("man","routes"), ("two","routes")])   # E[share*man], E[man]
RV["sens_man"] = (S.e_tsh_x_man - RV.e_tsh * S.e_man); RV["sens_two"] = (S.e_tsh_x_two - RV.e_tsh * S.e_two)   # covariance of his share with the coverage he faced
RV["ix_man"] = RV.sens_man * (RV.e_man - D.e_man.mean()); RV["ix_two"] = RV.sens_two * (RV.e_two - D.e_two.mean())
# team volume + injuries + context
PT = load("proeReport__team"); PT["db"] = num(PT.teamStatsPassingDropbacksTotal); PT["dbx"] = num(PT.teamStatsPassingDropbacksExpected); PT["snaps"] = num(PT.teamStatsSnapsOffenseTotal); PT["proe"] = (PT.db - PT.dbx) / PT.snaps
PT = PT.sort_values(["team","season","week"]).reset_index(drop=True); ET = entering(PT, "team", [("db", None), ("proe", "snaps")]); PT = pd.concat([PT, ET], axis=1)
RV = RV.merge(PT[["season","week","team","e_db","e_proe"]], on=["season","week","team"], how="left")
src = open("exp_prop_injury_context.py").read().split('print("\\n" + "=" * 130)')[0]; ns = {}
with contextlib.redirect_stdout(io.StringIO()): exec(compile(src, "ic", "exec"), ns)
ctx, CTX = ns["ctx"], ns["CTX"]; ctx = ctx.copy(); ctx["team"] = ctx.team.replace({"LAR":"LA"}); RV = RV.merge(ctx[["season","week","team"] + CTX], on=["season","week","team"], how="left"); RV[CTX] = RV[CTX].fillna(0)
m = pd.read_parquet("data/matchup.parquet")[["season","week","home_ab","away_ab","home_rest","away_rest","div_game","wind_mph","temp_f","game_stadium_dome","dome_closed","home_spread","nv_total_line"]]
m["home_ab"] = m.home_ab.replace({"LAR":"LA"}); m["away_ab"] = m.away_ab.replace({"LAR":"LA"})
h = m.rename(columns={"home_ab":"team","away_ab":"opp2","home_rest":"rest"}).assign(is_home=1.0, spread=lambda z: z.home_spread); a = m.rename(columns={"away_ab":"team","home_ab":"opp2","away_rest":"rest"}).assign(is_home=0.0, spread=lambda z: -z.home_spread)
G = pd.concat([h, a])[["season","week","team","rest","div_game","wind_mph","temp_f","game_stadium_dome","dome_closed","is_home","spread","nv_total_line"]]
G["indoors"] = ((G.game_stadium_dome.astype(str).str.lower() == "true") | (num(G.dome_closed) == 1)).astype(float); G["wind"] = np.where(G.indoors == 1, 0, num(G.wind_mph)); G["temp"] = np.where(G.indoors == 1, 70, num(G.temp_f)); G["total"] = num(G.nv_total_line); G["implied_tt"] = (G.total - G.spread) / 2
RV = RV.merge(G[["season","week","team","rest","div_game","wind","temp","is_home","spread","total","implied_tt"]].drop_duplicates(["season","week","team"]), on=["season","week","team"], how="left")
RV = RV[RV.e_tgt.notna() & (RV.week >= 2)].copy(); RV["big_fav"] = (RV.spread <= -7).astype(float); RV["big_dog"] = (RV.spread >= 7).astype(float)
FAM = {"baseline": ["e_tgt"], "role": ["e_tsh","e_rsh","e_routes","e_adot","e_yprr","e_first","e_rec","e_yds"], "volume": ["e_db","e_proe","spread","total","implied_tt","big_fav","big_dog"], "coverage": ["e_man","e_two","e_press","sens_man","sens_two","ix_man","ix_two"], "injury": CTX, "context": ["wind","temp","rest","is_home","div_game"]}
ALL = list(dict.fromkeys(sum(FAM.values(), []))); RV[ALL] = RV[ALL].apply(lambda s: s.fillna(s.median())).fillna(0)
print(f"targets frame: {len(RV)} WR/TE player-games 2022-25 (8+ routes) | mean targets {RV.tgt.mean():.2f} | baseline MAE {np.abs(RV.res).mean():.2f}")
from prop_engine import ridge
def fit(tr, te, F, lam=200, model="ridge"):
    Fk = [c for c in F if tr[c].std() > 1e-9]
    if model == "hgb": return HistGradientBoostingRegressor(max_iter=300, learning_rate=0.04, max_depth=3, l2_regularization=2.0, min_samples_leaf=40, random_state=0).fit(tr[Fk], tr.tgt).predict(te[Fk])
    X = tr[Fk].values.astype(float); mu, sd = X.mean(0), X.std(0); sd[sd == 0] = 1; w = ridge((X - mu) / sd, tr.tgt.values.astype(float), lam); return np.hstack([(te[Fk].values.astype(float) - mu) / sd, np.ones((len(te), 1))]) @ w
print("\n" + "=" * 112); print("(1) ACCURACY by cumulative stack — walk-forward (train < season): MAE in targets, r, and DIRECTION hit (sign of pred−baseline vs actual−baseline, |pred−baseline| ≥ 1)"); print("=" * 112)
def dirhit(te, pred):
    e = pred - te.e_tgt.values; m_ = np.abs(e) >= 1; return (np.sign(e[m_]) == np.sign((te.tgt - te.e_tgt).values[m_])).mean(), int(m_.sum())
stacks = [("baseline only", ["e_tgt"])]; acc = ["e_tgt"]
for f in ("role","volume","coverage","injury","context"): acc = acc + FAM[f]; stacks.append(("+ " + f, list(acc)))
stacks.append(("full + hgb", ALL))
for name, F in stacks:
    out = []
    for yr in (2023, 2024, 2025):
        tr, te = RV[RV.season < yr], RV[RV.season == yr]; pred = te.e_tgt.values if name == "baseline only" else fit(tr, te, F, model="hgb" if "hgb" in name else "ridge"); dh, n = dirhit(te, pred) if name != "baseline only" else (np.nan, 0)
        out.append(f"{yr}: MAE {np.abs(pred - te.tgt).mean():.3f} r {np.corrcoef(pred, te.tgt)[0,1]:+.3f} dir {100*dh if n else np.nan:4.1f}%/{n:4d}")
    print(f"  {name:14s} | " + " | ".join(out))
print("\n" + "=" * 112); print("(2) FAMILY DROP-ONE from the full stack (2025 holdout): change in MAE (+ = family helped)"); print("=" * 112)
tr, te = RV[RV.season < 2025], RV[RV.season == 2025]; full = np.abs(fit(tr, te, ALL) - te.tgt).mean()
for f, cols in FAM.items(): print(f"  drop {f:9s} ({len(cols):2d}): {np.abs(fit(tr, te, [c for c in ALL if c not in cols]) - te.tgt).mean() - full:+.3f}")
print("\n" + "=" * 112); print("(3) PARTIAL EFFECTS — actual targets minus his baseline, by bucket (pooled 2022-25)"); print("=" * 112)
def bucket(col, cuts, labels):
    b = pd.cut(RV[col], cuts, labels=labels); t = RV.groupby(b).res.agg(["mean","count"]); print(f"  {col:16s} " + " | ".join(f"{k}: {v['mean']:+.2f} (n={int(v['count'])})" for k, v in t.iterrows()))
bucket("inj_wrte_tgt_out", [-1, 0.001, 0.15, 0.30, 2], ["none out","<15% out","15-30% out","30%+ out"]); bucket("inj_qb_out", [-1, 0.5, 2], ["QB in","QB out"]); bucket("spread", [-99, -7, -3, 3, 7, 99], ["fav 7+","fav 3-7","pick","dog 3-7","dog 7+"]); bucket("total", [0, 41, 45, 49, 99], ["<=41","41-45","45-49","49+"])
bucket("e_man", [-1, 0.22, 0.32, 1], ["zone-heavy","mid","man-heavy"]); bucket("e_two", [-1, 0.35, 0.50, 1], ["single-high","mid","two-high"]); bucket("e_press", [-1, 0.27, 0.33, 1], ["low pressure","mid","high pressure"]); bucket("wind", [-1, 5, 12, 18, 99], ["calm","5-12","12-18","18+"]); bucket("e_tsh", [-1, 0.12, 0.20, 0.28, 2], ["<12% share","12-20","20-28","28%+"])
RV.to_parquet("data/_targets_deep_frame.parquet", index=False)
# ============================================================ (4) profiles for 2026 receivers
print("\n" + "=" * 112); print("(4) PROFILES — receivers active in 2026 (routes in 2026 wk1), 20+ games: predictability (baseline MAE), bias, per-season-stable tendencies"); print("=" * 112)
active = set(RV[RV.season == 2026].pid) if (RV.season == 2026).any() else set(read_fp("player_receiving-advanced").query("__season == 2026").playerPlayerId.astype(str))
FAC = {"e_man": "opp man rate", "e_two": "opp two-high rate", "e_press": "opp pressure rate", "spread": "team spread (+ = dog)", "total": "game total", "inj_wrte_tgt_out": "WR/TE share out", "inj_qb_out": "QB out", "wind": "wind", "temp": "temperature", "rest": "rest", "is_home": "home", "e_db": "team dropbacks (entering)"}
H = RV[RV.season <= 2025]; LG = {f: np.corrcoef(H[f], H.res)[0,1] for f in FAC}; rng = np.random.default_rng(0); rows = []
for pid, x in H[H.pid.isin(active)].groupby("pid"):
    if len(x) < 20: continue
    x = x.sort_values(["season","week"]); tend = []
    for f, lab in FAC.items():
        if x[f].std() == 0: continue
        r = np.corrcoef(x[f], x.res)[0,1]; null = np.array([np.corrcoef(rng.permutation(x[f].values), x.res)[0,1] for _ in range(300)]); p = (np.abs(null) >= abs(r)).mean()
        seas = [np.corrcoef(g[f], g.res)[0,1] for s_, g in x.groupby("season") if len(g) >= 8 and g[f].std() > 0]
        if abs(r) >= 0.30 and p < 0.10 and len(seas) >= 2 and all(np.sign(v) == np.sign(r) for v in seas): tend.append(f"{lab} {r:+.2f} ({r * x.res.std():+.1f}/sd; lg {LG[f]:+.2f})")
    rows.append(dict(pid=pid, name=x.nm.iloc[-1], team=x.team.iloc[-1], pos=x.playerPosition.iloc[-1], games=len(x), base_mae=np.abs(x.res).mean(), resid_sd=x.res.std(), bias=x.res.mean(), e_tgt=x.e_tgt.iloc[-1], tend="; ".join(tend) or "—"))
P = pd.DataFrame(rows).sort_values("base_mae"); P["rank"] = range(1, len(P) + 1); P.to_parquet("data/_wr_profiles_targets_2026.parquet", index=False)
print(f"  league baseline MAE {np.abs(H.res).mean():.2f}\n  {'#':>3s} {'receiver':22s} {'tm':3s} {'pos':3s} {'g':>3s} {'MAE':>5s} {'sd':>5s} {'bias':>6s} {'base':>5s} | stable tendencies")
for r in P.head(20).itertuples(): print(f"  {r.rank:3d} {r.name[:22]:22s} {r.team:3s} {r.pos:3s} {r.games:3d} {r.base_mae:5.2f} {r.resid_sd:5.2f} {r.bias:+6.2f} {r.e_tgt:5.1f} | {r.tend}")
print("  ...");
for r in P.tail(8).itertuples(): print(f"  {r.rank:3d} {r.name[:22]:22s} {r.team:3s} {r.pos:3s} {r.games:3d} {r.base_mae:5.2f} {r.resid_sd:5.2f} {r.bias:+6.2f} {r.e_tgt:5.1f} | {r.tend}")
print(f"  with at least one stable tendency: {(P.tend != '—').sum()} of {len(P)}")
# ============================================================ (5) forecast: learn through 2025 wk12
print("\n" + "=" * 112); print("(5) FORECAST — learn through 2025 wk12, predict 2025 wk13-22 + 2026 wk1 (if in frame): MAE / r / direction hit vs baseline"); print("=" * 112)
tr = RV[(RV.season < 2025) | ((RV.season == 2025) & (RV.week <= 12))]; te = RV[((RV.season == 2025) & (RV.week > 12)) | (RV.season == 2026)].copy()
te["UNIV"] = fit(tr, te, ALL); te["HGB"] = fit(tr, te, ALL, model="hgb"); te["BIAS"] = te.e_tgt + te.pid.map((tr.res.groupby(tr.pid).sum() / (tr.res.groupby(tr.pid).count() + 8))).fillna(0)
for c in ("e_tgt","UNIV","HGB","BIAS"):
    dh, n = dirhit(te, te[c].values) if c != "e_tgt" else (np.nan, 0); print(f"  {c:6s} MAE {np.abs(te[c] - te.tgt).mean():.3f} r {np.corrcoef(te[c], te.tgt)[0,1]:+.3f} direction {100*dh if n else np.nan:4.1f}%/{n} (n={len(te)})")
