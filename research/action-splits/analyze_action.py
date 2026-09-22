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


def show(name, s, side):
    """side: +1 bet away/over, -1 bet home/under, or an array of per-row sides."""
    if len(s) < 40:
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
    print(f"  {name:46s} n={n:4d}  {w}-{n-w}  {100*w/n:5.1f}%  roi {roi:+6.1f}%  "
          f"p={pv:.3f}  null {nul.mean():+.1f}±{nul.std():.1f}  wk {byw}")


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
# OUT-OF-SAMPLE TEST — NFL 2026 weeks 1-2 (owner pasted 2026-09-22, after the CFB verdict above).
# 31 games, 92 graded rows. Both frozen candidates FAILED, and both INVERTED.
#
#   C1  spread, crowd by within-week ticket volume
#         CFB wks1-3:  low-volume 40%  |  rest 60%   (difference p=.034)
#         NFL wks1-2:  low-volume 62%  |  rest 32%   (n=8 and 22)
#         pooled:      low-volume 43.6% | rest 55.2% (difference p=.195, was .034)
#   C2  total, 80%+ of tickets on one side
#         CFB wks1-3:  crowd 71.4% (40-16)
#         NFL wks1-2:  crowd 18%   (2-9)
#         pooled:      crowd 62.7% (42-25, p=.050) — carried entirely by the CFB half
#
# The NFL cells are far too small to refute anything on their own. What matters is that they did
# not merely fail to replicate, they landed on the opposite side, and this is now the THIRD
# disagreement in the same data: CFB spreads preferred tickets while CFB totals preferred money,
# and NFL inverts both candidates. A mechanism that reverses between two sports and between two
# markets inside one sport is not a mechanism.
#
# STANDING VERDICT: the Action Network splits carry nothing tradeable in this sample. Do not wire
# any of it, and do not re-scan for new cells — this data set has now produced four
# nice-looking cells and all four moved when new games arrived. If more weeks are ever added, the
# only honest test is these same two rules at these same thresholds, pooled, with the CFB and NFL
# halves reported separately. Pooled today: spread bets 51.7%, money 47.8%; total bets 51.6%,
# money 57.1% (p=.065, the only pooled number still alive and it is one market on 184 games).
# Moneyline remains the favourite artefact in both sports; ignore it permanently.
# =================================================================================================
