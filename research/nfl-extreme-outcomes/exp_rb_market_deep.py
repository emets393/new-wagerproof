#!/usr/bin/env python3
"""ONE MARKET, EVERYTHING WE OWN — PASS COMPLETIONS (owner, 2026-09-18).
Frame = every QB completions line 2023-25 (prop_engine panel + FP blocks + injury context + best-book),
plus the families that were never in the prop frame:
  receivers   his WR/TE corps entering: catchable-target %, YAC per catch, contested-target share,
              top-2 target-share concentration, routes (team-week, routes-weighted, K=4 seeded)
  context     wind, temperature, precipitation, dome, divisional game, own/opp rest days, primetime,
              home, the game TOTAL and the TEAM SPREAD (posted) and the implied team total
  QB splits   from play-by-play (2022-25 participation + FTN): his entering completion % when blitzed /
              not, vs man / zone, pressured / clean — and the INTERACTION with how often this opponent
              does each (his sensitivity x their tendency)
  player      his own shrunken residual vs the universal model, entering (does HE run above/below what
              the universal model says for a QB with his inputs?)
Readouts:  (1) walk-forward 2024 / 2025 accuracy by cumulative feature stack (MAE, r) vs line-only
           (2) family drop-one on the full stack — which families move completions, universally
           (3) partial effects: actual − line by spread / total / wind / divisional / rest / opp blitz & man
           (4) the bet: all-configs at best-book per season, vs the current frozen completions config
The line is a FEATURE (raw target with the line, per the 'predict the raw quantity' law), never the target."""
import io, contextlib, glob, itertools, sys, numpy as np, pandas as pd, warnings
MKT = sys.argv[1] if len(sys.argv) > 1 else "player_rush_yds"; STAT = MKT.replace("player_", ""); SC = 7.0 if "yds" in MKT else 1.0   # threshold scale: rush yards x7 (7 / 12.25 / 17.5), attempts x1   # completions | attempts
from sklearn.ensemble import HistGradientBoostingRegressor
warnings.filterwarnings("ignore"); num = lambda s: pd.to_numeric(s, errors="coerce"); K = 4.0
src = open("exp_prop_injury_context.py").read().split('print("\\n" + "=" * 130)')[0]; ns = {}
with contextlib.redirect_stdout(io.StringIO()): exec(compile(src, "ic", "exec"), ns)
prep2, PE, CTX = ns["prep2"], ns["PE"], ns["CTX"]
from prop_engine import ridge
d, F0 = prep2(MKT, ["RB"], None); d = d[d.close_line.notna() & d.actual.notna()].copy()
d["team"] = d.team.replace({"LAR": "LA"}); d["opp"] = d.opp.replace({"LAR": "LA"})
print(f"{STAT} frame: {len(d)} RB-games 2023-25, {len(F0)} prop-engine features")
# ================================================================= receivers (team-week WR/TE corps, entering)
ra = pd.read_parquet("data/fpdata/player_receiving-advanced.parquet"); ra = ra[ra.__season >= 2022].copy()
NICK = {"Cardinals":"ARI","Falcons":"ATL","Ravens":"BAL","Bills":"BUF","Panthers":"CAR","Bears":"CHI","Bengals":"CIN","Browns":"CLE","Cowboys":"DAL","Broncos":"DEN","Lions":"DET","Packers":"GB","Texans":"HOU","Colts":"IND","Jaguars":"JAX","Chiefs":"KC","Rams":"LA","Chargers":"LAC","Raiders":"LV","Dolphins":"MIA","Vikings":"MIN","Patriots":"NE","Saints":"NO","Giants":"NYG","Jets":"NYJ","Eagles":"PHI","Steelers":"PIT","Seahawks":"SEA","49ers":"SF","Buccaneers":"TB","Titans":"TEN","Commanders":"WAS"}
AB = {"ARZ":"ARI","BLT":"BAL","CLV":"CLE","HST":"HOU","LAR":"LA"}
ra["team"] = (ra.teamAbbreviation if ra.teamAbbreviation.notna().any() else ra.teamNickname.map(NICK)).map(lambda a: AB.get(a, a))
ra = ra[ra.playerPosition.isin(["WR","TE"])]
for c, s in (("routes","playerStatsReceivingRoutesTotal"), ("tgt","playerStatsReceivingTargetsTotal"), ("rec","playerStatsReceivingReceptionsTotal"), ("catchable","playerStatsReceivingTargetsCatchablePercentage"), ("yac","playerStatsReceivingAveragesPerReceptionYardsAfterCatch"), ("contested","playerStatsReceivingTargetsContestedTotal"), ("tsh","marketShareReceivingTargetsTotal")): ra[c] = num(ra[s])
def corps(g):
    w = g.routes.fillna(0); top2 = g.tsh.nlargest(2).sum()
    return pd.Series(dict(rw_catchable=(g.catchable * w).sum() / max(w.sum(), 1), rw_yac=(g.yac * g.rec.fillna(0)).sum() / max(g.rec.fillna(0).sum(), 1), rw_contested=g.contested.fillna(0).sum() / max(g.tgt.fillna(0).sum(), 1), rw_top2=top2, rw_routes=w.sum(), rw_n=len(g)))
TW = ra.groupby(["team","__season","__week"]).apply(corps).reset_index().rename(columns={"__season":"season","__week":"week"}).sort_values(["team","season","week"])
def entering_team(df, cols, key="team"):
    x = df.copy(); out = pd.DataFrame(index=x.index)
    for c in cols:
        pri = x.groupby([key,"season"])[c].mean(); p = pd.Series([pri.get((t, s - 1), np.nan) for t, s in zip(x[key], x.season)], index=x.index)
        g = x.groupby([key,"season"]); cs = g[c].cumsum() - x[c]; cn = g.cumcount()
        v = (cs + K * p.fillna(0)) / (cn + K * p.notna()); v[(cn == 0) & p.isna()] = np.nan; out["e_" + c] = v
    return pd.concat([x[[key,"season","week"]], out], axis=1)
RW = entering_team(TW, ["rw_catchable","rw_yac","rw_contested","rw_top2","rw_routes"]); RECV = [c for c in RW.columns if c.startswith("e_")]
d = d.merge(RW, on=["team","season","week"], how="left")
# ================================================================= game context
m = pd.read_parquet("data/matchup.parquet")[["season","week","home_ab","away_ab","home_rest","away_rest","div_game","primetime","wind_mph","temp_f","precipitation_pct","game_stadium_dome","dome_closed","nv_total_line","home_spread"]]
m["home_ab"] = m.home_ab.replace({"LAR":"LA"}); m["away_ab"] = m.away_ab.replace({"LAR":"LA"})
h = m.rename(columns={"home_ab":"team","away_ab":"opp","home_rest":"rest","away_rest":"opp_rest"}); a = m.rename(columns={"away_ab":"team","home_ab":"opp","away_rest":"rest","home_rest":"opp_rest"})
G = pd.concat([h, a])[["season","week","team","opp","rest","opp_rest","div_game","primetime","wind_mph","temp_f","precipitation_pct","game_stadium_dome","dome_closed"]]
G["indoors"] = (G.game_stadium_dome.astype(str).str.lower().isin(["true","1"]) | (num(G.dome_closed) == 1)).astype(float); G["wind"] = np.where(G.indoors == 1, 0, num(G.wind_mph)); G["temp"] = np.where(G.indoors == 1, 70, num(G.temp_f)); _pp = num(G.precipitation_pct); _pp = np.where(_pp > 1, _pp / 100.0, _pp)   # the field is 0-1 in 2023-24 and 0-100 in 2025 — put it on one scale
G["precip"] = np.where(G.indoors == 1, 0, np.where(np.isnan(_pp), 0, (_pp >= 0.5).astype(float)))
G["off_bye"] = (num(G.rest) >= 13).astype(float); G["short_week"] = (num(G.rest) <= 5).astype(float); G["opp_off_bye"] = (num(G.opp_rest) >= 13).astype(float)
G = G.drop(columns=["game_stadium_dome","dome_closed","wind_mph","temp_f","precipitation_pct"]).drop_duplicates(["season","week","team"])
for c in ("rest","opp_rest","div_game","primetime"): G[c] = num(G[c])
d = d.merge(G.drop(columns=["opp"]), on=["season","week","team"], how="left")
d["implied_tt"] = (d.total - d.team_spread) / 2; d["abs_spread"] = d.team_spread.abs(); d["big_fav"] = (d.team_spread <= -7).astype(float); d["big_dog"] = (d.team_spread >= 7).astype(float)
CONTEXT = ["total","team_spread","implied_tt","abs_spread","big_fav","big_dog","is_home","wind","temp","precip","indoors","div_game","rest","opp_rest","off_bye","short_week","opp_off_bye","primetime"]
# ================================================================= RB per-play splits x opponent front (designed runs, FTN box counts)
COLS = ["game_id","play_id","season","week","posteam","defteam","rush","qb_scramble","rusher_player_name","epa","yards_gained","success","season_type"]
pbp = pd.concat([pd.read_parquet(f, columns=COLS) for f in ["data/pbp_cache/_dl_2022.parquet"] + sorted(glob.glob("data/pbp_cache/pbp_202[345].parquet"))], ignore_index=True)
pbp = pbp[(pbp.season_type == "REG") & (pbp.rush == 1) & (pbp.qb_scramble != 1) & pbp.rusher_player_name.notna()]
ftn = pd.concat([pd.read_parquet("data/ftn_charting.parquet"), pd.read_parquet("data/ftn_charting_2025.parquet")], ignore_index=True)
for x, y in (("nflverse_game_id","game_id"), ("nflverse_play_id","play_id")):
    if y in ftn.columns and x in ftn.columns: ftn[y] = ftn[y].fillna(ftn[x]); ftn = ftn.drop(columns=x)
    elif x in ftn.columns: ftn = ftn.rename(columns={x: y})
ftn["play_id"] = num(ftn.play_id); ftn = ftn[["game_id","play_id","n_defense_box"]].drop_duplicates(["game_id","play_id"])
P = pbp.merge(ftn, on=["game_id","play_id"], how="left"); P["box"] = num(P.n_defense_box); P["heavy"] = (P.box >= 7).where(P.box.notna()).astype(float); P["stack"] = (P.box >= 8).where(P.box.notna()).astype(float)
P["yds"] = num(P.yards_gained).astype(float); P["succ"] = num(P.success).astype(float); P["rb"] = P.rusher_player_name
def split_rates(g):
    o = {}
    for lab, mask in (("light", g.heavy == 0), ("heavy", g.heavy == 1)):
        s_ = g[mask]; o["n_" + lab] = float(len(s_)); o["y_" + lab] = float(s_.yds.sum()); o["s_" + lab] = float(s_.succ.sum())
    return pd.Series(o)
QW = P.groupby(["rb","season","week"]).apply(split_rates).reset_index().sort_values(["rb","season","week"])
def entering_rate(df, key, n_c, c_c, kplays):
    x = df.copy(); g = x.groupby([key,"season"]); pri = g.agg(a=(c_c,"sum"), b=(n_c,"sum")); pri["r"] = pri.a / pri.b.replace(0, np.nan)
    p = pd.Series([pri.r.get((t, s - 1), np.nan) for t, s in zip(x[key], x.season)], index=x.index)
    cs = g[c_c].cumsum() - x[c_c]; cn = g[n_c].cumsum() - x[n_c]; v = (cs + kplays * p.fillna(0)) / (cn + kplays * p.notna()); v[(cn == 0) & p.isna()] = np.nan; return v
for lab in ("light","heavy"): QW["e_ypc_" + lab] = entering_rate(QW, "rb", "n_" + lab, "y_" + lab, 40); QW["e_succ_" + lab] = entering_rate(QW, "rb", "n_" + lab, "s_" + lab, 40)
QW["sens_box_ypc"] = QW.e_ypc_heavy - QW.e_ypc_light; QW["sens_box_succ"] = QW.e_succ_heavy - QW.e_succ_light
DW = P.groupby(["defteam","season","week"]).agg(n=("yds","size"), nh=("heavy","sum"), ns=("stack","sum"), n_h=("heavy","count"), n_s=("stack","count"), ysum=("yds","sum"), ssum=("succ","sum")).reset_index().rename(columns={"defteam":"opp"}).sort_values(["opp","season","week"])
for c in ("nh","ns","n_h","n_s","ysum","ssum","n"): DW[c] = num(DW[c]).astype(float)
DW["opp_rate_heavy"] = entering_rate(DW, "opp", "n_h", "nh", 100); DW["opp_rate_stack"] = entering_rate(DW, "opp", "n_s", "ns", 100); DW["opp_ypc_allowed"] = entering_rate(DW, "opp", "n", "ysum", 100); DW["opp_succ_allowed"] = entering_rate(DW, "opp", "n", "ssum", 100)
keys_rb = set(QW.rb.unique())
def match_qb(nm):
    nm = str(nm)
    if nm in keys_rb: return nm
    parts = nm.replace(".", " ").split(); cand = parts[0][0] + "." + parts[-1] if parts else nm
    if cand in keys_rb: return cand
    alt = [q for q in keys_rb if q.split(".")[-1].lower() == parts[-1].lower() and q[0].lower() == parts[0][0].lower()] if parts else []
    return alt[0] if alt else None
d["qb"] = d.player_name.map(match_qb)   # column kept as 'qb' so the profile / forecast scripts work unchanged (it is the BACK here)
d = d.merge(QW[["rb","season","week","e_ypc_light","e_ypc_heavy","e_succ_light","e_succ_heavy","sens_box_ypc","sens_box_succ"]].rename(columns={"rb":"qb"}), on=["qb","season","week"], how="left")
d = d.merge(DW[["opp","season","week","opp_rate_heavy","opp_rate_stack","opp_ypc_allowed","opp_succ_allowed"]], on=["opp","season","week"], how="left")
d["ix_sens_box_ypc"] = d.sens_box_ypc * (d.opp_rate_heavy - DW.opp_rate_heavy.mean()); d["ix_sens_box_succ"] = d.sens_box_succ * (d.opp_rate_heavy - DW.opp_rate_heavy.mean())
QBS = ["e_ypc_light","e_ypc_heavy","e_succ_light","e_succ_heavy","sens_box_ypc","sens_box_succ","opp_rate_heavy","opp_rate_stack","opp_ypc_allowed","opp_succ_allowed","ix_sens_box_ypc","ix_sens_box_succ"]
print(f"  RB split coverage: {d.e_ypc_light.notna().mean():.0%} | receivers {d.e_rw_catchable.notna().mean():.0%} | context {d.wind.notna().mean():.0%}")
# ================================================================= families
QBF = [c for c in F0 if c.startswith(("ru_","bc_","ms_","ix_rush","ix_ybc","ix_yac","ix_stuff","ix_zone","ix_workload","ix_script_rush"))]; TEAM = [c for c in F0 if c.startswith(("off_","T_","tm_"))]; OPP = [c for c in F0 if c.startswith(("def_","O_","OL_","oppallow"))]
FORM = [c for c in ("l3","l5","szn") if c in d.columns]; LINE = ["close_line"]
FAM = {"line": LINE, "form": FORM, "back": QBF, "team": TEAM, "opponent": OPP, "receivers": RECV, "context": CONTEXT, "box_splits": QBS, "injury": CTX}
ALL = list(dict.fromkeys(sum(FAM.values(), []))); ALL = [c for c in ALL if c in d.columns]
d[ALL] = d[ALL].apply(lambda s: s.fillna(s.median())).fillna(0)
def fit_pred(tr, te, F, lam=200, model="ridge"):
    Fk = [c for c in F if tr[c].std() > 1e-9]; X = tr[Fk].values.astype(float); mu, sd = X.mean(0), X.std(0); sd[sd == 0] = 1
    if model == "hgb": return HistGradientBoostingRegressor(max_iter=300, learning_rate=0.04, max_depth=3, l2_regularization=2.0, min_samples_leaf=30, random_state=0).fit(tr[Fk], tr.actual).predict(te[Fk])
    w = ridge((X - mu) / sd, tr.actual.values.astype(float), lam); return np.hstack([(te[Fk].values.astype(float) - mu) / sd, np.ones((len(te), 1))]) @ w
def gbest(x, pred, thr):
    e = pred - x.close_line; sel = (np.abs(e) >= thr) & x.bo_line.notna().values; x = x[sel]; e = e[sel]
    if not len(x): return np.nan, 0, np.nan
    over = e > 0; line = np.where(over, x.bo_line, x.bu_line); pay = np.where(over, x.bo_dec, x.bu_dec); won = np.where(over, x.actual > line, x.actual < line); push = x.actual.values == line
    p = np.where(push, 0, np.where(won, pay, -1.0)); return (won[~push].mean() if (~push).sum() else np.nan), int((~push).sum()), p.mean()
# ---- player-specific residual (entering, shrunk): fit universal on prior seasons, residuals accumulate per QB
print("\n" + "=" * 118); print("(1) ACCURACY by cumulative feature stack — walk-forward (train < season). MAE in the market's units; r = corr(pred, actual). Line-only = predict the line."); print("=" * 118)
stacks = [("line only", LINE)]; acc = LINE
for name in ("form","back","team","opponent","receivers","context","box_splits","injury"): acc = acc + FAM[name]; stacks.append(("+ " + name, list(acc)))
print(f"  {'stack':16s} | " + " | ".join(f"{yr}: MAE  r   | bet≥1.75 win%/n" for yr in (2024, 2025)))
for name, F in stacks:
    F = [c for c in dict.fromkeys(F) if c in d.columns]; out = []
    for yr in (2024, 2025):
        tr, te = d[d.season < yr], d[d.season == yr]; pred = fit_pred(tr, te, F) if name != "line only" else te.close_line.values
        w, n, roi = gbest(te, pred, 1.75 * SC); out.append(f"{yr}: {np.abs(pred - te.actual).mean():4.2f} {np.corrcoef(pred, te.actual)[0,1]:+.2f} | {100*w if n else np.nan:4.1f}%/{n:3d}")
    print(f"  {name:16s} | " + " | ".join(out))
# player residual feature
print("\n  + player residual (his own entering deviation from the universal model, shrunk k=6 games):")
for yr in (2024, 2025):
    tr, te = d[d.season < yr].copy(), d[d.season == yr].copy(); F = ALL
    # in-sample universal residuals on prior seasons -> per-QB entering mean; for the test season, residuals accumulate from the season's own games as they are played (walk-forward within season)
    tr["res"] = tr.actual - fit_pred(tr, tr, F); base = tr.groupby("qb").res.agg(["sum","count"])
    te = te.sort_values("week"); pr = fit_pred(tr, te, F); te["pred_u"] = pr; te["res"] = te.actual - te.pred_u
    g = te.groupby("qb"); cs = g.res.cumsum() - te.res; cn = g.cumcount(); s0 = te.qb.map(base["sum"]).fillna(0); n0 = te.qb.map(base["count"]).fillna(0)
    te["player_res"] = (cs + s0) / (cn + n0 + 6); pred2 = te.pred_u + te.player_res
    w1, n1, _ = gbest(te, te.pred_u.values, 1.75); w2, n2, _ = gbest(te, pred2.values, 1.75)
    print(f"    {yr}: universal MAE {np.abs(te.pred_u - te.actual).mean():.2f} r {np.corrcoef(te.pred_u, te.actual)[0,1]:+.2f} bet {100*w1:.1f}%/{n1} | + player residual MAE {np.abs(pred2 - te.actual).mean():.2f} r {np.corrcoef(pred2, te.actual)[0,1]:+.2f} bet {100*w2:.1f}%/{n2}")
print("\n" + "=" * 118); print("(2) WHICH FAMILIES MOVE THE NUMBER — drop-one from the full stack (2025 holdout, train 2023-24): change in MAE (+ = family helped)"); print("=" * 118)
tr, te = d[d.season < 2025], d[d.season == 2025]; full = np.abs(fit_pred(tr, te, ALL) - te.actual).mean()
for name, cols in FAM.items():
    F = [c for c in ALL if c not in cols]; mae = np.abs(fit_pred(tr, te, F) - te.actual).mean(); print(f"  drop {name:10s} ({len(cols):3d} feats): MAE {mae:.3f} vs full {full:.3f}  ->  {mae - full:+.3f}")
print("\n" + "=" * 118); print("(3) PARTIAL EFFECTS — actual minus the posted line, by bucket (pooled 2023-25). The line already prices what it prices; a non-zero row is what it misses."); print("=" * 118)
d["res_line"] = d.actual - d.close_line
def bucket(col, cuts, labels):
    b = pd.cut(d[col], cuts, labels=labels); t = d.groupby(b).res_line.agg(["mean","count"]); print(f"  {col:14s} " + " | ".join(f"{k}: {v['mean']:+.2f} (n={int(v['count'])})" for k, v in t.iterrows()))
bucket("team_spread", [-99, -7, -3, 3, 7, 99], ["fav 7+","fav 3-7","pick","dog 3-7","dog 7+"]); bucket("total", [0, 41, 45, 49, 99], ["<=41","41-45","45-49","49+"]); bucket("wind", [-1, 5, 12, 18, 99], ["calm","5-12","12-18","18+"])
bucket("temp", [-99, 32, 50, 75, 199], ["<=32","32-50","50-75","75+"]); bucket("div_game", [-1, 0.5, 1.5], ["non-div","divisional"]); bucket("rest", [0, 5, 8, 99], ["short","normal","long/bye"]); bucket("opp_rate_heavy", [-1, 0.30, 0.42, 1], ["light boxes","mid","heavy boxes"]); bucket("opp_succ_allowed", [-1, 0.40, 0.46, 1], ["stout run D","mid","soft run D"]); bucket("ms_rush", [-1, 0.45, 0.65, 2], ["committee","lead","bell-cow"]) if "ms_rush" in d.columns else None
bucket("e_rw_catchable", [-1, 0.72, 0.78, 2], ["low catchable","mid","high catchable"]); bucket("inj_rb_car_out", [-1, 0.001, 0.25, 2], ["no RB out","<25% carries out","25%+ carries out"])
print("\n" + "=" * 118); print("(4) THE BET — all configs (λ × threshold × stack) at best-book, per season; share of configs profitable + the current frozen config"); print("=" * 118)
res = []
for lam, thr, (sname, F) in itertools.product((60, 200, 600), (1.0 * SC, 1.75 * SC, 2.5 * SC), [("current (engine SETS)", [c for c in PE.SETS[MKT] if c in d.columns]), ("full stack", ALL), ("full minus context", [c for c in ALL if c not in CONTEXT]), ("full + hgb", ALL)]):
    r = {}
    for yr in (2024, 2025):
        tr, te = d[d.season < yr], d[d.season == yr]; pred = fit_pred(tr, te, F, lam, "hgb" if "hgb" in sname else "ridge"); w, n, roi = gbest(te, pred, thr); r[yr] = (roi if n >= 30 else np.nan, w, n)
    res.append(dict(stack=sname, lam=lam, thr=thr, roi24=r[2024][0], roi25=r[2025][0], w24=r[2024][1], n24=r[2024][2], w25=r[2025][1], n25=r[2025][2]))
R = pd.DataFrame(res)
for sname, x in R.groupby("stack", sort=False):
    y = x.dropna(subset=["roi24","roi25"]); print(f"  {sname:22s}: 2024 {100*(y.roi24>0).mean():3.0f}% of configs profitable (median ROI {100*y.roi24.median():+5.1f}%) | 2025 {100*(y.roi25>0).mean():3.0f}% (median {100*y.roi25.median():+5.1f}%) | both {100*((y.roi24>0)&(y.roi25>0)).mean():3.0f}%")
x = R[(R["stack"] == "current (engine SETS)") & (R.lam == 60) & (R.thr == 1.75 * SC)].iloc[0]; print(f"  frozen config (λ60, thr 1.75, engine SETS): 2024 {100*x.w24:.1f}%/{x.n24} ROI {100*x.roi24:+.1f}% | 2025 {100*x.w25:.1f}%/{x.n25} ROI {100*x.roi25:+.1f}%")
x = R[(R["stack"] == "full stack") & (R.lam == 200) & (R.thr == 1.75 * SC)].iloc[0]; print(f"  full stack (λ200, thr 1.75):                 2024 {100*x.w24:.1f}%/{x.n24} ROI {100*x.roi24:+.1f}% | 2025 {100*x.w25:.1f}%/{x.n25} ROI {100*x.roi25:+.1f}%")
d.to_parquet(f"data/_{STAT}_deep_frame.parquet", index=False)
