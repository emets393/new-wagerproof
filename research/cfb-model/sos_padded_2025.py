"""
List the 2025 games that triggered the FADE-PADDED-ROAD-TEAM spot (away good rating + weak SOS + market still
trusts the rating). Shows teams, line, both power ratings (in points-above-avg), PR-implied line, away SOS, result.
Thresholds/calibration from training (<2025) — matches the harness.
"""
import numpy as np
import pandas as pd
import sos_signals

gm = pd.read_parquet("data/model_games.parquet")
ss = sos_signals.build(gm)
S = 2025
tr = gm[(gm.season < S) & gm.net_rating_diff.notna() & gm.actual_margin.notna()]
b1, b0 = np.polyfit(tr.net_rating_diff, tr.actual_margin, 1)        # points per net_rating unit; b0 = HFA
nr_med = pd.concat([gm[gm.season < S].home_net_rating, gm[gm.season < S].away_net_rating]).median()
sos_q40 = ss.merge(gm[["season", "game_id"]], on=["season", "game_id"]).query("season < @S").sos.quantile(0.40)

te = gm[gm.season == S].copy()
te = te.merge(ss.rename(columns={"team": "homeTeam", "sos": "h_sos", "sos_np": "h_np"}), on=["season", "game_id", "homeTeam"]) \
       .merge(ss.rename(columns={"team": "awayTeam", "sos": "a_sos", "sos_np": "a_np"}), on=["season", "game_id", "awayTeam"])
te["pr_margin"] = b0 + b1 * te.net_rating_diff
te["sos_resid"] = (-te.spread_close) - te.pr_margin
te["padded"] = (te.away_net_rating > nr_med) & (te.a_sos < sos_q40) & (te.a_np >= 4)
spot = te[te.padded & (te.sos_resid <= -1) & te.actual_margin.notna()].copy()
spot["home_cover"] = (spot.actual_margin + spot.spread_close) > 0
spot["away_PR"] = (spot.away_net_rating * b1).round(1)
spot["home_PR"] = (spot.home_net_rating * b1).round(1)
spot["away_SOS_pts"] = (spot.a_sos * b1).round(1)
spot["pr_line_home"] = (-spot.pr_margin).round(1)     # PR-implied home spread
spot = spot.sort_values("week")

w = int(spot.home_cover.sum()); n = len(spot)
print(f"FADE-PADDED-ROAD-TEAM — 2025 triggers: {n} games | HOME (the bet) covered {w}-{n-w} = {100*w/n:.1f}%\n")
print(f"PR calibration: {b1:.1f} pts/unit, HFA {b0:.1f}. Power rating = pts above an average team.\n")
hdr = f"{'wk':>2} {'matchup (away @ home)':<34}{'line(home)':>11}{'awayPR':>7}{'homePR':>7}{'PRline':>7}{'awSOS':>6}{'result':>9}{'bet':>5}"
print(hdr); print("-" * len(hdr))
for _, r in spot.iterrows():
    mat= f"{r.awayTeam} @ {r.homeTeam}"
    line = f"{r.spread_close:+.1f}"
    res = f"{r.homeTeam[:3]} {'+' if r.actual_margin>0 else ''}{int(r.actual_margin)}"
    res = f"{int(r.homePoints)}-{int(r.awayPoints)}"
    bet = "WIN" if r.home_cover else "loss"
    print(f"{int(r.week):>2} {mat[:34]:<34}{line:>11}{r.away_PR:>7}{r.home_PR:>7}{r.pr_line_home:>7}{r.away_SOS_pts:>6}{res:>9}{bet:>5}")
