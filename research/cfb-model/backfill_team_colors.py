"""Backfill cfb_teams.color/alt_color from CFBD /teams/fbs. Matches CFBD 'school' -> cfb_teams.team_name
(model_games naming) with a small alias map; reports any unmatched. Never prints keys."""
import os, json, requests, warnings
import dry_common as C
warnings.filterwarnings("ignore")

def cfbd_key():
    for ln in open(os.path.join(os.path.dirname(__file__), "..", "..", ".env.local")):
        if ln.startswith("CFBD_API_KEY="): return ln.strip().split("=", 1)[1]
    raise RuntimeError("no cfbd key")

r = requests.get("https://api.collegefootballdata.com/teams/fbs",
                 headers={"Authorization": f"Bearer {cfbd_key()}"}, params={"year": 2025})
r.raise_for_status()
teams = r.json()
# CFBD school -> our team_name; most match; a few naming diffs
ALIAS = {"App State": "Appalachian State", "Connecticut": "UConn", "Massachusetts": "UMass",
         "Louisiana Monroe": "UL Monroe", "Sam Houston State": "Sam Houston", "San José State": "San José State"}
existing = requests.get(f"{C.URL}/rest/v1/cfb_teams?select=team_name", headers={**C.H, "Prefer": ""}).json()
names = {t["team_name"] for t in existing}
rev = {v: k for k, v in ALIAS.items()}
def to_name(school):
    if school in names: return school
    if school in ALIAS and ALIAS[school] in names: return ALIAS[school]
    # reverse: our name might be the CFBD alt
    for n in names:
        if n == school: return n
    return None

matched, miss = 0, []
for t in teams:
    nm = to_name(t.get("school", ""))
    color, alt = t.get("color"), t.get("alt_color") or t.get("alternateColor")
    if not nm:
        miss.append(t.get("school")); continue
    if not color: continue
    rr = requests.patch(f"{C.URL}/rest/v1/cfb_teams?team_name=eq.{requests.utils.quote(nm)}",
                        headers=C.H, data=json.dumps({"color": color, "alt_color": alt}))
    if rr.status_code < 300: matched += 1
print(f"CFBD FBS teams: {len(teams)} | colors backfilled: {matched} | unmatched: {miss}")
chk = requests.get(f"{C.URL}/rest/v1/cfb_teams?select=team_name&color=is.null", headers={**C.H, "Prefer": ""}).json()
print(f"cfb_teams still missing color: {len(chk)} -> {[c['team_name'] for c in chk][:30]}")
