# NBA player props — data contract for the apps

> Backend shipped 2026-10-16 (cfb_automation `scripts/cfb/nba_props_live.py`, `nba_props_slate.py`,
> Render cron `nba-props-live`, DDL `sql/nba_props.sql`). Frontend (web Props page NBA tab, iOS
> `PropsStore.Sport.nba`, Android) is being built separately. This doc is what the frontend reads.

All four objects live on the **CFB Supabase project** (`jpxnjuwglavsjbgbasnl`), readable with the anon key.

| object | what | key | refreshed |
|---|---|---|---|
| `nba_slate_props` | **The board.** One row per player × market for today's and tomorrow's games (ET). | `id` = `<event_id>:<market>:<athlete_id>` | hourly at :10, Oct–Jun |
| `nba_prop_defs` | Copy for every rule key that can appear in `nba_slate_props.flags`. Same shape as `nba_signal_defs`, including the back-test and current-season record columns (see `26_nba_signal_lifecycle.md`). | `signal_key` | hourly (idempotent); season record each morning |
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

**Rules** — `flags` (text[]): keys into `nba_prop_defs`; `flag_detail` (jsonb, `{key: {...}}`) carries per-flag
facts for the card. Four keys today:

| key | market | bet | fires when | `flag_detail[key]` |
|---|---|---|---|---|
| `nba_cold_line_raised_under` | any | UNDER | under his own close 3+ straight AND tonight's line ≥ 0.75 sd above his previous close | — |
| `nba_cold_line_raised_big_under` | any | UNDER | the above with the line in the top half of its market on the slate | — |
| `nba_player_ref_over` | `player_points` | OVER | ≥ 8 prior games with tonight's crew chief, points averaged ≥ 0.5 sd ABOVE his own norm | `chief`, `games`, `mean_z`, `avg_vs_norm` (pts), `above`, `below` (games above/below his norm with that chief) |
| `nba_player_ref_under` | `player_points` | UNDER | same, ≥ 0.5 sd BELOW his norm | same |
| `nba_hot_shooter_under` | `player_points` | UNDER | last 5 games he scored ≥ 3.0 pts/game above what his own career make-rates by zone (rim / mid / three, from play-by-play) say his shots were worth; line ≥ 12.5 | `heat_l5` |
| `nba_into_lineup_g2_over` | `player_points_rebounds_assists` | OVER | his last game was his first start after 5+ straight bench games (game 2 of the move); not listed out | `note` |
| `nba_out_of_lineup_g2_under` | `player_rebounds` | UNDER | his last game was his first off the bench after 5+ straight starts (game 2); not listed out | `note` |
| `nba_backup_same_pos_under` | `player_points_rebounds_assists` | UNDER | a 25+ mpg starter at his position (G/F/C) is OUT for the 1st/2nd game of the absence and he is still a bench player (no start in his last 3) | `out_player`, `out_mpg`, `games_missed_before`, `position` |
| `nba_blowout_star_pra_under` | `player_points_rebounds_assists` | UNDER | his team is a closing favorite of 13+, he is top-3 on the team in minutes per game this season, PRA line ≥ 20 | `team_spread`, `minutes_rank` |
| `nba_homecoming_pts_over` | `player_points` | OVER | visitor born within 50 miles of tonight's arena whose own arena is > 50 miles from his birthplace | `mi_site`, `mi_own`, `city`, `state`, `country`, `arena` |

One ticket per player-game for the cold rules: when several markets on the same player fire, the biggest
line (PRA) is the ticket. The cold rules need the player's previous close lines, which exist only from our own
capture, so expect none for roughly the first week of the season. The crew-chief rules need the day's
assignments (posted by the NBA ~9am ET, in `nba_officials` by 9:10), so they appear from the 10:10 board onward
and never on tomorrow's rows. Render the chief and the above/below count on the card ("9 of 13 games above his
norm with James Capers"). Records: `nba_prop_defs.record_text` (back-test) and `season_record_text` (this
season, kept by the grader) — show both.

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

Back-tests on every def row (best price, 2023-24 to 2025-26, three of three seasons): hot shooter 1,014-788 (56.3%), into lineup g2 276-235 (54.0%),
out of lineup g2 158-127 (55.4%), backup 806-656 (55.1%), blowout star 534-409 (56.6%), homecoming 258-213 (54.8%). Shipped 2026-10-28 (cfb_automation
`nba_prop_signals.py`, `nba_prop_heat.py`, `nba_prop_homecoming.py`; research `research/bball-odds/NBA_PP_BRIEF.md`). The game-ONE lineup versions
(58.6% / 60.6%) need a starting-lineup feed that posts after the line closes and are not built.

## What is not here yet

No opponent / positional-defence context. No model edge: the originator (points +7%, PRA +11% ROI at the
top-25% edge in research) is a later addition and will arrive as `model_pred` / `model_edge` columns plus
new `nba_prop_defs` keys; nothing existing changes. The agents' `get_props` tool serves NBA since 2026-10-19
(`nba_slate_props.game_id` = the view's balldontlie id is the join): a prop is bettable to an agent only when its row
carries a flag and the player is not Out/Doubtful; picks grade through `nba_player_box` in `grade-avatar-picks`.
