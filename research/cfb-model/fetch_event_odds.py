"""
EVENT-ODDS puller — team_totals + 1H markets (spreads_h1, totals_h1, h2h_h1), The Odds API HISTORICAL
event endpoint (10cr x 4 markets x 1 region per event-snapshot). FULL MODE: --year YYYY pulls every
model_games FBS game that season at 3 snapshots: T-72h (open proxy), T-24h, T-2h (close) = 120cr/game.
Resumable manifest per year; pre-game only by construction. Output: data/event_odds/events_<year>.parquet
Usage: python3 fetch_event_odds.py --year 2024 [--go]
"""
import os, sys, json, time
import requests
import pandas as pd

HERE = os.path.dirname(os.path.abspath(__file__))
OUTD = os.path.join(HERE, "data", "event_odds"); os.makedirs(OUTD, exist_ok=True)
MARKETS = "team_totals,spreads_h1,totals_h1,h2h_h1"
BASE = "https://api.the-odds-api.com/v4/historical/sports/americanfootball_ncaaf"
SNAPS = [("h72", 72), ("h24", 24), ("h2", 2)]
FLOOR = 50000   # stop if credits remaining drops below

def key():
    for fn in (".env.local", ".env"):
        p = os.path.join(HERE, "..", "..", fn)
        if os.path.exists(p):
            for ln in open(p):
                for name in ("ODDS_API_KEY", "VITE_THE_ODDS_API_KEY"):
                    if ln.startswith(name + "="): return ln.strip().split("=", 1)[1]
    raise RuntimeError("no key")
KEY = key()
YEAR = int(sys.argv[sys.argv.index("--year") + 1]) if "--year" in sys.argv else 2024

gm = pd.read_parquet(os.path.join(HERE, "data", "model_games.parquet"))
cfbd = sorted(set(gm.homeTeam) | set(gm.awayTeam))
ALIAS = {"Appalachian State Mountaineers": "App State", "Hawaii Rainbow Warriors": "Hawai'i",
         "UMass Minutemen": "Massachusetts", "San Jose State Spartans": "San José State",
         "Southern Miss Golden Eagles": "Southern Miss"}
def to_db(o):
    if o in ALIAS: return ALIAS[o]
    c = [x for x in cfbd if o.startswith(x + " ") or o == x]; c.sort(key=len, reverse=True)
    return c[0] if c else None

gg = pd.read_parquet(os.path.join(HERE, "data", "cfbd", f"games_{YEAR}.parquet"))
fb = gm[gm.season == YEAR][["game_id", "homeTeam", "awayTeam"]]
slate = fb.merge(gg[["id", "startDate"]], left_on="game_id", right_on="id")
slate["kick"] = pd.to_datetime(slate.startDate, utc=True)
slate["day"] = slate.kick.dt.strftime("%Y-%m-%d")
ncalls = len(slate) * len(SNAPS)
print(f"{YEAR}: {len(slate)} games x {len(SNAPS)} snaps = {ncalls} calls ~ {ncalls*40 + slate.day.nunique()} credits")
if "--go" not in sys.argv:
    print("dry-run. add --go."); sys.exit(0)

mp = os.path.join(OUTD, f"manifest_{YEAR}.json")
man = json.load(open(mp)) if os.path.exists(mp) else {"events": {}, "done": {}}
outp = os.path.join(OUTD, f"events_{YEAR}.parquet")
rows = pd.read_parquet(outp).to_dict("records") if os.path.exists(outp) else []
sess = requests.Session(); remaining = None; nsave = 0

for day in sorted(slate.day.unique()):
    if day in man["events"]: continue
    r = sess.get(f"{BASE}/events", params={"apiKey": KEY, "date": f"{day}T12:00:00Z"})
    r.raise_for_status(); man["events"][day] = r.json().get("data", [])
    json.dump(man, open(mp, "w")); time.sleep(0.25)
ev_map = {}
for day, evs in man["events"].items():
    for e in evs:
        h, a = to_db(e["home_team"]), to_db(e["away_team"])
        if h and a: ev_map[(h, a)] = e["id"]

for _, g in slate.iterrows():
    eid = ev_map.get((g.homeTeam, g.awayTeam))
    for tag, hrs in SNAPS:
        kid = f"{g.game_id}_{tag}"
        if kid in man["done"]: continue
        if not eid: man["done"][kid] = "no_event"; continue
        snap = (g.kick - pd.Timedelta(hours=hrs)).strftime("%Y-%m-%dT%H:%M:%SZ")
        r = sess.get(f"{BASE}/events/{eid}/odds",
                     params={"apiKey": KEY, "date": snap, "regions": "us", "markets": MARKETS, "oddsFormat": "american"})
        remaining = r.headers.get("x-requests-remaining", remaining)
        if remaining and float(remaining) < FLOOR:
            print(f"FLOOR hit ({remaining}) — stopping"); json.dump(man, open(mp, "w"))
            pd.DataFrame(rows).to_parquet(outp, index=False); sys.exit(1)
        if r.status_code != 200:
            man["done"][kid] = f"err{r.status_code}"
        else:
            for bk in r.json().get("data", {}).get("bookmakers", []):
                for mkt in bk.get("markets", []):
                    for o in mkt.get("outcomes", []):
                        rows.append({"season": YEAR, "game_id": g.game_id, "home": g.homeTeam, "away": g.awayTeam,
                                     "snap_tag": tag, "snap": snap, "book": bk["key"], "market": mkt["key"],
                                     "name": o.get("name"), "description": o.get("description"),
                                     "price": o.get("price"), "point": o.get("point")})
            man["done"][kid] = "ok"
        nsave += 1
        if nsave % 50 == 0:
            json.dump(man, open(mp, "w")); pd.DataFrame(rows).to_parquet(outp, index=False)
        time.sleep(0.3)
json.dump(man, open(mp, "w")); pd.DataFrame(rows).to_parquet(outp, index=False)
ok = sum(1 for v in man["done"].values() if v == "ok")
print(f"{YEAR} done: {ok} snap-pulls ok / {len(man['done'])} | rows {len(rows)} | credits remaining {remaining}")
