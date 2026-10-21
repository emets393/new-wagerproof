#!/usr/bin/env python3
"""Pick the legacy prediction a game was actually bettable on: the newest run published at
least LEGACY_PRED_CUTOFF_HOURS before THAT game's kickoff.

Owner 2026-10-21: "the legacy model needs to run everyday and the final run needs to be hours
before the kickoff of that game."

Scheduling alone cannot deliver that, and this is the part that is easy to get wrong. One
prediction run scores the WHOLE board, but the board kicks across five windows (Thu night,
Sun 09:30, Sun 13:00, Sun 16:05/16:25, Sun 20:20, Mon night). A pass placed 3.6h before the
4pm games is 0.5h before the 1pm games, and a pass placed before Sunday night is hours AFTER
both. So "hours before kickoff" is a per-game property of the ROW you read, not of the cron.

Measured on 2026 wk6 before this existed -- HOU@JAX, the London game, kickoff Sun 13:30Z:

    Sat 10-17 14:31Z  prob 0.440   T-23.0h   <- last pregame run, nearly a day stale
    Sun 10-18 14:31Z  prob 0.382   T +1.0h   *** AFTER KICKOFF ***
    Mon 10-19 14:31Z  prob 0.387   T+25.0h   *** AFTER THE GAME FINISHED ***

forecast_harness.load_legacy() takes the NEWEST row per unique_id, so that game's legacy
signal triggered off a prediction written a day after it ended. Not a hypothetical: the
predictor has no kickoff filter, and resolve_upcoming_week() keeps a week on the board until
its LAST gameday, so every Sunday game gets re-scored on Monday.

⛔ This does NOT touch nfl_predict_with_epa.py. The legacy model keeps running exactly as it
did last season -- same features, same seed, same tables. Every run is still written. This
only decides which already-written row a consumer is allowed to read.

⚠ The cutoff applies where a kickoff is KNOWN. nfl_slate_games holds 2026 only, so historical
backtests keep the existing newest-row behaviour and their graded records do not move.
"""
import datetime as dt
import os
import sys

import pandas as pd
import requests

HERE = os.path.dirname(os.path.abspath(__file__))
SUPA = "https://jpxnjuwglavsjbgbasnl.supabase.co/rest/v1"

# 2h, not 3h: the Sunday 14:30Z pass is T-2.5h for the 13:00 ET games and is the freshest
# legitimately-pregame run they get. A 3h cutoff would discard it and fall all the way back
# to Saturday (T-26.5h), which is the staleness this is meant to remove.
CUTOFF_H = float(os.environ.get("LEGACY_PRED_CUTOFF_HOURS", "2"))


def _key():
    k = os.environ.get("SUPABASE_SERVICE_KEY")
    if k:
        return k
    env = os.path.join(HERE, "..", "..", ".env.local")
    if os.path.exists(env):
        for ln in open(env):
            if ln.startswith("SUPABASE_SERVICE_KEY="):
                return ln.split("=", 1)[1].strip()
    raise RuntimeError("no SUPABASE_SERVICE_KEY")


def _get(table, params):
    k = _key()
    h = {"apikey": k, "Authorization": f"Bearer {k}"}
    out, off = [], 0
    while True:
        r = requests.get(f"{SUPA}/{table}?{params}&limit=1000&offset={off}", headers=h, timeout=60)
        if r.status_code != 200:
            # ⛔ Never swallow into an empty list: a 400 on a missing column reads exactly like
            # "no rows", which is how a populated slate got reported as empty on 2026-10-08.
            raise RuntimeError(f"{table} query failed ({r.status_code}): {r.text[:200]}")
        rows = r.json()
        out += rows
        if len(rows) < 1000:
            return out
        off += 1000


def team_abbrev():
    """{prediction-table team name -> slate abbreviation}.

    nfl_predictions_epa stores team_mapping's `team_name` ("Houston", "NY Giants"), but a
    dozen real xgb_epa_v1 rows carry the FULL name ("Arizona Cardinals"), so a strict map
    silently drops those games. Both spellings are registered.
    """
    tm = pd.read_parquet(os.path.join(HERE, "data", "team_mapping.parquet"))
    m = {}
    # zip rather than itertuples: "Team Abbrev" has a space, which itertuples renames.
    for abbr, short, full in zip(tm["Team Abbrev"], tm["team_name"], tm["city_and_name"]):
        a = {"LAR": "LA"}.get(abbr, abbr)
        m[str(short).strip()] = a
        m[str(full).strip()] = a
    return m


def kickoffs():
    """{(season, week, home_ab, away_ab) -> kickoff UTC}. 2026+ only (nfl_slate_games)."""
    out = {}
    for g in _get("nfl_slate_games", "select=season,week,home_ab,away_ab,kickoff"):
        if not g.get("kickoff"):
            continue
        try:
            k = dt.datetime.fromisoformat(str(g["kickoff"]).replace("Z", "+00:00"))
        except ValueError:
            continue
        out[(int(g["season"]), int(g["week"]), g["home_ab"], g["away_ab"])] = k
    return out


def apply_pregame_cutoff(leg: pd.DataFrame, cutoff_hours: float | None = None,
                         verbose: bool = True) -> pd.DataFrame:
    """Reduce an append-only legacy frame to ONE row per unique_id.

    `leg` needs: unique_id, season, week, home_team, away_team, as_of_ts.
    Where the kickoff is known, keep the newest row at or before kickoff - cutoff.
    Where it is not (historical seasons), keep the newest row — today's behaviour.
    """
    cut = CUTOFF_H if cutoff_hours is None else float(cutoff_hours)
    if leg is None or not len(leg):
        return leg
    leg = leg.copy()
    # A null unique_id cannot be joined or grouped meaningfully and otherwise shows up as a
    # phantom "[nan]" game in the fallback warning below.
    leg = leg[leg["unique_id"].notna()]
    if not len(leg):
        return leg
    leg["as_of_ts"] = pd.to_datetime(leg["as_of_ts"], errors="coerce", utc=True)

    try:
        kicks, ab = kickoffs(), team_abbrev()
    except Exception as e:
        # Fail SOFT and loudly. A dead lookup must not silently turn the cutoff off.
        print(f"  ! legacy kickoff lookup failed ({e}); keeping newest row per game")
        return leg.sort_values("as_of_ts").groupby("unique_id", as_index=False).last()

    def kick_for(r):
        try:
            h = ab.get(str(r.home_team).strip())
            a = ab.get(str(r.away_team).strip())
            return kicks.get((int(r.season), int(r.week), h, a))
        except (TypeError, ValueError):
            return None

    leg["_kick"] = [kick_for(r) for r in leg.itertuples(index=False)]
    leg["_kick"] = pd.to_datetime(leg["_kick"], errors="coerce", utc=True)
    known = leg["_kick"].notna()

    # Eligible = published at least `cut` hours before that game's own kickoff.
    deadline = leg["_kick"] - pd.to_timedelta(cut, unit="h")
    eligible = (~known) | (leg["as_of_ts"] <= deadline)

    keep = leg[eligible].sort_values("as_of_ts").groupby("unique_id", as_index=False).last()

    # A game whose every run landed inside the cutoff would vanish entirely, which would
    # silently disable its signals. Fall back to that game's newest row and say so.
    missing = set(leg.unique_id) - set(keep.unique_id)
    if missing:
        fb = (leg[leg.unique_id.isin(missing)]
              .sort_values("as_of_ts").groupby("unique_id", as_index=False).last())
        print(f"  ! {len(missing)} game(s) had NO run >= {cut:g}h before kickoff; "
              f"using newest anyway: {sorted(missing)[:4]}")
        keep = pd.concat([keep, fb], ignore_index=True)

    if verbose and known.any():
        lead = (keep["_kick"] - keep["as_of_ts"]).dt.total_seconds() / 3600
        lead = lead.dropna()
        if len(lead):
            print(f"[legacy] cutoff {cut:g}h: {len(lead)} game(s) with a known kickoff, "
                  f"lead time min {lead.min():.1f}h / median {lead.median():.1f}h "
                  f"/ max {lead.max():.1f}h; {(~known).sum()} row(s) had no kickoff (kept newest)")
    return keep.drop(columns=["_kick"], errors="ignore")
