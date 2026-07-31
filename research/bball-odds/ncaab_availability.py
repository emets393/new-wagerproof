#!/usr/bin/env python3
"""Pregame availability from our OWN lineup data. The one that could actually ship.

WHY THIS IS THE HIGH-VALUE ONE. The best validated college signal we have is the big-out
fade -- top rebounder freshly out, fade that team ATS, 57.8% / +10.4% over four seasons
(BBALL_SIGNALS.md S1). It has never shipped because it needs a covers.com pregame injury
feed we do not own. Meanwhile the NBA absence work established the sharper version of the
claim: valuing an absence by the player's on-court impact beats naive headcount, and naive
minutes-missing is worthless.

`lineups_ncaab` gives five-man units with seconds and on-court ratings, and its player ids
are the SAME namespace as the shot feed (verified: team 305 shows ids 3951-3959 in both).
So minutes, roles and absences are all derivable from data already on disk -- no external
injury feed.

THE RECTANGLE, and why the first version of this file returned all zeros. `lineups_ncaab`
is an APPEARANCE table: a player who did not play simply has no row. So "seconds last game"
read off it is the seconds in his last APPEARANCE, which is never zero, and every absence
measure came back exactly 0.0. Absence is only visible against a roster, so the panel is
rectangularised first -- every team-game crossed with every player who has already appeared
for that team THIS SEASON, and a missing row filled as zero seconds.

The window opens at a player's first appearance of the season (before that he is not
established, and a cross would invent absences for players who had not yet enrolled or
cracked the rotation) and runs to the end of the season, so a season-ending injury still
registers. A player who leaves mid-season self-limits: with no appearances his trailing role
decays toward zero and he drops below MIN_ROLE within about six games.

TWO KNOWLEDGE STATES, and the difference between them is the whole commercial question.

  FEED     who is out TONIGHT. Read off tonight's box score, which is of course not something
           we hold when the bet goes down -- it is a stand-in for a real pregame injury
           report, the covers.com feed S1 needs and we do not own. Treat every FEED number as
           an UPPER BOUND, and as a valuation of what buying that feed would be worth. It is
           not a bettable backtest.
  LAGGED   who was out in the team's LAST game. Fully observable before tip, needs nothing we
           do not already have, and is the only version that could ship tomorrow. Its cost is
           staleness: a one-game injury is over, and a real one is a game further into being
           priced.

Each is split two ways, because the NBA work showed freshness matters:
  FRESH    out now, played the game before. Newest information.
  DURABLE  out now and out the game before. Older, and more likely already priced.

PRE-REGISTERED. College does not price absences the way the NBA does, so: FADE the team
with more valuable minutes missing. Sign fixed before grading.

CONTROLS, mirroring the NBA absence file exactly -- this is the part that decides it:
  headcount   how many rotation players are out, unvalued. Worthless in the NBA.
  raw minutes total missing role share, unvalued by impact. Also worthless in the NBA.
If either control scores like the valued version, the valuation is not doing the work and
this is just "a guy is out", which the market can see too.
"""
import os
import warnings

import numpy as np
import pandas as pd

warnings.filterwarnings("ignore")

from ncaab_frame import MARKETS, load, usable, grade

ROOT = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(ROOT, "data", "parquet")
RNG = np.random.default_rng(818)
ROLL = 6           # games of prior role to establish that a player is part of the rotation
MIN_ROLE = 0.10    # 10% of team seconds -- below this "out" is not news
MKTS = ("FG spread OPEN", "FG spread T-60", "FG total OPEN", "FG total T-60",
        "1H spread", "1H total")
FLAVOURS = ("feed_fresh", "feed_durable", "lag_fresh", "lag_durable")
LABELS = {"feed_fresh": "FEED fresh (needs a feed)",
          "feed_durable": "FEED durable (needs a feed)",
          "lag_fresh": "LAGGED fresh (shippable)",
          "lag_durable": "LAGGED durable (shippable)"}


def player_minutes():
    """Player-game seconds and minutes-weighted on-court net rating, from five-man units."""
    L = pd.read_parquet(f"{OUT}/lineups_ncaab.parquet")
    m = L.melt(id_vars=["game_id", "team_id", "secs", "net_rtg"],
               value_vars=["p1", "p2", "p3", "p4", "p5"], value_name="pid")
    m["w"] = m["secs"].clip(lower=1)
    m["wn"] = m["net_rtg"] * m["w"]
    P = m.groupby(["game_id", "team_id", "pid"], as_index=False).agg(
        secs=("secs", "sum"), w=("w", "sum"), wn=("wn", "sum"))
    P["net"] = P["wn"] / P["w"]
    return P.drop(columns=["w", "wn"])


def rectangle(P, D):
    """Cross every team-game with every player already established that season.

    This is the step that makes absence observable at all: after the merge a player who did
    not dress has a real row with zero seconds, instead of no row.
    """
    P = P.merge(D, left_on="game_id", right_on="gameId", how="inner")
    sched = P[["team_id", "season", "game_id", "date"]].drop_duplicates()
    # a player enters his team's panel from his first appearance of THAT season onward --
    # crossing whole seasons would invent absences for players not yet on the roster
    first = (P.groupby(["team_id", "season", "pid"], as_index=False)["date"].min()
             .rename(columns={"date": "first_seen"}))
    R = sched.merge(first, on=["team_id", "season"])
    R = R[R["date"] >= R["first_seen"]].drop(columns="first_seen")
    R = R.merge(P[["game_id", "team_id", "pid", "secs", "net"]],
                on=["game_id", "team_id", "pid"], how="left")
    R["secs"] = R["secs"].fillna(0.0)          # did not play. `net` stays NaN on purpose --
    tot = R.groupby(["game_id", "team_id"])["secs"].transform("sum")   # a game he did not
    R["role"] = R["secs"] / tot.clip(lower=1)                          # play says nothing
    return R                                                           # about his impact


def panel(R):
    """Each player's PRIOR role and impact, strictly leak-safe."""
    R = R.sort_values(["team_id", "pid", "date"]).reset_index(drop=True)
    g = R.groupby(["team_id", "pid"], sort=False)
    # prior role: trailing ROLL games, SHIFTED. Tonight's minutes can never enter. Zeros are
    # included, so a long absence decays a player out of the rotation on its own.
    R["pr_role"] = g["role"].transform(lambda s: s.shift(1).rolling(ROLL, min_periods=2).mean())
    # prior impact skips games he missed -- rolling counts non-NaN, so min_periods=2 means
    # two games actually PLAYED, not two games on the schedule
    R["pr_net"] = g["net"].transform(lambda s: s.shift(1).rolling(ROLL, min_periods=2).mean())
    R["prev_secs"] = g["secs"].shift(1)
    R["prev2_secs"] = g["secs"].shift(2)

    first = g.head(1)
    assert first["pr_role"].isna().all(), "PRIOR ROLE LEAKED INTO A PLAYER'S FIRST GAME"
    return R


def team_absence(P):
    """One row per team-game: how much valued role is missing, and how fresh the news is.

    A player is counted only if he held a real role BEFORE the absence (MIN_ROLE), so a deep
    bench player who never plays is not filed as an injury every night.
    """
    P = P[P["pr_role"] >= MIN_ROLE].copy()
    # FEED reads tonight; LAGGED reads the last game. Each needs the game before it to say
    # whether the absence is new, so LAGGED reaches one game further back throughout.
    z0 = P["secs"] == 0
    z1 = P["prev_secs"].fillna(0) == 0
    z2 = P["prev2_secs"].fillna(0) == 0
    P["feed_fresh"], P["feed_durable"] = z0 & ~z1, z0 & z1
    P["lag_fresh"], P["lag_durable"] = z1 & ~z2, z1 & z2

    # impact valuation: on-court net rating above the team's own average that night's
    # rotation runs at. Clipped at zero -- losing a below-average player is not a loss.
    tm = P.groupby(["game_id", "team_id"])["pr_net"].transform("mean")
    P["val"] = (P["pr_net"] - tm).clip(lower=0).fillna(0.0)

    for k in FLAVOURS:
        P[f"{k}_hc"] = P[k].astype(float)                       # control: headcount
        P[f"{k}_mn"] = np.where(P[k], P["pr_role"], 0.0)        # control: raw role missing
        P[f"{k}_vl"] = np.where(P[k], P["pr_role"] * P["val"], 0.0)   # the valued version
    cols = [f"{k}_{s}" for k in FLAVOURS for s in ("hc", "mn", "vl")]
    return P.groupby(["game_id", "team_id"], as_index=False)[cols].sum()


def frame(verbose=True):
    """The graded frame: one game per row with h_/a_ absence columns. Shared with the
    validator so it can never grade a differently-built selection."""
    g = pd.read_parquet(f"{OUT}/games_ncaab.parquet").dropna(subset=["cbbd_id"])
    g["gameId"] = g["cbbd_id"].astype("int64")
    g["date"] = pd.to_datetime(g["commence_time"], utc=True)
    D = g.sort_values("date").drop_duplicates("gameId")[["gameId", "date", "season"]]

    R = rectangle(player_minutes(), D)
    A = team_absence(panel(R))
    cols = [c for c in A.columns if c.endswith(("_hc", "_mn", "_vl"))]
    if verbose:
        print(f"  rectangular player-games: {len(R):,}  "
              f"({100 * (R['secs'] == 0).mean():.1f}% did not play)", flush=True)
        print(f"  team-games: {len(A):,}", flush=True)
        for k in FLAVOURS:
            print(f"    {k:<13} fires on {100 * (A[f'{k}_hc'] > 0).mean():.1f}% of team-games",
                  flush=True)

    H = pd.read_parquet(f"{OUT}/ncaab_player_heat.parquet")[["gameId", "teamId", "is_home"]]
    A = A.merge(H, left_on=["game_id", "team_id"], right_on=["gameId", "teamId"], how="inner")

    G = load()
    G = G.dropna(subset=["cbbd_id"]).copy()
    G["gameId"] = G["cbbd_id"].astype("int64")
    for side, flag in (("h", True), ("a", False)):
        s = A[A["is_home"] == flag][["gameId"] + cols].add_prefix(f"{side}_")
        G = G.merge(s.rename(columns={f"{side}_gameId": "gameId"}), on="gameId", how="left")
    return G


def diff(G, flavour, scale):
    """Home-minus-away absence differential. Zero means neither side has news."""
    d = (G[f"h_{flavour}_{scale}"].fillna(0) - G[f"a_{flavour}_{scale}"].fillna(0)).to_numpy(float)
    return np.where(d == 0, np.nan, d)


def main():
    print("building player minutes from five-man units...", flush=True)
    G = frame()

    L = ["# NCAAB availability from our own lineup data", "",
         "FADE the team with more valued role missing (pre-registered: college underprices "
         "absences -- S1 is +10.4%). `_vl` is impact-valued, `_mn` is raw role missing, "
         "`_hc` is a plain headcount. The controls decide this: if they match the valued "
         "version, the valuation is not doing the work.", "",
         "**FEED rows read tonight's absences and are therefore NOT a bettable backtest** -- "
         "they are the upper bound on what buying a pregame injury feed is worth. **LAGGED "
         "rows read only the previous game** and are fully observable before tip.", "",
         "Bets the top 30% of |home-minus-away differential|. `base` is the max-side rate "
         "INSIDE each selection, never 50%. Breakeven at -110 is 52.4%.", "",
         "| signal | market | bets | win % | base % | edge | ROI % | p | by season |",
         "|---|---|---|---|---|---|---|---|---|"]
    names = {"vl": "IMPACT-VALUED", "mn": "raw minutes (ctrl)", "hc": "headcount (ctrl)"}
    for k in FLAVOURS:
        for s in ("vl", "mn", "hc"):
            d = diff(G, k, s)
            for mkt in MKTS:
                ok = usable(G, pd.Series(d, index=G.index), mkt)
                if ok.sum() < 800:
                    continue
                thr = np.nanquantile(np.abs(d[ok]), 0.70)
                m = ok & (np.abs(np.nan_to_num(d)) >= thr)
                if m.sum() < 200:
                    continue
                gr = grade(G, mkt, m, -np.sign(np.nan_to_num(d)), rng=RNG)
                L.append(f"| {LABELS[k]} {names[s]} | {mkt} | {gr['n']:,} | {gr['win']:.1f} | "
                         f"{gr['base']:.1f} | **{gr['edge']:+.1f}** | {gr['roi']:+.1f} | "
                         f"{gr['p']:.3f} | {gr['per']} |")
        L.append("")

    path = os.path.join(ROOT, "NCAAB_AVAILABILITY_BRIEF.md")
    with open(path, "w") as f:
        f.write("\n".join(L) + "\n")
    print("\n".join(L))
    print(f"\nwrote {path}", flush=True)


if __name__ == "__main__":
    main()
