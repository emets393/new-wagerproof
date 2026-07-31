#!/usr/bin/env python3
"""Pre-registered tests of hypotheses taken from the PUBLISHED literature, not from our data.

WHY THIS FILE EXISTS. Every search design we have run so far has generated its hypotheses
FROM the same 5,368 games it then tested them on: 308,860 marginal cells, 7,675,200 pairwise
cells, 76 hand-written mechanism rules. All three came back at or below the noise ceiling.
That is the expected outcome of in-sample hypothesis generation, and no amount of extra
cleverness inside the same loop fixes it.

The rules below were written by OTHER PEOPLE, on OTHER DATA, and published BEFORE we looked.
That makes this the only genuinely out-of-sample test in the project: the hypothesis did not
come from this parquet. The multiple-testing budget is small and fixed -- 5 families, and
every one is named in a citation.

WHAT IS BEING TESTED, WITH SOURCES

  ASHMAN   Ashman, Bowman & Lambrinos (2010), J Sports Econ 11(6):602-613. Over 19 NBA
           seasons the HOME team performed poorly against the spread when playing the
           second of a back-to-back while the VISITOR had 1-2 days rest, and this was
           MAGNIFIED when the home team had travelled 1-2 time zones EASTWARD between the
           back-to-back games. This is the only published, spread-graded, NBA-specific rest
           result, and a citation sweep found it has never been re-tested in 16 years.

  LEVITT   Levitt (2004), Economic J 114:223-246, Table 2. Bets on HOME UNDERDOGS won 57.7%
           while attracting only 31.8% of the action -- the single most under-bet cell in
           his data. Vergin & Sosik (1999) put NFL home dogs at .525 (n=1,079, p=.107, not
           significant) a decade later, and Paul & Weinbach (2008) put NBA home dogs at
           48.57% on n=978 with nothing rejecting no-profitability. So the PRIOR here is
           that this is already dead in the NBA. We test it to confirm, not to discover.

  ROY      Roy & Forest (2018), J Sleep Res 27(1):86-89. NBA F(2,5908)=16.12, p<0.0001 for
           circadian disadvantage -- but note Nutting & Price (2017) reaffirmed the NBA
           time-zone effect for 1991-2002 and then found NOTHING for 2002-2013. Our sample
           is entirely post-2013, so the PRIOR is that this is dead too.

  LOAD     Charest et al. (2022) found the NHL damage comes from travel distance x jet lag
           INTERACTING, not from either alone (interaction p=0.0004). Our own travel work
           found cumulative load (km_7d, venues_7d) helps the total while acute geography
           does not. This family tests the interaction form on the SPREAD.

  DENSITY  Winston et al., Mathletics ch.57, and the standard schedule-spot folklore:
           3-games-in-4-nights and 4-in-6. Proxied here by venues_7d and km_7d because the
           frame has no explicit games-in-N-nights column.

THE METHOD IMPORT THAT MATTERS MORE THAN ANY OF THE RULES
Lopez & Bliss (2024), arXiv:2408.10867, fit their model TWICE -- once with point
differential as the outcome, once with the POINT SPREAD as the outcome -- and read the two
coefficients side by side. That separates two questions we have been conflating all project:

    beta_actual  = how many points the condition is really worth
    beta_market  = how many points the market already pays for it
    gap          = beta_actual - beta_market = the points nobody is charging for

This is why they could say the NFL bye is worth +1.11 real and priced at +0.97 (fair), while
the Monday-night rest edge is worth +0.14 real and priced at +0.37 (OVER-priced -- the market
pays for something that is not there, so you fade it). A raw ATS record cannot tell those two
apart. Both regressions carry home-team, away-team and season fixed effects, so "this
condition happens to good teams" is differenced out.

Their warning applies to us directly: never put the spread on the right-hand side of an
outcome model, because a rest coefficient of zero then means "already priced", not "not real".

GRADING. Every rule is graded at the T-60 close AND at the open. Dare, Dennis & Paul (2015),
Finance Research Letters 13:130-136, showed NBA absence information is mispriced at the OPEN
and fully corrected by the CLOSE -- the exact pattern our own RAPM absence work found. A rule
that only works at the open is a news-latency edge, and we label it as one rather than
shipping it as a closing-line signal.

THE BAR. Vandenbruaene, De Ceuster & Annaert (2022), J Sports Econ 23(7):907-949, reviewed
600+ published betting strategies and concluded the field's significance bar is too low
because nobody prices the search. They propose |z| > 3. Five families is a small budget, so
the honest bar here is roughly z ~ 2.3 (expected max of 5 draws is 1.16, but each family
contains several variants, so 2.3 is the conservative read). Nothing below z=2 is a finding.
"""
import importlib.util
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
M_CLOSE = sweep.build_markets(d)
M_OPEN = sweep.build_markets(d.assign(
    t60_spread_home_point=d["open_spread_home_point"],
    t60_spread_home_price=d["open_spread_home_price"],
    t60_spread_away_price=d["open_spread_away_price"],
    t60_total_point=d["open_total_point"],
    t60_total_over_price=d["open_total_over_price"],
    t60_total_under_price=d["open_total_under_price"]))

REG = (d["postseason"] == 0).to_numpy()
GP = d["min_gp"].to_numpy(float)
PHASES = {
    "early <25gp": REG & (GP < 25),
    "mid 25-49": REG & (GP >= 25) & (GP < 50),
    "late 50+": REG & (GP >= 50),
}


def col(name):
    return pd.to_numeric(d[name], errors="coerce").to_numpy(float)


# ---------------------------------------------------------------- sign convention check
def check_tz_sign():
    """h_trav_tz is a delta of UTC offsets, but which direction is 'east'?

    Getting this backwards would invert the Ashman test, so it is resolved empirically
    rather than assumed: an EASTERN home team returning from a road trip has travelled
    eastward, so its h_trav_tz should carry the opposite sign to a WESTERN home team's.
    """
    tz = col("h_trav_tz")
    east = {"Boston Celtics", "New York Knicks", "Philadelphia 76ers", "Miami Heat",
            "Brooklyn Nets", "Toronto Raptors", "Atlanta Hawks", "Washington Wizards"}
    west = {"Los Angeles Lakers", "Los Angeles Clippers", "Golden State Warriors",
            "Portland Trail Blazers", "Sacramento Kings", "Phoenix Suns"}
    ht = d["home_team"].astype(str).to_numpy()
    me = np.isin(ht, list(east)) & np.isfinite(tz) & (tz != 0)
    mw = np.isin(ht, list(west)) & np.isfinite(tz) & (tz != 0)
    print("\n########## 0. SIGN CHECK on h_trav_tz (must resolve before the Ashman test)")
    print(f"  EAST-coast home teams, nonzero travel: n={me.sum():4d}  mean tz={tz[me].mean():+.2f}")
    print(f"  WEST-coast home teams, nonzero travel: n={mw.sum():4d}  mean tz={tz[mw].mean():+.2f}")
    eastward_positive = tz[me].mean() > tz[mw].mean()
    print(f"  -> POSITIVE h_trav_tz means travelling EASTWARD: {eastward_positive}")
    return eastward_positive


# ---------------------------------------------------------------- Lopez & Bliss dual outcome
def dual_outcome(mask, label, universe=None):
    """Fit the SAME design twice: once on actual margin, once on the market's spread.

    Returns (beta_actual, beta_market, gap) in POINTS, each with an HC0 standard error.
    Controls are home-team, away-team and season fixed effects, so a condition that happens
    disproportionately to good teams does not masquerade as an effect.
    """
    uni = REG if universe is None else universe
    m = mask & uni
    keep = uni & np.isfinite(col("margin")) & np.isfinite(col("t60_spread_home_point"))
    if m.sum() < 40:
        return None

    idx = np.flatnonzero(keep)
    c = m[idx].astype(float)
    ht = pd.get_dummies(d["home_team"].astype(str).to_numpy()[idx], drop_first=True).to_numpy(float)
    at = pd.get_dummies(d["away_team"].astype(str).to_numpy()[idx], drop_first=True).to_numpy(float)
    se_ = pd.get_dummies(d["season"].astype(str).to_numpy()[idx], drop_first=True).to_numpy(float)
    X = np.column_stack([np.ones(len(idx)), c, ht, at, se_])

    out = {}
    # market's expected home margin is the NEGATED home spread point: home -6.5 => market
    # expects the home team to win by 6.5
    for key, y in (("actual", col("margin")[idx]), ("market", -col("t60_spread_home_point")[idx])):
        good = np.isfinite(y)
        Xg, yg = X[good], y[good]
        beta, *_ = np.linalg.lstsq(Xg, yg, rcond=None)
        resid = yg - Xg @ beta
        XtXi = np.linalg.pinv(Xg.T @ Xg)
        cov = XtXi @ (Xg.T @ (Xg * (resid ** 2)[:, None])) @ XtXi   # HC0
        out[key] = (beta[1], np.sqrt(max(cov[1, 1], 0.0)))

    ba, sa = out["actual"]
    bm, sm = out["market"]
    return {"label": label, "n": int(m.sum()), "b_actual": ba, "se_actual": sa,
            "b_market": bm, "se_market": sm, "gap": ba - bm,
            "se_gap": float(np.hypot(sa, sm))}


def show_dual(rows, title):
    rows = [r for r in rows if r]
    if not rows:
        print(f"\n-- {title}\n   (nothing met the size floor)")
        return
    print(f"\n-- {title}")
    print(f"   {'condition':38s} {'n':>5s} {'REAL pts':>16s} {'PRICED pts':>16s} {'UNPRICED gap':>16s}")
    for r in rows:
        print(f"   {r['label']:38s} {r['n']:5d} "
              f"{r['b_actual']:+7.2f}+/-{r['se_actual']:4.2f} "
              f"{r['b_market']:+7.2f}+/-{r['se_market']:4.2f} "
              f"{r['gap']:+7.2f}+/-{r['se_gap']:4.2f}"
              f"{'  <<' if abs(r['gap']) > 2 * r['se_gap'] else ''}")


def ats(mask, label, universe=None, side="fg_spread_away", min_n=40):
    """Grade a mask at the T-60 close and at the open. side names WHICH team we back."""
    uni = REG if universe is None else universe
    rc = dd.grade(d, mask & uni, uni, side, M_CLOSE, label, min_n=min_n)
    ro = dd.grade(d, mask & uni, uni, side, M_OPEN, label + " [OPEN]", min_n=min_n)
    return [rc, ro]


def main():
    east_pos = check_tz_sign()
    tz = col("h_trav_tz")
    h_b2b, a_b2b = col("h_b2b") == 1, col("a_b2b") == 1
    h_rest, a_rest = col("h_rest_days"), col("a_rest_days")
    east_home = (tz >= 1) & (tz <= 2) if east_pos else (tz <= -1) & (tz >= -2)
    west_home = (tz <= -1) & (tz >= -2) if east_pos else (tz >= 1) & (tz <= 2)

    # ============================================================ ASHMAN
    print("\n" + "=" * 78)
    print("1. ASHMAN, BOWMAN & LAMBRINOS (2010) -- home on 2nd of a b2b vs a rested visitor")
    print("=" * 78)
    ashman = h_b2b & ~a_b2b & (a_rest >= 1) & (a_rest <= 2)
    rows = []
    rows.append(dual_outcome(ashman, "ASHMAN core (home b2b, away rest 1-2)"))
    rows.append(dual_outcome(ashman & east_home, "  + home travelled 1-2 tz EAST"))
    rows.append(dual_outcome(ashman & west_home, "  + home travelled 1-2 tz WEST (control)"))
    rows.append(dual_outcome(ashman & (tz == 0), "  + home did not change tz (control)"))
    rows.append(dual_outcome(h_b2b & ~a_b2b, "home b2b, away not (any away rest)"))
    rows.append(dual_outcome(h_b2b & a_b2b, "BOTH on a b2b (control)"))
    rows.append(dual_outcome(a_b2b & ~h_b2b, "away b2b, home not (mirror)"))
    show_dual(rows, "Lopez-Bliss dual outcome: is the rest spot real, and is it priced?")

    out = []
    out += ats(ashman, "ASHMAN core -> back AWAY")
    out += ats(ashman & east_home, "ASHMAN + east travel -> back AWAY", min_n=25)
    out += ats(a_b2b & ~h_b2b, "mirror: away b2b -> back HOME", side="fg_spread_home")
    dd.show([r for r in out if r], "ATS record, close and open")

    print("\n  by phase (Ashman core):")
    ph = []
    for lab, p in PHASES.items():
        ph += ats(ashman, f"ashman {lab}", universe=p, min_n=25)
    dd.show([r for r in ph if r], "phase split")

    # ============================================================ LEVITT
    print("\n" + "=" * 78)
    print("2. LEVITT (2004) home-underdog cell -- prior says this is ALREADY DEAD in the NBA")
    print("=" * 78)
    sp = col("t60_spread_home_point")
    hdog = sp > 0
    rows = []
    for lo, hi, lab in ((0, 99, "home dog, any"), (0, 3.5, "home dog 0-3.5"),
                        (3.5, 7.5, "home dog 3.5-7.5"), (7.5, 99, "home dog 7.5+")):
        rows += ats(hdog & (sp > lo) & (sp <= hi), lab, side="fg_spread_home")
    dd.show([r for r in rows if r], "home underdogs ATS (Levitt 57.7% / P&W 48.6%)")
    ph = []
    for lab, p in PHASES.items():
        ph += ats(hdog, f"home dog {lab}", universe=p, side="fg_spread_home", min_n=25)
    dd.show([r for r in ph if r], "home dogs by phase")

    # ============================================================ ROY & FOREST
    print("\n" + "=" * 78)
    print("3. ROY & FOREST (2018) circadian -- but Nutting & Price killed it post-2002")
    print("=" * 78)
    a_tz = col("a_trav_tz")
    rows = []
    rows.append(dual_outcome((a_tz >= 2) if east_pos else (a_tz <= -2), "visitor travelled 2+ tz EAST"))
    rows.append(dual_outcome((a_tz <= -2) if east_pos else (a_tz >= 2), "visitor travelled 2+ tz WEST"))
    rows.append(dual_outcome(east_home, "home returned 1-2 tz EAST"))
    rows.append(dual_outcome(np.abs(a_tz) >= 2, "visitor crossed 2+ tz either way"))
    show_dual(rows, "time-zone crossings, dual outcome")

    # ============================================================ LOAD x JET LAG
    print("\n" + "=" * 78)
    print("4. CHAREST et al. (2022) -- distance x jet lag INTERACTION, not either alone")
    print("=" * 78)
    a_km7 = col("a_km_7d")
    hi_km = np.isfinite(a_km7) & (a_km7 >= np.nanquantile(a_km7[REG], 0.80))
    rows = []
    rows.append(dual_outcome(hi_km, "visitor top-quintile km in last 7d"))
    rows.append(dual_outcome(np.abs(a_tz) >= 2, "visitor crossed 2+ tz"))
    rows.append(dual_outcome(hi_km & (np.abs(a_tz) >= 2), "BOTH (the interaction)"))
    rows.append(dual_outcome(hi_km & (np.abs(a_tz) < 1), "high km, no tz change (control)"))
    show_dual(rows, "load x jet lag")
    r = []
    r += ats(hi_km & (np.abs(a_tz) >= 2), "loaded+jetlagged visitor -> back HOME",
             side="fg_spread_home", min_n=25)
    dd.show([x for x in r if x], "ATS")

    # ============================================================ DENSITY
    print("\n" + "=" * 78)
    print("5. SCHEDULE DENSITY -- 3-in-4 / 4-in-6 proxied by venues and km in the last 7 days")
    print("=" * 78)
    a_ven, h_ven = col("a_venues_7d"), col("h_venues_7d")
    rows = []
    rows.append(dual_outcome(a_ven >= 4, "visitor 4+ venues in 7d"))
    rows.append(dual_outcome(a_ven >= 3, "visitor 3+ venues in 7d"))
    rows.append(dual_outcome(h_ven >= 4, "home 4+ venues in 7d"))
    rows.append(dual_outcome((a_ven >= 4) & a_b2b, "visitor 4+ venues AND on a b2b"))
    rows.append(dual_outcome((a_ven - h_ven) >= 2, "visitor 2+ more venues than home"))
    show_dual(rows, "schedule density")
    r = []
    r += ats((a_ven >= 4) & a_b2b, "dense+b2b visitor -> back HOME", side="fg_spread_home", min_n=25)
    r += ats((a_ven - h_ven) >= 2, "density edge to home -> back HOME", side="fg_spread_home")
    dd.show([x for x in r if x], "ATS")

    # ============================================================ REST DIFFERENTIAL GRID
    print("\n" + "=" * 78)
    print("6. REST DIFFERENTIAL, the full grid (Lopez & Bliss found the NFL bye FAIRLY priced)")
    print("=" * 78)
    dr = h_rest - a_rest
    rows = []
    for lo, hi, lab in ((-9, -2, "home 2+ days LESS rest"), (-1.5, -0.5, "home 1 day less"),
                        (-0.4, 0.4, "equal rest"), (0.5, 1.5, "home 1 day more"),
                        (2, 9, "home 2+ days MORE rest")):
        rows.append(dual_outcome(np.isfinite(dr) & (dr >= lo) & (dr <= hi), lab))
    show_dual(rows, "rest differential ladder -- is the market's slope right?")


if __name__ == "__main__":
    main()
