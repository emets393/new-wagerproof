#!/usr/bin/env python3
"""NBA signal hunt, stage 2: pre-registered hypotheses + walk-forward validation.

Why this file exists. `nba_hunt_sweep.py` ran 233,702 blind cells and returned nothing,
and the reason is arithmetic, not data: the best cell under pure noise across that many
cells lands at z = 4.46, while S9 -- the one NBA signal we have already validated
end-to-end -- scores z = 2.04 at the T-60 close. A blind sweep with a family-wise bar
CANNOT surface a real NBA-strength edge. The search design was the binding constraint.

So this file changes the design in three ways:

1. **Pre-registration.** A hand-written hypothesis list drawn from the families the owner
   named (last-3 form, last series vs the same team, form measured against THIS game's
   line, power ratings vs the line, regression deltas), from the published literature
   (Lust's continuous elimination ratio, the early-season totals bias), and from markets
   nobody has published on (team totals, 1H, meeting number, NBA Cup). A few hundred cells
   instead of a quarter million drops the noise bar from 4.46 to roughly 3.

2. **Union masks and gp-aligned windows.** The sweep could only build AND intersections,
   but S9 is a UNION -- `eliminated OR tank` -- inside a `min(gp) >= 50` window that
   matched no phase it knew about. S9-shaped rules were literally inexpressible.

3. **Tiering instead of a single pass/fail.** Family-wise significance is the strictest
   bar and almost nothing in NBA clears it. A rule that is positive in 3 of 4 seasons AND
   positive on held-out seasons AND survives a mechanism control is worth tracking even at
   z = 2.2 -- that is exactly the evidence that made S9 trustworthy, and it was never a
   family-wise argument.

Stage B is the wide search done honestly: discover cuts on 2022-23 + 2023-24 only, then
score them on 2024-25 + 2025-26. The statistic is the AGGREGATE held-out ROI of everything
discovery picked, which has power precisely because it does not depend on one lucky cell,
and the null re-runs discovery AND validation on shuffled outcomes so the search is priced.

    python3 nba_hunt_validate.py --perms 400
    python3 nba_hunt_validate.py --stage B --perms 200
"""
import argparse
import hashlib
import os
import warnings

import numpy as np
import pandas as pd

from nba_hunt_sweep import build_markets, market_arrays, LEAK, CUTS

warnings.filterwarnings("ignore")
ROOT = os.path.dirname(os.path.abspath(__file__))
PQ = os.path.join(ROOT, "data", "parquet")

DISCOVER = ["2022-23", "2023-24"]
VALIDATE = ["2024-25", "2025-26"]

# Phase universes. Note gp50/gp25 -- these are games-played windows, not calendar phases,
# and S9 lives in gp50. The sweep had no such universe, which is one reason it could not
# see it.
PH = {
    "all":       lambda d: d["postseason"] == 0,
    "early":     lambda d: d["phase"] == "early",
    "mid":       lambda d: d["phase"] == "mid",
    "late":      lambda d: d["phase"] == "late",
    "veryLate":  lambda d: d["phase"] == "veryLate",
    "stretch":   lambda d: d["phase"].isin(["late", "veryLate"]),
    "playoffs":  lambda d: d["phase"] == "playoffs",
    "gp50":      lambda d: (d["postseason"] == 0) & (d["min_gp"] >= 50),
    "gp25":      lambda d: (d["postseason"] == 0) & (d["min_gp"] >= 25),
    "postdl":    lambda d: (d["postseason"] == 0) & (d["st_post_deadline"] == 1),
}


# ------------------------------------------------------ hypothesis library ---

def hypotheses(d):
    """Pre-registered rules. Each is (key, family, phase, boolean mask, market, note).

    Written before looking at any result on this frame, from the owner's named families
    plus the literature. Both directions are registered wherever theory does not fix the
    sign -- registering only the direction that happens to work is how a sweep launders
    itself as a hypothesis test.
    """
    H = []

    def add(key, fam, phase, mask, market, note=""):
        m = np.asarray(mask)
        H.append({"key": key, "family": fam, "phase": phase, "mask": m,
                  "market": market, "note": note})

    def q(col, p):
        return d[col].quantile(p)

    # --- F1 last-3 / last-5 form. The literature says this is DEAD (Lust 2018 joint
    # F-test p=0.603 on last-1/3/5 ATS and SU records, corroborated on 34 seasons).
    # Registered anyway because the owner asked for it explicitly and a cheap honest
    # null is worth more than me quoting a paper at him.
    for w in (3, 5):
        hot_h = d[f"h_l{w}_cover"] >= (0.99 if w == 3 else 0.79)
        hot_a = d[f"a_l{w}_cover"] >= (0.99 if w == 3 else 0.79)
        cold_h = d[f"h_l{w}_cover"] <= 0.01
        cold_a = d[f"a_l{w}_cover"] <= 0.01
        add(f"form_hot_home_l{w}_fade", "form", "all", hot_h, "fg_spread_away",
            f"home covered all of last {w} -> fade")
        add(f"form_hot_home_l{w}_ride", "form", "all", hot_h, "fg_spread_home", "ride it")
        add(f"form_hot_away_l{w}_fade", "form", "all", hot_a, "fg_spread_home", "")
        add(f"form_cold_home_l{w}_back", "form", "all", cold_h, "fg_spread_home",
            f"home failed to cover all of last {w} -> back")
        add(f"form_cold_away_l{w}_back", "form", "all", cold_a, "fg_spread_away", "")
    for k in (3, 4, 5):
        add(f"form_ats_streak_h{k}_fade", "form", "all", d["h_streak_ats"] >= k,
            "fg_spread_away", f"home on a {k}+ ATS win streak -> fade")
        add(f"form_ats_streak_a{k}_fade", "form", "all", d["a_streak_ats"] >= k,
            "fg_spread_home", "")
        add(f"form_su_streak_h{k}_fade", "form", "all", d["h_streak_su"] >= k,
            "fg_spread_away", "")
        add(f"form_su_streak_h{k}_ride", "form", "all", d["h_streak_su"] >= k,
            "fg_spread_home", "")

    # --- F2 last series vs the same team. Greenfield: nothing published on meeting
    # number or on the previous meeting's margin as a predictor of THIS one.
    rec = d["h2h_days"] <= 21
    add("h2h_prev_cover_fade", "h2h", "all", rec & (d["h2h_prev_cover_h"] == 1),
        "fg_spread_away", "home covered the last meeting -> anti-persistence")
    add("h2h_prev_cover_ride", "h2h", "all", rec & (d["h2h_prev_cover_h"] == 1),
        "fg_spread_home", "")
    add("h2h_prev_loss_back", "h2h", "all", rec & (d["h2h_prev_cover_h"] == 0),
        "fg_spread_home", "")
    add("h2h_blowout_regress", "h2h", "all",
        rec & (d["h2h_prev_ats_margin_h"].abs() >= 14), "fg_spread_away",
        "last meeting was an ATS blowout -> regression")
    add("h2h_prev_over_under", "h2h", "all", rec & (d["h2h_prev_ou_margin"] > 0),
        "fg_total_under", "last meeting went over -> under now")
    add("h2h_prev_under_over", "h2h", "all", rec & (d["h2h_prev_ou_margin"] < 0),
        "fg_total_over", "")
    for k in (2, 3, 4):
        add(f"h2h_meet{k}_under", "h2h", "all", d["meet_n"] >= k, "fg_total_under",
            f"{k}th+ meeting of the season -> familiarity depresses scoring")
        add(f"h2h_meet{k}_over", "h2h", "all", d["meet_n"] >= k, "fg_total_over", "")
    add("h2h_meet3_h1_under", "h2h", "all", d["meet_n"] >= 3, "h1_total_under",
        "familiarity should bite hardest in the scripted first half")

    # --- F3 recent form measured against THIS game's line. The owner named this one
    # specifically and it is not in any published study I found: not "is the team hot"
    # but "is the team hot RELATIVE TO WHAT THIS LINE ASKS OF THEM".
    for w in (3, 5, 10):
        c = f"pair_l{w}_margin_vs_line"
        if c in d:
            add(f"vsline_margin_l{w}_hi", "vs_line", "all", d[c] >= q(c, 0.85),
                "fg_spread_home", f"both teams' last-{w} margins say home is underpriced")
            add(f"vsline_margin_l{w}_lo", "vs_line", "all", d[c] <= q(c, 0.15),
                "fg_spread_away", "")
        c = f"pair_l{w}_gtot_vs_line"
        if c in d:
            add(f"vsline_total_l{w}_hi", "vs_line", "all", d[c] >= q(c, 0.85),
                "fg_total_over", f"last-{w} combined scoring is well above this total")
            add(f"vsline_total_l{w}_lo", "vs_line", "all", d[c] <= q(c, 0.15),
                "fg_total_under", "")
            # fade versions -- if the market has already adjusted, recent scoring is a
            # trap and the correct bet is the opposite one
            add(f"vsline_total_l{w}_hi_fade", "vs_line", "all", d[c] >= q(c, 0.85),
                "fg_total_under", "")
            add(f"vsline_total_l{w}_lo_fade", "vs_line", "all", d[c] <= q(c, 0.15),
                "fg_total_over", "")
    both_hi = (d["h_l5_gtot_vs_line"] > 3) & (d["a_l5_gtot_vs_line"] > 3)
    both_lo = (d["h_l5_gtot_vs_line"] < -3) & (d["a_l5_gtot_vs_line"] < -3)
    add("vsline_both_hi_over", "vs_line", "all", both_hi, "fg_total_over",
        "BOTH teams' last 5 are 3+ points above this total -- agreement, not one outlier")
    add("vsline_both_hi_under", "vs_line", "all", both_hi, "fg_total_under", "")
    add("vsline_both_lo_under", "vs_line", "all", both_lo, "fg_total_under", "")
    add("vsline_both_lo_over", "vs_line", "all", both_lo, "fg_total_over", "")
    add("vsline_both_hi_tt_home", "vs_line", "all", both_hi, "tt_home_over", "")
    add("vsline_both_lo_tt_home", "vs_line", "all", both_lo, "tt_home_under", "")
    add("vsline_both_hi_h1_over", "vs_line", "all", both_hi, "h1_total_over", "")
    add("vsline_both_lo_h1_under", "vs_line", "all", both_lo, "h1_total_under", "")
    add("vsline_need_h_hi", "vs_line", "all",
        d["h_l5_margin_vs_need"] >= q("h_l5_margin_vs_need", 0.85), "fg_spread_home",
        "home's last 5 margins clear what this spread asks by a wide margin")
    add("vsline_need_h_lo", "vs_line", "all",
        d["h_l5_margin_vs_need"] <= q("h_l5_margin_vs_need", 0.15), "fg_spread_away", "")

    # --- F4 power ratings vs the line. rt_spread_gap = opponent-adjusted implied margin
    # minus the market's. Straight model-vs-market disagreement, stated in POINTS.
    for thr in (2.0, 3.0, 4.5):
        add(f"rt_spread_gap_hi{thr}", "ratings", "all", d["rt_spread_gap"] >= thr,
            "fg_spread_home", f"ratings say home by {thr}+ more than the line")
        add(f"rt_spread_gap_lo{thr}", "ratings", "all", d["rt_spread_gap"] <= -thr,
            "fg_spread_away", "")
        add(f"rt_spread_gap_hi{thr}_ml", "ratings", "all", d["rt_spread_gap"] >= thr,
            "fg_ml_home", "")
    for thr in (3.0, 5.0, 7.0):
        add(f"rt_total_gap_hi{thr}", "ratings", "all", d["rt_total_gap"] >= thr,
            "fg_total_over", f"ratings imply a total {thr}+ above the market's")
        add(f"rt_total_gap_lo{thr}", "ratings", "all", d["rt_total_gap"] <= -thr,
            "fg_total_under", "")
        add(f"rt_total_gap_hi{thr}_fade", "ratings", "all", d["rt_total_gap"] >= thr,
            "fg_total_under", "")
    add("rt_total_gap_hi_h1", "ratings", "all", d["rt_total_gap"] >= 5, "h1_total_over", "")
    add("rt_total_gap_lo_h1", "ratings", "all", d["rt_total_gap"] <= -5, "h1_total_under", "")

    # --- F5 regression deltas: last-N MINUS season-to-date. This is "playing above or
    # below its own norm", which is a different question from "is it good".
    for w in (3, 5):
        for side, mk_back, mk_fade in (("h", "fg_spread_home", "fg_spread_away"),
                                       ("a", "fg_spread_away", "fg_spread_home")):
            c = f"{side}_d{w}_margin"
            add(f"reg_{side}_d{w}_cold_back", "regress", "all", d[c] <= q(c, 0.15),
                mk_back, f"{side} playing {w}-game stretch well below its own season norm")
            add(f"reg_{side}_d{w}_hot_fade", "regress", "all", d[c] >= q(c, 0.85),
                mk_fade, "")
        c = f"d_d{w}_own"
        add(f"reg_scoring_d{w}_hi_under", "regress", "all", d[c] >= q(c, 0.85),
            "fg_total_under", "scoring spike vs own norm -> unsustainable")
        add(f"reg_scoring_d{w}_lo_over", "regress", "all", d[c] <= q(c, 0.15),
            "fg_total_over", "")
        c = f"h_d{w}_atsm"
        add(f"reg_h_d{w}_atsm_lo", "regress", "all", d[c] <= q(c, 0.15), "fg_spread_home", "")
        add(f"reg_h_d{w}_atsm_hi", "regress", "all", d[c] >= q(c, 0.85), "fg_spread_away", "")

    # --- F6 standings / motivation. S9's family. The union mask is the point: the sweep
    # could only build intersections and S9 is `eliminated OR tank`.
    dead_h = (d["st_h_eliminated"] > 0) | (d["st_h_tank"] > 0)
    dead_a = (d["st_a_eliminated"] > 0) | (d["st_a_tank"] > 0)
    add("S9_dead_home_fav", "standings", "gp50", dead_h, "fg_spread_fav",
        "CALIBRATION -- this is S9 exactly; the harness must reproduce it")
    add("S9_dead_home_fav_veryLate", "standings", "veryLate", dead_h, "fg_spread_fav", "")
    add("S9c_dead_away_fav", "standings", "gp50", dead_a, "fg_spread_fav",
        "CONTROL -- away team dead was null in the original work; it must stay null")
    add("S9_dead_home_ml_fav", "standings", "gp50", dead_h, "fg_ml_fav", "")
    add("S9_dead_home_h1_fav", "standings", "gp50", dead_h, "h1_spread_fav",
        "does quitting show up in the first half too?")
    add("S9_dead_home_over", "standings", "gp50", dead_h, "fg_total_over",
        "a team that has stopped defending should push totals up")
    add("S9_dead_home_tt_away_over", "standings", "gp50", dead_h, "tt_away_over", "")
    add("S9_both_done_over", "standings", "gp50", d["st_both_done"] == 1, "fg_total_over",
        "neither team needs it -> nobody defends")
    add("S9_both_done_under", "standings", "gp50", d["st_both_done"] == 1, "fg_total_under", "")
    add("S9_one_needs_it_fav", "standings", "gp50", d["st_one_needs_it"] == 1,
        "fg_spread_fav", "")
    add("clinch_home_fade", "standings", "gp50", d["st_h_clinched"] == 1, "fg_spread_away",
        "CONTROL -- clinched was 49.2% originally, i.e. quitting is not the same as resting")
    # Lust 2018's continuous version: games-back per game remaining, so a 5-game deficit
    # in December is not treated like a 5-game deficit in April.
    for thr in (0.10, 0.20, 0.35):
        add(f"gbr_home_hi{thr}", "standings", "gp25", d["gbr_h"] >= thr, "fg_spread_away",
            f"home is {thr} games back per game left -> fade")
        add(f"gbr_dog_hi{thr}", "standings", "gp25", d["gbr_dog"] >= thr, "fg_spread_fav",
            "the underdog is the one that is out of it")
    add("postdl_dead_home_fav", "standings", "postdl", dead_h, "fg_spread_fav",
        "post trade-deadline sharpens the tanking signal")

    # --- F7 early-season totals bias. Baryla 2007 found 56.72% AGAINST THE CLOSE on
    # early unders; Girdner 2013 found week-1 unders at 58.2%. Both are old regimes and
    # the mechanism (market anchored on last season's pace) predicts the sign FLIPS in a
    # season where pace accelerates -- so the per-season breakout is not optional here.
    add("early_under", "early_bias", "early", np.ones(len(d), bool), "fg_total_under",
        "the classic early-season under")
    add("early_over", "early_bias", "early", np.ones(len(d), bool), "fg_total_over", "")
    veryearly = d["min_gp"] <= 5
    add("wk1_under", "early_bias", "all", veryearly, "fg_total_under", "")
    add("wk1_over", "early_bias", "all", veryearly, "fg_total_over", "")
    add("early_h1_under", "early_bias", "early", np.ones(len(d), bool), "h1_total_under", "")
    add("early_dog", "early_bias", "early", np.ones(len(d), bool), "fg_spread_dog",
        "early lines are least accurate -> dogs should be underpriced")

    # --- F8 greenfield markets and contexts nobody has published on.
    add("cup_over", "context", "all", d["is_cup"] == 1, "fg_total_over",
        "NBA Cup group games -- point differential is a tiebreaker, so teams press")
    add("cup_under", "context", "all", d["is_cup"] == 1, "fg_total_under", "")
    add("cup_fav", "context", "all", d["is_cup"] == 1, "fg_spread_fav",
        "the tiebreaker rewards running up the score")
    add("div_under", "context", "all", d["is_divisional"] == 1, "fg_total_under", "")
    add("div_dog", "context", "all", d["is_divisional"] == 1, "fg_spread_dog", "")
    add("b2b_home_fade", "context", "all", d["h_b2b"] == 1, "fg_spread_away", "")
    add("b2b_away_fade", "context", "all", d["a_b2b"] == 1, "fg_spread_home", "")
    add("b2b_both_under", "context", "all", (d["h_b2b"] == 1) & (d["a_b2b"] == 1),
        "fg_total_under", "")
    rest_edge = d["h_rest_days"] - d["a_rest_days"]
    add("rest_edge_home", "context", "all", rest_edge >= 2, "fg_spread_home", "")
    add("rest_edge_away", "context", "all", rest_edge <= -2, "fg_spread_away", "")
    add("b2b_away_h1_home", "context", "all", d["a_b2b"] == 1, "h1_spread_home",
        "a tired team should fade late, not early -- so the 1H is the wrong half; control")
    add("b2b_away_tt_under", "context", "all", d["a_b2b"] == 1, "tt_away_under", "")

    # --- F9 line movement. Reverse line movement on totals is the one movement angle
    # with published support; the naive follow/fade versions already lost against T-60 in
    # earlier work, so both directions are registered.
    for c, mk_up, mk_dn in (("open_total_move", "fg_total_over", "fg_total_under"),
                            ("late_total_move", "fg_total_over", "fg_total_under")):
        if c in d:
            add(f"{c}_up_follow", "movement", "all", d[c] >= 2.0, mk_up, "")
            add(f"{c}_up_fade", "movement", "all", d[c] >= 2.0, mk_dn, "")
            add(f"{c}_dn_follow", "movement", "all", d[c] <= -2.0, mk_dn, "")
            add(f"{c}_dn_fade", "movement", "all", d[c] <= -2.0, mk_up, "")
    for c in ("open_spread_move", "late_spread_move"):
        if c in d:
            add(f"{c}_to_home", "movement", "all", d[c] <= -1.5, "fg_spread_home", "")
            add(f"{c}_to_home_fade", "movement", "all", d[c] <= -1.5, "fg_spread_away", "")
            add(f"{c}_to_away", "movement", "all", d[c] >= 1.5, "fg_spread_away", "")

    # --- F10 over/under streaks. S7 is the 1H version and is proven; the full-game
    # version was 51.3%/-2.0% and is registered here as the control that should stay dead.
    same_ou = (d["h_streak_ou"] >= 3) & (d["a_streak_ou"] >= 3)
    same_un = (d["h_streak_ou"] <= -3) & (d["a_streak_ou"] <= -3)
    add("ou_streak_both_over_fade", "streaks", "all", same_ou, "fg_total_under", "")
    add("ou_streak_both_under_fade", "streaks", "all", same_un, "fg_total_over", "")
    add("ou_streak_both_over_tt", "streaks", "all", same_ou, "tt_home_under", "")

    return H


# -------------------------------------------------------------- evaluation ---

def cell_stats(mask, phase_mask, y, price, min_n):
    """Bet count, win rate, ROI, and the in-slice comparator, for one cell.

    The comparator is the SAME market bet blind across the SAME phase universe. Not 50%.
    Backing favourites in the last third of the season is already ~53%, so a late-season
    favourite rule graded against 50% reads three points better than it is -- that is the
    single most common way a signal gets oversold.
    """
    ok = np.isfinite(y) & np.isfinite(price)
    cell = mask & phase_mask & ok
    base = phase_mask & ok
    n = int(cell.sum())
    if n < min_n or base.sum() < 50:
        return None
    prof = np.where(y > 0, price - 1.0, -1.0)
    roi, win = prof[cell].mean(), y[cell].mean()
    broi, bwin = prof[base].mean(), y[base].mean()
    sd = prof[base].std()
    z = (roi - broi) / (sd / np.sqrt(n)) if sd > 0 else np.nan
    return {"n": n, "win": 100 * win, "base_win": 100 * bwin, "edge": 100 * (win - bwin),
            "roi": 100 * roi, "base_roi": 100 * broi, "z": z}


def stage_a(d, markets, args):
    H = hypotheses(d)
    print(f"pre-registered hypotheses: {len(H)}")
    season = d["season"].to_numpy()
    ph_cache = {k: PH[k](d).to_numpy() for k in PH}

    rows = []
    for h in H:
        y, price = markets[h["market"]]
        st = cell_stats(h["mask"], ph_cache[h["phase"]], y, price, args.min_n)
        if st is None:
            continue
        r = {"key": h["key"], "family": h["family"], "phase": h["phase"],
             "market": h["market"], "note": h["note"], **st}
        # Per season and split-half. A rule that lives in one season is a rule about that
        # season, and 3-of-4 consistency is the filter noise almost never passes.
        pos, seas = 0, []
        for s in sorted(set(season)):
            ss = cell_stats(h["mask"] & (season == s), ph_cache[h["phase"]] & (season == s),
                            y, price, 25)
            seas.append(f"{ss['roi']:+.0f}" if ss else "  .")
            if ss and ss["roi"] > 0:
                pos += 1
        r["seasons_pos"] = pos
        r["by_season"] = "/".join(seas)
        dm, vm = np.isin(season, DISCOVER), np.isin(season, VALIDATE)
        for tag, sm in (("disc", dm), ("val", vm)):
            ss = cell_stats(h["mask"] & sm, ph_cache[h["phase"]] & sm, y, price, 40)
            r[f"{tag}_roi"] = ss["roi"] if ss else np.nan
            r[f"{tag}_n"] = ss["n"] if ss else 0
        rows.append(r)
    res = pd.DataFrame(rows)

    # ---- family-wise null over THIS set only ----
    rng = np.random.default_rng(args.seed)
    idx_by_season = [np.flatnonzero(season == s) for s in np.unique(season)]
    keep = [h for h in H if h["key"] in set(res["key"])]
    null_max = np.zeros(args.perms)
    for k in range(args.perms):
        perm = np.arange(len(d))
        for ix in idx_by_season:
            perm[ix] = rng.permutation(ix)
        best = -np.inf
        for h in keep:
            y, price = markets[h["market"]]
            st = cell_stats(h["mask"], ph_cache[h["phase"]], y[perm], price[perm], args.min_n)
            if st and np.isfinite(st["z"]):
                best = max(best, st["z"])
        null_max[k] = best
        if (k + 1) % 50 == 0:
            print(f"  perm {k+1}/{args.perms}  null best z so far "
                  f"{np.median(null_max[:k+1]):.2f} med / {null_max[:k+1].max():.2f} max")
    thr = np.quantile(null_max, 0.95)
    res["search_p"] = res["z"].apply(lambda v: float((null_max >= v).mean()))
    print(f"\nnull best-cell z over {len(keep)} pre-registered cells: "
          f"median {np.median(null_max):.2f}, 95th {thr:.2f}, max {null_max.max():.2f}")

    # Tiering. PROVEN is family-wise; TRACK is the S9-style evidence stack -- consistent
    # across seasons, positive on held-out seasons, and z >= 2 -- which is the bar that
    # actually made S9 trustworthy. Family-wise alone would have rejected S9 (z = 2.04).
    def tier(r):
        if r["z"] >= thr:
            return "PROVEN"
        if r["z"] >= 2.0 and r["seasons_pos"] >= 3 and r["val_roi"] > 0 and r["val_n"] >= 60:
            return "TRACK"
        if r["z"] >= 1.6 and r["seasons_pos"] == 4 and r["val_roi"] > 0:
            return "WATCH"
        return "-"
    res["tier"] = res.apply(tier, axis=1)
    res = res.sort_values("z", ascending=False)
    res.to_csv(os.path.join(ROOT, "nba_hunt_prereg.csv"), index=False)

    cal = res[res.key.str.startswith("S9_dead_home_fav") | res.key.str.startswith("S9c")]
    print("\n== calibration: S9 and its control ==")
    print(cal[["key", "phase", "market", "n", "win", "base_win", "edge", "roi",
               "base_roi", "z", "by_season"]].to_string(index=False,
                                                        float_format=lambda x: f"{x:7.2f}"))

    show = ["key", "family", "phase", "market", "n", "win", "base_win", "edge", "roi",
            "base_roi", "z", "seasons_pos", "by_season", "disc_roi", "val_roi", "tier"]
    hits = res[res.tier != "-"]
    print(f"\n== survivors ({len(hits)} of {len(res)}) ==")
    print(hits[show].to_string(index=False, float_format=lambda x: f"{x:7.2f}")
          if len(hits) else "  none")
    print("\n== top 30 by z ==")
    print(res.head(30)[show].to_string(index=False, float_format=lambda x: f"{x:7.2f}"))
    print("\n== by family: how much of the set is even positive ==")
    fam = res.groupby("family").agg(cells=("z", "size"), med_z=("z", "median"),
                                    max_z=("z", "max"), med_roi=("roi", "median"))
    print(fam.to_string(float_format=lambda x: f"{x:7.2f}"))
    return res


# ------------------------------------------------- stage B: walk-forward ----

def build_masks_oos(d, cols, thr_rows, min_n):
    """Masks whose CUT THRESHOLDS come only from the discovery seasons.

    Taking the 85th percentile over all four seasons and then claiming the last two are
    held out is a lie -- the threshold already saw them.
    """
    masks, meta, seen = [], [], set()
    for pname, pfun in PH.items():
        pmask = pfun(d).to_numpy()
        if pmask.sum() < min_n * 3:
            continue
        for c in cols:
            v = d[c].to_numpy(float)
            sub = v[pmask & thr_rows & np.isfinite(v)]
            if len(sub) < min_n * 2:
                continue
            uniq = np.unique(sub)
            cands = []
            if len(uniq) <= 6:
                for u in uniq:
                    cands.append((f"{c} == {u:g}", v == u))
                    if len(uniq) > 2:
                        cands.append((f"{c} >= {u:g}", v >= u))
            else:
                for (cname, qq), thr in zip(CUTS, np.quantile(sub, [q for _, q in CUTS])):
                    m = (v >= thr) if cname.startswith("hi") else (v <= thr)
                    cands.append((f"{c} {'>=' if cname.startswith('hi') else '<='} {thr:.4g}", m))
            if sub.min() < 0 < sub.max():
                cands += [(f"{c} > 0", v > 0), (f"{c} < 0", v < 0)]
            for label, m in cands:
                full = pmask & np.isfinite(v) & m
                if (full & thr_rows).sum() < min_n or (full & ~thr_rows).sum() < min_n // 2:
                    continue
                h = hashlib.blake2b(np.packbits(full).tobytes(), digest_size=16).digest()
                if h in seen:
                    continue
                seen.add(h)
                masks.append(full)
                meta.append({"phase": pname, "feature": c, "rule": label})
    return np.asarray(masks, np.float32), pd.DataFrame(meta)


def oos_pass(M, meta, S, nmk, names, ph_rows, disc, val, min_n, z_pick):
    """Discover on `disc`, score the picks on `val`. Returns the aggregate statistic.

    The statistic is the mean held-out ROI over everything discovery selected, plus the
    share of picks that stayed positive. Aggregating is what buys power here: a
    family-wise max over the selected set would face the same 233k-cell problem the blind
    sweep did, because under noise ~5% of cells pass discovery and get tested anyway.
    """
    out = {}
    for tag, rows in (("d", disc), ("v", val)):
        Mr = M * rows[None, :]
        C = Mr @ S
        W, N, PR = C[:, :nmk], C[:, nmk:2 * nmk], C[:, 2 * nmk:3 * nmk]
        bp = np.zeros_like(W)
        bsd = np.zeros_like(W)
        for pname, prow in ph_rows.items():
            c = (prow * rows).astype(np.float32) @ S
            nn = np.maximum(c[nmk:2 * nmk], 1)
            mu = c[2 * nmk:3 * nmk] / nn
            sd = np.sqrt(np.maximum(c[3 * nmk:] / nn - mu ** 2, 1e-6))
            sel = (meta["phase"] == pname).to_numpy()
            bp[sel, :], bsd[sel, :] = mu, sd
        n = np.maximum(N, 1)
        roi = np.where(N > 0, PR / n, np.nan)
        z = np.where(N >= min_n, (roi - bp) / (bsd / np.sqrt(n)), np.nan)
        out[tag] = (N, roi, z, bp)
    Nd, roid, zd, _ = out["d"]
    Nv, roiv, zv, bpv = out["v"]
    pick = np.isfinite(zd) & (zd >= z_pick) & np.isfinite(roiv) & (Nv >= min_n // 2)
    k = int(pick.sum())
    if k == 0:
        return {"k": 0, "val_roi": np.nan, "val_excess": np.nan, "frac_pos": np.nan}, pick, out
    excess = (roiv - bpv)[pick]
    return ({"k": k, "val_roi": float(np.nanmean(roiv[pick])),
             "val_excess": float(np.nanmean(excess)),
             "frac_pos": float(np.nanmean(excess > 0))}, pick, out)


def stage_b(d, markets, args):
    names, S, nmk = market_arrays(d, markets)
    cols = [c for c in d.columns
            if c not in LEAK and not (c.startswith("c_") and c.endswith("_price"))
            and pd.api.types.is_numeric_dtype(d[c])
            and d[c].notna().mean() >= 0.55 and d[c].nunique(dropna=True) >= 2]
    season = d["season"].to_numpy()
    disc = np.isin(season, DISCOVER).astype(np.float32)
    val = np.isin(season, VALIDATE).astype(np.float32)
    M, meta = build_masks_oos(d, cols, disc.astype(bool), args.min_n)
    ph_rows = {p: PH[p](d).to_numpy().astype(np.float32) for p in meta["phase"].unique()}
    print(f"features {len(cols)}  masks {M.shape}  cells {M.shape[0]*nmk}")

    real, pick, out = oos_pass(M, meta, S, nmk, names, ph_rows, disc, val,
                               args.min_n, args.z_pick)
    print(f"\ndiscovery picked {real['k']} cells at z>={args.z_pick} on {DISCOVER}")
    print(f"held-out {VALIDATE}: mean ROI {real['val_roi']:+.2f}%  "
          f"mean excess over in-slice base {real['val_excess']:+.2f}%  "
          f"share positive {100*real['frac_pos']:.1f}%")

    rng = np.random.default_rng(args.seed)
    idx_by_season = [np.flatnonzero(season == s) for s in np.unique(season)]
    nulls = []
    for k in range(args.perms):
        perm = np.arange(len(d))
        for ix in idx_by_season:
            perm[ix] = rng.permutation(ix)
        st, _, _ = oos_pass(M, meta, S[perm], nmk, names, ph_rows, disc, val,
                            args.min_n, args.z_pick)
        nulls.append(st)
        if (k + 1) % 25 == 0:
            ex = np.array([x["val_excess"] for x in nulls], float)
            print(f"  perm {k+1}/{args.perms}  null held-out excess "
                  f"{np.nanmean(ex):+.2f}% +/- {np.nanstd(ex):.2f}")
    ex = np.array([x["val_excess"] for x in nulls], float)
    fp = np.array([x["frac_pos"] for x in nulls], float)
    p_ex = float(np.nanmean(ex >= real["val_excess"]))
    print(f"\n== does the discovery process transfer? ==")
    print(f"  real held-out excess {real['val_excess']:+.3f}%   "
          f"null {np.nanmean(ex):+.3f}% +/- {np.nanstd(ex):.3f}   p = {p_ex:.4f}")
    print(f"  real share positive  {100*real['frac_pos']:.1f}%   "
          f"null {100*np.nanmean(fp):.1f}% +/- {100*np.nanstd(fp):.1f}")

    Nd, roid, zd, _ = out["d"]
    Nv, roiv, zv, bpv = out["v"]
    ii, jj = np.where(pick)
    rows = [{"phase": meta.at[i, "phase"], "feature": meta.at[i, "feature"],
             "rule": meta.at[i, "rule"], "market": names[j],
             "disc_n": int(Nd[i, j]), "disc_roi": 100 * roid[i, j], "disc_z": zd[i, j],
             "val_n": int(Nv[i, j]), "val_roi": 100 * roiv[i, j],
             "val_excess": 100 * (roiv[i, j] - bpv[i, j]), "val_z": zv[i, j]}
            for i, j in zip(ii, jj)]
    res = pd.DataFrame(rows).sort_values("val_z", ascending=False)
    res.to_csv(os.path.join(ROOT, "nba_hunt_oos.csv"), index=False)
    print(f"\n== top 30 by HELD-OUT z (these were selected without seeing {VALIDATE}) ==")
    print(res.head(30).to_string(index=False, float_format=lambda x: f"{x:7.2f}"))
    return res


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--stage", default="A", choices=["A", "B"])
    ap.add_argument("--perms", type=int, default=400)
    ap.add_argument("--min-n", type=int, default=120)
    ap.add_argument("--z-pick", type=float, default=2.0)
    ap.add_argument("--seed", type=int, default=17)
    args = ap.parse_args()

    d = pd.read_parquet(os.path.join(PQ, "nba_hunt_frame.parquet"))
    d = d.sort_values("game_date").reset_index(drop=True)
    markets = build_markets(d)
    print(f"games {len(d)}  seasons {sorted(set(d['season']))}")
    if args.stage == "A":
        stage_a(d, markets, args)
    else:
        stage_b(d, markets, args)
    print("\ndone")


if __name__ == "__main__":
    main()
