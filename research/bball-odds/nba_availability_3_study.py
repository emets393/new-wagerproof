#!/usr/bin/env python3
"""NBA availability round 3 — control the 1H finding, and price the team totals.

Round 2 (NBA_AVAIL_2H_BRIEF.md) produced one coherent story: absence damage is
BACK-LOADED. The book passes its full-game absence adjustment into the 1H line
proportionally (regression: the 1H line adds +0.009 for a star out, i.e. nothing
beyond 0.573x the FG number), but reality does not split that way — a moderately
depleted team BEATS the 1H number by ~1.5 and a severely depleted one loses most
of its ground after halftime.

Two things have to happen before any of that is bettable:

  1. CONTROLS. "Back the depleted team on the 1H spread" ran 58.9% when the
     depleted team was AWAY and 53.1% when it was HOME. That split is either
     real or an away-team artifact, and the only way to tell is to run the same
     bet on games with NO absence on either side, matched on spread.

  2. TEAM TOTALS. h1tt_nba_*.parquet carries FULL-GAME team totals per side at
     the same T-60 snapshot. A team total is the cleanest possible expression of
     "how much did the book take off for the guy who is out" — no opponent, no
     spread, just that team's points. If absences are mispriced anywhere it
     should show here.

The 2H column stays SYNTHETIC (line = FG - 1H, flat -110) and DIAGNOSTIC ONLY:
real 2H markets open at halftime off the actual 1H result, so a 2H edge measured
this way is an explanation, never a bet.
"""
import glob
import os

import numpy as np
import pandas as pd

from movement_study import am_to_dec
from nba_availability_1h_study import load, markets
from nba_halves_study2 import bet
from nba_availability_2h_study import synth_2h

ROOT = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(ROOT, "data", "parquet")


def tt_consensus():
    """FULL-GAME team totals at the T-60 close, medianed in DECIMAL price space."""
    h = pd.concat([pd.read_parquet(p) for p in
                   sorted(glob.glob(f"{OUT}/h1tt_nba_*.parquet"))], ignore_index=True)
    for c in ("tt_home_over_price", "tt_home_under_price",
              "tt_away_over_price", "tt_away_under_price"):
        h[c] = am_to_dec(h[c])
    return h.groupby("event_id").agg(
        tt_h=("tt_home_point", "median"), tt_h_o=("tt_home_over_price", "median"),
        tt_h_u=("tt_home_under_price", "median"),
        tt_a=("tt_away_point", "median"), tt_a_o=("tt_away_over_price", "median"),
        tt_a_u=("tt_away_under_price", "median")).reset_index()


def main():
    G = load().merge(tt_consensus(), on="event_id", how="left")
    mk = markets(G)
    o2, h2, flat = synth_2h(G)
    h1w, h1d, a1w, a1d = mk["1H spread"]
    fgw, fgd, faw, fad = mk["FG spread"]
    fav_h = G["t60_spread_home_point"] < 0

    L = ["# NBA availability round 3 — controls + team totals", "",
         f"{len(G):,} games, 3 seasons. FG/1H/TT graded at the T-60 consensus (decimal median). "
         "The 2H column is **SYNTHETIC and DIAGNOSTIC ONLY** — real 2H lines open at halftime "
         "off the actual 1H score, so nothing here is a 2H bet. BE 52.4%.", ""]

    def pair(mask_h, mask_a, label, which="1H", fade=False):
        """Bet the side flagged by mask_h/mask_a (or its opponent if fade)."""
        mh, ma = mask_h.fillna(False), mask_a.fillna(False)
        hw, hd, aw, ad = {"1H": (h1w, h1d, a1w, a1d), "FG": (fgw, fgd, faw, fad),
                          "2H": (h2, flat, 1 - h2, flat)}[which]
        if fade:
            hw, hd, aw, ad = aw, ad, hw, hd
        win = pd.Series(np.where(mh, hw, np.where(ma, aw, np.nan)), index=G.index)
        dec = pd.Series(np.where(mh, hd, np.where(ma, ad, np.nan)), index=G.index)
        bet(G, mh | ma, win, dec, f"{label} [{which}]", L)

    # signal definitions carried from round 2
    mod_h = (G["h_fresh_max_ppg"] >= 18) & (G["h_fresh_max_ppg"] < 25) & (G["a_fresh_max_ppg"] < 18)
    mod_a = (G["a_fresh_max_ppg"] >= 18) & (G["a_fresh_max_ppg"] < 25) & (G["h_fresh_max_ppg"] < 18)
    clean = (G["h_fresh_n"] == 0) & (G["a_fresh_n"] == 0)
    F = pd.Series(False, index=G.index)

    # ---------- A. is "back the depleted team in the 1H" an away-team artifact?
    L += ["## A — CONTROL: the same 1H bet with nobody out\n",
          "| signal | n | win% | ROI | per-season |", "|---|---|---|---|---|"]
    pair(mod_h, mod_a, "moderate star out → BACK depleted (pooled)", "1H")
    pair(F, mod_a, "…depleted team AWAY → BACK", "1H")
    pair(mod_h, F, "…depleted team HOME → BACK", "1H")
    pair(F, clean, "CONTROL nobody out → back AWAY", "1H")
    pair(clean, F, "CONTROL nobody out → back HOME", "1H")
    # matched on spread: away-depleted games sit in a particular spread band
    band = G["t60_spread_home_point"].abs()
    for lo, hi in ((0, 4), (4, 8), (8, 30)):
        b = (band >= lo) & (band < hi)
        pair(F, mod_a & b, f"…AWAY depleted, |FG spread| {lo}-{hi} → BACK", "1H")
        pair(F, clean & b, f"CONTROL nobody out, |FG spread| {lo}-{hi} → back AWAY", "1H")

    # ---------- B. robustness of the pooled moderate rule
    L += ["\n## B — moderate-star-out 1H back: robustness\n",
          "| signal | n | win% | ROI | per-season |", "|---|---|---|---|---|"]
    mod = mod_h | mod_a
    winB = pd.Series(np.where(mod_h, h1w, np.where(mod_a, a1w, np.nan)), index=G.index)
    decB = pd.Series(np.where(mod_h, h1d, np.where(mod_a, a1d, np.nan)), index=G.index)
    bet(G, mod, winB, decB, "pooled → BACK depleted [1H]", L)
    bet(G, mod, winB, pd.Series(1.909, index=G.index), "pooled, graded FLAT -110 [1H]", L)
    for s in sorted(G["season"].unique()):
        bet(G, mod & (G["season"] != s), winB, decB, f"pooled, DROP {s} [1H]", L)
    for lo, hi, nm in ((0, 20, "first 20 gp"), (20, 41, "games 20-40"), (41, 99, "games 41+")):
        bet(G, mod & (G["min_gp"] >= lo) & (G["min_gp"] < hi), winB, decB,
            f"pooled, {nm} [1H]", L)
    # does it need the opponent to be clean?
    mh2 = (G["h_fresh_max_ppg"] >= 18) & (G["h_fresh_max_ppg"] < 25)
    ma2 = (G["a_fresh_max_ppg"] >= 18) & (G["a_fresh_max_ppg"] < 25)
    pair(mh2 & ~ma2, ma2 & ~mh2, "moderate out, opponent ANY absence allowed → BACK", "1H")
    pair(mod_h & (G["h_top1_out"] == 1), mod_a & (G["a_top1_out"] == 1),
         "…and he is the MINUTES leader → BACK", "1H")
    pair(mod_h & (G["h_top1_out"] == 0), mod_a & (G["a_top1_out"] == 0),
         "…and he is NOT the minutes leader → BACK", "1H")

    # ---------- C. the back-loading curve (diagnostic)
    L += ["\n## C — DIAGNOSTIC: where the damage lands, by points removed\n",
          "| points removed | n | mean 1H edge (pts vs 1H line) | mean 2H edge (vs synthetic) | "
          "FG edge |", "|---|---|---|---|---|"]
    # signed toward the depleted team, in points of cover margin
    dep_h = (G["h_fresh_sum_ppg"] > 0) & (G["a_fresh_sum_ppg"] == 0)
    dep_a = (G["a_fresh_sum_ppg"] > 0) & (G["h_fresh_sum_ppg"] == 0)
    ppg = np.where(dep_h, G["h_fresh_sum_ppg"], np.where(dep_a, G["a_fresh_sum_ppg"], np.nan))
    h1cov_h = G["h1_cov_home"]
    fgcov_h = (G["home_score"] - G["away_score"]) + G["t60_spread_home_point"]
    h2cov_h = ((G["home_score"] - G["away_score"]) - G["h1_margin"]) + \
              (G["t60_spread_home_point"] - G["h1_spread"])
    sgn = pd.Series(np.where(dep_h, 1.0, np.where(dep_a, -1.0, np.nan)), index=G.index)
    for lo, hi in ((0.01, 12), (12, 20), (20, 30), (30, 999)):
        m = (ppg >= lo) & (ppg < hi)
        n = int(np.nansum(m))
        if n < 40:
            continue
        L.append(f"| {lo:.0f}-{hi if hi < 999 else '∞'} ppg out | {n:,} | "
                 f"{(sgn * h1cov_h)[m].mean():+.2f} | {(sgn * h2cov_h)[m].mean():+.2f} | "
                 f"{(sgn * fgcov_h)[m].mean():+.2f} |")
    L.append("")
    L.append("Positive = the depleted team beat that line. A number that is positive in the 1H "
             "and negative in the 2H is the back-loading, measured directly.")

    # ---------- D. full-game TEAM TOTALS
    L += ["\n## D — FULL-GAME team totals (T-60), the cleanest absence market\n",
          "| signal | n | win% | ROI | per-season |", "|---|---|---|---|---|"]
    h_pts, a_pts = G["home_score"], G["away_score"]
    tth_o = pd.Series(np.where(h_pts > G["tt_h"], 1.0, np.where(h_pts < G["tt_h"], 0.0, np.nan)),
                      index=G.index)
    tta_o = pd.Series(np.where(a_pts > G["tt_a"], 1.0, np.where(a_pts < G["tt_a"], 0.0, np.nan)),
                      index=G.index)

    def tt(mask_h, mask_a, label, side="under"):
        """Bet the depleted team's own team total (under by default)."""
        mh, ma = mask_h.fillna(False), mask_a.fillna(False)
        if side == "under":
            win = pd.Series(np.where(mh, 1 - tth_o, np.where(ma, 1 - tta_o, np.nan)), index=G.index)
            dec = pd.Series(np.where(mh, G["tt_h_u"], np.where(ma, G["tt_a_u"], np.nan)),
                            index=G.index)
        else:
            win = pd.Series(np.where(mh, tth_o, np.where(ma, tta_o, np.nan)), index=G.index)
            dec = pd.Series(np.where(mh, G["tt_h_o"], np.where(ma, G["tt_a_o"], np.nan)),
                            index=G.index)
        bet(G, mh | ma, win, dec, f"{label} [TT {side}]", L)

    tt(clean, F, "CONTROL nobody out → HOME team total", "under")
    tt(F, clean, "CONTROL nobody out → AWAY team total", "under")
    for lo in (18, 25):
        sh = (G["h_fresh_max_ppg"] >= lo) & (G["a_fresh_max_ppg"] < 18)
        sa = (G["a_fresh_max_ppg"] >= lo) & (G["h_fresh_max_ppg"] < 18)
        tt(sh, sa, f"≥{lo}ppg star out → depleted team's OWN total", "under")
        tt(sh, sa, f"≥{lo}ppg star out → depleted team's OWN total", "over")
        # the OPPONENT of a depleted team: more possessions, weaker defence?
        tt(sa, sh, f"≥{lo}ppg star out → the OPPONENT's total", "over")
    for lo in (20, 30, 40):
        sh = (G["h_fresh_sum_ppg"] >= lo) & (G["a_fresh_sum_ppg"] < 10)
        sa = (G["a_fresh_sum_ppg"] >= lo) & (G["h_fresh_sum_ppg"] < 10)
        tt(sh, sa, f"{lo}+ ppg removed → depleted team's OWN total", "under")
        tt(sh, sa, f"{lo}+ ppg removed → depleted team's OWN total", "over")
    rh = G["h_ret_max_ppg"] >= 20
    ra = G["a_ret_max_ppg"] >= 20
    tt(rh & ~ra, ra & ~rh, "≥20ppg star RETURNING → his team's total", "under")
    # stale (long-term) absences should be fully priced — clean negative control
    sth = (G["h_stale_sum_ppg"] >= 20) & (G["h_fresh_n"] == 0)
    sta = (G["a_stale_sum_ppg"] >= 20) & (G["a_fresh_n"] == 0)
    tt(sth & ~sta, sta & ~sth, "CONTROL stale 20+ ppg out (priced) → own total", "under")

    # ---------- E. the one cell that survived the control, pressure-tested
    L += ["\n## E — AWAY team missing a moderate scorer, close game (the survivor)\n",
          "| signal | n | win% | ROI | per-season |", "|---|---|---|---|---|"]
    close = band < 8
    A8 = mod_a & close
    winE = pd.Series(np.where(A8, a1w, np.nan), index=G.index)
    decE = pd.Series(np.where(A8, a1d, np.nan), index=G.index)
    bet(G, A8, winE, decE, "**AWAY moderate star out, |FG spread|<8 → BACK away [1H]**", L)
    bet(G, A8, winE, pd.Series(1.909, index=G.index), "…graded FLAT -110", L)
    for s in sorted(G["season"].unique()):
        bet(G, A8 & (G["season"] != s), winE, decE, f"…DROP {s}", L, min_n=30)
    # the mirror: does the same rule work at home? (it should not, per section A)
    H8 = mod_h & close
    bet(G, H8, pd.Series(np.where(H8, h1w, np.nan), index=G.index),
        pd.Series(np.where(H8, h1d, np.nan), index=G.index),
        "MIRROR: HOME moderate star out, |FG spread|<8 → BACK home [1H]", L)
    # does it also show on the full game? (if yes it is a priced-absence bet, not a 1H edge)
    bet(G, A8, pd.Series(np.where(A8, faw, np.nan), index=G.index),
        pd.Series(np.where(A8, fad, np.nan), index=G.index),
        "SPECIFICITY: same games on the FULL-GAME spread", L)
    bet(G, A8, pd.Series(np.where(A8, 1 - h2, np.nan), index=G.index),
        pd.Series(1.909, index=G.index),
        "SPECIFICITY: same games, 2H SYNTHETIC (fade away)", L)
    # secondary-scorer refinement from section B
    bet(G, A8 & (G["a_top1_out"] == 0), winE, decE, "…and he is NOT the minutes leader", L, min_n=30)
    bet(G, A8 & (G["a_top1_out"] == 1), winE, decE, "…and he IS the minutes leader", L, min_n=30)

    path = os.path.join(ROOT, "NBA_AVAIL_3_BRIEF.md")
    with open(path, "w") as f:
        f.write("\n".join(L) + "\n")
    print(f"wrote {path}")


if __name__ == "__main__":
    main()
