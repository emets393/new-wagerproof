"""Hall of Fame Game dossier — every retrievable line + result + dimensions.

Honest scope: ONE game/year. Lines exist only where The Odds API preseason key has
history (2022+, ~10-credit historical calls); results/dimensions go back to 2000 via
ESPN (seasontype=1, week=1 = HOF week; venue-filtered to Canton). This is a scouting
dossier, not a backtest — n is structurally tiny.

Dimensions per game: closing spread/total/ML consensus, final score, SU/ATS/OU,
prev-season records (nflverse REG), new-HC flags (first year with team), starting QBs
(ESPN boxscore first-listed passer — in preseason the starter plays 1-2 drives, so
first-listed ≈ starter) + rookie flag (nflverse rosters entry_year == season).

Run:  python3 hof_study.py [--refresh]     (cached to data/hof_games.parquet)
"""
import json
import os
import sys
import urllib.parse
import urllib.request
from pathlib import Path

import numpy as np
import pandas as pd

HERE = Path(__file__).resolve().parent
DATA = HERE / "data"
REFRESH = "--refresh" in sys.argv

for p in (HERE / ".env.local", HERE.parent.parent / ".env.local"):
    if p.exists():
        for line in p.read_text().splitlines():
            if "=" in line and not line.startswith("#"):
                k, v = line.split("=", 1)
                os.environ.setdefault(k.strip(), v.strip())
OK = os.environ["ODDS_API_KEY"]

def get(url):
    with urllib.request.urlopen(urllib.request.Request(url), timeout=60) as r:
        return json.loads(r.read().decode())

# ---- A) closing lines from The Odds API (historical preseason key, 2022+) ----------
HOF_EVENTS = {  # year -> (event_id, close_snapshot ~kickoff-45min)
    2022: ("39e78b04a306500bf0841daddd0daf2f", "2022-08-04T23:15:00Z"),  # JAX @ LV
    2023: ("a68252aa9fc5e7a09ad69bd97c4b0e51", "2023-08-03T23:15:00Z"),  # NYJ @ CLE
    2024: ("6973cdf916dfd32d5ed8c7fb675e3e3c", "2024-08-01T23:15:00Z"),  # HOU @ CHI
    2025: ("aefa7500ef2e7b81a175dd14a6602432", "2025-07-31T23:15:00Z"),  # LAC @ DET
}

def consensus_from_bookmakers(ev):
    sp, tot, mlh, mla = [], [], [], []
    for bk in ev.get("bookmakers", []):
        for m in bk.get("markets", []):
            for o in m.get("outcomes", []):
                if m["key"] == "spreads" and o["name"] == ev["home_team"] and o.get("point") is not None:
                    sp.append(float(o["point"]))
                elif m["key"] == "totals" and o["name"] == "Over" and o.get("point") is not None:
                    tot.append(float(o["point"]))
                elif m["key"] == "h2h" and o.get("price") is not None:
                    (mlh if o["name"] == ev["home_team"] else mla).append(float(o["price"]))
    med = lambda v: round(float(np.median(v)), 1) if v else None
    return dict(spread_home=med(sp), total=med(tot), ml_home=med(mlh), ml_away=med(mla),
                books=max(len(sp), len(tot), 1))

def fetch_lines():
    rows = []
    for year, (eid, snap) in HOF_EVENTS.items():
        url = (f"https://api.the-odds-api.com/v4/historical/sports/americanfootball_nfl_preseason/"
               f"events/{eid}/odds?" + urllib.parse.urlencode(
                   {"apiKey": OK, "regions": "us", "markets": "spreads,totals,h2h",
                    "oddsFormat": "american", "date": snap}))
        try:
            ev = get(url)["data"]
            rows.append(dict(season=year, home=ev["home_team"], away=ev["away_team"],
                             kickoff=ev["commence_time"], **consensus_from_bookmakers(ev)))
        except Exception as e:
            print(f"[lines] {year} failed: {str(e)[:80]}")
    # current-year game (live odds, free endpoint)
    cur = get("https://api.the-odds-api.com/v4/sports/americanfootball_nfl_preseason/odds?" +
              urllib.parse.urlencode({"apiKey": OK, "regions": "us",
                                      "markets": "spreads,totals,h2h", "oddsFormat": "american"}))
    if cur:
        ev = sorted(cur, key=lambda e: e["commence_time"])[0]
        year = int(ev["commence_time"][:4])
        rows.append(dict(season=year, home=ev["home_team"], away=ev["away_team"],
                         kickoff=ev["commence_time"], **consensus_from_bookmakers(ev)))
    return pd.DataFrame(rows)

# Archive-recovered closing lines (2008-2021, web research 2026-08-06; multi-source
# confirmed except 2013/2017/2018 totals = single-source VSIN/OddsShark). spread_home
# convention matches the API rows: negative = home favored.
RECOVERED_LINES = {
    2008: dict(spread_home=-4.5, total=31.5, src="archive"),   # WAS -4.5 (AN/VSIN/VI)
    2010: dict(spread_home=-2.5, total=32.5, src="archive"),   # CIN -2.5 (DonBest archive)
    2012: dict(spread_home=-2.5, total=37.0, src="archive"),   # NO -2.5 (VSIN/AN/BR)
    2013: dict(spread_home=3.0,  total=33.5, src="archive"),   # DAL +3 home dog (VSIN)
    2014: dict(spread_home=-2.0, total=32.5, src="archive"),   # BUF -2 (VSIN/BR)
    2015: dict(spread_home=-3.5, total=34.0, src="archive"),   # MIN -3.5 (VSIN/BBV)
    2017: dict(spread_home=-2.0, total=34.5, src="archive"),   # DAL -2 (SI/OddsShark)
    2018: dict(spread_home=-2.5, total=33.5, src="archive"),   # BAL -2.5 (Heavy/AN/BR)
    2019: dict(spread_home=2.5,  total=34.0, src="archive"),   # DEN -2.5 road fav (AN/FD)
    2021: dict(spread_home=-2.0, total=31.5, src="archive"),   # PIT -2 (AN close)
}

# ---- B) results + starters from ESPN (HOF week = seasontype 1, week 1) -------------
CANTON = ("hall of fame", "benson", "fawcett")

def fetch_results(years=range(2000, 2027)):
    rows = []
    for y in years:
        url = (f"https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard?" +
               urllib.parse.urlencode({"dates": str(y), "seasontype": 1, "week": 1}))
        try:
            js = get(url)
        except Exception as e:
            print(f"[espn] {y} failed: {str(e)[:60]}"); continue
        for ev in js.get("events", []):
            comp = ev["competitions"][0]
            venue = (comp.get("venue", {}).get("fullName") or "").lower()
            if not any(k in venue for k in CANTON):
                continue
            teams = {c["homeAway"]: c for c in comp["competitors"]}
            done = comp.get("status", {}).get("type", {}).get("completed", False)
            rows.append(dict(
                season=y, espn_id=ev["id"], date=ev["date"][:10],
                home=teams["home"]["team"]["displayName"],
                away=teams["away"]["team"]["displayName"],
                home_score=int(teams["home"].get("score") or 0) if done else None,
                away_score=int(teams["away"].get("score") or 0) if done else None,
                completed=done))
    return pd.DataFrame(rows)

import re
_QB_TOKEN = re.compile(r"([A-Z]\.[A-Za-z'\-]+)")

def fetch_starters(espn_id):
    """ACTUAL starter per team = the passer on each team's FIRST offensive drive
    (ESPN play-by-play). The boxscore passer list is stat-ordered, NOT start-ordered
    (a relief QB who out-threw the starter lists first), so boxscore-first is only
    the fallback for games without drives data. Short names from play text
    ("K.Mond") expand via the boxscore list (last name + first initial)."""
    url = f"https://site.api.espn.com/apis/site/v2/sports/football/nfl/summary?event={espn_id}"
    try:
        js = get(url)
    except Exception:
        return {}
    pool, box_first = {}, {}
    for tb in js.get("boxscore", {}).get("players", []):
        team = tb.get("team", {}).get("displayName")
        for cat in tb.get("statistics", []):
            if cat.get("name") == "passing" and cat.get("athletes"):
                names = [a.get("athlete", {}).get("displayName") for a in cat["athletes"]]
                pool[team] = [n for n in names if n]
                if pool[team]:
                    box_first[team] = pool[team][0]
                break
    out = {}
    for d in js.get("drives", {}).get("previous", []):
        team = d.get("team", {}).get("displayName")
        if not team or team in out:
            continue
        for pl in d.get("plays", []):
            txt = pl.get("text") or ""
            if " pass " in txt or " sacked" in txt or " scrambles" in txt:
                m = _QB_TOKEN.search(txt)
                if m:
                    short = m.group(1)
                    init, last = short[0], short.split(".", 1)[1].lower()
                    full = next((n for n in pool.get(team, [])
                                 if n.lower().split()[-1] == last and n[0] == init), short)
                    out[team] = full
                break
    for team, name in box_first.items():
        out.setdefault(team, name)
    return out

# ---- C) dimensions from nflverse ---------------------------------------------------
def add_dimensions(df):
    g = pd.read_parquet(DATA / "nflverse_games.parquet")
    reg = g[g.game_type == "REG"].copy()
    # ESPN display name -> nflverse abbr (incl. legacy franchises for the 2000s games)
    AB = {"Arizona Cardinals": "ARI", "Atlanta Falcons": "ATL", "Baltimore Ravens": "BAL",
          "Buffalo Bills": "BUF", "Carolina Panthers": "CAR", "Chicago Bears": "CHI",
          "Cincinnati Bengals": "CIN", "Cleveland Browns": "CLE", "Dallas Cowboys": "DAL",
          "Denver Broncos": "DEN", "Detroit Lions": "DET", "Green Bay Packers": "GB",
          "Houston Texans": "HOU", "Indianapolis Colts": "IND", "Jacksonville Jaguars": "JAX",
          "Kansas City Chiefs": "KC", "Las Vegas Raiders": "LV", "Oakland Raiders": "OAK",
          "Los Angeles Chargers": "LAC", "San Diego Chargers": "SD", "Los Angeles Rams": "LA",
          "St. Louis Rams": "STL", "Miami Dolphins": "MIA", "Minnesota Vikings": "MIN",
          "New England Patriots": "NE", "New Orleans Saints": "NO", "New York Giants": "NYG",
          "New York Jets": "NYJ", "Philadelphia Eagles": "PHI", "Pittsburgh Steelers": "PIT",
          "San Francisco 49ers": "SF", "Seattle Seahawks": "SEA", "Tampa Bay Buccaneers": "TB",
          "Tennessee Titans": "TEN", "Washington Commanders": "WAS",
          "Washington Redskins": "WAS", "Washington Football Team": "WAS"}

    def prev_record(season, team_ab):
        s = reg[(reg.season == season - 1) & ((reg.home_team == team_ab) | (reg.away_team == team_ab))]
        s = s.dropna(subset=["result"])
        if not len(s): return None, None
        w = int(((s.home_team == team_ab) & (s.result > 0)).sum()
                + ((s.away_team == team_ab) & (s.result < 0)).sum())
        l = int(len(s[s.result != 0]) - w)
        return w, l

    def new_hc(season, team_ab):
        cur = set(g[(g.season == season) & (g.home_team == team_ab)].home_coach) | \
              set(g[(g.season == season) & (g.away_team == team_ab)].away_coach)
        prv = set(g[(g.season == season - 1) & (g.home_team == team_ab)].home_coach) | \
              set(g[(g.season == season - 1) & (g.away_team == team_ab)].away_coach)
        cur, prv = {c for c in cur if pd.notna(c)}, {p for p in prv if pd.notna(p)}
        if not cur: return None
        return not (cur & prv)

    xw = pd.read_parquet(DATA / "players_xwalk.parquet")[
        ["display_name", "rookie_season", "draft_year", "position"]]
    xw = xw[xw.position == "QB"]

    def rookie(season, qb_name):
        if not qb_name or pd.isna(qb_name): return None
        cand = xw[xw.display_name.str.lower() == str(qb_name).lower()]
        if not len(cand): return None
        rs = cand.iloc[0].rookie_season
        dy = cand.iloc[0].draft_year
        base = rs if pd.notna(rs) else dy
        return bool(base == season) if pd.notna(base) else None

    dims = []
    for _, r in df.iterrows():
        hab, aab = AB.get(r.home), AB.get(r.away)
        hw, hl = prev_record(r.season, hab) if hab else (None, None)
        aw, al = prev_record(r.season, aab) if aab else (None, None)
        dims.append(dict(
            home_ab=hab, away_ab=aab,
            home_prev=f"{hw}-{hl}" if hw is not None else None,
            away_prev=f"{aw}-{al}" if aw is not None else None,
            home_prev_wpct=round(hw / (hw + hl), 3) if hw is not None and (hw + hl) else None,
            away_prev_wpct=round(aw / (aw + al), 3) if aw is not None and (aw + al) else None,
            home_new_hc=new_hc(r.season, hab) if hab else None,
            away_new_hc=new_hc(r.season, aab) if aab else None,
            home_qb_rookie=rookie(r.season, r.get("home_qb")),
            away_qb_rookie=rookie(r.season, r.get("away_qb")),
        ))
    return pd.concat([df.reset_index(drop=True), pd.DataFrame(dims)], axis=1)

# ---- assemble ----------------------------------------------------------------------
# Verified current-season facts (azcardinals.com / CBS / Bleacher Report, 2026-08-06).
# nflverse has no current-season coach/roster rows preseason, so these override.
FACTS_2026 = dict(home_new_hc=True,        # ARI: Gannon fired (3-14) -> Mike LaFleur yr 1
                  away_new_hc=False,       # CAR: Canales continuity
                  home_qb="Carson Beck",   # ROOKIE, 3rd round 2026 — named starter
                  away_qb="Kenny Pickett",
                  home_qb_rookie=True, away_qb_rookie=False)

cache = DATA / "hof_games.parquet"
if cache.exists() and not REFRESH:
    df = pd.read_parquet(cache)
else:
    res = fetch_results()
    print(f"results: {len(res)} HOF games {res.season.min()}-{res.season.max()}")
    starters = {}
    for _, r in res.iterrows():
        st = fetch_starters(r.espn_id)
        starters[r.espn_id] = (st.get(r.home), st.get(r.away))
    res["home_qb"] = [starters[i][0] for i in res.espn_id]
    res["away_qb"] = [starters[i][1] for i in res.espn_id]
    lines = fetch_lines()
    print(f"lines: {len(lines)} games with odds ({sorted(lines.season.tolist())})")
    df = res.merge(lines.drop(columns=["home", "away", "kickoff"]), on="season", how="left")
    df["line_src"] = np.where(df.spread_home.notna(), "odds_api", None)
    for yr, rl in RECOVERED_LINES.items():
        m = df.season == yr
        df.loc[m & df.spread_home.isna(), "line_src"] = rl["src"]
        df.loc[m & df.total.isna(), "total"] = rl["total"]
        df.loc[m & df.spread_home.isna(), "spread_home"] = rl["spread_home"]
    df = add_dimensions(df)
    for k, v in FACTS_2026.items():
        df.loc[df.season == 2026, k] = v
    df.to_parquet(cache, index=False)

done = df[df.completed == True].copy()
done["margin_home"] = done.home_score - done.away_score
done["tot_pts"] = done.home_score + done.away_score

print("\n" + "=" * 100)
print("HALL OF FAME GAME DOSSIER")
print("=" * 100)
cols = ["season", "away", "home", "away_score", "home_score", "spread_home", "total",
        "away_prev", "home_prev", "away_new_hc", "home_new_hc", "away_qb", "home_qb",
        "away_qb_rookie", "home_qb_rookie"]
print(df[[c for c in cols if c in df.columns]].to_string(index=False))

wl = done.dropna(subset=["spread_home"]).copy()
if len(wl):
    wl["fav_home"] = wl.spread_home < 0
    wl["fav_cover"] = np.where(wl.fav_home, wl.margin_home + wl.spread_home > 0,
                               -wl.margin_home - (-wl.spread_home) > 0)
    wl["push"] = (wl.margin_home + wl.spread_home) == 0
    wl["over"] = wl.tot_pts > wl.total
    print(f"\nATS (n={len(wl)}): favorite covered {int(wl.fav_cover.sum())}/{len(wl)}"
          f" | OVER {int(wl.over.sum())}/{len(wl)} (avg total line {wl.total.mean():.1f},"
          f" avg actual {wl.tot_pts.mean():.1f})")

print(f"\nSU dimensions (n={len(done)} completed since {done.season.min()}):")
d = done.dropna(subset=["home_prev_wpct", "away_prev_wpct"]).copy()
if len(d):
    d["better_prev_is_home"] = d.home_prev_wpct > d.away_prev_wpct
    d["better_prev_won"] = np.where(d.better_prev_is_home, d.margin_home > 0, d.margin_home < 0)
    print(f"  better previous-season team won SU: {int(d.better_prev_won.sum())}/{len(d)}")
nh = done.dropna(subset=["home_new_hc", "away_new_hc"])
nh = nh[nh.home_new_hc != nh.away_new_hc]
if len(nh):
    nh_won = np.where(nh.home_new_hc, nh.margin_home > 0, nh.margin_home < 0)
    print(f"  exactly one team has NEW HC — new-HC team won SU: {int(nh_won.sum())}/{len(nh)}")
rk = done[(done.home_qb_rookie == True) | (done.away_qb_rookie == True)]
if len(rk):
    rk_won = np.where(rk.home_qb_rookie == True, rk.margin_home > 0, rk.margin_home < 0)
    print(f"  rookie QB STARTED (drives-verified) — rookie's team SU: {int(rk_won.sum())}/{len(rk)}"
          f"  ({', '.join(str(int(s)) for s in rk.season)})")
else:
    print("  rookie QB started: none detected 2008-2025 (drives-verified)")
print(f"  avg total points: {done.tot_pts.mean():.1f} | home SU: "
      f"{int((done.margin_home > 0).sum())}/{len(done)}")
