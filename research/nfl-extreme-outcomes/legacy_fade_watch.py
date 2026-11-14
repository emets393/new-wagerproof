#!/usr/bin/env python3
"""Is there a legacy fade this week? Answer it out loud, every run.

Owner 2026-10-08: "I just want to know when there's a fade." Today you cannot tell the difference
between "no game qualified" and "nothing ran" — both look like silence. legacy_fade has fired zero
times in 2026 while legacy_primetime (same input, same code path) has fired six: correct behaviour,
and indistinguishable from a dead signal.

So this prints a verdict on every run, including the boring one, with the distance to the trigger:

    [legacy-fade] 2026 wk5: NO FADE. Closest PHI @ JAX at 0.745 (needs >=0.800, short by 0.055).

THE RULE (forecast_harness.py, FADE_HI=0.80 / FADE_LO=0.20), week >= 4, NON-primetime:
    home_away_spread_cover_prob >= 0.80  -> the legacy model loves HOME -> BET AWAY
    home_away_spread_cover_prob <= 0.20  -> it loves AWAY               -> BET HOME

Computed from nfl_predictions_epa, NOT from the flags table, deliberately: that makes it an
independent check on the harness rather than a mirror of it. A qualifying game with no
nfl_slate_flags row is a real miss and gets called out.

Read-only, and exits 0 even when it finds nothing, so it can sit in a chain without taking it down.
"""
import datetime as dt
import os
import sys

import pandas as pd
import requests

HERE = os.path.dirname(os.path.abspath(__file__))
SUPA = "https://jpxnjuwglavsjbgbasnl.supabase.co/rest/v1"
FADE_HI, FADE_LO = 0.80, 0.20
MIN_WEEK = 4                 # the rule is undefined before week 4
PRIMETIME_ET = 19            # build.py: primetime = kick_hour_et >= 19


def key():
    k = os.environ.get("SUPABASE_SERVICE_KEY")
    if k:
        return k
    env = os.path.join(HERE, "..", "..", ".env.local")
    if os.path.exists(env):
        for ln in open(env):
            if ln.startswith("SUPABASE_SERVICE_KEY="):
                return ln.split("=", 1)[1].strip()
    sys.exit("[legacy-fade] no SUPABASE_SERVICE_KEY")


def get(table, params):
    k = key()
    h = {"apikey": k, "Authorization": f"Bearer {k}"}
    out, off = [], 0
    while True:
        r = requests.get(f"{SUPA}/{table}?{params}&limit=1000&offset={off}", headers=h, timeout=60)
        if r.status_code != 200:
            # ⛔ Never swallow this into an empty list. A 400 on a column that does not exist reads
            # exactly like "no rows", which is how a populated slate got reported as empty on
            # 2026-10-08. Fail loudly instead.
            sys.exit(f"[legacy-fade] {table} query failed ({r.status_code}): {r.text[:200]}")
        rows = r.json()
        out += rows
        if len(rows) < 1000:
            return out
        off += 1000


def team_abbrev():
    """One definition, in legacy_pred, read from Supabase rather than a gitignored parquet."""
    from legacy_pred import team_abbrev as _ta
    return _ta()


def et_hour(ts):
    """Kickoff hour in ET from a UTC timestamp (UTC-4 Mar-Oct, UTC-5 otherwise)."""
    if not ts:
        return None
    try:
        d = dt.datetime.fromisoformat(str(ts).replace("Z", "+00:00"))
    except ValueError:
        return None
    return (d.hour - (4 if 3 <= d.month <= 10 else 5)) % 24


def main():
    if len(sys.argv) > 2:
        season, week = int(sys.argv[1]), int(sys.argv[2])
    else:
        season = int(os.environ.get("NFL_SEASON", 0) or 0)
        week = int(os.environ.get("NFL_WEEK", 0) or 0)
    if not season or not week:
        latest = get("nfl_slate_games", "select=season,week&order=season.desc,week.desc&limit=1")
        if not latest:
            print("[legacy-fade] no slate rows — cannot resolve the week")
            return
        season, week = int(latest[0]["season"]), int(latest[0]["week"])
    hdr = f"[legacy-fade] {season} wk{week}:"

    if week < MIN_WEEK:
        print(f"{hdr} the rule starts at week {MIN_WEEK} — not evaluated")
        return

    preds = get("nfl_predictions_epa",
                f"season=eq.{season}&week=eq.{week}"
                f"&select=unique_id,home_team,away_team,home_away_spread_cover_prob,as_of_ts")
    if not preds:
        print(f"{hdr} ⛔ NO legacy predictions in nfl_predictions_epa. This signal is fed by the "
              f"legacy NFL cron — check nfl-predictions.")
        return
    # Several runs land per game. Take the newest that was published at least
    # LEGACY_PRED_CUTOFF_HOURS before THAT game's kickoff — the same row forecast_harness
    # triggers off (see legacy_pred.py). Checking a week already in progress would otherwise
    # read a post-kickoff run and report a "fade" nobody could have bet.
    import pandas as _pd
    from legacy_pred import apply_pregame_cutoff
    _df = _pd.DataFrame(preds)
    _df["season"], _df["week"] = season, week
    _df = apply_pregame_cutoff(_df, verbose=False)
    preds = [r for r in _df.to_dict("records") if r.get("home_away_spread_cover_prob") is not None]

    ab = team_abbrev()
    kicks = {g["home_ab"]: g.get("kickoff") for g in
             get("nfl_slate_games", f"season=eq.{season}&week=eq.{week}&select=home_ab,kickoff")}

    scored, skipped = [], 0
    for p in preds:
        h_ab = ab.get(p["home_team"])
        if h_ab is None:
            skipped += 1
            continue
        hr = et_hour(kicks.get(h_ab))
        if hr is not None and hr >= PRIMETIME_ET:
            continue                                  # primetime is the FOLLOW rule, not the fade
        scored.append((float(p["home_away_spread_cover_prob"]), p, h_ab))
    if skipped:
        print(f"{hdr} ⚠ {skipped} prediction(s) had an unrecognised team name and were skipped")
    if not scored:
        print(f"{hdr} no non-primetime games with a prediction")
        return

    flags = get("nfl_slate_flags",
                f"season=eq.{season}&week=eq.{week}&signal_key=eq.legacy_fade&select=game_id")
    # Distinguish "the harness ran and missed this" from "the harness never ran for this week".
    # nfl_slate_flags only carries 2026, so every historical week would otherwise report a miss.
    any_flags = bool(get("nfl_slate_flags",
                         f"season=eq.{season}&week=eq.{week}&select=game_id&limit=1"))
    fades = [(pr, p, "AWAY" if pr >= FADE_HI else "HOME")
             for pr, p, _ in scored if pr >= FADE_HI or pr <= FADE_LO]

    if fades:
        print(f"{hdr} ★ {len(fades)} FADE{'S' if len(fades) > 1 else ''} "
              f"(of {len(scored)} non-primetime games)")
        for pr, p, side in sorted(fades, key=lambda x: -abs(x[0] - 0.5)):
            bet = p["away_team"] if side == "AWAY" else p["home_team"]
            print(f"    {p['away_team']} @ {p['home_team']}   prob {pr:.3f}   ->  BET {bet} ({side})")
        if not any_flags:
            print(f"    (no nfl_slate_flags rows at all for this week — the harness has not run "
                  f"for it, so nothing is expected to be flagged)")
        elif len(flags) < len(fades):
            print(f"    ⛔ nfl_slate_flags carries only {len(flags)} of these. The harness did not "
                  f"write them all, so they will NOT reach the report or the game card.")
    else:
        pr, p, _ = max(scored, key=lambda x: abs(x[0] - 0.5))
        need, gap = ((f">={FADE_HI:.3f}", FADE_HI - pr) if pr >= 0.5
                     else (f"<={FADE_LO:.3f}", pr - FADE_LO))
        print(f"{hdr} NO FADE across {len(scored)} non-primetime games. Closest "
              f"{p['away_team']} @ {p['home_team']} at {pr:.3f} (needs {need}, "
              f"short by {abs(gap):.3f}).")
        if flags:
            print(f"    ⚠ but nfl_slate_flags carries {len(flags)} legacy_fade row(s) this week, "
                  f"which disagrees with the live predictions — one of them is stale.")


if __name__ == "__main__":
    main()
