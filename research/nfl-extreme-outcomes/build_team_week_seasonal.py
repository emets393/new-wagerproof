#!/usr/bin/env python3
"""REAL season-to-date team_week (owner blend audit, 2026-09-17).

The production table nfl_pregame_advanced_team_week (mirrored to data/team_week.parquet) labels
its columns `_s2d` but NEVER resets by season: Buffalo's 2025 wk1 row = its 2024 wk18 row exactly,
and `off_drives_seen` runs 93 -> 1,565 from 2018 to 2025. "Points per drive season-to-date" is
an 8-season franchise average. The power ratings' 7 production CORE features and the shipped
late-season-defense family both read it.

This rebuilds the 7 CORE stats from play-by-play with the SAME entering rule the FP units use:
  entering week w = (K * prior-season mean + sum of this season's per-game values) / (K + games)
  K = 4, so week 2 is 20% this season, week 5 is 50%. Rows are emitted for every week 1..last+1
  so the unplayed next week has an entering row (never join on the unplayed week).
Output: data/team_week_seasonal.parquet with the production column names, team = nflverse abbr.
"""
import glob
import numpy as np
import pandas as pd

import os
K = float(os.environ.get("TW_K", "4"))
OUT = os.environ.get("TW_OUT", "data/team_week_seasonal.parquet")
COLS = ["game_id", "play_id", "season", "week", "posteam", "defteam", "play_type", "pass", "rush", "epa", "wp",
        "pass_oe", "fixed_drive", "fixed_drive_result", "season_type"]
frames = []
# _pbp<season>.parquet = refresh_pbp_current.py (current + prior season; the only files on Render's
# ephemeral disk). _dl_/pbp_ = the full local history. Same season in two files dedupes by play.
for f in sorted(glob.glob("data/pbp_cache/_dl_*.parquet")) + sorted(glob.glob("data/pbp_cache/pbp_20*.parquet")) + \
         sorted(glob.glob("data/pbp_cache/_pbp*.parquet")):
    cols = pd.read_parquet(f).columns if "_pbp" in f else None
    try:
        d = pd.read_parquet(f, columns=[c for c in COLS if cols is None or c in cols])
    except Exception:
        d = pd.read_parquet(f); d = d[[c for c in COLS if c in d.columns]]
    if d.season.min() < 2018:
        continue
    frames.append(d)
p = pd.concat(frames, ignore_index=True).drop_duplicates(["game_id", "play_id"])
if "season_type" in p.columns:
    p = p[p.season_type.fillna("REG") == "REG"]
p = p[p.posteam.notna() & p.defteam.notna()]
p["posteam"] = p.posteam.replace({"OAK": "LV", "SD": "LAC", "STL": "LA"})
p["defteam"] = p.defteam.replace({"OAK": "LV", "SD": "LAC", "STL": "LA"})
neutral = (p.wp >= 0.10) & (p.wp <= 0.90)         # "neutral" = win probability 10-90%
pas = p[(p["pass"] == 1) & neutral & p.epa.notna()]
rus = p[(p["rush"] == 1) & neutral & p.epa.notna()]
poe = p[p.pass_oe.notna() & neutral]
drv = p[p.fixed_drive.notna()].drop_duplicates(["game_id", "posteam", "fixed_drive"])
drv["dpts"] = drv.fixed_drive_result.map({"Touchdown": 7.0, "Field goal": 3.0}).fillna(0.0)

def per_game(d, side, col, agg="mean", name=None):
    return d.groupby(["season", "week", "game_id", side])[col].agg(agg).rename(name).reset_index().rename(columns={side: "team"})

G = None
for d, side, col, name in ((pas, "posteam", "epa", "off_pass_epa_neutral_s2d"), (rus, "posteam", "epa", "off_rush_epa_neutral_s2d"),
                           (poe, "posteam", "pass_oe", "off_proe_s2d"), (drv, "posteam", "dpts", "off_pts_per_drive_s2d"),
                           (pas, "defteam", "epa", "def_pass_epa_allowed_neutral_s2d"), (rus, "defteam", "epa", "def_rush_epa_allowed_neutral_s2d"),
                           (drv, "defteam", "dpts", "def_pts_per_drive_allowed_s2d")):
    g = per_game(d, side, col, name=name)
    G = g if G is None else G.merge(g, on=["season", "week", "game_id", "team"], how="outer")
STATS = [c for c in G.columns if c.endswith("_s2d")]
G = G.sort_values(["team", "season", "week"])

# entering values on a full week grid (1 .. last played + 1), K-seeded from the prior season
prior = G.groupby(["team", "season"])[STATS].mean()
# rows run through the SEASON's last played week + 1 for every team (not the team's own last game),
# so a team coming off a bye still has an entering row for the next week — the live scorer joins on
# (team, season, week) and a missing row would silently hand the model NaN for that team
season_last = G.groupby("season").week.max()
rows = []
for (team, season), g in G.groupby(["team", "season"]):
    g = g.sort_values("week")
    pri = prior.loc[(team, season - 1)] if (team, season - 1) in prior.index else pd.Series(np.nan, index=STATS)
    last = int(season_last[season])
    for wk in range(1, min(last + 1, 18 if season < 2021 else 19) + 1):
        played = g[g.week < wk]
        n = len(played); s = played[STATS].sum()
        v = (pri.fillna(0) * K + s) / (K + n)
        v[pri.isna() & (n == 0)] = np.nan
        rows.append(dict(season=season, week=wk, team=team, games_played=n, **v.to_dict()))
T = pd.DataFrame(rows)
T.to_parquet(OUT, index=False)

# ---- sanity: the same BUF example the audit used, and how much week 2 is week 1
print(f"built {len(T)} team-weeks {T.season.min()}-{T.season.max()}, stats: {STATS}")
b = T[(T.season == 2025) & (T.team == "BUF") & (T.week <= 6)]
print(b[["week", "games_played", "off_pts_per_drive_s2d", "off_pass_epa_neutral_s2d", "off_proe_s2d"]].round(3).to_string(index=False))
w1 = T[T.week == 1].set_index(["season", "team"]).off_pts_per_drive_s2d
w2 = T[T.week == 2].set_index(["season", "team"]).off_pts_per_drive_s2d
w9 = T[T.week == 9].set_index(["season", "team"]).off_pts_per_drive_s2d
print(f"corr(wk1, wk2) = {w1.corr(w2):+.3f}   corr(wk1, wk9) = {w1.corr(w9):+.3f}   (cumulative prod table: +1.000 / ~+1.000)")
old = pd.read_parquet("data/team_week.parquet")
C2A = {"Arizona":"ARI","Atlanta":"ATL","Baltimore":"BAL","Buffalo":"BUF","Carolina":"CAR","Chicago":"CHI","Cincinnati":"CIN","Cleveland":"CLE","Dallas":"DAL","Denver":"DEN","Detroit":"DET","Green Bay":"GB","Houston":"HOU","Indianapolis":"IND","Jacksonville":"JAX","Kansas City":"KC","LA Rams":"LA","LA Chargers":"LAC","Las Vegas":"LV","Miami":"MIA","Minnesota":"MIN","New England":"NE","New Orleans":"NO","NY Giants":"NYG","NY Jets":"NYJ","Philadelphia":"PHI","Pittsburgh":"PIT","Seattle":"SEA","San Francisco":"SF","Tampa Bay":"TB","Tennessee":"TEN","Washington":"WAS"}
old["team"] = old.team.map(C2A).fillna(old.team)
j = T.merge(old, on=["season", "week", "team"], suffixes=("", "_cum"))
j = j[j.week >= 10]
print("corr(seasonal, cumulative) at week>=10 — how much of the real season the old column ever saw:")
for c in STATS:
    print(f"  {c:38s} {j[c].corr(j[c + '_cum']):+.3f}")
