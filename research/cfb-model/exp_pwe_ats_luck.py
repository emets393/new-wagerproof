#!/usr/bin/env python3
"""
PWE -> deserved spread -> ATS luck ledger (owner extension, 2026-09-10).

Idea: convert postgame win expectancy into a "deserved margin"
(margin ~ N(mu, sigma) => mu = sigma * PHI^-1(PWE), sigma fitted in-sample by OLS
of actual margin on PHI^-1(PWE)). deserved_cover_margin = deserved_margin +
team-relative opener. A team that covered while deserved_cover_margin < 0 got an
UNDESERVED COVER; one that failed while > 0 was ATS-UNLUCKY.

Pre-registered family (before results):
  F1  fade next game after an UNDESERVED COVER          (dose: deficit >= 4, >= 7)
  F2  back next game after DESERVED-BUT-FAILED cover    (dose: surplus >= 4, >= 7)
  F3  streak: 2+ consecutive undeserved covers -> fade
  F4  cumulative s2d ats_luck (mean cover - deserved) quintiles + |>=0.25| tails
  F5  elo split of F1/F2 ONLY: better-rated team vs worse-rated (elo_diff sign)
Grading: next game ATS vs OPENER, per-season, oracle inherited from exp_pwe_luck.
"""
import os
import numpy as np
import pandas as pd
from scipy.stats import norm

from exp_pwe_luck import fetch_pwe, build_panel, HERE


def report(name, sub, all_rows, side=+1):
    """side=+1 back the team, side=-1 fade the team (next game, vs opener)."""
    s = sub[sub.cover_open != 0]
    if len(s) < 30:
        print(f"{name:44s} n={len(s)} (too small)")
        return
    win = (s.cover_open == side).mean()
    b = all_rows[all_rows.cover_open != 0]
    blind = (b.cover_open == side).mean()
    roi = win * (100 / 110 + 1) - 1
    z = (win - blind) * 2 * np.sqrt(len(s))
    per = " | ".join(f"{yr}:{100*(g.cover_open==side).mean():.0f}%(n={len(g)})"
                     for yr, g in s.groupby("season"))
    print(f"{name:44s} n={len(s):5d}  win {100*win:.1f}%  roi {100*roi:+.1f}%  "
          f"blind {100*blind:.1f}%  z={z:+.2f}")
    print(" " * 46 + per)


def main():
    pwe = fetch_pwe()
    hist = pd.read_parquet(os.path.join(HERE, "data", "model_games_hist.parquet"))
    p = build_panel(pwe, hist)

    # team-relative elo diff for F5
    elo = hist[["game_id", "home_elo", "away_elo"]]
    p = p.merge(elo, on="game_id", how="left")
    p["elo_diff"] = np.where(p.is_home, p.home_elo - p.away_elo, p.away_elo - p.home_elo)

    # ---- PWE -> deserved margin ------------------------------------------
    q = norm.ppf(p.pwe.clip(0.01, 0.99))
    slope = float(np.polyfit(q, p.margin, 1)[0])   # implied sigma (intercept ~0 by mirror symmetry)
    p["deserved_margin"] = slope * q
    corr_actual = np.corrcoef(p.deserved_margin, p.margin)[0, 1]
    corr_line = np.corrcoef(p.deserved_margin, -p.spread_open)[0, 1]
    print(f"\nPWE->margin: implied sigma {slope:.1f} pts | corr w/ actual margin "
          f"{corr_actual:.3f} | corr w/ market expectation {corr_line:.3f}")
    # calibration by pwe bucket
    p["_b"] = pd.cut(p.pwe, [0, .2, .4, .6, .8, 1.0])
    print(p.groupby("_b", observed=True).apply(
        lambda g: f"deserved {g.deserved_margin.mean():+5.1f} vs actual {g.margin.mean():+5.1f} (n={len(g)})"
    ).to_string())

    # ---- deserved cover ---------------------------------------------------
    p["dcm"] = p.deserved_margin + p.spread_open        # >0 deserved to cover
    p["covered"] = (p.cover_open > 0).astype(int)
    p["deserved_cover"] = (p.dcm > 0).astype(int)
    played = p[p.cover_open != 0]
    agree = (played.covered == played.deserved_cover).mean()
    print(f"\ndeserved-cover agrees with actual cover {100*agree:.1f}% of games "
          f"(disagreement {100*(1-agree):.1f}% = the 'ATS luck' population)")

    # prior-game state
    for c in ("covered", "deserved_cover", "dcm"):
        p[f"prev_{c}"] = p.groupby(["team", "season"])[c].shift(1)
    # only rows whose PREVIOUS game had a line (dcm needs spread)
    nxt = p.dropna(subset=["prev_dcm", "prev_covered"]).copy()
    allr = nxt
    print(f"\npanel rows with graded previous game: {len(nxt)}")

    print("\n=========== F1: UNDESERVED COVER last game -> FADE next ===========")
    uc = nxt[(nxt.prev_covered == 1) & (nxt.prev_dcm < 0)]
    report("F1 covered, deserved NOT to", uc, allr, side=-1)
    report("F1 dose: deficit >= 4 pts", uc[uc.prev_dcm <= -4], allr, side=-1)
    report("F1 dose: deficit >= 7 pts", uc[uc.prev_dcm <= -7], allr, side=-1)

    print("\n=========== F2: DESERVED cover but FAILED -> BACK next ===========")
    df_ = nxt[(nxt.prev_covered == 0) & (nxt.prev_dcm > 0)]
    report("F2 failed, deserved to cover", df_, allr, side=+1)
    report("F2 dose: surplus >= 4 pts", df_[df_.prev_dcm >= 4], allr, side=+1)
    report("F2 dose: surplus >= 7 pts", df_[df_.prev_dcm >= 7], allr, side=+1)

    print("\n=========== F3: STREAK of undeserved covers -> FADE ===========")
    p["uc_flag"] = ((p.covered == 1) & (p.dcm < 0)).astype(int)
    p["uc_streak"] = p.groupby(["team", "season"]).uc_flag.transform(
        lambda s: s.groupby((s == 0).cumsum()).cumsum())
    p["prev_uc_streak"] = p.groupby(["team", "season"]).uc_streak.shift(1)
    st = p.dropna(subset=["prev_uc_streak"])
    report("F3 streak >= 2 undeserved covers", st[st.prev_uc_streak >= 2], st, side=-1)

    print("\n=========== F4: cumulative season-to-date ATS luck ===========")
    p["ats_luck"] = p.covered - p.deserved_cover        # +1 lucky cover, -1 robbed
    p["cum_ats_luck"] = p.groupby(["team", "season"]).ats_luck.transform(
        lambda s: s.shift(1).expanding().mean())
    p["prior_n"] = p.groupby(["team", "season"]).cumcount()
    c4 = p[(p.prior_n >= 3) & p.cum_ats_luck.notna() & (p.cover_open != 0)]
    c4 = c4.copy(); c4["q"] = pd.qcut(c4.cum_ats_luck, 5, labels=False, duplicates="drop")
    for qq, g in c4.groupby("q"):
        print(f"  luck Q{qq} [{g.cum_ats_luck.min():+.2f},{g.cum_ats_luck.max():+.2f}] "
              f"n={len(g):5d}  next cover {100*(g.cover_open>0).mean():.1f}%")
    report("F4 tail: s2d ats luck >= +0.25 -> FADE", c4[c4.cum_ats_luck >= 0.25], c4, side=-1)
    report("F4 tail: s2d ats luck <= -0.25 -> BACK", c4[c4.cum_ats_luck <= -0.25], c4, side=+1)

    print("\n=========== F5: elo splits of F1/F2 ===========")
    report("F1 x team BETTER rated (elo_diff>0)", uc[uc.elo_diff > 0], allr, side=-1)
    report("F1 x team WORSE rated (elo_diff<0)", uc[uc.elo_diff < 0], allr, side=-1)
    report("F2 x team BETTER rated (elo_diff>0)", df_[df_.elo_diff > 0], allr, side=+1)
    report("F2 x team WORSE rated (elo_diff<0)", df_[df_.elo_diff < 0], allr, side=+1)


if __name__ == "__main__":
    main()
