#!/usr/bin/env python3
"""Model-in-action report: 2025 Week 2 — predictions, unit narrative, results.
Out-of-sample (trained 2021-2024). Reuses the v4 feature build."""
import numpy as np
import pandas as pd

src = open("exp_fp_v4_earlyseason.py").read().split('print(f"panel')[0]
exec(src)

DIFF_LABEL = {
    "d_trench_pass": "pass protection vs pass rush",
    "d_trench_run": "run blocking vs run front",
    "d_playmaking": "receiver playmaking vs tackling",
    "d_power": "RB power vs tackling",
    "d_precision_cov": "QB precision vs coverage disruption",
    "d_deep_fit": "deep passing vs deep denial",
    "d_rz": "red-zone offense vs red-zone D",
}
DKEYS = list(DIFF_LABEL)
# standardize using the full-panel mean/std, applied to the prediction rows
STATS = {k: (p[k].mean(), p[k].std()) for k in DKEYS + ["fit_scheme_pass"]}
wk = pr[(pr.season == 2025) & (pr.week == 2)].copy()
for k in DKEYS + ["fit_scheme_pass"]:
    mu, sd = STATS[k]
    wk[k + "_z"] = (wk[k] - mu) / sd
games = wk.game_id.unique()
INV = {v: k for k, v in AB_NV.items()}

sp_w = sp_n = tot_w = tot_n = 0
lines = []
gm = g.set_index("game_id")
for gid in games:
    rr = wk[wk.game_id == gid]
    if len(rr) != 2:
        continue
    home = rr[rr.home == 1].iloc[0]
    away = rr[rr.away_team if False else rr.home == 0].iloc[0] if (rr.home == 0).any() else None
    away = rr[rr.home == 0].iloc[0]
    ph, pa = home.pred, away.pred
    pred_margin = ph - pa            # home perspective
    pred_total = ph + pa
    mkt_home_line = home.line        # neg = home favored
    mkt_total = home.total
    sp_edge = pred_margin - (-mkt_home_line)
    tot_edge = pred_total - mkt_total
    grow = gm.loc[gid]
    act_home, act_away = grow.home_score, grow.away_score
    act_home, act_away = int(act_home), int(act_away)
    act_margin = act_home - act_away
    act_total = act_home + act_away
    # spread pick + grade
    home_ab, away_ab = grow.home_team, grow.away_team
    if abs(sp_edge) >= 2:
        pick_home = sp_edge >= 2
        pick_team = home_ab if pick_home else away_ab
        pick_line = mkt_home_line if pick_home else -mkt_home_line
        cover = (act_margin + mkt_home_line > 0) if pick_home else (act_margin + mkt_home_line < 0)
        push = (act_margin + mkt_home_line == 0)
        sp_txt = f"SPREAD PICK: {pick_team} {pick_line:+.1f}  ->  {'WIN' if cover and not push else 'push' if push else 'LOSS'}"
        if not push:
            sp_w += cover; sp_n += 1
    else:
        sp_txt = "SPREAD: no play (edge <2)"
    if abs(tot_edge) >= 2:
        over = tot_edge >= 2
        cover_t = (act_total > mkt_total) if over else (act_total < mkt_total)
        push_t = act_total == mkt_total
        tot_txt = f"TOTAL PICK: {'OVER' if over else 'UNDER'} {mkt_total:.1f}  ->  {'WIN' if cover_t and not push_t else 'push' if push_t else 'LOSS'}"
        if not push_t:
            tot_w += cover_t; tot_n += 1
    else:
        tot_txt = "TOTAL: no play (edge <2)"

    # narrative: biggest unit edges each direction
    def unit_line(row, opp_name):
        items = [(DIFF_LABEL[k], row[k + "_z"]) for k in DKEYS]
        items.sort(key=lambda x: -abs(x[1]))
        parts = []
        for lab, z in items[:3]:
            if abs(z) < 0.4:
                continue
            parts.append(f"{lab} {'+' if z > 0 else ''}{z:.1f}σ")
        return "; ".join(parts) if parts else "even across units"

    lines.append(
        f"\n{away_ab} @ {home_ab}\n"
        f"  MODEL: {home_ab} {pred_margin:+.1f}, total {pred_total:.1f}   |   "
        f"MARKET: {home_ab} {mkt_home_line:+.1f}, total {mkt_total:.1f}   |   "
        f"edge: spread {sp_edge:+.1f}, total {tot_edge:+.1f}\n"
        f"  {away_ab} offense vs {home_ab} defense: {unit_line(away, home_ab)}\n"
        f"  {home_ab} offense vs {away_ab} defense: {unit_line(home, away_ab)}\n"
        f"  FINAL: {away_ab} {int(act_away)}  {home_ab} {int(act_home)}  (margin {act_margin:+d}, total {int(act_total)})\n"
        f"  {sp_txt}\n  {tot_txt}")

print("=" * 78)
print("  MODEL-IN-ACTION: 2025 WEEK 2  (out-of-sample, trained 2021-2024)")
print("=" * 78)
for l in sorted(lines):
    print(l)
print("\n" + "=" * 78)
print(f"  SPREAD picks (edge>=2): {sp_w}-{sp_n - sp_w} ({100*sp_w/max(sp_n,1):.0f}%)")
print(f"  TOTAL  picks (edge>=2): {tot_w}-{tot_n - tot_w} ({100*tot_w/max(tot_n,1):.0f}%)")
print("=" * 78)
