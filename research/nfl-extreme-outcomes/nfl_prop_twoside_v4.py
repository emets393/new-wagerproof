"""v4 — recover the OVER side (RESEARCH ONLY). Three approaches, all PER-MARKET feature sets
(each market keeps its own ablation-chosen groups from nfl_prop_chosen_v3.json — not one shared FEATS):

  1) QUANTILE BANDS: fit q35/q65 walk-forward. Bet OVER only when the PESSIMISTIC band (q35) still
     clears the line; UNDER only when the optimistic band (q65) is under it. Respects asymmetric
     residuals instead of a symmetric point-edge.
  2) OVER-PROBABILITY CLASSIFIER: target = (actual > close_line), line in features, walk-forward
     within 2024-25 (lines only exist there). Bet a side when p exceeds that side's price-implied
     breakeven (need) + margin — a symmetric, price-aware two-sided rule.
  3) PRICE-AWARE EV SPLIT: the regression edge cells re-graded split by the price actually taken
     (plus-money vs juiced) — win%-first grading buries over pockets at +odds.

Guardrails: both sides vs own unconditional, need from 1/decimal, per-season, sigma, dose-response.
"""
import json
import numpy as np
import pandas as pd
from pathlib import Path
from sklearn.ensemble import HistGradientBoostingRegressor, HistGradientBoostingClassifier
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
def feats_for(mkt):  # per-market data set (the ablation's winners for THIS market)
    return CORE + [c for g in chosen[mkt] for c in G[g]]
RS = dict(random_state=0)
HPR = dict(max_depth=4, learning_rate=0.05, max_iter=400, min_samples_leaf=40, l2_regularization=1.0)


def sig(pw, n, dec=1.909):
    return 100 * np.sqrt(pw * (1 - pw)) * dec / np.sqrt(n) if n else 0


def cell(s, is_over, min_n=30):
    s = s[s.actual != s.close_line]
    if len(s) < min_n:
        return None
    win = (s.actual > s.close_line).values if is_over else (s.actual < s.close_line).values
    px = (s.over_px if is_over else s.under_px).values
    n = len(s); wr = win.mean() * 100
    roi = np.nanmean(np.where(win, amer_profit(px), -1.0)) * 100
    need = np.nanmean(1 / (1 + amer_profit(px))) * 100
    by = [((((s[s.season == y].actual > s[s.season == y].close_line) if is_over
            else (s[s.season == y].actual < s[s.season == y].close_line)).mean()) * 100)
          for y in (2024, 2025) if len(s[s.season == y])]
    return dict(n=n, wr=wr, roi=roi, need=need, sig=sig(win.mean(), n), by=by)


def prnt(mkt, app, side, lbl, r, extra=""):
    if not r:
        return False
    ok = (r["roi"] > 0 and len(r["by"]) == 2 and min(r["by"]) >= 50 and r["wr"] > r["need"] and r["roi"] > r["sig"])
    if ok or r["roi"] > 2:
        print(f"  {mkt:20} {app:9} {side:5} {lbl:14} n={r['n']:4d} win={r['wr']:5.1f}% need={r['need']:4.1f} "
              f"ROI={r['roi']:+6.1f} sig={r['sig']:4.1f} yr={['%.0f' % x for x in r['by']]}{'  <== KEEP' if ok else ''}{extra}")
    return ok


# ---------- 1) QUANTILE BANDS ----------------------------------------------------------------
print("=" * 108)
print("1) QUANTILE BANDS (q35/q65, per-market features) — OVER when q35>line, UNDER when q65<line")
print("=" * 108)
for mkt in MKTS:
    m = p[p.market == mkt].dropna(subset=["actual", "team_spread"]).copy()
    F = feats_for(mkt)
    m["t"] = m.season * 100 + m.week
    q35 = pd.Series(np.nan, index=m.index); q65 = pd.Series(np.nan, index=m.index)
    for t in sorted(m[m.season.isin([2024, 2025])].t.unique()):
        tr, te = m[m.t < t], m[m.t == t]
        if len(tr) < 500 or len(te) == 0:
            continue
        lo = HistGradientBoostingRegressor(loss="quantile", quantile=0.35, **HPR, **RS).fit(tr[F], tr.actual)
        hi = HistGradientBoostingRegressor(loss="quantile", quantile=0.65, **HPR, **RS).fit(tr[F], tr.actual)
        q35.loc[te.index] = lo.predict(te[F]); q65.loc[te.index] = hi.predict(te[F])
    m["q35"], m["q65"] = q35, q65
    e = m[m.q35.notna() & m.close_line.notna()].copy()
    for mrg_lbl, mrg in [("band>line", 0.0), ("band>line+3%", 0.03)]:
        ov = e[e.q35 > e.close_line * (1 + mrg)]
        un = e[e.q65 < e.close_line * (1 - mrg)]
        prnt(mkt, "QUANT", "OVER", mrg_lbl, cell(ov, True))
        prnt(mkt, "QUANT", "UNDER", mrg_lbl, cell(un, False))

# ---------- 2) OVER-PROBABILITY CLASSIFIER ---------------------------------------------------
print("\n" + "=" * 108)
print("2) OVER-PROB CLASSIFIER (target = actual>line, line in features; price-aware p>need+margin)")
print("=" * 108)
for mkt in MKTS:
    m = p[p.market == mkt].dropna(subset=["actual", "team_spread", "close_line"]).copy()
    m = m[m.actual != m.close_line]
    F = feats_for(mkt) + ["close_line"]
    m["y"] = (m.actual > m.close_line).astype(int)
    m["t"] = m.season * 100 + m.week
    pov = pd.Series(np.nan, index=m.index)
    for t in sorted(m[m.season.isin([2024, 2025])].t.unique()):
        tr, te = m[m.t < t], m[m.t == t]
        if len(tr) < 300 or len(te) == 0:
            continue
        clf = HistGradientBoostingClassifier(max_depth=3, learning_rate=0.05, max_iter=300,
                                             min_samples_leaf=40, l2_regularization=1.0, **RS).fit(tr[F], tr.y)
        pov.loc[te.index] = clf.predict_proba(te[F])[:, 1]
    m["pov"] = pov
    e = m[m.pov.notna()].copy()
    e["need_o"] = 1 / (1 + amer_profit(e.over_px.values))
    e["need_u"] = 1 / (1 + amer_profit(e.under_px.values))
    for mrg in (0.02, 0.05):
        ov = e[e.pov >= e.need_o + mrg]
        un = e[(1 - e.pov) >= e.need_u + mrg]
        prnt(mkt, "CLASS", "OVER", f"p>need+{int(mrg*100)}%", cell(ov, True))
        prnt(mkt, "CLASS", "UNDER", f"p>need+{int(mrg*100)}%", cell(un, False))

# ---------- 3) PRICE-AWARE EV SPLIT on the regression edges ----------------------------------
print("\n" + "=" * 108)
print("3) PRICE SPLIT — regression OVER edges by price actually taken (plus-money vs juiced)")
print("=" * 108)
for mkt in MKTS:
    m = p[p.market == mkt].dropna(subset=["actual", "team_spread"]).copy()
    F = feats_for(mkt)
    m["t"] = m.season * 100 + m.week
    pr = pd.Series(np.nan, index=m.index)
    for t in sorted(m[m.season.isin([2024, 2025])].t.unique()):
        tr, te = m[m.t < t], m[m.t == t]
        if len(tr) < 500 or len(te) == 0:
            continue
        pr.loc[te.index] = HistGradientBoostingRegressor(**HPR, **RS).fit(tr[F], tr.actual).predict(te[F])
    m["pred"] = pr
    e = m[m.pred.notna() & m.close_line.notna()].copy()
    e["edge"] = e.pred - e.close_line
    thr = e.edge.abs().quantile(0.65)
    ov = e[e.edge >= thr]
    prnt(mkt, "PRICE", "OVER", "plus-money", cell(ov[ov.over_px >= 100], True, min_n=25))
    prnt(mkt, "PRICE", "OVER", "juiced", cell(ov[ov.over_px < 100], True, min_n=25))
print("\ndone.")
