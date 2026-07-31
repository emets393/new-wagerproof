#!/usr/bin/env python3
"""NBA availability round 2 — where in the game does the absence effect live?

Round 1 (NBA_AVAIL_1H_BRIEF.md) found three things worth chasing:
  1. moderate star out → BACK the depleted team on the 1H spread (54.9%) while
     the SAME games are dead on FG — but per-season 61/54/49, so test the decay
  2. SEVERE depletion (≥25ppg star, or 2+ regulars) → FADE on the FULL GAME
     (55-57%) while 1H is dead — the opposite market
  3. both teams depleted → FG OVER 55.0% with 1H dead — so the points arrive
     in the SECOND half

(3) is testable directly: 2H points = final − 1H, and a synthetic 2H line =
FG line − 1H line. That line is what the book implicitly posts, so a synthetic
2H bet is honest about WHERE the mispricing sits even though we grade it at
-110 (we have no 2H price feed). Marked SYNTHETIC everywhere it appears.

Also runs the controlled version of the mechanism test: regress the 1H line on
the FG line WITH an absence dummy, so the ratio isn't confounded by the fact
that depleted teams sit at different spread magnitudes.
"""
import os

import numpy as np
import pandas as pd

from nba_availability_1h_study import load, markets
from nba_halves_study2 import bet

ROOT = os.path.dirname(os.path.abspath(__file__))


def synth_2h(G):
    """SYNTHETIC 2H market: line = FG − 1H, graded flat -110 (no 2H price feed)."""
    h2_tot = (G["home_score"] + G["away_score"]) - G["h1_tot"]
    h2_line = G["t60_total_point"] - G["h1_total"]
    over = pd.Series(np.where(h2_tot > h2_line, 1.0,
                              np.where(h2_tot < h2_line, 0.0, np.nan)), index=G.index)
    h2_marg = (G["home_score"] - G["away_score"]) - G["h1_margin"]
    h2_sp = G["t60_spread_home_point"] - G["h1_spread"]
    hcov = h2_marg + h2_sp
    home = pd.Series(np.where(hcov > 0, 1.0, np.where(hcov < 0, 0.0, np.nan)), index=G.index)
    flat = pd.Series(1.909, index=G.index)
    return over, home, flat


def main():
    G = load()
    mk = markets(G)
    o2, h2, flat = synth_2h(G)
    lines = ["# NBA availability round 2 — 1H vs 2H decomposition",
             "",
             f"{len(G):,} games. FG/1H graded at T-60 consensus (decimal); the 2H column is "
             "**SYNTHETIC** (line = FG − 1H, graded flat -110) — it localises the effect, it is "
             "not a price we have. BE 52.4%.",
             ""]

    # ---------- A. star-out 1H back: is it decaying?
    lines.append("## A — moderate star out → BACK on the 1H spread: splits and decay\n")
    lines.append("| signal | n | win% | ROI | per-season |")
    lines.append("|---|---|---|---|---|")
    h1w, h1d, a1w, a1d = mk["1H spread"]
    fgw, fgd, faw, fad = mk["FG spread"]

    def pair(mask_h, mask_a, label, which="1H"):
        mh, ma = mask_h.fillna(False), mask_a.fillna(False)
        m = mh | ma
        hw, hd, aw, ad = (h1w, h1d, a1w, a1d) if which == "1H" else (
            (fgw, fgd, faw, fad) if which == "FG" else (h2, flat, 1 - h2, flat))
        win = pd.Series(np.where(mh, hw, np.where(ma, aw, np.nan)), index=G.index)
        dec = pd.Series(np.where(mh, hd, np.where(ma, ad, np.nan)), index=G.index)
        bet(G, m, win, dec, f"{label} [{which}]", lines)

    for lo, hi in ((18, 22), (22, 25), (25, 99)):
        sh = (G["h_fresh_max_ppg"] >= lo) & (G["h_fresh_max_ppg"] < hi) & (G["a_fresh_max_ppg"] < 18)
        sa = (G["a_fresh_max_ppg"] >= lo) & (G["a_fresh_max_ppg"] < hi) & (G["h_fresh_max_ppg"] < 18)
        for w in ("FG", "1H", "2H"):
            pair(sh, sa, f"star out [{lo},{hi}) ppg → BACK depleted", w)
    # home/away + fav/dog splits of the headline 18-25 cell
    sh = (G["h_fresh_max_ppg"] >= 18) & (G["h_fresh_max_ppg"] < 25) & (G["a_fresh_max_ppg"] < 18)
    sa = (G["a_fresh_max_ppg"] >= 18) & (G["a_fresh_max_ppg"] < 25) & (G["h_fresh_max_ppg"] < 18)
    pair(sh, pd.Series(False, index=G.index), "…depleted team is HOME → BACK", "1H")
    pair(pd.Series(False, index=G.index), sa, "…depleted team is AWAY → BACK", "1H")
    fav_h = G["t60_spread_home_point"] < 0
    pair(sh & fav_h, sa & ~fav_h, "…depleted team FAVORED → BACK", "1H")
    pair(sh & ~fav_h, sa & fav_h, "…depleted team DOG → BACK", "1H")
    # only ONE regular out (isolate from depth depletion)
    pair(sh & (G["h_fresh_n"] == 1), sa & (G["a_fresh_n"] == 1),
         "…and exactly ONE regular out → BACK", "1H")
    pair(sh & (G["h_fresh_n"] >= 2), sa & (G["a_fresh_n"] >= 2),
         "…and 2+ regulars out → BACK", "1H")

    # ---------- B. severe depletion → FG fade
    lines.append("\n## B — severe depletion → FADE on the full game (dose ladder)\n")
    lines.append("| signal | n | win% | ROI | per-season |")
    lines.append("|---|---|---|---|---|")

    def fade(mask_h, mask_a, label, which="FG"):
        mh, ma = mask_h.fillna(False), mask_a.fillna(False)
        m = mh | ma
        hw, hd, aw, ad = (h1w, h1d, a1w, a1d) if which == "1H" else (
            (fgw, fgd, faw, fad) if which == "FG" else (h2, flat, 1 - h2, flat))
        win = pd.Series(np.where(mh, aw, np.where(ma, hw, np.nan)), index=G.index)
        dec = pd.Series(np.where(mh, ad, np.where(ma, hd, np.nan)), index=G.index)
        bet(G, m, win, dec, f"{label} [{which}]", lines)

    for thr in (22, 25, 28):
        sh = (G["h_fresh_max_ppg"] >= thr) & (G["a_fresh_max_ppg"] < thr)
        sa = (G["a_fresh_max_ppg"] >= thr) & (G["h_fresh_max_ppg"] < thr)
        for w in ("FG", "1H", "2H"):
            fade(sh, sa, f"≥{thr}ppg star out → FADE depleted", w)
    for k in (2, 3):
        sh = (G["h_fresh_n"] >= k) & (G["a_fresh_n"] == 0)
        sa = (G["a_fresh_n"] >= k) & (G["h_fresh_n"] == 0)
        for w in ("FG", "1H", "2H"):
            fade(sh, sa, f"{k}+ fresh regulars out (other full) → FADE", w)
    for lo in (30, 40):
        sh = (G["h_fresh_sum_ppg"] >= lo) & (G["a_fresh_sum_ppg"] < 10)
        sa = (G["a_fresh_sum_ppg"] >= lo) & (G["h_fresh_sum_ppg"] < 10)
        for w in ("FG", "1H", "2H"):
            fade(sh, sa, f"{lo}+ ppg removed (other side clean) → FADE", w)
    # union rule: severe = 25+ ppg star OR 2+ regulars
    sev_h = ((G["h_fresh_max_ppg"] >= 25) | (G["h_fresh_n"] >= 2)) & \
            ~((G["a_fresh_max_ppg"] >= 25) | (G["a_fresh_n"] >= 2))
    sev_a = ((G["a_fresh_max_ppg"] >= 25) | (G["a_fresh_n"] >= 2)) & \
            ~((G["h_fresh_max_ppg"] >= 25) | (G["h_fresh_n"] >= 2))
    for w in ("FG", "1H", "2H"):
        fade(sev_h, sev_a, "**SEVERE (≥25ppg star OR 2+ regulars), other side not → FADE**", w)
    fade(sev_h & fav_h, sev_a & ~fav_h, "…severe side FAVORED → FADE", "FG")
    fade(sev_h & ~fav_h, sev_a & fav_h, "…severe side DOG → FADE", "FG")

    # ---------- C. both depleted → where do the points come from?
    lines.append("\n## C — both teams depleted → which half produces the points?\n")
    lines.append("| signal | n | win% | ROI | per-season |")
    lines.append("|---|---|---|---|---|")
    both = (G["h_fresh_n"] > 0) & (G["a_fresh_n"] > 0)
    fo, fod, fu, fud = mk["FG total"]
    ho, hod, hu, hud = mk["1H total"]
    bet(G, both, fo, fod, "both depleted → OVER [FG total]", lines)
    bet(G, both, ho, hod, "both depleted → OVER [1H total]", lines)
    bet(G, both, o2, flat, "both depleted → OVER [2H SYNTHETIC]", lines)
    both2 = (G["h_fresh_sum_ppg"] >= 10) & (G["a_fresh_sum_ppg"] >= 10)
    bet(G, both2, fo, fod, "both missing 10+ ppg → OVER [FG total]", lines)
    bet(G, both2, ho, hod, "both missing 10+ ppg → OVER [1H total]", lines)
    bet(G, both2, o2, flat, "both missing 10+ ppg → OVER [2H SYNTHETIC]", lines)
    ret = (G["h_ret_max_ppg"] >= 20) | (G["a_ret_max_ppg"] >= 20)
    bet(G, ret, fu, fud, "≥20ppg star RETURNING → UNDER [FG total]", lines)
    bet(G, ret, hu, hud, "≥20ppg star RETURNING → UNDER [1H total]", lines)
    bet(G, ret, 1 - o2, flat, "≥20ppg star RETURNING → UNDER [2H SYNTHETIC]", lines)

    # ---------- D. controlled mechanism regression
    lines.append("\n## D — Mechanism, controlled: 1H line as a function of the FG line\n")
    sub = G[G["t60_spread_home_point"].notna() & G["h1_spread"].notna()].copy()
    sub["sev_h"] = sev_h.astype(float)
    sub["sev_a"] = sev_a.astype(float)
    sub["star_h"] = ((sub["h_fresh_max_ppg"] >= 18) & (sub["h_fresh_max_ppg"] < 25)).astype(float)
    sub["star_a"] = ((sub["a_fresh_max_ppg"] >= 18) & (sub["a_fresh_max_ppg"] < 25)).astype(float)
    X = np.column_stack([np.ones(len(sub)), sub["t60_spread_home_point"],
                         sub["star_h"] - sub["star_a"], sub["sev_h"] - sub["sev_a"]])
    beta, *_ = np.linalg.lstsq(X, sub["h1_spread"].values, rcond=None)
    lines.append(f"- 1H_spread = {beta[0]:+.3f} + {beta[1]:.4f}·FG_spread "
                 f"{beta[2]:+.3f}·(star_out_home − star_out_away) "
                 f"{beta[3]:+.3f}·(severe_home − severe_away)")
    # same regression on the OUTCOME (actual 1H margin) — does reality shift the same way?
    Y = np.column_stack([np.ones(len(sub)), sub["t60_spread_home_point"],
                         sub["star_h"] - sub["star_a"], sub["sev_h"] - sub["sev_a"]])
    b2, *_ = np.linalg.lstsq(Y, (-(sub["home_score"] - sub["away_score"]) + 0).values, rcond=None)
    b3, *_ = np.linalg.lstsq(Y, (-sub["h1_margin"]).values, rcond=None)
    lines.append(f"- actual 1H margin (home, sign-flipped to line convention) = "
                 f"{b3[0]:+.3f} + {b3[1]:.4f}·FG_spread {b3[2]:+.3f}·star {b3[3]:+.3f}·severe")
    lines.append(f"- actual FG margin (same convention) = {b2[0]:+.3f} + {b2[1]:.4f}·FG_spread "
                 f"{b2[2]:+.3f}·star {b2[3]:+.3f}·severe")
    lines.append("")
    lines.append("Read: the star/severe coefficients on the LINE say how much extra the book "
                 "shades a depleted team beyond what the FG spread already carries; the same "
                 "coefficients on ACTUAL margin say whether the game agreed.")

    path = os.path.join(ROOT, "NBA_AVAIL_2H_BRIEF.md")
    with open(path, "w") as f:
        f.write("\n".join(lines) + "\n")
    print(f"wrote {path}")


if __name__ == "__main__":
    main()
