"""PRE-REGISTERED CONFIRMATION — early-carryover fill vs the LOCKED wk4+ production numbers.

The carryover (cfb_early_carryover.py) is vault-validated on weeks 1-3 (MAE 17.60->15.15,
corr .445->.782, cfb_early_backtest.py) but was left UNWIRED because filling model_games
changes the training distribution of the FROZEN pkls. This is the missing gate before the
refreeze: does training on a frame whose wk1-3 rows are filled DEGRADE the locked wk4+
performance?

Registered BEFORE running (2026-09-03):
  GATE 2a: sides |side_edge_open|>=4 hit% vs OPEN, weeks>=4, folds 2021-25 — FILLED must be
           within 1.0pp of COLD pooled (locked reference ~54.7%), no single season -3pp.
  GATE 2b: totals over-edge>=6 hit% vs OPEN, weeks>=4 — same bands.
  GATE 2c: wk4+ margin/total MAE within 0.05 of COLD.
  REF:     wk1-3 MAE/corr must reproduce the direction of the vault result (better, not worse).
  ORACLE:  feeding actual_margin as the prediction must grade ~100%.

Uses the PRODUCTION loader (cfb_forecast.load: feats + A2 nets + QB labels) and the
PRODUCTION hyperparameters. Walk-forward: train < S (all weeks), eval S.
"""
import numpy as np
import pandas as pd
import warnings
warnings.filterwarnings("ignore")
from sklearn.ensemble import HistGradientBoostingRegressor

import cfb_forecast as CF
from cfb_early_carryover import fill_early

HP = dict(max_iter=300, learning_rate=0.05, max_depth=4, l2_regularization=1.0, random_state=0)
FOLDS = [2021, 2022, 2023, 2024, 2025]


def build(filled: bool):
    gm, feats, nets = CF.load()
    gm = gm[gm.season.notna()].copy()
    if filled:
        for S in sorted(gm.season.unique()):
            try:
                fill_early(gm, int(S))
            except Exception as e:
                print(f"  [fill warn] {S}: {e}")
    return gm, feats, feats + nets


def run(label, filled):
    gm, feats, sfeats = build(filled)
    ev = []
    for S in FOLDS:
        tr = gm[(gm.season < S) & gm.actual_total.notna()]
        te = gm[(gm.season == S) & gm.actual_total.notna()].copy()
        tm = HistGradientBoostingRegressor(**HP).fit(tr[feats], tr.actual_total)
        sm = HistGradientBoostingRegressor(**HP).fit(tr[sfeats], tr.actual_margin)
        te["pred_total"] = tm.predict(te[feats])
        te["pred_margin"] = sm.predict(te[sfeats])
        ev.append(te)
    e = pd.concat(ev)
    e["total_edge"] = e.pred_total - e.total_open
    e["side_edge"] = e.pred_margin + e.spread_open
    e["ats_open"] = e.actual_margin + e.spread_open
    e["ou_open"] = e.actual_total - e.total_open

    # oracle: actual margin as prediction must grade ~100%
    orc = e[e.ats_open != 0]
    orc_hit = ((np.sign(orc.actual_margin + orc.spread_open) > 0) == (orc.ats_open > 0)).mean()
    assert orc_hit > 0.99, f"ORACLE FAILED {orc_hit:.3f}"

    late = e[e.week >= 4]
    early = e[e.week <= 3]
    print(f"\n===== {label} =====")

    # GATE 2c — MAE wk4+
    print(f"wk4+  MAE margin={np.abs(late.pred_margin - late.actual_margin).mean():.3f}"
          f"  total={np.abs(late.pred_total - late.actual_total).mean():.3f}")
    print(f"wk1-3 MAE margin={np.abs(early.pred_margin - early.actual_margin).mean():.3f}"
          f"  total={np.abs(early.pred_total - early.actual_total).mean():.3f}"
          f"  | corr(pred_margin, -spread) wk1-3="
          f"{np.corrcoef(early.pred_margin, -early.spread_open)[0, 1]:+.3f}")

    # GATE 2a — sides gate>=4 wk4+
    g4 = late[(late.side_edge.abs() >= 4) & (late.ats_open != 0)]
    hit = ((g4.side_edge > 0) == (g4.ats_open > 0)).mean()
    print(f"SIDES gate>=4 wk4+: n={len(g4)} hit={hit*100:.1f}%")
    for S in FOLDS:
        s = g4[g4.season == S]
        h = ((s.side_edge > 0) == (s.ats_open > 0)).mean() if len(s) else float("nan")
        print(f"    {S}: n={len(s):4d} hit={h*100:5.1f}%")

    # GATE 2b — totals over-edge>=6 wk4+
    t6 = late[(late.total_edge >= 6) & (late.ou_open != 0)]
    thit = (t6.ou_open > 0).mean()
    u6 = late[(late.total_edge <= -6) & (late.ou_open != 0)]
    uhit = (u6.ou_open < 0).mean()
    print(f"TOTALS over-edge>=6 wk4+: n={len(t6)} hit={thit*100:.1f}%  |  under-edge<=-6: n={len(u6)} hit={uhit*100:.1f}%")
    return dict(g4n=len(g4), g4hit=hit, t6n=len(t6), t6hit=thit, u6n=len(u6), u6hit=uhit,
                mae_m=np.abs(late.pred_margin - late.actual_margin).mean(),
                mae_t=np.abs(late.pred_total - late.actual_total).mean())


if __name__ == "__main__":
    cold = run("A-COLD (production as-is)", filled=False)
    fill = run("B-FILLED (carryover wk1-3, all seasons)", filled=True)
    print("\n===== GATES =====")
    d_hit = (fill["g4hit"] - cold["g4hit"]) * 100
    d_t = (fill["t6hit"] - cold["t6hit"]) * 100
    d_u = (fill["u6hit"] - cold["u6hit"]) * 100
    print(f"GATE 2a sides gate4 delta: {d_hit:+.2f}pp ({'PASS' if abs(d_hit) <= 1.0 or d_hit > 0 else 'FAIL'})")
    print(f"GATE 2b totals over delta: {d_t:+.2f}pp / under delta {d_u:+.2f}pp"
          f" ({'PASS' if (abs(d_t) <= 1.0 or d_t > 0) and (abs(d_u) <= 1.0 or d_u > 0) else 'FAIL'})")
    print(f"GATE 2c wk4+ MAE delta: margin {fill['mae_m']-cold['mae_m']:+.3f} total {fill['mae_t']-cold['mae_t']:+.3f}"
          f" ({'PASS' if fill['mae_m']-cold['mae_m'] <= 0.05 and fill['mae_t']-cold['mae_t'] <= 0.05 else 'FAIL'})")
