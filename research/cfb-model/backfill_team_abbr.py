"""Backfill official team abbreviations from CFBD /teams into cfb_team_mapping.abbreviation (join on
'api id' = CFBD id, fallback school name = 'api'), and sync cfb_teams.abbr. Reports FBS gaps."""
import os, json, requests, warnings
import dry_common as C
warnings.filterwarnings("ignore")

def cfbd_key():
    for ln in open(os.path.join(os.path.dirname(__file__), "..", "..", ".env.local")):
        if ln.startswith("CFBD_API_KEY="): return ln.strip().split("=", 1)[1]
    raise RuntimeError("no cfbd key")
teams = requests.get("https://api.collegefootballdata.com/teams",
                     headers={"Authorization": f"Bearer {cfbd_key()}"}).json()
id2ab = {t["id"]: t.get("abbreviation") for t in teams if t.get("abbreviation")}
school2ab = {t["school"]: t.get("abbreviation") for t in teams if t.get("abbreviation")}

# read mapping rows (PostgREST handles spaced cols; reference as "api id")
rows = requests.get(f'{C.URL}/rest/v1/cfb_team_mapping?select=*', headers={**C.H, "Prefer": ""}).json()
print(f"cfb_team_mapping rows: {len(rows)}")
def ab_for(r):
    aid = r.get("api id")
    if aid in id2ab: return id2ab[aid]
    if r.get("api") in school2ab: return school2ab[r["api"]]
    return None
upd = miss = 0; fbs_gaps = []
for r in rows:
    ab = ab_for(r)
    if not ab:
        miss += 1
        if r.get("league") not in ("FCS", "OTHER", None): fbs_gaps.append(r.get("api"))
        continue
    aid = r.get("api id")
    rr = requests.patch(f'{C.URL}/rest/v1/cfb_team_mapping?{requests.utils.quote("api id")}=eq.{aid}',
                        headers=C.H, data=json.dumps({"abbreviation": ab}))
    if rr.status_code < 300: upd += 1
print(f"abbreviations set: {upd} | no-abbr in CFBD: {miss} | FBS/P5 gaps: {fbs_gaps}")

# sync cfb_teams.abbr (team_name == mapping 'api')
ct = requests.get(f'{C.URL}/rest/v1/cfb_teams?select=team_name', headers={**C.H, "Prefer": ""}).json()
synced = 0
for t in ct:
    ab = school2ab.get(t["team_name"])
    if ab:
        requests.patch(f'{C.URL}/rest/v1/cfb_teams?team_name=eq.{requests.utils.quote(t["team_name"])}',
                       headers=C.H, data=json.dumps({"abbr": ab})); synced += 1
print(f"cfb_teams.abbr synced: {synced}/{len(ct)}")
