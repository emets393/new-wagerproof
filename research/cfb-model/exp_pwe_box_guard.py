#!/usr/bin/env python3
"""Does CFBD's postgame win expectancy (PWE) ever contradict the box score, and does it matter
for the deceptive-win fades? (Owner catch 2026-09-20: Ole Miss beat LSU 32-24 out-gaining them
426-330 with turnovers even, and CFBD PWE said Ole Miss wins that game 15% of the time.)

Method: fit a box-score win expectancy (probit of PWE on success-rate diff, PPA diff, turnover
margin, yards diff; 2021-25 only, R2 0.72) and re-grade the shipped fades (exp_pwe_luck /
exp_pwe_ats_luck rules, next game ATS vs the OPENER) split by whether that box read agrees
(box WE <= .55 for the winner) with the PWE trigger.

Result (2026-09-20):
  double-luck fade as shipped     n=106  60.4%
    + box agrees                  n= 82  63.4%   (5 seasons 55-68%)
    box DISagrees                 n= 24  50.0%   <- pure noise; 22% of triggers
  lucky-win fade as shipped       n=234  54.7%
    + box agrees                  n=173  54.9%
    box DISagrees                 n= 61  54.1%
So the PWE glitches are real (Ole Miss box WE .66, Boston College .62) and the double-luck edge lives
entirely in the rows where the box score agrees. gen_cfb_slate_flags now requires box WE <= .55.
Frozen coefficients (2021-25 fit): const .09, sr_diff 2.21, ppa_diff 2.89, to_margin .13, yds/100 .15.
Inputs: data/cfbd/{games,game_advanced,teamgame_box}_{year}.parquet, data/model_games.parquet."""
import numpy as np, pandas as pd
from scipy.stats import norm

BOX_BETA = np.array([0.09, 2.21, 2.89, 0.13, 0.15])   # frozen; refit only in the offseason

def box_frame(years):
    rows = []
    for yr in years:
        g = pd.read_parquet(f"data/cfbd/games_{yr}.parquet")
        g = g[(g.completed == True) & g.homePostgameWinProbability.notna() & g.homePoints.notna()]
        a = pd.read_parquet(f"data/cfbd/game_advanced_{yr}.parquet")[["gameId", "team", "offense.successRate", "offense.ppa"]]
        b = pd.read_parquet(f"data/cfbd/teamgame_box_{yr}.parquet")[["game_id", "team", "turnovers", "pass_yds", "rush_yds"]]
        ah = a.rename(columns={"team": "homeTeam", "offense.successRate": "h_sr", "offense.ppa": "h_ppa"})
        aa = a.rename(columns={"team": "awayTeam", "offense.successRate": "a_sr", "offense.ppa": "a_ppa"})
        m = g.merge(ah, left_on=["id", "homeTeam"], right_on=["gameId", "homeTeam"]).merge(aa, left_on=["id", "awayTeam"], right_on=["gameId", "awayTeam"])
        bh = b.rename(columns={"team": "homeTeam", "turnovers": "h_to", "pass_yds": "h_py", "rush_yds": "h_ry"})
        ba = b.rename(columns={"team": "awayTeam", "turnovers": "a_to", "pass_yds": "a_py", "rush_yds": "a_ry"})
        m = m.merge(bh[["game_id", "homeTeam", "h_to", "h_py", "h_ry"]], left_on=["id", "homeTeam"], right_on=["game_id", "homeTeam"], how="left")
        m = m.merge(ba[["game_id", "awayTeam", "a_to", "a_py", "a_ry"]], left_on=["id", "awayTeam"], right_on=["game_id", "awayTeam"], how="left")
        m["season"] = yr; rows.append(m)
    d = pd.concat(rows, ignore_index=True)
    d["pwe"] = d.homePostgameWinProbability.astype(float)
    d["sr_diff"] = d.h_sr - d.a_sr; d["ppa_diff"] = d.h_ppa - d.a_ppa
    d["to_margin"] = d.a_to - d.h_to; d["yd"] = ((d.h_py + d.h_ry) - (d.a_py + d.a_ry)).fillna(0) / 100
    return d.dropna(subset=["sr_diff", "ppa_diff", "to_margin"]).reset_index(drop=True)

def box_we(d, beta=BOX_BETA):
    """home-team box-score win expectancy"""
    X = np.column_stack([np.ones(len(d)), d.sr_diff, d.ppa_diff, d.to_margin, d.yd])
    return norm.cdf(X @ beta)

if __name__ == "__main__":
    d = box_frame([2021, 2022, 2023, 2024, 2025, 2026])
    tr = d[d.season <= 2025]; z = norm.ppf(tr.pwe.clip(.01, .99))
    X = np.column_stack([np.ones(len(tr)), tr.sr_diff, tr.ppa_diff, tr.to_margin, tr.yd])
    beta = np.linalg.lstsq(X, z, rcond=None)[0]
    print("refit coefficients (2021-25):", np.round(beta, 2), "| frozen:", BOX_BETA)
    d["box_we"] = box_we(d)
    mg = pd.read_parquet("data/model_games.parquet")[["game_id", "season", "week", "homeTeam", "awayTeam", "spread_open", "actual_margin"]].dropna(subset=["spread_open", "actual_margin"])
    g = d.merge(mg, left_on=["id", "season"], right_on=["game_id", "season"], suffixes=("", "_m"))
    rows = []
    for is_home in (True, False):
        s = 1 if is_home else -1
        rows.append(pd.DataFrame(dict(season=g.season, date=g.startDate, team=g.homeTeam_m if is_home else g.awayTeam_m,
                                      pwe=g.pwe if is_home else 1 - g.pwe, box_we=g.box_we if is_home else 1 - g.box_we,
                                      sp_open=g.spread_open * s, margin=g.actual_margin * s)))
    p = pd.concat(rows, ignore_index=True).sort_values(["team", "season", "date"]).reset_index(drop=True)
    p["won"] = p.margin > 0; p["cover"] = np.sign(p.margin + p.sp_open)
    p["dcm"] = 10.2 * norm.ppf(p.pwe.clip(.01, .99)) + p.sp_open
    p["dl"] = p.won & (p.pwe <= .5) & (p.cover > 0) & (p.dcm <= -4); p["lw"] = p.won & (p.pwe <= .4) & ~p.dl
    p["ok"] = p.box_we <= 0.55
    for c in ["dl", "lw", "ok"]: p["prev_" + c] = p.groupby(["team", "season"])[c].shift(1)
    def rep(name, mask):
        s = p[mask & (p.cover != 0)]
        per = " | ".join(f"{yr}:{100*(x.cover<0).mean():.0f}%(n={len(x)})" for yr, x in s.groupby("season"))
        print(f"{name:36s} n={len(s):4d} fade wins {100*(s.cover<0).mean():.1f}%   {per}")
    rep("double-luck fade (as shipped)", p.prev_dl == True)
    rep("  + box agrees", (p.prev_dl == True) & (p.prev_ok == True))
    rep("  box disagrees", (p.prev_dl == True) & (p.prev_ok == False))
    rep("lucky-win fade (as shipped)", p.prev_lw == True)
    rep("  + box agrees", (p.prev_lw == True) & (p.prev_ok == True))
    rep("  box disagrees", (p.prev_lw == True) & (p.prev_ok == False))
