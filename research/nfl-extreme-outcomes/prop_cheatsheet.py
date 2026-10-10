#!/usr/bin/env python3
"""The weekly player-prop cheat sheet — who has the best and worst matchup, by category.

Owner 2026-10-09: "a guide to easily see who is best and who is worst this week in different
categories ... for each of the tables where it's appropriate we show the player that this benefits
or hurts ... and we need to always look at the injury report so we don't show a player who is out."

Every table is the same shape: a DEFENCE, what it concedes, its rank out of 32, and the one
opponent player that lands on this week. Sortable on any column.

⛔ THE NAMED PLAYER IS THE WHOLE POINT AND THE EASIEST THING TO GET WRONG. Three rules:
  * he must be on the defence's ACTUAL week-5 opponent, not any team;
  * he must be the right ROLE for the table — the slot table names the slot man, not the WR1;
  * he must not be Out or Doubtful on this week's report. A cheat sheet that sends a reader to an
    inactive player is worse than no cheat sheet.

Usage: prop_cheatsheet.py [--season 2026] [--week 5]
"""
import argparse
import json
import os
import sys
import urllib.parse
import urllib.request
from pathlib import Path

HERE = Path(__file__).resolve().parent
SUPA = "https://jpxnjuwglavsjbgbasnl.supabase.co/rest/v1"
OUT_LIKE = {"Out", "Doubtful"}


def key():
    k = os.environ.get("SUPABASE_SERVICE_KEY")
    if k:
        return k
    env = HERE / ".." / ".." / ".env.local"
    for ln in env.read_text().splitlines():
        if ln.startswith("SUPABASE_SERVICE_KEY="):
            return ln.split("=", 1)[1].strip().strip('"')
    sys.exit("no SUPABASE_SERVICE_KEY")


def get(path, k, limit=1000):
    out, off = [], 0
    while True:
        u = f"{SUPA}/{path}&limit={limit}&offset={off}"
        r = urllib.request.Request(u, headers={"apikey": k, "Authorization": f"Bearer {k}"})
        with urllib.request.urlopen(r, timeout=90) as x:
            j = json.load(x)
        out += j
        if len(j) < limit:
            return out
        off += limit


def load(season, week):
    k = key()
    pages = get(f"nfl_prop_player_pages?season=eq.{season}&week=eq.{week}"
                f"&select=player_id,player_name,position,team,opponent,is_home,kickoff,"
                f"markets,fp_cards", k)
    inj = get(f"nfl_injuries_raw?season=eq.{season}&week=eq.{week}"
              f"&select=player_id,player_name,team,position,report_status", k)
    out = {str(r["player_id"]) for r in inj if r.get("report_status") in OUT_LIKE}
    out_names = {(r["player_name"], r["team"]) for r in inj if r.get("report_status") in OUT_LIKE}
    return pages, out, out_names


def schedule(pages):
    """team -> opponent for the week, from the page rows themselves."""
    s = {}
    for p in pages:
        if p.get("team") and p.get("opponent"):
            s[p["team"]] = p["opponent"]
    return s


# ── who on a team fills a given role, injury-filtered ────────────────────────────
# Owner 2026-10-09: name the team leader regardless of share. The share is printed beside him, so
# a 9% target-share tight end is visible as exactly that rather than hidden — the reader discounts
# it himself. Floors are kept only where a role is MEANINGLESS without one: an alignment table
# must not name someone who barely lines up there, and a "starting QB" at 20% snaps is a backup.
ROLE_PICK = {
    # table key -> (positions, share field, floor, label)
    "slot":      (("WR", "TE"), "align_slot_share",   0.30, "most slot routes"),
    "wide":      (("WR",),      "align_wide_share",   0.40, "most wide routes"),
    "inline":    (("TE",),      "align_inline_share", 0.30, "most inline routes"),
    "wr":        (("WR",),      "target_share",       0.0,  "WR1 by target share"),
    "te":        (("TE",),      "target_share",       0.0,  "TE1 by target share"),
    "rb_recv":   (("RB",),      "target_share",       0.0,  "pass-catching back"),
    "rb_rush":   (("RB",),      "carry_share",        0.0,  "lead back"),
    "qb_rush":   (("QB",),      "snap_share",         0.60, "starting QB"),
}


def role_board(pages, out_ids, out_names):
    """{(team, role): {name, position, share, …}} — the one player per team per role.

    Ranked on the role share, not on raw production: the slot table wants whoever actually lines
    up in the slot most, which is frequently not the best receiver on the team.
    """
    board = {}
    for p in pages:
        pid, team, pos = str(p.get("player_id")), p.get("team"), p.get("position")
        if not team or not pos:
            continue
        if pid in out_ids or (p.get("player_name"), team) in out_names:
            continue                                   # Out / Doubtful — never named
        role = ((p.get("fp_cards") or {}).get("role") or {})
        if not role:
            continue
        for tag, (positions, share_key, floor, _) in ROLE_PICK.items():
            if pos not in positions:
                continue
            v = role.get(share_key)
            if v is None or v < floor:
                continue
            # a slot/wide pick also needs real volume, or a 3-route cameo wins the row
            if tag in ("slot", "wide", "inline") and (role.get("routes_per_game") or 0) < 8:
                continue
            cur = board.get((team, tag))
            if cur is None or v > cur["share"]:
                board[(team, tag)] = dict(name=p["player_name"], position=pos, share=v,
                                          player_id=pid,
                                          routes=role.get("routes_per_game"),
                                          target_share=role.get("target_share"),
                                          carry_share=role.get("carry_share"))
    return board


def defence_rows(pages, measure_path, want_positions=None):
    """{defence: {actual, league, rank, of}} read off any page row that faced that defence.

    Every player page already carries the full allowance block for the defence he is facing, so
    the league-wide table can be assembled from the same rows the cards use — no second source,
    and therefore no chance of the cheat sheet and the card disagreeing.
    """
    out = {}
    for p in pages:
        if want_positions and p.get("position") not in want_positions:
            continue
        d = p.get("opponent")
        if not d or d in out:
            continue
        node = (p.get("fp_cards") or {})
        for step in measure_path[:-1]:
            node = (node or {}).get(step) or {}
        base = measure_path[-1]
        a, l = node.get(f"{base}_actual"), node.get(f"{base}_league")
        r, o = node.get(f"{base}_rank"), node.get(f"{base}_of")
        if a is None or not l:
            continue
        out[d] = dict(actual=a, league=l, rank=r, of=o, lift=a / l - 1)
    return out


def trench_table(pages, sched):
    """One row per team: how its line and the front it faces grade for rush and for pass."""
    tr = {}
    for p in pages:
        t = p.get("team")
        b = (p.get("fp_cards") or {}).get("trenches") or {}
        if not t or t in tr or not b.get("line"):
            continue
        tr[t] = b
    rows = []
    for t, b in tr.items():
        ln, fr = b.get("line") or {}, b.get("front") or {}
        rows.append(dict(
            team=t, opp=sched.get(t),
            pass_edge=b.get("pass_pro_edge"), run_edge=b.get("run_block_edge"),
            ol_press=ln.get("ol_pressure_faced"), ol_press_rank=ln.get("ol_pressure_faced_rank"),
            ol_ybc=ln.get("ol_ybc_per_att"), ol_ybc_rank=ln.get("ol_ybc_per_att_rank"),
            dl_press=fr.get("dl_pressure_generated"),
            dl_press_rank=fr.get("dl_pressure_generated_rank"),
            dl_ybc=fr.get("dl_ybc_allowed"), dl_ybc_rank=fr.get("dl_ybc_allowed_rank")))
    # ⛔ THE TWO EDGES ARE IN DIFFERENT UNITS and cannot be compared raw: pass is percentage
    # points of pressure, run is yards before contact. Put both on one signed scale so a reader
    # can see at a glance which phase is the better matchup.
    #
    # SIGN IS THE WHOLE POINT. Positive = the OFFENSIVE LINE has the advantage:
    #   pass: his line allows less pressure than average AND the rush it faces generates less
    #   run : his line opens more yards before contact than average AND the front concedes more
    # Negative means the front wins that phase. Zero is a neutral matchup, not a missing one.
    #
    # Scaled to standard deviations across the week times 10, so a typical board runs about
    # -25..+25 and a ±10 means "a bit better than average" in either phase.
    import statistics as st
    for fld, out in (("pass_edge", "pass_score"), ("run_edge", "run_score")):
        vals = [r[fld] for r in rows if r.get(fld) is not None]
        sd = st.pstdev(vals) if len(vals) > 1 else 0
        mu = st.fmean(vals) if vals else 0
        for r in rows:
            v = r.get(fld)
            r[out] = round((v - mu) / sd * 10) if (v is not None and sd) else None
    for r in rows:
        g = [r[k] for k in ("pass_score", "run_score") if r.get(k) is not None]
        r["overall"] = round(sum(g) / len(g)) if g else None
    return sorted(rows, key=lambda r: -(r["overall"] or -1))


def table(name, unit, defences, sched, board, role_tag, reverse=True, top=32):
    """A defence table with the opponent player it lands on."""
    rows = []
    for d, m in defences.items():
        opp = sched.get(d)
        who = board.get((opp, role_tag)) if opp else None
        rows.append(dict(defence=d, opp=opp, actual=m["actual"], league=m["league"],
                         lift=m["lift"], rank=m["rank"], of=m["of"],
                         player=who["name"] if who else None,
                         player_pos=who["position"] if who else None,
                         player_share=who["share"] if who else None))
    rows.sort(key=lambda r: -r["lift"] if reverse else r["lift"])
    return dict(name=name, unit=unit, role=ROLE_PICK[role_tag][3],
                floor=ROLE_PICK[role_tag][2], rows=rows[:top])


def build(season, week):
    pages, out_ids, out_names = load(season, week)
    sched = schedule(pages)
    board = role_board(pages, out_ids, out_names)
    T = {}
    T["trenches"] = trench_table(pages, sched)

    # receiving, by where he lines up
    for tag, role_tag, label in (("slot", "slot", "Slot receivers"),
                                 ("wide", "wide", "Outside receivers"),
                                 ("inline", "inline", "Inline tight ends")):
        d = defence_rows(pages, ["matchup", "vs_alignment", tag, "yds"])
        T[f"align_{tag}"] = table(f"{label} — yards allowed a game", "yds", d, sched, board,
                                  role_tag)

    # receiving, by position
    for pos, role_tag, label in (("WR", "wr", "Wide receivers"), ("TE", "te", "Tight ends"),
                                 ("RB", "rb_recv", "Running backs, receiving")):
        d = defence_rows(pages, ["matchup", "vs_position", "rec_yds"], want_positions=(pos,))
        T[f"recv_{pos}"] = table(f"{label} — receiving yards allowed a game", "yds", d, sched,
                                 board, role_tag)

    # rushing
    for pos, role_tag, label in (("RB", "rb_rush", "Running backs"),
                                 ("QB", "qb_rush", "Quarterbacks")):
        d = defence_rows(pages, ["matchup", "vs_position", "rush_yds"], want_positions=(pos,))
        T[f"rush_{pos}"] = table(f"{label} — rushing yards allowed a game", "yds", d, sched,
                                 board, role_tag)
    return T, len(pages), len(out_ids)


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--season", type=int, default=2026)
    ap.add_argument("--week", type=int, default=5)
    ap.add_argument("--json", action="store_true")
    a = ap.parse_args()
    T, n, nout = build(a.season, a.week)
    if a.json:
        print(json.dumps(T, indent=1, default=str)); sys.exit()

    print(f"\nPLAYER PROP CHEAT SHEET — {a.season} week {a.week}")
    print(f"{n} player pages, {nout} players Out or Doubtful and excluded from every named row\n")
    tr = T["trenches"]
    print("=" * 100)
    print("OFFENSIVE LINE MATCHUPS — one row per line, two signed scores.")
    print("POSITIVE = the offensive line has the advantage in that phase. NEGATIVE = the front does.")
    print("Zero is a neutral matchup. Sort on whichever phase you care about.")
    print()
    print(f"{'line':6s} {'opponent':10s} {'PASS':>6s} {'RUN':>6s} {'ovr':>6s}   "
          f"{'pass detail (pressure %)':30s} {'run detail (yds before contact)':32s}")
    print("-" * 100)
    for r in sorted(tr, key=lambda x: -(x.get("overall") or -99)):
        sg = lambda v: f"{v:+d}" if v is not None else "  —"
        pd_ = (f"allows {(r['ol_press'] or 0)*100:.1f}% vs rush {(r['dl_press'] or 0)*100:.1f}%")
        rd_ = (f"opens {(r['ol_ybc'] or 0):.2f} vs front giving {(r['dl_ybc'] or 0):.2f}")
        print(f"{r['team']:6s} {('at '+str(r['opp'] or '—')):10s} {sg(r['pass_score']):>6s} "
              f"{sg(r['run_score']):>6s} {sg(r['overall']):>6s}   {pd_:30s} {rd_:32s}")
    print()
    print("  Each score combines BOTH sides of that phase — how good his line is at the job and")
    print("  how good the front it faces is at stopping it, each against the league average.")

    for k, t in T.items():
        if k == "trenches":
            continue
        print("\n" + "=" * 96)
        print(f"{t['name'].upper()}   (named = {t['role']}, min {t['floor']*100:.0f}%, "
                  f"never Out or Doubtful)")
        print(f"{'def':5s} {'vs':5s} {'allows':>8s} {'league':>8s} {'vs lg':>7s} {'rank':>8s}   who it lands on")
        for r in t["rows"]:
            who = (f"{r['player']} ({r['player_pos']})" if r["player"]
                   else "— nobody clears the role floor")
            sh = f" {r['player_share']*100:.0f}%" if r.get("player_share") else ""
            print(f"{r['defence']:5s} {str(r['opp'] or '—'):5s} {r['actual']:8.1f} "
                  f"{r['league']:8.1f} {r['lift']*100:+6.1f}% "
                  f"{int(r['rank'] or 0):>3d}/{int(r['of'] or 0):<3d}  {who}{sh}")
