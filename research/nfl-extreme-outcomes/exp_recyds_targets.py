#!/usr/bin/env python3
"""RECEIVING YARDS with the TARGETS model inside (owner, 2026-09-19): "understand targets, then receptions, then yards".
Frame: every WR/TE receiving-yards line 2023-25 (prop engine + injury context + best-book, DNP removed) joined to the
targets projection frame (data/_targets_proj_frame.parquet, written by exp_receptions_targets.py: walk-forward HGB
targets projection trained on seasons < test season + entering catch rate) plus entering yards per reception, yards per
target, and depth of target (K=4 seeded, cumulative minus this game).
Predictors:  LINE | baseline targets x YPT | TARGETS model x catch rate x YPR | TARGETS model x YPT | DIRECT (frozen
rec-yds model: NARROW_RECV, lambda 200) | DIRECT + targets features | everything ridge / HGB.
Grading: MAE; the bet at |pred - line| >= 6 / 12 / 18 yards at best book per season; forecast window.
VERIFICATION in the same run: oracle; proper null (permute residual-vs-line within season x line bucket so line pairing
is kept, refit everything, 5 reps); line-level / side / position / half-season cuts; all-configs table; leak audit."""
import io, contextlib, itertools, numpy as np, pandas as pd, warnings
from sklearn.ensemble import HistGradientBoostingRegressor
warnings.filterwarnings("ignore"); K = 4.0
src = open("exp_prop_injury_context.py").read().split('print("\\n" + "=" * 130)')[0]; ns = {}
with contextlib.redirect_stdout(io.StringIO()): exec(compile(src, "ic", "exec"), ns)
prep2, PE, CTX = ns["prep2"], ns["PE"], ns["CTX"]; from prop_engine import ridge
d, F0 = prep2("player_reception_yds", ["WR","TE"], None); d = d[d.close_line.notna() & d.actual.notna()].copy(); d["pid"] = d.playerPlayerId.astype(str)
RV = pd.read_parquet("data/_targets_proj_frame.parquet"); RV["pid"] = RV.pid.astype(str); RV = RV.sort_values(["pid","season","week"])
TF = [c for c in RV.columns if c.startswith(("e_","sens_","ix_")) or c in ("wind","temp","rest","is_home","div_game","spread","total","implied_tt","big_fav","big_dog") or c in CTX]
TF = [c for c in dict.fromkeys(TF) if c not in ("e_cr",)]
# entering yards per reception, yards per target, and average depth (K=4 games of prior-season rate as the seed)
g = RV.groupby(["pid","season"])
def entering(num, den, name):
    pri = g.agg(a=(num, "sum"), b=(den, "sum")); pri["r"] = pri.a / pri.b.replace(0, np.nan)
    p = pd.Series([pri.r.get((i, s - 1), np.nan) for i, s in zip(RV.pid, RV.season)], index=RV.index)
    cs = g[num].cumsum() - RV[num]; cn = g[den].cumsum() - RV[den]; k = K * RV[den].mean()
    RV[name] = (cs + k * p.fillna(0)) / (cn + k * p.notna()); RV.loc[(cn == 0) & p.isna(), name] = np.nan
entering("yds", "rec", "e_ypr"); entering("yds", "tgt", "e_ypt")
keep = list(dict.fromkeys(["pid","season","week","tgt_proj","e_cr","e_ypr","e_ypt","e_tgt","tgt","rec","yds"] + [c for c in TF if c not in d.columns]))
d = d.merge(RV[keep].drop_duplicates(["pid","season","week"]), on=["pid","season","week"], how="left")
d = d[d.tgt_proj.notna() & d.e_cr.notna() & d.e_ypt.notna()].copy()
d["proj_ypt"] = d.tgt_proj * d.e_ypt; d["proj_cr_ypr"] = d.tgt_proj * d.e_cr * d.e_ypr.fillna(d.e_ypt / d.e_cr.clip(lower=0.3)); d["base_ypt"] = d.e_tgt * d.e_ypt
print(f"receiving-yards frame: {len(d)} WR/TE lines 2023-25 | seasons {d.season.value_counts().sort_index().to_dict()} | zero-yard games kept: {int((d.actual <= 0).sum())}")
print(f"  actual vs: line r {np.corrcoef(d.close_line, d.actual)[0,1]:+.3f} | targets model x YPT r {np.corrcoef(d.proj_ypt, d.actual)[0,1]:+.3f} | baseline x YPT r {np.corrcoef(d.base_ypt, d.actual)[0,1]:+.3f} | line-implied targets (line / YPT) vs actual targets r {np.corrcoef(d.close_line / d.e_ypt, d.tgt)[0,1]:+.3f} vs our targets model r {np.corrcoef(d.tgt_proj, d.tgt)[0,1]:+.3f}")
DIRECT = [c for c in PE.NARROW_RECV if c in d.columns]; PLUS = ["tgt_proj","proj_ypt","proj_cr_ypr","e_cr","e_ypr","e_ypt","base_ypt"]
ALL = list(dict.fromkeys(DIRECT + PLUS + [c for c in TF if c in d.columns])); d[ALL] = d[ALL].apply(lambda s: s.fillna(s.median())).fillna(0)
def fit(tr, te, F, lam=200, model="ridge", y="actual"):
    Fk = [c for c in F if tr[c].std() > 1e-9]
    if model == "hgb": return HistGradientBoostingRegressor(max_iter=300, learning_rate=0.04, max_depth=3, l2_regularization=2.0, min_samples_leaf=40, random_state=0).fit(tr[Fk], tr[y]).predict(te[Fk])
    X = tr[Fk].values.astype(float); mu, sd = X.mean(0), X.std(0); sd[sd == 0] = 1; w = ridge((X - mu) / sd, tr[y].values.astype(float), lam); return np.hstack([(te[Fk].values.astype(float) - mu) / sd, np.ones((len(te), 1))]) @ w
def gbest(x, pred, thr, side=None):
    e = pred - x.close_line.values; sel = (np.abs(e) >= thr) & x.bo_line.notna().values
    if side == "over": sel &= e > 0
    if side == "under": sel &= e < 0
    x = x[sel]; e = e[sel]
    if not len(x): return np.nan, 0, np.nan
    over = e > 0; line = np.where(over, x.bo_line, x.bu_line); pay = np.where(over, x.bo_dec, x.bu_dec); won = np.where(over, x.actual > line, x.actual < line); push = x.actual.values == line
    p = np.where(push, 0, np.where(won, pay, -1.0)); return (won[~push].mean() if (~push).sum() else np.nan), int((~push).sum()), p.mean()
fmt = lambda w, n, roi: f"{100*w if n else np.nan:4.1f}%/{n:3d} {100*roi if n else np.nan:+5.1f}%"
MODELS = [("LINE", None, None), ("baseline targets x YPT", "base_ypt", None), ("TARGETS model x YPT", "proj_ypt", None), ("TARGETS model x CR x YPR", "proj_cr_ypr", None),
          ("DIRECT (frozen rec-yds model)", DIRECT, "ridge"), ("DIRECT + targets features", DIRECT + PLUS, "ridge"), ("everything, ridge", ALL, "ridge"), ("everything, HGB", ALL, "hgb")]
print("\n" + "=" * 120); print("RECEIVING YARDS vs the LINE — walk-forward 2024 / 2025: MAE, r, and the bet at |pred − line| ≥ 12 yds (win% / n / ROI at best book)"); print("=" * 120)
P = {}
for name, F, model in MODELS:
    out = []; P[name] = {}
    for yr in (2024, 2025):
        tr, te = d[d.season < yr], d[d.season == yr]
        pred = te.close_line.values if F is None else (te[F].values if isinstance(F, str) else fit(tr, te, F, 200, model)); P[name][yr] = (te, pred)
        out.append(f"{yr}: MAE {np.abs(pred - te.actual).mean():5.2f} r {np.corrcoef(pred, te.actual)[0,1]:+.3f} | " + fmt(*gbest(te, pred, 12)))
    print(f"  {name:30s} | " + " | ".join(out))
print("\n  THRESHOLD LADDER (win% / n) per season:")
for name in ("TARGETS model x YPT", "DIRECT (frozen rec-yds model)", "DIRECT + targets features", "everything, HGB"):
    line = f"  {name:30s}"
    for yr in (2024, 2025):
        te, pred = P[name][yr]; line += f" | {yr}: " + " ".join(f"≥{t}: {100*gbest(te, pred, t)[0] if gbest(te, pred, t)[1] else np.nan:4.1f}%/{gbest(te, pred, t)[1]:3d}" for t in (6, 12, 18, 25))
    print(line)
print("\n  OVER vs UNDER side (≥12) per season:")
for name in ("TARGETS model x YPT", "DIRECT + targets features", "everything, HGB"):
    print(f"  {name:30s} | " + " | ".join(f"{yr}: over {fmt(*gbest(*P[name][yr], 12, 'over'))}  under {fmt(*gbest(*P[name][yr], 12, 'under'))}" for yr in (2024, 2025)))
print("\n  ALL-CONFIGS (λ 60/200/600 × thr 6/12/18): share of configs profitable per season, and both")
for name, F in (("DIRECT", DIRECT), ("DIRECT + targets", DIRECT + PLUS), ("everything", ALL)):
    res = []
    for lam, thr in itertools.product((60, 200, 600), (6, 12, 18)):
        r = {}
        for yr in (2024, 2025):
            tr, te = d[d.season < yr], d[d.season == yr]; w, n, roi = gbest(te, fit(tr, te, F, lam), thr); r[yr] = roi if n >= 30 else np.nan
        res.append(r)
    R = pd.DataFrame(res).dropna(); print(f"  {name:18s}: 2024 {100*(R[2024]>0).mean():3.0f}% (median {100*R[2024].median():+5.1f}%) | 2025 {100*(R[2025]>0).mean():3.0f}% (median {100*R[2025].median():+5.1f}%) | both {100*((R[2024]>0)&(R[2025]>0)).mean():3.0f}%")
print("\n  FORECAST WINDOW: learn ≤ 2025 wk12 → 2025 wk13-22 (≥12)")
tr, te = d[(d.season < 2025) | ((d.season == 2025) & (d.week <= 12))], d[(d.season == 2025) & (d.week > 12)]
for name, F, model in MODELS:
    pred = te.close_line.values if F is None else (te[F].values if isinstance(F, str) else fit(tr, te, F, 200, model)); print(f"    {name:30s} MAE {np.abs(pred - te.actual).mean():5.2f} | " + fmt(*gbest(te, pred, 12)))
# ---------------------------------------------------------------- VERIFICATION
FV = DIRECT + PLUS
print("\n" + "=" * 120); print("VERIFICATION of DIRECT + targets features (λ200, ≥12)"); print("=" * 120)
print("1) ORACLE — actual fed in as the prediction: " + " | ".join(f"{yr}: {100*gbest(d[d.season == yr], d[d.season == yr].actual.values + 12.5 * np.sign(d[d.season == yr].actual - d[d.season == yr].close_line + 1e-9), 12)[0]:.1f}%" for yr in (2024, 2025)) + "  (must be ~100)")
print("2) PROPER NULL — residual (actual − line) permuted within season × line bucket, line pairing kept, DIRECT + targets refit; 5 reps")
d["lb"] = pd.cut(d.close_line, [0, 30, 45, 60, 80, 999], labels=False); rng = np.random.default_rng(0)
for rep in range(5):
    s = d.copy(); res = s.actual - s.close_line; s["actual"] = s.close_line + res.groupby([s.season, s.lb]).transform(lambda v: rng.permutation(v.values))
    print(f"    rep {rep}: " + " | ".join(f"{yr}: " + fmt(*gbest(s[s.season == yr], fit(s[s.season < yr], s[s.season == yr], FV), 12)) for yr in (2024, 2025)))
print("    REAL:  " + " | ".join(f"{yr}: " + fmt(*gbest(d[d.season == yr], fit(d[d.season < yr], d[d.season == yr], FV), 12)) for yr in (2024, 2025)))
print("3) LINE-SHOPPING ONLY — no model: side whose best book is furthest from consensus (gap ≥ 3 yds)")
for yr in (2024, 2025):
    te = d[(d.season == yr) & d.bo_line.notna()]; go, gu = te.close_line - te.bo_line, te.bu_line - te.close_line; po = go > gu; gap = np.where(po, go, gu); sel = gap >= 3; x = te[sel]; po = po[sel]
    line = np.where(po, x.bo_line, x.bu_line); pay = np.where(po, x.bo_dec, x.bu_dec); won = np.where(po, x.actual > line, x.actual < line); push = x.actual.values == line; p = np.where(push, 0, np.where(won, pay, -1.0))
    print(f"    {yr}: {100*won[~push].mean():.1f}% n={int((~push).sum())} ROI {100*p.mean():+.1f}%")
print("4) LEAK AUDIT — corr of each feature with THIS game's (actual − line) vs with (baseline − line); a same-game leak is high on the first only")
res = d.actual - d.close_line; bres = d.base_ypt - d.close_line; rows = [(c, np.corrcoef(d[c], res)[0,1], np.corrcoef(d[c], bres)[0,1]) for c in FV if d[c].std() > 0]
R = pd.DataFrame(rows, columns=["feature","r_actual_resid","r_baseline_resid"]).sort_values("r_actual_resid", key=abs, ascending=False); print(R.head(8).round(3).to_string(index=False)); print(f"    max |corr with actual residual| = {R.r_actual_resid.abs().max():.3f} (leak would be > 0.3)")
print("5) STABILITY cuts (DIRECT + targets, ≥12):")
def cut(label, mask_fn):
    out = []
    for yr in (2024, 2025):
        tr, te = d[d.season < yr], d[d.season == yr]; pred = fit(tr, te, FV); m_ = mask_fn(te, pred); out.append(f"{yr}: " + fmt(*gbest(te[m_], pred[m_], 12)))
    print(f"    {label:22s} " + " | ".join(out))
cut("weeks 1-9", lambda te, p: (te.week <= 9).values); cut("weeks 10-22", lambda te, p: (te.week > 9).values); cut("WR", lambda te, p: (te.position == "WR").values); cut("TE", lambda te, p: (te.position == "TE").values)
for lo, hi in ((0, 30), (30, 45), (45, 60), (60, 80), (80, 999)): cut(f"line {lo}-{hi if hi < 999 else '+'}", lambda te, p, lo=lo, hi=hi: ((te.close_line > lo) & (te.close_line <= hi)).values)
print("    by line bucket, OVER side only / UNDER side only:")
for lo, hi in ((0, 30), (30, 45), (45, 60), (60, 80), (80, 999)):
    out = []
    for yr in (2024, 2025):
        tr, te = d[d.season < yr], d[d.season == yr]; pred = fit(tr, te, FV); m_ = ((te.close_line > lo) & (te.close_line <= hi)).values; out.append(f"{yr}: O {fmt(*gbest(te[m_], pred[m_], 12, 'over'))}  U {fmt(*gbest(te[m_], pred[m_], 12, 'under'))}")
    print(f"      line {lo}-{hi if hi < 999 else '+':>3}: " + " | ".join(out))
print("6) BLANKET RULES (no model), by line bucket: over rate vs consensus / blanket over at best book / blanket under at best book")
for lo, hi in ((0, 30), (30, 45), (45, 60), (60, 80), (80, 999)):
    out = []
    for yr in (2024, 2025):
        x = d[(d.season == yr) & (d.close_line > lo) & (d.close_line <= hi) & d.bo_line.notna()]; ov = (x.actual > x.close_line).mean()
        wo = x.actual > x.bo_line; po = x.actual == x.bo_line; ro = np.where(po, 0, np.where(wo, x.bo_dec, -1.0)).mean(); wu = x.actual < x.bu_line; pu = x.actual == x.bu_line; ru = np.where(pu, 0, np.where(wu, x.bu_dec, -1.0)).mean()
        out.append(f"{yr}: over {100*ov:4.1f}% n={len(x):3d} | O {100*ro:+5.1f}%  U {100*ru:+5.1f}%")
    print(f"      line {lo}-{hi if hi < 999 else '+':>3}: " + " | ".join(out))
d.to_parquet("data/_recyds_targets_frame.parquet", index=False)
