#!/usr/bin/env python3
"""
TRAP GAMES (owner spec, 2026-09-11).

Setup: a team's PREVIOUS game was a clean, convincing, DESERVED cover
(won by >=10, covered the opener, deserved-cover margin dcm >= 0 so no luck),
and in THIS game:
  (a) the opponent is WEAKER (lower pregame Elo) than the opponent they just beat, and
  (b) the market lays FEWER points than the Elo gap implies (elo-implied lay minus
      actual lay >= 2; dose >= 4) — the line looks like a gift.

Question: is the gift bait (letdown -> dog covers, FADE) or value (BACK)?

Controls that decide what the effect actually is:
  C1 short-line only : same elo-vs-market gap, NO trap setup -> pure elo-vs-line edge?
  C2 setup only      : trap setup, line FAIR (|gap| < 2)     -> does the spot alone matter?

Grading: ATS vs OPENER (both sides reported vs blind), per-season, oracle inherited.
Elo->points fit: team-relative lay ~ elo_diff + is_home (market-scaled conversion).

RESULT (2021-25) + WEEK-6 2026 CHECKPOINT (owner-approved 2026-09-11):
  TRAP-FADE pooled 52.7% z=0.7 but 2021-22 reversed, 2023-25 ran 51/61/62; dose
  (>=4 short) flips sign -> NOT confirmed. FAIR-LINE BACK (control C2) hit 56.9%
  (n=160, 4/5 seasons) — hypothesis-generating, found in a control. Re-run this
  script on 2026 wks 2-6 at the week-6 checkpoint (~2026-10-12), thresholds
  FROZEN; a cell ships as a tracking flag only if OOS direction agrees and
  pooled-with-OOS stays >=54%.
"""
import os
import numpy as np
import pandas as pd
from scipy.stats import norm

from exp_pwe_luck import fetch_pwe, build_panel, HERE


def report(name, sub, all_rows, side):
    s = sub[sub.cover_open != 0]
    if len(s) < 25:
        print(f"{name:46s} n={len(s)} (too small)")
        return
    win = (s.cover_open == side).mean()
    blind = (all_rows[all_rows.cover_open != 0].cover_open == side).mean()
    roi = win * (100 / 110 + 1) - 1
    z = (win - blind) * 2 * np.sqrt(len(s))
    per = " | ".join(f"{yr}:{100*(g.cover_open==side).mean():.0f}%(n={len(g)})"
                     for yr, g in s.groupby("season"))
    print(f"{name:46s} n={len(s):4d}  win {100*win:.1f}%  roi {100*roi:+.1f}%  "
          f"blind {100*blind:.1f}%  z={z:+.2f}")
    print(" " * 48 + per)


def main():
    pwe = fetch_pwe()
    hist = pd.read_parquet(os.path.join(HERE, "data", "model_games_hist.parquet"))
    p = build_panel(pwe, hist)
    elo = hist[["game_id", "home_elo", "away_elo"]]
    p = p.merge(elo, on="game_id", how="left")
    p["elo_team"] = np.where(p.is_home, p.home_elo, p.away_elo)
    p["elo_opp"] = np.where(p.is_home, p.away_elo, p.home_elo)
    p["elo_diff"] = p.elo_team - p.elo_opp

    # deserved-cover margin from the PWE study (sigma refit here is fine — same fit)
    q = norm.ppf(p.pwe.clip(0.01, 0.99))
    sigma = float(np.polyfit(q, p.margin, 1)[0])
    p["dcm"] = sigma * q + p.spread_open
    p["covered"] = (p.cover_open > 0).astype(int)
    p["lay"] = -p.spread_open                      # points laid (positive = favored)

    # Elo -> points, market-scaled: lay ~ elo_diff + is_home
    f = p.dropna(subset=["elo_diff", "lay"])
    X = np.column_stack([f.elo_diff, f.is_home.astype(float), np.ones(len(f))])
    beta, *_ = np.linalg.lstsq(X, f.lay, rcond=None)
    p["elo_lay"] = beta[0] * p.elo_diff + beta[1] * p.is_home.astype(float) + beta[2]
    corr = np.corrcoef(f.elo_lay if "elo_lay" in f else beta[0]*f.elo_diff, f.lay)[0, 1] \
        if False else np.corrcoef(X @ beta, f.lay)[0, 1]
    print(f"elo->points: {beta[0]*100:.2f} pts per 100 elo, HFA {beta[1]:+.2f}; "
          f"corr(elo-implied lay, market lay) = {corr:.3f}")
    p["gap"] = p.elo_lay - p.lay                   # >0 market lays FEWER than elo implies

    # previous-game state
    for c in ("won", "covered", "margin", "dcm", "elo_opp"):
        p[f"prev_{c}"] = p.groupby(["team", "season"])[c].shift(1)

    nxt = p.dropna(subset=["prev_won", "prev_dcm", "prev_elo_opp", "gap", "elo_opp"]).copy()
    allr = nxt

    clean_win = (nxt.prev_won == 1) & (nxt.prev_covered == 1) & \
                (nxt.prev_margin >= 10) & (nxt.prev_dcm >= 0)
    weaker_opp = nxt.elo_opp < nxt.prev_elo_opp
    short2, short4 = nxt.gap >= 2, nxt.gap >= 4
    trap = clean_win & weaker_opp

    print(f"\nrows: {len(nxt)} | clean deserved 10+ cover last game: {clean_win.sum()} "
          f"| + weaker opponent now: {trap.sum()} | + short line >=2: {(trap & short2).sum()}")

    print("\n================ TRAP GAME (setup + short line) ================")
    report("TRAP >=2 short — BACK team", nxt[trap & short2], allr, +1)
    report("TRAP >=2 short — FADE team", nxt[trap & short2], allr, -1)
    report("TRAP >=4 short — BACK team", nxt[trap & short4], allr, +1)
    report("TRAP >=4 short — FADE team", nxt[trap & short4], allr, -1)

    print("\n================ CONTROLS ================")
    report("C1 short >=2, NO trap setup — BACK", nxt[~trap & short2], allr, +1)
    report("C1 short >=4, NO trap setup — BACK", nxt[~trap & short4], allr, +1)
    report("C2 trap setup, line FAIR |gap|<2 — BACK", nxt[trap & (nxt.gap.abs() < 2)], allr, +1)
    report("C3 clean win only (any opp/line) — BACK", nxt[clean_win], allr, +1)
    report("C4 elo says lay MORE... err short<=-2 — BACK",
           nxt[trap & (nxt.gap <= -2)], allr, +1)

    print("\n================ GAP quintiles overall (elo-vs-market, all rows) ================")
    g5 = nxt[nxt.cover_open != 0].copy()
    g5["q"] = pd.qcut(g5.gap, 5, labels=False, duplicates="drop")
    for qq, g in g5.groupby("q"):
        print(f"  gap Q{qq} [{g.gap.min():+.1f},{g.gap.max():+.1f}] n={len(g):5d}  "
              f"back-team cover {100*(g.cover_open>0).mean():.1f}%")


if __name__ == "__main__":
    main()
