"""Full edge matrix — every market x both sides x edge-magnitude buckets (RESEARCH ONLY).
"When the model predicts THIS much over/under the line, it was right THIS often at THIS ROI."
Point-estimate walk-forward per market with that market's ablation-chosen feature set; edge buckets
by |edge| quantile within (market, side), printing the REAL edge range each bucket covers.
Guardrails: win% next to need (price-implied breakeven), per-season, sigma. Caches predictions.
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
     "SNAP": ["snap_pct_s2d", "snap_pct_l5", "snap_pct_l3"]}
CORE = ["l3", "l5", "szn", "team_spread", "total", "is_home"]
HPR = dict(max_depth=4, learning_rate=0.05, max_iter=400, min_samples_leaf=40, l2_regularization=1.0,
           random_state=0)
CACHE = DATA / "nfl_prop_edge_preds.parquet"


def preds():
    if CACHE.exists():
        return pd.read_parquet(CACHE)
    out = []
    for mkt in MKTS:
        m = p[p.market == mkt].dropna(subset=["actual", "team_spread"]).copy()
        F = CORE + [c for g in chosen[mkt] for c in G[g]]
        m["t"] = m.season * 100 + m.week
        pr = pd.Series(np.nan, index=m.index)
        for t in sorted(m[m.season.isin([2024, 2025])].t.unique()):
            tr, te = m[m.t < t], m[m.t == t]
            if len(tr) < 500 or len(te) == 0:
                continue
            pr.loc[te.index] = HistGradientBoostingRegressor(**HPR).fit(tr[F], tr.actual).predict(te[F])
        m["pred"] = pr
        e = m[m.pred.notna() & m.close_line.notna()]
        out.append(e[["season", "week", "player_id", "market", "actual", "close_line",
                      "over_px", "under_px", "pred"]])
    d = pd.concat(out, ignore_index=True)
    d.to_parquet(CACHE, index=False)
    return d


def row(s, is_over):
    s = s[s.actual != s.close_line]
    if len(s) < 25:
        return None
    win = (s.actual > s.close_line).values if is_over else (s.actual < s.close_line).values
    px = (s.over_px if is_over else s.under_px).values
    n = len(s); wr = win.mean() * 100
    roi = np.nanmean(np.where(win, amer_profit(px), -1.0)) * 100
    need = np.nanmean(1 / (1 + amer_profit(px))) * 100
    sg = 100 * np.sqrt(win.mean() * (1 - win.mean())) * 1.909 / np.sqrt(n)
    by = " ".join(f"{y}:{(((s[s.season==y].actual>s[s.season==y].close_line) if is_over else (s[s.season==y].actual<s[s.season==y].close_line)).mean()*100):.0f}%"
                  for y in (2024, 2025) if len(s[s.season == y]) >= 10)
    return n, wr, need, roi, sg, by


d = preds()
d["edge"] = d.pred - d.close_line
print("=" * 112)
print("FULL EDGE MATRIX — per market, per side, by edge magnitude (bucket = |edge| quartile within side)")
print("edge = model prediction minus close line, in the market's own units")
print("=" * 112)
for mkt in MKTS:
    e = d[d.market == mkt]
    print(f"\n### {mkt}  (eval n={len(e)}, unconditional over {((e[e.actual!=e.close_line].actual>e[e.actual!=e.close_line].close_line).mean()*100):.1f}%)")
    print(f"  {'side':6}{'edge range':>18} {'n':>5} {'win%':>6} {'need':>5} {'ROI%':>7} {'sig':>5}  per-season")
    for side, is_over in [("OVER", True), ("UNDER", False)]:
        sub = e[e.edge > 0] if is_over else e[e.edge < 0]
        if len(sub) < 50:
            print(f"  {side:6} (thin)"); continue
        mag = sub.edge.abs()
        qs = mag.quantile([0, 0.25, 0.5, 0.75, 1.0]).values
        labels = [f"{qs[i]:.1f}-{qs[i+1]:.1f}" for i in range(4)]
        sub = sub.assign(bucket=pd.cut(mag, bins=qs, labels=labels, include_lowest=True, duplicates="drop"))
        for lbl in sub.bucket.cat.categories:
            r = row(sub[sub.bucket == lbl], is_over)
            if not r:
                continue
            n, wr, need, roi, sg, by = r
            mark = " *" if (roi > 0 and wr > need) else ""
            print(f"  {side:6}{lbl:>18} {n:>5} {wr:>6.1f} {need:>5.1f} {roi:>+7.1f} {sg:>5.1f}  {by}{mark}")
print("\n(* = win%>need and ROI>0 in that bucket)")
