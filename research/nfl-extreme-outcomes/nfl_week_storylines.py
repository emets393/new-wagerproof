#!/usr/bin/env python3
"""WEEKLY STORYLINE FACTS for the NFL regression report (owner, 2026-09-19): turns the research artifacts into this week's
cards. Every card carries a SOURCE line (which seasons, how many games/plays) so the reader knows where a number comes from.
Families written to nfl_week_storylines (read by gen_nfl_regression_report.py, which owns ranking / sync / narrative):
  storylines        per game: players facing a FORMER TEAM (seasons there, drafted by them, first meeting, at the old stadium, a
                    messy exit when we know of one) with the two validated reads; players visiting near their BIRTHPLACE with their
                    own homecoming record; quarterbacks in a BIRTHDAY week
  coaching          per game: both offensive PLAY-CALLERS (identity, red-zone calls, goal-line back usage, the situational shifts that
                    are ON this week) and both DEFENSIVE COORDINATORS (blitz / box identity, shifts ON this week)
  player_tendencies per game: quarterbacks' and receivers' per-player tendencies that hold every season AND whose trigger is live this
                    week (wind, cold, spread, total, home, rest, blitz-heavy opponent), from the priced-line profiles; anytime-TD
                    per-player tendencies whose situation is on (home, former team, homecoming, birthday)
  redzone_roles     (when this season's charted snaps are on disk) players whose inside-5 snap share over the last 3 games is well
                    above their season share — goal-line role growing / shrinking
NO PICKS. Usage: nfl_week_storylines.py [season week]"""
import os, sys, json, math, numpy as np, pandas as pd, requests, warnings
warnings.filterwarnings("ignore"); HERE = os.path.dirname(os.path.abspath(__file__)); os.chdir(HERE); sys.path.insert(0, os.path.dirname(HERE)); import football_report_lib as lib
from storyline_flags import flag, DIV, STAD, hav
env = lib.load_env(); H = lib.hdr(env); num = lambda s: pd.to_numeric(s, errors="coerce")
def fetch(table, params):
    j = requests.get(f"{lib.SUPA}/{table}?{params}", headers=H, timeout=60).json(); return j if isinstance(j, list) else []
if len(sys.argv) >= 3: SEASON, WEEK = int(sys.argv[1]), int(sys.argv[2])
elif os.environ.get("NFL_SEASON"): SEASON, WEEK = int(os.environ["NFL_SEASON"]), int(os.environ["NFL_WEEK"])
else:
    a = fetch("nfl_slate_games", "select=season,week&order=season.desc,week.desc&limit=1"); SEASON, WEEK = a[0]["season"], a[0]["week"]
N2A = {"Arizona Cardinals":"ARI","Atlanta Falcons":"ATL","Baltimore Ravens":"BAL","Buffalo Bills":"BUF","Carolina Panthers":"CAR","Chicago Bears":"CHI","Cincinnati Bengals":"CIN","Cleveland Browns":"CLE","Dallas Cowboys":"DAL","Denver Broncos":"DEN","Detroit Lions":"DET","Green Bay Packers":"GB","Houston Texans":"HOU","Indianapolis Colts":"IND","Jacksonville Jaguars":"JAX","Kansas City Chiefs":"KC","Las Vegas Raiders":"LV","Los Angeles Chargers":"LAC","Los Angeles Rams":"LA","Miami Dolphins":"MIA","Minnesota Vikings":"MIN","New England Patriots":"NE","New Orleans Saints":"NO","New York Giants":"NYG","New York Jets":"NYJ","Philadelphia Eagles":"PHI","Pittsburgh Steelers":"PIT","San Francisco 49ers":"SF","Seattle Seahawks":"SEA","Tampa Bay Buccaneers":"TB","Tennessee Titans":"TEN","Washington Commanders":"WAS"}
ab = lambda t: N2A.get(t, t).replace("LAR", "LA") if isinstance(t, str) else t
# ---------------------------------------------------------------- this week's games and context
games = fetch("nfl_slate_games", f"select=game_id,home_team,away_team,kickoff,wx_wind_mph,wx_temp_f,fg_spread_close,fg_total_close&season=eq.{SEASON}&week=eq.{WEEK}")
import datetime as dt; now_iso = dt.datetime.now(dt.timezone.utc).strftime("%Y-%m-%dT%H:%M:%S"); games = [g for g in games if g.get("kickoff") and str(g["kickoff"])[:19] > now_iso]
try:
    import nfl_data_py as nfl; SCH = nfl.import_schedules([SEASON]); SCH = SCH[SCH.week == WEEK]; SCH["home_team"] = SCH.home_team.replace({"LAR":"LA"}); SCH["away_team"] = SCH.away_team.replace({"LAR":"LA"})
    rest = {(r.home_team, r.away_team): (r.home_rest, r.away_rest, str(r.roof)) for r in SCH.itertuples()}
except Exception: rest = {}
G = []
for g in games:
    home, away = ab(g["home_team"]), ab(g["away_team"]); k = pd.to_datetime(g["kickoff"]).tz_convert("US/Eastern"); hr, ar, roof = rest.get((home, away), (7, 7, "unknown"))
    wind = float(g["wx_wind_mph"]) if g.get("wx_wind_mph") is not None else np.nan; temp = float(g["wx_temp_f"]) if g.get("wx_temp_f") is not None else np.nan
    indoors = roof in ("dome", "closed") or (np.isnan(wind) and np.isnan(temp))
    G.append(dict(gid=str(g["game_id"]), home=home, away=away, hn=g["home_team"], an=g["away_team"], label=f"{g['away_team']} @ {g['home_team']}", kickoff=g["kickoff"], primetime=(k.hour >= 19) or k.day_name() in ("Monday","Thursday"), div=DIV.get(home) == DIV.get(away),
                  wind=wind, temp=temp, indoors=indoors, cold=(not indoors) and temp <= 40, windy=(not indoors) and wind >= 15, spread_home=float(g["fg_spread_close"]) if g.get("fg_spread_close") is not None else np.nan, total=float(g["fg_total_close"]) if g.get("fg_total_close") is not None else np.nan, home_rest=hr, away_rest=ar, gameday=k.strftime("%Y-%m-%d")))
GD = {x["gid"]: x for x in G}; print(f"{SEASON} week {WEEK}: {len(G)} unplayed games")
def team_ctx(x, team):
    is_home = team == x["home"]; sp = x["spread_home"] if is_home else -x["spread_home"] if not np.isnan(x["spread_home"]) else np.nan; r = x["home_rest"] if is_home else x["away_rest"]
    return dict(is_home=is_home, opp=x["away"] if is_home else x["home"], spread=sp, fav=(sp <= -3) if not np.isnan(sp) else False, dog=(sp >= 3) if not np.isnan(sp) else False, rest=r, short_rest=(r is not None and r <= 5), off_bye=(r is not None and r >= 13))
# ---------------------------------------------------------------- board (players with lines this week)
bd = pd.DataFrame(fetch("nfl_slate_props", f"select=player_id,player_name,team,position,market,close_line,game_id&season=eq.{SEASON}&week=eq.{WEEK}&limit=20000"))
bd = bd[bd.game_id.isin(GD.keys())].copy(); bd["team"] = bd.team.replace({"LAR":"LA"}); g_ = bd.game_id.str.split("_", expand=True); bd["home"] = g_[3].replace({"LAR":"LA"}); bd["away"] = g_[2].replace({"LAR":"LA"}); bd["is_home"] = bd.team == bd.home; bd["opp"] = np.where(bd.is_home, bd.away, bd.home)
P = bd.drop_duplicates("player_id")[["player_id","player_name","team","position","game_id","is_home","opp"]].copy(); P["season"], P["week"] = SEASON, WEEK
lines = {pid: "; ".join(f"{m.replace('player_','').replace('_',' ')} {g.close_line.median():g}" for m, g in x.groupby("market") if g.close_line.notna().any()) for pid, x in bd.groupby("player_id")}
lead_rb = bd[(bd.position == "RB") & (bd.market == "player_rush_attempts")].sort_values("close_line", ascending=False).groupby("team").head(1).set_index("team").player_name.to_dict()
F = flag(P, "player_name") if len(P) else P
HIST = pd.read_parquet("data/_storyline_player_history.parquet") if os.path.exists("data/_storyline_player_history.parquet") else pd.DataFrame(columns=["player_id"])
F = F.merge(HIST, on="player_id", how="left", suffixes=("", "_h"))
rows = []
def add(family, key, gid, title, body, full, source, rank, extra=None):
    d = {"full": full, "source": source}; d.update(extra or {}); rows.append(dict(season=SEASON, week=WEEK, game_id=gid, family=family, storyline_key=key, title=title, body=body, data=d, rank=rank, source=source))
# ---------------------------------------------------------------- 1. player storylines
SRC_ST = "Prop lines 2023-25 (three seasons, best of four books); birthplaces from ESPN, team history from weekly rosters 2016-25"
for gid, x in GD.items():
    fp = F[F.game_id == gid]; items = []
    has_ou = {pid for pid, x_ in bd.groupby("player_id") if (x_.market != "player_anytime_td").any() and x_.close_line.notna().any()}
    for r in fp[fp.revenge.fillna(False).astype(bool)].itertuples():
        if r.player_id not in has_ou and r.position != "QB": continue
        attrs = [f"{int(r.n_seasons)} season{'s' if r.n_seasons > 1 else ''} there", f"left {int(r.seasons_since)} season{'s' if r.seasons_since != 1 else ''} ago"]
        if r.drafted_by_opp: attrs.append("drafted by them")
        if not r.is_home: attrs.append("back in the old stadium")
        if pd.notna(r.drama_tier) and r.drama_tier >= 1: attrs.append("a messy exit" if r.drama_tier == 1 else "a notable exit")
        read = ("Quarterbacks facing a former team have finished below their touchdown-pass number 70% of the time and below their passing-yards number 60% (59 games, 2023-25)." if r.position == "QB"
                else "Skill players in their first season away have gone OVER their lines 60% of the time against 47% in their other games (154 lines, 2023-25); anytime-touchdown hits ran 1.3 points above the book's number." if r.seasons_since <= 1
                else "Players facing a former team two or more seasons later have gone over 52% — no read.")
        own = f" His own record vs former teams: finished above the sportsbook number in {int(round(r.rv_over * r.rv_lines))} of {int(r.rv_lines)} lines across {int(r.rv_games)} games (2023-25), against {100*r.rv_else_over:.0f}% of his other lines." if pd.notna(getattr(r, "rv_games", np.nan)) and r.rv_games >= 2 else ""
        items.append(((3 if r.position == "QB" or r.seasons_since <= 1 else 1) + (1 if r.drafted_by_opp or (pd.notna(r.drama_tier) and r.drama_tier >= 1) else 0), f"**{r.player_name}** ({r.position}, {r.team}) faces **{r.opp}**: {', '.join(attrs)}. {read}{own}" + (f" Lines: {lines.get(r.player_id, '')}." if lines.get(r.player_id) else "")))
    for r in fp[fp.hc.fillna(False).astype(bool)].itertuples():
        if r.player_id not in has_ou and not (pd.notna(getattr(r, "hc_games", np.nan)) and r.hc_games >= 2): continue
        has_hist = pd.notna(getattr(r, "hc_games", np.nan))
        own = (f" His own record on these trips: {int(r.hc_games)} game{'s' if r.hc_games > 1 else ''}, finished above the sportsbook number {100*r.hc_over:.0f}% of the time, against {100*r.else_over:.0f}% in his other games (2023-25)." if has_hist
               else " This is the first homecoming we have on record for him, so there is no personal track record to go on.")
        read = (" Quarterbacks visiting near home have finished below their numbers 63% of the time (54 lines, 2023-25 — a small sample)." if r.position == "QB"
                else " As a group, players visiting near home have finished above the number 51% of the time across three seasons — essentially even, so the storyline matters only when the player's own record says something.")
        items.append((2 if pd.notna(getattr(r, "hc_games", np.nan)) and r.hc_games >= 3 else 1, f"**{r.player_name}** ({r.position}, {r.team}) plays {r.dist_site:.0f} miles from **{r.birth_city}, {r.birth_st}**, where he was born{' — a non-division trip he rarely makes' if r.hc_rare else ''}.{own}{read}" + (f" Lines: {lines.get(r.player_id, '')}." if lines.get(r.player_id) else "")))
    for r in fp[fp.birthday3.fillna(False).astype(bool) & (fp.position == "QB")].itertuples():
        items.append((2, f"**{r.player_name}** (QB, {r.team}) {'turned' if r.bday_diff > 0 else 'turns'} {int(round((pd.Timestamp(x['gameday']) - r.birth_date).days / 365.25))} on {r.birth_date.strftime('%b %d')}, {abs(int(r.bday_diff))} day{'s' if abs(int(r.bday_diff)) != 1 else ''} {'before' if r.bday_diff > 0 else 'after'} kickoff. Quarterbacks in a birthday week have gone OVER their lines 62% of the time (84 lines, 2023-25 — small); passing yards 69%." + (f" Lines: {lines.get(r.player_id, '')}." if lines.get(r.player_id) else "")))
    if not items: continue
    items.sort(key=lambda t: -t[0]); top = items[0][1].split(" Lines: ")[0].replace(" His own record", " His own record"); more = len(items) - 1
    add("storylines", f"story:{gid}", gid, f"Storylines — {x['label']}", top.replace("**", "") + (f" Plus {more} more storyline{'s' if more > 1 else ''} in this game." if more else ""), "### 📖 Storylines in this game\n" + "\n".join("- " + t[1] for t in items), SRC_ST, 12 - min(items[0][0], 3))
# ---------------------------------------------------------------- 2. coaching
PC = pd.read_csv("data/play_callers.csv"); PC["team"] = PC.team.replace({"LAR":"LA"}); pc26 = PC[PC.season == SEASON].set_index("team").play_caller.to_dict(); pcrole = PC[PC.season == SEASON].set_index("team").role.to_dict()
CS = pd.read_csv("data/coaching_staff.csv"); CS["team"] = CS.team.replace({"LAR":"LA"}); dc26 = CS[CS.season == SEASON].set_index("team").dc.to_dict()
ID = pd.read_parquet("data/_coach_identity_pc.parquet").set_index("coach"); SIT = pd.read_parquet("data/_coach_situations_pc.parquet"); SIT = SIT[SIT.stable]
DID = pd.read_parquet("data/_dc_identity.parquet").set_index("coach"); DSIT = pd.read_parquet("data/_dc_situations.parquet"); DSIT = DSIT[DSIT.stable]
LGI = dict(proe=0.0, rz20=0.54, rz10=0.51, rz5=0.47, rb1_all=0.62, rb1_in10=0.67, rb1_in5=0.69, blitz=float(DID.blitz.median()) if len(DID) else 0.24)
pct = lambda v: f"{100*v:.0f}%" if pd.notna(v) else "—"
def on_situations(sit_df, coach, ctx, x):
    live = {"primetime": x["primetime"], "divisional": x["div"], "cold (≤40°F outdoors)": x["cold"], "windy (≥15 mph)": x["windy"], "home": ctx["is_home"], "favorite (−3 or more)": ctx["fav"], "underdog (+3 or more)": ctx["dog"], "short rest (≤5 days)": ctx["short_rest"], "off a bye": ctx["off_bye"]}
    opp_dc = dc26.get(ctx["opp"]); opp_blitz = DID.blitz.get(opp_dc, np.nan) if opp_dc in DID.index else np.nan; live["vs blitz-heavy defense"] = pd.notna(opp_blitz) and opp_blitz >= LGI["blitz"] + 0.05
    t = sit_df[sit_df.coach == coach]; out = []
    for r in t.itertuples():
        if live.get(r.situation): out.append(r)
    return out, opp_dc, opp_blitz
for gid, x in GD.items():
    L = []; summ = []
    for team, nm in ((x["away"], x["an"]), (x["home"], x["hn"])):
        ctx = team_ctx(x, team); pc = pc26.get(team); role = pcrole.get(team, "OC")
        if pc and pc in ID.index:
            i = ID.loc[pc]; on, opp_dc, opp_blitz = on_situations(SIT, pc, ctx, x)
            gl = ("keeps handing it to his starting back at the goal line instead of rotating in the backup" if pd.notna(i.rb1_share_in5) and i.rb1_share_in5 - i.rb1_share_all >= 0.08 else "rotates the backup in at the goal line" if pd.notna(i.rb1_share_in5) and i.rb1_share_in5 - i.rb1_share_all <= -0.08 else "splits goal-line carries the same way he does everywhere else")
            L.append(f"### 🧠 {nm} — {pc} ({'head coach, calls the plays' if role == 'HC' else 'offensive coordinator'})")
            L.append(f"- **Identity** ({int(i.plays):,} plays 2022-25): throws **{abs(i.proe):.1f} points {'more' if i.proe >= 0 else 'less'} often** than a typical team would in the same down-and-distance spots; on early downs in a close game he passes {pct(i.early_neutral_pass)} of the time; uses motion on {pct(i.motion)} of snaps, play-action on {pct(i.play_action)} of passes, no-huddle {pct(i.no_huddle)}; goes for it on 4th-and-short {pct(i.fourth_go)} of the time ({int(i.n_fourth)} chances)")
            L.append(f"- **Red zone**: pass rate inside the 20 / 10 / 5: {pct(i.rz20_pass)} / {pct(i.rz10_pass)} / {pct(i.rz5_pass)} (league {pct(LGI['rz20'])} / {pct(LGI['rz10'])} / {pct(LGI['rz5'])}); red-zone targets RB {pct(i.rz_tgt_rb)} / WR {pct(i.rz_tgt_wr)} / TE {pct(i.rz_tgt_te)}")
            L.append(f"- **Goal-line back**: his starting back gets {pct(i.rb1_share_all)} of the team's carries overall, {pct(i.rb1_share_in10)} inside the 10, {pct(i.rb1_share_in5)} inside the 5 — **{gl}**" + (f"; lead back this week by the rushing line: {lead_rb[team]}" if team in lead_rb else "") + (f"; QB designed runs {pct(i.qb_run_share_in5)} of inside-5 runs" if pd.notna(i.qb_run_share_in5) and i.qb_run_share_in5 >= 0.2 else ""))
            for r in on: L.append(f"- **{r.situation.capitalize()} — live this week**: he throws on {pct(r.pass_rate)} of plays in these games (a typical team: {pct(r.lg_pass_rate)}) — about {abs(r.relative):.0f} points more {'pass' if r.relative > 0 else 'run'}-heavy than everyone else gets in this spot, and it has held every season ({r.seasons.replace(':', ' ')}; {int(r.plays)} plays)")
            if on: summ.append(f"{pc} ({team}) {'throws' if on[0].relative > 0 else 'runs'} more than a typical coach does in {on[0].situation.split(' (')[0]} games, and has every season")
            elif abs(i.proe) >= 3: summ.append(f"{pc} ({team}) {'throws' if i.proe > 0 else 'runs'} about {abs(i.proe):.0f} points more often than a typical team would in the same spots, and {gl}")
        elif pc: L.append(f"### 🧠 {nm} — {pc}\n- First season calling plays in our records (2022-25) — no tendency sheet yet.")
        dc = dc26.get(team)
        if dc and dc in DID.index:
            d = DID.loc[dc]; don, _, _ = on_situations(DSIT, dc, ctx, x)
            L.append(f"### 🛡️ {nm} defense — {dc} (defensive coordinator)")
            L.append(f"- **Identity** ({int(d.dropbacks):,} charted dropbacks 2022-25): sends an extra rusher (a blitz) on {pct(d.blitz)} of passing plays (a typical defense: {pct(LGI['blitz'])}), six or more rushers {pct(d.rush6)}; loads seven or more defenders near the line against the run {pct(d.heavy_box)} of the time; blitzes on 3rd-and-long {pct(d.blitz_3rd_long)}, in the red zone {pct(d.blitz_rz)}, in the last two minutes of a half {pct(d.blitz_two_min)}")
            for r in don: L.append(f"- **{r.situation.capitalize()} — live this week**: blitzes on {pct(r.blitz)} of passing plays in these games (a typical defense: {pct(r.lg_blitz)}), about {abs(100*r.relative):.0f} points {'more' if r.relative > 0 else 'less'} than everyone else shifts here, every season ({r.seasons.replace(':', ' ')}; {int(r.dropbacks)} passing plays)")
            if abs(d.blitz - LGI["blitz"]) >= 0.07: summ.append(f"{dc} ({team}) blitzes on {pct(d.blitz)} of passing plays, against {pct(LGI['blitz'])} for a typical defense")
        elif dc and str(dc) not in ("nan", "None"): L.append(f"### 🛡️ {nm} defense — {dc}\n- First season as a coordinator in our records — no sheet yet.")
    if L: add("coaching", f"coach:{gid}", gid, f"Coaching tendencies — {x['label']}", ("; ".join(summ[:2]) + "." if summ else "Play-calling identity, red-zone habits and goal-line back usage for both staffs, with the shifts that are live this week."), "\n".join(L), "Play-by-play 2022-25 with charting (nflverse + FTN), keyed to the play-caller / coordinator; head coaches from nflverse, coordinators from team staff pages", 20)
# ---------------------------------------------------------------- 3. player tendencies (stable, trigger live this week)
PROF = {}
for stat, mk, pos in (("attempts","pass attempts","QB"), ("completions","completions","QB"), ("yds","passing yards","QB"), ("tds","passing touchdowns","QB"), ("receptions","receptions","WR/TE"), ("reception_yds","receiving yards","WR/TE"), ("rush_attempts","rush attempts","RB"), ("rush_yds","rushing yards","RB")):
    f = f"data/_qb_profiles_{stat}_{SEASON}.parquet"
    if os.path.exists(f): PROF[stat] = (pd.read_parquet(f), mk, pos)
FACT_LIVE = {"wind": lambda x, c: (not x["indoors"]) and x["wind"] >= 12, "temp": lambda x, c: (not x["indoors"]) and (x["temp"] <= 45 or x["temp"] >= 85), "team_spread": lambda x, c: c["fav"] or c["dog"], "total": lambda x, c: (not np.isnan(x["total"])) and (x["total"] >= 48 or x["total"] <= 41), "is_home": lambda x, c: True, "rest": lambda x, c: c["short_rest"] or c["off_bye"], "primetime": lambda x, c: x["primetime"], "opp_rate_blitz": lambda x, c: c.get("opp_blitz_high") or c.get("opp_blitz_low")}
def tend_line(t, x, c, mk):
    f, r = t["factor"], t["r"]; hi = None
    if f == "wind": hi = True; cond = f"with wind at {x['wind']:.0f} mph"
    elif f == "temp": hi = x["temp"] >= 85; cond = f"in {'heat' if hi else 'cold'} ({x['temp']:.0f}°F forecast)"
    elif f == "team_spread": hi = c["dog"]; cond = "as an underdog" if c["dog"] else "as a favorite"
    elif f == "total": hi = x["total"] >= 48; cond = f"in {'high' if hi else 'low'}-total games (this one is {x['total']:g})"
    elif f == "is_home": hi = c["is_home"]; cond = "at home" if c["is_home"] else "on the road"
    elif f == "rest": hi = c["off_bye"]; cond = "off a bye" if c["off_bye"] else "on short rest"
    elif f == "primetime": hi = True; cond = "in primetime"
    elif f == "opp_rate_blitz": hi = c.get("opp_blitz_high"); cond = f"against {'blitz-heavy' if hi else 'low-blitz'} defenses ({c['opp_dc']} blitzes {pct(c['opp_blitz'])})"
    else: return None
    up = (r > 0) == bool(hi); return f"{mk} have run **{'above' if up else 'below'}** the line {cond}"
def match_key(nm, keys):
    p = str(nm).replace(".", "").split(); c = [k for k in keys if k.split(".")[-1].lower() == p[-1].lower() and k[0].lower() == p[0][0].lower()]; return c[0] if c else None
ATD = pd.read_parquet(f"data/_atd_player_profiles_{SEASON}.parquet") if os.path.exists(f"data/_atd_player_profiles_{SEASON}.parquet") else pd.DataFrame()
for gid, x in GD.items():
    fp = F[F.game_id == gid]; L = []; n_lines = 0; first = None
    for r in fp.itertuples():
        c = team_ctx(x, r.team); opp_dc = dc26.get(c["opp"]); c["opp_dc"] = opp_dc; c["opp_blitz"] = DID.blitz.get(opp_dc, np.nan) if opp_dc in DID.index else np.nan; c["opp_blitz_high"] = pd.notna(c["opp_blitz"]) and c["opp_blitz"] >= LGI["blitz"] + 0.05; c["opp_blitz_low"] = pd.notna(c["opp_blitz"]) and c["opp_blitz"] <= LGI["blitz"] - 0.05
        out = []
        for stat, (pf, mk, pos) in PROF.items():
            if (pos == "QB") != (r.position == "QB") or (pos == "RB") != (r.position == "RB") or (pos == "WR/TE") != (r.position in ("WR","TE")): continue
            k = match_key(r.player_name, pf.qb.unique()); pr = pf[pf.qb == k] if k else None
            if pr is None or not len(pr): continue
            pr = pr.iloc[0]
            for t in (list(pr.tendencies) if pr.tendencies is not None and len(pr.tendencies) else []):
                if FACT_LIVE.get(t["factor"], lambda x, c: False)(x, c):
                    s = tend_line(t, x, c, mk)
                    if s: out.append(s + f", in every season ({int(pr.games)} priced games since 2023)")
        if len(ATD):
            a = ATD[(ATD.player == r.player_name) & ATD.stable & (ATD["diff"].abs() >= 0.15) & (ATD.n_in >= 10)] if r.position != "QB" else ATD.iloc[0:0]
            for t in a.itertuples():
                on = {"home": c["is_home"], "vs a former team": bool(r.revenge), "homecoming (visiting near his birthplace)": bool(r.hc), "birthday week": bool(r.birthday3)}.get(t.situation)
                if on: out.append(f"anytime touchdown: he has scored **{'more' if t.diff > 0 else 'less'} often than the book priced** when {t.situation} — {100*t.hit_in:.0f}% of {int(t.n_in)} games against {100*t.imp_in:.0f}% implied, vs {100*t.hit_out:.0f}% against {100*t.imp_out:.0f}% otherwise, in every season")
        if out:
            L.append(f"- **{r.player_name}** ({r.position}, {r.team}): " + "; ".join(out) + (f". Lines: {lines.get(r.player_id, '')}" if lines.get(r.player_id) else "")); n_lines += len(out)
            if first is None: first = f"{r.player_name}'s " + out[0].split(", in every season")[0].split(" — ")[0].replace("**", "")
    if L: add("player_tendencies", f"tend:{gid}", gid, f"Player tendencies live this week — {x['label']}", (first + f". {len(L)} players with a tendency that holds every season and is triggered this week." if first else ""), "### 📈 Tendencies that have held every season, and the situation that triggers them is here this week\n" + "\n".join(L), "Each player's own priced lines 2023-25 (best of four books), split by the factor; a tendency is listed only when its sign holds in every season with 8+ games. Opponent blitz rate = the coordinator's 2022-25 rate.", 22)
# ---------------------------------------------------------------- 4. red-zone roles (this season's charted snaps, when present)
try:
    from fp_hist import read_fp
    sn = read_fp("player_offense-snaps"); sn = sn[sn.__season == SEASON].copy()
    if len(sn) and sn.__week.max() >= 3:
        sn["p5"] = num(sn.playerStatsInside5SnapsOffenseTotal).fillna(0); sn["t5"] = num(sn.teamStatsInside5SnapsOffenseTotal).fillna(0); sn = sn.sort_values(["playerPlayerId","__week"])
        agg = sn.groupby("playerPlayerId").agg(nm=("playerFirstName","first"), ln=("playerLastName","first"), pos=("playerPosition","first"), gp=("__week","size"), p5=("p5","sum"), t5=("t5","sum"), p5_l3=("p5", lambda s: s.tail(3).sum()), t5_l3=("t5", lambda s: s.tail(3).sum())).reset_index()
        agg["season_sh"] = agg.p5 / agg.t5.replace(0, np.nan); agg["l3_sh"] = agg.p5_l3 / agg.t5_l3.replace(0, np.nan); agg["trend"] = agg.l3_sh - agg.season_sh; agg["name"] = agg.nm.astype(str) + " " + agg.ln.astype(str)
        rz = agg[agg.pos.isin(["RB","WR","TE"]) & (agg.t5_l3 >= 6) & (agg.trend.abs() >= 0.15)]
        for gid, x in GD.items():
            fp = F[F.game_id == gid]; L = []
            for r in fp.itertuples():
                m = rz[rz.name.str.lower() == str(r.player_name).lower()]
                if len(m): m = m.iloc[0]; L.append(f"- **{r.player_name}** ({r.position}, {r.team}): inside-5 snap share {pct(m.l3_sh)} over the last 3 games vs {pct(m.season_sh)} on the season — goal-line role **{'growing' if m.trend > 0 else 'shrinking'}**" + (f". Lines: {lines.get(r.player_id, '')}" if lines.get(r.player_id) else ""))
            if L: add("redzone_roles", f"rz:{gid}", gid, f"Goal-line roles moving — {x['label']}", L[0].split(":")[0].replace("- **", "").replace("**", "") + " and " + ("others" if len(L) > 1 else "") if len(L) > 1 else L[0].replace("- **", "").replace("**", "").split(". Lines")[0], "### 🥅 Goal-line role, last 3 games vs the season\n" + "\n".join(L) + "\n- A rising inside-5 role has landed at the book's number (20.7% scored vs 21.5% priced, 2023-25); a falling one has scored 4 points under it.", f"This season's charted snaps ({SEASON}, weeks 1-{int(sn.__week.max())}) from Fantasy Points; the read on rising/falling roles from 2023-25 anytime-touchdown prices", 24)
except Exception as e: print("redzone roles skipped:", str(e)[:120])
# ---------------------------------------------------------------- write: replace this week's rows
requests.delete(f"{lib.SUPA}/nfl_week_storylines?season=eq.{SEASON}&week=eq.{WEEK}", headers=H, timeout=30)
clean = lambda o: json.loads(json.dumps(o, default=lambda v: None if (isinstance(v, float) and math.isnan(v)) else (v.item() if hasattr(v, "item") else str(v))))
for r in rows:
    x = requests.post(f"{lib.SUPA}/nfl_week_storylines", headers={**H, "Prefer": "resolution=merge-duplicates"}, json=clean(r), timeout=30)
    if x.status_code not in (200, 201): print("  write failed:", x.status_code, x.text[:200])
fam = pd.Series([r["family"] for r in rows]).value_counts().to_dict() if rows else {}
print(f"wrote {len(rows)} storyline rows: {fam}")
for r in rows[:40]: print(f"  [{r['family']}] {r['title']}: {r['body'][:160]}")
