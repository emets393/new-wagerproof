# update-polymarket-cache

Hourly refresh of the Polymarket price-history cache that every game card and
Market Odds widget reads (`polymarket_markets` in Main Supabase). Triggered by
pg_cron job `update-polymarket-cache-hourly` (`0 * * * *`) via pg_net.

## What it does

1. **Loads this week's games from the slate tables the apps render** —
   `nfl_slate_feed`, `cfb_slate_feed`, `mlb_games_today`, `nba_input_values_view`,
   `v_cbb_input_values` (sports-data project). Window: kickoff in the next 8 days,
   or started in the last 8 hours. Leagues with no games are skipped entirely.
2. **Pulls only moneyline / spread / total markets** from
   `gamma-api.polymarket.com/markets?tag_id=…&sports_market_types=…&end_date_min=…&end_date_max=…`,
   one page at a time, folding each page into slim per-event buckets before the
   next page is fetched. Sub-events (`… - Player Props`, inning winners) and series
   markets never make it past `isMainGameTitle`.
3. **Matches each slate game to an event**: NFL by the slate's `away_ab`/`home_ab`
   against the Polymarket slug (`nfl-ne-sea-2026-09-10`), MLB by exact title, the
   rest by the original substring matcher (`lib.ts`).
4. **Fetches each token's price history** from `clob.polymarket.com` (batches of 15)
   and upserts one row per `(game_key, market_type)`.
5. **Drops stale rows** on every key it refreshed (rows older than this run), so a
   rematch under a date-less key stops showing last season's resolved 100/0 market.
6. Writes the slim event list per league to `polymarket_events` for the web
   client's browser-side fallback (`src/services/polymarketService.ts`).

## Cache key — read this before touching team names

`game_key = {league}_{away_team}_{home_team}` using the **exact strings the
clients render**. For NFL that is the slate's full name
(`nfl_New England Patriots_Seattle Seahawks`). The writer used to key NFL rows
from `nfl_betting_lines` short names (`nfl_New England_Seattle`); when the feeds
moved to `nfl_slate_feed` on 2026-09-01 every NFL lookup missed and all three
apps showed "Market pending". Both keys are written now: the full-name key is
canonical, the short-name key (`legacyNflNames`) keeps pre-2026-09-01 app builds
working.

MLB already used full names on both sides; CFB uses school names.

## Why it is shaped this way

The previous version fetched every open event for five leagues with
`related_tags=true` (~90 MB of JSON once Week 1 props went live) into one worker
and re-serialised it into `polymarket_events`. That exceeds the edge runtime's
256 MB / 2 s-CPU budget and it died with `WORKER_RESOURCE_LIMIT` (HTTP 546) every
hour from 2026-09-08 18:00 UTC. The `/markets` type filter plus the dated window
brings a full run to a few MB. Keep it that way: never fetch `/events` for a
whole league here.

## Running it

```bash
# Real run (what cron does)
curl -X POST "$SUPABASE_URL/functions/v1/update-polymarket-cache" \
  -H "Authorization: Bearer $ANON_KEY" -H "apikey: $ANON_KEY" -d '{}'

# Match report without writing anything
curl -X POST ... -d '{"dry_run": true}'

# Unit tests (pure helpers only)
deno test --no-lock --allow-net=deno.land supabase/functions/update-polymarket-cache/lib_test.ts
```

The response carries `stats[league].unmatched` — the slate games Polymarket did
not list — and `errors` for failed CLOB fetches or upserts.

## Known gaps

- Spread/total pick the first active market by id (the opening line), not the
  line closest to Vegas. gamma-api exposes `line` per market if that is wanted.
- The two markets' `current_away_odds` is the YES price of the market's first
  token, which for spreads/totals is the listed side / the over, not the away team.
