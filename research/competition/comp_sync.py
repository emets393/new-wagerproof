"""Competition sync — feeds the weekly NFL/CFB pick'em on the MAIN instance.

Self-contained hourly job (Render cron `competition-sync-hourly`):
  1. Pulls live NFL + CFB odds straight from The Odds API bulk /odds endpoint
     (spreads+totals, us books) — the SAME source as everything else per the
     lines policy. One call per sport.
  2. Derives competition weeks: deadline = Friday 12:00 PM ET, eligible window
     = deadline .. +4 days (resets Tuesday morning). Only the *current* deadline
     (plus the just-ended week for grading) is materialized — never future
     weeks early (that used to create CFB-only future slates before NFL Sundays
     entered the odds horizon). Pre-week-0 August Fridays are skipped; until
     week 0 ends we stay on the practice slate.
  3. Upserts comp_weeks / comp_games with CONSENSUS lines: mean across books,
     rounded to the nearest 0.5 (half away from zero). Same number for every
     user; lines refresh hourly until each user's submit stamps them.
  4. Pulls finals from The Odds API /scores (same event ids as /odds — zero
     team-name mapping) and grades via the comp_grade_week RPC.

Writes go through the Supabase Management API (SUPABASE_PAT + SupabaseCLI UA),
the repo's established path for MAIN-instance SQL — no service key on disk.

Run:  python3 comp_sync.py [--dry]
Env:  ODDS_API_KEY, SUPABASE_PAT   (.env.local here or repo root)
"""
from __future__ import annotations

import json
import math
import os
import sys
import time
import urllib.parse
import urllib.request
from datetime import datetime, timedelta, timezone
from pathlib import Path
from zoneinfo import ZoneInfo

HERE = Path(__file__).resolve().parent
ET = ZoneInfo("America/New_York")
MAIN_REF = "gnjrklxotmbvnxbnnqgq"
SPORTS = {"nfl": "americanfootball_nfl", "cfb": "americanfootball_ncaaf"}
WINDOW_DAYS = 4          # deadline (Fri 12pm ET) .. Tue 12pm ET — week resets Tuesday morning
# Horizon only needs to cover the *current* week's last kickoff (Mon night ≈
# deadline+3.5d). We no longer materialize future weeks early (that created
# CFB-only future slates before NFL Sundays entered the old 9-day window).
HORIZON_DAYS = 8
DRY = "--dry" in sys.argv

# The competition ENDS with NFL Week 18 (owner rule 2026-08-06) — no playoff or
# CFB bowl weeks. Value = that season's final Friday-noon-ET deadline (the one
# whose window holds NFL week 18's Sun/Mon games; comp week 19 for 2026).
# Verify against the schedule when adding a season: last NFL regular-season
# kickoff -> comp_deadline_for() -> paste here.
SEASON_FINAL_DEADLINE = {2026: datetime(2027, 1, 8, 12, 0, tzinfo=ET)}


def load_env() -> None:
    for p in (HERE / ".env.local", HERE.parent / "nfl-extreme-outcomes" / ".env.local",
              HERE.parent.parent / ".env.local"):
        if p.exists():
            for line in p.read_text().splitlines():
                if "=" in line and not line.startswith("#"):
                    k, v = line.split("=", 1)
                    os.environ.setdefault(k.strip(), v.strip())


def http_json(url: str, headers: dict | None = None, payload: dict | None = None):
    req = urllib.request.Request(
        url, headers=headers or {},
        data=json.dumps(payload).encode() if payload is not None else None,
        method="POST" if payload is not None else "GET")
    # Transient 5xx/URLError from Supabase or the Odds API shouldn't fail the whole hourly
    # run (2026-08-09: a single 502 paged the owner). SQL calls are idempotent upserts, so
    # retrying is safe. 4xx = real bug -> raise immediately.
    last = None
    for attempt in range(4):
        try:
            with urllib.request.urlopen(req, timeout=60) as r:
                return json.loads(r.read().decode())
        except urllib.error.HTTPError as e:
            if e.code < 500:
                raise
            last = e
        except urllib.error.URLError as e:
            last = e
        time.sleep(2 ** attempt * 3)   # 3s, 6s, 12s
    raise last


def run_sql(query: str):
    return http_json(
        f"https://api.supabase.com/v1/projects/{MAIN_REF}/database/query",
        headers={"Authorization": f"Bearer {os.environ['SUPABASE_PAT']}",
                 "User-Agent": "SupabaseCLI/1.0", "Content-Type": "application/json"},
        payload={"query": query})


def q(s: str) -> str:
    return "'" + str(s).replace("'", "''") + "'"


def round_half(v: float) -> float:
    """Nearest 0.5, halves away from zero: -6.75 -> -7.0, 44.25 -> 44.5."""
    return math.copysign(math.floor(abs(v) * 2 + 0.5) / 2, v)


def comp_deadline_for(kick_utc: datetime) -> datetime | None:
    """The Friday-12:00-ET deadline whose 4-day window contains this kickoff."""
    k_et = kick_utc.astimezone(ET)
    d = k_et.date()
    # walk back to the most recent Friday (could be today if kick is after noon)
    for back in range(0, 7):
        cand = d - timedelta(days=back)
        if cand.weekday() == 4:  # Friday
            dl = datetime(cand.year, cand.month, cand.day, 12, 0, tzinfo=ET)
            if dl < k_et <= dl + timedelta(days=WINDOW_DAYS):
                return dl
            return None  # most recent Friday-noon window misses it -> ineligible
    return None


def week0_deadline(season: int) -> datetime:
    """Last Friday of August — CFB opener / practice round deadline."""
    a = datetime(season, 8, 31, 12, 0, tzinfo=ET)
    while a.weekday() != 4:
        a -= timedelta(days=1)
    return a


def season_and_week(dl_et: datetime) -> tuple[int, int, str, bool]:
    season = dl_et.year if dl_et.month >= 3 else dl_et.year - 1
    # anchor = last Friday of August of the season year (CFB opening weekend).
    # That first window is week 0 — the unscored PRACTICE ROUND. Real weeks 1+.
    a = week0_deadline(season)
    week_no = (dl_et - a).days // 7
    is_practice = week_no == 0
    sat = (dl_et + timedelta(days=1)).strftime("%b %-d")
    label = "Week 0 (Practice Round)" if is_practice else f"Week {week_no} · {sat}"
    return season, week_no, label, is_practice


def current_comp_deadline(now_et: datetime) -> datetime:
    """The single competition week that should exist as 'current'.

    Timeline for deadline Friday F:
      - Tue morning (after prior window_end) → Fri noon F: picking open
      - Fri noon F → Tue noon: locked, games play
      - Tue morning: week resets to next Friday

    Before week 0's calendar open (early August), jump forward to week 0 so the
    practice slate is the only current week — never materialize Aug 8/15/22
    phantom weeks or future CFB-only slates.
    """
    d = now_et.date()
    dl: datetime | None = None
    for back in range(0, 8):
        cand = d - timedelta(days=back)
        if cand.weekday() != 4:
            continue
        cand_dl = datetime(cand.year, cand.month, cand.day, 12, 0, tzinfo=ET)
        if now_et <= cand_dl + timedelta(days=WINDOW_DAYS):
            dl = cand_dl
        break
    if dl is None:
        for ahead in range(0, 8):
            cand = d + timedelta(days=ahead)
            if cand.weekday() == 4:
                dl = datetime(cand.year, cand.month, cand.day, 12, 0, tzinfo=ET)
                break
    if dl is None:
        raise RuntimeError("no Friday found")

    season = dl.year if dl.month >= 3 else dl.year - 1
    _, week_no, _, _ = season_and_week(dl)
    if week_no < 0:
        w0 = week0_deadline(season)
        if now_et <= w0 + timedelta(days=WINDOW_DAYS):
            return w0
    return dl


def fetch_odds(sport_key: str) -> list[dict]:
    url = (f"https://api.the-odds-api.com/v4/sports/{sport_key}/odds?" +
           urllib.parse.urlencode({"apiKey": os.environ["ODDS_API_KEY"],
                                   "regions": "us", "markets": "spreads,totals",
                                   "oddsFormat": "american"}))
    return http_json(url)


def fetch_scores(sport_key: str) -> list[dict]:
    url = (f"https://api.the-odds-api.com/v4/sports/{sport_key}/scores?" +
           urllib.parse.urlencode({"apiKey": os.environ["ODDS_API_KEY"], "daysFrom": 3}))
    return http_json(url)


def consensus(ev: dict) -> tuple[float | None, float | None, int]:
    spreads, totals = [], []
    for bk in ev.get("bookmakers", []):
        for m in bk.get("markets", []):
            if m["key"] == "spreads":
                for o in m["outcomes"]:
                    if o["name"] == ev["home_team"] and o.get("point") is not None:
                        spreads.append(float(o["point"]))
            elif m["key"] == "totals":
                for o in m["outcomes"]:
                    if o["name"] == "Over" and o.get("point") is not None:
                        totals.append(float(o["point"]))
    sp = round_half(sum(spreads) / len(spreads)) if spreads else None
    tot = round_half(sum(totals) / len(totals)) if totals else None
    return sp, tot, max(len(spreads), len(totals))


def main() -> None:
    load_env()
    now = datetime.now(timezone.utc)
    now_et = now.astimezone(ET)
    target_dl = current_comp_deadline(now_et)
    # Also refresh the just-ended week while its games may still be grading.
    prev_dl = target_dl - timedelta(days=7)
    allowed_dls = {target_dl, prev_dl}
    # Cover the full eligible window for the target week (important when week 0
    # is shown early — opener kickoffs can be weeks away). Cap keeps us from
    # pulling the *next* week's NFL Sunday into an earlier CFB-only slate.
    window_end_utc = (target_dl + timedelta(days=WINDOW_DAYS)).astimezone(timezone.utc)
    horizon = max(now + timedelta(days=HORIZON_DAYS), window_end_utc)

    print(f"current deadline={target_dl.isoformat()} | horizon={horizon.isoformat()}")

    weeks: dict[tuple[int, int], tuple[datetime, str, bool]] = {}
    games: list[dict] = []
    for sport, sport_key in SPORTS.items():
        try:
            events = fetch_odds(sport_key)
        except Exception as e:  # off-season sport -> keep going with the other
            print(f"[{sport}] odds fetch failed: {e}")
            continue
        n_elig = 0
        n_skip_future = 0
        n_skip_preseason = 0
        for ev in events:
            kick = datetime.fromisoformat(ev["commence_time"].replace("Z", "+00:00"))
            if kick <= now or kick > horizon:
                continue
            dl = comp_deadline_for(kick)
            if dl is None:
                continue
            if dl not in allowed_dls:
                n_skip_future += 1
                continue
            season, week_no, label, is_practice = season_and_week(dl)
            # Don't materialize pre-week-0 August Fridays (negative week_no).
            if week_no < 0:
                n_skip_preseason += 1
                continue
            # Season ends with NFL Week 18 — never create playoff/bowl weeks.
            final_dl = SEASON_FINAL_DEADLINE.get(season)
            if final_dl is not None and dl > final_dl:
                continue
            weeks[(season, week_no)] = (dl, label, is_practice)
            sp, tot, n_books = consensus(ev)
            games.append(dict(season=season, week_no=week_no, sport=sport,
                              event_id=ev["id"], home=ev["home_team"],
                              away=ev["away_team"], kick=kick, spread=sp,
                              total=tot, books=n_books))
            n_elig += 1
        print(f"[{sport}] {len(events)} events, {n_elig} eligible | "
              f"skipped_future_week={n_skip_future} skipped_pre_w0={n_skip_preseason}")

    # Dedupe phantom double-listings (Odds API has served the same game under
    # two event ids — seen on NBA team totals). Keep the listing with more books.
    by_matchup: dict[tuple, dict] = {}
    for g in games:
        k = (g["sport"], g["home"], g["away"], g["kick"].date())
        if k not in by_matchup or g["books"] > by_matchup[k]["books"]:
            by_matchup[k] = g
    if len(by_matchup) < len(games):
        print(f"deduped {len(games) - len(by_matchup)} phantom duplicate listing(s)")
    games = list(by_matchup.values())

    by_sport = {}
    for g in games:
        by_sport[g["sport"]] = by_sport.get(g["sport"], 0) + 1
    print(f"games by sport: {by_sport}")

    if DRY:
        for g in games[:12]:
            print(g)
        print(f"(dry) {len(weeks)} weeks, {len(games)} games")
        return

    # ---- upsert weeks --------------------------------------------------------
    if weeks:
        rows = ",".join(
            f"({s}, {w}, {q(lab)}, {q(dl.isoformat())}::timestamptz, "
            f"{q((dl + timedelta(days=WINDOW_DAYS)).isoformat())}::timestamptz, {prac})"
            for (s, w), (dl, lab, prac) in sorted(weeks.items()))
        run_sql(f"""
            insert into comp_weeks (season, week_no, label, deadline, window_end, is_practice)
            values {rows}
            on conflict (season, week_no) do update
              set label = excluded.label, deadline = excluded.deadline,
                  window_end = excluded.window_end, is_practice = excluded.is_practice
              where comp_weeks.status in ('upcoming','open');""")

    # ---- upsert games (lines only refresh pre-kickoff) -----------------------
    if games:
        rows = ",".join(
            f"({g['season']}, {g['week_no']}, {q(g['sport'])}, {q(g['event_id'])}, "
            f"{q(g['home'])}, {q(g['away'])}, {q(g['kick'].isoformat())}::timestamptz, "
            f"{g['spread'] if g['spread'] is not None else 'null'}, "
            f"{g['total'] if g['total'] is not None else 'null'}, {g['books']})"
            for g in games)
        run_sql(f"""
            insert into comp_games (week_id, sport, event_id, home_team, away_team,
                                    kickoff, spread_home, total, books_n, lines_updated_at)
            select w.id, v.sport, v.event_id, v.home, v.away, v.kick,
                   v.spread, v.total, v.books, now()
            from (values {rows})
                 as v(season, week_no, sport, event_id, home, away, kick, spread, total, books)
            join comp_weeks w on w.season = v.season and w.week_no = v.week_no
            on conflict (week_id, sport, event_id) do update
              set spread_home = excluded.spread_home, total = excluded.total,
                  books_n = excluded.books_n, lines_updated_at = now(),
                  kickoff = excluded.kickoff
              where comp_games.kickoff > now();""")

    # Remove games that vanished from the feed (phantom listing cleaned upstream,
    # or a true cancellation) — but NEVER one somebody has picked, and ONLY in the
    # current week: this run's feed has no future-week games, so an unscoped
    # delete would strip a future week that has early entries (the week-cleanup
    # below spares such weeks but wouldn't restore their games).
    if games:
        keep = ",".join(q(g["event_id"]) for g in games)
        run_sql(f"""
            delete from comp_games g
            using comp_weeks w
            where w.id = g.week_id and now() < w.deadline and g.kickoff > now()
              and w.deadline = {q(target_dl.isoformat())}::timestamptz
              and g.event_id not in ({keep})
              and not exists (select 1 from comp_picks p where p.game_id = g.id);""")

    # Drop phantom future weeks created by older sync runs (no entries yet).
    # UI also hides them; this keeps the DB aligned with "current week only".
    run_sql(f"""
        delete from comp_weeks w
        where w.status in ('upcoming', 'open')
          and w.deadline > {q(target_dl.isoformat())}::timestamptz
          and not exists (select 1 from comp_entries e where e.week_id = w.id);""")

    # ---- week statuses -------------------------------------------------------
    run_sql("""
        update comp_weeks set status = 'open'
          where status = 'upcoming' and now() < deadline
            and exists (select 1 from comp_games g where g.week_id = comp_weeks.id);
        update comp_weeks set status = 'locked'
          where status in ('upcoming','open') and now() >= deadline;""")

    # ---- finals + grading ----------------------------------------------------
    finals = []
    for sport, sport_key in SPORTS.items():
        try:
            for sc in fetch_scores(sport_key):
                if not sc.get("completed") or not sc.get("scores"):
                    continue
                by_name = {s["name"]: int(s["score"]) for s in sc["scores"]}
                h, a = by_name.get(sc["home_team"]), by_name.get(sc["away_team"])
                if h is None or a is None:
                    continue
                finals.append((sport, sc["id"], h, a))
        except Exception as e:
            print(f"[{sport}] scores fetch failed: {e}")
    if finals:
        rows = ",".join(f"({q(s)}, {q(eid)}, {h}, {a})" for s, eid, h, a in finals)
        run_sql(f"""
            update comp_games g
            set home_score = v.h, away_score = v.a, is_final = true
            from (values {rows}) as v(sport, event_id, h, a)
            where g.sport = v.sport and g.event_id = v.event_id and not g.is_final;""")
    graded = run_sql("""
        select w.id, comp_grade_week(w.id) as n
        from comp_weeks w
        where w.status = 'locked' and now() > w.deadline;""")
    print(f"weeks upserted: {len(weeks)} | games: {len(games)} | finals: {len(finals)} "
          f"| graded: {graded}")


if __name__ == "__main__":
    main()
