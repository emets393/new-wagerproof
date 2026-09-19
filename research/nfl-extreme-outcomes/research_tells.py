#!/usr/bin/env python3
"""RESEARCH TELLS for the Player Prop Report (owner, 2026-09-19): the validated pieces of this season's Fantasy Points
research, turned into per-prop tells that nfl_prop_narratives.py adds to its matchup / form / defense / injury / model tells.
Every tell says where its number comes from.
  tendency   the player's own tendency that holds every season (data/_qb_profiles_<stat>_<season>.parquet) whose trigger is
             live this week: wind, heat/cold, favorite/underdog, game total, home/road, rest, blitz-heavy or low-blitz opponent
             (the opposing coordinator's 2022-25 blitz rate)                                         weight 1.5
  storyline  QB vs a former team -> passing yards UNDER (60% under across 59 games 2023-25; TDs 70%); skill player in his first
             season away vs the old team -> OVER (60% over, 154 lines 2023-25, vs 47% elsewhere); QB birthday week -> passing
             yards OVER (69%, 42 lines — small, weight 1.0); a player's OWN homecoming record when 3+ games and lopsided   1.5 / 1.0
  coaching   the offensive play-caller's stable situational shift that is live this week (primetime / divisional / cold / windy /
             home / favorite / underdog / short rest / bye / vs blitz-heavy): pass-heavy -> QB volume and receivers OVER;
             run-heavy -> rush attempts/yards OVER and pass attempts UNDER (play-by-play 2022-25)                     weight 1.0
Usage: RT = ResearchTells(season, week, games_by_id); RT.tells(prop_row) -> list of dict(src, dir, text, w)."""
import os, numpy as np, pandas as pd
from storyline_flags import flag, DIV
num = lambda s: pd.to_numeric(s, errors="coerce")
pct = lambda v: f"{100*v:.0f}%" if pd.notna(v) else "—"
MARKET_STAT = {"player_pass_attempts": "attempts", "player_pass_completions": "completions", "player_pass_yds": "yds", "player_pass_tds": "tds", "player_receptions": "receptions", "player_reception_yds": "reception_yds", "player_rush_attempts": "rush_attempts", "player_rush_yds": "rush_yds"}
MARKET_LABEL = {"player_pass_attempts": "pass attempts", "player_pass_completions": "completions", "player_pass_yds": "passing yards", "player_pass_tds": "passing touchdowns", "player_receptions": "receptions", "player_reception_yds": "receiving yards", "player_rush_attempts": "rushing attempts", "player_rush_yds": "rushing yards"}
def _key(nm, keys):
    p = str(nm).replace(".", "").split(); c = [k for k in keys if k.split(".")[-1].lower() == p[-1].lower() and k[0].lower() == p[0][0].lower()]; return c[0] if c else None
class ResearchTells:
    def __init__(self, season, week, games, board):
        """games: {game_id: slate row (home_ab, away_ab, kickoff, fg_spread_close, fg_total_close, wx_wind_mph, wx_temp_f)};
        board: DataFrame of this week's props with player_id, player_name, position, team, game_id."""
        self.season, self.week = season, week; self.games = games
        try:
            import nfl_data_py as nfl; S = nfl.import_schedules([season]); S = S[S.week == week]; S["home_team"] = S.home_team.replace({"LAR":"LA"}); S["away_team"] = S.away_team.replace({"LAR":"LA"})
            self.rest = {(r.home_team, r.away_team): (r.home_rest, r.away_rest, str(r.roof)) for r in S.itertuples()}
        except Exception: self.rest = {}
        self.ctx = {}
        for gid, g in games.items():
            home, away = str(g["home_ab"]).replace("LAR", "LA"), str(g["away_ab"]).replace("LAR", "LA"); k = pd.to_datetime(g["kickoff"]).tz_convert("US/Eastern"); hr, ar, roof = self.rest.get((home, away), (7, 7, "unknown"))
            wind = float(g["wx_wind_mph"]) if g.get("wx_wind_mph") is not None else np.nan; temp = float(g["wx_temp_f"]) if g.get("wx_temp_f") is not None else np.nan; indoors = roof in ("dome", "closed") or (np.isnan(wind) and np.isnan(temp))
            self.ctx[str(gid)] = dict(home=home, away=away, primetime=(k.hour >= 19) or k.day_name() in ("Monday","Thursday"), div=DIV.get(home) == DIV.get(away), wind=wind, temp=temp, indoors=indoors, cold=(not indoors) and temp <= 40, windy=(not indoors) and wind >= 15,
                                      spread_home=float(g["fg_spread_close"]) if g.get("fg_spread_close") is not None else np.nan, total=float(g["fg_total_close"]) if g.get("fg_total_close") is not None else np.nan, home_rest=hr, away_rest=ar)
        # storyline flags for every player on the board
        P = board.drop_duplicates("player_id")[["player_id","player_name","team","position","game_id"]].copy(); P["team"] = P.team.replace({"LAR":"LA"}); P["season"], P["week"] = season, week
        P["home"] = P.game_id.map(lambda g: self.ctx.get(str(g), {}).get("home")); P["away"] = P.game_id.map(lambda g: self.ctx.get(str(g), {}).get("away")); P = P[P.home.notna()]; P["is_home"] = P.team == P.home; P["opp"] = np.where(P.is_home, P.away, P.home)
        F = flag(P, "player_name") if len(P) else P
        hist = "data/_storyline_player_history.parquet"
        if os.path.exists(hist): F = F.merge(pd.read_parquet(hist), on="player_id", how="left", suffixes=("", "_h"))
        self.F = F.set_index("player_id") if len(F) else F
        # coaching
        PC = pd.read_csv("data/play_callers.csv"); PC["team"] = PC.team.replace({"LAR":"LA"}); self.pc = PC[PC.season == season].set_index("team").play_caller.to_dict()
        CS = pd.read_csv("data/coaching_staff.csv"); CS["team"] = CS.team.replace({"LAR":"LA"}); self.dc = CS[CS.season == season].set_index("team").dc.to_dict()
        self.SIT = pd.read_parquet("data/_coach_situations_pc.parquet") if os.path.exists("data/_coach_situations_pc.parquet") else pd.DataFrame(); self.SIT = self.SIT[self.SIT.stable] if len(self.SIT) else self.SIT
        self.DID = pd.read_parquet("data/_dc_identity.parquet").set_index("coach") if os.path.exists("data/_dc_identity.parquet") else pd.DataFrame(); self.lg_blitz = float(self.DID.blitz.median()) if len(self.DID) else 0.24
        self.PROF = {}
        for stat in ("attempts","completions","yds","tds","receptions","reception_yds","rush_attempts","rush_yds"):
            f = f"data/_qb_profiles_{stat}_{season}.parquet"
            if os.path.exists(f): self.PROF[stat] = pd.read_parquet(f)
    def team_ctx(self, gid, team):
        x = self.ctx[str(gid)]; is_home = team == x["home"]; sp = (x["spread_home"] if is_home else -x["spread_home"]) if not np.isnan(x["spread_home"]) else np.nan; r = x["home_rest"] if is_home else x["away_rest"]
        opp = x["away"] if is_home else x["home"]; dc = self.dc.get(opp); ob = self.DID.blitz.get(dc, np.nan) if (len(self.DID) and dc in self.DID.index) else np.nan
        return dict(is_home=is_home, opp=opp, spread=sp, fav=(sp <= -3) if not np.isnan(sp) else False, dog=(sp >= 3) if not np.isnan(sp) else False, rest=r, short_rest=(r is not None and r <= 5), off_bye=(r is not None and r >= 13), opp_dc=dc, opp_blitz=ob, opp_blitz_high=pd.notna(ob) and ob >= self.lg_blitz + 0.05, opp_blitz_low=pd.notna(ob) and ob <= self.lg_blitz - 0.05, **x)
    def _tendency(self, t, c, mk):
        f, r = t["factor"], t["r"]
        if f == "wind" and (not c["indoors"]) and c["wind"] >= 12: hi, cond = True, f"with wind at {c['wind']:.0f} mph"
        elif f == "temp" and (not c["indoors"]) and (c["temp"] <= 45 or c["temp"] >= 85): hi, cond = c["temp"] >= 85, f"in {'heat' if c['temp'] >= 85 else 'cold'} ({c['temp']:.0f}°F forecast)"
        elif f == "team_spread" and (c["fav"] or c["dog"]): hi, cond = c["dog"], "as an underdog" if c["dog"] else "as a favorite"
        elif f == "total" and (not np.isnan(c["total"])) and (c["total"] >= 48 or c["total"] <= 41): hi, cond = c["total"] >= 48, f"in {'high' if c['total'] >= 48 else 'low'}-total games (this one is {c['total']:g})"
        elif f == "is_home": hi, cond = c["is_home"], "at home" if c["is_home"] else "on the road"
        elif f == "rest" and (c["short_rest"] or c["off_bye"]): hi, cond = c["off_bye"], "off a bye" if c["off_bye"] else "on short rest"
        elif f == "primetime" and c["primetime"]: hi, cond = True, "in primetime"
        elif f == "opp_rate_blitz" and (c["opp_blitz_high"] or c["opp_blitz_low"]): hi, cond = c["opp_blitz_high"], f"against {'blitz-heavy' if c['opp_blitz_high'] else 'low-blitz'} defenses ({c['opp_dc']} blitzes {pct(c['opp_blitz'])}, 2022-25)"
        else: return None
        up = (r > 0) == bool(hi); return ("over" if up else "under"), f"his {mk} have run {'above' if up else 'below'} the line {cond}"
    def tells(self, r):
        """r: prop row with player_id, player_name, position, team, game_id, market."""
        out = []; gid = str(r.game_id)
        if gid not in self.ctx: return out
        c = self.team_ctx(gid, str(r.team).replace("LAR", "LA")); mk = MARKET_LABEL.get(r.market, r.market); stat = MARKET_STAT.get(r.market)
        # 1. per-player tendency, trigger live
        pf = self.PROF.get(stat)
        if pf is not None:
            k = _key(r.player_name, pf.qb.unique()); pr = pf[pf.qb == k] if k else None
            if pr is not None and len(pr):
                pr = pr.iloc[0]; tl = list(pr.tendencies) if pr.tendencies is not None and len(pr.tendencies) else []
                for t in tl:
                    v = self._tendency(t, c, mk)
                    if v: out.append(dict(src="tendency", dir=v[0], text=v[1] + f" in every season since 2023 ({int(pr.games)} games with a sportsbook line)", w=1.5))
        # 2. storylines
        pid = str(r.player_id)
        if len(self.F) and pid in self.F.index:
            f = self.F.loc[pid]
            if bool(f.get("revenge", False)):
                if r.position == "QB" and r.market in ("player_pass_yds", "player_pass_tds", "player_pass_completions", "player_pass_attempts"):
                    out.append(dict(src="storyline", dir="under", text=f"he faces his former team ({int(f.n_seasons)} season{'s' if f.n_seasons > 1 else ''} there): quarterbacks facing a former team have finished below their passing-yards number 60% of the time and below their touchdown-pass number 70% (59 games, 2023 to 2025)", w=1.5 if r.market in ("player_pass_yds","player_pass_tds") else 1.0))
                elif r.position != "QB" and f.get("seasons_since", 9) <= 1:
                    out.append(dict(src="storyline", dir="over", text=f"first season away from {f.opp}, facing them: skill players in that spot have finished above the sportsbooks' numbers 60% of the time, against 47% in their other games (154 lines, 2023 to 2025)", w=1.5))
                if pd.notna(f.get("rv_games", np.nan)) and f.rv_games >= 3 and (f.rv_over >= 0.67 or f.rv_over <= 0.33):
                    out.append(dict(src="storyline", dir="over" if f.rv_over >= 0.67 else "under", text=f"his own record vs former teams: over the line {pct(f.rv_over)} across {int(f.rv_games)} games (2023-25), {pct(f.rv_else_over)} elsewhere", w=1.0))
            if bool(f.get("hc", False)) and pd.notna(f.get("hc_games", np.nan)) and f.hc_games >= 3 and (f.hc_over >= 0.67 or f.hc_over <= 0.33):
                out.append(dict(src="storyline", dir="over" if f.hc_over >= 0.67 else "under", text=f"homecoming ({f.dist_site:.0f} miles from {f.birth_city}, {f.birth_st}): his own record on these trips is over the line {pct(f.hc_over)} across {int(f.hc_games)} games (2023-25), {pct(f.else_over)} elsewhere", w=1.0))
            if bool(f.get("birthday3", False)) and r.position == "QB" and r.market == "player_pass_yds":
                out.append(dict(src="storyline", dir="over", text=f"birthday week ({f.birth_date.strftime('%b %d')}): quarterbacks in a birthday week have finished above their passing-yards number 69% of the time (42 lines, 2023 to 2025 — a small sample)", w=1.0))
        # 3. play-caller shift live this week
        pc = self.pc.get(str(r.team).replace("LAR", "LA"))
        if pc and len(self.SIT):
            live = {"primetime": c["primetime"], "divisional": c["div"], "cold (≤40°F outdoors)": c["cold"], "windy (≥15 mph)": c["windy"], "home": c["is_home"], "favorite (−3 or more)": c["fav"], "underdog (+3 or more)": c["dog"], "short rest (≤5 days)": c["short_rest"], "off a bye": c["off_bye"], "vs blitz-heavy defense": c["opp_blitz_high"]}
            for s in self.SIT[self.SIT.coach == pc].itertuples():
                if not live.get(s.situation): continue
                passy = s.relative > 0
                if r.market.startswith("player_pass") or r.market in ("player_receptions", "player_reception_yds"): d = "over" if passy else "under"
                elif r.market in ("player_rush_attempts", "player_rush_yds"): d = "under" if passy else "over"
                else: continue
                out.append(dict(src="coaching", dir=d, text=f"his play-caller {pc} {'throws' if passy else 'runs'} more than a typical coach does in {s.situation.split(' (')[0]} games — about {abs(s.relative):.0f} points more {'pass' if passy else 'run'}-heavy than everyone else gets in that spot, every season ({int(s.plays)} plays 2022-25)", w=1.0)); break
        return out
