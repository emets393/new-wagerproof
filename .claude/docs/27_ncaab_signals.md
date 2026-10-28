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
| `ncaab_new_coach_bottom_kenpom` | spread | the team changed head coaches since last season (KenPom `Coach` field, this year vs last) and KenPom's preseason AdjEM rank is in the bottom 20% of Division I (293+ of 365); every November–December game, any venue, favorite or dog → back the team | 526-428 (55.1%), +5.2%, 2021-22 to 2025-26, five of five seasons | candidate (`tier = tracking`) |
| `ncaab_third_meeting_under` | total | the two teams have played twice already this season (any venue); tonight is the third meeting → bet UNDER the posted total. Fourth meetings not flagged | 712-598-15 (54.4%), +3.8%, 2020-21 to 2025-26, six of six at .500 or better | candidate (`tier = tracking`) |
| `ncaab_road_dog_band` | spread | true road game (not neutral); away team +10.5 to +17 at the consensus; the away team's last game was at home or neutral (first stop of a trip) and it has already played a true road game this season → back the road dog | 1,049-871 (54.6%), +4.3%, six of six seasons (refined 2026-10-28 from 2,233-1,993 all road dogs in the band) | candidate (`tier = tracking`) |
| `ncaab_three_point_luck_storm` | spread | team's shooters are ≥ 3.1 pts/game BELOW their own three-point rates over the last 5 games (shooter by shooter, career prior shrunk to league) and the opponent's are ≥ 4.1 ABOVE → back the cold team | 1,740-1,538-46 (53.1%), +1.3%, 2020-21 to 2025-26, five of six seasons | candidate (`tier = tracking`, conviction low) |
| `ncaab_lost_controlling_2h` | spread | team's last game was a regulation loss in which its time-weighted win probability over the 2nd half was ≥ .60 (CBBD play-by-play) → back it in its next game | 1,075-908-24 (54.2%), +3.5%, six of six seasons | candidate (`tier = tracking`) |
| `ncaab_small_vs_big_d_over` | total | team A: 3PA rate bottom quarter AND 3P% below median (season to date, ≥ 6 games); team B: KenPom effective height ≥ +1.0" taller AND KenPom AdjDE top 20% as of today → bet OVER | 258-176 (59.4%), +13.4%, 2020-21 to 2025-26, six of six seasons | candidate (`tier = tracking`) |
| `ncaab_bad_o_great_d_over` | total | team A KenPom AdjOE rank in the bottom 20% of D-I AND team B KenPom AdjDE rank in the top 20%, as of today (fires from opening night) → bet OVER | 350-269 (56.5%), +7.9%, 2020-21 to 2025-26, five of six seasons | candidate (`tier = tracking`) |
| `ncaab_first_road_game_fade` | spread | true road game; the away team has no earlier completed true road game this season (opener or all home/neutral so far); the away team is NOT a 10.5-17 dog (that is the road-dog spot, a coin flip) → back the HOME team | 933-766 (54.9%), +4.9%, six of six seasons; visitor favored 243-185 (56.8%) | candidate (`tier = tracking`; conviction med when the visitor is favored) |

Research: `research/ncaab-hype/README.md`, `research/ncaab-lookahead/README.md`, `research/ncaab-continuity/README.md`,
`research/ncaab-size-defense/README.md`, `research/ncaab-matchups/README.md`, `research/ncaab-calendar/README.md`, `research/ncaab-road-trips/README.md`, and `research/bball-odds/CBB_PORT_BRIEF.md` + `CBB_WP_LUCK_DEEP_BRIEF.md` for the third-meeting,
road-dog, luck-storm and second-half-control reads (September 2026 port of the NBA session). One script per signal in
`cfb_automation/scripts/cfb/ncaab_*_signal.py`, sharing `ncaab_signal_lib.py` (CBBD schedule, Odds API consensus with the
neutral-site flip, flag row, stale-flag removal). The hype
fade and the new-coach back are dormant outside November–December and the look-ahead dogs outside December–February; def rows are
refreshed on every run. The new-coach signal freezes its qualifying list for the season on its first run (Storage
`ncaab_model/<season>/signals/new_coach.json`), so a mid-season coaching change or a rating move never adds or drops a team. Tournament games
(conference tournaments, the NCAA tournament, November bracket events) never qualify for the look-ahead signals, tonight or next. A flag exists only once a spread is posted, so opening-week games appear the morning their line does.

## Timing

- `ncaab-hype-signal`: 10:00am and 4:00pm ET, November–April. Runs every situational signal in turn (hype fade, look-ahead dogs,
  new-coach back, third-meeting under, road dog, luck storm, second-half-control back, size-vs-defense over, bad-offense-vs-great-defense
  over, first-road-trip fade); writes flags for games
  tipping today through two days out; removes a flag whose game no longer qualifies before tip.
- `ncaab-model-nightly`: 8:30am, 12:30pm, 4:30pm, 6:30pm ET, October–April. Refreshes the season's feeds, refits, prices
  every game of the next two days that has a line, writes the three tables above. **Opening of the season** (owner call
  2026-10-27, same as the CFB slate): through 14 days after the first tip, every game with a posted line is priced however
  far out, so the first games appear as soon as books post them. Cards should therefore not assume a two-day horizon.
  The Odds API lists neutral-site games home/away opposite of CBBD; the job matches the unordered pair and flips the spread.
- `ncaab-signal-grader`: 7:30am ET, November–April. Grades yesterday's flags from College Basketball Data finals and
  rewrites the season columns on the defs. `--rollover` is run by hand in June.

## For Cursor

Same shape as the NBA signals card: the flag's `side`, `trigger_text`, and the def's `record_text` + `season_record_text`.
`tier = tracking` means show the read, do not badge it as a play. Join on `espn_game_id`; the NCAAB feed row carries it.
