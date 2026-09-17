#!/usr/bin/env python3
"""Signal x new-model confluence (owner 2026-09-17): for each historical NFL
signal pick (forecast_ledger 2023-25), does the v4/v5 composite model AGREE on
the side? Accuracy when aligned vs opposed vs model-neutral."""
import glob
import numpy as np
import pandas as pd

# build model predictions (v5 base = v4 matchup engine)
exec(open("exp_fp_v5_base.py").read())
own = pr.set_index(["game_id", "team"]).pred
pr["pm"] = pr.pred - own.reindex(pd.MultiIndex.from_arrays([pr.game_id, pr.opp])).values
pr["pt"] = pr.pred + own.reindex(pd.MultiIndex.from_arrays([pr.game_id, pr.opp])).values
gg = pr.drop_duplicates("game_id").copy()
# per-game: home-perspective spread edge and total edge
gm = g.set_index("game_id")
gg["home_ab"] = gm.reindex(gg.game_id).home_team.values
gg["away_ab"] = gm.reindex(gg.game_id).away_team.values
# gg rows are one perspective; align to HOME perspective
gg["home_line"] = np.where(gg.team == gg.home_ab, gg.line, -gg.line)
gg["home_pm"] = np.where(gg.team == gg.home_ab, gg.pm, -gg.pm)
gg["sp_edge_home"] = gg.home_pm - (-gg.home_line)     # + = model likes HOME to cover
gg["tot_edge"] = gg.pt - gg.total                      # + = model likes OVER
model = gg[["season", "week", "home_ab", "away_ab", "sp_edge_home", "tot_edge"]].drop_duplicates()

led = pd.concat([pd.read_csv(f) for f in glob.glob("out/forecast_ledger_202[345].csv")])
led = led[led.win.notna() & led.side.notna()].copy()
led = led.merge(model, on=["season", "week", "home_ab", "away_ab"], how="inner")

# does the model agree with the signal's side?
def agree(row):
    m = str(row.market)
    if m == "spread":
        # signal side: bet_home==1 -> home; model likes home if sp_edge_home>0
        sig_home = row.bet_home == 1
        model_home = row.sp_edge_home > 0
        strong = abs(row.sp_edge_home) >= 1.5
        return ("align" if sig_home == model_home else "oppose") if strong else "neutral"
    if m == "total":
        sig_over = "OVER" in str(row.side).upper()
        model_over = row.tot_edge > 0
        strong = abs(row.tot_edge) >= 1.5
        return ("align" if sig_over == model_over else "oppose") if strong else "neutral"
    return "n/a"


led["conf"] = led.apply(agree, axis=1)
print(f"graded signal picks joined to model: {len(led)}\n")


def wr(d):
    w = d.win.astype(float)
    return f"{int(w.sum())}-{int(len(w)-w.sum())} ({100*w.mean():.1f}%)  ROI {d.roi_u.mean():+.3f}u"


print("ALL signal picks (baseline):", wr(led))
print()
for mkt in ("spread", "total"):
    d = led[led.market == mkt]
    print(f"== {mkt} signals ==")
    for c in ("align", "oppose", "neutral"):
        dd = d[d.conf == c]
        if len(dd) >= 15:
            print(f"  model {c:8s}: {wr(dd)}   n={len(dd)}")
    print()

# the money view: signals the model ALIGNS with, by rule
print("=== top rules WHERE MODEL ALIGNS (n>=10) ===")
al = led[led.conf == "align"]
for rule, d in al.groupby("rule"):
    if len(d) >= 10:
        print(f"  {rule:26s} {wr(d)}  n={len(d)}")
