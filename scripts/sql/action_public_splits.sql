-- Action Network public-betting splits, captured hourly in season.
-- Written by research/action-splits/snapshot_action.py from GitHub Actions
-- (.github/workflows/action-splits-hourly.yml). CFB instance (jpxnjuwglavsjbgbasnl).
--
-- CHANGE LOG, NOT A SNAPSHOT LOG. The writer inserts a row only when something about that
-- game-market moved since its last stored row, so consecutive rows bracket every observed
-- interval and the last row before kickoff is the closing state. See the writer's docstring.
--
-- Column meanings follow research/action-splits/README.md exactly, including its
-- orientation rule: the "away" slot is the AWAY team for spread/ml and the OVER for totals.
-- bets_*/money_* are the Action Network consensus percentages (book 15); *_open is the
-- opener (book 30); *_close/*_price are BEST ODDS across the real books at capture time.

create table if not exists public.action_public_splits (
    id                    bigserial primary key,
    snap_ts               timestamptz not null default now(),
    sport                 text        not null,          -- 'nfl' | 'cfb'
    season                integer     not null,
    week                  integer     not null,
    market                text        not null,          -- 'spread' | 'total' | 'ml'
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

-- the writer's own read: newest row per game-market for the weeks it just fetched
create index if not exists action_public_splits_key_idx
    on public.action_public_splits (sport, season, week, market, away, home, snap_ts desc);
-- research reads: a week, or a freshness probe
create index if not exists action_public_splits_week_idx
    on public.action_public_splits (sport, season, week, snap_ts desc);

-- One row per game-market, the latest. This is what snapshot_action.py diffs against, so
-- its cost stays flat in season length instead of growing with the log.
create or replace view public.action_public_splits_latest as
select distinct on (sport, season, week, market, away, home) *
from public.action_public_splits
order by sport, season, week, market, away, home, snap_ts desc;

-- RLS on with no anon policy, matching the other research-only tables (nfl_qb_scheme_splits):
-- the service key writes, the MCP explorer reads, no client surface reads it yet.
alter table public.action_public_splits enable row level security;

drop policy if exists action_public_splits_mcp_read on public.action_public_splits;
create policy action_public_splits_mcp_read
    on public.action_public_splits for select to mcp_explorer using (true);

grant select on public.action_public_splits to mcp_explorer;
grant select on public.action_public_splits_latest to mcp_explorer;
