#!/usr/bin/env python3
"""Does what happens EARLY in a slate day tell you anything about the LATE games?

Owner's question (2026-10-16), three ways of asking the same thing:
  - if the public loses early, do they win late?
  - if a big underdog covers while the public was all over the favourite, do more
    favourites cover later that day?
  - does any of it sharpen on the notable games, the ones with huge ticket counts?

There is a real mechanism to look for, so this is a hypothesis and not a fishing trip:
books that take a bath on the early window can shade later numbers, and losing bettors
chase. Both would show up as the ORDER of games inside a day carrying information.

## How a game's "prior state" is defined

Causally, not by an arbitrary early/late cut. A prior game is one on the SAME day and
sport that kicked off at least GAME_HOURS before this one — i.e. one that had actually
FINISHED when this game's number went live. Anything looser lets a game be "influenced"
by one still being played.

## What is measured

Per graded spread game:
  pub_side    the ticket majority (the crowd's side)
  pub_won     did that side cover
  fav_covered did the favourite cover (favourite from spread_close, home-perspective)
  shock       the crowd was >=SHOCK_PCT on the favourite and the DOG covered

Then, for every game with at least MIN_PRIOR finished games behind it that day:
  T1  late pub cover rate, split by whether the crowd was cold or hot early
  T2  late favourite cover rate, split by whether an early SHOCK happened
  T3  T1 again, restricted to high-ticket games (top tercile within sport-week)
  T4  dose: late pub cover rate across terciles of the early crowd rate

## The null, and why it is a permutation

⛔ Comparing these rates to 50% would be wrong twice over: games inside one day share
the same "early state", so they are not independent observations, and a day where the
crowd ran hot all day produces a correlation with no timing effect in it at all.

So the null SHUFFLES KICKOFF TIMES WITHIN EACH DAY, keeping that day's games and
results exactly as they were, and recomputes the whole statistic. That asks the only
question worth asking — does the ORDER matter — and it absorbs the clustering for free.
Read z and the permutation p, never the raw rate.

★ WHY THAT NULL IS NOT OPTIONAL, measured on the first run (NFL, 2026 wks1-6):

    public cold early -> late pub cover   64.3%  (n=14)
    public hot   early -> late pub cover  22.2%  (n=9)
    gap +42.1 points   null +33.2% ± 16.4%   z=+0.54   p=0.576

A FORTY-TWO POINT gap, and it is noise. Shuffling kickoff times inside the same days —
same games, same results, order randomised — produces a +33 point gap on average. The
cause is arithmetic, not betting: `early_pub_rate` is computed from the games BEFORE
this one, so the target game is excluded from its own conditioning variable, and inside
a day with a roughly fixed number of crowd wins, a cold start mechanically leaves more
wins for later. Sampling without replacement, nothing more.

⛔ Anyone testing this against 50% instead of against the shuffle would "find" a huge
edge in both sports. That is the whole reason this file exists. See the
`nba-blind-sweep-fails` and `max-side-baseline-bias` notes for the same lesson.

⚠ POWER. The effective sample is DAYS, not games: ~6 NFL Sundays and ~7 CFB Saturdays
so far this season. A day count that small cannot establish anything; it can only fail
to find something, or flag a lead worth re-running. The script prints the day count
next to every result for that reason. Re-run it as weeks accrue — that is what it is for.

    python3 timing_study.py              both sports
    python3 timing_study.py --sport nfl
"""
import argparse
import os
import time

import numpy as np
import pandas as pd

import fetch_action as FA

HERE = os.path.dirname(os.path.abspath(__file__))
JOINED = os.path.join(HERE, "data", "action_joined.parquet")
SEASON = 2026

GAME_HOURS = 3.0      # a game is "finished" this long after kickoff
MIN_PRIOR = 3         # a game needs this many finished games behind it to be a target
SHOCK_PCT = 70.0      # ticket share on the favourite that makes a dog cover a "shock"
NPERM = 2000
RNG = np.random.default_rng(20261016)


def kickoffs(weeks_by_sport):
    """(sport, week, away, home) -> kickoff, taken from Action Network itself.

    ⛔ Deliberately NOT from model_games.kick_hour_et, which was the first version of
    this and silently dropped 118 of 394 graded games — model_games has no rows for the
    CFB weeks that `cfb_slate_frame()` supplies, so the most recent weeks, the ones with
    the most to say, were exactly the ones missing. Same stale-artifact class as the
    grading bug in join_results.nfl_frame().

    The splits rows came from the AN scoreboard, and that payload carries `start_time`
    per game, so the kickoff travels with the row it belongs to. Times are UTC in the
    payload and converted to ET here, because a slate "day" has to be the local one —
    a 20:15 ET Sunday night game is 00:15 UTC Monday and would otherwise start its own day.
    """
    rows = []
    for sport, weeks in sorted(weeks_by_sport.items()):
        league = {"nfl": "nfl", "cfb": "ncaaf"}[sport]
        for wk in sorted(weeks):
            try:
                d = FA.get(league, SEASON, int(wk))
            except Exception as e:
                print(f"[kick] {sport} wk{wk} fetch failed ({type(e).__name__})")
                continue
            for g in d.get("games") or []:
                teams = {t["id"]: t for t in g.get("teams") or []}
                a, h = teams.get(g.get("away_team_id")), teams.get(g.get("home_team_id"))
                if not a or not h or not g.get("start_time"):
                    continue
                rows.append({"sport": sport, "week": int(g["week"]),
                             "away": a.get("display_name"), "home": h.get("display_name"),
                             "kick": g["start_time"]})
            time.sleep(0.5)
    k = pd.DataFrame(rows)
    if k.empty:
        return k
    k["kick"] = (pd.to_datetime(k.kick, utc=True, errors="coerce")
                 .dt.tz_convert("US/Eastern").dt.tz_localize(None))
    return k.dropna(subset=["kick"]).drop_duplicates(["sport", "week", "away", "home"])


def frame():
    d = pd.read_parquet(JOINED)
    d = d[(d.market == "spread") & (d.away_result != 0)].copy()
    d["week"] = d.week.astype(int)

    wk = {s: set(g.week) for s, g in d.groupby("sport")}
    k = kickoffs(wk)
    d = d.merge(k, on=["sport", "week", "away", "home"], how="left")
    missing = d.kick.isna().sum()
    if missing:
        print(f"[frame] {missing} of {len(d)} graded games have no kickoff time — dropped")
    d = d.dropna(subset=["kick"])

    # the crowd's side, and whether it covered. away_result: +1 away covered, -1 home.
    d["pub_away"] = d.bets_away > 50
    d = d[d.bets_away != 50]                       # a dead-even split has no crowd side
    d["pub_won"] = np.where(d.pub_away, d.away_result > 0, d.away_result < 0)
    d["pub_pct"] = np.where(d.pub_away, d.bets_away, d.bets_home)

    # the favourite, from the home-perspective closing spread, and whether it covered
    d["fav_away"] = d.spread_close > 0
    d["fav_covered"] = np.where(d.fav_away, d.away_result > 0, d.away_result < 0)
    d["pub_on_fav"] = d.pub_away == d.fav_away
    d["shock"] = d.pub_on_fav & (d.pub_pct >= SHOCK_PCT) & (~d.fav_covered)

    d["day"] = d.kick.dt.normalize()
    # "notable": top third by ticket count inside its own sport-week, so a quiet CFB
    # week is not simply outranked by every NFL game.
    d["notable"] = (d.groupby(["sport", "week"]).tickets
                     .transform(lambda s: s >= s.quantile(2 / 3)))
    return d


def stats(d, kick):
    """Every pre-registered statistic, given a (possibly permuted) kickoff vector.

    Returns dict of name -> (value, n). A statistic with no qualifying games is nan,
    and nan propagates to the null so a thin cell cannot look significant.
    """
    d = d.assign(_k=kick)
    out = {}
    rows = []
    for (_s, _day), grp in d.groupby(["sport", "day"], sort=False):
        k = grp._k.values
        for i in range(len(grp)):
            prior = k <= (k[i] - np.timedelta64(int(GAME_HOURS * 60), "m"))
            if prior.sum() < MIN_PRIOR:
                continue
            p = grp[prior]
            rows.append({
                "pub_won": grp.pub_won.values[i],
                "fav_covered": grp.fav_covered.values[i],
                "notable": grp.notable.values[i],
                "early_pub_rate": p.pub_won.mean(),
                "early_shock": bool(p.shock.any()),
                "n_prior": int(prior.sum()),
            })
    t = pd.DataFrame(rows)
    if t.empty:
        return {k: (np.nan, 0) for k in
                ("T1_cold", "T1_hot", "T1_gap", "T2_shock", "T2_none", "T2_gap",
                 "T3_cold", "T3_hot", "T3_gap", "T4_lo", "T4_hi", "T4_gap")}, t

    def rate(mask, col="pub_won"):
        s = t.loc[mask, col]
        return (s.mean() if len(s) else np.nan, len(s))

    cold, hot = t.early_pub_rate < 0.5, t.early_pub_rate >= 0.5
    out["T1_cold"], out["T1_hot"] = rate(cold), rate(hot)
    out["T1_gap"] = (out["T1_cold"][0] - out["T1_hot"][0], out["T1_cold"][1] + out["T1_hot"][1])

    sh = t.early_shock
    out["T2_shock"], out["T2_none"] = rate(sh, "fav_covered"), rate(~sh, "fav_covered")
    out["T2_gap"] = (out["T2_shock"][0] - out["T2_none"][0], out["T2_shock"][1] + out["T2_none"][1])

    out["T3_cold"], out["T3_hot"] = rate(cold & t.notable), rate(hot & t.notable)
    out["T3_gap"] = (out["T3_cold"][0] - out["T3_hot"][0], out["T3_cold"][1] + out["T3_hot"][1])

    try:
        q = pd.qcut(t.early_pub_rate, 3, labels=False, duplicates="drop")
        out["T4_lo"], out["T4_hi"] = rate(q == 0), rate(q == (q.max() if q.notna().any() else 0))
    except (ValueError, TypeError):
        out["T4_lo"] = out["T4_hi"] = (np.nan, 0)
    out["T4_gap"] = (out["T4_lo"][0] - out["T4_hi"][0], out["T4_lo"][1] + out["T4_hi"][1])
    return out, t


def permute(d):
    """Shuffle kickoff times WITHIN each (sport, day). Results stay put; order moves."""
    k = d.kick.values.copy()
    for _, idx in d.groupby(["sport", "day"], sort=False).indices.items():
        if len(idx) > 1:
            k[idx] = RNG.permutation(k[idx])
    return k


def run(d, label):
    obs, t = stats(d, d.kick.values)
    days = d.day.nunique()
    print(f"\n{'=' * 86}\n{label}: {len(d)} graded games over {days} slate days, "
          f"{len(t)} with >= {MIN_PRIOR} finished games behind them\n{'=' * 86}")
    if t.empty:
        print("  no game has enough finished games behind it — nothing to test")
        return

    null = {k: [] for k in obs}
    for _ in range(NPERM):
        s, _ = stats(d, permute(d))
        for k, (v, _n) in s.items():
            null[k].append(v)

    rows = [
        ("T1  public cold early -> late pub cover", "T1_cold", "T1_hot", "T1_gap",
         "cold", "hot"),
        ("T2  early dog SHOCK -> late fav cover", "T2_shock", "T2_none", "T2_gap",
         "after shock", "no shock"),
        ("T3  T1 on notable (top-third ticket) games", "T3_cold", "T3_hot", "T3_gap",
         "cold", "hot"),
        ("T4  dose: lowest vs highest early-crowd tercile", "T4_lo", "T4_hi", "T4_gap",
         "low", "high"),
    ]
    for title, a, b, gap, la, lb in rows:
        va, na = obs[a]
        vb, nb = obs[b]
        vg, _ = obs[gap]
        arr = np.array(null[gap], dtype=float)
        arr = arr[~np.isnan(arr)]
        print(f"\n  {title}")
        if np.isnan(vg) or len(arr) < NPERM * 0.5:
            print(f"      not enough games to read ({la} n={na}, {lb} n={nb})")
            continue
        mu, sd = arr.mean(), arr.std()
        z = (vg - mu) / sd if sd > 0 else 0.0
        p = (np.abs(arr - mu) >= abs(vg - mu)).mean()
        print(f"      {la:<12} {va:6.1%}  (n={na})")
        print(f"      {lb:<12} {vb:6.1%}  (n={nb})")
        print(f"      gap {vg:+.1%}   null {mu:+.1%} ± {sd:.1%}   z={z:+.2f}  p={p:.3f}"
              f"   {'<-- LOOK' if p < 0.05 else ''}")


def main():
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--sport", choices=["nfl", "cfb"], help="default: both, separately")
    a = ap.parse_args()

    d = frame()
    print(f"[frame] {len(d)} graded spread games with a kickoff and a crowd side")
    sports = [a.sport] if a.sport else sorted(d.sport.unique())
    for s in sports:
        run(d[d.sport == s].copy(), s.upper())
    print("\n⚠ The effective sample is DAYS, not games. Read z and p, never the raw rate,"
          "\n  and re-run as weeks accrue before believing anything here.")


if __name__ == "__main__":
    main()
