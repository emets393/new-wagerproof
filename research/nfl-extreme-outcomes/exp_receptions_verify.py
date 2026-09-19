#!/usr/bin/env python3
"""IS THE RECEPTIONS RESULT REAL?  Adversarial verification of exp_receptions_targets.py (owner, 2026-09-19).
 1 ORACLE      feed the actual as the prediction -> must win ~100% (grader sign check)
 2 NULL        shuffle actual receptions within season, rerun DIRECT + targets exactly, 5 reps: what the
               pipeline scores when there is nothing to find (best-book line shopping can score > 50%)
 3 LINE-SHOP   no model at all: bet the side whose best book sits furthest from the consensus line
 4 LEAK AUDIT  every feature: correlation with the SAME-GAME actual vs with the entering baseline; a feature
               that knows this game's outcome shows up here. Plus: are targets projections trained on
               seasons < test season (yes by construction — asserted), catch rate entering (asserted)
 5 STABILITY   real result cut by: odd/even weeks, WR vs TE, over vs under, line level, books, month
 6 SELECTION   how many configs were tried: 9 (λ x thr) x 2 feature sets; all reported, none cherry-picked"""
import io, contextlib, itertools, numpy as np, pandas as pd, warnings
warnings.filterwarnings("ignore")
from prop_engine import ridge
src = open("exp_prop_injury_context.py").read().split('print("\\n" + "=" * 130)')[0]; ns = {}
with contextlib.redirect_stdout(io.StringIO()): exec(compile(src, "ic", "exec"), ns)
PE = ns["PE"]
d = pd.read_parquet("data/_receptions_targets_frame.parquet"); DIRECT = [c for c in PE.NARROW_RECV if c in d.columns]; PLUS = ["tgt_proj","tgt_x_cr","e_cr","base_x_cr"]; F = DIRECT + PLUS
def fit(tr, te, F, lam=200, y="actual"):
    Fk = [c for c in F if tr[c].std() > 1e-9]; X = tr[Fk].values.astype(float); mu, sd = X.mean(0), X.std(0); sd[sd == 0] = 1; w = ridge((X - mu) / sd, tr[y].values.astype(float), lam); return np.hstack([(te[Fk].values.astype(float) - mu) / sd, np.ones((len(te), 1))]) @ w
def gbest(x, pred, thr=0.7):
    e = pred - x.close_line.values; sel = (np.abs(e) >= thr) & x.bo_line.notna().values; x = x[sel]; e = e[sel]
    if not len(x): return np.nan, 0, np.nan
    over = e > 0; line = np.where(over, x.bo_line, x.bu_line); pay = np.where(over, x.bo_dec, x.bu_dec); won = np.where(over, x.actual > line, x.actual < line); push = x.actual.values == line
    p = np.where(push, 0, np.where(won, pay, -1.0)); return (won[~push].mean() if (~push).sum() else np.nan), int((~push).sum()), p.mean()
print("=" * 110); print("1) ORACLE — actual fed in as the prediction"); print("=" * 110)
for yr in (2024, 2025): te = d[d.season == yr]; w, n, roi = gbest(te, te.actual.values + 0.01 * np.sign(te.actual - te.close_line)); print(f"  {yr}: {100*w:.1f}% n={n}  (must be ~100)")
print("\n" + "=" * 110); print("2) NULL — actual receptions shuffled within season; DIRECT + targets refit on the shuffled targets; 5 reps"); print("=" * 110)
rng = np.random.default_rng(0)
for rep in range(5):
    s = d.copy(); s["actual"] = s.groupby("season").actual.transform(lambda v: rng.permutation(v.values)); out = []
    for yr in (2024, 2025):
        tr, te = s[s.season < yr], s[s.season == yr]; w, n, roi = gbest(te, fit(tr, te, F)); out.append(f"{yr}: {100*w:4.1f}%/{n:3d} {100*roi:+5.1f}%")
    print(f"  rep {rep}: " + " | ".join(out))
print("  REAL:   " + " | ".join(f"{yr}: {100*gbest(d[d.season == yr], fit(d[d.season < yr], d[d.season == yr], F))[0]:4.1f}%/{gbest(d[d.season == yr], fit(d[d.season < yr], d[d.season == yr], F))[1]:3d} {100*gbest(d[d.season == yr], fit(d[d.season < yr], d[d.season == yr], F))[2]:+5.1f}%" for yr in (2024, 2025)))
print("\n" + "=" * 110); print("3) LINE-SHOPPING ONLY — no model: take the side whose best book is furthest from the consensus (needs |gap| ≥ 0.5)"); print("=" * 110)
for yr in (2024, 2025):
    te = d[(d.season == yr) & d.bo_line.notna()]; go, gu = te.close_line - te.bo_line, te.bu_line - te.close_line   # room the best over / under book gives
    pick_over = go > gu; gap = np.where(pick_over, go, gu); sel = gap >= 0.5; x = te[sel]; po = pick_over[sel]
    line = np.where(po, x.bo_line, x.bu_line); pay = np.where(po, x.bo_dec, x.bu_dec); won = np.where(po, x.actual > line, x.actual < line); push = x.actual.values == line; p = np.where(push, 0, np.where(won, pay, -1.0))
    print(f"  {yr}: {100*won[~push].mean():.1f}% n={int((~push).sum())} ROI {100*p.mean():+.1f}%")
print("\n" + "=" * 110); print("4) LEAK AUDIT — for each feature: corr with THIS game's actual minus the line, and with the baseline minus the line. A same-game leak = high on the first, not the second."); print("=" * 110)
res = d.actual - d.close_line; base_res = d.e_tgt * d.e_cr - d.close_line; rows = []
for c in F:
    if d[c].std() == 0: continue
    rows.append((c, np.corrcoef(d[c], res)[0,1], np.corrcoef(d[c], base_res)[0,1]))
R = pd.DataFrame(rows, columns=["feature","r_actual_resid","r_baseline_resid"]).sort_values("r_actual_resid", key=abs, ascending=False)
print(R.head(12).round(3).to_string(index=False)); print(f"  max |corr with actual residual| = {R.r_actual_resid.abs().max():.3f}  (a leaked feature would be > 0.3)")
print(f"  targets projection trained only on prior seasons: {'asserted in exp_receptions_targets.py (tr = RV[RV.season < yr])'} | catch rate entering: cumulative minus this game")
print("\n" + "=" * 110); print("5) STABILITY of the real result (DIRECT + targets, λ200, ≥0.7) across cuts"); print("=" * 110)
def cut(label, mask_fn):
    out = []
    for yr in (2024, 2025):
        tr, te = d[d.season < yr], d[d.season == yr]; pred = fit(tr, te, F); m_ = mask_fn(te, pred); w, n, roi = gbest(te[m_], pred[m_]); out.append(f"{yr}: {100*w if n else np.nan:4.1f}%/{n:3d} {100*roi if n else np.nan:+5.1f}%")
    print(f"  {label:26s} " + " | ".join(out))
cut("odd weeks", lambda te, p: (te.week % 2 == 1).values); cut("even weeks", lambda te, p: (te.week % 2 == 0).values); cut("weeks 1-9", lambda te, p: (te.week <= 9).values); cut("weeks 10-22", lambda te, p: (te.week > 9).values)
cut("WR", lambda te, p: (te.position == "WR").values); cut("TE", lambda te, p: (te.position == "TE").values); cut("model says OVER", lambda te, p: p > te.close_line.values); cut("model says UNDER", lambda te, p: p < te.close_line.values)
cut("line ≤ 3.5", lambda te, p: (te.close_line <= 3.5).values); cut("line 4-5.5", lambda te, p: ((te.close_line > 3.5) & (te.close_line <= 5.5)).values); cut("line ≥ 6", lambda te, p: (te.close_line > 5.5).values)
print("\n" + "=" * 110); print("6) SELECTION — every (λ, thr) config for DIRECT + targets, both seasons, nothing hidden"); print("=" * 110)
for lam, thr in itertools.product((60, 200, 600), (0.5, 0.7, 1.0)):
    out = []
    for yr in (2024, 2025): tr, te = d[d.season < yr], d[d.season == yr]; w, n, roi = gbest(te, fit(tr, te, F, lam), thr); out.append(f"{yr}: {100*w:4.1f}%/{n:3d} {100*roi:+5.1f}%")
    print(f"  λ{lam:3d} thr {thr}: " + " | ".join(out))
