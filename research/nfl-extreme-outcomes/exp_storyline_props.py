#!/usr/bin/env python3
"""STORYLINE PROPS (owner, 2026-09-19): three dimensions, each graded against the actual prop lines 2023-25.
  HOMETOWN   birthplace within R miles of the game site (R = 60 / 120), or same state; the event is the AWAY / neutral game
             near home (a home game near his birthplace is every week — tested separately as 'plays for the hometown team')
  BIRTHDAY   game within +-3 days of his birthday (and the exact day)
  REVENGE    opponent is a former team (weekly rosters 2016-25). Attributes: drafted by them, seasons there, seasons since
             he left, first meeting since leaving, at the old stadium, left midseason (traded during a season), and a
             hand-curated DRAMA tier (data/storyline_drama.csv: 1 = messy exit, 2 = notable exit)
Frame: props_frame (every book, T-60 close) -> consensus line (median across books), best over / best under book with price;
markets: 8 over/under markets; anytime TD graded as hit rate vs the consensus implied probability.
Grading per flag: actual − consensus line (mean / median), over rate vs consensus, best-book OVER ROI and UNDER ROI, per season;
control = the same players' games without the flag (paired), plus the league. Also vs his own form (actual − l5) so a
storyline lift shows even when the line already moved."""
import numpy as np, pandas as pd, warnings, math
warnings.filterwarnings("ignore"); num = lambda s: pd.to_numeric(s, errors="coerce")
pf = pd.read_parquet("data/props_frame.parquet"); pf = pf[pf.season.between(2023, 2025) & pf.close_line.notna()].copy(); pf["team"] = pf.team.replace({"LAR":"LA"})
OU = [m for m in pf.market.unique() if m != "player_anytime_td"]
dec = lambda o: np.where(o > 0, 1 + o / 100, 1 + 100 / np.abs(o))
pf["co_dec"] = np.where(num(pf.close_over).notna(), dec(num(pf.close_over).fillna(-110)), 1.91); pf["cu_dec"] = np.where(num(pf.close_under).notna(), dec(num(pf.close_under).fillna(-110)), 1.91)
K = ["player_id","season","week","market"]
def bb(g):
    ov = g.loc[g.close_line.idxmin()]; un = g.loc[g.close_line.idxmax()]
    return pd.Series(dict(close_line=g.close_line.median(), bo_line=ov.close_line, bo_dec=ov.co_dec, bu_line=un.close_line, bu_dec=un.cu_dec, actual=g.actual.dropna().iloc[0] if g.actual.notna().any() else np.nan, played=g.played.max() if "played" in g else np.nan, l3=g.l3_avg.dropna().iloc[0] if "l3_avg" in g and g.l3_avg.notna().any() else np.nan, team=g.team.iloc[0], home_team=g.home_team.iloc[0], away_team=g.away_team.iloc[0], player_name=g.player_name.iloc[0], position=g.position.iloc[0], yes_prob=g.close_yes_prob.median() if "close_yes_prob" in g else np.nan))
D = pf.groupby(K).apply(bb).reset_index(); D = D[D.actual.notna()].copy()
N2A = {"Arizona Cardinals":"ARI","Atlanta Falcons":"ATL","Baltimore Ravens":"BAL","Buffalo Bills":"BUF","Carolina Panthers":"CAR","Chicago Bears":"CHI","Cincinnati Bengals":"CIN","Cleveland Browns":"CLE","Dallas Cowboys":"DAL","Denver Broncos":"DEN","Detroit Lions":"DET","Green Bay Packers":"GB","Houston Texans":"HOU","Indianapolis Colts":"IND","Jacksonville Jaguars":"JAX","Kansas City Chiefs":"KC","Las Vegas Raiders":"LV","Los Angeles Chargers":"LAC","Los Angeles Rams":"LA","Miami Dolphins":"MIA","Minnesota Vikings":"MIN","New England Patriots":"NE","New Orleans Saints":"NO","New York Giants":"NYG","New York Jets":"NYJ","Philadelphia Eagles":"PHI","Pittsburgh Steelers":"PIT","San Francisco 49ers":"SF","Seattle Seahawks":"SEA","Tampa Bay Buccaneers":"TB","Tennessee Titans":"TEN","Washington Commanders":"WAS"}
D["home"] = D.home_team.map(lambda t: N2A.get(t, t)).replace({"LAR":"LA"}); D["away"] = D.away_team.map(lambda t: N2A.get(t, t)).replace({"LAR":"LA"})
D["is_home"] = D.team == D.home; D["opp"] = np.where(D.is_home, D.away, D.home)
# DNP / injured-early rows: actual 0 with no played flag -> keep only played (DNP = no action, per the grading law)
if D.played.notna().any(): D = D[(D.played != 0) | D.played.isna()]
print(f"prop lines 2023-25 with a graded actual: {len(D)} player-game-markets, {D.player_id.nunique()} players")
# ---------------------------------------------------------------- sites, bios
S = pd.read_parquet("data/game_sites.parquet"); S = S[S.game_type == "REG"][["season","week","home_team","away_team","gameday","site_lat","site_lon","site"]]
D = D.merge(S, left_on=["season","week","home","away"], right_on=["season","week","home_team","away_team"], how="left", suffixes=("", "_s")); D["gameday"] = pd.to_datetime(D.gameday)
B = pd.read_parquet("data/player_bio.parquet"); D = D.merge(B[["gsis_id","birth_date","birth_city","birth_st","birth_country","birth_lat","birth_lon","draft_team","draft_year","draft_round","rookie_season","college_name"]].rename(columns={"gsis_id":"player_id"}), on="player_id", how="left")
D["birth_date"] = pd.to_datetime(D.birth_date, errors="coerce"); D["draft_team"] = D.draft_team.replace({"LAR":"LA","OAK":"LV","SD":"LAC","STL":"LA"})
STAD = {"ARI":(33.5276,-112.2626),"ATL":(33.7554,-84.4010),"BAL":(39.2780,-76.6227),"BUF":(42.7738,-78.7870),"CAR":(35.2258,-80.8528),"CHI":(41.8623,-87.6167),"CIN":(39.0954,-84.5160),"CLE":(41.5061,-81.6995),"DAL":(32.7473,-97.0945),"DEN":(39.7439,-105.0201),"DET":(42.3400,-83.0456),"GB":(44.5013,-88.0622),"HOU":(29.6847,-95.4107),"IND":(39.7601,-86.1639),"JAX":(30.3239,-81.6373),"KC":(39.0489,-94.4839),"LV":(36.0909,-115.1833),"LAC":(33.9535,-118.3392),"LA":(33.9535,-118.3392),"MIA":(25.9580,-80.2389),"MIN":(44.9736,-93.2575),"NE":(42.0909,-71.2643),"NO":(29.9511,-90.0812),"NYG":(40.8135,-74.0745),"NYJ":(40.8135,-74.0745),"PHI":(39.9008,-75.1675),"PIT":(40.4468,-80.0158),"SF":(37.4032,-121.9698),"SEA":(47.5952,-122.3316),"TB":(27.9759,-82.5033),"TEN":(36.1665,-86.7713),"WAS":(38.9076,-76.8645)}
def hav(la1, lo1, la2, lo2):
    la1, lo1, la2, lo2 = map(np.radians, (la1, lo1, la2, lo2)); a = np.sin((la2 - la1) / 2) ** 2 + np.cos(la1) * np.cos(la2) * np.sin((lo2 - lo1) / 2) ** 2; return 3958.8 * 2 * np.arcsin(np.sqrt(a))
D["dist_site"] = hav(D.birth_lat, D.birth_lon, D.site_lat, D.site_lon)
own = D.team.map(lambda t: STAD.get(t, (np.nan, np.nan))); D["dist_own"] = hav(D.birth_lat, D.birth_lon, own.map(lambda x: x[0]), own.map(lambda x: x[1]))
SITE_ST = {"ARI":"AZ","ATL":"GA","BAL":"MD","BUF":"NY","CAR":"NC","CHI":"IL","CIN":"OH","CLE":"OH","DAL":"TX","DEN":"CO","DET":"MI","GB":"WI","HOU":"TX","IND":"IN","JAX":"FL","KC":"MO","LV":"NV","LAC":"CA","LA":"CA","MIA":"FL","MIN":"MN","NE":"MA","NO":"LA","NYG":"NJ","NYJ":"NJ","PHI":"PA","PIT":"PA","SF":"CA","SEA":"WA","TB":"FL","TEN":"TN","WAS":"MD"}
D["site_st"] = D.site.map(SITE_ST); D["same_state"] = (D.site_st == D.birth_st) & D.birth_st.notna()
D["home_near_own"] = D.dist_own <= 120   # plays for a team near his hometown (constant, not an event)
for R in (60, 120): D[f"near{R}"] = D.dist_site <= R
D["homecoming60"] = D.near60 & ~D.is_home; D["homecoming120"] = D.near120 & ~D.is_home; D["homecoming_state"] = D.same_state & ~D.is_home & ~D.near120
# ---------------------------------------------------------------- birthday
bd = D.birth_date; gd = D.gameday
def bdiff(b, g):
    if pd.isna(b) or pd.isna(g): return np.nan
    try: this = b.replace(year=g.year)
    except ValueError: this = b.replace(year=g.year, day=28)
    return (g - this).days
D["bday_diff"] = [bdiff(b, g) for b, g in zip(bd, gd)]; D["birthday3"] = D.bday_diff.abs() <= 3; D["birthday0"] = D.bday_diff == 0; D["birthday_week"] = D.bday_diff.between(-6, 0)   # game in the 7 days ending on his birthday
# ---------------------------------------------------------------- revenge
W = pd.read_parquet("data/player_team_weeks.parquet"); W = W[W.game_type.fillna("REG") == "REG"]
hist = W.groupby(["player_id","team"]).agg(first_season=("season","min"), last_season=("season","max"), n_seasons=("season","nunique"), last_week=("week","max")).reset_index()
# left midseason: his last week with the old team was < 15 and he appeared with another team the same season
lw = W.groupby(["player_id","season","team"]).week.agg(["min","max"]).reset_index(); multi = lw.groupby(["player_id","season"]).team.nunique().rename("nteams").reset_index(); lw = lw.merge(multi, on=["player_id","season"])
mid = lw[(lw.nteams > 1) & (lw["max"] < 15)][["player_id","season","team"]].assign(left_mid=True).rename(columns={"season":"last_season"})
hist = hist.merge(mid, on=["player_id","last_season","team"], how="left"); hist["left_mid"] = hist.left_mid.fillna(False)
H = D.merge(hist.rename(columns={"team":"opp"}), on=["player_id","opp"], how="left")
H["revenge"] = H.last_season.notna() & (H.last_season < H.season)   # he was on the opponent in an earlier season
H["seasons_since"] = H.season - H.last_season; H["drafted_by_opp"] = H.draft_team == H.opp; H["at_old_stadium"] = H.revenge & ~H.is_home
first = H[H.revenge].sort_values(["season","week"]).groupby(["player_id","opp"]).head(1)[["player_id","opp","season","week"]].assign(first_meeting=True); H = H.merge(first, on=["player_id","opp","season","week"], how="left"); H["first_meeting"] = H.first_meeting.fillna(False) & H.revenge
dr = pd.read_csv("data/storyline_drama.csv"); dr = dr[dr.tier > 0].copy(); dr["_n"] = dr.player.str.lower().str.replace(".", "", regex=False).str.replace("'", "", regex=False)
H["_n"] = H.player_name.str.lower().str.replace(".", "", regex=False).str.replace("'", "", regex=False)
# name match tolerant to "C.Kupp" vs "Cooper Kupp": initial + last name
def key(n): p = str(n).split(); return (p[0][0] + " " + p[-1]) if p else n
dr["_k"] = dr._n.map(key); H["_k"] = H._n.map(key); tier = dr.groupby(["_k","old_team"]).tier.min().rename("drama_tier").reset_index()
H = H.merge(tier, left_on=["_k","opp"], right_on=["_k","old_team"], how="left"); H["drama_tier"] = np.where(H.revenge, H.drama_tier.fillna(0), np.nan)
D = H
print(f"flags: homecoming60 {int(D.homecoming60.sum())} | homecoming120 {int(D.homecoming120.sum())} | same-state away {int(D.homecoming_state.sum())} | birthday±3 {int(D.birthday3.sum())} (exact {int(D.birthday0.sum())}) | revenge {int(D.revenge.sum())} (drafted-by {int((D.revenge & D.drafted_by_opp).sum())}, first meeting {int(D.first_meeting.sum())}, drama tier 1 {int((D.drama_tier == 1).sum())}, tier 2 {int((D.drama_tier == 2).sum())}) — player-game-markets")
D["res"] = D.actual - D.close_line; D["zres"] = D.res / D.groupby("market").res.transform("std"); D["over"] = (D.actual > D.close_line).astype(float); D.loc[D.actual == D.close_line, "over"] = np.nan; D["form_res"] = D.actual - D.l3
D["is_ou"] = D.market.isin(OU)
def roi(x, side):
    if side == "over": line, pay, won = x.bo_line, x.bo_dec, x.actual > x.bo_line
    else: line, pay, won = x.bu_line, x.bu_dec, x.actual < x.bu_line
    push = x.actual == line; p = np.where(push, 0, np.where(won, pay - 1.0, -1.0)); return p.mean() if len(p) else np.nan, int((~push).sum())   # pay is DECIMAL odds here, profit = pay − 1
def report(label, mask, by_market=False):
    x = D[mask & D.is_ou]; c = D[~mask & D.is_ou & D.player_id.isin(x.player_id.unique())]   # paired control: same players, other games
    if not len(x): print(f"  {label:34s} —"); return
    seas = " | ".join(f"{s}: over {100*x[x.season==s].over.mean():4.1f}% n={int((x.season==s).sum()):3d}" if (x.season==s).sum() else f"{s}: —" for s in (2023, 2024, 2025))
    print(f"  {label:34s} n={len(x):4d} | actual−line (in sd of the market) {x.zres.mean():+5.2f} vs same players elsewhere {c.zres.mean():+5.2f} | over {100*x.over.mean():4.1f}% (ctrl {100*c.over.mean():4.1f}%) | best-book O {100*roi(x,'over')[0]:+5.1f}% U {100*roi(x,'under')[0]:+5.1f}% | vs his L3 form {x.form_res.mean():+5.2f} (ctrl {c.form_res.mean():+5.2f}) | {seas}")
    if by_market:
        for m, g in x.groupby("market"):
            if len(g) < 25: continue
            cg = c[c.market == m]; print(f"      {m:26s} n={len(g):4d} | actual−line {g.res.mean():+6.2f} (ctrl {cg.res.mean():+6.2f}) | over {100*g.over.mean():4.1f}% (ctrl {100*cg.over.mean():4.1f}%) | O {100*roi(g,'over')[0]:+5.1f}% U {100*roi(g,'under')[0]:+5.1f}%")
    a = D[mask & (D.market == "player_anytime_td")]; ca = D[~mask & (D.market == "player_anytime_td") & D.player_id.isin(a.player_id.unique())]
    if len(a) >= 25: print(f"      anytime TD: scored {100*(a.actual > 0).mean():4.1f}% vs implied {100*a.yes_prob.mean():4.1f}% (n={len(a)}) | same players elsewhere {100*(ca.actual > 0).mean():4.1f}% vs implied {100*ca.yes_prob.mean():4.1f}%")
print("\n" + "=" * 150); print("LEAGUE BASELINE (all O/U markets): actual − consensus line, over rate, best-book blanket ROI"); print("=" * 150)
x = D[D.is_ou]; print(f"  all lines n={len(x)} | actual−line (sd units) {x.zres.mean():+.2f} | over {100*x.over.mean():.1f}% | blanket best-book O {100*roi(x,'over')[0]:+.1f}% U {100*roi(x,'under')[0]:+.1f}%")
print("\n" + "=" * 150); print("HOMETOWN — the away / neutral game near where he was born"); print("=" * 150)
report("homecoming ≤60 mi (away)", D.homecoming60, True); report("homecoming ≤120 mi (away)", D.homecoming120, True); report("same state, >120 mi (away)", D.homecoming_state)
report("home game near birthplace (constant)", D.near120 & D.is_home); report("plays for hometown team (all games)", D.home_near_own)
print("\n" + "=" * 150); print("BIRTHDAY"); print("=" * 150)
report("birthday ±3 days", D.birthday3, True); report("birthday exact", D.birthday0); report("7 days ending on birthday", D.birthday_week); report("birthday ±3, home", D.birthday3 & D.is_home); report("birthday ±3, away", D.birthday3 & ~D.is_home)
print("\n" + "=" * 150); print("REVENGE — playing a former team"); print("=" * 150)
report("any former team", D.revenge, True); report("  first meeting since leaving", D.first_meeting, True); report("  at the old stadium", D.at_old_stadium); report("  drafted by them", D.revenge & D.drafted_by_opp, True)
report("  3+ seasons there", D.revenge & (D.n_seasons >= 3)); report("  left within 1 season", D.revenge & (D.seasons_since <= 1), True); report("  left midseason (traded)", D.revenge & D.left_mid)
report("  DRAMA tier 1 (messy exit)", D.drama_tier == 1, True); report("  DRAMA tier 2 (notable exit)", D.drama_tier == 2, True); report("  drama 1+2, first meeting", D.first_meeting & (D.drama_tier >= 1), True); report("  drama 1+2, at old stadium", D.at_old_stadium & (D.drama_tier >= 1), True)
report("  no-drama former team (tier 0)", (D.drama_tier == 0))
print("\n  DRAMA tier-1 games, every one (O/U markets pooled per game): player, opp, week, markets over/total, yards-type residual")
t1 = D[(D.drama_tier == 1) & D.is_ou].groupby(["player_name","opp","season","week","is_home"]).agg(mk=("market","size"), over=("over","mean"), res_yds=("res", lambda s: s[D.loc[s.index, "market"].str.contains("yds")].mean())).reset_index().sort_values(["season","week"])
print(t1.to_string(index=False))
D.to_parquet("data/_storyline_frame.parquet", index=False)
