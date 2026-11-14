#!/usr/bin/env python3
"""Score-path luck vs stat luck (owner challenge 2026-09-20: "Vanderbilt was the luckiest win in CFB
history" — trailed NC State for 90% of the plays, won 35-31 on a 0:00 scoop-and-score; vendor PWE .976,
box-score WE .90 because Vandy out-gained them per snap 7.1 vs 5.6 yds/play).

Question: does fading the SCORE-PATH lucky winner predict the next game ATS (vs opener), the way
fading the STAT lucky winner (PWE <= .40, 56%) does?

Result (2021-25, 3,723 games with ESPN win-prob flow + opener, blind fade 50.0%):
  won with time-avg WP <= .30 (Vandy .27)   n= 89  fade wins 39.3%  (z -2.0; 4/5 seasons <= 47%)
  won with time-avg WP <= .25               n= 49  fade wins 38.8%
  won, <=5% WP at some point + 2H avg <=.35 n= 76  fade wins 39.5%
  STAT lucky (PWE <= .40)                   n=328  fade wins 56.1%  (z +2.2)  <- the shipped signal
  flow-lucky AND stat-lucky                 n= 34  fade wins 47.1%  (null)
  flow-lucky but STAT-dominant (PWE >= .70) n= 37  fade wins 29.7%  (z -2.5) -> BACK them 70.3%
So the two kinds of luck point OPPOSITE ways: the market over-reacts to an ugly score path and
underrates a team that actually won the snaps. Vanderbilt is a back candidate, not a fade.
STATUS: candidate, one post-hoc cut, z~2 — paper-track only (repo law: pre-reg + walk-forward)."""
import numpy as np, pandas as pd

f = pd.read_parquet("data/cfbd/cfb_wp_flow.parquet").rename(columns={"gameId": "game_id"})
mg = pd.read_parquet("data/model_games.parquet")[["game_id", "season", "week", "homeTeam", "awayTeam", "spread_open", "actual_margin"]].dropna(subset=["spread_open", "actual_margin"])
gs = pd.concat([pd.read_parquet(f"data/cfbd/games_{y}.parquet")[["id", "startDate", "homePostgameWinProbability"]] for y in (2021, 2022, 2023, 2024, 2025)]).rename(columns={"id": "game_id"})
g = mg.merge(f, on="game_id").merge(gs, on="game_id"); g = g[g.coverage >= 0.9]
rows = []
for hm in (True, False):
    s = 1 if hm else -1
    rows.append(pd.DataFrame(dict(season=g.season, date=g.startDate, team=g.homeTeam if hm else g.awayTeam,
                                  twa=g.twa_wp if hm else 1 - g.twa_wp, minwp=g.min_wp if hm else 1 - g.max_wp,
                                  twa2h=g.twa_2h if hm else 1 - g.twa_2h,
                                  pwe=g.homePostgameWinProbability if hm else 1 - g.homePostgameWinProbability,
                                  sp_open=g.spread_open * s, margin=g.actual_margin * s)))
p = pd.concat(rows, ignore_index=True).sort_values(["team", "season", "date"]).reset_index(drop=True)
p["won"] = p.margin > 0; p["cover"] = np.sign(p.margin + p.sp_open)
cells = {
    "FLOW: won, time-avg WP <= .30": p.won & (p.twa <= .30),
    "FLOW: won, time-avg WP <= .25": p.won & (p.twa <= .25),
    "FLOW: won, <=5% at some point AND 2H avg <= .35": p.won & (p.minwp <= .05) & (p.twa2h <= .35),
    "STAT: won, vendor PWE <= .40": p.won & (p.pwe <= .40),
    "BOTH: flow twa<=.30 AND PWE<=.50": p.won & (p.twa <= .30) & (p.pwe <= .50),
    "FLOW lucky but STAT dominant (twa<=.30, PWE>=.70)": p.won & (p.twa <= .30) & (p.pwe >= .70),
}
for k, m in cells.items():
    p["prev_" + k] = m.groupby([p.team, p.season]).shift(1)   # the team's PREVIOUS game this season
base = p[p.cover != 0]; blind = (base.cover < 0).mean()
print(f"games {len(g)} | blind fade {100*blind:.1f}%")
for k in cells:
    s = p[(p["prev_" + k] == True) & (p.cover != 0)]
    fade = (s.cover < 0).mean(); z = (fade - blind) * 2 * np.sqrt(len(s))
    per = " | ".join(f"{yr}:{100*(x.cover<0).mean():.0f}%(n={len(x)})" for yr, x in s.groupby("season"))
    print(f"{k:52s} n={len(s):4d} fade wins {100*fade:.1f}% z={z:+.1f}   {per}")
