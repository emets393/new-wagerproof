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
# Scope to the players we are actually grading, then PAGE. `limit=20000` was a no-op: PostgREST
# caps a response at 10,000 rows however big the limit, and nfl_player_props holds a snapshot per
# book per refresh — 215k graded rows for one 2026 week. The old single GET took an arbitrary
# unordered 10k slice, so a read whose player happened to fall outside it silently never graded
# (2026 wk3 rebuild: 0 of 11 matched). Ordering makes the page walk deterministic.
_names = sorted({str(r["player_name"]) for r in rows})
_in = ",".join('"' + n.replace('"', '') + '"' for n in _names)
acts_rows, _off = [], 0
while True:
    _chunk = fetch("nfl_player_props",
                   f"select=week,player_name,team,market,actual_value&season=eq.{SEASON}"
                   f"&week=in.({','.join(map(str, weeks))})&player_name=in.({_in})"
                   f"&actual_value=not.is.null&order=week,player_name,market"
                   f"&limit=1000&offset={_off}")
    acts_rows += _chunk
    if len(_chunk) < 1000:
        break
    _off += 1000
acts = pd.DataFrame(acts_rows)
# Do NOT exit when this is empty: the remaining reads may all be DNPs, which still need
# voiding below. Exiting here left them pending forever.
if len(acts):
    acts["key"] = acts.player_name.map(nn); acts["team"] = acts.team.map(lambda a: AB.get(str(a), str(a)))
    act = acts.groupby(["week","key","team","market"]).actual_value.first()
else:
    print("no actuals for these reads yet — checking for DNPs only")
    act = pd.Series(dtype=float, index=pd.MultiIndex.from_tuples([], names=["week","key","team","market"]))
# DNP: the game was played but the player was not. Without this a scratched player's card
# sits result=NULL forever and quietly counts as "pending" (Puka Nacua, 2026 wk2 — hurt in
# wk1, Questionable/Doubtful/Out since, so his prop can never produce an actual). A DNP is a
# void, not a pending result, and `dnp` is the value the props grader already uses. The
# record queries count only win/loss, so a dnp correctly scores nothing either way.
played = {(int(g["week"]), nn(g["player_name"]))
          for g in fetch("nfl_player_game_logs",
                         f"select=week,player_name&season=eq.{SEASON}"
                         f"&week=in.({','.join(map(str, weeks))})&limit=10000")}
n = 0
for r in rows:
    k = (r["week"], nn(r["player_name"]), AB.get(str(r["team"]), str(r["team"])), r["market"])
    if k not in act.index:
        if played and (int(r["week"]), nn(r["player_name"])) not in played:
            requests.patch(f"{lib.SUPA}/nfl_prop_narratives?id=eq.{requests.utils.quote(r['id'], safe='')}",
                           headers=H, json={"result": "dnp", "graded_at": "now()"}, timeout=30)
            print(f"  wk{r['week']} {r['player_name']:24s} {r['market'].replace('player_',''):16s} DID NOT PLAY -> dnp (void)")
        continue
    a = float(act[k]); line = float(r["line"]); res = "push" if a == line else ("win" if (a > line) == (r["direction"] == "over") else "loss")
    x = requests.patch(f"{lib.SUPA}/nfl_prop_narratives?id=eq.{requests.utils.quote(r['id'], safe='')}", headers=H, json={"actual_value": a, "result": res, "graded_at": "now()"}, timeout=30); n += x.status_code in (200, 204)
    print(f"  wk{r['week']} {r['player_name']:24s} {r['market'].replace('player_',''):16s} {line:g} -> {r['direction']:5s} actual {a:g} = {res}")
print(f"graded {n} of {len(rows)} kicked-off reads")
