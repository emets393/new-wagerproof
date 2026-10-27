# NCAAB model + signals — the contract for college basketball

> Backend shipped 2026-10-26 (cfb_automation `scripts/cfb/ncaab_hype_signal.py`, `scripts/cfb/ncaab_signal_grader.py`,
> `sql/ncaab_signal_lifecycle.sql`; Render crons `ncaab-hype-signal` and `ncaab-signal-grader`). Same standard as
> NBA (doc 26): every signal is born with its back-tested record and ROI as columns, the current season is graded every
> morning, and the season folds into the back-test at year end. No app surface renders these yet — that is Cursor's.
>
> **Model (2026-10-27):** the college ORIGINATOR is in production (`scripts/cfb/ncaab_model_nightly.py` + `ncaab_model/`,
> Render cron `ncaab-model-nightly`). The old market-aware xgboost that wrote `ncaab_predictions` is deleted. See "The model" below.

## The model

The research originator from `research/bball-odds/` (`CBB_VERDICT.md`, independent audit `CBB_MODEL_AUDIT.txt`): one
recency-weighted ridge on a team-game panel predicting a team's points minus the market-implied team total, 230 pregame
features, **no posted line or price as an input**. Lines come from The Odds API only. The spread is home minus away of the two
team predictions. **The bet is where the model and the line disagree by 1.5 to 4 points**: 7,640 bets, 54.9%, +4.9% over six
seasons, every season 54.2–55.9%. At 4+ points the line has been better than the model, so that is not a bet.

Tables (CFB project):

- `ncaab_model_preds` — one row per game × market (`spread`, `total`). `model_home_margin` (home minus away, the model's
  number), `model_total`, `market_home_spread` / `market_total` (consensus median across books), `disagreement`
  (spread: model margin + posted spread, so positive = model likes the home side), `tier` (`bet` inside the 1.5–4 band,
  else `pass`), `bet_side` ("Memphis +12.5"), `bet_team`, `bet_line`, `home_win_prob`, `sigma`, `as_of`. `game_id` is
  the College Basketball Data id (= `v_cbb_input_values.game_id`); `espn_game_id` is the ESPN event id. Updated in place
  four times a day; a tipped game keeps its last pre-tip row.
- `ncaab_predictions` — unchanged contract for the apps (latest `run_id`), but **every column now comes from the
  originator**: `home_win_prob = Φ(model margin / σ)`, `model_fair_home_spread = -margin`, fair moneylines from the
  probability, `pred_total_points`, scores = (total ± margin) / 2, `vegas_home_spread` / `vegas_total` = the consensus line.
  The totals are display-only (the verdict found no points-off-the-line rule on the total).
- The model's own signal `ncaab_originator_spread` (below) is written to `ncaab_slate_flags` for the bet band.

Cards should show the model line, the posted line, the disagreement, and badge only `tier = bet`. The old
`model_fair_*`-as-the-product semantics are gone with the xgboost.

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
| `ncaab_originator_spread` | spread | the originator's spread is 1.5 to 4 points off the posted line → bet the model's side | 4,197-3,443 (54.9%), +4.9%, 2020-21 to 2025-26, six of six seasons | **active** |
| `ncaab_hype_roster_fade` | spread | power-conference roster with 3+ top-50 recruits vs a power-conference opponent with 0-1, November–December, spread inside 12 → bet the opponent | 139-110-2 (55.8%), +6.6%, 2020-21 to 2025-26, five of six seasons | candidate (flags carry `tier = tracking`) |
| `ncaab_lookahead_dog` | spread | December–February conference play; the team's next game (within 7 days) is a conference game vs an AP top-25 team as of today; tonight the team is a 7-to-12-point dog in a regular-season conference game → back the dog | 161-139-4 (53.7%), +2.5%, six seasons, three of six winning | candidate (`tier = tracking`) |
| `ncaab_lookahead_big_dog` | spread | same spot, tonight a dog of 12.5 or more → back the dog | 82-52-2 (61.2%), +16.9%, six seasons, five of six winning | candidate (`tier = tracking`) |

Research: `research/ncaab-hype/README.md` and `research/ncaab-lookahead/README.md`. The hype fade is dormant outside
November–December and the look-ahead dogs outside December–February; def rows are refreshed on every run. Tournament games
(conference tournaments, the NCAA tournament, November bracket events) never qualify for the look-ahead signals, tonight or next. A flag exists only once a spread is posted, so opening-week games appear the morning their line does.

## Timing

- `ncaab-hype-signal`: 10:00am and 4:00pm ET, November–February. Runs the hype fade then the look-ahead dogs; writes flags for
  games tipping today through two days out; removes a flag whose game no longer qualifies before tip.
- `ncaab-model-nightly`: 8:30am, 12:30pm, 4:30pm, 6:30pm ET, November–April. Refreshes the season's feeds, refits, prices
  every game of the next two days that has a line, writes the three tables above.
- `ncaab-signal-grader`: 7:30am ET, November–April. Grades yesterday's flags from College Basketball Data finals and
  rewrites the season columns on the defs. `--rollover` is run by hand in June.

## For Cursor

Same shape as the NBA signals card: the flag's `side`, `trigger_text`, and the def's `record_text` + `season_record_text`.
`tier = tracking` means show the read, do not badge it as a play. Join on `espn_game_id`; the NCAAB feed row carries it.
