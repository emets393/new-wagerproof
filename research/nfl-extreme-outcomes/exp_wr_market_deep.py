#!/usr/bin/env python3
"""ONE MARKET, EVERYTHING WE OWN — WIDE RECEIVERS / TIGHT ENDS (owner, 2026-09-19): the same pass we ran for
quarterbacks and backs, for RECEPTIONS and RECEIVING YARDS.  Builds data/_{STAT}_deep_frame.parquet so
qb_profiles.py (per-player factor tendencies, strict per-season stability) and exp_qb_forecast.py (forecast
under the strict rule) run unchanged on receivers.
Frame = every WR/TE line 2023-25 (prop engine + injury context + best-book, DNP removed), plus:
  him        entering target share, route share, depth, yards per route, targets, catch rate, his
             man / two-high sensitivity (from the targets frame; zero-stat rows are ZERO, the leak fix)
  opponent   entering man rate, blitz rate, pressure rate (pbp + FTN, from the completions frame),
             two-high rate (targets frame)
  context    wind, temperature, precipitation, dome, divisional, rest, PRIMETIME, home, total, team
             spread, implied team total
  injury     WR/TE target share Out, RB carries Out, QB Out (pregame report)
Readouts: walk-forward accuracy by stack; family drop-one; partial effects (actual − line by bucket); all-configs."""
import io, contextlib, itertools, sys, numpy as np, pandas as pd, warnings
MKT = sys.argv[1] if len(sys.argv) > 1 else "player_receptions"; STAT = MKT.replace("player_", ""); SC = 12.0 if "yds" in MKT else 0.7   # threshold unit: yards x12, receptions x0.7
from sklearn.ensemble import HistGradientBoostingRegressor
warnings.filterwarnings("ignore"); num = lambda s: pd.to_numeric(s, errors="coerce")
src = open("exp_prop_injury_context.py").read().split('print("\\n" + "=" * 130)')[0]; ns = {}
with contextlib.redirect_stdout(io.StringIO()): exec(compile(src, "ic", "exec"), ns)
prep2, PE, CTX = ns["prep2"], ns["PE"], ns["CTX"]
from prop_engine import ridge
d, F0 = prep2(MKT, ["WR","TE"], None); d = d[d.close_line.notna() & d.actual.notna()].copy()
d["team"] = d.team.replace({"LAR": "LA"}); d["opp"] = d.opp.replace({"LAR": "LA"}); d["pid"] = d.playerPlayerId.astype(str)
short = lambda nm: (nm.split()[0][0] + "." + " ".join(nm.split()[1:])) if " " in str(nm) else str(nm)
d["qb"] = d.player_name.map(lambda n: str(n) if ("." in str(n) and " " not in str(n)) else short(str(n).replace(".", "")))   # prop-frame names are already "C.Kupp"   # column kept as 'qb' so the profile / forecast scripts work unchanged (it is the RECEIVER here)
print(f"{STAT} frame: {len(d)} WR/TE-games 2023-25, {len(F0)} prop-engine features | zero-stat games kept: {int((d.actual <= 0).sum())}")
# ================================================================= him + opponent two-high (targets frame, leak-fixed)
RV = pd.read_parquet("data/_targets_proj_frame.parquet"); RV["pid"] = RV.pid.astype(str)
HIM = ["e_tgt","e_tsh","e_rsh","e_adot","e_yprr","e_routes","e_cr","sens_man","sens_two"]; HIM = [c for c in HIM if c in RV.columns]
d = d.merge(RV[["pid","season","week"] + HIM + ["e_two"]].drop_duplicates(["pid","season","week"]).rename(columns={"e_two": "opp_rate_two"}), on=["pid","season","week"], how="left")
# ================================================================= opponent man / blitz / pressure (entering, from the QB completions frame)
Q = pd.read_parquet("data/_completions_deep_frame.parquet"); OPPQ = [c for c in ("opp_rate_man","opp_rate_blitz","opp_rate_press") if c in Q.columns]
Q = Q[["opp","season","week"] + OPPQ].drop_duplicates(["opp","season","week"]); d = d.merge(Q, on=["opp","season","week"], how="left")
d["ix_man"] = d.sens_man.fillna(0) * (d.opp_rate_man - d.opp_rate_man.mean()) if "sens_man" in d.columns else 0.0
d["ix_two"] = d.sens_two.fillna(0) * (d.opp_rate_two - d.opp_rate_two.mean()) if "sens_two" in d.columns else 0.0
# ================================================================= game context
m = pd.read_parquet("data/matchup.parquet")[["season","week","home_ab","away_ab","home_rest","away_rest","div_game","primetime","wind_mph","temp_f","precipitation_pct","game_stadium_dome","dome_closed"]]
m["home_ab"] = m.home_ab.replace({"LAR":"LA"}); m["away_ab"] = m.away_ab.replace({"LAR":"LA"})
h = m.rename(columns={"home_ab":"team","away_ab":"opp","home_rest":"rest","away_rest":"opp_rest"}); a = m.rename(columns={"away_ab":"team","home_ab":"opp","away_rest":"rest","home_rest":"opp_rest"})
G = pd.concat([h, a])[["season","week","team","rest","opp_rest","div_game","primetime","wind_mph","temp_f","precipitation_pct","game_stadium_dome","dome_closed"]]
G["indoors"] = (G.game_stadium_dome.astype(str).str.lower().isin(["true","1"]) | (num(G.dome_closed) == 1)).astype(float); G["wind"] = np.where(G.indoors == 1, 0, num(G.wind_mph)); G["temp"] = np.where(G.indoors == 1, 70, num(G.temp_f))
_pp = num(G.precipitation_pct); _pp = np.where(_pp > 1, _pp / 100.0, _pp); G["precip"] = np.where(G.indoors == 1, 0, np.where(np.isnan(_pp), 0, (_pp >= 0.5).astype(float)))
G["off_bye"] = (num(G.rest) >= 13).astype(float); G["short_week"] = (num(G.rest) <= 5).astype(float)
G = G.drop(columns=["game_stadium_dome","dome_closed","wind_mph","temp_f","precipitation_pct"]).drop_duplicates(["season","week","team"])
for c in ("rest","opp_rest","div_game","primetime"): G[c] = num(G[c])
d = d.merge(G, on=["season","week","team"], how="left")
d["implied_tt"] = (d.total - d.team_spread) / 2; d["abs_spread"] = d.team_spread.abs(); d["big_fav"] = (d.team_spread <= -7).astype(float); d["big_dog"] = (d.team_spread >= 7).astype(float)
CONTEXT = ["total","team_spread","implied_tt","abs_spread","big_fav","big_dog","is_home","wind","temp","precip","indoors","div_game","rest","opp_rest","off_bye","short_week","primetime"]
OPPX = OPPQ + ["opp_rate_two","ix_man","ix_two"]
print(f"  coverage: him {d.e_tsh.notna().mean():.0%} | opp coverage rates {d[OPPQ[0]].notna().mean() if OPPQ else 0:.0%} | two-high {d.opp_rate_two.notna().mean():.0%} | context {d.wind.notna().mean():.0%} | primetime games {int((d.primetime == 1).sum())}")
# ================================================================= families
RECVF = [c for c in F0 if c.startswith(("rc_","sp_","ix_sep","ix_slot","ix_deep","ix_tprr","ix_script"))]; TEAM = [c for c in F0 if c.startswith(("off_","T_","tm_","qb_"))]; OPP = [c for c in F0 if c.startswith(("def_","O_","OL_","oppallow"))]
FORM = [c for c in ("l3","l5","szn") if c in d.columns]; LINE = ["close_line"]
FAM = {"line": LINE, "form": FORM, "him": HIM, "receiver_engine": RECVF, "team": TEAM, "opponent": OPP, "opp_coverage": OPPX, "context": CONTEXT, "injury": CTX}
ALL = list(dict.fromkeys(sum(FAM.values(), []))); ALL = [c for c in ALL if c in d.columns]
for c in ALL: d[c] = num(d[c]).astype(float)   # nullable Int64 (primetime) breaks numpy corrcoef downstream
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
print("\n" + "=" * 118); print(f"(1) ACCURACY by cumulative feature stack — walk-forward (train < season). MAE in {STAT}; r = corr(pred, actual). Line-only = predict the line."); print("=" * 118)
stacks = [("line only", LINE)]; acc = LINE
for name in ("form","him","receiver_engine","team","opponent","opp_coverage","context","injury"): acc = acc + FAM[name]; stacks.append(("+ " + name, list(acc)))
print(f"  {'stack':18s} | " + " | ".join(f"{yr}: MAE  r   | bet≥{SC} win%/n" for yr in (2024, 2025)))
for name, F in stacks:
    F = [c for c in dict.fromkeys(F) if c in d.columns]; out = []
    for yr in (2024, 2025):
        tr, te = d[d.season < yr], d[d.season == yr]; pred = fit_pred(tr, te, F) if name != "line only" else te.close_line.values
        w, n, roi = gbest(te, pred, SC); out.append(f"{yr}: {np.abs(pred - te.actual).mean():5.2f} {np.corrcoef(pred, te.actual)[0,1]:+.2f} | {100*w if n else np.nan:4.1f}%/{n:3d}")
    print(f"  {name:18s} | " + " | ".join(out))
print("\n" + "=" * 118); print("(2) WHICH FAMILIES MOVE THE NUMBER — drop-one from the full stack (2025 holdout, train 2023-24): change in MAE (+ = family helped)"); print("=" * 118)
tr, te = d[d.season < 2025], d[d.season == 2025]; full = np.abs(fit_pred(tr, te, ALL) - te.actual).mean()
for name, cols in FAM.items():
    F = [c for c in ALL if c not in cols]; mae = np.abs(fit_pred(tr, te, F) - te.actual).mean(); print(f"  drop {name:16s} ({len(cols):3d} feats): MAE {mae:.3f} vs full {full:.3f}  ->  {mae - full:+.3f}")
print("\n" + "=" * 118); print("(3) PARTIAL EFFECTS — actual minus the posted line, by bucket (pooled 2023-25). A non-zero row is what the line misses."); print("=" * 118)
d["res_line"] = d.actual - d.close_line
def bucket(col, cuts, labels):
    if col not in d.columns: return
    b = pd.cut(d[col], cuts, labels=labels); t = d.groupby(b).res_line.agg(["mean","median","count"]); print(f"  {col:16s} " + " | ".join(f"{k}: {v['mean']:+.2f} (med {v['median']:+.1f}, n={int(v['count'])})" for k, v in t.iterrows()))
bucket("team_spread", [-99, -7, -3, 3, 7, 99], ["fav 7+","fav 3-7","pick","dog 3-7","dog 7+"]); bucket("total", [0, 41, 45, 49, 99], ["<=41","41-45","45-49","49+"]); bucket("wind", [-1, 5, 12, 18, 99], ["calm","5-12","12-18","18+"])
bucket("temp", [-99, 32, 50, 75, 199], ["<=32","32-50","50-75","75+"]); bucket("primetime", [-1, 0.5, 1.5], ["day","primetime"]); bucket("div_game", [-1, 0.5, 1.5], ["non-div","divisional"]); bucket("rest", [0, 5, 8, 99], ["short","normal","long/bye"])
bucket("opp_rate_man", [-1, 0.25, 0.35, 1], ["zone-heavy","mid","man-heavy"]); bucket("opp_rate_two", [-1, 0.28, 0.40, 1], ["single-high","mid","two-high"]); bucket("opp_rate_blitz", [-1, 0.22, 0.30, 1], ["low blitz","mid","high blitz"]); bucket("opp_rate_press", [-1, 0.30, 0.38, 1], ["low pressure","mid","high pressure"])
bucket("e_tsh", [-1, 0.15, 0.22, 0.28, 2], ["<15% share","15-22","22-28","28%+"]); bucket("inj_wrte_tgt_out", [-1, 0.001, 0.15, 2], ["no WR/TE out","<15% out","15%+ out"]); bucket("inj_qb_out", [-1, 0.5, 1.5], ["QB in","QB out"])
print("\n" + "=" * 118); print("(4) THE BET — all configs (λ × threshold × stack) at best-book, per season; share of configs profitable + the frozen config"); print("=" * 118)
res = []
for lam, thr, (sname, F) in itertools.product((60, 200, 600), (SC * 0.7, SC, SC * 1.5), [("current (engine SETS)", [c for c in PE.SETS[MKT] if c in d.columns]), ("full stack", ALL), ("full minus context", [c for c in ALL if c not in CONTEXT]), ("full + hgb", ALL)]):
    r = {}
    for yr in (2024, 2025):
        tr, te = d[d.season < yr], d[d.season == yr]; pred = fit_pred(tr, te, F, lam, "hgb" if "hgb" in sname else "ridge"); w, n, roi = gbest(te, pred, thr); r[yr] = (roi if n >= 30 else np.nan, w, n)
    res.append(dict(stack=sname, lam=lam, thr=thr, roi24=r[2024][0], roi25=r[2025][0], w24=r[2024][1], n24=r[2024][2], w25=r[2025][1], n25=r[2025][2]))
R = pd.DataFrame(res)
for sname, x in R.groupby("stack", sort=False):
    y = x.dropna(subset=["roi24","roi25"]); print(f"  {sname:22s}: 2024 {100*(y.roi24>0).mean():3.0f}% of configs profitable (median ROI {100*y.roi24.median():+5.1f}%) | 2025 {100*(y.roi25>0).mean():3.0f}% (median {100*y.roi25.median():+5.1f}%) | both {100*((y.roi24>0)&(y.roi25>0)).mean():3.0f}%")
x = R[(R["stack"] == "current (engine SETS)") & (R.lam == 200) & (R.thr == SC)].iloc[0]; print(f"  frozen config (λ200, thr {SC}, engine SETS): 2024 {100*x.w24:.1f}%/{x.n24} ROI {100*x.roi24:+.1f}% | 2025 {100*x.w25:.1f}%/{x.n25} ROI {100*x.roi25:+.1f}%")
x = R[(R["stack"] == "full stack") & (R.lam == 200) & (R.thr == SC)].iloc[0]; print(f"  full stack (λ200, thr {SC}):                2024 {100*x.w24:.1f}%/{x.n24} ROI {100*x.roi24:+.1f}% | 2025 {100*x.w25:.1f}%/{x.n25} ROI {100*x.roi25:+.1f}%")
d.to_parquet(f"data/_{STAT}_deep_frame.parquet", index=False)
