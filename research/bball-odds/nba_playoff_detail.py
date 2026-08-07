#!/usr/bin/env python3
"""The playoff window is the biggest number in the sweep and the smallest sample. Stress it.

Averaged over all nine method families, cell-matched against blind home, the playoff
window runs +5.5 / +15.2 / +23.5 delta at top100 / top50 / top25%, with a mean win rate of
62.9% at the tightest cut. Monotone in the model's own edge across nine independent
learners, which is the shape a real handicap has.

It is also 326 games across four postseasons, roughly 82 at the cut being quoted. At that
size a 63% win rate is about ten games away from 55%. Everything below is an attempt to
make it fall over:

  SEASON      four postseasons. If one carries it, it is one hot spring, not an edge.
  ROUND       first round is 8 series of mismatches; conference finals and the Finals are
              4 teams who all belong there. If the edge is entirely round 1 it is a
              seeding effect the market prices differently, which is a narrower claim.
  SERIES GAME game 1 has no series information for anyone; by game 5 both the market and
              the model have watched four games. An edge concentrated in game 1 is a
              stale-prior story; one that grows through the series is an adjustment story.
  HOME/AWAY   playoff home courts are strong and the market knows it. Split the sides.
  REPEAT      the same eight teams appear over and over. If the P&L is one team the model
              happened to be right about, that is not a strategy. This is the check the
              regular season never needs and the playoffs always do.

None of these are pre-registered as pass/fail thresholds because the sample cannot support
them. They decide whether this is worth MORE data, not whether it is bettable today.
"""
import os
import warnings

import numpy as np
import pandas as pd

warnings.filterwarnings("ignore")

ROOT = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(ROOT, "data", "parquet")
CUT = 50          # top 50% of |edge| -- the tightest cut the sample can bear per split


def american_to_dec(a):
    a = pd.to_numeric(a, errors="coerce").to_numpy(dtype=float)
    dec = np.where(a > 0, 1 + a / 100.0, 1 + 100.0 / np.abs(a))
    return np.where((a >= 1.01) & (a <= 40.0), a, dec)


def roi(win, dec):
    return 100 * (win * (dec - 1) - (1 - win)).mean()


def main():
    M = pd.read_parquet(f"{OUT}/nba_spread_v2_margin.parquet")
    # the feature frame carries no team identity at all, so the series and concentration
    # checks need the schedule joined back on the balldontlie game id
    G = pd.read_parquet(f"{OUT}/bdl_games.parquet")[
        ["id", "home_team.abbreviation", "visitor_team.abbreviation"]].rename(
        columns={"id": "game.id", "home_team.abbreviation": "h_abbr",
                 "visitor_team.abbreviation": "a_abbr"}).drop_duplicates("game.id")
    M = M.merge(G, on="game.id", how="left")
    d = M[M["phase"] == "playoffs"].copy().sort_values("date").reset_index(drop=True)
    names = [c[2:] for c in M.columns if c.startswith("p_")]

    sp = d["open_spread_home_point"].to_numpy(dtype=float)
    y = d["y_fg_margin"].to_numpy(dtype=float)
    dh, da = (american_to_dec(d["open_spread_home_price"]),
              american_to_dec(d["open_spread_away_price"]))
    live = (y != -sp) & np.isfinite(sp) & np.isfinite(dh) & np.isfinite(da)

    # the family AVERAGE edge, not one family: the whole reason to trust this window is
    # that nine learners agree, so the thing to stress is the consensus, not a winner
    E = np.mean([(d[f"p_{n}"] + d["open_spread_home_point"]).to_numpy(dtype=float)
                 for n in names], axis=0)
    take_home = E > 0
    win = np.where(take_home, (y > -sp).astype(float), (y < -sp).astype(float))
    dec = np.where(take_home, dh, da)
    ok = live & np.isfinite(E)
    a = np.abs(E)
    m = ok & (a >= np.nanquantile(a[ok], 1 - CUT / 100))

    # series structure: games are dated, so within a season a team pair's Nth meeting is
    # its Nth game of that series. No result is used to build this.
    key = d.apply(lambda r: r["season"] + "|" + "|".join(
        sorted([str(r["h_abbr"]), str(r["a_abbr"])])), axis=1)
    d["_series"] = key
    d["_gm"] = d.groupby("_series").cumcount() + 1
    d["_round"] = d.groupby(["season", "_series"]).ngroup()
    # round proxy: how many distinct series were live in that season at that date
    rnd = []
    for _, r in d.iterrows():
        same = d[(d["season"] == r["season"]) & (d["date"] <= r["date"])]
        rnd.append(same["_series"].nunique())
    d["_live_series"] = rnd

    L = ["# NBA playoff spread — stressing the smallest, biggest number", "",
         f"{live.sum()} graded playoff games across four postseasons. Selection is the "
         f"top {CUT}% of |edge| on the AVERAGE of all nine families, because the reason "
         "to look at this window at all is that nine learners agree — so the consensus is "
         "what should be stressed, not whichever family scored best.", "",
         f"Pooled: **{m.sum()} bets, {100*win[m].mean():.1f}%, "
         f"{roi(win[m], dec[m]):+.2f} ROI**.", "",
         "Breakeven at -110 is 52.4%. Every split below is small; none of them decide "
         "whether this is bettable, only whether it is worth more data.", ""]

    def split(title, note, labels):
        L.extend([f"\n## {title}\n", note, "", "| bucket | n | win% | ROI |",
                  "|---|---|---|---|"])
        for lab, mask in labels:
            k = m & mask
            if k.sum() < 15:
                L.append(f"| {lab} | {int(k.sum())} | — | — |")
                continue
            L.append(f"| {lab} | {int(k.sum())} | {100*win[k].mean():.1f} | "
                     f"{roi(win[k], dec[k]):+.2f} |")

    seasons = sorted(d["season"].unique())
    split("By postseason", "One hot spring is not an edge.",
          [(s, (d["season"] == s).to_numpy()) for s in seasons])

    split("By game number within the series",
          "Game 1 has no series information for anyone. If the edge is all game 1 it is a "
          "stale-prior story; if it grows later it is an adjustment story.",
          [("game 1", (d["_gm"] == 1).to_numpy()),
           ("games 2-3", d["_gm"].isin([2, 3]).to_numpy()),
           ("games 4+", (d["_gm"] >= 4).to_numpy())])

    split("By how deep the postseason is",
          "More series live at once = earlier round. Round 1 is eight mismatches; the "
          "later rounds are teams that all belong there.",
          [("round 1 (many series live)", (d["_live_series"] >= 8).to_numpy()),
           ("middle rounds", ((d["_live_series"] >= 4)
                              & (d["_live_series"] < 8)).to_numpy()),
           ("late rounds", (d["_live_series"] < 4).to_numpy())])

    split("By side taken", "Playoff home courts are strong and the market knows it.",
          [("model took home", take_home), ("model took away", ~take_home)])

    # concentration: is the P&L one team?
    L += ["\n## Is the profit one team?\n",
          "The same eight or ten teams appear over and over in a four-postseason sample. "
          "Units won by the team the model BET, best and worst five. If one line carries "
          "the window, this is a story about that roster, not a method.", "",
          "| team bet | n | win% | units |", "|---|---|---|---|"]
    tid = np.where(take_home, d["h_abbr"].to_numpy(), d["a_abbr"].to_numpy())
    u = win * (dec - 1) - (1 - win)
    rows = []
    for t in pd.unique(tid[m]):
        k = m & (tid == t)
        if k.sum() < 5:
            continue
        rows.append((str(t), int(k.sum()), 100 * win[k].mean(), u[k].sum()))
    rows.sort(key=lambda r: -r[3])
    for r in rows[:5] + [("…", 0, 0, 0)] + rows[-5:]:
        if r[1] == 0:
            L.append("| … | | | |")
            continue
        L.append(f"| {r[0]} | {r[1]} | {r[2]:.1f} | {r[3]:+.2f} |")
    if rows:
        tot = sum(r[3] for r in rows)
        top = rows[0][3]
        L += ["", f"Top team is **{top:+.2f}** units of a **{tot:+.2f}** unit total "
              f"({100*top/tot:.0f}%) — the higher that share, the less this is a method."]

    path = os.path.join(ROOT, "NBA_PLAYOFF_DETAIL_BRIEF.md")
    with open(path, "w") as f:
        f.write("\n".join(L) + "\n")
    print("\n".join(L), flush=True)
    print(f"\nwrote {path}", flush=True)


if __name__ == "__main__":
    main()
