-- The current public-betting board: newest capture per (game_id, market), upcoming games only.
-- Read by the /public-betting web page — see .claude/docs/31_public_betting_page_brief.md.
-- CFB instance (jpxnjuwglavsjbgbasnl). Table: scripts/sql/action_public_splits.sql.
--
-- WHY A VIEW AND NOT A CLIENT-SIDE REDUCTION
--   action_public_splits is a CHANGE LOG — a row only when that game-market moved. "The
--   current board" is therefore the newest row per key, and `distinct on` does it in Postgres
--   against an index. A client doing max(snap_ts) itself would have to pull the whole season
--   to render tonight's slate and would get slower every week.
--
-- ⛔ SECURITY MODEL, DELIBERATE: this view is intentionally NOT `security_invoker`.
--   Postgres 15+ defaults a view to running with its OWNER's privileges, so anon reading this
--   view bypasses the base table's RLS — which is the point. anon gets exactly these columns,
--   for upcoming games, and nothing else; the raw log (every historical capture) stays
--   invisible to the anon key because the table's only policy is mcp_explorer.
--   ⛔ Do not "fix" this by adding an anon SELECT policy to action_public_splits — that would
--   expose the entire log to the public key. Same shape as the SECURITY DEFINER RPC behind
--   agent consensus (.claude/docs/18_agent_consensus.md).

create or replace view public.action_public_splits_board as
with latest as (
    select distinct on (game_id, market) *
    from public.action_public_splits
    order by game_id, market, snap_ts desc
)
select game_id, market, sport, season, week, slate_date, start_time, game_type,
       away, home, snap_ts,
       away_open, home_open, away_close, home_close, away_price, home_price,
       bets_away, bets_home, money_away, money_home, tickets,
       -- ⛔ A 0 or 100 on either side is NO DATA, not unanimity. Citadel @ Texas A&M read as
       -- "100% on the under" until someone looked. Every consumer gates on this; the page
       -- drops those games from the feed rather than rendering a fabricated bar.
       (bets_away is not null and bets_home is not null
        and bets_away not in (0, 100) and bets_home not in (0, 100)) as has_split
from latest
-- a 4-hour grace keeps a game on the board through its own kickoff rather than vanishing it
-- mid-slate; the capture itself stops updating once the books pull the market
where start_time > now() - interval '4 hours';

grant select on public.action_public_splits_board to anon, authenticated, mcp_explorer;
