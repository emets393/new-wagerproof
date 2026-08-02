"""Grade the NFL prop-model v2 decomposition — RESEARCH ONLY.
Loads the cached v2 panel and runs the a/b/c decomposition with the NBA grading guardrails:
  (a) current model (BASE_FEATS)   (b) + close_line   (c) + close_line + attached context
Reports: PRODUCT test (paired MAE model vs line, ALL rows), decomposition ROI (top-25% edge / best
price), per-market bet table (win% AND need, both sides vs own unconditional rate), the LINE-SCALE
ladder (need & gap slopes vs line), per-season, one sigma per cell, and an ORACLE grader check.
"""
import numpy as np
import pandas as pd
from pathlib import Path
from sklearn.ensemble import HistGradientBoostingRegressor
from attempts_model import FEATS as BASE_FEATS, amer_profit

DATA = Path(__file__).resolve().parent / "data"
MKTS = ["player_pass_yds", "player_pass_tds", "player_receptions", "player_reception_yds",
        "player_rush_yds", "player_pass_attempts", "player_rush_attempts", "player_pass_completions"]
HP = dict(max_depth=4, learning_rate=0.05, max_iter=400, min_samples_leaf=40, l2_regularization=1.0)

p = pd.read_parquet(DATA / "nfl_prop_v2_panel.parquet")
POS = ["opp_pos_allow_s2d", "opp_pos_allow_l5", "opp_pos_allow_l3", "opp_pos_vol_s2d"]
TM = [c for c in p.columns if c.startswith("tm_")]
# NGS EXCLUDED: the own_*_s2d NGS family produced an implausible 75% top-edge win with only a ~5% MAE
# gain (ablation localized it) — fails the too-good-and-unexplained bar; needs a separate leak audit
# of the upstream ngs build before use. Clean context = positional-allowed + team-matchup + madden.
CTX = POS + TM + ["own_madden_ovr"]
CFG = {"a_base": BASE_FEATS, "b_line": BASE_FEATS + ["close_line"], "c_full": BASE_FEATS + ["close_line"] + CTX}


def wf(m, feats):
    m = m.copy(); m["t"] = m.season * 100 + m.week
    pred = pd.Series(np.nan, index=m.index)
    for t in sorted(m[m.season.isin([2024, 2025])].t.unique()):
        tr, te = m[m.t < t], m[m.t == t]
        if len(tr) < 500 or len(te) == 0:
            continue
        mdl = HistGradientBoostingRegressor(**HP).fit(tr[feats], tr.actual)
        pred.loc[te.index] = mdl.predict(te[feats])
    m["pred"] = pred
    return m[m.pred.notna()]


def sigma(pw, n, dec=1.909):
    return 100 * np.sqrt(pw * (1 - pw)) * dec / np.sqrt(n) if n else 0.0


def roi_side(s, is_over):
    """ROI for one side at the taken price; win vs the close line."""
    s = s[s.actual != s.close_line]
    if not len(s):
        return None
    win = (s.actual > s.close_line).values if is_over else (s.actual < s.close_line).values
    px = (s.over_px if is_over else s.under_px).values
    prof = np.where(win, amer_profit(px), -1.0)
    n = len(s); wr = win.mean(); roi = np.nanmean(prof) * 100
    need = np.nanmean(1.0 / (1.0 + amer_profit(px))) * 100   # breakeven prob = 1/decimal from taken price
    dec = np.nanmean(1 + amer_profit(px))
    return dict(n=n, wr=wr * 100, roi=roi, need=need, sig=sigma(wr, n, dec))


# ---- eval frames per market per config -------------------------------------------------------
E = {}
for mkt in MKTS:
    m0 = p[p.market == mkt].dropna(subset=["actual", "team_spread", "close_line"])
    E[mkt] = {cfg: wf(m0, feats) for cfg, feats in CFG.items()}

print("=" * 100)
print("PRODUCT TEST — paired per-row MAE, model vs the posted line, EVERY eval row (unfiltered)")
print("=" * 100)
print(f"{'market':22} {'n':>5} {'lineMAE':>8} {'a_base':>8} {'b_line':>8} {'c_full':>8}   beats-line?")
prod = {}
for mkt in MKTS:
    row = {}
    e = E[mkt]["a_base"]
    ml = np.abs(e.close_line - e.actual).mean()
    for cfg in CFG:
        ec = E[mkt][cfg]
        row[cfg] = np.abs(ec.pred - ec.actual).mean()
    prod[mkt] = (len(e), ml, row)
    beats = ",".join(c for c in CFG if row[c] < ml)
    print(f"{mkt:22} {len(e):>5} {ml:>8.2f} {row['a_base']:>8.2f} {row['b_line']:>8.2f} {row['c_full']:>8.2f}   {beats or 'none'}")

print("\n" + "=" * 100)
print("DECOMPOSITION — ROI at top-25% |edge| / best price (which fix mattered), pooled + per season")
print("=" * 100)
print(f"{'config':8} {'n':>5} {'ROI%':>7} {'win%':>6} {'need%':>6} {'gap':>6} {'sigma':>6}  seasons(24/25)")
for cfg in CFG:
    allrows = []
    for mkt in MKTS:
        e = E[mkt][cfg].copy()
        e["edge"] = e.pred - e.close_line
        thr = e.edge.abs().quantile(0.75)
        bet = e[e.edge.abs() >= thr]
        allrows.append(bet)
    b = pd.concat(allrows, ignore_index=True)
    b["is_over"] = b.edge > 0
    ov = roi_side(b[b.is_over], True); un = roi_side(b[~b.is_over], False)
    n = (ov["n"] if ov else 0) + (un["n"] if un else 0)
    win = ((ov["wr"] * ov["n"] if ov else 0) + (un["wr"] * un["n"] if un else 0)) / n
    need = ((ov["need"] * ov["n"] if ov else 0) + (un["need"] * un["n"] if un else 0)) / n
    roi = ((ov["roi"] * ov["n"] if ov else 0) + (un["roi"] * un["n"] if un else 0)) / n
    persea = []
    for y in (2024, 2025):
        by = b[b.season == y]
        o, u = roi_side(by[by.is_over], True), roi_side(by[~by.is_over], False)
        ny = (o["n"] if o else 0) + (u["n"] if u else 0)
        ry = (((o["roi"] * o["n"] if o else 0) + (u["roi"] * u["n"] if u else 0)) / ny) if ny else 0
        persea.append(f"{y}:{ry:+.0f}")
    print(f"{cfg:8} {n:>5} {roi:>+7.1f} {win:>6.1f} {need:>6.1f} {win-need:>+6.1f} {sigma(win/100,n):>6.1f}  {' '.join(persea)}")

print("\n" + "=" * 100)
print("PER-MARKET bet table (c_full, top-25% |edge|) — each side's win% vs its OWN unconditional rate")
print("=" * 100)
print(f"{'market':22} {'side':5} {'n':>4} {'win%':>6} {'uncond':>7} {'need':>6} {'gapVsUnc':>8} {'ROI%':>7} {'sig':>5}  seasons(24/25)")
for mkt in MKTS:
    e = E[mkt]["c_full"].copy(); e["edge"] = e.pred - e.close_line
    thr = e.edge.abs().quantile(0.75); bet = e[e.edge.abs() >= thr]
    base_over = (e[e.actual != e.close_line].actual > e[e.actual != e.close_line].close_line).mean() * 100
    for side_lbl, is_over, unc in [("OVER", True, base_over), ("UNDER", False, 100 - base_over)]:
        sub = bet[bet.edge > 0] if is_over else bet[bet.edge < 0]
        r = roi_side(sub, is_over)
        if not r:
            print(f"{mkt:22} {side_lbl:5} n<12"); continue
        ps = []
        for y in (2024, 2025):
            ry = roi_side(sub[sub.season == y], is_over)
            ps.append(f"{y}:{ry['wr']:.0f}%" if ry else f"{y}:-")
        print(f"{mkt:22} {side_lbl:5} {r['n']:>4} {r['wr']:>6.1f} {unc:>7.1f} {r['need']:>6.1f} "
              f"{r['wr']-unc:>+8.1f} {r['roi']:>+7.1f} {r['sig']:>5.1f}  {' '.join(ps)}")

print("\n" + "=" * 100)
print("LINE-SCALE LADDER — by posted line bucket, NO edge filter (need & gap slopes vs line)")
print("=" * 100)
for mkt in MKTS:
    e = E[mkt]["c_full"].copy()
    e = e[e.actual != e.close_line]
    if len(e) < 120:
        print(f"\n{mkt}: n={len(e)} (thin)"); continue
    e["q"] = pd.qcut(e.close_line, 4, duplicates="drop")
    print(f"\n{mkt} (n={len(e)}):  line-bucket   n   over%   need%   gap    ROIover  ROIunder")
    mids, needs, gaps = [], [], []
    for q, d in e.groupby("q", observed=True):
        ov = roi_side(d, True); un = roi_side(d, False)
        if not ov:
            continue
        mid = (q.left + q.right) / 2
        mids.append(mid); needs.append(ov["need"]); gaps.append(ov["wr"] - ov["need"])
        print(f"    {str(q):>16} {ov['n']:>4} {ov['wr']:>6.1f} {ov['need']:>6.1f} {ov['wr']-ov['need']:>+6.1f} "
              f"{ov['roi']:>+8.1f} {un['roi']:>+8.1f}")
    if len(mids) >= 3:
        sn = np.polyfit(mids, needs, 1)[0]; sg = np.polyfit(mids, gaps, 1)[0]
        print(f"    slope(need vs line)={sn:+.3f}  slope(gap vs line)={sg:+.3f}")

# ---- ORACLE grader check --------------------------------------------------------------------
e = E["player_reception_yds"]["c_full"].copy()
e["pred"] = e.actual                              # perfect foresight
e["edge"] = e.pred - e.close_line
orc = e[e.edge.abs() >= e.edge.abs().quantile(0.75)]
oo = roi_side(orc[orc.edge > 0], True); ou = roi_side(orc[orc.edge < 0], False)
owr = ((oo["wr"] * oo["n"] if oo else 0) + (ou["wr"] * ou["n"] if ou else 0)) / ((oo["n"] if oo else 0) + (ou["n"] if ou else 1))
print(f"\n[ORACLE] feed realised stat into the bet rule -> win% = {owr:.1f}% (must be ~100; guards an inverted leg)")
assert owr > 98, f"GRADER BUG: oracle win% = {owr:.1f}%"
print("[ORACLE] passed.")
