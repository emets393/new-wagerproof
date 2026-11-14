-- The weekly player-prop cheat sheet: team-level productivity by dimension, with the one
-- opponent (or own) player who gets the most usage in that dimension.
--
-- ONE ROW PER (season, week, table_key, team). Every table in the sheet is team-centred in both
-- directions — a defence row names the OPPONENT player who benefits, an offence row names ITS OWN
-- player. Keeping the grain at team level is deliberate: a per-player coverage split is 15-25
-- targets four games into a season and the tails are noise, while the team pools every receiver
-- on the roster and the same split is usable from week 3.
--
-- ⛔ MEASURES ARE PRODUCTIVITY, NOT YARDS (owner 2026-10-09: "yards don't give us that, find
-- something better"). Yards per game is volume x efficiency smeared together — a defence leads
-- the league in yards allowed because opponents run 70 plays on it. The headline for each family
-- is an OVER-EXPECTED measure where one exists, because those already strip the volume and
-- difficulty confound:
--     passing    completions over expected
--     receiving  receiving yards over expected per target
--     rushing    success rate  (no over-expected equivalent is published at team scope)
--
-- ⛔ THE NAMED PLAYER IS THE POINT, AND THE EASIEST THING TO GET WRONG. He must be on the right
-- team for the direction this row reads, be the right ROLE for the dimension (the slot table
-- names the slot man, not the WR1), and must not be Out or Doubtful on this week's report.
create table if not exists public.nfl_prop_cheatsheet (
    id           bigserial primary key,
    season       integer     not null,
    week         integer     not null,
    -- 'trenches' | 'rushing' | 'passing' | 'receiving' | 'coverage' | 'anytime_td'
    family       text        not null,
    -- stable id for one rendered table, e.g. 'recv_slot', 'rush_RB', 'trenches'
    table_key    text        not null,
    -- what the UI filter chips map onto; null where the family has no such filter
    position_filter  text,
    alignment_filter text,
    -- 'defense' = the row is a defence and names the OPPONENT's player
    -- 'offense' = the row is an offence and names ITS OWN player
    side         text        not null,
    team         text        not null,
    opponent     text,
    kickoff      timestamptz,
    -- {measure_key: {actual, league, rank, of, lift}} — every measure for this row
    metrics      jsonb       not null default '{}'::jsonb,
    -- which key in `metrics` the table sorts and leads on
    headline     text,
    -- {name, player_id, position, share, share_label, headshot_url} or null when nobody qualifies
    player       jsonb,
    updated_at   timestamptz not null default now()
);

create unique index if not exists nfl_prop_cheatsheet_row
    on public.nfl_prop_cheatsheet (season, week, table_key, team);
create index if not exists nfl_prop_cheatsheet_lookup
    on public.nfl_prop_cheatsheet (season, week, family);

comment on table public.nfl_prop_cheatsheet is
    'Weekly prop cheat sheet. One row per team per rendered table; team-level productivity
     measures with the player who gets the most usage in that dimension. Built by
     research/nfl-extreme-outcomes/prop_cheatsheet.py on the daily prop cron.';
comment on column public.nfl_prop_cheatsheet.side is
    'defense = names the OPPONENT player who benefits; offense = names its OWN player.';
comment on column public.nfl_prop_cheatsheet.metrics is
    'Productivity measures, never raw yards. Each {actual, league, rank, of, lift}.';

alter table public.nfl_prop_cheatsheet enable row level security;
drop policy if exists nfl_prop_cheatsheet_read on public.nfl_prop_cheatsheet;
create policy nfl_prop_cheatsheet_read on public.nfl_prop_cheatsheet
    for select using (true);
