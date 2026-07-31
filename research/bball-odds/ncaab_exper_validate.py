#!/usr/bin/env python3
"""Confound battery for the ONE thing that survived the phase-stratified player grid:
backing the LESS EXPERIENCED team in LATE CONFERENCE PLAY.

The raw result, from ncaab_player_regression.py section D (role-weighted career games of the
rotation, top 30% of |home-away|, direction pre-registered as "back the less experienced side"):

    FG spread OPEN  NONCONF     2,202  50.8 vs 51.2 base  -2.9% ROI
    FG spread OPEN  CONF_EARLY  1,992  48.7 vs 52.1 base  -6.9% ROI
    FG spread OPEN  CONF_LATE   2,213  54.3 vs 52.0 base  +3.6% ROI   56/53/54/55
    FG spread T-60  CONF_LATE   2,217  54.1 vs 51.3 base  +3.3% ROI   55/54/54/54
    1H spread       CONF_LATE   2,151  55.3 vs 51.1 base  +4.9% ROI   57/52/57

The story is a development curve: young rosters improve across a season faster than the market
re-rates them, so the payoff arrives in February and not in November. The phase contrast is
itself the strongest evidence -- CONF_EARLY and CONF_LATE are the SAME teams in the SAME
conferences against the SAME opponents, differing only by calendar, and the sign flips. A
static roster-quality bias cannot do that.

But one confound can, and it is the obvious one in college basketball: "less experienced"
means freshmen, and freshmen concentrate at the blue bloods. If Duke and Kentucky are always
on the young side, this may just be backing high-major talent, and the calendar split could be
conference-schedule composition rather than development.

So, six controls, all graded INSIDE the identical selection:
  C1  blind home / blind away / blind favourite / blind dog on exactly the bets we make
  C2  split by whether the less experienced side is the favourite or the dog -- it has to
      work in BOTH, otherwise it is a favourite bias
  C3  team-quality split (own prior point margin, leak-safe) and power-conference split
  C4  ORTHOGONALISATION: residualise the experience differential on the market spread and on
      the quality differential, then re-cut and re-grade. What survives is the part of
      experience the market has NOT already priced. This is the direct test.
  C5  two placebos -- random 30% cut of the same pool (does the magnitude cut earn its keep?)
      and a within-phase permutation of the signal (is anything there at all?)
  C6  walk-forward: threshold from strictly prior seasons, applied blind
  plus a decile gradient inside CONF_LATE, because threshold rules with no slope behind them
  are usually flukes.
"""
import os
import warnings

import numpy as np
import pandas as pd

warnings.filterwarnings("ignore")

from ncaab_frame import MARKETS, grade, usable
from ncaab_player_regression import TOP, build, signal

ROOT = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(ROOT, "data", "parquet")
CACHE = os.path.join(OUT, "ncaab_playerreg_frame.parquet")
RNG = np.random.default_rng(20260801)

MKTS = ("FG spread OPEN", "FG spread T-60", "1H spread")
PHASE = "CONF_LATE"
N_RAND = 1000
POWER = {"ACC", "Big Ten", "Big 12", "SEC", "Big East", "Pac-12", "American",
         "Mountain West"}
SPREAD = {"FG spread OPEN": "open_spread_home_point",
          "FG spread T-60": "t60_spread_home_point",
          "1H spread": "h1_spread"}


def frame():
    """The section-D frame, cached. build() re-reads the whole player box each time."""
    if os.path.exists(CACHE):
        return pd.read_parquet(CACHE)
    G = build()
    G.to_parquet(CACHE, index=False)
    return G


def context(G):
    """Attach team quality and conference tier for both sides.

    Quality is each team's EXPANDING prior average scoring margin within the season, shifted,
    so it is knowable before tip. It stands in for a power rating without dragging a
    name-matched KenPom join into the middle of a control.
    """
    T = pd.read_parquet(f"{OUT}/cbbd_team_box.parquet",
                        columns=["gameId", "season", "teamId", "conference", "startDate",
                                 "teamStats.points.total"])
    T = T.drop_duplicates(["gameId", "teamId"]).copy()
    T["date"] = pd.to_datetime(T["startDate"], utc=True)
    pts = pd.to_numeric(T["teamStats.points.total"], errors="coerce")
    T["margin"] = pts - (pts.groupby(T["gameId"]).transform("sum") - pts)
    T = T.sort_values(["teamId", "season", "date"])
    T["qual"] = T.groupby(["teamId", "season"])["margin"].transform(
        lambda s: s.shift(1).expanding(min_periods=5).mean())
    T["power"] = T["conference"].isin(POWER).astype(float)
    T["gp"] = T.groupby(["teamId", "season"]).cumcount()      # games played BEFORE tonight

    H = pd.read_parquet(f"{OUT}/ncaab_player_heat.parquet")[["gameId", "teamId", "is_home"]]
    T = T.merge(H.drop_duplicates(["gameId", "teamId"]), on=["gameId", "teamId"], how="inner")
    for side, flag in (("h", True), ("a", False)):
        s = T[T["is_home"] == flag][["gameId", "qual", "power", "gp"]].rename(
            columns={"gameId": "game_id", "qual": f"{side}_qual",
                     "power": f"{side}_power", "gp": f"{side}_gp"})
        G = G.merge(s.drop_duplicates("game_id"), on="game_id", how="left")
    assert G["event_id"].is_unique, "FRAME MULTIPLIED ON MERGE"
    return G


def sel(G, mkt, thr=None, d=None):
    """The exact selection section D bet: CONF_LATE, top 30% of |experience differential|.

    Returns (mask, side, d). d is positive when HOME is the LESS experienced side, which is
    the side we back -- so side == sign(d) and no direction is ever fitted.
    """
    if d is None:
        d = -signal(G, "exper", mkt)
    if thr is None:
        thr = np.nanquantile(np.abs(d), TOP)      # global cut, same as section D
    ok = usable(G, pd.Series(d, index=G.index), mkt) & (G["phase"] == PHASE).to_numpy()
    m = ok & (np.abs(np.nan_to_num(d)) >= thr)
    return m, np.sign(np.nan_to_num(d)), d


def fav_side(G, mkt):
    """+1 when the HOME team is the favourite. Zero (no bet) on a pick'em."""
    sp = pd.to_numeric(G[SPREAD[mkt]], errors="coerce").to_numpy(float)
    return np.where(np.isnan(sp), 0.0, np.where(sp < 0, 1.0, np.where(sp > 0, -1.0, 0.0)))


def meetings(G):
    """How many times these two have already played this season, and who won last time.

    Keyed on the unordered pair so a home-and-home is recognised as the same matchup. Ordering
    is by tip time within season, and the result column is SHIFTED, so a game can only ever see
    meetings that finished before it.
    """
    pair = [("|".join(sorted((h, a)))) for h, a in zip(G["home_team"], G["away_team"])]
    first = [sorted((h, a))[0] for h, a in zip(G["home_team"], G["away_team"])]
    hm = (G["home_score"] - G["away_score"]).to_numpy(float)
    d = pd.DataFrame({
        "i": np.arange(len(G)), "season": G["season"].astype(str).to_numpy(),
        "t": pd.to_datetime(G["commence_time"], utc=True).to_numpy(),
        "pair": pair, "home_is_first": np.array(first) == G["home_team"].to_numpy(),
        "m_first": np.where(np.array(first) == G["home_team"].to_numpy(), hm, -hm)})
    d = d.sort_values(["season", "pair", "t"])
    # Two rows for the same matchup at the same tip time are one physical game listed under two
    # event_ids in the odds feed -- four rows in the whole sample (UConn/San Diego St 2023-04-04,
    # UAB/Toledo 2022-11-11). shift(1) would read tonight's result as the previous meeting, which
    # is precisely the look-ahead that produced the impossible "third meeting in December" cells
    # before the frame was deduplicated at every merge. Drop them from the ordering, then
    # reindex so the returned panel still lines up row-for-row with G; the dropped games come
    # back as NaN and are never bet.
    dup = d.duplicated(["season", "pair", "t"], keep="first")
    if dup.any():
        print(f"meetings(): {int(dup.sum())} same-pair same-tip rows excluded", flush=True)
    d = d[~dup]
    g = d.groupby(["season", "pair"], sort=False)
    d["n_prior"] = g.cumcount()
    prev = g["m_first"].shift(1)
    won = np.where(d["home_is_first"], prev > 0, prev < 0).astype(float)
    d["home_won_prev"] = np.where(prev.isna(), np.nan, won)
    d["prev_abs_margin"] = prev.abs()
    d = d.set_index("i").reindex(range(len(G)))
    return d.reset_index().rename(columns={"index": "i"})


def row(tag, g):
    return (f"| {tag} | {g['n']:,} | {g['win']:.1f} | {g['base']:.1f} | "
            f"**{g['edge']:+.1f}** | {g['roi']:+.1f} | {g['p']:.3f} | {g['per']} |")


HDR = ["| variant | bets | win % | base % | edge | ROI % | p | by season |",
       "|---|---|---|---|---|---|---|---|"]


def main():
    G = context(frame())
    L = ["# Does the CONF_LATE development curve survive its confounds?", "",
         "Backing the less experienced roster (role-weighted career games) in late conference "
         "play. Every control below is graded on the IDENTICAL bets, so nothing here is a "
         "different slice dressed up as a different test.", ""]

    for mkt in MKTS:
        m, side, d = sel(G, mkt)
        L += ["", f"## {mkt}", "", HDR[0], HDR[1], row("**the rule**", grade(G, mkt, m, side, rng=RNG))]

        # ---- C1: is it a side bias? ----------------------------------------------------
        fs = fav_side(G, mkt)
        one = np.ones(len(G))
        L.append(row("C1 blind HOME, same bets", grade(G, mkt, m, one, rng=RNG)))
        L.append(row("C1 blind AWAY, same bets", grade(G, mkt, m, -one, rng=RNG)))
        mf = m & (fs != 0)
        L.append(row("C1 blind FAVOURITE, same bets", grade(G, mkt, mf, fs, rng=RNG)))
        L.append(row("C1 blind DOG, same bets", grade(G, mkt, mf, -fs, rng=RNG)))

        # ---- C2: does it work on both sides of the price? -------------------------------
        # If the edge is really "back the young team", it cannot care whether that team
        # happens to be favoured. If it only fires on one, it is a price bias.
        young_fav = (side == fs) & (fs != 0)
        L.append(row("C2 young team is the FAVOURITE", grade(G, mkt, m & young_fav, side, rng=RNG)))
        L.append(row("C2 young team is the DOG", grade(G, mkt, m & ~young_fav & (fs != 0), side, rng=RNG)))

        # ---- C3: is it just blue-blood talent? -------------------------------------------
        qd = (pd.to_numeric(G["h_qual"], errors="coerce")
              - pd.to_numeric(G["a_qual"], errors="coerce")).to_numpy(float)
        young_better = np.sign(np.nan_to_num(qd)) == side       # young side is the stronger team
        L.append(row("C3 young side is the STRONGER team", grade(G, mkt, m & young_better & np.isfinite(qd), side, rng=RNG)))
        L.append(row("C3 young side is the WEAKER team", grade(G, mkt, m & ~young_better & np.isfinite(qd), side, rng=RNG)))
        pw = (pd.to_numeric(G["h_power"], errors="coerce").fillna(0).to_numpy()
              + pd.to_numeric(G["a_power"], errors="coerce").fillna(0).to_numpy())
        L.append(row("C3 POWER-conference games only", grade(G, mkt, m & (pw >= 2), side, rng=RNG)))
        L.append(row("C3 mid-major games only", grade(G, mkt, m & (pw == 0), side, rng=RNG)))

        # ---- C4: orthogonalise against price and quality ----------------------------------
        # Strip out everything about the experience differential that the market spread and
        # the quality differential already explain, then bet what is left. If the edge lives
        # in the residual it is genuinely unpriced information; if it dies, it was the price.
        sp = pd.to_numeric(G[SPREAD[mkt]], errors="coerce").to_numpy(float)
        X = np.column_stack([np.ones(len(G)), np.nan_to_num(sp), np.nan_to_num(qd)])
        fit = np.isfinite(d) & np.isfinite(sp) & np.isfinite(qd)
        beta, *_ = np.linalg.lstsq(X[fit], d[fit], rcond=None)
        r = np.where(fit, d - X @ beta, np.nan)
        rm, rside, _ = sel(G, mkt, d=r)
        L.append(row("C4 residualised on spread + quality", grade(G, mkt, rm, rside, rng=RNG)))

        # ---- C5: placebos -----------------------------------------------------------------
        ok = usable(G, pd.Series(d, index=G.index), mkt) & (G["phase"] == PHASE).to_numpy()
        pool = np.flatnonzero(ok)
        k = int(m.sum())
        wins = np.zeros(N_RAND)
        for i in range(N_RAND):
            pick = RNG.choice(pool, k, replace=False)
            mm = np.zeros(len(G), bool)
            mm[pick] = True
            wins[i] = grade(G, mkt, mm, side)["win"]          # same direction, random cut
        real = grade(G, mkt, m, side)["win"]
        L.append(f"| C5 random 30% cut, same direction | {k:,} | {wins.mean():.1f} | — | — | "
                 f"— | pct {100 * (wins < real).mean():.1f} | |")
        perm = np.zeros(N_RAND)
        for i in range(N_RAND):
            sh = d.copy()
            sh[pool] = RNG.permutation(d[pool])
            mm, ss, _ = sel(G, mkt, d=sh)
            perm[i] = grade(G, mkt, mm, ss)["win"]
        L.append(f"| C5 signal permuted inside phase | {k:,} | {perm.mean():.1f} | — | — | "
                 f"— | pct {100 * (perm < real).mean():.1f} | |")

        # ---- C6: walk-forward --------------------------------------------------------------
        seas = G["season"].astype(str).to_numpy()
        wf = np.zeros(len(G), bool)
        for s in sorted(set(seas))[1:]:
            prior = ok & (seas < s)
            if prior.sum() < 300:
                continue
            t = np.nanquantile(np.abs(d[prior]), TOP)         # cut from earlier seasons ONLY
            wf |= ok & (seas == s) & (np.abs(np.nan_to_num(d)) >= t)
        L.append(row("C6 walk-forward threshold", grade(G, mkt, wf, side, rng=RNG)))

        # ---- C7: the tail reverses, so bet a BAND instead of a tail --------------------------
        # The decile table below is monotone from d1 to d9 and then falls over in d10. An
        # extreme experience gap in college usually means a roster that lost everybody, which
        # is a bad team the market has already marked down -- different animal from a normally
        # young rotation. Cutting the tail is a hypothesis formed from that gradient, so it is
        # only tested WALK-FORWARD: both band edges come from strictly prior seasons.
        bd = np.zeros(len(G), bool)
        for s in sorted(set(seas))[1:]:
            prior = ok & (seas < s)
            if prior.sum() < 300:
                continue
            lo, hi = np.nanquantile(np.abs(d[prior]), [TOP, 0.95])
            a = np.abs(np.nan_to_num(d))
            bd |= ok & (seas == s) & (a >= lo) & (a <= hi)
        L.append(row("C7 walk-forward BAND (p70-p95)", grade(G, mkt, bd, side, rng=RNG)))

        # ---- gradient ------------------------------------------------------------------------
        ycol = MARKETS[mkt][0]
        y = pd.to_numeric(G[ycol], errors="coerce").to_numpy(float)
        gm = ok & np.isfinite(y) & (y != 0)
        q = pd.qcut(pd.Series(d[gm]), 10, labels=False, duplicates="drop")
        cov = pd.Series(y[gm] > 0).groupby(q.to_numpy()).mean()
        cnt = pd.Series(y[gm] > 0).groupby(q.to_numpy()).size()
        L += ["", "Decile gradient, away-young (left) to home-young (right) — home cover %:", "",
              "| " + " | ".join(f"d{i+1}" for i in range(len(cov))) + " |",
              "|" + "---|" * len(cov),
              "| " + " | ".join(f"{100*v:.0f}" for v in cov) + " |",
              "| " + " | ".join(f"n={v}" for v in cnt) + " |"]

    # ---- the development curve itself, month by month --------------------------------------
    # The phase contrast is the load-bearing evidence, so show it without the phase labels:
    # conference games only, same rule, cut by calendar month. A roster-quality bias would be
    # flat here. A development curve ramps.
    L += ["", "## The ramp — conference games only, FG spread T-60, by month", "",
          "Same rule, same threshold, no phase label involved.", "", HDR[0], HDR[1]]
    mkt = "FG spread T-60"
    d = -signal(G, "exper", mkt)
    thr = np.nanquantile(np.abs(d), TOP)
    conf = G["phase"].isin(["CONF_EARLY", "CONF_LATE", "CONF_TOURN"]).to_numpy()
    mo = pd.to_datetime(G["commence_time"], utc=True, errors="coerce").dt.month.to_numpy()
    base = (usable(G, pd.Series(d, index=G.index), mkt) & conf
            & (np.abs(np.nan_to_num(d)) >= thr))
    for name, sel_mo in (("December", [12]), ("January", [1]), ("February", [2]),
                         ("March", [3, 4])):
        mm = base & np.isin(mo, sel_mo)
        if mm.sum() >= 60:
            L.append(row(name, grade(G, mkt, mm, np.sign(np.nan_to_num(d)), rng=RNG)))

    # Calendar or schedule position? Development is measured in GAMES PLAYED, not in dates,
    # so if this is really a development curve it should key on games played. If instead it
    # keys on the calendar and not on games played, "February" is a label on something else.
    L += ["", "Same rule cut by GAMES PLAYED instead of by month (mean of the two teams):",
          "", HDR[0], HDR[1]]
    gp = 0.5 * (pd.to_numeric(G["h_gp"], errors="coerce")
                + pd.to_numeric(G["a_gp"], errors="coerce")).to_numpy(float)
    for name, lo, hi in (("under 15 games", 0, 15), ("15-19", 15, 20), ("20-24", 20, 25),
                         ("25 or more", 25, 99)):
        mm = base & np.isfinite(gp) & (gp >= lo) & (gp < hi)
        if mm.sum() >= 60:
            L.append(row(name, grade(G, mkt, mm, np.sign(np.nan_to_num(d)), rng=RNG)))

    # ---- rematches: the mechanism the calendar is actually pointing at -----------------------
    # Games played is the wrong axis (see above), so "February" is not development. What IS
    # true of February and not of January is that most of it is the SECOND time through the
    # conference round-robin. If the market overreacts to a first meeting, the team that lost
    # it comes back underpriced -- a calendar effect, not a maturity effect. This test can
    # falsify the whole story: if first meetings and rematches score the same, February is
    # still unexplained.
    L += ["", "## Is February really about REMATCHES?", "",
          "Conference games only, same rule. Games played was the wrong axis, so the story is "
          "not maturity. Second-meeting games are what February is made of.", "",
          HDR[0], HDR[1]]
    M = meetings(G)
    npr = M["n_prior"].to_numpy(float)
    side = np.sign(np.nan_to_num(d))
    hw = M["home_won_prev"].to_numpy(float)               # 1 = home won the earlier meeting
    # did the side we are backing LOSE the previous meeting?
    lost = np.where(side > 0, hw == 0, hw == 1) & np.isfinite(hw)
    for name, mm in (("first meeting", base & (npr == 0)),
                     ("rematch (2nd+ meeting)", base & (npr >= 1)),
                     ("rematch, young side LOST the first", base & (npr >= 1) & lost),
                     ("rematch, young side WON the first", base & (npr >= 1) & ~lost
                      & np.isfinite(hw))):
        if mm.sum() >= 60:
            L.append(row(name, grade(G, mkt, mm, side, rng=RNG)))

    # ---- the rematch cell needs ITS OWN control ----------------------------------------------
    # "Back the team that won the first meeting" is an old angle in its own right. If it scores
    # 62% by itself then the experience filter is decoration and the finding is somebody else's.
    # This is the same law that killed three earlier ports: compute the naive rule IN-SUBSET.
    L += ["", "### The control that decides it: is this just backing the previous winner?", "",
          "Conference rematches only. Row 1 is the naive angle with no experience filter at "
          "all. If row 1 already pays, nothing below it is ours.", "", HDR[0], HDR[1]]
    okc = usable(G, pd.Series(d, index=G.index), mkt) & conf
    rem = okc & (npr >= 1) & np.isfinite(hw)
    pw = np.where(hw == 1, 1.0, -1.0)                 # +1 = back the home team = prev winner
    young = np.sign(np.nan_to_num(d))                 # +1 = home is the younger roster
    big = np.abs(np.nan_to_num(d)) >= thr
    for name, mm, ss in (
            ("back previous WINNER, all rematches", rem, pw),
            ("back previous LOSER, all rematches", rem, -pw),
            ("back prev winner, winner is the YOUNGER side", rem & (pw == young), pw),
            ("back prev winner, winner is the OLDER side", rem & (pw != young), pw),
            ("back prev winner, younger AND big gap", rem & (pw == young) & big, pw),
            ("back prev winner, older AND big gap", rem & (pw != young) & big, pw)):
        if mm.sum() >= 60:
            L.append(row(name, grade(G, mkt, mm, ss, rng=RNG)))

    path = os.path.join(ROOT, "NCAAB_EXPER_VALIDATION.md")
    with open(path, "w") as f:
        f.write("\n".join(L) + "\n")
    print("\n".join(L))
    print(f"\nwrote {path}", flush=True)


if __name__ == "__main__":
    main()
