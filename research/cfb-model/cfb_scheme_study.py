"""CFB scheme study (RESEARCH ONLY) — port of the NFL formations/scheme program, adapted honestly:
college has NO coverage/formation charting (no man/zone, 2-high, box), so scheme = TENDENCY
IDENTITIES from model_games.parquet (opponent-adjusted, as-of, leak-safe, 2016-2025): pace,
pass lean, explosiveness off/allowed (rush/pass splits), EPA off/allowed, havoc (f7/db),
line yards. Already-settled ground NOT re-run: archetype ATS grid (DEAD, 0/66), S-CFB1
offense-underperformance UNDER (VALIDATED + wired), pace->total model feature (VALIDATED).

NEW here (never run for CFB):
  PART 1 — #99-style INCREMENT-OVER-CLOSE: predict actual total/margin from [close line] vs
           [line + BOTH teams' tendency identities]. NFL verdict was "priced"; CFB market is
           softer (style signals persist here) so this is a genuine question.
  PART 2 — continuous interaction battery (complements + dose): explosive O vs explosive-
           suppressing D; havoc D vs weak-trench O; run-heavy O vs elite run D.
Grade at close, weeks 4+ (as-of populated), per-season, sigma, CFB sign convention asserted
(spread_close is HOME-PERSPECTIVE: <0 = home favored; home covers iff margin + spread_close > 0).
"""
import sys
import numpy as np
import pandas as pd
from pathlib import Path
from sklearn.ensemble import HistGradientBoostingRegressor

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "nfl-extreme-outcomes"))
from sign_conventions import assert_ats_sane

DATA = Path(__file__).resolve().parent / "data"
DECN = 1.909
HP = dict(max_depth=3, learning_rate=0.05, max_iter=300, min_samples_leaf=40,
          l2_regularization=2.0, random_state=0)

m = pd.read_parquet(DATA / "model_games.parquet")
m = m[m.homePoints.notna() & m.awayPoints.notna() & m.spread_close.notna() & m.total_close.notna()].copy()
m = m[(m.week >= 4)].copy()
m["margin"] = m.homePoints - m.awayPoints
m["actual_total"] = m.homePoints + m.awayPoints
m["ats_h"] = m.margin + m.spread_close            # CFB slate convention: <0 spread = home favored
assert_ats_sane(m, "ats_h", m.spread_close < 0, label="cfb-slate")

FAMS = ["pace_off_plays", "pass_rate", "adj_epa", "adj_epa_allowed", "adj_rushing_epa",
        "adj_rushing_epa_allowed", "adj_passing_epa", "adj_passing_epa_allowed",
        "adj_explosiveness", "adj_explosiveness_allowed", "adj_pass_explosiveness",
        "adj_pass_explosiveness_allowed", "adj_rush_explosiveness", "adj_rush_explosiveness_allowed",
        "adj_success", "adj_success_allowed", "off_havoc", "def_havoc", "def_havoc_f7",
        "def_havoc_db", "adj_line_yards", "adj_line_yards_allowed"]
SCH = [f"{s}_{f}" for s in ("home", "away") for f in FAMS if f"{s}_{f}" in m.columns]
print(f"[frame] {len(m)} games wk4+ | scheme cols used: {len(SCH)} | seasons {sorted(m.season.unique())}")


def wf(frame, feats, target):
    pr = pd.Series(np.nan, index=frame.index)
    for S in sorted(frame.season.unique()):
        tr, te = frame[frame.season < S], frame[frame.season == S]
        if len(tr) < 800 or len(te) == 0:
            continue
        pr.loc[te.index] = HistGradientBoostingRegressor(**HP).fit(tr[feats], tr[target]).predict(te[feats])
    return pr


def bet_cells(e, pred, line, actual, name):
    e = e.copy()
    e["edge"] = e[pred] - e[line]
    e = e[e[actual] != e[line]]
    for qq in (0.65, 0.8):
        thr = e.edge.abs().quantile(qq)
        for side, isov in [("OVER/COVER", True), ("UNDER/FADE", False)]:
            d = e[e.edge >= thr] if isov else e[e.edge <= -thr]
            if len(d) < 40:
                print(f"    {name} p{int(qq*100)} {side:11}: n={len(d)} thin"); continue
            win = (d[actual] > d[line]).values if isov else (d[actual] < d[line]).values
            n = len(d); wr = win.mean() * 100
            roi = (win.mean() * DECN - 1) * 100
            sg = 100 * np.sqrt(win.mean() * (1 - win.mean())) * DECN / np.sqrt(n)
            by = d.groupby("season").apply(
                lambda x: ((x[actual] > x[line]).mean() if isov else (x[actual] < x[line]).mean()))
            print(f"    {name} p{int(qq*100)} {side:11}: n={n:4d} win={wr:5.1f}% ROI={roi:+6.1f} "
                  f"sig={sg:4.1f} seasons {(by>=0.5).sum()}/{by.notna().sum()}")


print("\n" + "=" * 100)
print("PART 1a — FG TOTAL increment over the close (A=line-only vs B=line+scheme identities)")
print("=" * 100)
m["pA"] = wf(m, ["total_close", "week"], "actual_total")
m["pB"] = wf(m, ["total_close", "week"] + SCH, "actual_total")
ev = m[m.pA.notna() & m.pB.notna()]
maeL = np.abs(ev.total_close - ev.actual_total).mean()
maeA = np.abs(ev.pA - ev.actual_total).mean(); maeB = np.abs(ev.pB - ev.actual_total).mean()
print(f"  n={len(ev)} | line MAE={maeL:.3f} | A={maeA:.3f} | B(+scheme)={maeB:.3f} | "
      f"increment {maeB-maeA:+.3f} {'HELPS' if maeB < maeA else '(no gain)'}")
bet_cells(ev, "pB", "total_close", "actual_total", "total+scheme")

print("\n" + "=" * 100)
print("PART 1b — FG SPREAD (margin) increment over the close")
print("=" * 100)
m["line_margin"] = -m.spread_close                 # market-implied home margin
m["pAm"] = wf(m, ["line_margin", "week"], "margin")
m["pBm"] = wf(m, ["line_margin", "week"] + SCH, "margin")
ev = m[m.pAm.notna() & m.pBm.notna()]
maeL = np.abs(ev.line_margin - ev.margin).mean()
maeA = np.abs(ev.pAm - ev.margin).mean(); maeB = np.abs(ev.pBm - ev.margin).mean()
print(f"  n={len(ev)} | line MAE={maeL:.3f} | A={maeA:.3f} | B(+scheme)={maeB:.3f} | "
      f"increment {maeB-maeA:+.3f} {'HELPS' if maeB < maeA else '(no gain)'}")
bet_cells(ev, "pBm", "line_margin", "margin", "margin+scheme")

print("\n" + "=" * 100)
print("PART 2 — continuous interaction battery (ATS from the OFFENSE team's perspective + totals)")
print("=" * 100)
rows = []
for _, r in m.iterrows():
    for side, opp in (("home", "away"), ("away", "home")):
        rows.append(dict(
            season=r.season, week=r.week,
            ats=(r.ats_h if side == "home" else -r.ats_h),
            over=np.nan if r.actual_total == r.total_close else float(r.actual_total > r.total_close),
            o_pass_ex=r.get(f"{side}_adj_pass_explosiveness"), o_pass_rate=r.get(f"{side}_pass_rate"),
            o_line=r.get(f"{side}_adj_line_yards"), o_rush_epa=r.get(f"{side}_adj_rushing_epa"),
            d_ex_all=r.get(f"{opp}_adj_explosiveness_allowed"), d_havoc=r.get(f"{opp}_def_havoc"),
            d_rush_epa_all=r.get(f"{opp}_adj_rushing_epa_allowed")))
t = pd.DataFrame(rows)
t["cover"] = np.where(t.ats == 0, np.nan, (t.ats > 0).astype(float))
for c in ["o_pass_ex", "o_pass_rate", "o_line", "o_rush_epa", "d_ex_all", "d_havoc", "d_rush_epa_all"]:
    t[f"{c}_q"] = t.groupby("season")[c].transform(lambda s: s.rank(pct=True))


def cell(d, col, want_true, lbl):
    d = d.dropna(subset=[col])
    if len(d) < 60:
        print(f"    {lbl:52} n={len(d)} (thin)"); return
    p = d[col].mean() if want_true else 1 - d[col].mean()
    roi = (p * DECN - 1) * 100
    sg = 100 * np.sqrt(p * (1 - p)) * DECN / np.sqrt(len(d))
    by = d.groupby("season")[col].apply(lambda x: (x.mean() if want_true else 1 - x.mean()))
    print(f"    {lbl:52} n={len(d):4d} hit={p*100:5.1f}% ROI={roi:+6.1f} sig={sg:4.1f} "
          f"seasons {(by>=0.5).sum()}/{by.notna().sum()}")


print("  C1 explosive-pass offense vs explosiveness-SUPPRESSING defense (d_ex_all bottom-25% = best):")
h = t[(t.o_pass_ex_q >= 0.75) & (t.d_ex_all_q <= 0.25)]
cell(h, "over", False, "UNDER the total")
cell(h, "cover", False, "FADE the explosive offense ATS")
print("    complement (explosive O vs LEAKY-explosive D, top-25% allowed):")
c = t[(t.o_pass_ex_q >= 0.75) & (t.d_ex_all_q >= 0.75)]
cell(c, "over", True, "OVER the total")
cell(c, "cover", True, "BACK the offense ATS")
print("  C2 havoc-heavy defense vs weak-trench offense (o_line bottom-25%):")
h = t[(t.d_havoc_q >= 0.75) & (t.o_line_q <= 0.25)]
cell(h, "cover", False, "FADE the weak-trench offense ATS")
cell(h, "over", False, "UNDER the total")
print("    complement (havoc D vs ELITE-trench O):")
c = t[(t.d_havoc_q >= 0.75) & (t.o_line_q >= 0.75)]
cell(c, "cover", False, "FADE the offense ATS (should shrink/flip)")
print("  C3 run-heavy offense (pass_rate bottom-25%) vs elite run defense (d_rush_epa_all bottom-25%):")
h = t[(t.o_pass_rate_q <= 0.25) & (t.d_rush_epa_all_q <= 0.25)]
cell(h, "cover", False, "FADE the run-heavy offense ATS")
cell(h, "over", False, "UNDER the total")
print("    complement (run-heavy O vs WORST run D):")
c = t[(t.o_pass_rate_q <= 0.25) & (t.d_rush_epa_all_q >= 0.75)]
cell(c, "cover", True, "BACK the run-heavy offense ATS")
