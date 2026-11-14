#!/usr/bin/env python3
"""ESPN box scores for one NFL week -> per-player prop-market actuals, same day the games end.

nflverse player logs (what run_grade_rpcs.py grades nfl_player_props from) land overnight; this pulls
ESPN's public summary endpoint for every FINAL game so reads and projections can be graded while the
slate is still in progress. Only final games are returned — a player missing from a final box score
is a zero line (or a DNP), never "unknown".

Usage: espn_nfl_boxscores.py SEASON WEEK      -> writes data/espn_box_{season}_wk{week}.parquet, prints a summary
Import: load_week(season, week) -> (box DataFrame, set of final ESPN event ids)
Columns: espn_id, gsis_id (via data/players_xwalk.parquet), player_name, team (our abbrevs), opp,
         event_id, and one column per market key (player_pass_yds, player_receptions, ...)."""
import sys, os, re, requests, pandas as pd

HERE = os.path.dirname(os.path.abspath(__file__))
SB = "https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard?seasontype=2&week={week}&dates={season}"
SUM = "https://site.api.espn.com/apis/site/v2/sports/football/nfl/summary?event={eid}"
TEAM = {"WSH": "WAS", "LAR": "LA"}   # ESPN -> our abbreviations (Odds API / nflverse)

def _num(s):
    try: return float(s)
    except Exception: return 0.0

def _split(s):   # '11/20' -> (11, 20)
    a, b = (str(s).split("/") + ["0"])[:2]; return _num(a), _num(b)

def final_events(season, week):
    d = requests.get(SB.format(season=season, week=week), timeout=30).json()
    out = []
    for e in d.get("events", []):
        c = e["competitions"][0]; st = c["status"]["type"]["name"]
        teams = {x["homeAway"]: TEAM.get(x["team"]["abbreviation"], x["team"]["abbreviation"]) for x in c["competitors"]}
        out.append(dict(event_id=e["id"], date=e["date"], away=teams["away"], home=teams["home"], status=st,
                        final=st == "STATUS_FINAL"))
    return pd.DataFrame(out)

def box_for_event(eid, away, home):
    d = requests.get(SUM.format(eid=eid), timeout=30).json()
    rows = {}
    for t in d.get("boxscore", {}).get("players", []):
        team = TEAM.get(t["team"]["abbreviation"], t["team"]["abbreviation"]); opp = home if team == away else away
        for cat in t.get("statistics", []):
            keys = cat.get("keys", []); name = cat["name"]
            for a in cat.get("athletes", []):
                pid = a["athlete"]["id"]; r = rows.setdefault(pid, dict(espn_id=pid, player_name=a["athlete"]["displayName"], team=team, opp=opp, event_id=eid))
                s = dict(zip(keys, a.get("stats", [])))
                if name == "passing":
                    c, att = _split(s.get("completions/passingAttempts", "0/0"))
                    r["player_pass_completions"] = c; r["player_pass_attempts"] = att
                    r["player_pass_yds"] = _num(s.get("passingYards")); r["player_pass_tds"] = _num(s.get("passingTouchdowns"))
                    r["player_pass_interceptions"] = _num(s.get("interceptions"))
                elif name == "rushing":
                    r["player_rush_attempts"] = _num(s.get("rushingAttempts")); r["player_rush_yds"] = _num(s.get("rushingYards"))
                    r["_rush_td"] = _num(s.get("rushingTouchdowns")); r["player_rush_longest"] = _num(s.get("longRushing"))
                elif name == "receiving":
                    r["player_receptions"] = _num(s.get("receptions")); r["player_reception_yds"] = _num(s.get("receivingYards"))
                    r["_rec_td"] = _num(s.get("receivingTouchdowns")); r["player_targets"] = _num(s.get("receivingTargets"))
                    r["player_reception_longest"] = _num(s.get("longReception"))
                elif name == "kickReturns": r["_kr_td"] = _num(s.get("kickReturnTouchdowns"))
                elif name == "puntReturns": r["_pr_td"] = _num(s.get("puntReturnTouchdowns"))
                elif name == "defensive": r["_def_td"] = _num(s.get("defensiveTouchdowns"))
                elif name == "interceptions": r["_int_td"] = _num(s.get("interceptionTouchdowns"))
    df = pd.DataFrame(list(rows.values()))
    if not len(df): return df
    for c in ["_rush_td", "_rec_td", "_kr_td", "_pr_td", "_def_td", "_int_td"]:
        if c not in df: df[c] = 0.0
    df = df.fillna({c: 0.0 for c in df.columns if c.startswith("player_") or c.startswith("_")})
    # anytime TD = any touchdown the player scores himself (passing TDs are the receiver's)
    df["player_anytime_td"] = df._rush_td + df._rec_td + df._kr_td + df._pr_td + df._def_td + df._int_td
    df["player_rush_reception_yds"] = df.get("player_rush_yds", 0) + df.get("player_reception_yds", 0)
    df["player_pass_rush_yds"] = df.get("player_pass_yds", 0) + df.get("player_rush_yds", 0)
    return df.drop(columns=[c for c in df.columns if c.startswith("_")])

def load_week(season, week):
    ev = final_events(season, week)
    fin = ev[ev.final]
    parts = [box_for_event(r.event_id, r.away, r.home) for r in fin.itertuples()]
    box = pd.concat([p for p in parts if len(p)], ignore_index=True) if parts else pd.DataFrame()
    if len(box):
        xw = pd.read_parquet(os.path.join(HERE, "data", "players_xwalk.parquet"))[["espn_id", "gsis_id"]].dropna()
        xw["espn_id"] = xw.espn_id.astype(float).astype(int).astype(str)
        box = box.merge(xw.drop_duplicates("espn_id"), on="espn_id", how="left")
    return box, ev

if __name__ == "__main__":
    season, week = int(sys.argv[1]), int(sys.argv[2])
    box, ev = load_week(season, week)
    print(ev[["event_id", "date", "away", "home", "status"]].to_string(index=False))
    out = os.path.join(HERE, "data", f"espn_box_{season}_wk{week}.parquet")
    if len(box):
        box.to_parquet(out, index=False)
        print(f"{len(box)} player lines from {ev.final.sum()} final games -> {out} | gsis matched {box.gsis_id.notna().mean():.0%}")
    else:
        print("no final games yet")
