#!/usr/bin/env python3
"""STORYLINE BOARD — this week's slate props flagged for HOMETOWN / BIRTHDAY / REVENGE (owner, 2026-09-19).
usage: python3 storyline_board.py [SEASON] [WEEK]   (defaults: 2026, the week with the most upcoming lines)
Reads nfl_slate_props (board), data/player_bio.parquet, data/player_team_weeks.parquet, data/game_sites.parquet,
data/storyline_drama.csv. Prints one row per flagged player with his markets/lines and the historical read for that flag
(from exp_storyline_props.py, 2023-25): QB vs former team = UNDER (35% over), skill player in first season away = OVER
(59%), QB in a birthday week = OVER (62%, small n), QB away near hometown = UNDER (37%, small n). Everything else = no read."""
import os, sys, numpy as np, pandas as pd, requests, warnings
warnings.filterwarnings("ignore"); HERE = os.path.dirname(os.path.abspath(__file__)); os.chdir(HERE); sys.path.insert(0, os.path.dirname(HERE)); import football_report_lib as lib
env = lib.load_env(); H = lib.hdr(env); SEASON = int(sys.argv[1]) if len(sys.argv) > 1 else 2026
def fetch(table, params):
    j = requests.get(f"{lib.SUPA}/{table}?{params}", headers=H, timeout=60).json(); return j if isinstance(j, list) else []
bd = pd.DataFrame(fetch("nfl_slate_props", f"select=season,week,player_id,player_name,team,position,market,close_line,opponent,is_home,game_id&season=eq.{SEASON}&limit=10000")); bd = bd.rename(columns={"close_line":"line"})
WEEK = int(sys.argv[2]) if len(sys.argv) > 2 else int(bd.week.max()); bd = bd[bd.week == WEEK].copy(); print(f"board: {SEASON} week {WEEK}, {len(bd)} lines, {bd.player_name.nunique()} players")
N2A = {"Arizona Cardinals":"ARI","Atlanta Falcons":"ATL","Baltimore Ravens":"BAL","Buffalo Bills":"BUF","Carolina Panthers":"CAR","Chicago Bears":"CHI","Cincinnati Bengals":"CIN","Cleveland Browns":"CLE","Dallas Cowboys":"DAL","Denver Broncos":"DEN","Detroit Lions":"DET","Green Bay Packers":"GB","Houston Texans":"HOU","Indianapolis Colts":"IND","Jacksonville Jaguars":"JAX","Kansas City Chiefs":"KC","Las Vegas Raiders":"LV","Los Angeles Chargers":"LAC","Los Angeles Rams":"LA","Miami Dolphins":"MIA","Minnesota Vikings":"MIN","New England Patriots":"NE","New Orleans Saints":"NO","New York Giants":"NYG","New York Jets":"NYJ","Philadelphia Eagles":"PHI","Pittsburgh Steelers":"PIT","San Francisco 49ers":"SF","Seattle Seahawks":"SEA","Tampa Bay Buccaneers":"TB","Tennessee Titans":"TEN","Washington Commanders":"WAS"}
# the table's `opponent` field carries the HOME team on some home rows (Mahomes "vs KC") — derive both sides from game_id "2026_02_IND_KC"
bd["team"] = bd.team.replace({"LAR":"LA"}); g = bd.game_id.str.split("_", expand=True); bd["away"] = g[2].replace({"LAR":"LA"}); bd["home"] = g[3].replace({"LAR":"LA"})
bd["is_home"] = bd.team == bd.home; bd["opp"] = np.where(bd.is_home, bd.away, bd.home)
B = pd.read_parquet("data/player_bio.parquet"); norm = lambda n: "".join(ch for ch in str(n).lower().replace(".", "").replace("'", "") if ch.isalnum() or ch == " ").strip()
B["_n"] = B.display_name.map(norm); bd["_n"] = bd.player_name.map(norm)
P = bd.drop_duplicates("player_name").merge(B[["gsis_id","birth_date","birth_city","birth_st","birth_lat","birth_lon","draft_team","college_name"]].drop_duplicates("gsis_id"), left_on="player_id", right_on="gsis_id", how="left")
print(f"  matched to a bio: {P.gsis_id.notna().sum()}/{len(P)}")
S = pd.read_parquet("data/game_sites.parquet"); S = S[(S.season == SEASON) & (S.week == WEEK)][["home_team","away_team","gameday","site_lat","site_lon","site"]]
P = P.merge(S, left_on=["home","away"], right_on=["home_team","away_team"], how="left", suffixes=("", "_s")); P["gameday"] = pd.to_datetime(P.gameday)
STAD = {"ARI":(33.5276,-112.2626),"ATL":(33.7554,-84.4010),"BAL":(39.2780,-76.6227),"BUF":(42.7738,-78.7870),"CAR":(35.2258,-80.8528),"CHI":(41.8623,-87.6167),"CIN":(39.0954,-84.5160),"CLE":(41.5061,-81.6995),"DAL":(32.7473,-97.0945),"DEN":(39.7439,-105.0201),"DET":(42.3400,-83.0456),"GB":(44.5013,-88.0622),"HOU":(29.6847,-95.4107),"IND":(39.7601,-86.1639),"JAX":(30.3239,-81.6373),"KC":(39.0489,-94.4839),"LV":(36.0909,-115.1833),"LAC":(33.9535,-118.3392),"LA":(33.9535,-118.3392),"MIA":(25.9580,-80.2389),"MIN":(44.9736,-93.2575),"NE":(42.0909,-71.2643),"NO":(29.9511,-90.0812),"NYG":(40.8135,-74.0745),"NYJ":(40.8135,-74.0745),"PHI":(39.9008,-75.1675),"PIT":(40.4468,-80.0158),"SF":(37.4032,-121.9698),"SEA":(47.5952,-122.3316),"TB":(27.9759,-82.5033),"TEN":(36.1665,-86.7713),"WAS":(38.9076,-76.8645)}
def hav(la1, lo1, la2, lo2):
    la1, lo1, la2, lo2 = map(np.radians, (la1, lo1, la2, lo2)); a = np.sin((la2 - la1) / 2) ** 2 + np.cos(la1) * np.cos(la2) * np.sin((lo2 - lo1) / 2) ** 2; return 3958.8 * 2 * np.arcsin(np.sqrt(a))
P["site_lat"] = P.site_lat.fillna(P.home.map(lambda t: STAD.get(t, (np.nan, np.nan))[0])); P["site_lon"] = P.site_lon.fillna(P.home.map(lambda t: STAD.get(t, (np.nan, np.nan))[1]))
P["dist_site"] = hav(P.birth_lat, P.birth_lon, P.site_lat, P.site_lon); P["homecoming"] = (P.dist_site <= 120) & ~P.is_home
P["birth_date"] = pd.to_datetime(P.birth_date, errors="coerce"); gd = P.gameday.fillna(P.gameday.dropna().iloc[0] if P.gameday.notna().any() else pd.Timestamp.today())
def bdiff(b, g):
    if pd.isna(b) or pd.isna(g): return np.nan
    try: this = b.replace(year=g.year)
    except ValueError: this = b.replace(year=g.year, day=28)
    return (g - this).days
P["bday_diff"] = [bdiff(b, g) for b, g in zip(P.birth_date, gd)]; P["birthday"] = P.bday_diff.abs() <= 3
W = pd.read_parquet("data/player_team_weeks.parquet"); hist = W.groupby(["player_id","team"]).agg(first_season=("season","min"), last_season=("season","max"), n_seasons=("season","nunique")).reset_index()
P = P.merge(hist.rename(columns={"player_id":"gsis_id","team":"opp"}), on=["gsis_id","opp"], how="left"); P["revenge"] = P.last_season.notna() & (P.opp != P.team)
P["seasons_since"] = SEASON - P.last_season; P["drafted_by_opp"] = P.draft_team.replace({"LAR":"LA","OAK":"LV","SD":"LAC","STL":"LA"}) == P.opp
dr = pd.read_csv("data/storyline_drama.csv"); dr = dr[dr.tier > 0]; key = lambda n: (lambda p: (p[0][0] + " " + p[-1]) if p else n)(norm(n).split())
dr["_k"] = dr.player.map(key); P["_k"] = P.player_name.map(key); tier = dr.groupby(["_k","old_team"]).tier.min().rename("drama_tier").reset_index(); P = P.merge(tier, left_on=["_k","opp"], right_on=["_k","old_team"], how="left")
# per-player homecoming history 2023-25 (visiting, own stadium far) from the graded frame, for the card copy
try:
    F = pd.read_parquet("data/_storyline_frame.parquet"); F = F[F.is_ou & F.hc]; HH = F.groupby("player_id").agg(hc_games=("week", lambda s: len(set(zip(F.loc[s.index, "season"], s)))), hc_over=("over", "mean")).reset_index()
    E = pd.read_parquet("data/_storyline_frame.parquet"); E = E[E.is_ou & ~E.hc].groupby("player_id").over.mean().rename("else_over").reset_index(); HH = HH.merge(E, on="player_id", how="left")
    P = P.merge(HH.rename(columns={"player_id":"gsis_id"}), on="gsis_id", how="left")
except Exception: P["hc_games"] = np.nan
P["homecoming"] = P.homecoming & (hav(P.birth_lat, P.birth_lon, P.team.map(lambda t: STAD.get(t, (np.nan, np.nan))[0]), P.team.map(lambda t: STAD.get(t, (np.nan, np.nan))[1])) > 120)   # his own stadium must not be near his birthplace
QBPOS = P.position == "QB"
def read(r):
    out = []
    if r.revenge:
        tag = f"REVENGE vs {r.opp} ({int(r.n_seasons)} season{'s' if r.n_seasons > 1 else ''} there, left {int(r.seasons_since)} season{'s' if r.seasons_since != 1 else ''} ago" + (", drafted by them" if r.drafted_by_opp else "") + (f", drama tier {int(r.drama_tier)}" if pd.notna(r.drama_tier) else "") + (", at the old stadium" if not r.is_home else "") + ")"
        out.append(tag + (" → historical read: QB UNDER (35% over 2023-25, n=114 markets)" if r.position == "QB" else (" → historical read: OVER (first season away 59% over, placebo 46%)" if r.seasons_since <= 1 else " → historical read: slight over (54%), not a bet")))
    if r.homecoming: out.append(f"HOMECOMING: born {r.birth_city}, {r.birth_st}, {r.dist_site:.0f} mi from the site" + (f"; his past homecomings: {int(r.hc_games)} games, {100*r.hc_over:.0f}% over (elsewhere {100*r.else_over:.0f}%)" if pd.notna(getattr(r, "hc_games", np.nan)) else "; first homecoming on record") + (" → historical read: QB UNDER (37% over, n=54)" if r.position == "QB" else " → group read: none (51%); use his own history"))
    if r.birthday: out.append(f"BIRTHDAY {r.birth_date.strftime('%b %d')} ({int(r.bday_diff):+d} days)" + (" → historical read: QB OVER (62% over, n=84)" if r.position == "QB" else " → no read (48% over)"))
    return out
rows = []
has_line = set(bd[bd.line.notna()].player_name)
for r in P[P.gsis_id.notna() & P.player_name.isin(has_line)].itertuples():
    tags = read(r)
    if not tags: continue
    L = bd[bd.player_name == r.player_name]; mk = "; ".join(f"{m.replace('player_','')} {g.line.median():g}" for m, g in L.groupby("market") if g.line.notna().any())
    rows.append((r.player_name, r.position, r.team, r.opp, "home" if r.is_home else "away", " | ".join(tags), mk))
print(f"\n{len(rows)} flagged players this week:\n")
for nm, pos, tm, opp, ha, tags, mk in sorted(rows, key=lambda x: ("REVENGE" not in x[5], x[1] != "QB", x[0])): print(f"  {nm:22s} {pos:3s} {tm:3s} {ha} vs {opp:3s} | {tags}\n      lines: {mk}")
pd.DataFrame(rows, columns=["player","position","team","opp","home_away","storylines","lines"]).to_csv(f"out/storyline_board_{SEASON}_wk{WEEK}.csv", index=False); print(f"\nwrote out/storyline_board_{SEASON}_wk{WEEK}.csv")
