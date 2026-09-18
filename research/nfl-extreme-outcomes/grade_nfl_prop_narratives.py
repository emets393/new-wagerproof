#!/usr/bin/env python3
"""Grade the Player Prop Report reads the same way every other prop card is graded: the actual
number vs the posted line, after the game. Source of truth for actuals = nfl_player_props
(graded by the props RPC in run_grade_rpcs.py from the nflverse player logs), matched on
player name + team + market + week. A read is 'win' when the actual landed on the side the
numbers pointed, 'loss' the other way, 'push' on the number. Idempotent; runs in grade_week.sh.
Usage: grade_nfl_prop_narratives.py [season]"""
import os, re, sys, datetime as dt, pandas as pd, requests
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, os.path.dirname(HERE)); import football_report_lib as lib
env = lib.load_env(); H = lib.hdr(env); SEASON = int(sys.argv[1]) if len(sys.argv) > 1 else int(os.environ.get("NFL_SEASON", 2026))
def fetch(table, params):
    j = requests.get(f"{lib.SUPA}/{table}?{params}", headers=H, timeout=60).json(); return j if isinstance(j, list) else []
SUF = re.compile(r"\s+(jr|sr|ii|iii|iv|v)\.?$", re.I); nn = lambda s: SUF.sub("", str(s).lower()).replace(".", "").replace("'", "").replace("-", " ").strip()
AB = {"LA": "LAR", "LAR": "LAR"}
rows = fetch("nfl_prop_narratives", f"select=id,week,player_name,team,market,line,direction,kickoff&season=eq.{SEASON}&result=is.null")
now = dt.datetime.now(dt.timezone.utc).strftime("%Y-%m-%dT%H:%M:%S")
rows = [r for r in rows if r.get("kickoff") and str(r["kickoff"])[:19] < now]
if not rows: print("nothing to grade"); sys.exit(0)
weeks = sorted({r["week"] for r in rows})
acts = pd.DataFrame(fetch("nfl_player_props", f"select=week,player_name,team,market,actual_value&season=eq.{SEASON}&week=in.({','.join(map(str, weeks))})&actual_value=not.is.null&limit=20000"))
if not len(acts): print("no graded props yet"); sys.exit(0)
acts["key"] = acts.player_name.map(nn); acts["team"] = acts.team.map(lambda a: AB.get(str(a), str(a)))
act = acts.groupby(["week","key","team","market"]).actual_value.first()
n = 0
for r in rows:
    k = (r["week"], nn(r["player_name"]), AB.get(str(r["team"]), str(r["team"])), r["market"])
    if k not in act.index: continue
    a = float(act[k]); line = float(r["line"]); res = "push" if a == line else ("win" if (a > line) == (r["direction"] == "over") else "loss")
    x = requests.patch(f"{lib.SUPA}/nfl_prop_narratives?id=eq.{requests.utils.quote(r['id'], safe='')}", headers=H, json={"actual_value": a, "result": res, "graded_at": "now()"}, timeout=30); n += x.status_code in (200, 204)
    print(f"  wk{r['week']} {r['player_name']:24s} {r['market'].replace('player_',''):16s} {line:g} -> {r['direction']:5s} actual {a:g} = {res}")
print(f"graded {n} of {len(rows)} kicked-off reads")
