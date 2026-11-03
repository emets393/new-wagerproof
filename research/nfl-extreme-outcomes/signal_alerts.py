#!/usr/bin/env python3
"""Push a notification the moment a MAMMOTH or a LEGACY FADE lands on the board.

Owner 2026-11-03: "we had a late fade alert in the NFL this weekend, it happened out of
nowhere and no one knew until the last second... can we use an existing app trigger so we
don't have to push another app build?"

Yes. Nothing here is new app surface. The shipping apps already handle an APNs broadcast and
already read `userInfo["route"]` (ios AppDelegate.swift:75, default "feed"), and MAIN already
runs the whole send pipeline on pg_cron EVERY MINUTE:

    INSERT push_broadcasts (status='queued')
      -> cron 'push-broadcast-tick'  (* * * * *)  materialize_push_broadcast_recipients -> 'sending'
      -> cron 'push-broadcast-drain' (* * * * *)  POST process-push-broadcast -> APNs

So ONE INSERT is the whole trigger, and it lands on phones inside ~2 minutes. No build, no
deploy, no admin JWT: materialize_push_broadcast_recipients is SECURITY DEFINER and granted to
service_role, and the tick calls it for any 'queued' row regardless of who inserted it.

WHY THE DETECTOR READS THE MODEL AND NOT THE FLAG TABLE
-------------------------------------------------------
The wk8 fade (MIA +7) is the whole argument. Its legacy probability sat on the 0.20 line for
six days and crossed it SIX times:

    Tue 0.2123  no   Wed 0.1956  FADE   Thu 0.1594 FADE   Thu 0.1394 FADE
    Fri 0.2120  no   Sat 0.1670  FADE   Sun 0.1639 FADE   Sun 0.2125 no   Sun 0.1844 FADE

It first qualified WEDNESDAY, 103 hours out. nfl_slate_flags did not carry it until Saturday
14:08 UTC. Reading nfl_predictions_epa directly (the same independence legacy_fade_watch.py
argues for in its own docstring) is what buys the early warning -- and it means a harness that
holds a flag cannot also silence the alert.

DEDUPE, AND WHY IT IS NOT A NEW TABLE
-------------------------------------
That same flicker is an alert-fatigue bomb: six crossings = six pushes to 224 people. So each
alert carries an `alert_key` in push_broadcasts.extra_data (a jsonb column that ALREADY exists,
default '{}') and we refuse to insert a key that is already there. Keyed on the GAME and the
signal, never the side, so a signal that drops out and comes back stays at exactly one push.
No DDL, which also means this ships without a migration.

COHERENCE GATE -- do not notify about a card the app contradicts
----------------------------------------------------------------
Checked live on 2026-11-03 and it caught a real one: Georgia State +5 carried conviction
'mammoth' / is_mammoth / 5.0 units while its own recommendation read "No Bet", because the line
moved 4.5 -> 5, the spread edge went to 15.3 and tripped the >14 no-play cap, which main's
gen_cfb_picks applies to the recommendation but not to the tier (PR #209 fixes the ordering).
Pushing that to 224 phones would have advertised a 5-unit play the app itself calls No Bet, so
a mammoth whose own card has no play is SKIPPED and reported, never sent.

USAGE
    python3 signal_alerts.py                  # dry run: print what it WOULD send, send nothing
    python3 signal_alerts.py --send           # actually insert the broadcast row(s)
    python3 signal_alerts.py --season 2026 --week 9

Read-only by default and exits 0 when it finds nothing, so it can sit at the end of an existing
cron chain (nfl-slate-refresh / cfb-slate-refresh already chain legacy_fade_watch.py the same way).
"""
import argparse
import datetime as dt
import json
import os
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

import requests

HERE = os.path.dirname(os.path.abspath(__file__))
CFB_REST = "https://jpxnjuwglavsjbgbasnl.supabase.co/rest/v1"
MAIN_REF = "gnjrklxotmbvnxbnnqgq"

# Owner 2026-11-03, verbatim: "the Alert emoji and it says either MAMMOTH ALERT with the
# Mammoth emoji or alert emoji and NFL LEGACY FADE ALERT and then the pick". So the title is
# the banner and the body is the PICK AND NOTHING ELSE -- no units, no matchup, no kick time.
# Both fit inside the table's CHECK (title <= 65 chars, body <= 240).
TITLE_MAMMOTH = "🚨🦣 MAMMOTH ALERT"
TITLE_FADE = "🚨 NFL LEGACY FADE ALERT"

FADE_HI, FADE_LO = 0.80, 0.20      # forecast_harness.py
MIN_WEEK = 4                       # the fade rule is undefined before week 4
PRIMETIME_ET = 19                  # primetime is the FOLLOW rule, not the fade
MAX_ALERTS_PER_RUN = 3             # a blast radius, so a bad board cannot spam the base
MAX_DAYS_OUT = 8                   # do not alert on a game a week and a half away


# --------------------------------------------------------------------------- creds
def _env():
    p = Path(HERE).parent.parent / ".env.local"
    if p.exists():
        for ln in p.read_text().splitlines():
            if "=" in ln and not ln.strip().startswith("#"):
                k, v = ln.split("=", 1)
                os.environ.setdefault(k.strip(), v.strip().strip('"').strip("'"))


def cfb_get(table, params):
    k = os.environ.get("SUPABASE_SERVICE_KEY")
    if not k:
        sys.exit("[alerts] no SUPABASE_SERVICE_KEY")
    h = {"apikey": k, "Authorization": f"Bearer {k}"}
    out, off = [], 0
    while True:
        r = requests.get(f"{CFB_REST}/{table}?{params}&limit=1000&offset={off}",
                         headers=h, timeout=60)
        if r.status_code != 200:
            # Never swallow a 400 into "no rows" -- that is how a populated slate gets
            # reported as empty and an alert silently never fires.
            sys.exit(f"[alerts] {table} failed ({r.status_code}): {r.text[:200]}")
        rows = r.json()
        out += rows
        if len(rows) < 1000:
            return out
        off += 1000


def main_sql(query, tries=4):
    """MAIN lives on a different project than the slate, so writes go through the
    Management API -- the same path research/competition already uses for MAIN."""
    pat = os.environ.get("SUPABASE_PAT")
    if not pat:
        sys.exit("[alerts] no SUPABASE_PAT (needed to reach MAIN)")
    for i in range(tries):
        req = urllib.request.Request(
            f"https://api.supabase.com/v1/projects/{MAIN_REF}/database/query",
            data=json.dumps({"query": query}).encode(),
            headers={"Authorization": f"Bearer {pat}", "User-Agent": "SupabaseCLI/1.0",
                     "Content-Type": "application/json"}, method="POST")
        try:
            with urllib.request.urlopen(req, timeout=60) as r:
                return json.loads(r.read())
        except urllib.error.HTTPError as e:
            body = e.read().decode()[:400]
            if e.code == 544 and i < tries - 1:     # Management API rate limit
                time.sleep(12 * (i + 1))
                continue
            sys.exit(f"[alerts] MAIN sql {e.code}: {body}")
    return []


def q(s):
    return "'" + str(s).replace("'", "''") + "'"


# --------------------------------------------------------------------------- helpers
def et(ts):
    if not ts:
        return None
    try:
        d = dt.datetime.fromisoformat(str(ts).replace("Z", "+00:00"))
    except ValueError:
        return None
    return d - dt.timedelta(hours=4 if 3 <= d.month <= 10 else 5)


def kick_label(ts):
    e = et(ts)
    return e.strftime("%a %-I:%M%p ET").replace("AM", "am").replace("PM", "pm") if e else "TBD"


def upcoming(ts, now):
    """True if the game has not kicked and is not absurdly far out."""
    d = None
    if ts:
        try:
            d = dt.datetime.fromisoformat(str(ts).replace("Z", "+00:00"))
        except ValueError:
            d = None
    if d is None:
        return False
    return now < d < now + dt.timedelta(days=MAX_DAYS_OUT)


# --------------------------------------------------------------------------- detectors
def cfb_mammoths(season, week, now, skips):
    """A CFB mammoth, gated on its own spread card actually carrying a play."""
    games = {g["game_id"]: g for g in cfb_get(
        "cfb_slate_games",
        f"season=eq.{season}&week=eq.{week}&mammoth=is.true"
        f"&select=game_id,away_team,home_team,kickoff,stake_units")}
    if not games:
        return []
    picks = cfb_get("cfb_slate_picks",
                    f"season=eq.{season}&week=eq.{week}&is_mammoth=is.true"
                    f"&select=game_id,bet_type,pick_label,recommendation,has_play,stake_units")
    out = []
    for p in picks:
        g = games.get(p["game_id"])
        if not g or not upcoming(g.get("kickoff"), now):
            continue
        label, rec = p.get("pick_label"), str(p.get("recommendation") or "")
        # The coherence gate. A mammoth tier whose own card has no play is a data defect,
        # not a pick -- say so loudly and do not put it on 224 phones.
        if not label or not p.get("has_play") or rec.lower().startswith("no bet"):
            skips.append({
                "msg": (f"CFB {g['away_team']} @ {g['home_team']}: tier=mammoth but the "
                        f"{p.get('bet_type')} card reads {rec!r} / "
                        f"has_play={p.get('has_play')} / label={label!r} -- NOT sent"),
                "alert_key": f"cfb:{season}:w{week}:{p['game_id']}:mammoth",
                "title": TITLE_MAMMOTH, "body": label or "(no pick on the card)",
                "sport": "cfb", "season": season, "week": week,
                "game_id": str(p["game_id"]), "signal": "mammoth"})
            continue
        out.append({
            "alert_key": f"cfb:{season}:w{week}:{p['game_id']}:mammoth",
            "title": TITLE_MAMMOTH,
            "body": label,
            "sport": "cfb", "season": season, "week": week,
            "game_id": str(p["game_id"]), "signal": "mammoth",
            "kickoff": g.get("kickoff"),
        })
    return out


def nfl_mammoths(season, week, now, skips):
    games = cfb_get("nfl_slate_games",
                    f"season=eq.{season}&week=eq.{week}&mammoth=is.true"
                    f"&select=game_id,away_team,home_team,away_ab,home_ab,kickoff,"
                    f"stake_units,conviction_tier,fg_spread_pick,fg_total_pick")
    out = []
    for g in games:
        if not upcoming(g.get("kickoff"), now):
            continue
        pick = g.get("fg_spread_pick") or g.get("fg_total_pick")
        if not pick:
            skips.append({
                "msg": (f"NFL {g.get('away_ab')} @ {g.get('home_ab')}: mammoth with no "
                        f"spread or total pick -- NOT sent"),
                "alert_key": f"nfl:{season}:w{week}:{g['game_id']}:mammoth",
                "title": TITLE_MAMMOTH, "body": "(no pick on the card)",
                "sport": "nfl", "season": season, "week": week,
                "game_id": str(g["game_id"]), "signal": "mammoth"})
            continue
        out.append({
            "alert_key": f"nfl:{season}:w{week}:{g['game_id']}:mammoth",
            "title": TITLE_MAMMOTH,
            "body": pick,
            "sport": "nfl", "season": season, "week": week,
            "game_id": str(g["game_id"]), "signal": "mammoth",
            "kickoff": g.get("kickoff"),
        })
    return out


def nfl_legacy_fades(season, week, now, skips):
    """The fade, computed from the model rather than inherited from nfl_slate_flags.

    Deliberately independent: see the module docstring on wk8 MIA. A fade the harness has
    not written yet still alerts, and a stale flag cannot manufacture one.
    """
    if week < MIN_WEEK:
        return []
    preds = cfb_get("nfl_predictions_epa",
                    f"season=eq.{season}&week=eq.{week}"
                    f"&select=unique_id,home_team,away_team,home_away_spread_cover_prob,as_of_ts")
    if not preds:
        skips.append({"msg": f"NFL wk{week}: no rows in nfl_predictions_epa -- the legacy "
                             f"cron has not landed this week, so the fade cannot be evaluated"})
        return []
    import pandas as pd
    from legacy_pred import apply_pregame_cutoff
    df = pd.DataFrame(preds)
    df["season"], df["week"] = season, week
    df = apply_pregame_cutoff(df, verbose=False)

    games = cfb_get("nfl_slate_games",
                    f"season=eq.{season}&week=eq.{week}"
                    f"&select=game_id,home_team,away_team,away_ab,home_ab,kickoff,fg_spread_close")
    by_home = {g["home_team"]: g for g in games}
    from legacy_pred import team_abbrev
    ab = team_abbrev()
    by_ab = {}
    for g in games:
        by_ab[g.get("home_ab")] = g

    out = []
    for r in df.to_dict("records"):
        pr = r.get("home_away_spread_cover_prob")
        if pr is None:
            continue
        pr = float(pr)
        if FADE_LO < pr < FADE_HI:
            continue
        g = by_ab.get(ab.get(r["home_team"])) or by_home.get(r["home_team"])
        if not g or not upcoming(g.get("kickoff"), now):
            continue
        e = et(g.get("kickoff"))
        if e and e.hour >= PRIMETIME_ET:
            continue                                  # primetime = follow, not fade
        # prob high -> the legacy model loves HOME -> BET AWAY, and vice versa. The line is
        # quoted from the side we are betting, so it reads the way a bettor says it.
        sp = g.get("fg_spread_close")
        if pr >= FADE_HI:
            team, line = g.get("away_ab"), (None if sp is None else -float(sp))
        else:
            team, line = g.get("home_ab"), (None if sp is None else float(sp))
        pick = team if line is None else f"{team} {line:+g}"
        out.append({
            "alert_key": f"nfl:{season}:w{week}:{g['game_id']}:legacy_fade",
            "title": TITLE_FADE,
            "body": pick,
            "sport": "nfl", "season": season, "week": week,
            "game_id": str(g["game_id"]), "signal": "legacy_fade",
            "kickoff": g.get("kickoff"),
        })
    return out


# --------------------------------------------------------------------------- send
def already_sent(keys):
    if not keys:
        return set()
    lst = ", ".join(q(k) for k in keys)
    rows = main_sql(f"select extra_data->>'alert_key' as k from push_broadcasts "
                    f"where extra_data->>'alert_key' in ({lst})")
    return {r["k"] for r in rows if r.get("k")}


def insert_alert(a, seed=False):
    """One INSERT. The per-minute tick materializes recipients and the drain sends it.

    seed=True writes the row as 'canceled' instead of 'queued' -- a TOMBSTONE. Nothing is
    sent (tick only promotes 'scheduled' and materializes 'queued', so a canceled row is
    inert), but the alert_key is now on record, so already_sent() will suppress this signal
    forever. That is how a signal already on the board gets silenced without a push.
    """
    extra = json.dumps({**{k: a[k] for k in
                           ("alert_key", "sport", "season", "week", "game_id", "signal")},
                        **({"seeded": True,
                            "reason": "already on the board when alerts were switched on; "
                                      "users already knew about it"} if seed else {})})
    rows = main_sql(
        "insert into push_broadcasts "
        "  (title, body, deep_link_route, extra_data, target_platforms, "
        "   target_subscription, status) "
        f"values ({q(a['title'][:65])}, {q(a['body'][:240])}, 'feed', {q(extra)}::jsonb, "
        f"   array['ios','android']::text[], 'all', {q('canceled' if seed else 'queued')}) "
        "returning id, title, status")
    return rows[0] if rows else None


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--season", type=int)
    ap.add_argument("--week", type=int)
    ap.add_argument("--send", action="store_true",
                    help="actually insert the broadcast (default is a dry run)")
    ap.add_argument("--test", choices=["fade", "mammoth"],
                    help="send a clearly-marked TEST alert to verify the pipeline end to end. "
                         "Bypasses detection and dedupe; carries no pick. Needs --send.")
    ap.add_argument("--seed", action="store_true",
                    help="SILENCE everything currently qualifying without notifying anyone. "
                         "Run this ONCE before switching alerts on, so the base is not pushed "
                         "signals it has already seen. Only future ones then fire.")
    ap.add_argument("--sport", choices=["nfl", "cfb", "both"], default="both")
    args = ap.parse_args()
    _env()
    now = dt.datetime.now(dt.timezone.utc)

    if args.test:
        # Marked in the TITLE, not just the body: a notification is often read as one glanced
        # line, and a real-looking fade banner would have people hunting a pick that is not there.
        base = TITLE_FADE if args.test == "fade" else TITLE_MAMMOTH
        a = {"alert_key": f"test:{now:%Y%m%dT%H%M%S}:{args.test}",
             "title": f"{base} (TEST)",
             "body": ("This is only a test — there is no pick here. Real alerts will name the "
                      "pick, like “MIA +7”."),
             "sport": "test", "season": 0, "week": 0,
             "game_id": "test", "signal": f"test_{args.test}"}
        print(f"  {'SEND' if args.send else 'WOULD SEND'}  TEST alert")
        print(f"    title: {a['title']}")
        print(f"    body : {a['body']}")
        if args.send:
            row = insert_alert(a)
            print(f"    -> push_broadcasts {row}  (tick picks it up within ~60s)")
        else:
            print("\n[alerts] dry run. Add --send to actually notify.")
        return

    found, skips = [], []
    if args.sport in ("nfl", "both"):
        s = args.season or int(os.environ.get("NFL_SEASON", 0) or 0)
        w = args.week or int(os.environ.get("NFL_WEEK", 0) or 0)
        if not (s and w):
            lt = cfb_get("nfl_slate_games", "select=season,week&order=season.desc,week.desc&limit=1")
            if lt:
                s, w = int(lt[0]["season"]), int(lt[0]["week"])
        if s and w:
            print(f"[alerts] NFL {s} wk{w}")
            found += nfl_mammoths(s, w, now, skips)
            found += nfl_legacy_fades(s, w, now, skips)

    if args.sport in ("cfb", "both"):
        s = args.season or 0
        w = args.week or 0
        if not (s and w):
            lt = cfb_get("cfb_slate_games", "select=season,week&order=season.desc,week.desc&limit=1")
            if lt:
                s, w = int(lt[0]["season"]), int(lt[0]["week"])
        if s and w:
            print(f"[alerts] CFB {s} wk{w}")
            found += cfb_mammoths(s, w, now, skips)

    for m in skips:
        print(f"  ⛔ SKIP  {m['msg']}")

    # --seed silences what is already on the board. It covers the coherence-gate skips too:
    # Georgia State is an EXISTING mammoth, so the owner's "users already know about those"
    # applies to it whether or not its card is currently coherent.
    if args.seed:
        cand = found + [s for s in skips if s.get("alert_key")]
        if not cand:
            print("[alerts] nothing on the board to silence.")
            return
        have = already_sent([c["alert_key"] for c in cand])
        todo = [c for c in cand if c["alert_key"] not in have]
        for c in cand:
            if c["alert_key"] in have:
                print(f"  · already on record: {c['alert_key']}")
        if not todo:
            print("[alerts] every current signal is already on record. Nothing to do.")
            return
        print(f"\n[alerts] SILENCING {len(todo)} signal(s) already on the board. "
              f"No notification is sent for any of them.")
        for c in todo:
            print(f"    {c['alert_key']}  ({c['title']} | {c['body']})")
            if args.send:
                insert_alert(c, seed=True)
        print("\n[alerts] " + ("done — these will never alert; only NEW signals will."
                               if args.send else
                               "dry run. Re-run with --seed --send to write the tombstones."))
        return

    if not found:
        print("[alerts] nothing to alert on.")
        return

    sent_keys = already_sent([a["alert_key"] for a in found])
    fresh = [a for a in found if a["alert_key"] not in sent_keys]
    for a in found:
        if a["alert_key"] in sent_keys:
            print(f"  · already notified: {a['alert_key']}")

    if not fresh:
        print("[alerts] every qualifying signal has already been notified.")
        return

    fresh.sort(key=lambda a: a.get("kickoff") or "")
    if len(fresh) > MAX_ALERTS_PER_RUN:
        print(f"  ⛔ {len(fresh)} new alerts exceeds the {MAX_ALERTS_PER_RUN}-per-run cap. "
              f"Refusing to send -- this looks like a board defect, not a slate. "
              f"Re-run with a narrower --sport/--week after checking.")
        for a in fresh:
            print(f"      {a['title']} | {a['body']}")
        return

    for a in fresh:
        print(f"\n  {'SEND' if args.send else 'WOULD SEND'}  [{a['alert_key']}]")
        print(f"    title: {a['title']}")
        print(f"    body : {a['body']}")
        if args.send:
            row = insert_alert(a)
            print(f"    -> push_broadcasts {row}  (tick picks it up within ~60s)")

    if not args.send:
        print("\n[alerts] dry run. Re-run with --send to actually notify.")


if __name__ == "__main__":
    main()
