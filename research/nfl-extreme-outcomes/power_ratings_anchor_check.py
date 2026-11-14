#!/usr/bin/env python3
"""ANCHOR CHECK — is the vs-opener edge the model's, or the closing line's? (2026-09-17)

The frozen spec anchors on the CLOSE (close_line, total, mkt_pts at T-60) and is graded vs the
OPENER. In production the pick is posted into the opener, before the close exists — so the
historical grade lets the model "know" where the line ended up. The 2025 gap split showed it:
plays where the model's own view beat the close by >=2 went 42%; plays where the gap was the
close moving went 69.5%.

Honest settings, all walk-forward, same FINAL feature set:
  A  close-anchored, graded vs OPEN   (what was reported)
  B  close-anchored, graded vs CLOSE  (the model's own opinion vs the market it saw)
  C  OPEN-anchored,  graded vs OPEN   (what production would actually do)
  D  OPEN-anchored,  graded vs CLOSE  (does an open-anchored model predict the move = CLV?)
"""
import io, contextlib, importlib.util as iu
import numpy as np
import pandas as pd

spec = iu.spec_from_file_location("pm", "power_ratings_modulators.py"); PM = iu.module_from_spec(spec)
with contextlib.redirect_stdout(io.StringIO()):
    spec.loader.exec_module(PM)
Q, O, FINAL, TEST = PM.Q.copy(), PM.O, PM.FINAL, PM.TEST

# odds_consensus starts in 2023; build 2021-22 openers from the raw snapshots with build_odds.py's
# rule (each book's earliest snap, median across books, snapped to the half point)
C2A = PM.PS.M.C2A
h = pd.read_parquet("data/odds_hist.parquet", columns=["season", "snap_ts", "home_team", "away_team", "book", "spread_home", "total_point"])
h = h[h.season.isin([2021, 2022])]
h["home_ab"] = h.home_team.map(C2A); h["away_ab"] = h.away_team.map(C2A)
h = h.dropna(subset=["home_ab", "away_ab"]).sort_values("snap_ts")
first = h.drop_duplicates(["season", "home_ab", "away_ab", "book"], keep="first")
_half = lambda v: np.round(v * 2) / 2
O21 = first.groupby(["season", "home_ab", "away_ab"]).agg(open_spread=("spread_home", "median"), open_total=("total_point", "median")).reset_index()
O21["open_spread"], O21["open_total"] = _half(O21.open_spread), _half(O21.open_total)
OO = pd.concat([O21, O[["season", "home_ab", "away_ab", "open_spread", "open_total"]]], ignore_index=True)
print(f"openers per season: {OO.groupby('season').size().to_dict()}")
# opener in each team-row's perspective (betting notation: negative = that team favored)
Oh = OO.rename(columns={"home_ab": "team", "away_ab": "opp"}); Oh["open_cl"] = Oh.open_spread; Oh["home"] = 1
Oa = OO.rename(columns={"away_ab": "team", "home_ab": "opp"}); Oa["open_cl"] = -Oa.open_spread; Oa["home"] = 0
Q = Q.merge(pd.concat([Oh, Oa])[["season", "team", "opp", "home", "open_cl", "open_total"]].rename(columns={"open_total": "open_tot_t"}),
            on=["season", "team", "opp", "home"], how="left")
Q = Q[Q.open_cl.notna() & Q.open_tot_t.notna()].copy()
Q["open_mkt_pts"] = Q.open_tot_t / 2 - Q.open_cl / 2
Q["close_cl_true"], Q["close_total_true"] = Q.close_line, Q.total
Qo = Q.copy(); Qo["close_line"], Qo["total"], Qo["mkt_pts"] = Qo.open_cl, Qo.open_tot_t, Qo.open_mkt_pts
print(f"games with an opener: {Q.game_id.nunique()} (of {PM.Q.game_id.nunique()})")


def grade(G, label, line, tot):
    """line/tot: column names on the HOME row giving the reference spread (home betting notation) and total."""
    G = G.copy(); G["ref"] = -G[line]; G["e2"] = G.pm - G.ref; G["te2"] = G.pt_cal - G[tot]
    G["won"] = np.where(G.e2 > 0, (G.margin - G.ref) > 0, (G.margin - G.ref) < 0); G["push"] = (G.margin - G.ref) == 0
    G["twon"] = np.where(G.te2 > 0, G.tot_act > G[tot], G.tot_act < G[tot]); G["tpush"] = G.tot_act == G[tot]
    out = f"  {label:34s}"
    for thr in (2, 3):
        d = G[(G.e2.abs() >= thr) & ~G.push]; u = (d.won * 0.909 - (~d.won)).sum()
        out += f" SP>={thr} {100*d.won.mean():5.1f}% n={len(d):3d} {u:+6.1f}u |"
    d = G[(G.te2.abs() >= 3) & ~G.tpush]; u = (d.twon * 0.909 - (~d.twon)).sum()
    out += f" TO>=3 {100*d.twon.mean():5.1f}% n={len(d):3d} {u:+6.1f}u |"
    d = G[(G.e2.abs() >= 2) & ~G.push]
    out += " by yr " + "/".join(f"{100*d[d.season==s].won.mean():.0f}" for s in TEST)
    print(out)


print("\n" + "=" * 118)
print("SPREADS / TOTALS by anchor and grading line   (SP = spreads at |gap|>=2 / >=3, TO = calibrated totals at |gap|>=3)")
print("=" * 118)
GA = PM.fit(FINAL, frame=Q)          # close-anchored; PM.fit merges O -> open_spread/open_total on the home row
GA["close_home"] = GA.close_cl_true; GA["close_tot"] = GA.close_total_true
grade(GA, "A close-anchored, vs OPEN", "open_spread", "open_total")
grade(GA, "B close-anchored, vs CLOSE", "close_home", "close_tot")
GC = PM.fit(FINAL, frame=Qo)
GC["close_home"] = GC.close_cl_true; GC["close_tot"] = GC.close_total_true
grade(GC, "C OPEN-anchored, vs OPEN", "open_spread", "open_total")
grade(GC, "D OPEN-anchored, vs CLOSE", "close_home", "close_tot")

GA.to_parquet("data/fpdata/_power_G_close_anchored.parquet", index=False)
GC.to_parquet("data/fpdata/_power_G_open_anchored.parquet", index=False)
# the weather modulator was found on A — does it exist on the honest fit?
sit = PM.sit[["game_id", "dome"]]
for lab, GG in (("A close-anchored", GA), ("C OPEN-anchored", GC)):
    g = GG.merge(sit, on="game_id", how="left", suffixes=("", "_s")); dcol = "dome" if "dome" in g.columns and g.dome.notna().any() else "dome_s"
    for tier, m in (("outdoor", g[dcol] == 0), ("dome", g[dcol] == 1)):
        d = g[m & (g.te.abs() >= 3) & ~g.to_push]
        print(f"  {lab} totals >=3 vs OPEN, {tier:7s}: {100*d.to_won.mean():5.1f}% n={len(d):3d}")

# the pure-market baseline: bet the opener in the direction the close moved (no model at all)
G0 = GA.copy(); G0["mv"] = (-G0.close_home) - (-G0.open_spread)
d = G0[(G0.mv.abs() >= 1) & ((G0.margin + G0.open_spread) != 0)]
w = np.where(d.mv > 0, (d.margin + d.open_spread) > 0, (d.margin + d.open_spread) < 0)
print(f"\n  NO MODEL — bet the opener toward where the close ended up (|move|>=1): {100*w.mean():.1f}% n={len(d)}  "
      + "by yr " + "/".join(f"{100*w[(d.season==s).values].mean():.0f}" for s in TEST))
d = G0[(G0.mv.abs() >= 2) & ((G0.margin + G0.open_spread) != 0)]
w = np.where(d.mv > 0, (d.margin + d.open_spread) > 0, (d.margin + d.open_spread) < 0)
print(f"  NO MODEL — same, |move|>=2: {100*w.mean():.1f}% n={len(d)}")
# how much of A's play set is explained by movement: A plays where own-view (model - close) agrees & >=2
GA["own"] = GA.pm - (-GA.close_home); GA["e_open"] = GA.pm - (-GA.open_spread)
own = GA[(GA.e_open.abs() >= 2) & (np.sign(GA.own) == np.sign(GA.e_open)) & (GA.own.abs() >= 2) & ~((GA.margin + GA.open_spread) == 0)]
mv = GA[(GA.e_open.abs() >= 2) & ~((np.sign(GA.own) == np.sign(GA.e_open)) & (GA.own.abs() >= 2)) & ~((GA.margin + GA.open_spread) == 0)]
for lab, d in (("A plays where model ALSO beats close >=2 same way", own), ("A plays where gap is mostly the close moving", mv)):
    w = np.where(d.e_open > 0, (d.margin + d.open_spread) > 0, (d.margin + d.open_spread) < 0)
    print(f"  {lab:52s} {100*w.mean():5.1f}% n={len(d):3d}  by yr " + "/".join(f"{100*w[(d.season==s).values].mean():.0f}" for s in TEST))
