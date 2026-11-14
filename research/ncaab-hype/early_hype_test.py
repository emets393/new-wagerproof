#!/usr/bin/env python3
"""Early-season games between two major-conference teams where ONE side carries the preseason hype.

Universe: regular season, November-December, both teams in a power conference (ACC / Big 12 / Big Ten / SEC /
Big East / Pac-12) OR the opponent is KenPom top-40 at tip, |closing spread| <= 12 so the buy games are out.
Graded from the hype team's side at the T-60 close (and at the opener), six seasons 2020-21 .. 2025-26.

Hype definitions tested side by side (all preseason-dated, see hype_index.py):
  H1  composite hype rank top 10 in the season, opponent outside the top 25
  H2  3+ top-50 recruits on the roster, opponent with 0-1
  H3  recruiting class top 5, opponent's class outside the top 25
  H4  2+ top-50 FRESHMEN (the new-class story), opponent 0
  H5  poll premium: AP preseason rank at least 8 spots better than KenPom's opening rank (hype beyond substance)
  H6  H1 and NOT established: previous season's final KenPom rank worse than 25 (new hype, not a holdover power)
"""
import numpy as np
import pandas as pd

P = pd.read_parquet("../bball-odds/data/parquet/cbb_sit_panel.parquet",
                    columns=["season", "teamId", "opponentId", "team", "opponent", "conference", "opponentConference", "date", "month", "gnum",
                             "neutral", "is_home", "conf_game", "post", "spread", "open_spread", "ats_pts", "ats_open_pts", "win", "margin",
                             "own_kp_rank", "o_kp_rank", "ap_rank", "o_ap_rank", "nat_tv", "mte", "spread_price"])
P["season_end"] = P.season.str[:4].astype(int) + 1
H = pd.read_parquet("data/hype_index.parquet")
cols = ["hype", "hype_rank", "n_top50", "n_fresh_top50", "class_rank", "ap_pre", "kp_pre", "kp_prev_final", "poll_premium"]
own = H[["season", "teamId"] + cols].rename(columns={"season": "season_end"})
opp = H[["season", "teamId"] + cols].rename(columns={"season": "season_end", "teamId": "opponentId", **{c: "o_" + c for c in cols}})
P = P.merge(own, on=["season_end", "teamId"], how="left").merge(opp, on=["season_end", "opponentId"], how="left")

POWER = {"ACC", "Big 12", "Big Ten", "SEC", "Big East", "Pac-12"}
U = P[(P.post == 0) & P.month.isin([11, 12]) & P.spread.notna() & (P.spread.abs() <= 12)
      & (P.conference.isin(POWER)) & (P.opponentConference.isin(POWER) | (P.o_kp_rank <= 40))].copy()
U = U[U.hype.notna() & U.o_hype.notna()]
print(f"universe: {len(U)} team-game rows ({U.groupby('season').size().to_dict()}); hype team rows are a subset\n")


def pay(p):
    return (p - 1.0) if pd.notna(p) and p > 1 else 100 / 110


def rec(df, col="ats_pts", label=""):
    w, l, p = int((df[col] > 0).sum()), int((df[col] < 0).sum()), int((df[col] == 0).sum())
    n = w + l
    roi = (sum(pay(x) for x in df.loc[df[col] > 0, "spread_price"]) - l) / max(n, 1) * 100 if col == "ats_pts" else (w - l * 1.1) / max(n, 1) * 100
    pct = w / max(n, 1)
    lo = pct - 1.96 * np.sqrt(pct * (1 - pct) / max(n, 1))
    return f"{w}-{l}" + (f"-{p}" if p else "") + f"  {pct:6.1%}  [lo {lo:5.1%}]  roi {roi:+5.1f}%  n={n}"


def show(name, m):
    s = U[m]
    print(f"\n{name}: n={len(s)}")
    print(f"   back the HYPE team ATS at close   {rec(s)}")
    print(f"   back the HYPE team ATS at open    {rec(s, 'ats_open_pts')}")
    print(f"   hype team straight up             {int(s.win.sum())}-{int((1 - s.win).sum())}  ({s.win.mean():.1%})   avg close spread {s.spread.mean():+.1f}, avg margin {s.margin.mean():+.1f}")
    by = s.groupby("season").apply(lambda g: f"{int((g.ats_pts > 0).sum())}-{int((g.ats_pts < 0).sum())}")
    print("   by season: " + "  ".join(f"{k} {v}" for k, v in by.items()))
    for lab, mm in (("neutral", s.neutral == 1), ("home", s.is_home == 1), ("away", (s.neutral == 0) & (s.is_home == 0)),
                    ("first 3 games", s.gnum <= 3), ("games 4-10", (s.gnum > 3) & (s.gnum <= 10)), ("hype team favored", s.spread < 0), ("hype team dog", s.spread > 0),
                    ("national TV", s.nat_tv == 1)):
        ss = s[mm]
        if len(ss) >= 15:
            print(f"      {lab:20s} {rec(ss)}")
    return s


print("BASELINE -- every row in the universe, own side ATS at close: " + rec(U))
print("BASELINE -- favourites ATS at close: " + rec(U[U.spread < 0]) + "   dogs: " + rec(U[U.spread > 0]))

h1 = show("H1  composite hype top-10 vs opponent outside top-25", (U.hype_rank <= 10) & (U.o_hype_rank > 25))
h2 = show("H2  3+ top-50 recruits on roster vs opponent with 0-1", (U.n_top50 >= 3) & (U.o_n_top50 <= 1))
h3 = show("H3  recruiting class top-5 vs opponent class outside top-25", (U.class_rank <= 5) & (U.o_class_rank.fillna(999) > 25))
h4 = show("H4  2+ top-50 FRESHMEN vs opponent with none", (U.n_fresh_top50 >= 2) & (U.o_n_fresh_top50 == 0))
h5 = show("H5  poll premium 8+ (AP likes them 8+ spots more than KenPom) vs opponent premium <= 0", (U.poll_premium >= 8) & (U.o_poll_premium <= 0))
h6 = show("H6  H1 and NEW hype (previous season KenPom final rank worse than 25)", (U.hype_rank <= 10) & (U.o_hype_rank > 25) & (U.kp_prev_final.fillna(999) > 25))
h7 = show("H7  the hype GAP: own composite hype beats opponent's by 3+ z", (U.hype - U.o_hype) >= 3)
h8 = show("H8  opposite side: opponent is the hype team (fade view of H1)", (U.o_hype_rank <= 10) & (U.hype_rank > 25))

print("\n--- H1 teams and their early major games (closing spread from the hype team's side, ATS result) ---")
print(h1.sort_values(["season", "date"])[["season", "date", "team", "opponent", "neutral", "is_home", "spread", "margin", "ats_pts", "ap_rank", "o_ap_rank"]].to_string(index=False))
