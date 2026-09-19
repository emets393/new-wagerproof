#!/usr/bin/env python3
"""COACHING STAFF per team-season 2022-2026 from Wikipedia season pages (owner, 2026-09-19).
nflverse has head coaches only; Pro Football Reference blocks scripted pulls. Each '<year> <Team> season' article carries a staff list
('*Offensive coordinator – [[Name]]'). Season-level (end-of-season staff); in-season firings are noted from the prose when found.
Writes data/coaching_staff.csv: season, team, head_coach, oc, dc, qb_coach, rb_coach, notes."""
import re, time, requests, pandas as pd
H = {"User-Agent": "wagerproof-research/1.0 (research@wagerproof.bet)"}
TEAMS = {"ARI":"Arizona Cardinals","ATL":"Atlanta Falcons","BAL":"Baltimore Ravens","BUF":"Buffalo Bills","CAR":"Carolina Panthers","CHI":"Chicago Bears","CIN":"Cincinnati Bengals","CLE":"Cleveland Browns","DAL":"Dallas Cowboys","DEN":"Denver Broncos","DET":"Detroit Lions","GB":"Green Bay Packers","HOU":"Houston Texans","IND":"Indianapolis Colts","JAX":"Jacksonville Jaguars","KC":"Kansas City Chiefs","LV":"Las Vegas Raiders","LAC":"Los Angeles Chargers","LA":"Los Angeles Rams","MIA":"Miami Dolphins","MIN":"Minnesota Vikings","NE":"New England Patriots","NO":"New Orleans Saints","NYG":"New York Giants","NYJ":"New York Jets","PHI":"Philadelphia Eagles","PIT":"Pittsburgh Steelers","SF":"San Francisco 49ers","SEA":"Seattle Seahawks","TB":"Tampa Bay Buccaneers","TEN":"Tennessee Titans","WAS":"Washington Commanders"}
def wikitext(title):
    j = requests.get("https://en.wikipedia.org/w/api.php", params=dict(action="parse", page=title, prop="wikitext", format="json", redirects=1), headers=H, timeout=30).json()
    return None if "error" in j else j["parse"]["wikitext"]["*"]
clean = lambda s: re.sub(r"\s+", " ", re.sub(r"<[^>]+>|\{\{[^}]*\}\}|\[\[([^|\]]*\|)?|\]\]|'''|''", "", s)).strip(" –-—")
def grab(w, label):
    m = re.search(r"\*\s*(?:[^\n*]*?/)?" + label + r"(?:/[^\n–\-—]*)?\s*[–\-—]\s*([^\n]+)", w, flags=re.I)
    return clean(m.group(1)) if m else None
rows = []
for season in range(2022, 2027):
    for ab, name in TEAMS.items():
        w = wikitext(f"{season} {name} season"); time.sleep(0.35)
        if w is None: rows.append(dict(season=season, team=ab, head_coach=None, oc=None, dc=None, qb_coach=None, rb_coach=None, notes="no page")); continue
        hc = grab(w, "Head coach"); oc = grab(w, "Offensive coordinator"); dc = grab(w, "Defensive coordinator"); qb = grab(w, "Quarterbacks"); rb = grab(w, "Running backs")
        notes = []
        for m in re.finditer(r"(fired|relieved|promoted|named|hired|replaced|interim)[^.\n]{0,80}(offensive|defensive) coordinator[^.\n]{0,80}", w, flags=re.I): notes.append(clean(m.group(0))[:140])
        rows.append(dict(season=season, team=ab, head_coach=hc, oc=oc, dc=dc, qb_coach=qb, rb_coach=rb, notes=" | ".join(dict.fromkeys(notes))[:600]))
    print(f"{season}: {sum(1 for r in rows if r['season']==season and r['oc'])}/32 with an OC")
C = pd.DataFrame(rows); C.to_csv("data/coaching_staff.csv", index=False)
pd.set_option("display.width", 220); print(C[["season","team","head_coach","oc","dc"]].to_string(index=False)); print("\nwrote data/coaching_staff.csv")
