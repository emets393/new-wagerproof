# NCAAB signals — the lifecycle contract for college basketball

> Backend shipped 2026-10-26 (cfb_automation `scripts/cfb/ncaab_hype_signal.py`, `scripts/cfb/ncaab_signal_grader.py`,
> `sql/ncaab_signal_lifecycle.sql`; Render crons `ncaab-hype-signal` and `ncaab-signal-grader`). Same standard as
> NBA (doc 26): every signal is born with its back-tested record and ROI as columns, the current season is graded every
> morning, and the season folds into the back-test at year end. No app surface renders these yet — that is Cursor's.

## Tables (CFB project `jpxnjuwglavsjbgbasnl`)

`ncaab_signal_defs` — one row per signal. Same columns as `nba_signal_defs`: `signal_key`, `display_name`, `market`,
`tier`, `one_liner`, `definition`, `why_it_works`, `bet_direction`, `typical_hit`, `default_conviction`, `record_text`
(rendered back-test), `backtest_wins/losses/pushes/roi/seasons/through`, `season_label`, `season_wins/losses/pushes/roi`,
`season_record_text` (rendered current season), `season_updated_at`. Render BOTH strings on a card.

`ncaab_slate_flags` — one row per game × signal × market, the line updated in place as it moves (never a second
ticket). Keys: `espn_game_id` (= ESPN event id, what the feed carries), `game_id` (College Basketball Data id),
`game_date` (ET), `season` (**END-year**: 2027 = 2026-27), `game` ("Away @ Home", CBBD names), `signal_key`, `market`,
`side` ("Virginia -4.5"), `line`, `bet_team`, `bet_line`, `conviction`, `tier`, `trigger_text` (plain language, ready to
print), `trigger_value`, `record_text`, then the grader's `result` (win / loss / push / void), `actual_value` (final home
minus away margin), `grade_price`, `graded_at`. Read-only to anon and authenticated.

## Signals

| key | market | rule | back-test | tier |
|---|---|---|---|---|
| `ncaab_hype_roster_fade` | spread | power-conference roster with 3+ top-50 recruits vs a power-conference opponent with 0-1, November–December, spread inside 12 → bet the opponent | 139-110-2 (55.8%), +6.6%, 2020-21 to 2025-26, five of six seasons | candidate (flags carry `tier = tracking`) |
| `ncaab_lookahead_dog` | spread | December–February conference play; the team's next game (within 7 days) is a conference game vs an AP top-25 team as of today; tonight the team is a 7-to-12-point dog in a regular-season conference game → back the dog | 161-139-4 (53.7%), +2.5%, six seasons, three of six winning | candidate (`tier = tracking`) |
| `ncaab_lookahead_big_dog` | spread | same spot, tonight a dog of 12.5 or more → back the dog | 82-52-2 (61.2%), +16.9%, six seasons, five of six winning | candidate (`tier = tracking`) |

Research: `research/ncaab-hype/README.md` and `research/ncaab-lookahead/README.md`. The hype fade is dormant outside
November–December and the look-ahead dogs outside December–February; def rows are refreshed on every run. Tournament games
(conference tournaments, the NCAA tournament, November bracket events) never qualify for the look-ahead signals, tonight or next. A flag exists only once a spread is posted, so opening-week games appear the morning their line does.

## Timing

- `ncaab-hype-signal`: 10:00am and 4:00pm ET, November–February. Runs the hype fade then the look-ahead dogs; writes flags for
  games tipping today through two days out; removes a flag whose game no longer qualifies before tip.
- `ncaab-signal-grader`: 7:30am ET, November–April. Grades yesterday's flags from College Basketball Data finals and
  rewrites the season columns on the defs. `--rollover` is run by hand in June.

## For Cursor

Same shape as the NBA signals card: the flag's `side`, `trigger_text`, and the def's `record_text` + `season_record_text`.
`tier = tracking` means show the read, do not badge it as a play. Join on `espn_game_id`; the NCAAB feed row carries it.
