# NBA player props — data contract for the apps

> Backend shipped 2026-10-16 (cfb_automation `scripts/cfb/nba_props_live.py`, `nba_props_slate.py`,
> Render cron `nba-props-live`, DDL `sql/nba_props.sql`). Frontend (web Props page NBA tab, iOS
> `PropsStore.Sport.nba`, Android) is being built separately. This doc is what the frontend reads.

All four objects live on the **CFB Supabase project** (`jpxnjuwglavsjbgbasnl`), readable with the anon key.

| object | what | key | refreshed |
|---|---|---|---|
| `nba_slate_props` | **The board.** One row per player × market for today's and tomorrow's games (ET). | `id` = `<event_id>:<market>:<athlete_id>` | hourly at :10, Oct–Jun |
| `nba_prop_defs` | Copy for every rule key that can appear in `nba_slate_props.flags`. Same shape as `nba_signal_defs`. | `signal_key` | hourly (idempotent) |
| `nba_player_props_current` | View: the latest line at every book for every player/market, games from yesterday on. Use for a "shop the line" table. | (`event_id`,`bookmaker`,`market`,`player_name`) | live |
| `nba_player_props` | Raw history: one row each time a book's number moved. Use for a line-movement chart. Grows large; always filter by `event_id` or `athlete_id` + `game_date`. | `id` | hourly |

Season label is the hoopR END-year (`2027` = 2026-27). Ids are ESPN (`espn_game_id` matches
`nba_schedule`, `nba_model_preds`, `nba_slate_flags`; `athlete_id` matches `nba_player_box`, `nba_rosters`).
Prices are American integers. Markets (10): `player_points`, `player_rebounds`, `player_assists`,
`player_threes`, `player_blocks`, `player_steals`, `player_points_rebounds_assists`, `player_points_rebounds`,
`player_points_assists`, `player_rebounds_assists`; `market_label` carries the display string.

## What the board is, and is not

It is a **stats summarisation of the player's own game log against the posted line** (owner rule,
2026-10-06: "prop cards = narrative, not prediction; rank + sample always; no verdict verbs"). Nothing on it
is a model pick. `baseline` is an exponentially weighted recent average, a form anchor; do not label it
"projection" or "model". The one thing that is a bet is a row whose `flags` is non-empty, and the copy for
it comes from `nba_prop_defs` (record from the bet's side, wins first).

## `nba_slate_props` columns

**Who / where** — `game` ("BOS @ DET"), `game_date`, `commence_time`, `home_abbr`, `away_abbr`,
`athlete_id`, `player_name`, `position`, `team`, `opponent`, `is_home`, `headshot_url` (ESPN CDN; falls
back to nothing when `athlete_id` is null, which means the book's name did not match our roster — show the
row without a game log).

**The market right now** — `line` (consensus = median across books), `n_books`, `over_price` /
`under_price` (median price at the consensus line), `line_range` (max − min across books).
`best_over_book` / `best_over_line` / `best_over_price` is the lowest number, then the best price;
`best_under_*` the highest number, then the best price. Book keys: `draftkings`, `fanduel`, `betmgm`,
`williamhill_us` (= Caesars).

**Movement** — `open_line` (consensus of each book's first captured line), `line_delta` (= line − open).
`prev_line` is his closing line in this market in his previous game (within 10 days), `prev_line_delta`,
`prev_line_z` (delta in units of his own last-10 result sd). Null until our capture has a previous game.

**His game log vs this line** — `gp_prior` (games this season), `last_game`, `l3_avg`, `l5_avg`,
`l10_avg`, `szn_avg`, `szn_max`, `szn_min`, `prior_szn_avg`, `prior_szn_gp`, `min_l5` (minutes),
`over_rate_l5` / `over_rate_l10` / `over_rate_szn` (share of games ABOVE tonight's line — render as
"7 of 10 over 24.5", never as a probability), `below_line_streak` (consecutive games below tonight's
line), `under_streak` (consecutive games under his OWN closing line; the rule's input), `result_sd`.
`recent_games` is the last 10 as JSON: `[{date, opp, ha, min, value, line, result}]` where `line`/`result`
are that game's close and outcome when we have them. Early in the season the log is mostly last season
(`prior_szn_*`); say so when `gp_prior` is small.

**Form anchor** — `baseline` (EWMA, half-life 5 games over the last 15), `baseline_gap` (= baseline − line).

**Rules** — `flags` (text[]): keys into `nba_prop_defs`. Today: `nba_cold_line_raised_under` and
`nba_cold_line_raised_big_under` (both UNDER). One ticket per player-game: when several markets on the
same player fire, the biggest line (PRA) is the ticket. These need the player's previous close lines,
which exist only from our own capture, so expect no flags for roughly the first week of the season.

**Ranking** — `rank_pos` (1 = top of the slate), `rank_tier`: `flag` (a rule fired), `watch`
(|baseline_gap| ≥ one result sd), `board`. Ordering only; do not render the score.

**Availability** — `report_status` / `report_detail` from the latest `nba_injury_report` row for the
player (Out, Doubtful, Questionable, Probable, Available). Rows for players marked Out stay on the board
so the user sees why a line vanished or jumped; the UI should grey them.

**After the game** — `actual_value`, `result` (`over` | `under` | `push` | `void` = did not play),
`graded_at`. Rows for finished games stay until the next day's rebuild removes them, so yesterday's board
is readable for a short while; for a record over time read `nba_player_props` where `result is not null`.

## Reading patterns

```sql
-- today's board, ranked
select * from nba_slate_props where game_date = current_date order by rank_pos;
-- one player's card
select * from nba_slate_props where athlete_id = 4066648 and game_date = current_date;
-- shop the line
select bookmaker, line, over_odds, under_odds from nba_player_props_current
 where event_id = '…' and market = 'player_points' and player_name = 'Jayson Tatum';
-- movement chart
select snapshot_time, bookmaker, line, over_odds, under_odds from nba_player_props
 where event_id = '…' and market = 'player_points' and player_name = 'Jayson Tatum' order by snapshot_time;
```

## What is not here yet

No opponent / positional-defence context. No model edge: the originator (points +7%, PRA +11% ROI at the
top-25% edge in research) is a later addition and will arrive as `model_pred` / `model_edge` columns plus
new `nba_prop_defs` keys; nothing existing changes. The agents' `get_props` tool is still NFL-only.
