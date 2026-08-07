#!/usr/bin/env python3
"""NBA halves #3 — pressure-test the shared-1H-total-streak fade.

Brief #2 found BOTH teams on a 3+ 1H OVER streak → 1H UNDER 62-64%, AND the
mirror (both on 3+ UNDER streak → OVER 58-60%). A symmetric two-sided fade with
3/3 seasons is worth far more than a one-sided cell, so test it properly:

  1. streak-depth ladder (2+/3+/4+), both signs, and the COMBINED "fade the
     shared streak" rule (both signs pooled = the real bet count)
  2. does ONE team's streak suffice, or does it need both?
  3. line diagnostic — does the book move the 1H total for streak games? (if it
     over-moves, that IS the mechanism)
  4. robustness: game-count gate, streak-vs-season-record aligned/opposed,
     drop the sharpest season, worst-price grading
"""
import os

import numpy as np
import pandas as pd

from nba_halves_study2 import bet, game_frame

ROOT = os.path.dirname(os.path.abspath(__file__))


def main():
    G = game_frame()
    over = pd.Series(np.where(G["h1_over"] > 0, 1.0,
                              np.where(G["h1_over"] < 0, 0.0, np.nan)), index=G.index)
    under = 1 - over
    lines = ["# NBA Halves Brief #3 — the shared 1H-total-streak fade, pressure-tested",
             "",
             f"{len(G):,} games. 1H consensus close, decimal. BE 52.4%. Per-season win%.",
             ""]

    # ---------------- 1. depth ladder + combined rule
    lines.append("## Streak-depth ladder, both signs, and the combined fade\n")
    lines.append("| signal | n | win% | ROI | per-season |")
    lines.append("|---|---|---|---|---|")
    for gp in (0, 20, 30):
        gate = G["min_gp"] >= gp
        tag = "any gp" if gp == 0 else f"{gp}+ gp"
        for k in (2, 3, 4):
            bo = gate & (G["h_ov_streak"] >= k) & (G["a_ov_streak"] >= k)
            bu = gate & (G["h_ov_streak"] <= -k) & (G["a_ov_streak"] <= -k)
            bet(G, bo, under, G["h1_un"], f"[{tag}] both {k}+ OVER streak → UNDER", lines)
            bet(G, bu, over, G["h1_ov"], f"[{tag}] both {k}+ UNDER streak → OVER", lines)
            # combined: fade whichever direction they're both riding
            m = bo | bu
            win = pd.Series(np.where(bo, under, np.where(bu, over, np.nan)), index=G.index)
            dec = pd.Series(np.where(bo, G["h1_un"], np.where(bu, G["h1_ov"], np.nan)), index=G.index)
            bet(G, m, win, dec, f"**[{tag}] COMBINED fade shared {k}+ 1H streak**", lines)

    # ---------------- 2. one team vs both
    lines.append("\n## Does it need BOTH teams?\n")
    lines.append("| signal | n | win% | ROI | per-season |")
    lines.append("|---|---|---|---|---|")
    gate = G["min_gp"] >= 20
    one_o = gate & ((G["h_ov_streak"] >= 3) | (G["a_ov_streak"] >= 3))
    only_one_o = one_o & ~((G["h_ov_streak"] >= 3) & (G["a_ov_streak"] >= 3))
    bet(G, one_o, under, G["h1_un"], "≥1 team on 3+ OVER streak → UNDER", lines)
    bet(G, only_one_o, under, G["h1_un"], "EXACTLY one team on 3+ OVER streak → UNDER", lines)
    one_u = gate & ((G["h_ov_streak"] <= -3) | (G["a_ov_streak"] <= -3))
    only_one_u = one_u & ~((G["h_ov_streak"] <= -3) & (G["a_ov_streak"] <= -3))
    bet(G, one_u, over, G["h1_ov"], "≥1 team on 3+ UNDER streak → OVER", lines)
    bet(G, only_one_u, over, G["h1_ov"], "EXACTLY one team on 3+ UNDER streak → OVER", lines)
    # opposed streaks (one over-streak, one under-streak) — should be a null cell
    opp = gate & (((G["h_ov_streak"] >= 3) & (G["a_ov_streak"] <= -3)) |
                  ((G["a_ov_streak"] >= 3) & (G["h_ov_streak"] <= -3)))
    bet(G, opp, over, G["h1_ov"], "OPPOSED streaks (one hot one cold) → OVER", lines)
    bet(G, opp, under, G["h1_un"], "OPPOSED streaks → UNDER", lines)

    # ---------------- 3. line diagnostic
    lines.append("\n## Mechanism — does the book move the 1H total for streaks? (20+ gp)\n")
    lines.append("| cell | n | mean 1H line | mean actual | actual − line | realized over% |")
    lines.append("|---|---|---|---|---|---|")
    sub = G[gate & G["h1_tot"].notna() & G["h1_total_line"].notna()].copy()
    cells = {
        "both 3+ OVER streak": (sub["h_ov_streak"] >= 3) & (sub["a_ov_streak"] >= 3),
        "both 2+ OVER streak": (sub["h_ov_streak"] >= 2) & (sub["a_ov_streak"] >= 2),
        "no shared streak (baseline)": ~(((sub["h_ov_streak"] >= 2) & (sub["a_ov_streak"] >= 2)) |
                                         ((sub["h_ov_streak"] <= -2) & (sub["a_ov_streak"] <= -2))),
        "both 2+ UNDER streak": (sub["h_ov_streak"] <= -2) & (sub["a_ov_streak"] <= -2),
        "both 3+ UNDER streak": (sub["h_ov_streak"] <= -3) & (sub["a_ov_streak"] <= -3),
    }
    for lbl, m in cells.items():
        gg = sub[m]
        if len(gg) < 30:
            continue
        lines.append(f"| {lbl} | {len(gg):,} | {gg['h1_total_line'].mean():.1f} | "
                     f"{gg['h1_tot'].mean():.1f} | {(gg['h1_tot']-gg['h1_total_line']).mean():+.2f} | "
                     f"{(gg['h1_tot']>gg['h1_total_line']).mean()*100:.1f}% |")
    # how much did the line move relative to each team's own season 1H scoring env?
    lines.append("")
    for lbl, m in cells.items():
        gg = sub[m]
        if len(gg) < 30:
            continue
        lines.append(f"- {lbl}: mean season 1H over% of the two teams = "
                     f"{((gg['h_s_ov_pct']+gg['a_s_ov_pct'])/2).mean():.3f}")

    # ---------------- 4. robustness
    lines.append("\n## Robustness of the COMBINED 3+ shared-streak fade\n")
    lines.append("| variant | n | win% | ROI | per-season |")
    lines.append("|---|---|---|---|---|")
    bo = gate & (G["h_ov_streak"] >= 3) & (G["a_ov_streak"] >= 3)
    bu = gate & (G["h_ov_streak"] <= -3) & (G["a_ov_streak"] <= -3)
    m = bo | bu
    win = pd.Series(np.where(bo, under, np.where(bu, over, np.nan)), index=G.index)
    dec = pd.Series(np.where(bo, G["h1_un"], np.where(bu, G["h1_ov"], np.nan)), index=G.index)
    bet(G, m, win, dec, "combined (20+ gp) — headline", lines)
    # flat -110 instead of consensus price
    bet(G, m, win, pd.Series(1.909, index=G.index), "combined, graded flat -110", lines)
    # streak aligned with season record vs opposed
    al = m & (((bo) & (G["h_s_ov_pct"] >= .5) & (G["a_s_ov_pct"] >= .5)) |
              ((bu) & (G["h_s_ov_pct"] <= .5) & (G["a_s_ov_pct"] <= .5)))
    bet(G, al, win, dec, "combined, streak ALIGNED with season record", lines)
    bet(G, m & ~al, win, dec, "combined, streak OPPOSED to season record", lines)
    for s in sorted(G["season"].dropna().unique()):
        bet(G, m & (G["season"] != s), win, dec, f"combined, drop {s}", lines)
    # early-season (no gp gate) to see if maturity matters at all
    bo0 = (G["h_ov_streak"] >= 3) & (G["a_ov_streak"] >= 3) & (G["min_gp"] < 20)
    bu0 = (G["h_ov_streak"] <= -3) & (G["a_ov_streak"] <= -3) & (G["min_gp"] < 20)
    m0 = bo0 | bu0
    win0 = pd.Series(np.where(bo0, under, np.where(bu0, over, np.nan)), index=G.index)
    dec0 = pd.Series(np.where(bo0, G["h1_un"], np.where(bu0, G["h1_ov"], np.nan)), index=G.index)
    bet(G, m0, win0, dec0, "combined, EARLY season only (<20 gp)", lines)

    # ---------------- 5. does the same fade work on the FULL-GAME total?
    lines.append("\n## Does the shared 1H streak also fade the FULL-GAME total?\n")
    lines.append("| signal | n | win% | ROI | per-season |")
    lines.append("|---|---|---|---|---|")
    mgm = pd.read_parquet(os.path.join(ROOT, "data", "parquet", "movement_games_nba.parquet"))[
        ["event_id", "t60_total_point", "t60_total_over_price", "t60_total_under_price"]]
    F = G.merge(mgm, on="event_id", how="left")
    ftot = F["home_score"] + F["away_score"]
    fov = pd.Series(np.where(ftot > F["t60_total_point"], 1.0,
                             np.where(ftot < F["t60_total_point"], 0.0, np.nan)), index=F.index)
    fbo = (F["min_gp"] >= 20) & (F["h_ov_streak"] >= 3) & (F["a_ov_streak"] >= 3)
    fbu = (F["min_gp"] >= 20) & (F["h_ov_streak"] <= -3) & (F["a_ov_streak"] <= -3)
    fm = fbo | fbu
    fwin = pd.Series(np.where(fbo, 1 - fov, np.where(fbu, fov, np.nan)), index=F.index)
    fdec = pd.Series(np.where(fbo, F["t60_total_under_price"],
                              np.where(fbu, F["t60_total_over_price"], np.nan)), index=F.index)
    bet(F, fbo, 1 - fov, F["t60_total_under_price"], "both 3+ 1H OVER streak → FULL-GAME UNDER", lines)
    bet(F, fbu, fov, F["t60_total_over_price"], "both 3+ 1H UNDER streak → FULL-GAME OVER", lines)
    bet(F, fm, fwin, fdec, "COMBINED shared 1H streak → fade FULL-GAME total", lines)

    path = os.path.join(ROOT, "NBA_HALVES_BRIEF3.md")
    with open(path, "w") as f:
        f.write("\n".join(lines) + "\n")
    print(f"wrote {path}")


if __name__ == "__main__":
    main()
