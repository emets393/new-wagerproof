#!/usr/bin/env python3
"""LOGICAL MULTI-FEATURE CONJUNCTIONS with tuned thresholds, walk-forward validated.

WHY THIS FILE EXISTS. Every earlier NBA search in this project cut on ONE feature at a time
(nba_hunt_validate.build_masks_oos literally loops `for c in cols:`), so "308,860 cells" was
308,860 single-feature slices, not combinations. That is the wrong shape for basketball. A
team shooting a lot of threes is not a signal; a team shooting a lot of threes AGAINST a team
that gives up threes is. This file builds the second kind: two- and three-term conjunctions
inside written sports-science templates, with the threshold on each term tuned over a grid,
across all the betting markets we actually price.

THE PROBLEM WITH DOING THAT NAIVELY, AND HOW IT IS HANDLED. Combinations multiply the search
space, and this project already proved (see NBA_PROVEN.md, the blind-sweep result) that a
large blind search transfers at -0.017% excess ROI -- worse than chance -- because the
family-wise bar rises faster than any real effect. So the search here is constrained two ways:

  1. TEMPLATES, NOT PRODUCTS. Conjunctions are only formed where there is a stated mechanism
     linking the two terms to the market being bet. "Home offensive rebounding high AND away
     defensive rebounding low -> OVER and home team total OVER" is a template. "Home FT%
     high AND away games-in-last-7 high -> first-half spread" is not, and is never formed.
  2. WALK-FORWARD, NOT IN-SAMPLE BEST. Thresholds are chosen on the DEV seasons only
     (2022-23, 2023-24), including the percentile cut points themselves, and the chosen rule
     is then graded untouched on the HOLD seasons (2024-25, 2025-26). The headline number is
     the AGGREGATE excess ROI of every selected rule on HOLD. If the process works, that
     aggregate is positive; if it is another blind sweep wearing a costume, it is zero. One
     number, computed before any individual rule is celebrated.

The split is then reversed (select on HOLD, grade on DEV) so the aggregate is not itself a
one-shot draw, and only rules that clear BOTH directions are reported as candidates.

GRADING is the house standard: T-60 close, every win rate quoted next to ITS OWN slice's base
rate, per-season breakout on anything that survives.
"""
import argparse
import importlib.util
import itertools
import os

import numpy as np
import pandas as pd

ROOT = os.path.dirname(os.path.abspath(__file__))
PQ = os.path.join(ROOT, "data", "parquet")

_s = importlib.util.spec_from_file_location("sweep", os.path.join(ROOT, "nba_hunt_sweep.py"))
sweep = importlib.util.module_from_spec(_s); _s.loader.exec_module(sweep)
_d = importlib.util.spec_from_file_location("dd", os.path.join(ROOT, "nba_hunt_deepdive.py"))
dd = importlib.util.module_from_spec(_d); _d.loader.exec_module(dd)

d = pd.read_parquet(f"{PQ}/nba_hunt_frame2.parquet").sort_values("game_date").reset_index(drop=True)
M = sweep.build_markets(d)
REG = (d["postseason"] == 0).to_numpy()
GP = pd.to_numeric(d["min_gp"], errors="coerce").to_numpy(float)
SEASONS = sorted(set(d["season"]))

# 25+ games played is the standing gate: trailing 10-game aggregates and standings are not
# meaningful in October, and a rule tuned on noise there will not repeat.
MATURE = REG & (GP >= 25)

_cache = {}


def col(name):
    if name not in _cache:
        _cache[name] = pd.to_numeric(d[name], errors="coerce").to_numpy(float)
    return _cache[name]


# ===================================================================== template vocabulary
# Each entry: (home-side column stem, away-side column stem, human label). The stems below
# are the ones the frame actually carries; W is filled in with the trailing window.
def H(stem, w):
    return f"hb_l{w}_{stem}"


def A(stem, w):
    return f"ab_l{w}_{stem}"


def build_templates(windows=(5, 10)):
    """Every conjunction formed here carries a one-line mechanism. No mechanism, no template."""
    T = []

    def add(name, mech, market, terms, uni="mature"):
        T.append({"name": name, "mech": mech, "market": market, "terms": terms, "uni": uni})

    for w in windows:
        # ---------------------------------------------------------------- 1. STYLE MISMATCH -> TOTAL
        # An offence's strength only produces points if the opponent concedes that exact thing.
        # Each of these pairs an offensive rate with the defensive rate that permits it.
        mismatch = [
            ("efg", "efg_alwd", "shooting efficiency vs efficiency allowed"),
            ("p3a_rate", "p3a_rate_alwd", "three-point volume vs threes conceded"),
            ("p3_pct", "p3_pct_alwd", "three-point accuracy vs accuracy conceded"),
            ("ftr", "ftr_alwd", "free-throw rate vs fouls conceded"),
        ]
        for off, dfn, lab in mismatch:
            add(f"L{w} home {lab} -> OVER",
                "an offence only converts its strength into points against a defence that concedes it",
                "fg_total_over", [(H(off, w), "hi"), (A(dfn, w), "hi")])
            add(f"L{w} away {lab} -> OVER",
                "same mechanism, away offence against home defence",
                "fg_total_over", [(A(off, w), "hi"), (H(dfn, w), "hi")])
            add(f"L{w} home {lab} SUPPRESSED -> UNDER",
                "the mirror: a weak offence into a defence that takes away its main source",
                "fg_total_under", [(H(off, w), "lo"), (A(dfn, w), "lo")])
            # the same mismatch should show up in the side's TEAM TOTAL before the game total
            add(f"L{w} home {lab} -> HOME TT over",
                "team totals isolate one side, so a one-sided mismatch should land there first",
                "tt_home_over", [(H(off, w), "hi"), (A(dfn, w), "hi")])
            add(f"L{w} away {lab} -> AWAY TT over",
                "team totals isolate one side, so a one-sided mismatch should land there first",
                "tt_away_over", [(A(off, w), "hi"), (H(dfn, w), "hi")])

        # ---------------------------------------------------------------- 2. PACE
        # Possessions are the multiplier on everything. Both fast is the confluence; the
        # gap version tests whether one team can impose tempo on an unwilling opponent.
        add(f"L{w} BOTH teams fast -> OVER",
            "possessions are the multiplier on scoring and neither side slows the other",
            "fg_total_over", [(H("pace", w), "hi"), (A("pace", w), "hi")])
        add(f"L{w} BOTH teams slow -> UNDER",
            "the mirror; two slow teams cannot manufacture possessions",
            "fg_total_under", [(H("pace", w), "lo"), (A("pace", w), "lo")])
        add(f"L{w} fast offence into a poor defence -> OVER",
            "tempo and inefficiency compound: more possessions each worth more points",
            "fg_total_over", [(H("pace", w), "hi"), (A("def_eff", w), "hi")])
        add(f"L{w} slow offence into a good defence -> UNDER",
            "the compounding mirror: fewer possessions each worth less",
            "fg_total_under", [(H("pace", w), "lo"), (A("def_eff", w), "lo")])

        # ---------------------------------------------------------------- 3. REBOUNDING / TURNOVERS
        # Extra possessions come from the offensive glass and from forcing turnovers; both
        # are edges only when the opponent is bad at the countering skill.
        add(f"L{w} home crashes the glass vs weak defensive rebounding -> OVER",
            "offensive rebounds are extra possessions, but only against a poor defensive-rebounding team",
            "fg_total_over", [(H("orb_pct", w), "hi"), (A("drb_pct", w), "lo")])
        add(f"L{w} home crashes the glass vs weak defensive rebounding -> back HOME",
            "second-chance possessions are a margin edge, not just a totals edge",
            "fg_spread_home", [(H("orb_pct", w), "hi"), (A("drb_pct", w), "lo")])
        add(f"L{w} away turnover-prone into a ball-hawking home side -> back HOME",
            "live-ball turnovers are the highest-leverage possession swing there is",
            "fg_spread_home", [(A("tov_rate", w), "hi"), (H("tov_forced", w), "hi")])
        add(f"L{w} home turnover-prone into a ball-hawking away side -> back AWAY",
            "same mechanism, sides reversed",
            "fg_spread_away", [(H("tov_rate", w), "hi"), (A("tov_forced", w), "hi")])

        # ---------------------------------------------------------------- 4. QUALITY MISMATCH -> SPREAD
        add(f"L{w} home efficient offence vs leaky away defence -> back HOME",
            "the plainest quality mismatch there is; if the market prices it, nothing here survives",
            "fg_spread_home", [(H("off_eff", w), "hi"), (A("def_eff", w), "hi")])
        add(f"L{w} away efficient offence vs leaky home defence -> back AWAY",
            "same, sides reversed -- and the away version is where home-bias pricing should leave room",
            "fg_spread_away", [(A("off_eff", w), "hi"), (H("def_eff", w), "hi")])
        add(f"L{w} home good on both ends vs away bad on both ends -> back HOME",
            "a three-term version: total quality gap rather than one matchup",
            "fg_spread_home", [(H("off_eff", w), "hi"), (H("def_eff", w), "lo"), (A("off_eff", w), "lo")])

        # ---------------------------------------------------------------- 5. THIN ROTATION x FATIGUE
        # Concentration (hhi, top3 minutes, players used) is a durability measure. A thin
        # team on the second night of a back-to-back is the classic fade, and unlike an
        # injury flag it needs no news feed.
        add(f"L{w} away leans on a thin rotation AND is on a b2b -> back HOME",
            "a short rotation has no way to absorb a second night; starters play tired minutes",
            "fg_spread_home", [(A("top3_min", w), "hi"), ("a_b2b", "eq1")])
        add(f"L{w} away thin rotation, b2b, and travelled -> back HOME",
            "three-term: fatigue compounds with travel when there is no bench to hide behind",
            "fg_spread_home", [(A("top3_min", w), "hi"), ("a_b2b", "eq1"), ("a_km_7d", "hi")])
        add(f"L{w} away concentrated scoring AND on a b2b -> UNDER",
            "a tired top-heavy offence loses efficiency before it loses possessions",
            "fg_total_under", [(A("hhi", w), "hi"), ("a_b2b", "eq1")])
        add(f"L{w} away uses many players (deep bench) into a tired home side -> back AWAY",
            "the constructive mirror of the fade: depth is worth most against fatigue",
            "fg_spread_away", [(A("n_played", w), "hi"), ("h_b2b", "eq1")])

        # ---------------------------------------------------------------- 6. FORM vs PRICE
        # Trailing cover margin is form measured in the market's own units. Backing a team
        # covering heavily while still being priced as a dog is the cleanest form/price gap.
        add(f"L{w} away covering heavily but still a road dog -> back AWAY",
            "form expressed in the market's own units, against a price that has not moved with it",
            "fg_spread_away", [(f"a_l{w}_atsm", "hi"), ("t60_spread_home_point", "lo")])
        add(f"L{w} home covering heavily and laying points -> back HOME",
            "the confirmation version: does form work when it agrees with the price?",
            "fg_spread_home", [(f"h_l{w}_atsm", "hi"), ("t60_spread_home_point", "lo")])
        add(f"L{w} home failing to cover badly while still favoured -> back AWAY",
            "the fade of a name-brand favourite whose recent results do not support the price",
            "fg_spread_away", [(f"h_l{w}_atsm", "lo"), ("t60_spread_home_point", "lo")])
        add(f"L{w} both teams running OVER lately -> UNDER",
            "totals over-extrapolation: the number chases recent scoring further than it should",
            "fg_total_under", [(f"h_l{w}_oum", "hi"), (f"a_l{w}_oum", "hi")])
        add(f"L{w} both teams running UNDER lately -> OVER",
            "the mirror of the same over-extrapolation",
            "fg_total_over", [(f"h_l{w}_oum", "lo"), (f"a_l{w}_oum", "lo")])

        # ---------------------------------------------------------------- 7. RATINGS vs MARKET
        # rt_spread_gap is our opponent-adjusted rating implied spread minus the posted one.
        # On its own it is priced; crossed with a second independent term it may not be.
        add(f"L{w} ratings like the home side AND its recent form agrees -> back HOME",
            "a rating edge is only actionable when current form has not moved against it",
            "fg_spread_home", [("rt_spread_gap", "hi"), (f"h_l{w}_margin", "hi")])
        add(f"L{w} ratings like the away side AND its recent form agrees -> back AWAY",
            "same, sides reversed",
            "fg_spread_away", [("rt_spread_gap", "lo"), (f"a_l{w}_margin", "hi")])
        add(f"L{w} ratings say the total is too low AND both teams fast -> OVER",
            "two independent routes to the same conclusion about possessions and efficiency",
            "fg_total_over", [("rt_total_gap", "hi"), (H("pace", w), "hi"), (A("pace", w), "hi")])
        add(f"L{w} ratings say the total is too high AND both teams slow -> UNDER",
            "the mirror",
            "fg_total_under", [("rt_total_gap", "lo"), (H("pace", w), "lo"), (A("pace", w), "lo")])

        # ---------------------------------------------------------------- 8. SHOOTING REGRESSION
        # Own-baseline deltas: a team shooting over its OWN season number. Three-point
        # percentage is the least stable box stat at a 3-10 game scale.
        add(f"L{w} away shooting over its own head into a good defence -> back HOME",
            "unsustainable shooting meets the defence best equipped to end it",
            "fg_spread_home", [(f"ar_own{w}_p3_pct", "hi"), (H("p3_pct_alwd", w), "lo")])
        add(f"L{w} home shooting over its own head into a good defence -> back AWAY",
            "same, sides reversed",
            "fg_spread_away", [(f"hr_own{w}_p3_pct", "hi"), (A("p3_pct_alwd", w), "lo")])
        add(f"L{w} both teams shooting cold vs their own baselines -> OVER",
            "positive regression on both sides at once, against a total dragged down by it",
            "fg_total_over", [(f"hr_own{w}_efg", "lo"), (f"ar_own{w}_efg", "lo")])

        # ---------------------------------------------------------------- 9. FIRST HALF
        # We price 1H separately, and the frame carries how much of each team's scoring and
        # each team's opponent scoring lands in the first half.
        add(f"L{w} both teams front-load their scoring -> 1H OVER",
            "first-half share is a rotation and start-time habit, and it is priced coarsely",
            "h1_total_over", [(H("h1_share", w), "hi"), (A("h1_share", w), "hi")])
        add(f"L{w} both teams are slow starters -> 1H UNDER",
            "the mirror",
            "h1_total_under", [(H("q1_share", w), "lo"), (A("q1_share", w), "lo")])
        add(f"L{w} away on a b2b -> 1H back HOME",
            "fatigue shows up early, before adrenaline and rotation shortening compensate",
            "h1_spread_home", [("a_b2b", "eq1"), (A("top3_min", w), "hi")])
        add(f"L{w} home strong first-half margin form -> 1H back HOME",
            "the 1H market is thinner, so persistent 1H form has more room to survive",
            "h1_spread_home", [(f"h_l{w}_h1m", "hi"), (f"a_l{w}_h1m", "lo")])

        # ---------------------------------------------------------------- 10. TRAVEL / SCHEDULE DENSITY
        add(f"L{w} away deep into a long road trip AND playing a rested home side -> back HOME",
            "cumulative load, which our own travel work found matters where single flights do not",
            "fg_spread_home", [("a_venues_7d", "hi"), ("h_rest_days", "hi")])
        add(f"L{w} away heavy mileage AND thin rotation -> UNDER",
            "tired legs shoot worse; the totals expression of the same fatigue",
            "fg_total_under", [("a_km_7d", "hi"), (A("top3_min", w), "hi")])
        add(f"L{w} home congested week AND away rested -> back AWAY",
            "the home fade: home-court advantage is not a constant, it decays with load",
            "fg_spread_away", [("h_g_last7", "hi"), ("a_rest_days", "hi")])

    # ---------------------------------------------------------------- 11. NAIVE FORM PROJECTION
    # pair_l{w}_margin_vs_line is NOT head-to-head -- it is the amateur handicapper's method
    # written down: project the margin from each side's recent points scored and points
    # allowed, then compare it to what the line asks for. If the market has already absorbed
    # recent scoring, this should be worthless; if the public trades on it, fading it pays.
    for w in (3, 5, 10):
        if f"pair_l{w}_margin_vs_line" not in d.columns:
            continue
        add(f"L{w} naive scoring projection loves the HOME side -> back AWAY",
            "fade the amateur method: points-for minus points-against is what the public projects with",
            "fg_spread_away", [(f"pair_l{w}_margin_vs_line", "hi")], uni="mature")
        add(f"L{w} naive scoring projection loves the AWAY side -> back HOME",
            "the mirror of the same fade",
            "fg_spread_home", [(f"pair_l{w}_margin_vs_line", "lo")], uni="mature")
        add(f"L{w} both teams' recent games ran ABOVE this total -> UNDER",
            "the totals version of the same naive projection",
            "fg_total_under", [(f"pair_l{w}_gtot_vs_line", "hi")], uni="mature")
        add(f"L{w} both teams' recent games ran BELOW this total -> OVER",
            "the mirror",
            "fg_total_over", [(f"pair_l{w}_gtot_vs_line", "lo")], uni="mature")
    add("H2H rematch inside 7 days, home lost the first -> back HOME",
        "quick rematches are the one spot where adjustment is real and cheap to identify",
        "fg_spread_home", [("h2h_days", "lo"), ("h2h_prev_margin_h", "lo")], uni="mature")
    add("H2H quick rematch that went OVER -> UNDER",
        "the second meeting of a quick pair is the classic familiarity-under",
        "fg_total_under", [("h2h_days", "lo"), ("h2h_prev_ou_margin", "hi")], uni="mature")

    # ---------------------------------------------------------------- 12. LINE MOVEMENT x FORM
    # We have open -> t60 movement but no splits feed, so this is movement-only: does the
    # market's own revision agree or disagree with the team's trailing form?
    add("line moved TOWARD the home side and form agrees -> back HOME",
        "steam confirmed by an independent signal, which is the only kind that held up in the NFL work",
        "fg_spread_home", [("open_spread_move", "lo"), ("h_l5_atsm", "hi")])
    add("line moved AGAINST the home side but form disagrees -> back HOME",
        "the contrarian version: a move the underlying results do not support",
        "fg_spread_home", [("open_spread_move", "hi"), ("h_l5_atsm", "hi")])
    add("total steamed UP and both teams have been going over -> OVER",
        "confirmed totals steam",
        "fg_total_over", [("open_total_move", "hi"), ("h_l5_oum", "hi"), ("a_l5_oum", "hi")])
    add("total steamed DOWN and both teams have been going under -> UNDER",
        "the mirror",
        "fg_total_under", [("open_total_move", "lo"), ("h_l5_oum", "lo"), ("a_l5_oum", "lo")])
    add("late spread move toward home confirmed by ratings -> back HOME",
        "the T-4 to T-60 window is where the sharpest money lands",
        "fg_spread_home", [("late_spread_move", "lo"), ("rt_spread_gap", "hi")])

    # ---------------------------------------------------------------- 13. STREAKS x PRICE
    add("away on a long ATS win streak and still a dog -> back AWAY",
        "streaks are the most visible thing a casual bettor sees; if they are over-priced this dies",
        "fg_spread_away", [("a_streak_ats", "hi"), ("t60_spread_home_point", "lo")])
    add("home on a long ATS win streak and laying points -> back AWAY",
        "the fade of a streak the price has already absorbed",
        "fg_spread_away", [("h_streak_ats", "hi"), ("t60_spread_home_point", "lo")])
    add("both teams on OVER streaks -> UNDER",
        "the totals streak fade, which is a real edge in our NBA 1H work (S7)",
        "fg_total_under", [("h_streak_ou", "hi"), ("a_streak_ou", "hi")])
    add("both teams on UNDER streaks -> OVER",
        "the mirror of S7",
        "fg_total_over", [("h_streak_ou", "lo"), ("a_streak_ou", "lo")])

    # ---------------------------------------------------------------- 14. CONTEXT FLAGS
    add("divisional game, both fast -> OVER",
        "familiarity is supposed to suppress scoring; test it against style rather than assume it",
        "fg_total_over", [("is_divisional", "eq1"), ("hb_l10_pace", "hi")])
    add("altitude game with a tired visitor -> back HOME",
        "Denver and Utah, where the visitor's conditioning deficit is physically real",
        "fg_spread_home", [("h_alt_m", "hi"), ("a_b2b", "eq1")])
    add("altitude game -> OVER",
        "thin air is worth points in both directions; the plain version, for the record",
        "fg_total_over", [("h_alt_m", "hi")])

    return T


# ===================================================================== search machinery
HI_GRID = (0.55, 0.65, 0.75, 0.85)
LO_GRID = (0.45, 0.35, 0.25, 0.15)


def term_mask(colname, direction, pct, fit_uni):
    """Threshold is a percentile of the FIT universe only -- never of the held-out seasons."""
    if direction == "eq1":
        return col(colname) == 1
    v = col(colname)
    ref = v[fit_uni & np.isfinite(v)]
    if len(ref) < 200:
        return None
    thr = np.nanquantile(ref, pct)
    return np.isfinite(v) & ((v >= thr) if direction == "hi" else (v <= thr))


def grid_for(direction):
    return (None,) if direction == "eq1" else (HI_GRID if direction == "hi" else LO_GRID)


def build_mask(terms, combo, fit_uni):
    m = np.ones(len(d), bool)
    for (cname, dirn), pct in zip(terms, combo):
        if cname not in d.columns:
            return None
        tm = term_mask(cname, dirn, pct, fit_uni)
        if tm is None:
            return None
        m &= tm
    return m


def select_and_test(T, fit_mask, test_mask, min_fit_n, min_test_n):
    """Tune on fit, grade untouched on test. Returns one row per template."""
    out = []
    for t in T:
        uni = MATURE if t["uni"] == "mature" else REG
        fu, tu = uni & fit_mask, uni & test_mask
        best = None
        for combo in itertools.product(*[grid_for(dr) for _, dr in t["terms"]]):
            m = build_mask(t["terms"], combo, fu)
            if m is None:
                continue
            r = dd.grade(d, m & fu, fu, t["market"], M, "fit", min_n=min_fit_n)
            if r and (best is None or r["roi"] > best[0]["roi"]):
                best = (r, combo, m)
        if best is None:
            continue
        rfit, combo, m = best
        rtest = dd.grade(d, m & tu, tu, t["market"], M, "test", min_n=min_test_n)
        if rtest is None:
            continue
        out.append({"name": t["name"], "market": t["market"],
                    "thr": "/".join("-" if c is None else f"{c:.2f}" for c in combo),
                    "n_fit": rfit["n"], "roi_fit": rfit["roi"], "exc_fit": rfit["roi"] - rfit["base_roi"],
                    "n_test": rtest["n"], "win_test": rtest["win"], "base_test": rtest["base"],
                    "roi_test": rtest["roi"], "exc_test": rtest["roi"] - rtest["base_roi"],
                    "z_test": rtest["z"]})
    return pd.DataFrame(out)


def aggregate_verdict(res, tag):
    """THE headline number. Positive mean excess ROI out of sample = the process works."""
    if res.empty:
        print(f"\n  {tag}: no template produced a testable rule")
        return
    exc = res["exc_test"].to_numpy(float)
    wgt = np.average(exc, weights=res["n_test"].to_numpy(float))
    se = exc.std(ddof=1) / np.sqrt(len(exc))
    print(f"\n  {tag}: {len(exc)} rules selected on FIT, graded untouched on TEST")
    print(f"    mean excess ROI on TEST  {exc.mean():+6.2f}%  +/- {se:.2f} (SE)   "
          f"bet-weighted {wgt:+6.2f}%")
    print(f"    rules with positive excess: {int((exc > 0).sum())}/{len(exc)} "
          f"(chance would be ~{len(exc)/2:.0f})")
    print(f"    mean excess ROI on FIT   {res['exc_fit'].mean():+6.2f}%   "
          f"-> shrinkage {res['exc_fit'].mean() - exc.mean():+.2f} points")


def fixed_pass(T, hi=0.70, lo=0.30, min_n=60):
    """PRE-REGISTERED: one threshold per term, chosen a priori, graded on the WHOLE sample.

    Pass 1/2 showed the tuning is the noise source -- +5.5 to +9.4 ROI points of shrinkage
    and a reversed split that goes negative. So drop the tuning entirely. Each template
    becomes exactly ONE test at a fixed cut, which collapses 2,216 cells to ~125 and makes
    the family-wise bar something a real effect can actually clear. The per-season sign count
    is reported alongside, because a pooled number that comes from one season is not a rule.
    """
    global HI_GRID, LO_GRID
    out = []
    for t in T:
        uni = MATURE if t["uni"] == "mature" else REG
        combo = tuple(None if dr == "eq1" else (hi if dr == "hi" else lo) for _, dr in t["terms"])
        m = build_mask(t["terms"], combo, uni)
        if m is None:
            continue
        r = dd.grade(d, m & uni, uni, t["market"], M, t["name"], min_n=min_n)
        if r is None:
            continue
        pos = 0
        seas = []
        for s in SEASONS:
            k = (d["season"] == s).to_numpy()
            rs = dd.grade(d, m & uni & k, uni & k, t["market"], M, s, min_n=12)
            if rs:
                pos += rs["roi"] > rs["base_roi"]
                seas.append(f"{rs['win']:.0f}")
        out.append({"name": t["name"], "market": t["market"], "n": r["n"], "win": r["win"],
                    "base": r["base"], "roi": r["roi"], "exc": r["roi"] - r["base_roi"],
                    "z": r["z"], "seas_pos": pos, "by_season": "/".join(seas),
                    "mech": t["mech"]})
    return pd.DataFrame(out)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--min-fit", type=int, default=60)
    ap.add_argument("--min-test", type=int, default=40)
    args = ap.parse_args()

    T = build_templates()
    n_cells = sum(int(np.prod([len(grid_for(dr)) for _, dr in t["terms"]])) for t in T)
    print(f"templates: {len(T)}   threshold combinations searched: {n_cells}   "
          f"markets touched: {len(set(t['market'] for t in T))}")
    print(f"seasons: {SEASONS}")

    dev = d["season"].isin(SEASONS[:2]).to_numpy()
    hold = d["season"].isin(SEASONS[2:]).to_numpy()
    print(f"DEV rows {int((dev & REG).sum())}   HOLD rows {int((hold & REG).sum())}")

    print("\n" + "=" * 92)
    print("PASS 1  tune on DEV (2022-23, 2023-24), grade on HOLD (2024-25, 2025-26)")
    print("=" * 92)
    fwd = select_and_test(T, dev, hold, args.min_fit, args.min_test)
    aggregate_verdict(fwd, "FORWARD")

    print("\n" + "=" * 92)
    print("PASS 2  the same search with the split REVERSED -- tune on HOLD, grade on DEV.")
    print("        A process that only works one way round is a lucky split, not a method.")
    print("=" * 92)
    bwd = select_and_test(T, hold, dev, args.min_fit, args.min_test)
    aggregate_verdict(bwd, "REVERSE")

    if fwd.empty or bwd.empty:
        return

    print("\n" + "=" * 92)
    print("SURVIVORS  rules with positive out-of-sample excess ROI in BOTH directions.")
    print("           This is the only list worth drilling; everything else is search noise.")
    print("=" * 92)
    j = fwd.merge(bwd, on=["name", "market"], suffixes=("_f", "_b"))
    surv = j[(j["exc_test_f"] > 0) & (j["exc_test_b"] > 0)].copy()
    surv["both"] = (surv["exc_test_f"] * surv["n_test_f"] + surv["exc_test_b"] * surv["n_test_b"]) \
        / (surv["n_test_f"] + surv["n_test_b"])
    surv = surv.sort_values("both", ascending=False)
    cols = ["name", "market", "n_test_f", "exc_test_f", "n_test_b", "exc_test_b", "both"]
    print(f"  {len(surv)}/{len(j)} templates positive both ways "
          f"(chance would be ~{len(j)/4:.0f})")
    if len(surv):
        print(surv[cols].to_string(index=False, float_format=lambda x: f"{x:7.2f}"))

    print("\n" + "=" * 92)
    print("FULL FORWARD TABLE, sorted by out-of-sample excess ROI")
    print("=" * 92)
    print(fwd.sort_values("exc_test", ascending=False).to_string(
        index=False, float_format=lambda x: f"{x:7.2f}"))

    print("\n" + "=" * 92)
    print("PASS 3  PRE-REGISTERED. One a-priori threshold per term, whole sample, no tuning.")
    print("        Family-wise bar: with ~125 correlated tests the expected max |z| under the")
    print("        null is about 2.7, so anything below that is not evidence on its own.")
    print("=" * 92)
    fx = fixed_pass(T)
    for hi, lo, tag in ((0.70, 0.30, "0.70/0.30 (pre-registered)"),
                        (0.60, 0.40, "0.60/0.40 (looser)"),
                        (0.80, 0.20, "0.80/0.20 (tighter)")):
        f2 = fixed_pass(T, hi, lo)
        if not f2.empty:
            print(f"\n  aggregate over all {len(f2)} templates at {tag}: "
                  f"mean excess ROI {f2['exc'].mean():+.2f}%  "
                  f"positive {int((f2['exc'] > 0).sum())}/{len(f2)}  "
                  f"max z {f2['z'].max():+.2f}")
    print("\n  TOP 25 by z, with the per-season sign count. seas_pos < 3 is disqualifying.")
    print(fx.sort_values("z", ascending=False).head(25)[
        ["name", "market", "n", "win", "base", "roi", "exc", "z", "seas_pos", "by_season"]
    ].to_string(index=False, float_format=lambda x: f"{x:7.2f}"))
    print("\n  BOTTOM 10 by z -- the fades. A strong negative is a bet on the other side.")
    print(fx.sort_values("z").head(10)[
        ["name", "market", "n", "win", "base", "roi", "exc", "z", "seas_pos", "by_season"]
    ].to_string(index=False, float_format=lambda x: f"{x:7.2f}"))

    print("\n" + "=" * 92)
    print("CANDIDATES  pre-registered z >= 2.0 AND positive in at least 3 of 4 seasons AND")
    print("            also positive out of sample in the forward walk-forward.")
    print("=" * 92)
    good = fx[(fx["z"] >= 2.0) & (fx["seas_pos"] >= 3)]
    ok_fwd = set(fwd[fwd["exc_test"] > 0]["name"])
    cand = good[good["name"].isin(ok_fwd)]
    if cand.empty:
        print("  none. The pre-registered pass and the walk-forward do not agree on a single rule.")
    else:
        print(cand[["name", "market", "n", "win", "base", "roi", "exc", "z", "by_season"]
                   ].to_string(index=False, float_format=lambda x: f"{x:7.2f}"))
        for _, row in cand.iterrows():
            print(f"    - {row['name']}: {row['mech']}")

    os.makedirs(f"{ROOT}/out", exist_ok=True)
    fwd.to_csv(f"{ROOT}/out/nba_conj_forward.csv", index=False)
    bwd.to_csv(f"{ROOT}/out/nba_conj_reverse.csv", index=False)
    fx.to_csv(f"{ROOT}/out/nba_conj_fixed.csv", index=False)
    print("\nwrote out/nba_conj_{forward,reverse,fixed}.csv")


if __name__ == "__main__":
    main()
