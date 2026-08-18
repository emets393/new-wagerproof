"""
Live PRE-GAME odds collector (CFB) — captures UPCOMING-game odds into ncaaf_odds_history.

The live counterpart to fetch_odds_history.py: same table, same FG markets (h2h/spreads/totals),
same game_id = Odds-API event id (no CFBD match needed), same pre-game rule. Uses the cheap BULK
/odds endpoint (one call returns all upcoming events + odds), so no per-event fan-out.

CADENCE (run every 15 min via Render — owner 2026-08-17): future-day games 3x/day (8/14/20 ET), today's games every hour,
PRE-GAME ONLY (any event with commence_time <= now is dropped — no live in-play lines). One bulk
call per run (~3 credits), so idle hours are cheap.

NOTE: CFB 1H + team-total odds ride the separate fetch_event_odds.py path — that still needs the
same upcoming + pre-game treatment for the live 1H/TT signals.

Run:  python3 live_odds_cfb.py [--write] [--force]
"""
import os
import sys
import time
import datetime as dt
from pathlib import Path
import requests

# Transient gateway errors (Supabase/Odds API 502/503/504) must not fail an idempotent
# hourly capture — a single 503 at 5am paged the owner (2026-08-14). Retries happen at
# the transport layer: 3 tries, 2s/4s/8s backoff. 500s and 4xx still raise immediately
# (a POST retried after a 500 could double-insert; gateway errors never reached the DB).
from requests.adapters import HTTPAdapter, Retry as _Retry
_retry_session = requests.Session()
_retry_session.mount("https://", HTTPAdapter(max_retries=_Retry(
    total=3, backoff_factor=2, status_forcelist=[502, 503, 504],
    allowed_methods=["GET", "POST"])))
requests = _retry_session  # module-level .get/.post now retry transparently

try:
    from zoneinfo import ZoneInfo
    ET = ZoneInfo("America/New_York")
except Exception:
    ET = dt.timezone(dt.timedelta(hours=-4))

ROOT = Path(__file__).resolve().parent
WRITE = "--write" in sys.argv
FORCE = "--force" in sys.argv                    # ignore cadence (testing)
SET_HOURS = (8, 14, 20)
MARKETS = "h2h,spreads,totals"
TABLE = "ncaaf_odds_history"
ODDS_BASE = "https://api.the-odds-api.com/v4/sports/americanfootball_ncaaf"
SUPA = "https://jpxnjuwglavsjbgbasnl.supabase.co/rest/v1"


def _env(name):
    if os.environ.get(name):
        return os.environ[name]
    for line in (ROOT.parent.parent / ".env.local").read_text().splitlines():
        if line.startswith(name + "="):
            return line.split("=", 1)[1].strip()
    sys.exit(f"{name} not found (env or .env.local)")


def get(url, params):
    for attempt in range(4):
        try:
            r = requests.get(url, params=params, timeout=30)
            r.raise_for_status()
            return r
        except Exception:
            if attempt == 3:
                raise
            time.sleep(1.5 * (attempt + 1))


def parse(events, snap_iso, now, season):
    """Bulk /odds payload -> one ncaaf_odds_history row per (event, book), with the
    pre-game + cadence filter applied. game_id = Odds-API event id (matches the backfill)."""
    snap = dt.datetime.fromisoformat(snap_iso.replace("Z", "+00:00"))
    rows = []
    for ev in events:
        ct = dt.datetime.fromisoformat(ev["commence_time"].replace("Z", "+00:00"))
        if ct <= snap:                                   # PRE-GAME ONLY (drops live odds)
            continue
        is_today = ct.astimezone(ET).date() == now.date()
        if not (is_today or (now.hour in SET_HOURS and now.minute < 15) or FORCE):   # cadence: future days only at SET_HOURS
            continue
        home, away = ev["home_team"], ev["away_team"]
        for bk in ev.get("bookmakers", []):
            r = {"season": season, "snapshot": snap_iso, "commence_time": ev["commence_time"],
                 "game_id": ev["id"], "home_team": home, "away_team": away, "book": bk["key"],
                 "home_ml": None, "away_ml": None, "spread_home": None, "spread_home_price": None,
                 "spread_away_price": None, "total": None, "over_price": None, "under_price": None,
                 "hrs_to_kick": round((ct - snap).total_seconds() / 3600, 1)}
            for mk in bk.get("markets", []):
                if mk["key"] == "h2h":
                    for o in mk["outcomes"]:
                        if o["name"] == home: r["home_ml"] = o.get("price")
                        elif o["name"] == away: r["away_ml"] = o.get("price")
                elif mk["key"] == "spreads":
                    for o in mk["outcomes"]:
                        if o["name"] == home: r["spread_home"], r["spread_home_price"] = o.get("point"), o.get("price")
                        elif o["name"] == away: r["spread_away_price"] = o.get("price")
                elif mk["key"] == "totals":
                    for o in mk["outcomes"]:
                        if o["name"] == "Over": r["total"], r["over_price"] = o.get("point"), o.get("price")
                        elif o["name"] == "Under": r["under_price"] = o.get("price")
            rows.append(r)
    return rows


# ── STEAM-TIMING re-tier (owner-approved 2026-08-17; cfb_steam_timing.py / LOCKED §10) ──
# For core_total_edge flags on games inside 24h: recompute the steam ladder from the
# hourly capture with WINDOW resolution. Late steam (arriving inside the final hours)
# = the sharpest confirm (60.0%, n=200, 5/5 seasons); early steam that went quiet is a
# head-fake (40.4%), and the >=2.5 fully-moved zone stays never-chase (48.4%). Runs
# every capture, so the app tier upgrades/demotes within the hour as sharp money shows.
def retier_steam_timing(season, now):
    sk = _env("SUPABASE_SERVICE_KEY")
    hdr = {"apikey": sk, "Authorization": f"Bearer {sk}", "Content-Type": "application/json"}
    fl = requests.get(f"{SUPA}/cfb_dryrun_flags?signal_key=eq.core_total_edge&season=eq.{season}"
                      f"&select=id,game_id,side,conviction,tier,stake_units,source", headers=hdr, timeout=30)
    flags = fl.json() if fl.ok else []
    if not flags:
        return
    gids = ",".join(str(f["game_id"]) for f in flags)
    gq = requests.get(f"{SUPA}/cfb_dryrun_games?game_id=in.({gids})"
                      f"&select=game_id,home_team,away_team,kickoff", headers=hdr, timeout=30)
    games = {g["game_id"]: g for g in (gq.json() if gq.ok else [])}
    now_utc = now.astimezone(dt.timezone.utc)
    changed = 0
    for f in flags:
        g = games.get(f["game_id"])
        if not g or not g.get("kickoff"):
            continue
        ko = dt.datetime.fromisoformat(g["kickoff"].replace("Z", "+00:00"))
        hrs = (ko - now_utc).total_seconds() / 3600
        if not (0 < hrs <= 24):        # the late window only exists inside T-24
            continue
        # line series for this game: match the capture's full names by school prefix
        oq = requests.get(f"{SUPA}/{TABLE}?season=eq.{season}"
                          f"&home_team=ilike.{requests.utils.quote(g['home_team'])}*"
                          f"&total=not.is.null&select=snapshot,total,book,commence_time",
                          headers=hdr, timeout=30)
        rows = oq.json() if oq.ok else []
        rows = [r for r in rows if abs((dt.datetime.fromisoformat(
            r["commence_time"].replace("Z", "+00:00")) - ko).total_seconds()) < 6 * 3600]
        if len(rows) < 4:
            continue
        import statistics
        by_snap = {}
        for r in rows:
            by_snap.setdefault(r["snapshot"], []).append(float(r["total"]))
        series = sorted((snap, statistics.median(v)) for snap, v in by_snap.items())
        t24_target = ko - dt.timedelta(hours=24)
        open_tot = series[0][1]
        cur_tot = series[-1][1]
        t24_tot = min(series, key=lambda x: abs(
            dt.datetime.fromisoformat(x[0].replace("Z", "+00:00")) - t24_target))[1]
        toward = 1.0 if f["side"] == "OVER" else -1.0
        early = (t24_tot - open_tot) * toward
        late = (cur_tot - t24_tot) * toward
        full = (cur_tot - open_tot) * toward
        if full >= 2.5:
            conv, tier, stake, note = "track", "tracking", 0.5, "fully moved 2.5+ — never chase"
        elif full >= 1.5:
            conv, tier, stake, note = "T1", "active", 1.5, "strong steam toward us"
        elif full >= 0.5:
            conv, tier, stake, note = "T2", "active", 1.0, "steam toward us"
        else:
            conv, tier, stake, note = "track", "tracking", 0.5, "no market confirmation yet"
        if conv in ("T1", "T2") and early >= 0.5 and late < 0.25:
            conv, tier, stake = ("T2", "active", 1.0) if conv == "T1" else ("track", "tracking", 0.5)
            note = "early move went quiet — head-fake profile, demoted"
        if late >= 0.5 and full < 2.5:
            if conv == "track":
                conv, tier, stake = "T2", "active", 1.0
            note = "LATE STEAM — sharp money arriving near kickoff"
        base_src = f["source"].split(" | STEAM:")[0]
        src = f"{base_src} | STEAM: {note} (open {open_tot:g} -> T24 {t24_tot:g} -> now {cur_tot:g})"
        if (conv, tier, src) != (f["conviction"], f["tier"], f["source"]):
            requests.patch(f"{SUPA}/cfb_dryrun_flags?id=eq.{f['id']}", headers=hdr,
                           json={"conviction": conv, "tier": tier, "stake_units": stake, "source": src},
                           timeout=30)
            changed += 1
    if changed:
        print(f"[steam-timing] re-tiered {changed} core_total_edge flag(s)")


def main():
    ok = _env("ODDS_API_KEY")
    now = dt.datetime.now(ET)
    season = now.year if now.month >= 3 else now.year - 1     # CFB season label (Aug–Jan)

    r = get(f"{ODDS_BASE}/odds",
            {"apiKey": ok, "markets": MARKETS, "regions": "us", "oddsFormat": "american"})
    events = r.json()
    snap_iso = now.astimezone(dt.timezone.utc).isoformat()
    rows = parse(events, snap_iso, now, season)
    print(f"[cfb] {len(events)} upcoming events | {len(rows)} book-rows qualify "
          f"(hour={now.hour} ET; today=hourly, future=3x@{SET_HOURS}) | quota={r.headers.get('x-requests-remaining')}")

    if not WRITE:
        if rows:
            print("  sample row:", {k: v for k, v in rows[0].items() if v is not None})
        print("[dry-run] no write. Re-run with --write to insert.")
        return
    if not rows:
        print("[idle] nothing qualifies this hour — no rows written.")
        return

    sk = _env("SUPABASE_SERVICE_KEY")
    hdr = {"apikey": sk, "Authorization": f"Bearer {sk}",
           "Content-Type": "application/json", "Prefer": "return=minimal"}
    for i in range(0, len(rows), 500):
        resp = requests.post(f"{SUPA}/{TABLE}", headers=hdr, json=rows[i:i + 500], timeout=60)
        resp.raise_for_status()
    print(f"[write] inserted {len(rows)} rows at snap_ts={snap_iso}")
    try:
        retier_steam_timing(season, now)
    except Exception as e:        # timing re-tier must never fail the capture
        print(f"[steam-timing] skipped: {e}")


if __name__ == "__main__":
    main()
