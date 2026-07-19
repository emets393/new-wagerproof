"""Opponent last-game mirror for nfl_analysis_base: opp_last_* = the opponent's own last_* values
(self-join on game_id). Adds 6 columns, merges, and extends the nfl_analysis RPC. See doc 05."""
import json, os, sys, urllib.request

REF = "jpxnjuwglavsjbgbasnl"
API = f"https://api.supabase.com/v1/projects/{REF}/database/query"
REST = f"https://{REF}.supabase.co/rest/v1"
PAT = os.environ["SUPABASE_PAT"]
SVC = [l.split("=", 1)[1].strip() for l in open("/Users/chrishabib/Documents/new-wagerproof/.env.local") if l.startswith("SUPABASE_SERVICE_KEY=")][0]

def q(sql):
    req = urllib.request.Request(API, data=json.dumps({"query": sql}).encode(), method="POST",
        headers={"Authorization": f"Bearer {PAT}", "Content-Type": "application/json", "User-Agent": "SupabaseCLI/1.0"})
    try: return json.load(urllib.request.urlopen(req, timeout=120))
    except urllib.error.HTTPError as e: sys.exit(f"Mgmt API {e.code}: {e.read().decode()[:400]}")

SRC = ["last_fg_won", "last_fg_covered", "last_ou_result", "last_is_favorite", "last_overtime", "last_margin"]
OPP = ["opp_last_fg_won", "opp_last_fg_covered", "opp_last_ou_result", "opp_last_is_favorite", "opp_last_overtime", "opp_last_margin"]
TYPES = {"opp_last_fg_won": "integer", "opp_last_fg_covered": "integer", "opp_last_ou_result": "integer",
         "opp_last_is_favorite": "boolean", "opp_last_overtime": "boolean", "opp_last_margin": "integer"}

hdr = {"apikey": SVC, "Authorization": f"Bearer {SVC}"}
rows, step = [], 1000
for off in range(0, 100000, step):
    sel = "game_id,team,opponent," + ",".join(SRC)
    page = json.load(urllib.request.urlopen(urllib.request.Request(f"{REST}/nfl_analysis_base?select={sel}&limit={step}&offset={off}", headers=hdr), timeout=60))
    rows += page
    if len(page) < step: break
print("base rows", len(rows))

idx = {(r["game_id"], r["team"]): r for r in rows}
merge, miss = [], 0
for r in rows:
    o = idx.get((r["game_id"], r["opponent"]))
    if o is None: miss += 1; continue
    rec = {"game_id": r["game_id"], "team": r["team"]}
    for s, d in zip(SRC, OPP): rec[d] = o[s]
    merge.append(rec)
print("merge rows", len(merge), "| missing opp row", miss)

q(" ".join(f"ALTER TABLE public.nfl_analysis_base ADD COLUMN IF NOT EXISTS {c} {TYPES[c]};" for c in OPP))
print("ALTER done")

def lit(v, typ):
    if v is None: return "NULL"
    if typ == "boolean": return "'true'" if v else "'false'"
    return f"'{int(v)}'"

setcl = ", ".join(f"{c} = v.{c}::{TYPES[c]}" for c in OPP)
collist = "game_id, team, " + ", ".join(OPP)
B = 400
for i in range(0, len(merge), B):
    vals = []
    for r in merge[i:i + B]:
        gid = str(r["game_id"]).replace("'", "''"); team = str(r["team"]).replace("'", "''")
        vals.append("(" + ", ".join([f"'{gid}'", f"'{team}'"] + [lit(r[c], TYPES[c]) for c in OPP]) + ")")
    q(f"UPDATE public.nfl_analysis_base b SET {setcl} FROM (VALUES {', '.join(vals)}) AS v({collist}) WHERE b.game_id = v.game_id::text AND b.team = v.team;")
    print("merged", min(i + B, len(merge)), end="\r")
print("\nmerge complete")

ANCHOR = "(p_filters->>'season_min' IS NULL OR b.season >= (p_filters->>'season_min')::int)"
body = q("select pg_get_functiondef('public.nfl_analysis(text,jsonb)'::regprocedure) as d")[0]["d"]
if "opp_last_won" in body:
    print("RPC already extended")
else:
    preds = [
        "(p_filters->>'opp_last_won' IS NULL OR b.opp_last_fg_won = (p_filters->>'opp_last_won')::int)",
        "(p_filters->>'opp_last_covered' IS NULL OR b.opp_last_fg_covered = (p_filters->>'opp_last_covered')::int)",
        "(p_filters->>'opp_last_over' IS NULL OR b.opp_last_ou_result = (p_filters->>'opp_last_over')::int)",
        "(p_filters->>'opp_last_favorite' IS NULL OR b.opp_last_is_favorite = (p_filters->>'opp_last_favorite')::boolean)",
        "(p_filters->>'opp_last_overtime' IS NULL OR b.opp_last_overtime = (p_filters->>'opp_last_overtime')::boolean)",
        "(p_filters->>'opp_last_blowout' IS NULL OR ((p_filters->>'opp_last_blowout')='win' AND b.opp_last_margin >= 21) OR ((p_filters->>'opp_last_blowout')='loss' AND b.opp_last_margin <= -21))",
    ]
    if body.count(ANCHOR) != 1: sys.exit(f"anchor found {body.count(ANCHOR)}x")
    block = preds[0] + "".join("\n    AND " + p for p in preds[1:])
    q(body.replace(ANCHOR, block + "\n    AND " + ANCHOR, 1))
    print("RPC extended +6 opp_last_* predicates")

o = lambda f: q(f"select (nfl_analysis('fg_total','{json.dumps(f)}'::jsonb)->'overall') o")[0]["o"]
print("PROBE baseline n =", o({})["n"])
for f in [{"opp_last_over": 1}, {"opp_last_over": 0}, {"opp_last_won": 1}, {"opp_last_blowout": "win"}, {"opp_last_favorite": True}]:
    print(" ", f, "-> n =", o(f)["n"])
