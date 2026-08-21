"""SHARP ACTION signals (NFL spreads) — live detector, owner-approved 2026-08-19.

Two SEPARATE signals (different windows, different records — SHARP_ACTION_VERDICT.md):
  sharp_action_1to3d : detected 24-72h before kickoff  -> 58.2% ATS (n=47), close follows 79%
  sharp_action_6h    : detected <= 6h before kickoff    -> 60.0% / +14.5% (n=45), close follows 94%
Detection at the LATEST capture = LEAD (BetOnline/LowVig median >= 0.5 off the all-book
consensus) AND STEAM (consensus moved >= 0.5 vs the prior capture with >= 3 books moving
the same way), both pointing the same side. Graded at the DETECTION line (grade_line =
'detection'). NFL only — CFB failed the same backtest at both windows (47% / 50%).
Runs after every live_odds.py capture; one flag per (game, signal), never re-fired.
"""
import datetime as dt
import json
import os
import statistics
import sys

import requests

HERE = os.path.dirname(os.path.abspath(__file__))
SUPA = "https://jpxnjuwglavsjbgbasnl.supabase.co/rest/v1"
SHARP = {"betonlineag", "lowvig"}
FULL2CITY = {"Los Angeles Chargers": "LA Chargers", "Los Angeles Rams": "LA Rams",
             "New York Giants": "NY Giants", "New York Jets": "NY Jets"}
SIGNALS = {  # key: (lo_hrs, hi_hrs, conviction, stake, record_text, clv_text)
    "sharp_action_1to3d": (24, 72, "T3", 1.0, "58% ATS", "79%"),
    "sharp_action_6h": (0, 6, "T2", 1.0, "60% ATS / +14.5%", "94%"),
}


def to_city(full):
    return FULL2CITY.get(full, " ".join(full.split()[:-1]))


def _key():
    for line in open(os.path.join(HERE, "..", "..", ".env.local")):
        if line.startswith("SUPABASE_SERVICE_KEY="):
            return line.split("=", 1)[1].strip()
    return os.environ.get("SUPABASE_SERVICE_KEY") or sys.exit("no SUPABASE_SERVICE_KEY")


def detect_game(rows):
    """rows: odds rows for one game (snap_ts, book, spread_home). -> (side, line, n_moved) or None."""
    by_snap = {}
    for r in rows:
        if r.get("spread_home") is None:
            continue
        by_snap.setdefault(r["snap_ts"], {})[r["book"]] = float(r["spread_home"])
    snaps = sorted(by_snap)
    if len(snaps) < 2:
        return None
    cur, prev = by_snap[snaps[-1]], by_snap[snaps[-2]]
    if len(cur) < 4:
        return None
    all_med = statistics.median(cur.values())
    sharp = [v for b, v in cur.items() if b in SHARP]
    if not sharp:
        return None
    gap = statistics.median(sharp) - all_med
    lead = "HOME" if gap <= -0.5 else "AWAY" if gap >= 0.5 else None
    prev_med = statistics.median(prev.values())
    mv = all_med - prev_med
    n_dn = sum(1 for b, v in cur.items() if b in prev and v - prev[b] <= -0.5)
    n_up = sum(1 for b, v in cur.items() if b in prev and v - prev[b] >= 0.5)
    steam = "HOME" if (mv <= -0.5 and n_dn >= 3) else "AWAY" if (mv >= 0.5 and n_up >= 3) else None
    if lead and lead == steam:
        return lead, all_med, (n_dn if lead == "HOME" else n_up)
    return None


def run(now=None):
    now = now or dt.datetime.now(dt.timezone.utc)
    sk = _key()
    hdr = {"apikey": sk, "Authorization": f"Bearer {sk}", "Content-Type": "application/json"}
    g = requests.get(f"{SUPA}/nfl_dryrun_games", headers=hdr, timeout=30, params={
        "select": "game_id,season,week,home_team,away_team,home_ab,away_ab,kickoff,flags_active",
        "kickoff": f"gt.{now.isoformat()}", "order": "kickoff", "limit": 40})
    games = g.json() if g.ok else []
    fired = 0
    for gm in games:
        ko = dt.datetime.fromisoformat(gm["kickoff"].replace("Z", "+00:00"))
        hrs = (ko - now).total_seconds() / 3600
        key = next((k for k, (lo, hi, *_) in SIGNALS.items() if lo < hrs <= hi), None)
        if not key:
            continue
        ex = requests.get(f"{SUPA}/nfl_dryrun_flags?game_id=eq.{gm['game_id']}&signal_key=eq.{key}&select=id",
                          headers=hdr, timeout=30)
        if ex.ok and ex.json():
            continue
        city = to_city(gm["home_team"])
        lo_t = (ko - dt.timedelta(hours=12)).isoformat()
        hi_t = (ko + dt.timedelta(hours=12)).isoformat()
        o = requests.get(f"{SUPA}/nfl_historical_odds", headers=hdr, timeout=60, params={
            "season": f"eq.{gm['season']}", "home_team": f"eq.{city}",
            "and": f"(commence_time.gte.{lo_t},commence_time.lte.{hi_t})",
            "spread_home": "not.is.null", "select": "snap_ts,book,spread_home",
            "order": "snap_ts.desc", "limit": 4000})
        det = detect_game(o.json() if o.ok else [])
        if not det:
            continue
        side, home_line, n_moved = det
        lo, hi, conv, stake, rec, clv = SIGNALS[key]
        team = gm["home_team"] if side == "HOME" else gm["away_team"]
        ab = gm.get("home_ab") if side == "HOME" else gm.get("away_ab")
        line = home_line if side == "HOME" else -home_line
        when = "midweek, 1-3 days out" if key == "sharp_action_1to3d" else "inside 6 hours of kickoff"
        row = {"game_id": gm["game_id"], "season": gm["season"], "week": gm["week"],
               "game": f"{gm['away_team']} @ {gm['home_team']}", "market": "spread",
               "side": f"{ab or team} {line:+g}",          # NFL flag convention: "KC -3"
               "line": round(line, 1), "price": -110, "edge": None,
               "conviction": conv, "tier": "active", "stake_units": stake, "grade_line": "detection",
               "mammoth": False, "signal_key": key, "bet_team": team, "bet_direction": None,
               "bet_line": round(line, 1),
               "source": f"SHARP ACTION ({when}): BetOnline/LowVig lead the market and {n_moved} books "
                         f"just moved to {team} {line:+.1f} — the close follows {clv} of the time; {rec} historically"}
        ins = requests.post(f"{SUPA}/nfl_dryrun_flags", headers={**hdr, "Prefer": "return=minimal"}, json=row, timeout=30)
        if ins.ok:
            fired += 1
            requests.patch(f"{SUPA}/nfl_dryrun_games?game_id=eq.{gm['game_id']}", headers=hdr,
                           json={"flags_active": int(gm.get("flags_active") or 0) + 1}, timeout=30)
            print(f"[sharp-action] {key}: {team} {line:+.1f}")
    print(f"[sharp-action] checked {len(games)} upcoming games, fired {fired}")


if __name__ == "__main__":
    run()
