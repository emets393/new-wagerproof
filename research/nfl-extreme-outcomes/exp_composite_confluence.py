#!/usr/bin/env python3
"""COMPOSITE × MODEL CONFLUENCE at the OPENER (owner, 2026-09-18).  Composite implied margin =
3.15 × gap (exp_composite.py slope). Composite edge = implied margin + open spread (home persp.).
Model = the clean originator harness (walk-forward preds from dose_response.py): classifier side
at conf ≥ .06 and regression edge vs open. Grade vs the OPENER, 2023-25, plus CLV (line moved our way).
Cells: model alone · composite alone · AGREE · DISAGREE, at a few thresholds."""
import io, contextlib, numpy as np, pandas as pd, warnings
warnings.filterwarnings("ignore")
src = open("exp_composite.py").read().split("YRS = ")[0]; ns = {}
with contextlib.redirect_stdout(io.StringIO()): exec(compile(src, "comp", "exec"), ns)
G = ns["G"][["season","week","home_ab","away_ab","gap","open_spread","home_spread","margin"]].copy()
P = pd.read_parquet("data/_dose_response_preds.parquet"); P["home_ab"] = P.home_ab.replace({"LA":"LAR"}); P["away_ab"] = P.away_ab.replace({"LA":"LAR"})
D = G.merge(P[["season","week","home_ab","away_ab","ph","pred_margin"]], on=["season","week","home_ab","away_ab"], how="inner")
D = D[D.open_spread.notna() & D.season.isin([2023, 2024, 2025])].copy()
D["comp_edge"] = 3.15 * D.gap + D.open_spread                 # >0 composite likes HOME vs the opener
D["reg_edge"] = D.pred_margin + D.open_spread                 # >0 model margin likes HOME vs the opener
D["conf"] = (D.ph - 0.5).abs(); D["clf_home"] = D.ph >= 0.5
D["res"] = D.margin + D.open_spread; D["mv"] = D.home_spread - D.open_spread   # <0 = line moved toward home
print(f"{len(D)} games 2023-25 with composite + clean model + opener\n")
def cell(x, pick_home, label):
    x = x[pick_home.notna()]; ph_ = pick_home[x.index].astype(bool); res = x.res; ok = res != 0
    won = np.where(ph_, res > 0, res < 0); clv = np.where(ph_, x.mv < 0, x.mv > 0); moved = x.mv != 0
    out = f"  {label:46s} n={len(x):4d} win {100*won[ok].mean():5.1f}%  line-our-way {100*clv[moved].mean() if moved.sum() else np.nan:4.0f}%"
    per = []
    for yr in (2023, 2024, 2025):
        m = x.season == yr; w = won[(ok & m).values]; per.append(f"{yr} {100*w.mean():4.1f}% n={len(w):3d}" if len(w) else f"{yr}  n/a")
    print(out + "  | " + "  ".join(per))
for ct in (0.5, 1.0, 2.0):
    print(f"--- composite threshold |comp edge| ≥ {ct} pts, model = classifier conf ≥ .06 (as shipped) ---")
    M = D[D.conf >= .06]; C = D[D.comp_edge.abs() >= ct]
    cell(M, M.clf_home, "model alone (conf ≥ .06)")
    cell(C, C.comp_edge > 0, f"composite alone (|edge| ≥ {ct})")
    B = D[(D.conf >= .06) & (D.comp_edge.abs() >= ct)]
    ag = B[(B.clf_home) == (B.comp_edge > 0)]; dis = B[(B.clf_home) != (B.comp_edge > 0)]
    cell(ag, ag.clf_home, "AGREE: model side == composite side")
    cell(dis, dis.clf_home, "DISAGREE, bet the MODEL side")
    cell(dis, dis.comp_edge > 0, "DISAGREE, bet the COMPOSITE side")
    # model below its floor but composite strong: does the composite rescue those?
    L = D[(D.conf < .06) & (D.comp_edge.abs() >= ct)]; cell(L, L.comp_edge > 0, "model under floor, composite alone")
    print()
print("--- regression-margin version: model = |reg edge| ≥ 1.5 (its old confluence gate), composite |edge| ≥ 1 ---")
M = D[D.reg_edge.abs() >= 1.5]; cell(M, M.reg_edge > 0, "regression alone")
B = D[(D.reg_edge.abs() >= 1.5) & (D.comp_edge.abs() >= 1.0)]; ag = B[(B.reg_edge > 0) == (B.comp_edge > 0)]; dis = B[(B.reg_edge > 0) != (B.comp_edge > 0)]
cell(ag, ag.reg_edge > 0, "AGREE"); cell(dis, dis.reg_edge > 0, "DISAGREE, regression side")
print("\n--- triple: classifier conf ≥ .06 AND regression same side AND composite same side (|comp| ≥ 1) ---")
T = D[(D.conf >= .06) & (D.comp_edge.abs() >= 1.0)]; T = T[((T.clf_home) == (T.reg_edge > 0)) & ((T.clf_home) == (T.comp_edge > 0))]; cell(T, T.clf_home, "all three agree")
