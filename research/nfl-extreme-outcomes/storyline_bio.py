#!/usr/bin/env python3
"""STORYLINE PROPS — step 1: player bios + geography + team history (owner, 2026-09-19).
Every player who has had a prop line 2023-26 (props_frame) or is on this week's board (nfl_slate_props):
  nflverse players table  birth date, college, draft team / year / round, rookie season, espn_id, pfr_id
  ESPN athlete endpoint   birthplace city / state / country (keyed by espn_id)
  geocode                 birthplace -> lat/lon via geonamescache (offline, US cities 15k+), Nominatim fallback (cached)
  weekly rosters 2016-25  player-team-week history (catches midseason trades)  -> data/player_team_weeks.parquet
  schedules 2018-26       game date, stadium, neutral-site flag; stadium coordinates (hand table) -> data/game_sites.parquet
Writes data/player_bio.parquet."""
import os, sys, json, time, math, numpy as np, pandas as pd, requests, warnings
warnings.filterwarnings("ignore"); HERE = os.path.dirname(os.path.abspath(__file__)); os.chdir(HERE); sys.path.insert(0, os.path.dirname(HERE)); import football_report_lib as lib
import nfl_data_py as nfl
env = lib.load_env(); H = lib.hdr(env)
def fetch(table, params):
    j = requests.get(f"{lib.SUPA}/{table}?{params}", headers=H, timeout=60).json(); return j if isinstance(j, list) else []
# ---------------------------------------------------------------- who
pf = pd.read_parquet("data/props_frame.parquet"); ids = set(pf.player_id.dropna().unique())
P = nfl.import_players(); P = P[P.gsis_id.notna()].copy()
board = pd.DataFrame(fetch("nfl_slate_props", "select=player_name,team,position&season=eq.2026&limit=5000")).drop_duplicates("player_name")
def norm(n): return "".join(ch for ch in str(n).lower().replace(".", "").replace("'", "") if ch.isalnum() or ch == " ").strip()
P["_n"] = P.display_name.map(norm); cur = P[P.last_season >= 2024]
bmatch = {}
for r in board.itertuples():
    c = cur[cur._n == norm(r.player_name)]
    if len(c) > 1 and "position" in board.columns: c2 = c[c.position == r.position]; c = c2 if len(c2) else c
    if len(c): bmatch[r.player_name] = c.iloc[0].gsis_id
ids |= set(bmatch.values()); print(f"players with prop lines 2023-26: {len(ids)} (board matched {len(bmatch)}/{len(board)})")
B = P[P.gsis_id.isin(ids)][["gsis_id","display_name","first_name","last_name","position","birth_date","college_name","draft_team","draft_year","draft_round","draft_pick","rookie_season","last_season","latest_team","espn_id","pfr_id","status"]].drop_duplicates("gsis_id").copy()
# ---------------------------------------------------------------- ESPN birthplace (cached)
cache_f = "data/_espn_bio_cache.json"; cache = json.load(open(cache_f)) if os.path.exists(cache_f) else {}
todo = [e for e in B.espn_id.dropna().astype(int).astype(str).unique() if e not in cache]; print(f"ESPN lookups needed: {len(todo)} (cached {len(cache)})")
for i, e in enumerate(todo):
    try:
        j = requests.get(f"https://sports.core.api.espn.com/v2/sports/football/leagues/nfl/athletes/{e}", timeout=20).json(); bp = j.get("birthPlace", {}) or {}
        cache[e] = dict(city=bp.get("city"), state=bp.get("state"), country=bp.get("country"), dob=(j.get("dateOfBirth") or "")[:10], college_ref=(j.get("college", {}) or {}).get("$ref"))
    except Exception as ex: cache[e] = dict(city=None, state=None, country=None, dob=None, college_ref=None, err=str(ex)[:60])
    if i % 50 == 49: json.dump(cache, open(cache_f, "w")); print(f"  {i+1}/{len(todo)}")
    time.sleep(0.15)
json.dump(cache, open(cache_f, "w"))
B["_e"] = B.espn_id.map(lambda v: str(int(v)) if pd.notna(v) else None)
for c in ("city","state","country"): B["birth_" + c] = B._e.map(lambda e: (cache.get(e) or {}).get(c) if e else None)
B["birth_date"] = B.birth_date.fillna(B._e.map(lambda e: (cache.get(e) or {}).get("dob") if e else None))
print(f"birthplace filled: {B.birth_city.notna().mean():.0%} of {len(B)} | no espn_id: {B.espn_id.isna().sum()} | missing city with espn_id: {int((B.espn_id.notna() & B.birth_city.isna()).sum())}")
# ---------------------------------------------------------------- geocode
import geonamescache
gc = geonamescache.GeonamesCache(); cities = pd.DataFrame(gc.get_cities()).T; us = cities[cities.countrycode == "US"].copy()
us["_n"] = us.name.map(norm); us["st"] = us.admin1code; us = us.sort_values("population", ascending=False)
alt = {}
for r in us.itertuples():
    for a in (r.alternatenames or []): alt.setdefault((norm(a), r.st), (r.latitude, r.longitude))
ST = {"Alabama":"AL","Alaska":"AK","Arizona":"AZ","Arkansas":"AR","California":"CA","Colorado":"CO","Connecticut":"CT","Delaware":"DE","Florida":"FL","Georgia":"GA","Hawaii":"HI","Idaho":"ID","Illinois":"IL","Indiana":"IN","Iowa":"IA","Kansas":"KS","Kentucky":"KY","Louisiana":"LA","Maine":"ME","Maryland":"MD","Massachusetts":"MA","Michigan":"MI","Minnesota":"MN","Mississippi":"MS","Missouri":"MO","Montana":"MT","Nebraska":"NE","Nevada":"NV","New Hampshire":"NH","New Jersey":"NJ","New Mexico":"NM","New York":"NY","North Carolina":"NC","North Dakota":"ND","Ohio":"OH","Oklahoma":"OK","Oregon":"OR","Pennsylvania":"PA","Rhode Island":"RI","South Carolina":"SC","South Dakota":"SD","Tennessee":"TN","Texas":"TX","Utah":"UT","Vermont":"VT","Virginia":"VA","Washington":"WA","West Virginia":"WV","Wisconsin":"WI","Wyoming":"WY","District of Columbia":"DC"}
def st2(s):
    if s is None or (isinstance(s, float) and np.isnan(s)): return None
    s = str(s).strip(); return ST.get(s, s if len(s) == 2 else None)
B["birth_st"] = B.birth_state.map(st2)
geo_f = "data/_geocode_cache.json"; geo = json.load(open(geo_f)) if os.path.exists(geo_f) else {}
def geocode(city, st, country):
    if not city: return None
    key = f"{city}|{st}|{country}"
    if key in geo: return geo[key]
    res = None
    if country in (None, "USA", "US", "United States") and st:
        hit = us[(us._n == norm(city)) & (us.st == st)]
        if len(hit): res = (float(hit.iloc[0].latitude), float(hit.iloc[0].longitude), "gnc")
        elif (norm(city), st) in alt: la, lo = alt[(norm(city), st)]; res = (float(la), float(lo), "gnc-alt")
    if res is None:   # Nominatim, 1 req/s, cached
        q = ", ".join(x for x in (city, st, country or "") if x)
        try:
            j = requests.get("https://nominatim.openstreetmap.org/search", params=dict(q=q, format="json", limit=1), headers={"User-Agent": "wagerproof-research/1.0 (contact: research@wagerproof.bet)"}, timeout=20).json()
            if j: res = (float(j[0]["lat"]), float(j[0]["lon"]), "osm")
        except Exception: pass
        time.sleep(1.1)
    geo[key] = res; return res
n0 = 0
for r in B.itertuples():
    g = geocode(r.birth_city, r.birth_st, r.birth_country); n0 += 1
    if n0 % 100 == 0: json.dump(geo, open(geo_f, "w"))
json.dump(geo, open(geo_f, "w"))
G = B.apply(lambda r: geo.get(f"{r.birth_city}|{r.birth_st}|{r.birth_country}") or (np.nan, np.nan, None), axis=1, result_type="expand"); B["birth_lat"], B["birth_lon"], B["geo_src"] = G[0], G[1], G[2]
print(f"geocoded: {B.birth_lat.notna().mean():.0%} | sources: {B.geo_src.value_counts().to_dict()} | US-born {(B.birth_country.isin(['USA','US','United States'])).mean():.0%}")
B.drop(columns=["_e"]).to_parquet("data/player_bio.parquet", index=False)
# ---------------------------------------------------------------- team history (weekly rosters) + draft team
W = nfl.import_weekly_rosters(list(range(2016, 2026)))[["season","week","team","player_id","player_name","position","status","game_type"]]
W = W[W.game_type.isin(["REG","POST"]) | W.game_type.isna()]; W["team"] = W.team.replace({"LAR":"LA","OAK":"LV","SD":"LAC","STL":"LA"}); W.to_parquet("data/player_team_weeks.parquet", index=False)
print(f"team-weeks: {len(W)} rows 2016-25, {W.player_id.nunique()} players")
# ---------------------------------------------------------------- game sites
S = nfl.import_schedules(list(range(2018, 2027)))[["game_id","season","week","game_type","gameday","home_team","away_team","location","stadium","roof"]]
S["home_team"] = S.home_team.replace({"LAR":"LA","OAK":"LV","SD":"LAC"}); S["away_team"] = S.away_team.replace({"LAR":"LA","OAK":"LV","SD":"LAC"})
STAD = {"ARI":(33.5276,-112.2626),"ATL":(33.7554,-84.4010),"BAL":(39.2780,-76.6227),"BUF":(42.7738,-78.7870),"CAR":(35.2258,-80.8528),"CHI":(41.8623,-87.6167),"CIN":(39.0954,-84.5160),"CLE":(41.5061,-81.6995),"DAL":(32.7473,-97.0945),"DEN":(39.7439,-105.0201),"DET":(42.3400,-83.0456),"GB":(44.5013,-88.0622),"HOU":(29.6847,-95.4107),"IND":(39.7601,-86.1639),"JAX":(30.3239,-81.6373),"KC":(39.0489,-94.4839),"LV":(36.0909,-115.1833),"LAC":(33.9535,-118.3392),"LA":(33.9535,-118.3392),"MIA":(25.9580,-80.2389),"MIN":(44.9736,-93.2575),"NE":(42.0909,-71.2643),"NO":(29.9511,-90.0812),"NYG":(40.8135,-74.0745),"NYJ":(40.8135,-74.0745),"PHI":(39.9008,-75.1675),"PIT":(40.4468,-80.0158),"SF":(37.4032,-121.9698),"SEA":(47.5952,-122.3316),"TB":(27.9759,-82.5033),"TEN":(36.1665,-86.7713),"WAS":(38.9076,-76.8645)}
INTL = {"London":(51.5,-0.12),"Wembley":(51.556,-0.2796),"Tottenham":(51.6043,-0.0664),"Twickenham":(51.456,-0.3415),"Frankfurt":(50.0686,8.6455),"Munich":(48.2188,11.6247),"Berlin":(52.5147,13.2395),"Mexico":(19.3029,-99.1505),"Sao Paulo":(-23.5453,-46.4742),"São Paulo":(-23.5453,-46.4742),"Madrid":(40.4531,-3.6883),"Dublin":(53.3607,-6.2511),"Melbourne":(-37.82,144.983),"Rio":(-22.9,-43.2)}
def site(r):
    if str(r.location).lower() == "neutral" or (isinstance(r.stadium, str) and any(k.lower() in r.stadium.lower() for k in INTL)):
        for k, v in INTL.items():
            if isinstance(r.stadium, str) and k.lower() in r.stadium.lower(): return pd.Series(dict(site_lat=v[0], site_lon=v[1], site="intl:" + k))
        return pd.Series(dict(site_lat=STAD.get(r.home_team, (np.nan, np.nan))[0], site_lon=STAD.get(r.home_team, (np.nan, np.nan))[1], site="neutral-us:" + str(r.stadium)))
    la, lo = STAD.get(r.home_team, (np.nan, np.nan)); return pd.Series(dict(site_lat=la, site_lon=lo, site=r.home_team))
S = pd.concat([S, S.apply(site, axis=1)], axis=1); S.to_parquet("data/game_sites.parquet", index=False)
print(f"game sites: {len(S)} games 2018-26 | neutral/intl: {int(S.site.str.contains('intl|neutral').sum())} | missing coords: {int(S.site_lat.isna().sum())}")
print("\nsample bios:"); print(B[["display_name","position","birth_date","birth_city","birth_st","birth_country","birth_lat","college_name","draft_team","draft_year","draft_round"]].dropna(subset=["birth_city"]).sample(8, random_state=1).to_string(index=False))
