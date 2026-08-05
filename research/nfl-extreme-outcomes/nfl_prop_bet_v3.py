"""Stage 2 — per-market best-feature bet model + per-side/per-threshold sweep (RESEARCH ONLY).
Uses the ablation's per-market helpful groups (nfl_prop_chosen_v3.json). Two configs per market:
NOLINE (independent model opinion vs the line = v1-style edge source) and LINE (+close_line = NBA-style).
Walk-forward 2024-25; grade each side at multiple edge thresholds with guardrails: win% AND need,
gap vs the side's OWN unconditional rate, ROI, one sigma, per-season. Prints the positive cells.
"""
import json
import numpy as np
import pandas as pd
from pathlib import Path
from sklearn.ensemble import HistGradientBoostingRegressor
from attempts_model import OFF, DEF, amer_profit

DATA = Path(__file__).resolve().parent / "data"
p = pd.read_parquet(DATA / "nfl_prop_v3_panel.parquet")
chosen = json.loads((DATA / "nfl_prop_chosen_v3.json").read_text())
MKTS = list(chosen)
G = {"OFF": OFF, "DEF": DEF, "POS": ["opp_pos_allow_s2d", "opp_pos_allow_l5", "opp_pos_allow_l3", "opp_pos_vol_s2d"],
     "TM": [c for c in p.columns if c.startswith("tm_")], "MAD": ["own_madden_ovr"],
     "USAGE": [f"{b}_{w}" for b in ("tgt_share", "carry_share", "att_share") for w in ("s2d", "l5", "l3")],
     "SNAP": ["snap_pct_s2d", "snap_pct_l5", "snap_pct_l3"], "LINE": ["close_line"]}
CORE = ["l3", "l5", "szn", "team_spread", "total", "is_home"]
HP = dict(max_depth=4, learning_rate=0.05, max_iter=400, min_samples_leaf=40, l2_regularization=1.0)


def wf(m, feats):
    m = m.copy(); m["t"] = m.season * 100 + m.week; pr = pd.Series(np.nan, index=m.index)
    for t in sorted(m[m.season.isin([2024, 2025])].t.unique()):
        tr, te = m[m.t < t], m[m.t == t]
        if len(tr) < 500 or len(te) == 0:
            continue
        pr.loc[te.index] = HistGradientBoostingRegressor(**HP).fit(tr[feats], tr.actual).predict(te[feats])
    m["pred"] = pr
    return m[m.pred.notna() & m.close_line.notna()]


def sig(pw, n, dec=1.909):
    return 100 * np.sqrt(pw * (1 - pw)) * dec / np.sqrt(n) if n else 0


def cell(s, is_over):
    s = s[s.actual != s.close_line]
    if len(s) < 30:
        return None
    win = (s.actual > s.close_line).values if is_over else (s.actual < s.close_line).values
    px = (s.over_px if is_over else s.under_px).values
    n = len(s); wr = win.mean() * 100; roi = np.nanmean(np.where(win, amer_profit(px), -1.0)) * 100
    need = np.nanmean(1 / (1 + amer_profit(px))) * 100
    by = [((((s[s.season == y].actual > s[s.season == y].close_line) if is_over
            else (s[s.season == y].actual < s[s.season == y].close_line)).mean()) * 100) for y in (2024, 2025)
          if len(s[s.season == y])]
    return dict(n=n, wr=wr, roi=roi, need=need, sig=sig(win.mean(), n), by=by)


print("=" * 104)
print("STAGE 2 — per-market bet sweep with the ablation's helpful features. POSITIVE cells only.")
print("(cell = ROI>0 AND both seasons>=50% AND win-need>0 AND ROI>sigma)")
print("=" * 104)
keepers = []
for mkt in MKTS:
    m0 = p[p.market == mkt].dropna(subset=["actual", "team_spread"])
    feats_help = CORE + [c for g in chosen[mkt] for c in G[g]]
    for cfgname, feats in [("NOLINE", feats_help), ("LINE", feats_help + ["close_line"])]:
        e = wf(m0, feats).copy()
        if not len(e):
            continue
        e["edge"] = e.pred - e.close_line
        e["ep"] = e.edge / e.close_line.replace(0, np.nan)
        base_over = ((e[e.actual != e.close_line].actual > e[e.actual != e.close_line].close_line).mean()) * 100
        for q in (0.5, 0.65, 0.8):
            thr = e.edge.abs().quantile(q)
            for side, is_over, unc in [("OVER", True, base_over), ("UNDER", False, 100 - base_over)]:
                sub = e[e.edge >= thr] if is_over else e[e.edge <= -thr]
                r = cell(sub, is_over)
                if not r:
                    continue
                ok = (r["roi"] > 0 and len(r["by"]) == 2 and min(r["by"]) >= 50
                      and r["wr"] - unc > 0 and r["roi"] > r["sig"])
                tag = "  <== KEEP" if ok else ""
                if ok or r["roi"] > 3:
                    print(f"{mkt:20} {cfgname:6} {side:5} p{int(q*100)} n={r['n']:4d} win={r['wr']:5.1f}% "
                          f"unc={unc:4.1f} need={r['need']:4.1f} gap={r['wr']-unc:+5.1f} ROI={r['roi']:+6.1f} "
                          f"sig={r['sig']:4.1f} yr={['%.0f'%x for x in r['by']]}{tag}")
                if ok:
                    keepers.append((mkt, cfgname, side, int(q * 100), r))
print(f"\n=== {len(keepers)} KEEPER cells (positive, both-seasons, beats sigma) ===")
for mkt, cfg, side, q, r in keepers:
    print(f"  {mkt} {cfg} {side} p{q}: {r['wr']:.1f}% ROI{r['roi']:+.1f} n={r['n']} yr={['%.0f'%x for x in r['by']]}")
