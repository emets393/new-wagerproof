#!/usr/bin/env python3
"""RECEPTIONS with the TARGETS model inside (owner, 2026-09-18).
Frame: every WR/TE receptions line 2023-25 (prop engine + injury context + best-book) joined to the
targets deep frame (data/_targets_deep_frame.parquet) on player + week, and to a walk-forward TARGETS
projection (HGB on the full targets stack, trained on seasons < the test season) and his entering catch
rate (receptions / targets, K=4 seeded).
Predictors of receptions:  LINE | TGT x CR (projected targets x his catch rate) | DIRECT (the frozen
receptions model: NARROW_RECV, lambda 200) | DIRECT + TGT (targets projection, TGT x CR, catch rate added as
features) | HGB on everything.  Grading: MAE; the bet at |pred − line| >= 0.5 / 0.7 / 1.0 at best-book per
season; plus the forecast window (learn <= 2025 wk12 -> 2025 wk13-22)."""
import io, contextlib, itertools, numpy as np, pandas as pd, warnings
from sklearn.ensemble import HistGradientBoostingRegressor
warnings.filterwarnings("ignore"); num = lambda s: pd.to_numeric(s, errors="coerce"); K = 4.0
src = open("exp_prop_injury_context.py").read().split('print("\\n" + "=" * 130)')[0]; ns = {}
with contextlib.redirect_stdout(io.StringIO()): exec(compile(src, "ic", "exec"), ns)
prep2, PE, CTX = ns["prep2"], ns["PE"], ns["CTX"]; from prop_engine import ridge
d, F0 = prep2("player_receptions", ["WR","TE"], None); d = d[d.close_line.notna() & d.actual.notna()].copy(); d["pid"] = d.playerPlayerId.astype(str)
RV = pd.read_parquet("data/_targets_deep_frame.parquet"); RV["pid"] = RV.pid.astype(str)
TF = [c for c in RV.columns if c.startswith(("e_","sens_","ix_")) or c in ("wind","temp","rest","is_home","div_game","spread","total","implied_tt","big_fav","big_dog") or c in CTX]
TF = [c for c in dict.fromkeys(TF)]; TALL = TF
# catch rate entering (rec / tgt), from the targets frame's per-game rec & tgt
RV = RV.sort_values(["pid","season","week"]); g = RV.groupby(["pid","season"]); pri = g.agg(a=("rec","sum"), b=("tgt","sum")); pri["r"] = pri.a / pri.b.replace(0, np.nan)
p = pd.Series([pri.r.get((i, s - 1), np.nan) for i, s in zip(RV.pid, RV.season)], index=RV.index); cs = g.rec.cumsum() - RV.rec; cn = g.tgt.cumsum() - RV.tgt; k = K * RV.tgt.mean()
RV["e_cr"] = (cs + k * p.fillna(0)) / (cn + k * p.notna()); RV.loc[(cn == 0) & p.isna(), "e_cr"] = np.nan
# walk-forward targets projection for every RV row (train HGB on seasons < yr)
RV["tgt_proj"] = np.nan
for yr in (2023, 2024, 2025):
    tr = RV[RV.season < yr].dropna(subset=["tgt"]); te = RV.season == yr
    if len(tr) < 500: continue
    h = HistGradientBoostingRegressor(max_iter=300, learning_rate=0.04, max_depth=3, l2_regularization=2.0, min_samples_leaf=40, random_state=0).fit(tr[TALL].fillna(tr[TALL].median()), tr.tgt)
    RV.loc[te, "tgt_proj"] = h.predict(RV.loc[te, TALL].fillna(tr[TALL].median()))
keep = list(dict.fromkeys(["pid","season","week","tgt_proj","e_cr","e_tgt","tgt","rec"] + [c for c in TALL if c not in d.columns]))
d = d.merge(RV[keep].drop_duplicates(["pid","season","week"]), on=["pid","season","week"], how="left")
d = d[d.tgt_proj.notna() & d.e_cr.notna()].copy(); d["tgt_x_cr"] = d.tgt_proj * d.e_cr; d["base_x_cr"] = d.e_tgt * d.e_cr
print(f"receptions frame: {len(d)} WR/TE lines 2023-25 with a targets projection | seasons {d.season.value_counts().sort_index().to_dict()}")
print(f"  targets projection vs actual targets on these rows: r {np.corrcoef(d.tgt_proj, d.tgt)[0,1]:+.3f} (baseline {np.corrcoef(d.e_tgt, d.tgt)[0,1]:+.3f}) | line-implied targets (line / catch rate) r {np.corrcoef(d.close_line / d.e_cr, d.tgt)[0,1]:+.3f}")
DIRECT = [c for c in PE.NARROW_RECV if c in d.columns]; PLUS = ["tgt_proj","tgt_x_cr","e_cr","base_x_cr"]
ALL = list(dict.fromkeys(DIRECT + PLUS + [c for c in TALL if c in d.columns])); d[ALL] = d[ALL].apply(lambda s: s.fillna(s.median())).fillna(0)
def fit(tr, te, F, lam=200, model="ridge"):
    Fk = [c for c in F if tr[c].std() > 1e-9]
    if model == "hgb": return HistGradientBoostingRegressor(max_iter=300, learning_rate=0.04, max_depth=3, l2_regularization=2.0, min_samples_leaf=40, random_state=0).fit(tr[Fk], tr.actual).predict(te[Fk])
    X = tr[Fk].values.astype(float); mu, sd = X.mean(0), X.std(0); sd[sd == 0] = 1; w = ridge((X - mu) / sd, tr.actual.values.astype(float), lam); return np.hstack([(te[Fk].values.astype(float) - mu) / sd, np.ones((len(te), 1))]) @ w
def gbest(x, pred, thr):
    e = pred - x.close_line.values; sel = (np.abs(e) >= thr) & x.bo_line.notna().values; x = x[sel]; e = e[sel]
    if not len(x): return np.nan, 0, np.nan
    over = e > 0; line = np.where(over, x.bo_line, x.bu_line); pay = np.where(over, x.bo_dec, x.bu_dec); won = np.where(over, x.actual > line, x.actual < line); push = x.actual.values == line
    p = np.where(push, 0, np.where(won, pay, -1.0)); return (won[~push].mean() if (~push).sum() else np.nan), int((~push).sum()), p.mean()
MODELS = [("LINE", None, None), ("baseline targets x catch rate", "base_x_cr", None), ("TARGETS model x catch rate", "tgt_x_cr", None), ("DIRECT (frozen receptions model)", DIRECT, "ridge"), ("DIRECT + targets projection", DIRECT + PLUS, "ridge"), ("everything, ridge", ALL, "ridge"), ("everything, HGB", ALL, "hgb")]
print("\n" + "=" * 118); print("RECEPTIONS vs the LINE — walk-forward 2024 / 2025: MAE, r, and the bet at |pred − line| ≥ 0.7 (win% / n / ROI at best-book)"); print("=" * 118)
P = {}
for name, F, model in MODELS:
    out = []; P[name] = {}
    for yr in (2024, 2025):
        tr, te = d[d.season < yr], d[d.season == yr]
        pred = te.close_line.values if F is None else (te[F].values if isinstance(F, str) else fit(tr, te, F, 200, model)); P[name][yr] = (te, pred)
        w, n, roi = gbest(te, pred, 0.7); out.append(f"{yr}: MAE {np.abs(pred - te.actual).mean():.3f} r {np.corrcoef(pred, te.actual)[0,1]:+.3f} | {100*w if n else np.nan:4.1f}%/{n:3d} {100*roi if n else np.nan:+5.1f}%")
    print(f"  {name:34s} | " + " | ".join(out))
print("\n  THRESHOLD LADDER (win% / n) per season:")
for name in ("TARGETS model x catch rate", "DIRECT (frozen receptions model)", "DIRECT + targets projection", "everything, HGB"):
    line = f"  {name:34s}"
    for yr in (2024, 2025):
        te, pred = P[name][yr]; line += f" | {yr}: " + " ".join(f"≥{t}: {100*gbest(te, pred, t)[0] if gbest(te, pred, t)[1] else np.nan:4.1f}%/{gbest(te, pred, t)[1]:3d}" for t in (0.5, 0.7, 1.0, 1.5))
    print(line)
print("\n  ALL-CONFIGS (λ 60/200/600 × thr 0.5/0.7/1.0): share of configs profitable per season, and both")
for name, F in (("DIRECT", DIRECT), ("DIRECT + targets", DIRECT + PLUS), ("everything", ALL)):
    res = []
    for lam, thr in itertools.product((60, 200, 600), (0.5, 0.7, 1.0)):
        r = {}
        for yr in (2024, 2025):
            tr, te = d[d.season < yr], d[d.season == yr]; w, n, roi = gbest(te, fit(tr, te, F, lam), thr); r[yr] = roi if n >= 30 else np.nan
        res.append(r)
    R = pd.DataFrame(res).dropna(); print(f"  {name:18s}: 2024 {100*(R[2024]>0).mean():3.0f}% (median {100*R[2024].median():+5.1f}%) | 2025 {100*(R[2025]>0).mean():3.0f}% (median {100*R[2025].median():+5.1f}%) | both {100*((R[2024]>0)&(R[2025]>0)).mean():3.0f}%")
print("\n  AGREEMENT: DIRECT and TARGETS×CR both ≥0.7 off the line, SAME side")
for yr in (2024, 2025):
    te, p1 = P["DIRECT (frozen receptions model)"][yr]; _, p2 = P["TARGETS model x catch rate"][yr]; e1, e2 = p1 - te.close_line.values, p2 - te.close_line.values
    m_ = (np.abs(e1) >= 0.7) & (np.abs(e2) >= 0.7) & (np.sign(e1) == np.sign(e2)); w, n, roi = gbest(te[m_], p1[m_], 0.7); print(f"    {yr}: {100*w if n else np.nan:.1f}% n={n} ROI {100*roi if n else np.nan:+.1f}%")
print("\n  FORECAST WINDOW: learn ≤ 2025 wk12 → 2025 wk13-22")
tr, te = d[(d.season < 2025) | ((d.season == 2025) & (d.week <= 12))], d[(d.season == 2025) & (d.week > 12)]
for name, F, model in MODELS:
    pred = te.close_line.values if F is None else (te[F].values if isinstance(F, str) else fit(tr, te, F, 200, model)); w, n, roi = gbest(te, pred, 0.7)
    print(f"    {name:34s} MAE {np.abs(pred - te.actual).mean():.3f} | ≥0.7: {100*w if n else np.nan:4.1f}%/{n:3d} {100*roi if n else np.nan:+5.1f}%")
d.to_parquet("data/_receptions_targets_frame.parquet", index=False)
