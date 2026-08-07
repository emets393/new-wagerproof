"""Backtest the CFB early-season carryover (weeks 1-3), A/B vs the cold baseline.

A = COLD: model_games as-is (wk1 features null -> model collapses to the mean)
B = FILLED: cfb_early_carryover applied to weeks 1-3 of EVERY season (train + eval consistently)
Model: HistGBR (random_state=0) on the 33 team-stems x home/away + week, walk-forward by season
(train < S, eval S weeks 1-3), targets margin + total. Graded at the CLOSE, per-season, sigma,
complements via both sides, sign convention asserted. Seasons 2018-2025 (2017 first usable prior).
"""
import sys
import numpy as np
import pandas as pd
from pathlib import Path
from sklearn.ensemble import HistGradientBoostingRegressor

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "nfl-extreme-outcomes"))
from sign_conventions import assert_ats_sane
from cfb_early_carryover import fill_early, team_feature_stems

DATA = Path(__file__).resolve().parent / "data"
DEC = 1.909
HP = dict(max_depth=3, learning_rate=0.05, max_iter=300, min_samples_leaf=40,
          l2_regularization=2.0, random_state=0)

base = pd.read_parquet(DATA / "model_games.parquet")
base = base[base.homePoints.notna() & base.spread_close.notna() & base.total_close.notna()].copy()
base["margin"] = base.homePoints - base.awayPoints
base["actual_total"] = base.homePoints + base.awayPoints
base["ats_h"] = base.margin + base.spread_close
assert_ats_sane(base, "ats_h", base.spread_close < 0, label="cfb-early-bt")

stems = team_feature_stems(base.columns)
FEATS = [f"{s}_{x}" for s in ("home", "away") for x in stems] + ["week"]

filled = base.copy()
for S in sorted(filled.season.unique()):
    fill_early(filled, S)
print(f"[setup] {len(base)} games | {len(stems)} stems | filled all seasons' wk1-3")


def wf_early(frame, target):
    pr = pd.Series(np.nan, index=frame.index)
    for S in range(2018, 2026):
        tr = frame[frame.season < S].dropna(subset=FEATS, how="all")
        te = frame[(frame.season == S) & (frame.week <= 3)]
        if len(tr) < 800 or len(te) == 0:
            continue
        mdl = HistGradientBoostingRegressor(**HP).fit(tr[FEATS], tr[target])
        pr.loc[te.index] = mdl.predict(te[FEATS])
    return pr


def report(e, pred, mktline, actual, ats=False, label=""):
    ev = e[e[pred].notna()].copy()
    print(f"\n--- {label} (n={len(ev)}) ---")
    print(f"  pred std={ev[pred].std():.2f} (market {ev[mktline].std():.2f}) | "
          f"corr(pred, market)={np.corrcoef(ev[pred], ev[mktline])[0,1]:+.3f} | "
          f"MAE pred={np.abs(ev[pred]-ev[actual]).mean():.2f} vs market={np.abs(ev[mktline]-ev[actual]).mean():.2f}")
    ev["edge"] = ev[pred] - ev[mktline]
    ev = ev[ev[actual] != ev[mktline]]
    for qq in (0.65, 0.8):
        thr = ev.edge.abs().quantile(qq)
        for side, isov in [(("COVER" if ats else "OVER"), True), (("FADE" if ats else "UNDER"), False)]:
            d = ev[ev.edge >= thr] if isov else ev[ev.edge <= -thr]
            if len(d) < 40:
                print(f"    p{int(qq*100)} {side:6}: n={len(d)} thin"); continue
            win = (d[actual] > d[mktline]).values if isov else (d[actual] < d[mktline]).values
            n = len(d); wr = win.mean() * 100
            roi = (win.mean() * DEC - 1) * 100
            sg = 100 * np.sqrt(win.mean() * (1 - win.mean())) * DEC / np.sqrt(n)
            by = d.groupby("season").apply(lambda x: ((x[actual] > x[mktline]).mean() if isov
                                                      else (x[actual] < x[mktline]).mean()))
            print(f"    p{int(qq*100)} {side:6}: n={n:4d} win={wr:5.1f}% ROI={roi:+6.1f} sig={sg:4.1f} "
                  f"seasons {(by>=0.5).sum()}/{by.notna().sum()}")


for cfgname, frame in (("A-COLD", base), ("B-FILLED", filled)):
    fr = frame.copy()
    fr["line_margin"] = -fr.spread_close
    fr["pm"] = wf_early(fr, "margin")
    fr["pt"] = wf_early(fr, "actual_total")
    e = fr[(fr.week <= 3) & fr.pm.notna()]
    print("\n" + "=" * 96)
    print(f"CONFIG {cfgname} — weeks 1-3, walk-forward 2018-2025, graded at the close")
    print("=" * 96)
    report(e, "pm", "line_margin", "margin", ats=True, label=f"{cfgname} SPREAD (margin)")
    report(e, "pt", "total_close", "actual_total", ats=False, label=f"{cfgname} TOTAL")
