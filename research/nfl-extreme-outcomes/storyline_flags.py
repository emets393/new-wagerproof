#!/usr/bin/env python3
"""Storyline flags for any player-game frame (owner, 2026-09-19). Shared by exp_storyline_props.py, the pass-TD and
anytime-TD studies, and the weekly board.
flag(df) needs columns: player_id (gsis), season, week, team, opp, is_home (bool). Adds:
  gameday, dist_site, dist_own, hc (visiting, birthplace <=120 mi of the site, own stadium >120 mi), hc_rare (hc and non-division),
  bday_diff, birthday3, revenge, n_seasons, seasons_since, drafted_by_opp, first_meeting, drama_tier.
Sources: data/player_bio.parquet, data/game_sites.parquet, data/player_team_weeks.parquet, data/storyline_drama.csv."""
import numpy as np, pandas as pd
STAD = {"ARI":(33.5276,-112.2626),"ATL":(33.7554,-84.4010),"BAL":(39.2780,-76.6227),"BUF":(42.7738,-78.7870),"CAR":(35.2258,-80.8528),"CHI":(41.8623,-87.6167),"CIN":(39.0954,-84.5160),"CLE":(41.5061,-81.6995),"DAL":(32.7473,-97.0945),"DEN":(39.7439,-105.0201),"DET":(42.3400,-83.0456),"GB":(44.5013,-88.0622),"HOU":(29.6847,-95.4107),"IND":(39.7601,-86.1639),"JAX":(30.3239,-81.6373),"KC":(39.0489,-94.4839),"LV":(36.0909,-115.1833),"LAC":(33.9535,-118.3392),"LA":(33.9535,-118.3392),"MIA":(25.9580,-80.2389),"MIN":(44.9736,-93.2575),"NE":(42.0909,-71.2643),"NO":(29.9511,-90.0812),"NYG":(40.8135,-74.0745),"NYJ":(40.8135,-74.0745),"PHI":(39.9008,-75.1675),"PIT":(40.4468,-80.0158),"SF":(37.4032,-121.9698),"SEA":(47.5952,-122.3316),"TB":(27.9759,-82.5033),"TEN":(36.1665,-86.7713),"WAS":(38.9076,-76.8645)}
DIV = {"BUF":"AFCE","MIA":"AFCE","NE":"AFCE","NYJ":"AFCE","BAL":"AFCN","CIN":"AFCN","CLE":"AFCN","PIT":"AFCN","HOU":"AFCS","IND":"AFCS","JAX":"AFCS","TEN":"AFCS","DEN":"AFCW","KC":"AFCW","LV":"AFCW","LAC":"AFCW","DAL":"NFCE","NYG":"NFCE","PHI":"NFCE","WAS":"NFCE","CHI":"NFCN","DET":"NFCN","GB":"NFCN","MIN":"NFCN","ATL":"NFCS","CAR":"NFCS","NO":"NFCS","TB":"NFCS","ARI":"NFCW","LA":"NFCW","SF":"NFCW","SEA":"NFCW"}
def hav(la1, lo1, la2, lo2):
    la1, lo1, la2, lo2 = map(np.radians, (la1, lo1, la2, lo2)); a = np.sin((la2 - la1) / 2) ** 2 + np.cos(la1) * np.cos(la2) * np.sin((lo2 - lo1) / 2) ** 2; return 3958.8 * 2 * np.arcsin(np.sqrt(a))
def _key(n):
    n = "".join(ch for ch in str(n).lower().replace(".", "").replace("'", "") if ch.isalnum() or ch == " ").strip().split(); return (n[0][0] + " " + n[-1]) if n else str(n)
def flag(df, player_name_col="player_name"):
    d = df.copy(); d["team"] = d.team.replace({"LAR":"LA"}); d["opp"] = d.opp.replace({"LAR":"LA"}); d["is_home"] = d.is_home.astype(bool)
    d["home"] = np.where(d.is_home, d.team, d.opp); d["away"] = np.where(d.is_home, d.opp, d.team)
    S = pd.read_parquet("data/game_sites.parquet"); S = S[S.game_type == "REG"][["season","week","home_team","away_team","gameday","site_lat","site_lon","site"]]
    d = d.merge(S, left_on=["season","week","home","away"], right_on=["season","week","home_team","away_team"], how="left").drop(columns=["home_team","away_team"]); d["gameday"] = pd.to_datetime(d.gameday)
    d["site_lat"] = d.site_lat.fillna(d.home.map(lambda t: STAD.get(t, (np.nan, np.nan))[0])); d["site_lon"] = d.site_lon.fillna(d.home.map(lambda t: STAD.get(t, (np.nan, np.nan))[1]))
    B = pd.read_parquet("data/player_bio.parquet")[["gsis_id","birth_date","birth_city","birth_st","birth_lat","birth_lon","draft_team"]].rename(columns={"gsis_id":"player_id"}).drop_duplicates("player_id")
    d = d.merge(B, on="player_id", how="left"); d["birth_date"] = pd.to_datetime(d.birth_date, errors="coerce"); d["draft_team"] = d.draft_team.replace({"LAR":"LA","OAK":"LV","SD":"LAC","STL":"LA"})
    d["dist_site"] = hav(d.birth_lat, d.birth_lon, d.site_lat, d.site_lon); own = d.team.map(lambda t: STAD.get(t, (np.nan, np.nan))); d["dist_own"] = hav(d.birth_lat, d.birth_lon, own.map(lambda x: x[0]), own.map(lambda x: x[1]))
    d["div_game"] = d.team.map(DIV) == d.opp.map(DIV); d["hc"] = (d.dist_site <= 120) & ~d.is_home & (d.dist_own > 120); d["hc_rare"] = d.hc & ~d.div_game
    def bdiff(b, g):
        if pd.isna(b) or pd.isna(g): return np.nan
        try: this = b.replace(year=g.year)
        except ValueError: this = b.replace(year=g.year, day=28)
        return (g - this).days
    d["bday_diff"] = [bdiff(b, g) for b, g in zip(d.birth_date, d.gameday)]; d["birthday3"] = d.bday_diff.abs() <= 3
    W = pd.read_parquet("data/player_team_weeks.parquet"); W = W[W.game_type.fillna("REG") == "REG"]
    hist = W.groupby(["player_id","team"]).agg(last_season=("season","max"), n_seasons=("season","nunique")).reset_index().rename(columns={"team":"opp"})
    d = d.merge(hist, on=["player_id","opp"], how="left"); d["revenge"] = d.last_season.notna() & (d.last_season < d.season); d["seasons_since"] = d.season - d.last_season; d["drafted_by_opp"] = d.draft_team == d.opp
    first = d[d.revenge].sort_values(["season","week"]).drop_duplicates(["player_id","opp"])[["player_id","opp","season","week"]].assign(first_meeting=True); d = d.merge(first, on=["player_id","opp","season","week"], how="left"); d["first_meeting"] = d.first_meeting.fillna(False).astype(bool) & d.revenge
    dr = pd.read_csv("data/storyline_drama.csv"); dr = dr[dr.tier > 0].copy(); dr["_k"] = dr.player.map(_key); tier = dr.groupby(["_k","old_team"]).tier.min().rename("drama_tier").reset_index()
    d["_k"] = d[player_name_col].map(_key); d = d.merge(tier, left_on=["_k","opp"], right_on=["_k","old_team"], how="left").drop(columns=["old_team","_k"]); d["drama_tier"] = np.where(d.revenge, d.drama_tier.fillna(0), np.nan)
    return d
