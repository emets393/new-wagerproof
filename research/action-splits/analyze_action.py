#!/usr/bin/env python3
"""Test the standard public-betting theses on the Action Network splits (CFB 2026 wks 1-3).

The four things people claim these splits are good for, stated BEFORE looking (repo law — see the
nba-blind-sweep memory: a scan over every filter combination finds nothing that transfers):

  H1  FADE THE PUBLIC       back the side with the smaller share of TICKETS
  H2  FOLLOW THE MONEY      back the side whose share of HANDLE exceeds its share of tickets
  H3  REVERSE LINE MOVEMENT public heavy on a side, line moves the other way -> back the other way
  H4  GAME SIZE             do the above only work on small-ticket (low-attention) games?

Everything is oriented to the AWAY side of the board. For a total, "away" means OVER.
Spreads and totals are priced at -110; moneylines are graded at the actual closing price.

n is ~150 games per market. That is THREE WEEKS. Nothing here can establish a signal; the point
is to see whether any thesis is even pointed the right way before asking for more weeks. Cells
are reported with a permutation null and a per-week line, and anything under n=40 is not read.
"""
import os
import numpy as np, pandas as pd
from scipy.stats import binomtest

HERE = os.path.dirname(os.path.abspath(__file__))
RNG = np.random.default_rng(0)


def load():
    d = pd.read_parquet(os.path.join(HERE, "data", "action_joined.parquet"))
    d = d[d.bets_away.notna() & (d.away_result != 0)].copy()
    # price the away side of each market; the home price is its mirror
    d["away_dec"] = np.where(d.market == "ml", d.away_close, -110.0)
    d["home_dec"] = np.where(d.market == "ml", d.home_close, -110.0)
    return d


def payout(american):
    """profit on a 1u win at an American price"""
    a = np.asarray(american, dtype=float)
    return np.where(a > 0, a / 100.0, 100.0 / -a)


def show(name, s, side, min_n=40):
    """side: +1 bet away/over, -1 bet home/under, or an array of per-row sides."""
    if len(s) < min_n:
        print(f"  {name:46s} n={len(s):4d}   (too few to read)")
        return
    side = np.asarray(side) if hasattr(side, "__len__") else np.full(len(s), side)
    won = (np.sign(s.away_result.values) == side)
    price = np.where(side > 0, s.away_dec.values, s.home_dec.values)
    units = np.where(won, payout(price), -1.0)
    n, w = len(s), int(won.sum())
    roi = 100 * units.mean()
    # NULL: shuffle the rule's side choices across the same games, keeping each game's outcome
    # and both prices. This asks the only question worth asking — does WHICH side the rule picks
    # carry information, beyond the home/away mix it happens to pick? A coin-flip null is
    # useless here: flipping into +500 dogs half the time "returns" +300%, and a rule that
    # always takes the favourite gets a null equal to itself, which is the correct verdict.
    ar, ad, hd = s.away_result.values, s.away_dec.values, s.home_dec.values
    nul = np.empty(2000)
    for i in range(2000):
        sh = RNG.permutation(side)
        w2 = (np.sign(ar) == sh)
        nul[i] = 100 * np.where(w2, payout(np.where(sh > 0, ad, hd)), -1.0).mean()
    pv = binomtest(w, n, 0.5).pvalue
    byw = s.assign(won=won).groupby("week").won.mean().mul(100).round(0).astype(int).to_dict()
    thin = "  <THIN>" if n < 40 else ""
    print(f"  {name:46s} n={n:4d}  {w}-{n-w}  {100*w/n:5.1f}%  roi {roi:+6.1f}%  "
          f"p={pv:.3f}  null {nul.mean():+.1f}±{nul.std():.1f}  wk {byw}{thin}")



def true_split(d):
    """H5 — TRUE MAJORITY SPLIT (owner's spec, 2026-09-26): the TICKET majority on one side and the
    MONEY majority on the OTHER. This is NOT the money%-minus-bets% gap that H2 uses: 88% tickets
    and 75% money on the same side is a -13 gap with no split at all, and the gap version is
    mechanically contrarian in a way this is not. Both majorities must actually cross 50%.

    Pre-registered rule: when a split is present, BACK THE MONEY SIDE. Graded per market and per
    league, never pooled — see the per-league note in the verdict.
    """
    d = d[d.bets_away.notna() & d.money_away.notna() & (d.away_result != 0)].copy()
    d["split"] = (d.bets_away > 50) != (d.money_away > 50)
    for sport in ("cfb", "nfl"):
        x = d[d.sport == sport]
        if not len(x):
            continue
        print(f"\n{'='*100}\nH5 TRUE MAJORITY SPLIT — {sport.upper()} "
              f"({int(x.split.sum())} splits of {len(x)} rows, {100*x.split.mean():.0f}%)\n{'='*100}")
        for mk in ("total", "spread", "ml"):
            m = x[x.market == mk]
            sp = m[m.split]
            if not len(sp):
                continue
            mny = np.where(sp.money_away > 50, +1, -1)
            show(f"  {mk}: back the MONEY side", sp, mny, min_n=6)
            show(f"  {mk}: back the TICKET side", sp, -mny, min_n=6)
            ns = m[~m.split]
            if len(ns) >= 20:
                show(f"    control, both agree — that side", ns,
                    np.where(ns.money_away > 50, +1, -1))
        # direction check: the split is usually tickets-UNDER / money-OVER, so confirm the edge is
        # not just an over bias wearing a split costume
        tt = x[(x.market == "total") & x.split]
        if len(tt):
            print("  totals split, by shape:")
            for lbl, sel in (("tix UNDER / money OVER", tt.money_away > 50),
                             ("tix OVER / money UNDER", tt.money_away <= 50)):
                g = tt[sel]
                if len(g):
                    show(f"    {lbl} — back the money", g, np.where(g.money_away > 50, +1, -1), min_n=5)


def main():
    d = load()
    print(f"CFB 2026 weeks 1-3 | {len(d)} graded game-market rows "
          f"({d.game_id.nunique()} distinct games)\n")

    for mk, label in (("spread", "SPREAD"), ("total", "TOTAL (away = OVER)"), ("ml", "MONEYLINE")):
        m = d[d.market == mk]
        if len(m) < 40:
            continue
        print("=" * 100)
        print(f"{label}   n={len(m)}")
        print("=" * 100)
        print("  -- baselines --")
        show("always the away/over side", m, +1)
        show("always the home/under side", m, -1)
        if mk == "ml":
            fav = np.where(m.away_close.values < m.home_close.values, +1, -1)
            show("always the favourite (price control)", m, fav)
            show("always the underdog (price control)", m, -fav)

        bets_a, money_a = m.bets_away.values, m.money_away.values
        # H1 fade the public: back whichever side holds fewer tickets
        print("  -- H1 fade the public (back the low-ticket side) --")
        low = np.where(bets_a < 50, +1, -1)
        show("fade the ticket majority (all games)", m, low)
        for cut in (60, 70, 80):
            k = (np.maximum(bets_a, 100 - bets_a) >= cut)
            show(f"  ... only when the public is {cut}%+", m[k], low[k])
        print("  -- H1b the opposite: FOLLOW the ticket majority --")
        show("back the ticket majority (all games)", m, -low)

        # H2 follow the money: back the side whose handle share beats its ticket share
        print("  -- H2 follow the money (handle share > ticket share) --")
        div = money_a - bets_a
        mside = np.where(div > 0, +1, -1)
        show("back the handle side (all games)", m, mside)
        for cut in (5, 10, 20):
            k = np.abs(div) >= cut
            show(f"  ... only when the gap is {cut}+ pts", m[k], mside[k])
        print("  -- H2b the opposite: FADE the handle side --")
        show("fade the handle side (all games)", m, -mside)

        # H3 reverse line movement — points markets only; an ML price move is not a line move
        if mk != "ml":
            print("  -- H3 reverse line movement --")
            mv = m.away_move.values   # + = away side gained points from open to close
            pub = np.where(bets_a >= 50, +1, -1)
            moved = np.sign(mv)
            # RLM = the line moved AGAINST the ticket majority; back the side it moved toward
            rlm = (moved != 0) & (moved == pub)   # public on away AND away got MORE points = RLM
            show("RLM present — back the side the line favours", m[rlm], -pub[rlm])
            show("  ... and the public is 60%+", m[rlm & (np.maximum(bets_a, 100 - bets_a) >= 60)],
                 -pub[rlm & (np.maximum(bets_a, 100 - bets_a) >= 60)])
            show("no RLM (line moved with the public) — back public", m[~rlm & (moved != 0)],
                 pub[~rlm & (moved != 0)])

        # H4 game size
        print("  -- H4 game size (ticket count) --")
        if m.tickets.notna().sum() > 40:
            med = m.tickets.median()
            small, big = m.tickets < med, m.tickets >= med
            show(f"fade the public, SMALL games (<{int(med):,} tix)", m[small], low[small.values])
            show(f"fade the public, BIG games (>={int(med):,} tix)", m[big], low[big.values])
        print()
    true_split(d)


if __name__ == "__main__":
    main()

# =================================================================================================
# VERDICT — CFB 2026 weeks 1-3 (owner pasted the Action Network board 2026-09-22).
# 153 graded games; ~150 rows per market. THREE WEEKS. Nothing below is established. The value of
# this run is that the pipeline grades clean (independent-scoreboard oracle, 0.503 home cover on
# the same frame) and that two of the four theses are pointed somewhere.
#
# DEAD, in the direction everyone assumes:
#   * FADE THE PUBLIC on spreads      47.3% (n=150). At 60%+ public 44.2%, at 70%+ 48.1%. Nothing.
#   * REVERSE LINE MOVEMENT           exactly 50.0% (n=70) on spreads, 55.1% (n=69) on totals,
#                                     both inside the shuffle null. The single most-repeated claim
#                                     about this data set and it is flat.
#   * MONEYLINE, every cell           "back the ticket majority" returns +22.8% and looks
#                                     spectacular, but blind FAVOURITES returned +19.7% and blind
#                                     HOME +21.5% over the same 139 games. The shuffle null on the
#                                     rule is +11.1 ± 12.2 — the rule is inside its own null. This
#                                     is "early-season CFB favourites won a lot", not information.
#                                     Any ML finding from a 3-week window is this artefact.
#
# TWO CANDIDATES — pre-registered here, to be tested on the NEXT weeks WITHOUT re-scanning:
#   C1  SPREAD, follow the public in HIGH-TICKET games / fade it in LOW-TICKET games.
#       big (>=20,467 tix) public side 65.3% (49-26, p=.011); small 40.0% (30-45, p=.011 other way).
#       NOT a favourite proxy: the favourite covers 50.7% / 49.3% across the same two halves.
#       NOT a line-size proxy: by |spread| alone the public side is 55/48/52% — flat — while
#       tickets separate INSIDE both halves (<14 pts: 59.6 vs 41.4; >=14 pts: 75.0 vs 39.1).
#       Direction agreeing in both halves is the strongest thing in this run. Cells are 28-47.
#   C2  TOTAL, follow a heavy side — but ONLY at the 80% threshold, and follow the MONEY there.
#       Bucketed, the crowd's win rate is 39.1 / 36.6 / 48.5 / 71.4% across 50-59 / 60-69 / 70-79 /
#       80%+ tickets. That is not a trend building with lopsidedness, it is three flat-to-bad
#       buckets and one hot cell (n=56). The cumulative "62.9% at 70%+" first written here blended
#       a coin-flip bucket into the hot one and made it look like a gradient. It is not one.
#       Inside the 80%+ cell, backing the MONEY majority (45-11, 80.4%) beats backing the TICKET
#       majority (40-16, 71.4%); over the full 153, money 56.2% vs tickets 52.3%. NOT an over bias
#       — the heavy side is OVER in only 43% of those games and both directions won alike.
#
#       DO NOT call the 39.2% cell "the handle side". H2 as coded is money% > bets%, a DIVERGENCE
#       construct, and it is mechanical: when 87% of tickets sit on one side the money on that side
#       still averages 75%, because a few large bets on the unpopular side pull the share toward
#       50. So it flags the unpopular side in 68% of all games — a disguised fade-the-crowd bet,
#       and it does worse (39.2%) than fading the crowd outright (47.7%). It is not a sharp-money
#       read and its failure says nothing about whether handle beats tickets. Bets and money
#       agree on the side in 88% of games; they disagree in 18, too few to read.
#
# Both candidates are POST-HOC cuts from ~24 cells; one p<.05 is expected by chance and we have
# several. Neither gets wired. The test is the next block of weeks, on these exact two rules, with
# the thresholds frozen at 20,467 tickets and 70% public.
# =================================================================================================

# =================================================================================================
# =================================================================================================
# H5 — TRUE MAJORITY SPLIT (owner's spec 2026-09-26). THE BEST-LOOKING THING IN THIS PROJECT, and
# the one rule worth tracking forward. Tickets majority on ONE side, money majority on the OTHER.
# Distinct from H2: the H2 gap flags the unpopular side in 68% of ALL games and is mechanically
# contrarian; a true split requires BOTH majorities to cross 50% and occurs in only ~18-22% of rows.
#
# BACK THE MONEY SIDE. Reported per league, never pooled:
#     CFB totals   12-6  (66.7%, p=.24)      NFL totals   6-2  (75.0%, p=.29)
#     CFB spreads  19-24 (44.2%)             NFL spreads  4-6  (40.0%)
#     CFB ml       7-11  (38.9%)             NFL ml       1-1
#
# Why totals and not the other two is the interesting part, and why this is not just an over bias:
# inside CFB the totals result holds in BOTH shapes at the same rate — tickets-under/money-over
# 8-4 (67%) and tickets-over/money-under 4-2 (67%). A direction-independent effect is a different
# animal from C2, which was 11-of-12 OVER on one board.
#
# On spreads and moneyline the TICKET side wins both leagues (56%/60% and 61%/50%), which is the
# opposite of the folk story and, at these samples, indistinguishable from noise.
#
# SAMPLES ARE 8-18 PER CELL. Nothing is established. What earns it tracking rather than dismissal:
# two independent leagues agree on the same market in the same direction, and within CFB it survives
# the over/under-shape control. Log every week, grade totals splits by backing the money side, and
# revisit at n>=60 per league. Do NOT bet it off these numbers.
# =================================================================================================

# NFL 2026 weeks 1-2 (31 games) — A SEPARATE LEAGUE, NOT A HOLDOUT FOR THE CFB RULES.
#
# Corrected 2026-09-26 after the owner pushed back, and he is right. An earlier version of this
# block treated the NFL failing C1/C2 as evidence against them in CFB. That is invalid: different
# talent dispersion, different roster turnover, and college lines are materially softer than NFL
# lines, so a public-betting effect can exist in one league and not the other. Cross-league failure
# is a limit on generality, never a refutation. Grade each league on its own data.
#
# NFL, on its own terms: C1 quiet-third 62% / rest 32% (n=8 and 22); C2 80%+ public 18% (2-9).
# Three seasons do not exist here — this is TWO WEEKS. These cells are far too thin to establish
# anything in either direction, which is the honest reading, not "the rules inverted".
#
# ============================== VERDICT, PER LEAGUE ==============================
# CFB (153 graded games, weeks 1-3):
#   DEAD: fade the public on spreads (47.3%), reverse line movement (exactly 50.0%), every
#     moneyline cell (back-the-ticket-majority returns +22.8% but blind favourites returned +19.7%
#     over the same games, and the rule sits inside its own shuffle null).
#   C1 — spread, crowd's side by ticket volume — IS SUPPORTED BY THE CFB DATA:
#       quiet third 19-28 (40.4%)   rest 61-41 (59.8%)   difference p=0.034
#       same direction all three weeks (33/64, 40/55, 47/61)
#       same direction in both spread bands (<14 pts 44/58, >=14 pts 38/62)
#     Not a favourite proxy (favourites cover ~50% in both halves) and not a line-size proxy.
#     Treat as a LIVE candidate on 149 games, not as a null.
#   C2 — totals, follow a heavy public side — is ONE HOT CELL, and the doubt is CFB-INTERNAL:
#       50-59% 39.1% | 60-69% 36.6% | 70-79% 48.5% | 80%+ 71.4% (40-16, p=0.002)
#     The 80%+ cell is strong on its own, but the crowd is actively WRONG at mild lopsidedness,
#     so the pattern is a sign flip rather than a threshold building with conviction.
#     Live but weaker than C1, and see the week-4 note below.
#
# FIRST REAL CFB HOLDOUT: week 4 (71 games, archived 2026-09-26 before kickoff). On that board C2
# fires 12 times and ELEVEN point OVER — against a 43% over-share in weeks 1-3 — so this week the
# flags are one market-wide over lean counted twelve times, not twelve independent reads. C1's
# quiet third is 7-of-20 FBS-hosting-non-FBS, games the study never covered because they are not
# in model_games. Grade both rules on week 4 once scores land; that is the test that counts.
# =================================================================================================
