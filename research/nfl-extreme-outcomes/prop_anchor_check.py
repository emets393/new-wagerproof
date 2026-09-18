#!/usr/bin/env python3
"""PROP ANCHOR / LEAK AUDIT (owner 2026-09-17: "how do we know the props are even real?").
The exact battery that just killed the power ratings, run on the three CONFIRMED prop specs:
  1. STRUCTURE   feature line == grade line? (close_line both) — and is close pregame? (T-60 rule)
  2. ORACLE      pred := actual must grade ~100%  (grader sanity)
  3. PLACEBO     training target shuffled, 20 draws — real spec must beat ~all of them
  4. LEAK SCREEN each feature |corr actual| vs |corr close_line| on TRAINING rows
  5. ANCHOR A/B  close-fed vs close (reported) | OPEN-fed vs open (if we post early) | open-fed vs close
  6. MOVEMENT    do the wins live where the line moved open->close?  (the power-ratings tell)
  7. LINE-ONLY   model with only market context (no FP data) — what does the FP data add?
"""
import io, contextlib, importlib.util as iu
import numpy as np, pandas as pd
spec = iu.spec_from_file_location("pe", "prop_engine.py"); PE = iu.module_from_spec(spec)
with contextlib.redirect_stdout(io.StringIO()): spec.loader.exec_module(PE)
panel, SETS, ridge, MKT_CTX = PE.panel, PE.SETS, PE.ridge, PE.MKT_CTX
rng = np.random.default_rng(0)

def fit(d, F, lam, target="actual", line_col="close_line", shuffle=False):
    preds = []
    for ssn in (2024, 2025):
        tr, te = d[d.season < ssn], d[d.season == ssn].copy()
        Fk = [c for c in F if tr[c].std() > 1e-9]
        X = tr[Fk].values.astype(float); m, s = X.mean(0), X.std(0); s[s == 0] = 1
        y = tr[target].values.astype(float)
        if shuffle: y = rng.permutation(y)
        w = ridge((X - m) / s, y, lam)
        te["pred"] = np.hstack([(te[Fk].values.astype(float) - m) / s, np.ones((len(te), 1))]) @ w
        preds.append(te)
    pr = pd.concat(preds); pr["edge"] = pr.pred - pr[line_col]; return pr

def grade(pr, thr, line_col="close_line"):
    pk = pr.edge >= thr; m = (pr.edge.abs() >= thr) & (pr.actual != pr[line_col])
    w = np.where(pk, pr.actual > pr[line_col], pr.actual < pr[line_col])[m.values]
    return w.mean(), int(m.sum()), w

for mkt, pos, lam, thr, fs, tier, note in PE.SPECS:
    if tier != "CONFIRMED": continue
    d = panel[(panel.market == mkt) & panel.position.isin(pos)].copy()
    d = d[(d.week >= 4) & d.close_line.notna() & (d.close_line > 0) & d.actual.notna()]
    F0 = fs if fs is not None else SETS[mkt]
    F = [c for c in dict.fromkeys(F0) if c in d.columns and d[c].notna().mean() > 0.35]
    d[F] = d[F].apply(lambda s: s.fillna(s.median())).fillna(0)
    print("\n" + "=" * 100); print(f"{mkt} [{'+'.join(pos)}]  lam={lam} thr={thr}   n={len(d)}  feats={len(F)}"); print("=" * 100)
    # 1 structure
    print(f"  1 STRUCTURE  fed close_line as feature: {'close_line' in F};  graded vs close_line: yes;  "
          f"open_line coverage {d.open_line.notna().mean():.0%}; |close-open| mean {(d.close_line-d.open_line).abs().mean():.2f}")
    # 2 oracle
    o = d.copy(); o["pred"] = o.actual; o["edge"] = o.pred - o.close_line
    p, n, _ = grade(o, thr); print(f"  2 ORACLE     pred=actual grades {100*p:.1f}% (n={n})  {'OK' if p > .99 else '!! GRADER BROKEN'}")
    # 5A real
    pr = fit(d, F, lam); pA, nA, wA = grade(pr, thr)
    by = "/".join(f"{100*grade(pr[pr.season==s], thr)[0]:.1f}" for s in (2024, 2025))
    print(f"  5A REAL      close-fed, vs CLOSE: {100*pA:.1f}% n={nA}  [{by}]   OVER {100*wA[(pr.edge>=thr)[(pr.edge.abs()>=thr)&(pr.actual!=pr.close_line)].values].mean():.1f}% / UNDER {100*wA[~(pr.edge>=thr)[(pr.edge.abs()>=thr)&(pr.actual!=pr.close_line)].values].mean():.1f}%")
    # 3 placebo
    pl = []
    for i in range(20):
        pp = fit(d, F, lam, shuffle=True); pl.append(grade(pp, thr)[0])
    pl = np.array(pl); print(f"  3 PLACEBO    20 shuffled-target fits at thr{thr}: mean {100*pl.mean():.1f}%  max {100*pl.max():.1f}%  -> real beats {100*(pA>pl).mean():.0f}% of placebos")
    # 4 leak screen on training rows (2023 only, the lined training season)
    tr = d[d.season == 2023]; flags = []
    for c in F:
        if c in ("close_line",) or tr[c].std() < 1e-9: continue
        ca, cl = abs(tr[c].corr(tr.actual)), abs(tr[c].corr(tr.close_line))
        if ca > cl * 1.25 and ca > 0.05: flags.append((c, ca, cl))
    print(f"  4 LEAK       features with |corr actual| > 1.25x |corr line| on 2023 training rows: {len(flags)}" +
          ("".join(f"\n               {c:28s} actual {ca:.3f} line {cl:.3f}" for c, ca, cl in flags[:8])))
    # 5C open-fed vs open; 5D open-fed vs close
    do = d[d.open_line.notna() & (d.open_line > 0)].copy(); do["close_line_true"] = do.close_line
    do2 = do.copy(); do2["close_line"] = do2.open_line
    pC = fit(do2, F, lam, line_col="close_line"); pC["open_line"] = pC.close_line; pC["close_line"] = pC.close_line_true
    pC["edge"] = pC.pred - pC.open_line
    c1, n1, _ = grade(pC, thr, "open_line"); c1b = "/".join(f"{100*grade(pC[pC.season==s], thr, 'open_line')[0]:.1f}" for s in (2024, 2025))
    pC["edge"] = pC.pred - pC.close_line; c2, n2, _ = grade(pC, thr, "close_line")
    prc = fit(do, F, lam); prc["edge"] = prc.pred - prc.open_line; c3, n3, _ = grade(prc, thr, "open_line")
    print(f"  5C OPEN-fed, vs OPEN: {100*c1:.1f}% n={n1} [{c1b}]   5D OPEN-fed, vs CLOSE: {100*c2:.1f}% n={n2}   close-fed vs OPEN: {100*c3:.1f}% n={n3}")
    # 6 movement split on the real (close-fed vs close) plays
    x = pr[pr.open_line.notna()].copy(); x["mv"] = x.close_line - x.open_line
    sel = (x.edge.abs() >= thr) & (x.actual != x.close_line); x = x[sel]
    won = np.where(x.edge >= thr, x.actual > x.close_line, x.actual < x.close_line)
    toward = np.sign(x.mv) == np.sign(x.edge)      # line moved TOWARD the model's side (market agreed)
    still = x.mv == 0
    for lab, m in (("line did not move", still), ("moved toward model side", toward & ~still), ("moved AGAINST model side", ~toward & ~still)):
        if m.sum() >= 15: print(f"  6 MOVEMENT   {lab:26s} {100*won[m.values].mean():.1f}% n={int(m.sum())}")
    nm = [0.0]; nm_no = won[~still.values].mean() if (~still).sum() else np.nan
    print(f"               no-model check: bet the OPEN toward the close (|move|>0): " +
          f"{100*np.where(x.mv>0, x.actual>x.open_line, x.actual<x.open_line)[(~still).values & (x.actual!=x.open_line).values].mean():.1f}%")
    # 7 line-only baseline
    pl_only = fit(d, [c for c in MKT_CTX if c in F], lam); p7, n7, _ = grade(pl_only, thr)
    print(f"  7 LINE-ONLY  market-context-only model (no FP data) at thr{thr}: {100*p7:.1f}% n={n7}   vs full {100*pA:.1f}% n={nA}")
