"""Competition sync — feeds the weekly NFL/CFB pick'em on the MAIN instance.

Self-contained hourly job (Render cron `competition-sync-hourly`):
  1. Pulls live NFL + CFB odds straight from The Odds API bulk /odds endpoint
     (spreads+totals, us books) — the SAME source as everything else per the
     lines policy. One call per sport.
  2. Derives competition weeks: deadline = Friday 12:00 PM ET, eligible window
     = deadline .. +4 days. A game is eligible iff its kickoff falls in a
     window — this automatically excludes TNF and weekday CFB (their most
     recent Friday-noon is >4 days back).
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
    with urllib.request.urlopen(req, timeout=60) as r:
        return json.loads(r.read().decode())


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
    horizon = now + timedelta(days=HORIZON_DAYS)

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

    # Remove future games that vanished from the feed (phantom listing cleaned
    # upstream, or a true cancellation) — but NEVER one somebody has picked, and
    # only within the still-open current week.
    if games:
        keep = ",".join(q(g["event_id"]) for g in games)
        run_sql(f"""
            delete from comp_games g
            using comp_weeks w
            where w.id = g.week_id and now() < w.deadline and g.kickoff > now()
              and g.event_id not in ({keep})
              and not exists (select 1 from comp_picks p where p.game_id = g.id);""")

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
