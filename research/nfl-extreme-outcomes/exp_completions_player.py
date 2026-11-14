#!/usr/bin/env python3
"""COMPLETIONS, PLAYER BY PLAYER (owner, 2026-09-18): each quarterback's OWN regression of completions
on the factors, versus the universal one.  Frame = data/_completions_deep_frame.parquet.
Factors (compact so a per-QB fit on 15-40 games is not pure noise): the line, opponent blitz / man /
pressure rates, wind, temperature, team spread, total, receiver-corps catchable %, WR/TE target share
out, rest days, home.
  U   universal ridge on the factors (everyone's slopes)
  P   per-QB ridge: his own slopes from his own prior games (>= 12 games in training; else falls back to U)
  M   mixed: universal slopes + QB-specific slope DEVIATIONS (QB x factor interactions, shrunk) — the
      hierarchical version: each QB's slope = league slope + his own adjustment, pulled toward league
  PR  per-QB regression of the RESIDUAL (completions − line) on the factors
Walk-forward 2024 / 2025 (train < season); MAE, r, and the bet at |edge| >= 1.75 at best-book.
Then the per-QB slope table for the QBs with the most games: which factor moves HIS completions."""
import numpy as np, pandas as pd, warnings
warnings.filterwarnings("ignore")
d = pd.read_parquet("data/_completions_deep_frame.parquet")
FAC = ["close_line","opp_rate_blitz","opp_rate_man","opp_rate_press","wind","temp","team_spread","total","e_rw_catchable","inj_wrte_tgt_out","rest","is_home"]
d = d.dropna(subset=["qb"]).copy(); d[FAC] = d[FAC].apply(lambda s: s.fillna(s.median()))
def ridge(X, y, lam):
    Xb = np.hstack([X, np.ones((len(X), 1))]); A = Xb.T @ Xb + lam * np.eye(Xb.shape[1]); A[-1, -1] -= lam; return np.linalg.lstsq(A, Xb.T @ y, rcond=None)[0]
def zfit(tr, te, F, y, lam):
    X = tr[F].values.astype(float); mu, sd = X.mean(0), X.std(0); sd[sd == 0] = 1; w = ridge((X - mu) / sd, tr[y].values.astype(float), lam)
    return np.hstack([(te[F].values.astype(float) - mu) / sd, np.ones((len(te), 1))]) @ w, w, sd
def gbest(x, pred, thr):
    e = pred - x.close_line.values; sel = (np.abs(e) >= thr) & x.bo_line.notna().values; x = x[sel]; e = e[sel]
    if not len(x): return np.nan, 0, np.nan
    over = e > 0; line = np.where(over, x.bo_line, x.bu_line); pay = np.where(over, x.bo_dec, x.bu_dec); won = np.where(over, x.actual > line, x.actual < line); push = x.actual.values == line
    p = np.where(push, 0, np.where(won, pay, -1.0)); return (won[~push].mean() if (~push).sum() else np.nan), int((~push).sum()), p.mean()
def report(name, preds):
    out = []
    for yr in (2024, 2025):
        te, pr = preds[yr]; w, n, roi = gbest(te, pr, 1.75); out.append(f"{yr}: MAE {np.abs(pr - te.actual).mean():.2f} r {np.corrcoef(pr, te.actual)[0,1]:+.2f} | bet {100*w if n else np.nan:4.1f}%/{n:3d} ROI {100*roi if n else np.nan:+5.1f}%")
    print(f"  {name:44s} " + " | ".join(out))
print("=" * 118); print("COMPLETIONS — universal vs per-quarterback regressions (walk-forward, 12 factors)"); print("=" * 118)
res = {}
for lam_p in (5, 20, 60):
    U, P, M, PR, LO = {}, {}, {}, {}, {}
    for yr in (2024, 2025):
        tr, te = d[d.season < yr].copy(), d[d.season == yr].copy(); te = te.sort_values("week")
        pu, wu, _ = zfit(tr, te, FAC, "actual", 60); U[yr] = (te, pu); LO[yr] = (te, te.close_line.values)
        # per-QB own slopes, expanding within the test season too (his played games this season join the training as they happen)
        pp = pu.copy(); prr = pu.copy()
        for i, (idx, r) in enumerate(te.iterrows()):
            his = pd.concat([tr[tr.qb == r.qb], te[(te.qb == r.qb) & (te.week < r.week)]])
            if len(his) >= 12:
                p1, _, _ = zfit(his, te.loc[[idx]], FAC, "actual", lam_p); pp[i] = p1[0]
                his2 = his.assign(res=his.actual - his.close_line); p2, _, _ = zfit(his2, te.loc[[idx]], [c for c in FAC if c != "close_line"], "res", lam_p); prr[i] = r.close_line + p2[0]
        P[yr] = (te, pp); PR[yr] = (te, prr)
        # mixed: universal + QB x factor interactions for QBs with >= 12 training games (shrunk harder)
        qbs = [q for q, n in tr.qb.value_counts().items() if n >= 12]; Xtr, Xte = tr[FAC].copy(), te[FAC].copy()
        for q in qbs:
            for f in FAC:
                Xtr[f"{q}|{f}"] = tr[f] * (tr.qb == q); Xte[f"{q}|{f}"] = te[f] * (te.qb == q)
        cols = list(Xtr.columns); Xtr["actual"] = tr.actual.values; Xte["actual"] = te.actual.values
        pm, _, _ = zfit(Xtr, Xte, cols, "actual", 60 * (1 + lam_p / 20)); M[yr] = (te, pm)
    if lam_p == 5: report("line only", LO); report("U  universal ridge (12 factors)", U)
    report(f"P  per-QB own slopes (λ={lam_p})", P); report(f"PR per-QB residual-vs-line slopes (λ={lam_p})", PR); report(f"M  mixed: league slope + QB deviation (λ={lam_p})", M)
    res[lam_p] = (P, PR, M)
print("\n  (per-QB fits fall back to the universal prediction when a QB has < 12 prior games)")
print("\n" + "=" * 118); print("PER-QUARTERBACK SLOPES — standardized (completions per 1 sd of the factor), fit on all his games 2023-25 (λ=20), vs the league slope"); print("=" * 118)
X = d[FAC].values.astype(float); mu, sd = X.mean(0), X.std(0); sd[sd == 0] = 1; wl = ridge((X - mu) / sd, d.actual.values.astype(float), 60)
top = d.qb.value_counts().head(10).index.tolist()
print(f"  {'factor':16s} | {'LEAGUE':>7s} | " + " | ".join(f"{q[:9]:>9s}" for q in top))
rows = {}
for q in top:
    x = d[d.qb == q]; rows[q] = ridge((x[FAC].values.astype(float) - mu) / sd, x.actual.values.astype(float), 20)
for i, f in enumerate(FAC):
    print(f"  {f:16s} | {wl[i]:+7.2f} | " + " | ".join(f"{rows[q][i]:+9.2f}" for q in top))
print(f"  {'games':16s} | {len(d):7d} | " + " | ".join(f"{int((d.qb == q).sum()):9d}" for q in top))
print("\n  read: a QB whose slope on a factor differs from the league by more than ~0.5 completions/sd, on 40+ games, is a real individual tendency; on 20 games it is mostly noise.")
# stability of the per-QB slopes: split his games odd/even weeks and correlate the two slope vectors
print("\n  SPLIT-HALF STABILITY of per-QB slopes (odd vs even games, QBs with 30+ games): correlation of the two slope vectors per factor")
big = [q for q, n in d.qb.value_counts().items() if n >= 30]; A, B = [], []
for q in big:
    x = d[d.qb == q].sort_values(["season","week"]); o, e = x.iloc[::2], x.iloc[1::2]
    A.append(ridge((o[FAC].values.astype(float) - mu) / sd, o.actual.values.astype(float), 20)[:-1]); B.append(ridge((e[FAC].values.astype(float) - mu) / sd, e.actual.values.astype(float), 20)[:-1])
A, B = np.array(A), np.array(B)
for i, f in enumerate(FAC): print(f"    {f:16s} r(odd, even) across {len(big)} QBs = {np.corrcoef(A[:, i], B[:, i])[0,1]:+.2f}")
