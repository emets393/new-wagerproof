-- NBA signal flags + first-half odds capture.
--
-- STATUS: NOT APPLIED to production as of 2026-07-31. Production DDL needs the owner's
-- explicit approval. Both tables are written to by jobs that already exist in the sibling
-- repo cfb_automation (branch nba/signals-and-h1-odds), so until this runs, both jobs fail
-- on every invocation:
--   scripts/cfb/nba_signals_job.py         -> nba_slate_flags
--   scripts/cfb/nba_odds_snapshots_fetch.py -> nba_odds_snapshots_h1
--
-- Column names and types below are taken from the payloads those two scripts actually POST,
-- not from the NFL/CFB analogues -- nfl_slate_flags types `grade_line` as text while the NBA
-- job sends a number, so copying that schema would break the insert.

-- ---------------------------------------------------------------------------------------
-- 1. nba_slate_flags -- one row per (game, signal) that fired for a day's slate.
--    Mirrors nfl_slate_flags / cfb_slate_flags in purpose. Only S9 (nba_dead_home_favorite)
--    fires today; S7/S8/S10 are blocked on the 1H history and feeds noted in NBA_PROVEN.md.
-- ---------------------------------------------------------------------------------------
create table if not exists public.nba_slate_flags (
  id           bigserial primary key,
  game_id      bigint      not null,
  game_date    date        not null,
  season       integer     not null,
  game         text,
  signal_key   text        not null,
  market       text        not null,
  side         text        not null,
  line         numeric,
  grade_line   numeric,
  conviction   text,
  stake_units  numeric     default 1.0,
  created_at   timestamptz not null default now()
);

-- The job upserts with on_conflict=game_id,signal_key, so this unique index is not an
-- optimisation -- without it every PostgREST merge-duplicates call errors out.
create unique index if not exists nba_slate_flags_game_signal_uidx
  on public.nba_slate_flags (game_id, signal_key);

create index if not exists nba_slate_flags_date_idx
  on public.nba_slate_flags (game_date desc);

-- ---------------------------------------------------------------------------------------
-- 2. nba_odds_snapshots_h1 -- first-half lines, one row per team per snapshot.
--    Shape follows nba_odds_snapshots (the full-game table) because build_h1_rows() emits
--    the same record shape. 1H markets are NOT on the bulk /odds call -- they come from the
--    per-event endpoint only, which is why this cannot be backfilled after the fact and why
--    the capture must be live before opening night.
-- ---------------------------------------------------------------------------------------
create table if not exists public.nba_odds_snapshots_h1 (
  id                  bigserial primary key,
  snapshot_ts_utc     timestamptz not null,
  odds_event_id       text        not null,
  tipoff_time_et      text,
  commence_time_utc   timestamptz,
  team_id_bdl         integer,
  team_abbr_bdl       text,
  team_full_name_bdl  text,
  side_label_oddsapi  text,
  moneyline_price     numeric,
  spread_point        numeric,
  total_points        numeric,
  bookmaker           text
);

-- Query pattern is "1H lines for this event, latest first" when building streak features.
create index if not exists nba_odds_snapshots_h1_event_ts_idx
  on public.nba_odds_snapshots_h1 (odds_event_id, snapshot_ts_utc desc);

create index if not exists nba_odds_snapshots_h1_ts_idx
  on public.nba_odds_snapshots_h1 (snapshot_ts_utc desc);
