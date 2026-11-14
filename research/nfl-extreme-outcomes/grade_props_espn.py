#!/usr/bin/env python3
"""Same-day grade of the Player Prop Report reads (nfl_prop_narratives) and the prop model projections
(nfl_prop_model_preds) against ESPN box scores for every FINAL game of the week.

Why this exists: the standing grader (grade_nfl_prop_narratives.py) reads nfl_player_props, which is
graded from nflverse logs overnight. The owner asks "how did we do" on Sunday afternoon. This grades
what is final NOW and leaves the rest null; the overnight grader fills whatever is left (it only touches
result IS NULL rows, and the values are the same box score).

Rules: a read/projection is graded only if its game is FINAL on ESPN. A player with no box-score line
in a final game gets 0 for counting markets (receptions, yards, TDs) — that is what the sportsbook
grades too unless the book voided a DNP, which we mark 'dnp' when the player has no stats at all.
A projection's side = sign(pred - line). Push on the number.

Usage: grade_props_espn.py SEASON WEEK [--write]   (--write patches nfl_prop_narratives result/actual_value)"""
import sys, os, re, requests, pandas as pd, numpy as np
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, os.path.dirname(HERE))
import football_report_lib as lib
from espn_nfl_boxscores import load_week

env = lib.load_env(); H = lib.hdr(env)
SEASON, WEEK = int(sys.argv[1]), int(sys.argv[2]); WRITE = "--write" in sys.argv
SUF = re.compile(r"\s+(jr|sr|ii|iii|iv|v)\.?$", re.I)
nn = lambda s: SUF.sub("", str(s).lower()).replace(".", "").replace("'", "").replace("-", " ").strip()

def fetch(table, params):
    j = requests.get(f"{lib.SUPA}/{table}?{params}", headers=H, timeout=60).json(); return j if isinstance(j, list) else []

box, ev = load_week(SEASON, WEEK)
final_teams = set(ev[ev.final].away) | set(ev[ev.final].home)
print(f"final games: {int(ev.final.sum())} of {len(ev)} | teams final: {sorted(final_teams)}")
if not len(box): sys.exit("no final games yet")
box["key"] = box.player_name.map(nn)
by_gsis = box.dropna(subset=["gsis_id"]).set_index("gsis_id"); by_name = box.set_index(["key", "team"])

def actual(pid, name, team, market):
    """actual for a market; (None, 'pending') if the game is not final, (None,'dnp') if no line at all."""
    if team not in final_teams: return None, "pending"
    r = None
    if pid is not None and str(pid) in by_gsis.index: r = by_gsis.loc[str(pid)]
    elif (nn(name), team) in by_name.index: r = by_name.loc[(nn(name), team)]
    if r is None: return None, "dnp"
    if isinstance(r, pd.DataFrame): r = r.iloc[0]
    return float(r.get(market, 0.0) or 0.0), "ok"

def grade(a, line, side):
    if a == line: return "push"
    return "win" if (a > line) == (side == "over") else "loss"

# ---------- Player Prop Report reads ----------
reads = pd.DataFrame(fetch("nfl_prop_narratives", f"select=id,player_id,player_name,team,opp,market,line,direction,result,actual_value,n_for,n_against,score&season=eq.{SEASON}&week=eq.{WEEK}"))
out = []
for r in reads.itertuples():
    a, st = actual(r.player_id, r.player_name, r.team, r.market)
    res = grade(a, float(r.line), r.direction) if st == "ok" else st
    out.append(dict(player=r.player_name, team=r.team, opp=r.opp, market=r.market.replace("player_", ""), line=r.line, read=r.direction, actual=a, result=res, tells=f"{r.n_for}-{r.n_against}"))
    if WRITE and st == "ok" and r.result is None:
        requests.patch(f"{lib.SUPA}/nfl_prop_narratives?id=eq.{requests.utils.quote(r.id, safe='')}", headers=H,
                       json={"actual_value": a, "result": res, "graded_at": "now()"}, timeout=30)
R = pd.DataFrame(out)
print("\n=== Player Prop Report reads ===")
print(R.to_string(index=False))
g = R[R.result.isin(["win", "loss", "push"])]
print(f"graded {len(g)}: {int((g.result=='win').sum())}-{int((g.result=='loss').sum())}-{int((g.result=='push').sum())} | pending {int((R.result=='pending').sum())} | dnp {int((R.result=='dnp').sum())}")

# ---------- Model projections ----------
preds = pd.DataFrame(fetch("nfl_prop_model_preds", f"select=player_id,player_name,team,opp,position,market,line,pred,edge,threshold,tier,fires&season=eq.{SEASON}&week=eq.{WEEK}&limit=5000"))
rows = []
for r in preds.itertuples():
    a, st = actual(r.player_id, r.player_name, r.team, r.market)
    side = "over" if float(r.pred) > float(r.line) else "under"
    rows.append(dict(player=r.player_name, team=r.team, opp=r.opp, market=r.market.replace("player_", ""), line=float(r.line), pred=round(float(r.pred), 1),
                     edge=round(float(r.edge), 1), tier=r.tier, fires=bool(r.fires), side=side, actual=a, status=st,
                     result=grade(a, float(r.line), side) if st == "ok" else st,
                     abs_err_model=abs(float(r.pred) - a) if st == "ok" else np.nan, abs_err_line=abs(float(r.line) - a) if st == "ok" else np.nan))
P = pd.DataFrame(rows)
G = P[P.status == "ok"]
print(f"\n=== Model projections === {len(P)} rows | graded {len(G)} | pending {int((P.status=='pending').sum())} | dnp {int((P.status=='dnp').sum())}")
def rec(d): return f"{int((d.result=='win').sum())}-{int((d.result=='loss').sum())}-{int((d.result=='push').sum())}"
def hit(d):
    w, l = (d.result == "win").sum(), (d.result == "loss").sum(); return f"{100*w/(w+l):.0f}%" if w + l else "-"
print("\nFIRES (the projections the report treats as a signal):")
F = G[G.fires]
print(F.sort_values(["market", "edge"], key=lambda s: s if s.name != "edge" else -s.abs()).to_string(index=False, columns=["player", "team", "opp", "market", "line", "pred", "edge", "side", "actual", "result"]))
print(f"  fires: {rec(F)} ({hit(F)})")
print("\nby market (fires):")
print(F.groupby("market").apply(lambda d: pd.Series(dict(n=len(d), record=rec(d), hit=hit(d), mae_model=round(d.abs_err_model.mean(), 1), mae_line=round(d.abs_err_line.mean(), 1)))).to_string())
print("\nALL graded rows by market (fires + non-fires) — does the projection beat the line as a number?")
print(G.groupby("market").apply(lambda d: pd.Series(dict(n=len(d), side_record=rec(d), side_hit=hit(d), mae_model=round(d.abs_err_model.mean(), 1), mae_line=round(d.abs_err_line.mean(), 1),
                                                          model_closer=f"{100*(d.abs_err_model < d.abs_err_line).mean():.0f}%"))).to_string())
P.to_csv(os.path.join(HERE, "out", f"prop_projection_grades_{SEASON}_wk{WEEK}.csv"), index=False)
R.to_csv(os.path.join(HERE, "out", f"prop_report_grades_{SEASON}_wk{WEEK}.csv"), index=False)
