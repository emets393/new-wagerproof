#!/usr/bin/env python3
"""Does the crowd's % on a TEAM (or on the over) relate to the outcome?

Owner's question (2026-10-16), asked for teams individually and for totals.

⛔ WHY THIS IS NOT 166 SEPARATE TESTS. There are ~134 CFB teams and 32 NFL teams with
about 3-6 graded games each this season. Ranking them and reading the top of the list is
the single most reliable way to manufacture a finding: with that many teams, SOMEBODY
goes 5-0 when the crowd is on them, guaranteed, every season, in random data. The NBA
version of exactly this died — team x situation records came back ~50% inside their
nulls across six seasons and every market (see the `nba-team-spots` note).

So the question is asked in three steps, in this order, and each one has to earn the next:

  1. POOLED DOSE. Across all games, does the crowd's share on a side move that side's
     cover rate? One number per sport per market, computed at GAME level — not team
     level, because each game yields two mirrored team rows (shares sum to 100, exactly
     one side covers) and using both would double n without adding information.

  2. DISPERSION. Do team-level results vary MORE than chance allows? If team identity
     carried signal, the spread of per-team cover rates would exceed what you get by
     shuffling outcomes across games. This is one test, not 166, and it is the honest
     way to ask "do individual teams matter". The null permutes outcomes within sport,
     keeping every team's game count and the league cover rate fixed.

  3. NAMES, with the correction attached. The leaderboard is printed only after step 2,
     and every team carries p_family — the chance that a random relabelling produces a
     team at least that extreme ANYWHERE in the list. Read that column, not the record.

Totals are handled the same way: a total belongs to no team, so each game contributes its
two teams, and the question becomes whether a given team's games go over when the crowd
is on the over. Style and pace make that a reasonable thing to ask.

    python3 team_tickets.py [--min-games 4]
"""
import argparse
import os

import numpy as np
import pandas as pd

HERE = os.path.dirname(os.path.abspath(__file__))
JOINED = os.path.join(HERE, "data", "action_joined.parquet")
NPERM = 2000
RNG = np.random.default_rng(20261016)


def game_level():
    """One row per (game, market), oriented to the AWAY side."""
    d = pd.read_parquet(JOINED)
    d = d[d.away_result != 0].copy()
    d["tix_away"] = d.bets_away
    d["mny_away"] = d.money_away
    d["away_won"] = d.away_result > 0
    return d.dropna(subset=["tix_away", "mny_away"])


def team_level(d):
    """Two rows per game: each team with the crowd's share ON IT and its outcome.

    For totals the 'share' is the crowd's share on the OVER and the outcome is whether
    the over hit — identical for both teams in the game, which is correct: the question
    is whether this team's games go over, not whether the team covers.
    """
    rows = []
    for _, r in d.iterrows():
        if r.market == "total":
            for t in (r.away, r.home):
                rows.append((r.sport, r.market, t, r.tix_away, r.mny_away, r.away_won))
        else:
            rows.append((r.sport, r.market, r.away, r.tix_away, r.mny_away, r.away_won))
            rows.append((r.sport, r.market, r.home, 100 - r.tix_away, 100 - r.mny_away,
                         not r.away_won))
    return pd.DataFrame(rows, columns=["sport", "market", "team", "tix", "mny", "won"])


def dose(d, sport, market):
    """Step 1: does the crowd's share move the outcome? Game level."""
    s = d[(d.sport == sport) & (d.market == market)]
    if len(s) < 30:
        return None
    x, y = s.tix_away.values.astype(float), s.away_won.values.astype(float)
    r_tix = np.corrcoef(x, y)[0, 1]
    r_mny = np.corrcoef(s.mny_away.values.astype(float), y)[0, 1]
    # permutation p on the ticket correlation
    null = np.array([np.corrcoef(x, RNG.permutation(y))[0, 1] for _ in range(NPERM)])
    p = (np.abs(null) >= abs(r_tix)).mean()
    bands = []
    for lo, hi in [(0, 40), (40, 50), (50, 60), (60, 100)]:
        m = (x >= lo) & (x < hi)
        if m.sum() >= 10:
            bands.append(f"{lo}-{hi}%: {y[m].mean():.0%} (n={int(m.sum())})")
    return dict(n=len(s), r_tix=r_tix, r_mny=r_mny, p=p, bands=bands)


def dispersion(t, d, sport, market, min_games):
    """Step 2 and 3: do teams differ more than chance, and who looks extreme?

    The null permutes GAME outcomes within sport+market and rebuilds the team table, so
    each team keeps its schedule size and the league keeps its cover rate — only the
    link between a team and its results is broken. Mirrored rows are rebuilt from the
    permuted game outcomes, which keeps the two sides of a game consistent.
    """
    s = t[(t.sport == sport) & (t.market == market)]
    g = d[(d.sport == sport) & (d.market == market)]
    if s.empty or len(g) < 30:
        return None

    cnt = s.groupby("team").size()
    keep = set(cnt[cnt >= min_games].index)
    if len(keep) < 5:
        return None

    def table(won_by_game):
        gg = g.assign(away_won=won_by_game)
        tt = team_level(gg)
        tt = tt[tt.team.isin(keep)]
        return tt.groupby("team").won.agg(["mean", "size"])

    obs = table(g.away_won.values)
    obs_sd = obs["mean"].std()

    null_sd, null_max = [], []
    for _ in range(NPERM // 4):
        tb = table(RNG.permutation(g.away_won.values))
        null_sd.append(tb["mean"].std())
        null_max.append(np.abs(tb["mean"] - 0.5).max())
    null_sd, null_max = np.array(null_sd), np.array(null_max)

    p_disp = (null_sd >= obs_sd).mean()
    lead = obs.assign(dev=(obs["mean"] - 0.5).abs()).sort_values("dev", ascending=False)
    lead["p_family"] = [(null_max >= dv).mean() for dv in lead.dev]
    return dict(teams=len(keep), obs_sd=obs_sd, null_sd=null_sd.mean(),
                null_sd_sd=null_sd.std(), p_disp=p_disp, lead=lead.head(6),
                null_max=null_max.mean())


def main():
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--min-games", type=int, default=4)
    a = ap.parse_args()

    d = game_level()
    t = team_level(d)
    print(f"{len(d)} graded (game, market) rows -> {len(t)} team rows\n")

    for sport in ("cfb", "nfl"):
        for market in ("spread", "total", "ml"):
            head = f"{sport.upper()} / {market}"
            print("=" * 80)
            print(head)
            print("=" * 80)

            r = dose(d, sport, market)
            if not r:
                print("  too few games\n")
                continue
            print(f"  1. POOLED DOSE (n={r['n']} games)")
            print(f"     corr(crowd ticket%, that side wins) = {r['r_tix']:+.3f}  p={r['p']:.3f}")
            print(f"     corr(crowd money%,  that side wins) = {r['r_mny']:+.3f}")
            print(f"     by band: {' | '.join(r['bands'])}")

            e = dispersion(t, d, sport, market, a.min_games)
            if not e:
                print("     (too few teams with enough games for the team test)\n")
                continue
            verdict = ("MORE varied than chance" if e["p_disp"] < 0.05
                       else "no more varied than chance")
            print(f"\n  2. DISPERSION across {e['teams']} teams with >= {a.min_games} games")
            print(f"     spread of team rates  observed {e['obs_sd']:.3f}   "
                  f"null {e['null_sd']:.3f} ± {e['null_sd_sd']:.3f}   p={e['p_disp']:.3f}")
            print(f"     -> team identity is {verdict}")

            print(f"\n  3. MOST EXTREME TEAMS (p_family = chance a random relabelling "
                  f"puts SOMEONE this far out)")
            for team, row in e["lead"].iterrows():
                print(f"     {team:<22} {row['mean']:5.0%}  ({int(row['size'])} games)"
                      f"   p_family={row['p_family']:.2f}")
            print(f"     for scale, a random relabelling puts its most extreme team "
                  f"{e['null_max']:.0%} off 50% on average")
            print()

    print("⛔ A team near the top of one of those lists is not a finding unless the "
          "DISPERSION\n   test above it says team identity mattered at all. Read step 2 "
          "before step 3.")


if __name__ == "__main__":
    main()
