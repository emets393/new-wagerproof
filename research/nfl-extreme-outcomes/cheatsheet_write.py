#!/usr/bin/env python3
"""Build every cheat-sheet table and write nfl_prop_cheatsheet.

One row per (season, week, table_key, team). See the migration for the column contract and
cheatsheet_team.py for why the measures are productivity rather than yards.
"""
import argparse, json, sys, urllib.request
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import cheatsheet_team as CT
import prop_cheatsheet as PC

SUPA = "https://jpxnjuwglavsjbgbasnl.supabase.co/rest/v1"
TABLE = "nfl_prop_cheatsheet"

# table_key -> (family, side, headline measure, position filter, alignment filter, role tag)
TABLES = [
    ("rush_def_RB",   "rushing",   "defense", "success_rate",    "RB", None, "rb_rush"),
    ("rush_def_QB",   "rushing",   "defense", "success_rate",    "QB", None, "qb_rush"),
    ("rush_off",      "rushing",   "offense", "success_rate",    None, None, "rb_rush"),
    ("pass_def",      "passing",   "defense", "cpoe",            "QB", None, "qb_rush"),
    ("pass_off",      "passing",   "offense", "cpoe",            "QB", None, "qb_rush"),
    ("recv_def_WR",   "receiving", "defense", "yoe_per_target",  "WR", None, "wr"),
    ("recv_def_TE",   "receiving", "defense", "yoe_per_target",  "TE", None, "te"),
    ("recv_def_RB",   "receiving", "defense", "yoe_per_target",  "RB", None, "rb_recv"),
    ("recv_def_slot", "receiving", "defense", "slot_share",      None, "slot",   "slot"),
    ("recv_def_wide", "receiving", "defense", "wide_share",      None, "wide",   "wide"),
    ("recv_off",      "receiving", "offense", "yoe_per_target",  None, None, "wr"),
]


def league_block(M, cols):
    """{team: {measure: {actual, league, rank, of, lift}}} — rank 1 = highest value."""
    out = {}
    for c in cols:
        s = M[["team", c]].dropna()
        if s.empty:
            continue
        lg = float(s[c].mean())
        order = s.sort_values(c, ascending=False).reset_index(drop=True)
        n = len(order)
        for i, row in order.iterrows():
            out.setdefault(row["team"], {})[c] = dict(
                actual=float(row[c]), league=lg, rank=int(i) + 1, of=n,
                lift=(float(row[c]) / lg - 1) if lg else None)
    return out


def refresh_players(season, week, sched, board):
    """Re-resolve only `player` on existing rows. Measures are never touched."""
    k = PC.key()
    h = {"apikey": k, "Authorization": f"Bearer {k}"}
    r = urllib.request.Request(
        f"{SUPA}/{TABLE}?season=eq.{season}&week=eq.{week}"
        f"&select=id,table_key,side,team,opponent,player", headers=h)
    rows = json.load(urllib.request.urlopen(r, timeout=90))
    if not rows:
        print(f"[players] no cheat-sheet rows for {season} wk{week} — run the weekly build first")
        return
    role_of = {t[0]: t[6] for t in TABLES}
    hdr = {**h, "Content-Type": "application/json", "Prefer": "return=minimal"}
    changed = 0
    for row in rows:
        who_team = row["opponent"] if row["side"] == "defense" else row["team"]
        who = board.get((who_team, role_of.get(row["table_key"]))) if who_team else None
        new = (dict(name=who["name"], player_id=who["player_id"], position=who["position"],
                    share=who["share"], share_label=PC.ROLE_PICK[role_of[row["table_key"]]][3])
               if who else None)
        old = row.get("player")
        if (old or {}).get("player_id") == (new or {}).get("player_id"):
            continue
        q = urllib.request.Request(f"{SUPA}/{TABLE}?id=eq.{row['id']}",
                                   data=json.dumps({"player": new}).encode(),
                                   method="PATCH", headers=hdr)
        urllib.request.urlopen(q, timeout=60)
        changed += 1
    print(f"[players] {len(rows)} rows checked, {changed} player assignments changed")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--season", type=int, default=2026)
    ap.add_argument("--week", type=int, default=5)
    ap.add_argument("--write", action="store_true")
    # ⛔ THE TWO HALVES REFRESH ON DIFFERENT CLOCKS. The measures only move when games are
    # played, so a weekly build is right. The NAMED PLAYER depends on the injury report, which
    # lands daily through the week — a sheet built Tuesday would still be pointing readers at
    # someone ruled out on Friday, which is the one failure the owner called out by name.
    # So: --write rebuilds everything weekly, --players-only re-resolves just the player column
    # against today's report and leaves every measure untouched.
    ap.add_argument("--players-only", action="store_true",
                    help="daily: re-resolve the player column against today's injury report")
    a = ap.parse_args()

    pages, out_ids, out_names = PC.load(a.season, a.week)
    sched = PC.schedule(pages)
    board = PC.role_board(pages, out_ids, out_names)
    kick = {p["team"]: p.get("kickoff") for p in pages if p.get("team")}

    blocks = {}
    for side in ("offense", "defense"):
        M = CT.team_measures(a.season, a.week, side)
        cols = [c for c in M.columns if c not in ("team", "e_n")]
        blocks[side] = league_block(M, cols)

    if a.players_only:
        return refresh_players(a.season, a.week, sched, board)

    rows = []
    for key, fam, side, headline, posf, alignf, role in TABLES:
        for team, metrics in blocks[side].items():
            opp = sched.get(team)
            # defence rows name the OPPONENT's player; offence rows name their own
            who_team = opp if side == "defense" else team
            who = board.get((who_team, role)) if who_team else None
            rows.append(dict(
                season=a.season, week=a.week, family=fam, table_key=key,
                position_filter=posf, alignment_filter=alignf, side=side,
                team=team, opponent=opp, kickoff=kick.get(team),
                metrics=metrics, headline=headline,
                player=(dict(name=who["name"], player_id=who["player_id"],
                             position=who["position"], share=who["share"],
                             share_label=PC.ROLE_PICK[role][3]) if who else None)))

    print(f"{len(rows)} rows across {len(TABLES)} tables, "
          f"{sum(1 for r in rows if r['player'])} with a named player")
    if not a.write:
        print("dry run — pass --write"); return

    k = PC.key()
    hdr = {"apikey": k, "Authorization": f"Bearer {k}", "Content-Type": "application/json",
           "Prefer": "resolution=merge-duplicates,return=minimal"}
    d = urllib.request.Request(
        f"{SUPA}/{TABLE}?season=eq.{a.season}&week=eq.{a.week}", method="DELETE",
        headers={"apikey": k, "Authorization": f"Bearer {k}"})
    urllib.request.urlopen(d, timeout=90)
    ok = 0
    for i in range(0, len(rows), 200):
        chunk = rows[i:i + 200]
        r = urllib.request.Request(f"{SUPA}/{TABLE}", data=json.dumps(chunk, default=str).encode(),
                                   method="POST", headers=hdr)
        urllib.request.urlopen(r, timeout=120)
        ok += len(chunk)
    print(f"wrote {ok} rows")


if __name__ == "__main__":
    main()
