-- Key catalog for public.fp_data (CFB warehouse, project jpxnjuwglavsjbgbasnl).
--
-- fp_data holds the Fantasy Points Data Suite, 2021-present, ~1.6M rows across 28 tools, and the
-- per-tool stats live in a `stats` jsonb. There are 1,136 distinct keys and the names are long and
-- unguessable (playerStatsFantasyPointsHalfPpr, marketShareReceivingYardsTotal). A user — or an AI
-- writing SQL through the MCP connector — that guesses a key gets zero rows back with no error,
-- which reads as "no data" rather than "wrong key". This table is the fix: query it first.
--
-- Applied to the CFB project directly via the Management API (that project has no migration
-- history in this repo — see the mcp-sql-exploration-layer note). Kept here so the definition is
-- reviewable and re-appliable.

create table if not exists public.fp_data_keys (
  tool          text   not null,
  scope         text   not null,           -- player | team (own offense) | opponent (defense faced)
  stat_key      text   not null,           -- the jsonb key, used as stats->>'<stat_key>'
  n_rows        bigint,                    -- fp_data rows carrying this key
  first_season  int,
  last_season   int,
  value_kind    text,                      -- jsonb_typeof: number | string | object | boolean
  sample_value  text,                      -- most recent season's value, so the shape is obvious
  refreshed_at  timestamptz default now(),
  -- Every tool repeats bookkeeping fields — *Label text buckets, *GamesPlayed counters, a nested
  -- `bucket` object — and they are among the highest-row-count keys, so ordering by n_rows alone
  -- buries the real stats underneath them. Filter on this instead.
  is_measure boolean generated always as (
    value_kind = 'number'
    and stat_key not like '%GamesPlayed'
    and stat_key not like '%Label'
  ) stored,
  primary key (tool, scope, stat_key)
);

grant select on public.fp_data_keys to mcp_explorer;

-- Rebuild. Loops one (tool, scope) at a time on purpose: expanding jsonb_each across all ~1.6M
-- fp_data rows in one statement takes long enough to hit a gateway timeout (it did, on
-- receivingSeparationByCoverage), and a per-slice loop also lets a single tool be refreshed
-- cheaply after a weekly load. Pass p_tool to do just one.
create or replace function public.refresh_fp_data_keys(p_tool text default null)
returns integer language plpgsql security definer set search_path to 'public','pg_temp' as $fn$
declare
  r record; total int := 0;
begin
  for r in select distinct tool, scope from public.fp_data
           where p_tool is null or tool = p_tool
  loop
    delete from public.fp_data_keys k where k.tool = r.tool and k.scope = r.scope;
    insert into public.fp_data_keys
      (tool, scope, stat_key, n_rows, first_season, last_season, value_kind, sample_value, refreshed_at)
    select r.tool, r.scope, kv.key, count(*), min(f.season), max(f.season),
           mode() within group (order by jsonb_typeof(kv.value)),
           (array_agg(kv.value::text order by f.season desc))[1],
           now()
    from public.fp_data f, lateral jsonb_each(f.stats) kv
    where f.tool = r.tool and f.scope = r.scope
    group by kv.key;
    total := total + 1;
  end loop;
  return total;
end $fn$;

grant execute on function public.refresh_fp_data_keys(text) to service_role;

comment on table public.fp_data_keys is
'Key catalog for public.fp_data. One row per (tool, scope, stat_key) naming every stat inside that
 tool''s `stats` jsonb, with how many fp_data rows carry it, the seasons it spans, its JSON type and
 an example value. START HERE before querying fp_data: the jsonb keys are long and unguessable, and
 picking a key that does not exist for a tool silently returns zero rows. Add "where is_measure"
 to skip the *Label / *GamesPlayed bookkeeping keys. Rebuilt by public.refresh_fp_data_keys().';

comment on table public.fp_data is
'Fantasy Points Data Suite (data.fantasypoints.com): one row per player-game or team-game per
 tool/scope (scope = player | team=offense | opponent=defense). FULL HISTORY 2021-present, ~1.6M
 rows, 28 tools. Per-tool stats live in the `stats` jsonb — the key names are long and NOT
 guessable (e.g. playerStatsFantasyPointsHalfPpr, marketShareReceivingYardsTotal), so query
 public.fp_data_keys FIRST to find the exact key for a tool/scope before writing a stats->>
 expression. Written by research/nfl-extreme-outcomes/fp_load.py.';

-- Typical use:
--   select stat_key, n_rows, first_season, last_season, sample_value
--     from fp_data_keys where tool = 'receivingManVsZone' and scope = 'player' and is_measure
--     order by n_rows desc;
--   select season, round(avg((stats->>'playerStatsReceivingRoutesTotal')::numeric), 1)
--     from fp_data where tool = 'receivingManVsZone' and scope = 'player'
--       and stats ? 'playerStatsReceivingRoutesTotal' group by 1 order by 1;
