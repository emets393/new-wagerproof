-- public.nfl_player_props_current — the live NFL player-prop board (CFB warehouse).
--
-- WHAT WAS WRONG (fixed 2026-09-23): the view was "latest line per (player, market, bookmaker)
-- within the last 9 days" with NO week filter. Nine days spans two NFL weeks, so any
-- (player, market, book) combination that had not yet had a line posted for the upcoming week
-- fell through to its PREVIOUS week's line — prices for games already played, sitting on a board
-- labelled "current". At the time of the fix that was 2,347 of 3,616 rows.
--
-- It was also slow: DISTINCT ON across ~2.0M rows ran ~1,248 ms. MCP users get a 12-second
-- statement budget, and the page builder had already been forced to work around it (see the
-- comment in research/nfl-extreme-outcomes/gen_nfl_prop_player_pages.py, which reads the base
-- table instead because this view 500'd the week-2 build). Week-scoping it made it ~13 ms.
--
-- Applied to the CFB project directly via the Management API (that project has no migration
-- history in this repo). Kept here so the definition is reviewable and re-appliable.

create or replace view public.nfl_player_props_current as
with cur as (
  -- nfl_slate_games is the app's week anchor; score_props_week.py and the prop-page builder
  -- resolve the current week the same way, so all three agree by construction.
  select season, week from public.nfl_slate_games order by season desc, week desc limit 1
)
select distinct on (p.player_id, p.market, p.bookmaker)
       p.player_id, p.player_name, p."position", p.team, p.market, p.line,
       p.over_odds, p.under_odds, p.bookmaker, p.season, p.week, p.snapshot_time
from public.nfl_player_props p
join cur c on p.season = c.season and p.week = c.week
order by p.player_id, p.market, p.bookmaker, p.snapshot_time desc;

comment on view public.nfl_player_props_current is
'Live NFL player-prop board: the latest line per (player, market, bookmaker) for the CURRENT slate
 week only, where current = max(season, week) in nfl_slate_games. Was previously a 9-day window
 with no week filter, which returned last week''s lines for any player/market/book that had no
 line posted yet this week — stale prices for games already played — and took ~1.2s. Now ~13ms.
 For history use nfl_player_prop_lines_history or nfl_player_props.';

-- Sanity check after applying: this must return 0.
--   select count(*) from nfl_player_props_current c
--    where (c.season, c.week)
--          <> (select season, week from nfl_slate_games order by season desc, week desc limit 1);
