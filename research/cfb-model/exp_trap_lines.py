#!/usr/bin/env python3
"""CFB "trap line" study (owner 2026-09-23): market spread vs POWER-RATING-implied spread.

The owner's read, in his words: Rutgers lost outright as a 20+ favourite, lost again as a small
dog, then got USC at about +22 — a line that felt far too short for how badly Rutgers had been
playing — and Rutgers covered comfortably. His hypothesis: when the ratings gap is a lot bigger
than the spread, the worse team covers. And the inverse.

Framed as one number. Elo is a point-in-time rating in this frame (it updates game-by-game, and it
correlates +0.92 with the closing line vs +0.61 with the result, so it passes the repo's leak
screen). Fit how many points an elo gap is usually worth, then:

    fav_resid = (points the market lays on the favourite) - (points the rating implies)

  fav_resid < 0  the line is SHORTER than the rating says — the owner's Rutgers/USC case
  fav_resid > 0  the line is LONGER than the rating says

Two mutually exclusive readings, stated before looking:
  RULE A  bet WITH the market's disagreement — short line => back the DOG, long line => back the
          FAVOURITE. This is "the market knows something the rating doesn't" (injury, coaching
          change, motivation) and the rating is stale.
  RULE B  bet AGAINST it — take the side the rating says is mispriced. The classic "value" play.
Exactly one can be right; if both land near 50% the disagreement is noise and this is priced.

Calibration is WALK-FORWARD: the elo->points fit for season S uses only seasons < S, so no game is
scored against a mapping that saw it. 2016 is fit-only.

Grading: home covers when actual_margin + spread_close > 0, re-derived from the raw scoreboard in
an oracle check. Pushes dropped. Per-season lines always shown.
"""
import numpy as np, pandas as pd
from scipy.stats import binomtest

RNG = np.random.default_rng(0)


def panel(line="close"):
    g = pd.read_parquet("data/model_games.parquet")
    col = f"spread_{line}"
    g = g[g[col].notna() & g.actual_margin.notna() & g.elo_diff.notna()
          & g.homePoints.notna()].copy()
    # home-perspective spread is negative when home is favoured; "points laid by home" is nicer
    g["home_lay"] = -g[col]
    g["home_cover"] = np.sign(g.actual_margin + g[col])

    # ORACLE (repo law): re-derive the cover from the raw scoreboard by an independent route
    chk = np.sign((g.homePoints - g.home_lay) - g.awayPoints)
    assert (chk == g.home_cover).all(), "grader sign broken"
    hc = (g[g.home_cover != 0].home_cover > 0).mean()
    assert 0.45 < hc < 0.55, f"home cover {hc:.1%} — orientation is wrong"

    # walk-forward elo -> points mapping
    g["implied"] = np.nan
    for s in sorted(g.season.unique()):
        prior = g[g.season < s]
        if len(prior) < 500:
            continue
        b, a = np.polyfit(prior.elo_diff, prior.home_lay, 1)
        m = g.season == s
        g.loc[m, "implied"] = a + b * g.loc[m, "elo_diff"]
    g = g[g.implied.notna()].copy()

    g["resid"] = g.home_lay - g.implied              # + = market lays MORE on home than rating
    # restate from the FAVOURITE's side, which is how the owner describes it
    fav_is_home = g.home_lay > 0
    g["fav_resid"] = np.where(fav_is_home, g.resid, -g.resid)
    g["fav_side"] = np.where(fav_is_home, 1, -1)     # +1 home is the favourite, -1 away is
    g["abs_line"] = g.home_lay.abs()
    return g


def rec(name, s, side):
    """side: +1 back HOME, -1 back AWAY, scalar or array aligned to `s` BEFORE pushes drop.

    The side travels as a column so it stays aligned when pushes are filtered out — carrying it
    as a bare array and re-indexing afterwards is how this silently mismatched the first time.
    """
    s = s.copy()
    s["_side"] = side if hasattr(side, "__len__") else np.full(len(s), side)
    s = s[s.home_cover != 0]
    if len(s) < 40:
        print(f"  {name:52s} n={len(s):4d}   (too few)"); return
    won = (s.home_cover.values == s._side.values)
    n, w = len(s), int(won.sum())
    roi = 100 * ((w * (100 / 110) - (n - w)) / n)
    by = s.assign(w=won).groupby("season").w.mean()
    print(f"  {name:52s} n={n:4d}  {w}-{n-w}  {100*w/n:5.1f}%  roi {roi:+6.1f}%  "
          f"p={binomtest(w,n,0.5).pvalue:.3f}  {int((by>=.524).sum())}/{len(by)} szn")


def run(g, tag):
    b = g[g.home_cover != 0]
    print(f"\n{'='*104}\n{tag}: {len(g)} games, {len(b)} graded | home covers {100*(b.home_cover>0).mean():.1f}%"
          f" | mean |resid| {g.fav_resid.abs().mean():.1f} pts\n{'='*104}")

    # RULE A: bet with the market's disagreement. short line -> dog, long line -> favourite.
    a_side = np.where(g.fav_resid < 0, -g.fav_side, g.fav_side)
    print("\n-- RULE A: bet WITH the market (short line -> DOG, long line -> FAVOURITE) --")
    rec("all games", g, a_side)
    print("-- RULE B: the inverse, bet the rating's 'value' side --")
    rec("all games", g, -a_side)

    print("\n-- dose response: does a BIGGER disagreement pay more? (Rule A) --")
    for lo, hi in ((0, 3), (3, 6), (6, 10), (10, 99)):
        k = (g.fav_resid.abs() >= lo) & (g.fav_resid.abs() < hi)
        rec(f"  |line - rating| {lo}-{hi} pts", g[k], a_side[k.values])

    print("\n-- the owner's case: line SHORTER than the rating, by size --")
    for cut in (3, 6, 10):
        k = g.fav_resid <= -cut
        rec(f"  short by {cut}+ — back the DOG", g[k], -g.fav_side.values[k.values])
    print("-- the mirror: line LONGER than the rating --")
    for cut in (3, 6, 10):
        k = g.fav_resid >= cut
        rec(f"  long by {cut}+ — back the FAVOURITE", g[k], g.fav_side.values[k.values])

    print("\n-- inside the short-line case, by how big the line is (Rutgers was a ~22 dog) --")
    short = g.fav_resid <= -6
    for lo, hi in ((0, 7), (7, 14), (14, 21), (21, 99)):
        k = short & (g.abs_line >= lo) & (g.abs_line < hi)
        rec(f"  short 6+, dog of {lo}-{hi}", g[k], -g.fav_side.values[k.values])


def with_form(g):
    """Attach 'how badly has this team been playing' from PRIOR games only."""
    rows = []
    for home in (True, False):
        s = 1 if home else -1
        rows.append(pd.DataFrame(dict(
            game_id=g.game_id, season=g.season, week=g.week,
            team=g.homeTeam if home else g.awayTeam,
            lay=g.home_lay * s,
            ats=(g.actual_margin + (-g.home_lay)) * s if home else -(g.actual_margin - g.home_lay),
            won=np.sign(g.actual_margin) * s)))
    p = pd.concat(rows, ignore_index=True).sort_values(["team", "season", "week"])
    # ATS margin, recomputed cleanly per side: team margin minus points it laid
    p["ats"] = np.nan
    grp = p.groupby(["team", "season"])
    p["prev_lay"] = grp.lay.shift(1)
    p["prev_won"] = grp.won.shift(1)
    # "blown out as a favourite": lost outright last time while laying 10+
    p["prev_fav_loss"] = (p.prev_lay >= 10) & (p.prev_won < 0)
    key = p.set_index(["game_id", "team"])
    for pre, col in (("home", "homeTeam"), ("away", "awayTeam")):
        idx = pd.MultiIndex.from_arrays([g.game_id, g[col]])
        g[f"{pre}_prev_fav_loss"] = idx.map(key.prev_fav_loss).fillna(False)
        g[f"{pre}_prev_lay"] = idx.map(key.prev_lay)
    # the DOG's recent shape is what the owner is describing
    dog_is_home = g.fav_side < 0
    g["dog_prev_fav_loss"] = np.where(dog_is_home, g.home_prev_fav_loss, g.away_prev_fav_loss)
    g["dog_prev_lay"] = np.where(dog_is_home, g.home_prev_lay, g.away_prev_lay)
    return g


if __name__ == "__main__":
    gc = panel("close")
    run(gc, "CFB 2017-2026, graded vs the CLOSE")

    print("\n-- the owner's exact shape: a dog that was recently a BIG favourite and lost outright --")
    gc = with_form(gc)
    short = gc.fav_resid <= -3
    rec("  dog blown out as a 10+ favourite last game", gc[short & gc.dog_prev_fav_loss],
        -gc.fav_side.values[(short & gc.dog_prev_fav_loss).values])
    rec("  same, without the short-line filter", gc[gc.dog_prev_fav_loss],
        -gc.fav_side.values[gc.dog_prev_fav_loss.values])
    rec("  dog that laid 10+ last game (win or lose)", gc[short & (gc.dog_prev_lay >= 10)],
        -gc.fav_side.values[(short & (gc.dog_prev_lay >= 10)).values])

    go = panel("open")
    run(go, "CFB 2017-2026, graded vs the OPENER (elo is known before the line posts)")
    gc.to_parquet("data/_trap_line_panel.parquet", index=False)


# =================================================================================================
# ROUND 2 — maybe elo is the wrong rating. The owner's gut is anchored on RECENT FORM (Rutgers had
# just been blown out), and elo barely moved. So refit the "what should this line be" model with
# recent against-the-spread form alongside elo, and re-test the residual against THAT.
# =================================================================================================
def recent_form_panel(line="close"):
    g = panel(line)
    rows = []
    for home in (True, False):
        s = 1 if home else -1
        lay = g.home_lay * s
        rows.append(pd.DataFrame(dict(
            game_id=g.game_id, season=g.season, week=g.week,
            team=g.homeTeam if home else g.awayTeam,
            lay=lay, ats=(g.actual_margin * s) - lay)))     # + = beat the number
    p = pd.concat(rows, ignore_index=True).sort_values(["team", "season", "week"])
    gp = p.groupby(["team", "season"])
    # PRIOR games only — shift before rolling, or the current result leaks into its own feature
    p["ats_l3"] = gp.ats.transform(lambda s: s.shift(1).rolling(3, min_periods=2).mean())
    p["lay_l3"] = gp.lay.transform(lambda s: s.shift(1).rolling(3, min_periods=2).mean())
    key = p.set_index(["game_id", "team"])
    for pre, col in (("home", "homeTeam"), ("away", "awayTeam")):
        idx = pd.MultiIndex.from_arrays([g.game_id, g[col]])
        g[f"{pre}_ats_l3"] = idx.map(key.ats_l3)
        g[f"{pre}_lay_l3"] = idx.map(key.lay_l3)
    g = g.dropna(subset=["home_ats_l3", "away_ats_l3"]).copy()

    # walk-forward refit: home_lay ~ elo_diff + both teams' recent ATS form
    X = ["elo_diff", "home_ats_l3", "away_ats_l3"]
    g["implied2"] = np.nan
    for s in sorted(g.season.unique()):
        prior = g[g.season < s]
        if len(prior) < 500:
            continue
        A = np.c_[prior[X].values, np.ones(len(prior))]
        coef, *_ = np.linalg.lstsq(A, prior.home_lay.values, rcond=None)
        m = g.season == s
        g.loc[m, "implied2"] = np.c_[g.loc[m, X].values, np.ones(int(m.sum()))] @ coef
    g = g[g.implied2.notna()].copy()
    g["resid2"] = g.home_lay - g.implied2
    g["fav_resid2"] = np.where(g.home_lay > 0, g.resid2, -g.resid2)
    # the DOG's recent form, which is the thing the owner is actually reacting to
    dog_home = g.fav_side < 0
    g["dog_ats_l3"] = np.where(dog_home, g.home_ats_l3, g.away_ats_l3)
    g["dog_lay_l3"] = np.where(dog_home, g.home_lay_l3, g.away_lay_l3)
    return g


if __name__ == "__main__":
    print("\n" + "=" * 104)
    print("ROUND 2 — rating that ALSO knows recent ATS form (walk-forward refit)")
    print("=" * 104)
    g2 = recent_form_panel("close")
    a2 = np.where(g2.fav_resid2 < 0, -g2.fav_side, g2.fav_side)
    print(f"n={len(g2)} | mean |resid| {g2.fav_resid2.abs().mean():.1f} pts")
    rec("RULE A on the form-aware rating", g2, a2)
    rec("RULE B (inverse)", g2, -a2)
    print("\n  dose response (Rule A):")
    for lo, hi in ((0, 3), (3, 6), (6, 10), (10, 99)):
        k = (g2.fav_resid2.abs() >= lo) & (g2.fav_resid2.abs() < hi)
        rec(f"    |line - rating| {lo}-{hi}", g2[k], a2[k.values])

    print("\n  THE OWNER'S SHAPE — dog has been playing badly AND the line is short:")
    bad = g2.dog_ats_l3 <= -7            # beaten the number by 7+ on average over its last 3
    for cut in (0, 3, 6):
        k = bad & (g2.fav_resid2 <= -cut)
        rec(f"    dog ATS L3 <= -7, line short by {cut}+", g2[k], -g2.fav_side.values[k.values])
    print("  controls:")
    rec("    dog ATS L3 <= -7, ANY line (back the dog)", g2[bad], -g2.fav_side.values[bad.values])
    rec("    dog ATS L3 >= +7 (hot dog, back it)", g2[g2.dog_ats_l3 >= 7],
        -g2.fav_side.values[(g2.dog_ats_l3 >= 7).values])
    print("\n  and the reverse read — FADE a dog that has been terrible:")
    rec("    dog ATS L3 <= -7 — back the FAVOURITE", g2[bad], g2.fav_side.values[bad.values])

# =================================================================================================
# VERDICT (2026-09-23). The trap-line idea does not hold up, and the example that motivated it
# points the other way once an objective rating is used.
#
# 1. THE HEADLINE IS FLAT. Betting WITH the market's disagreement with elo is 50.2% (n=5,259);
#    betting against it is 49.8%. Two mutually exclusive rules both landing on 50% is the finding:
#    the gap between the line and a power rating is, on average, worth nothing.
#
# 2. THE ONE CELL THAT LOOKED ALIVE IS ELO GOING STALE, NOT A TRAP LINE. Against elo, the dose
#    response climbs 49.4 / 49.8 / 50.9 / 55.3% as the gap grows, and the 10+ cell is p=.048 on
#    n=371. Three checks kill it:
#      * 22% of week 1-3 games carry a 10+ gap vs 3-4% from week 7 on — the "disagreement" is
#        mostly elo still carrying last season. Market side covers 57.0% in wks1-3, 53.9% after.
#      * Graded vs the OPENER the whole gradient disappears: 48.6 / 49.1 / 46.8 / 50.6%.
#      * Refit the rating so it ALSO knows recent ATS form and the 10+ cell falls to 53.3% on
#        n=122. Most of the "edge" was the market knowing recent form while elo did not.
#    Read it as "a naive elo is bad in September", which is a statement about elo.
#
# 3. THE OWNER'S EXACT SHAPE FAILS, AND FAILS THE WRONG WAY. Dog that has been beaten by the
#    number by 7+ over its last 3, facing a line SHORTER than the rating implies: 52.1% (n=374)
#    at any shortness, then 48.8% (short by 3+) and 46.0% (short by 6+). It gets WORSE as the line
#    gets shorter — the opposite of a dose response. And the filter adds nothing: simply backing
#    any struggling dog is 51.6% (n=919). There is no trap-line component.
#
# 4. THE RUTGERS/USC GAME INVERTS. Elo had Rutgers at the 30th percentile and USC at the 91st —
#    a 466-point gap = 19.4 points, less 3.1 of home field = USC -16.2. The market posted USC -21.
#    So the line was FIVE POINTS LONGER than the rating, not shorter. The market had already moved
#    further against Rutgers than an objective rating would, and the dog covered anyway. Under the
#    owner's own rule that is a loss, not a win; it is the market being too high on the favourite.
#    The reason it FELT short is that his anchor was a week-1 blowout loss as a 20+ favourite —
#    against an FCS team, so it is not in this frame at all, and elo barely registered it.
#
# WHAT WOULD CHANGE THE ANSWER: a rating that is genuinely better than elo in September (a
# returning-production / transfer-portal prior). The 10+ cell is the market beating a stale rating,
# so the honest next question is not "is the line a trap" but "can we rate teams better than elo in
# weeks 1-3" — which is a model question, not a betting signal. Do NOT wire any cell from this file.
# =================================================================================================
