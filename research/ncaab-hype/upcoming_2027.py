#!/usr/bin/env python3
"""This season's games that meet the early-hype fade conditions (see README): November-December, one roster with 3+
top-50 recruits (classes through 2025 joined by athlete id, class of 2026 by commitment), opponent with 0-1, opponent a
power-conference team or KenPom top-40 now, |spread| <= 12 once a line exists. Until the line posts, a projected spread
from KenPom AdjEM (plus 3 for the home side) says which games are likely to pass.

Inputs in data/: cbbd_rosters_2027, cbbd_recruit_players_2027, cbbd_games_2027 (CBBD), kenpom_now (KenPom API y=2027),
odds_now (The Odds API, re-pull before use), team_mapping (KenPom name -> CBBD id).
"""
import pandas as pd

D = "data"
t = pd.read_parquet(f"{D}/hype_2027.parquet")
G = pd.read_parquet(f"{D}/cbbd_games_2027.parquet"); G["startDate"] = pd.to_datetime(G.startDate)
K = pd.read_parquet(f"{D}/kenpom_now.parquet")
mp = pd.read_parquet(f"{D}/team_mapping.parquet")
K = K.merge(mp[["KenPom_Name", "api_team_id"]], left_on="TeamName", right_on="KenPom_Name", how="inner")
kp_rank = dict(zip(K.api_team_id, K.RankAdjEM)); kp_em = dict(zip(K.api_team_id, K.AdjEM.astype(float)))
POWER = {"ACC", "Big 12", "Big Ten", "SEC", "Big East"}
top = dict(zip(t.teamId, t.n_top50)); fresh = dict(zip(t.teamId, t.fresh_top50))
G = G[G.startDate.dt.month.isin([11, 12])].copy()
for s in ("home", "away"):
    G[f"{s}_top50"] = G[f"{s}TeamId"].map(top).fillna(0).astype(int)
    G[f"{s}_fresh"] = G[f"{s}TeamId"].map(fresh).fillna(0).astype(int)
    G[f"{s}_kp"] = G[f"{s}TeamId"].map(kp_rank)
    G[f"{s}_em"] = G[f"{s}TeamId"].map(kp_em)
G["major_home"] = G.homeConference.isin(POWER) | (G.home_kp <= 40)
G["major_away"] = G.awayConference.isin(POWER) | (G.away_kp <= 40)
hype_home = (G.home_top50 >= 3) & (G.away_top50 <= 1) & G.homeConference.isin(POWER) & G.major_away
hype_away = (G.away_top50 >= 3) & (G.home_top50 <= 1) & G.awayConference.isin(POWER) & G.major_home
S = G[hype_home | hype_away].copy()
S["hype_is_home"] = hype_home[S.index]
S["hype_team"] = S.apply(lambda r: r.homeTeam if r.hype_is_home else r.awayTeam, axis=1)
S["fade_side"] = S.apply(lambda r: r.awayTeam if r.hype_is_home else r.homeTeam, axis=1)
S["venue"] = S.apply(lambda r: "neutral" if r.neutralSite else ("hype at home" if r.hype_is_home else "hype on road"), axis=1)
S["hype_top50"] = S.apply(lambda r: r.home_top50 if r.hype_is_home else r.away_top50, axis=1)
S["hype_fresh"] = S.apply(lambda r: r.home_fresh if r.hype_is_home else r.away_fresh, axis=1)
S["hype_kp"] = S.apply(lambda r: r.home_kp if r.hype_is_home else r.away_kp, axis=1)
S["opp_kp"] = S.apply(lambda r: r.away_kp if r.hype_is_home else r.home_kp, axis=1)
# projected spread from the hype team's side: negative = hype team favoured. KenPom EM gap plus ~3 for a true home side.
hc = S.apply(lambda r: 0 if r.neutralSite else (3 if r.hype_is_home else -3), axis=1)
S["proj_spread"] = -((S.apply(lambda r: r.home_em if r.hype_is_home else r.away_em, axis=1) - S.apply(lambda r: r.away_em if r.hype_is_home else r.home_em, axis=1)) + hc).round(1)
S["likely_pass"] = S.proj_spread.abs() <= 12
try:
    O = pd.read_parquet(f"{D}/odds_now.parquet")
    def line(r):
        m = O[O.home.str.contains(r.homeTeam.split()[0]) & O.away.str.contains(r.awayTeam.split()[0])]
        if not len(m):
            return None
        hs = float(m.home_spread.iloc[0]); return hs if r.hype_is_home else -hs
    S["posted_spread"] = S.apply(line, axis=1)
except FileNotFoundError:
    S["posted_spread"] = None
S["date_et"] = S.startDate.dt.tz_convert("America/New_York").dt.strftime("%a %b %d")
S = S.sort_values("startDate")
S.to_parquet(f"{D}/candidates_2027.parquet", index=False)
cols = ["date_et", "hype_team", "hype_top50", "hype_fresh", "hype_kp", "fade_side", "opp_kp", "venue", "proj_spread", "posted_spread", "likely_pass", "gameNotes"]
print(f"{len(S)} games; {int(S.likely_pass.sum())} projected inside the 12-point window\n")
print(S[cols].to_string(index=False))
