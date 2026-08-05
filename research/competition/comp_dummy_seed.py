"""TEMPORARY dummy data for the competition UI preview (Most Picked + Leaderboard).

Seeds a clearly-marked fake week (season 2026, week_no=99, label 'Preview Data
(Dummy)') with a PAST deadline so the post-deadline surfaces actually fire:
  - 8 dummy games (real week-0 matchups, event ids prefixed dummy_, finals set)
  - 12 dummy users (auth.users + profiles, usernames comp_dummy_*)
  - 12 submitted entries x 6 stamped picks with a deliberately lopsided
    distribution (TCU -7 is the hero most-picked), graded via comp_grade_week

Everything is keyed for clean removal:  python3 comp_dummy_seed.py --teardown
deletes the week (games/entries/picks cascade) + the dummy auth users
(profiles cascade). The real week 0 slate is untouched.

Run:  python3 comp_dummy_seed.py [--teardown]
Env:  SUPABASE_PAT
"""
from __future__ import annotations

import sys
import uuid
from comp_sync import load_env, run_sql, q

TEARDOWN = "--teardown" in sys.argv

USERS = ["GridironGuru", "UpsetCity", "ChalkEater", "DogPound22", "TotalsTilly",
         "BackdoorBrady", "PickSixQueen", "MrCoverPoints", "FadeThePublic",
         "SaturdaySicko", "PrimetimePete", "TheLetdownSpot"]

# (event_suffix, home, away, spread_home, total, home_score, away_score)
GAMES = [
    ("tcu",  "TCU Horned Frogs",        "North Carolina Tar Heels",   -7.0, 48.5, 31, 20),
    ("usc",  "USC Trojans",             "San Jose State Spartans",   -38.5, 60.0, 45, 13),
    ("uva",  "Virginia Cavaliers",      "NC State Wolfpack",          -5.5, 54.5, 24, 21),
    ("ndsu", "North Dakota State Bison","Jacksonville State Gamecocks",-7.0, 48.5, 27, 17),
    ("emu",  "Eastern Michigan Eagles", "Sacramento State Hornets",   -8.5, 53.0, 30, 24),
    ("fsu",  "Florida State Seminoles", "New Mexico State Aggies",   -31.0, 53.0, 38, 10),
    ("stan", "Stanford Cardinal",       "Hawaii Rainbow Warriors",    -4.0, 50.5, 20, 17),
    ("unlv", "UNLV Rebels",             "Memphis Tigers",             -5.5, 59.0, 35, 31),
]

# per-user picks: (game_suffix, market, side, is_potw). 6 each, exactly 1 POTW.
# Deliberately concentrated: 9/12 on TCU spread-home (4 POTW) -> hero most-picked;
# 8/12 on UNLV over. Sides split elsewhere so records vary.
PICKS = {
 "GridironGuru":  [("tcu","spread","home",1),("unlv","total","over",0),("usc","spread","home",0),("uva","spread","home",0),("stan","total","under",0),("ndsu","spread","home",0)],
 "UpsetCity":     [("tcu","spread","home",0),("unlv","total","over",0),("uva","spread","away",1),("fsu","total","under",0),("emu","spread","home",0),("stan","spread","away",0)],
 "ChalkEater":    [("tcu","spread","home",1),("usc","spread","home",0),("fsu","spread","home",0),("ndsu","spread","home",0),("uva","spread","home",0),("unlv","total","over",0)],
 "DogPound22":    [("tcu","spread","away",0),("uva","spread","away",0),("stan","spread","away",1),("usc","spread","away",0),("fsu","total","under",0),("emu","spread","away",0)],
 "TotalsTilly":   [("unlv","total","over",1),("stan","total","under",0),("fsu","total","over",0),("tcu","total","over",0),("emu","total","under",0),("usc","total","over",0)],
 "BackdoorBrady": [("tcu","spread","home",0),("uva","spread","away",0),("unlv","spread","away",1),("ndsu","spread","home",0),("stan","total","under",0),("fsu","spread","home",0)],
 "PickSixQueen":  [("tcu","spread","home",1),("unlv","total","over",0),("usc","spread","home",0),("emu","spread","home",0),("uva","spread","home",0),("stan","total","under",0)],
 "MrCoverPoints": [("tcu","spread","home",0),("ndsu","spread","home",1),("unlv","total","over",0),("fsu","total","under",0),("uva","spread","away",0),("usc","spread","away",0)],
 "FadeThePublic": [("tcu","spread","away",1),("unlv","total","under",0),("usc","spread","away",0),("ndsu","spread","away",0),("stan","spread","home",0),("fsu","total","over",0)],
 "SaturdaySicko": [("tcu","spread","home",0),("unlv","total","over",0),("emu","total","over",1),("uva","total","over",0),("stan","spread","away",0),("ndsu","spread","home",0)],
 "PrimetimePete": [("tcu","spread","home",1),("unlv","total","over",0),("fsu","spread","home",0),("uva","spread","home",0),("usc","total","under",0),("emu","spread","home",0)],
 "TheLetdownSpot":[("tcu","spread","home",0),("unlv","total","over",1),("stan","total","under",0),("uva","spread","away",0),("ndsu","spread","home",0),("fsu","total","under",0)],
}


def main() -> None:
    load_env()
    if TEARDOWN:
        r = run_sql("""
            with wk as (delete from comp_weeks
                        where season = 2026 and week_no = 99 returning id)
            select count(*) as weeks_deleted from wk;""")
        u = run_sql("""
            delete from auth.users
            where id in (select user_id from public.profiles
                         where username like 'comp_dummy_%')
            returning email;""")
        print(f"teardown: week 99 removed ({r}), dummy users removed: {len(u)}")
        return

    uids = {name: str(uuid.uuid4()) for name in USERS}

    urows = ",".join(f"({q(uid)}, {q('comp_dummy_' + str(i) + '@wagerproof.test')}, "
                     f"'authenticated','authenticated')"
                     for i, uid in enumerate(uids.values()))
    prows = ",".join(f"({q(uid)}, {q('comp_dummy_' + name.lower())}, {q(name)}, false)"
                     for name, uid in uids.items())
    grows = ",".join(f"({q('dummy_' + sfx)}, {q(h)}, {q(a)}, {sp}, {tot}, {hs}, {as_})"
                     for sfx, h, a, sp, tot, hs, as_ in GAMES)
    pick_sql_rows = []
    for name, picks in PICKS.items():
        assert len(picks) == 6 and sum(p[3] for p in picks) == 1, name
        for sfx, mkt, side, potw in picks:
            g = next(g for g in GAMES if g[0] == sfx)
            line = g[4] if mkt == "total" else (g[3] if side == "home" else -g[3])
            pick_sql_rows.append(
                f"({q(name)}, {q('dummy_' + sfx)}, {q(mkt)}, {q(side)}, {line}, {bool(potw)})")

    run_sql(f"""
    do $do$
    declare v_week bigint;
    begin
      insert into auth.users (id, email, aud, role) values {urows};
      insert into public.profiles (user_id, username, display_name, subscription_active)
        values {prows}
        on conflict (user_id) do update set username = excluded.username,
          display_name = excluded.display_name;

      insert into comp_weeks (season, week_no, label, deadline, window_end, status, is_practice)
      values (2026, 99, 'Preview Data (Dummy)', now() - interval '2 days',
              now() + interval '2 days', 'locked', false)
      returning id into v_week;

      insert into comp_games (week_id, sport, event_id, home_team, away_team, kickoff,
                              spread_home, total, books_n, lines_updated_at,
                              home_score, away_score, is_final)
      select v_week, 'cfb', v.eid, v.h, v.a, now() - interval '1 day',
             v.sp, v.tot, 11, now(), v.hs, v.as_, true
      from (values {grows}) as v(eid, h, a, sp, tot, hs, as_);

      insert into comp_entries (week_id, user_id, status, submitted_at, editable_until)
      select v_week, p.user_id, 'submitted', now() - interval '3 days', now() - interval '3 days'
      from public.profiles p where p.username like 'comp_dummy_%';

      insert into comp_picks (entry_id, game_id, market, side, line, line_stamped_at, is_potw)
      select e.id, g.id, v.mkt, v.side, v.line, now() - interval '3 days', v.potw
      from (values {",".join(pick_sql_rows)}) as v(dname, eid, mkt, side, line, potw)
      join public.profiles pr on pr.display_name = v.dname and pr.username like 'comp_dummy_%'
      join comp_entries e on e.week_id = v_week and e.user_id = pr.user_id
      join comp_games g on g.week_id = v_week and g.event_id = v.eid;

      perform comp_grade_week(v_week);
    end $do$;""")
    print(f"seeded: week 99 'Preview Data (Dummy)' — {len(GAMES)} games, "
          f"{len(USERS)} users, {len(pick_sql_rows)} graded picks")


if __name__ == "__main__":
    main()
