-- Action Network public-betting splits, captured hourly in season. NFL, CFB, NBA, NCAAB.
-- Written by research/action-splits/snapshot_action.py from GitHub Actions
-- (.github/workflows/action-splits-hourly.yml). CFB instance (jpxnjuwglavsjbgbasnl).
--
-- CHANGE LOG, NOT A SNAPSHOT LOG. The writer inserts a row only when something about that
-- game-market moved since its last stored row, so consecutive rows bracket every observed
-- interval and the last row before kickoff is the closing state. See the writer's docstring.
--
-- ⛔ THE KEY IS (game_id, market), NOT THE TEAM NAMES AND NOT THE WEEK.
--   Action Network's own game id is the only identifier that works across all four leagues:
--   football is keyed by week and basketball has no week at all (`week` comes back null), and
--   two NBA teams meet several times a season, so a name-and-week key silently collapses
--   different games into one row. The id also removes the fuzzy name matching the research
--   CSV needs — see the crosswalk discussion in research/action-splits/README.md.
--
-- ⛔ `season` IS THE END YEAR FOR BASKETBALL. Action Network labels an NBA/NCAAB season by
--   its START year, so a January 2027 game arrives as `season: 2026`. Every other piece of
--   basketball work in this repo labels by END year, so the writer converts (+1) and stores
--   2027. Football is unshifted: the 2026 NFL season is 2026 in both conventions. Getting
--   this backwards joins a season onto the one before it and nothing errors.
--
-- Column meanings follow research/action-splits/README.md exactly, including its orientation
-- rule: the "away" slot is the AWAY team for spread/ml and the OVER for totals. bets_*/money_*
-- are the Action Network consensus percentages (book 15); *_open is the opener (book 30);
-- *_close/*_price are BEST ODDS across the real books at capture time. On a moneyline the
-- price IS the line, so *_price is null on every ml row by design.

create table if not exists public.action_public_splits (
    id                    bigserial primary key,
    snap_ts               timestamptz not null default now(),
    game_id               bigint      not null,          -- Action Network's game id
    market                text        not null,          -- 'spread' | 'total' | 'ml'
    sport                 text        not null,          -- 'nfl' | 'cfb' | 'nba' | 'ncaab'
    season                integer     not null,          -- END year for basketball, see above
    week                  integer,                       -- football only; null for basketball
    slate_date            date,                          -- ET slate date (the basketball key)
    start_time            timestamptz,                   -- scheduled tip/kick, UTC
    game_type             text,                           -- 'reg' | 'post' | 'pre'
    away                  text        not null,
    home                  text        not null,
    away_open             double precision,
    home_open             double precision,
    away_close            double precision,
    away_price            double precision,
    home_close            double precision,
    home_price            double precision,
    bets_away             double precision,
    bets_home             double precision,
    money_away            double precision,
    money_home            double precision,
    tickets               double precision,
    away_move             double precision,
    home_move             double precision,
    money_minus_bets_away double precision
);

-- the writer's own read: newest row per game-market
create index if not exists action_public_splits_key_idx
    on public.action_public_splits (game_id, market, snap_ts desc);
-- research reads: a football week, a basketball slate, or a freshness probe
create index if not exists action_public_splits_week_idx
    on public.action_public_splits (sport, season, week, snap_ts desc);
create index if not exists action_public_splits_date_idx
    on public.action_public_splits (sport, slate_date, snap_ts desc);

-- One row per game-market, the latest. This is what snapshot_action.py diffs against, so its
-- cost stays flat in season length instead of growing with the log.
create or replace view public.action_public_splits_latest as
select distinct on (game_id, market) *
from public.action_public_splits
order by game_id, market, snap_ts desc;

-- RLS on with no anon policy, matching the other research-only tables (nfl_qb_scheme_splits):
-- the service key writes, the MCP explorer reads, no client surface reads it yet.
alter table public.action_public_splits enable row level security;

drop policy if exists action_public_splits_mcp_read on public.action_public_splits;
create policy action_public_splits_mcp_read
    on public.action_public_splits for select to mcp_explorer using (true);

grant select on public.action_public_splits to mcp_explorer;
grant select on public.action_public_splits_latest to mcp_explorer;
