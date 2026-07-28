"""
Bridge: nfl_historical_odds (the live Odds-API capture) -> nfl_betting_lines (the slate's
game-list source that nfl_input_values_view reads).

WHY: vsin_nfl_week_to_supabase.py (the old nfl_betting_lines writer) is retired. Betting lines
now come from the odds-capture system (live_odds.py -> nfl_historical_odds). But the pregame
slate chain (nfl_input_values_view -> v_input_values_with_epa -> v_nfl_slate_inputs, which the
new model reads for the upcoming-week game list + power ratings) is still built FROM
nfl_betting_lines. Nothing bridged the two when vsin was dropped, so the slate view was empty
for 2026. This script is that bridge (vsin's replacement).

Consensus = median across books of each book's LATEST pre-kick snapshot per game. Week is
derived from nfl_week_ranges. training_key = home_team + away_team + season + week (city-style
team names, which nfl_historical_odds already uses — no mapping needed). Splits (handle/bets)
are left null; they were vsin-only extras and are non-critical model inputs.

Usage:  python3 nfl_lines_from_odds.py [season]     # default 2026 ; upcoming (pre-kick) games only
"""
import os
import sys
import datetime as dt
import statistics as stats
import requests

SUPA = "https://jpxnjuwglavsjbgbasnl.supabase.co/rest/v1"
SEASON = int(sys.argv[1]) if len(sys.argv) > 1 else 2026
ET = dt.timezone(dt.timedelta(hours=-4))  # ET for game_date/time display (DST-approx, matches vsin rows)


def _env(name):
    if os.environ.get(name):
        return os.environ[name]
    for line in open(os.path.join(os.path.dirname(__file__), "..", "..", ".env.local")):
        if line.startswith(name + "="):
            return line.split("=", 1)[1].strip()
    sys.exit(f"{name} not found")


SK = _env("SUPABASE_SERVICE_KEY")
HDR = {"apikey": SK, "Authorization": f"Bearer {SK}", "Content-Type": "application/json"}


def get(path):
    r = requests.get(f"{SUPA}/{path}", headers=HDR, timeout=60)
    r.raise_for_status()
    return r.json()


def med(vals):
    vals = [float(v) for v in vals if v is not None]
    return round(stats.median(vals), 1) if vals else None


def med_int(vals):
    vals = [float(v) for v in vals if v is not None]
    return int(round(stats.median(vals))) if vals else None


def main():
    now = dt.datetime.now(dt.timezone.utc)
    # week ranges for the season (derive week from commence date)
    wr = get(f"nfl_week_ranges?season_year=eq.{SEASON}&select=week,start_date,end_date")
    if not wr:
        sys.exit(f"nfl_week_ranges empty for {SEASON} — load it first")

    def week_for(date_str):
        for r in wr:
            if r["start_date"] <= date_str < r["end_date"]:
                return r["week"]
        return None

    # all snaps for the season; keep UPCOMING games only (commence in the future)
    rows = get(f"nfl_historical_odds?season=eq.{SEASON}"
               "&select=home_team,away_team,commence_time,book,spread_home,total_point,ml_home,ml_away")
    games = {}
    for r in rows:
        comm = dt.datetime.fromisoformat(r["commence_time"].replace("Z", "+00:00"))
        if comm <= now:
            continue                                   # pre-game only
        key = (r["home_team"], r["away_team"], r["commence_time"])
        games.setdefault(key, []).append(r)
    print(f"[odds] {len(games)} upcoming {SEASON} games across {len(rows)} book-snaps")

    out = []
    for (home, away, comm_iso), books in games.items():
        comm = dt.datetime.fromisoformat(comm_iso.replace("Z", "+00:00"))
        comm_et = comm.astimezone(ET)
        gdate = comm_et.date().isoformat()
        week = week_for(gdate)
        if week is None:
            print(f"  [skip] {away}@{home} {gdate}: no week range")
            continue
        sp_home = med([b["spread_home"] for b in books])
        tot = med([b["total_point"] for b in books])
        mlh = med_int([b["ml_home"] for b in books])
        mla = med_int([b["ml_away"] for b in books])
        out.append({
            "season_year": SEASON, "week": week, "is_postseason": False,
            "away_team": away, "home_team": home,
            "game_date": gdate, "game_time": comm_et.strftime("%H:%M:%S"),
            "start_time_minutes": comm_et.hour * 60 + comm_et.minute,
            "game_time_et": comm.isoformat(), "updated_at": now.isoformat(),
            "away_spread": (-sp_home if sp_home is not None else None),
            "home_spread": sp_home,
            "over_line": tot, "under_line": tot,
            "away_ml": mla, "home_ml": mlh,
            "training_key": f"{home}{away}{SEASON}{week}",
            "as_of_date": now.date().isoformat(), "as_of_ts": now.isoformat(),
        })

    if not out:
        print("[write] nothing to write"); return
    # idempotent: clear this season's rows, then insert the fresh consensus snapshot.
    # Insert in small batches: each row fires the apply_betting_line_to_schedules AFTER-INSERT
    # trigger (an UPDATE across ~32 per-team schedule tables), so a 75-row bulk insert blew the
    # PostgREST 8s statement timeout. Batches of 5 keep each POST well under the limit.
    requests.delete(f"{SUPA}/nfl_betting_lines?season_year=eq.{SEASON}", headers=HDR, timeout=60)
    for i in range(0, len(out), 5):
        resp = requests.post(f"{SUPA}/nfl_betting_lines", headers={**HDR, "Prefer": "return=minimal"},
                             json=out[i:i + 5], timeout=60)
        if not resp.ok:
            sys.exit(f"[write] batch {i}: {resp.status_code}: {resp.text[:400]}")
    wk = sorted({r["week"] for r in out})
    print(f"[write] {len(out)} rows -> nfl_betting_lines (season {SEASON}, weeks {wk})")


if __name__ == "__main__":
    main()
