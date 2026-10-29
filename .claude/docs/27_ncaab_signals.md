# NCAAB model + signals — the contract for college basketball

> Backend shipped 2026-10-26, full situational stack 2026-10-28 (15 signals; cfb_automation `scripts/cfb/ncaab_*_signal.py` sharing
> `ncaab_signal_lib.py`, `ncaab_signal_grader.py`; Render crons `ncaab-hype-signal` (all signals, Nov–Apr) and `ncaab-signal-grader`). Same standard as
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
`game_date` (ET), `season` (**END-year**: 2027 = 2026-27), `game` ("Away @ Home", CBBD names), `signal_key`, `market`
(`spread`, `total`, `h1_spread`), `side` ("Virginia -4.5"), `line`, `bet_team`, `bet_line`, `conviction`, `tier`,
`trigger_text` (plain language, ready to print), `trigger_value`, `record_text`, then the grader's `result` (win / loss /
push / void), `actual_value` (final home minus away margin; first-half margin for `h1_spread`), `grade_price`, `graded_at`.
Read-only to anon and authenticated.

**The app-surface tables (built 2026-10-28, all public-read):**

| table | one row per | what it is |
|---|---|---|
| `ncaab_model_preds` | game × market: `spread`, `total`, `h1_spread`, `h1_total` | the originator vs the posted line. On the two first-half rows the `model_*` / `market_*` columns hold FIRST-HALF numbers. First-half rows exist only once a first-half line is posted (books post them inside ~36h of tip). |
| `ncaab_predictions` | game (latest `run_id`) | moneyline / win-probability surface, every number from the model spread |
| `v_cbb_input_values` | upcoming game | the feed row: `neutral_site`, `tournament`, `game_type`, `broadcasts`, `time_tbd`, `home/away_conference`, AP `home/away_ranking`, full-game `spread` / `over_under` / moneylines, and the first-half + team-total lines (`h1_spread`, `h1_total`, `h1_home/away_moneyline`, `home/away_team_total`, `h1_lines_as_of`) |
| `ncaab_team_trends` | team × season (365 rows, rebuilt 6:30am ET) | season record in 7 markets, last-5 strings, `game_log`, `splits`, `matchups` (head-to-head vs every opponent on this season's schedule, all 7 markets, meetings listed). Football `*_team_trends` contract, keyed by CBBD `team_id`. |
| `ncaab_games_hist` | game, 2020-21 → today (35k rows) | the warehouse behind the trends: scores incl. first half, consensus close in every market. Drill-down only; the UI should read `ncaab_team_trends`. |
| `ncaab_team_ratings` | team × season (latest, 6:30am ET) | the "Ratings" table: efficiency margin, adjusted offense/defense, tempo, luck, schedule strength, four factors, shooting, height, experience, bench, continuity, each with national rank. Placeholder fields are NULL until games are played. |
| `ncaab_fanmatch_daily` | game of the day | projected score, home win probability, projected tempo, **thrill score** (0–100). Display only. Join `cbbd_game_id` = feed `game_id`. |

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
| `ncaab_thin_bench_long_trip` | spread | true road game; the away team's two previous games were true road games (third-or-later in a row); its KenPom bench-minutes share is in the bottom 20% of D-I; it is an underdog → back the visitor | 290-213 (57.7%), +10.1%, 2020-21 to 2025-26, five of six seasons | candidate (`tier = tracking`) |
| `ncaab_ranked_upset_back` | spread | the team's last game (regular season) was a win over an AP top-25 team (poll in force that day) while the team was unranked AND an underdog on the closing spread (`cbb_team_lines_history`); tonight is a regular-season game → back the team | 254-194 (56.7%), +8.3%, 2020-21 to 2025-26, five of six seasons; 4+ days off 140-87 (61.7%) | candidate (`tier = tracking`) |
| `ncaab_home_thriller_letdown` | spread | the home team's previous game was a true home game (regular season) with a KenPom FanMatch thrill score ≥ 60 (morning-of value for that date), played FOUR OR MORE days ago; tonight is a regular-season home game → back the VISITOR. Three or fewer days between the games does not qualify (coin flip) | 228-154 (59.7%), +13.9%, 2020-21 to 2025-26, six of six seasons | candidate (`tier = tracking`) |

Research: `research/ncaab-hype/README.md`, `research/ncaab-lookahead/README.md`, `research/ncaab-continuity/README.md`,
`research/ncaab-size-defense/README.md`, `research/ncaab-matchups/README.md`, `research/ncaab-calendar/README.md`, `research/ncaab-road-trips/README.md`, `research/ncaab-hangover/README.md`, and `research/bball-odds/CBB_PORT_BRIEF.md` + `CBB_WP_LUCK_DEEP_BRIEF.md` for the third-meeting,
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
  over, first-road-trip fade, thin-bench long-trip dog, ranked-upset back, home-thriller letdown); writes flags for games
  tipping today through two days out; removes a flag whose game no longer qualifies before tip.
- `ncaab-model-nightly`: 8:30am, 12:30pm, 4:30pm, 6:30pm ET, October–April. Refreshes the season's feeds, refits, prices
  every game of the next two days that has a line, writes the three tables above. **Opening of the season** (owner call
  2026-10-27, same as the CFB slate): through 14 days after the first tip, every game with a posted line is priced however
  far out, so the first games appear as soon as books post them. Cards should therefore not assume a two-day horizon.
  The Odds API lists neutral-site games home/away opposite of CBBD; the job matches the unordered pair and flips the spread.
- `ncaab-signal-grader`: 7:30am ET, November–April. Grades yesterday's flags from College Basketball Data finals and
  rewrites the season columns on the defs. `--rollover` is run by hand in June.

## Data pipeline — how the season's data accumulates (audited 2026-10-28)

Every input is pulled incrementally from the live sources as games are played; nothing needs loading by hand. All crons are in
`cfb_automation/render.yaml` (CFB Supabase project).

| data | source | job (UTC) | before the first game | after |
|---|---|---|---|---|
| schedule, finals, ESPN ids | CBBD `/games`, **weekly chunks** | `ncaab-model-nightly` 13:30/17:30/21:30/23:30; `nba-boxscores-and-ratings` 10:00 → `cbb_game_schedule` | full 2026-27 schedule already in (5,000+ games; feed view 213 games Nov 1–3) | finals appear the morning after |
| team / player box, play-by-play | CBBD `/games/teams` (weekly), `/games/players` (daily), `/plays/date` (daily) | `ncaab-model-nightly`, cached per finished day in Storage `ncaab_model/<season>/…` | skipped (0 finals) | fetched from the first morning; the model trains on this season's graded games with a close |
| adjusted O/D/pace, trends | CBBD team box → `cbb_team_pregame_metrics` | `cbb-metrics-and-nba-form` 10:30 (weekly chunks) | empty by design — `adj_*` columns null in the feed | filled daily from Nov 2 |
| roster experience / continuity / height | KenPom `height?y=` → `cbb_preseason_roster_talent` (`cbb_roster_talent_kenpom.py`) | `cbb-metrics-and-nba-form` 10:30 | KenPom publishes zeros until games are played → columns null | z-scored indices daily; `ws_prev_*` / `roster_count*` have no source and stay null |
| KenPom ratings | `archive?d=` (dated, leak-safe) with `ratings?y=` fallback | `ncaab-model-nightly` | archive 404s → live preseason ratings | dated archive cached per day |
| AP / coaches polls | CBBD `/rankings` (signals), ESPN → `cbb_rankings_daily` (feed) | signal chain; 10:00 | preseason polls in | weekly |
| lines, closes | The Odds API → `cbb_team_lines_history` (every run), live medians in the model/signal jobs | `nba-cbb-odds-and-predictions` 11,15,18 and **hourly 20–02** so the last capture before tip ≈ T-60 | 7 opening games priced | every priced game |
| power ratings, luck | TeamRankings → `ncaab_ratings` | `ncaab-teamrankings-schedule` 11:00/12:00, `nba_ncaab_ratings.py` 10:00 | in (365 teams) | daily |
| signal flags, grading | the 13-job chain → `ncaab_slate_flags`; `ncaab_signal_grader.py` (finals via weekly chunks) | `ncaab-hype-signal` 15:00/21:00; `ncaab-signal-grader` 12:30 | 0 flags (no spreads yet beyond 7 games; most signals need played games) | flags from the first posted lines; graded 7:30am ET |

**Trap fixed 2026-10-28:** a CBBD response silently caps (≈1,600 rows on `/games`, 3,000 on `/games/teams`). A November month
exceeds both, so the monthly pulls in the model feed, the signal library, the flow-loss job, the metrics builder and the
grader's season-level finals call all dropped games. Everything now pulls in weekly chunks. Also fixed: the preseason KenPom
height table is all zeros and was feeding the model literal 0 (all-freshman, no bench) — it is NaN until games are played.

## For Cursor — the full wiring brief (2026-10-28, revised the same evening with the app-surface tables)

**Status:** the backend is complete and live. 16 signal defs (15 situational + the first-half model band), the originator model in four
markets, the grader, the ratings / head-to-head / thrill-score jobs and every cron run in production; nothing on the app side renders them
yet. Everything below reads from the CFB Supabase project (`jpxnjuwglavsjbgbasnl`). No new backend work is needed to wire the UI; if a
field is missing, ask rather than guess. Web (`src/features/games/detail/sections/ncaab/`), iOS native and Android native all get the same
sections; the football team-trends components already render the `*_team_trends` contract, so reuse them.

### Tables, exactly as written
| table | one row per | key columns the UI needs |
|---|---|---|
| `v_cbb_input_values` | upcoming game (`game_id` = CBBD id; **join everything on `game_id`**) | `home_team`, `away_team`, `home_team_id`, `away_team_id`, `game_date_et`, `tipoff_time_et`, `start_utc`, `time_tbd`, **`neutral_site`**, `tournament`, `game_type` (STD / TRNMNT / CONF_TRNMNT / NCAA…), `broadcasts`, `conference_game`, `home/away_conference`, `home/away_ranking` (AP), `spread` (home), `over_under`, `homeMoneyline`, `awayMoneyline`, `h1_spread` (home), `h1_total`, `h1_home_moneyline`, `h1_away_moneyline`, `home_team_total`, `away_team_total`, `h1_lines_as_of`, `home/away_power_rtg` |
| `ncaab_model_preds` | game × `market` ∈ {`spread`, `total`, `h1_spread`, `h1_total`} | `model_home_margin` (model's home margin; the model's home spread is its negative), `market_home_spread`, `model_total`, `market_total`, `disagreement` (model minus line, signed), `tier` (`bet` / `pass`), `bet_side` ("Villanova -3.5" / "OVER 69.5"), `bet_team`, `bet_line`, `home_win_prob`, `as_of`. On the `h1_*` rows every one of these is a first-half number. |
| `ncaab_predictions` | game, latest `run_id` by `as_of_ts_utc` | `home_win_prob`, `away_win_prob`, `model_fair_home/away_moneyline`, `model_fair_home_spread`, `pred_total_points`, `home/away_score_pred`, `vegas_*`, `neutral_site`, `model_version = cbb_originator_v1` |
| `ncaab_signal_defs` | signal (16 rows) | `signal_key`, `display_name`, `market` (spread / total / h1_spread), `tier` (active / candidate), `one_liner`, `definition`, `why_it_works`, `bet_direction`, `typical_hit`, `record_text` (back-test), `backtest_wins/losses/pushes/roi/seasons`, `season_label`, `season_wins/losses/pushes/roi`, `season_record_text` (rewritten every morning by the grader) |
| `ncaab_slate_flags` | signal × game × market (unique `(espn_game_id, signal_key, market)`) | `game_id`, `espn_game_id`, `game_date`, `game` ("AWAY @ HOME"), `signal_key`, `market`, `side`, `bet_team` (spreads), `bet_direction` (totals: over / under), `bet_line`, `conviction`, `tier`, `trigger_text` (the sentence to show), `record_text`, `result` / `actual_value` / `graded_at` (null until graded), `updated_at` |
| `ncaab_team_trends` | team × season (`season = 2027`, `team_id` = CBBD id) | `team_name`, `through_date`, `games`, `su_w/su_l/su_record`, `ats_w/ats_l/ats_p/ats_pct`, `ou_o/ou_u/ou_p/over_pct`, `tt_o/tt_u/tt_games/tt_over_pct`, `h1_su_w/h1_su_l`, `h1_ats_w/h1_ats_l/h1_ats_p/h1_ats_games/h1_ats_pct`, `h1_ou_o/h1_ou_u/h1_ou_games/h1_over_pct`, `last5_su`, `last5_ats`, `last5_ou`, `last5_tt`, `last5_h1_su`, `last5_h1_ats`, `last5_h1_ou` (text[] newest first, letters W/L/P or O/U/P), `game_log` (jsonb, this season, newest first), `splits` (jsonb), `matchups` (jsonb, see below) |
| `ncaab_team_ratings` | team × season (`season = 2027`) | `team_name`, `as_of_date`, `data_through`, `wins`, `losses`, `coach`, `conference`, `rating`/`rating_rank`, `adj_offense`/`_rank`, `adj_defense`/`_rank`, `tempo`/`_rank`, `luck`/`_rank`, `sos`/`_rank`, `nc_sos`, `pythag`, `efg_pct`, `to_pct`, `or_pct`, `ft_rate` (+ `d_*` defensive mirrors, each with `_rank`), `fg3_pct`, `fg2_pct`, `ft_pct`, `three_rate`, `opp_*`, `avg_height_in`/`_rank`, `eff_height`/`_rank`, `experience`/`_rank`, `bench_pct`/`_rank`, `continuity`/`_rank` |
| `ncaab_fanmatch_daily` | game of the day (`cbbd_game_id` = feed `game_id`) | `thrill_score` (0–100), `home_pred`, `away_pred`, `home_win_prob` (fraction), `pred_tempo`, `home_rank`, `away_rank` |
| `ncaab_team_mapping` | team | `api_team_id` (CBBD id) → `espn_team_id`, `team_abbrev`, `api_team_name` for logos and short names |

**`matchups` shape** (one entry per opponent on this season's schedule, keyed by the opponent's CBBD id as a string; symmetric, so read it off
either team — read the HOME team's row and look up `matchups[String(away_team_id)]`):
```json
{"17": {"opp": "Austin Peay", "opp_id": 17, "meetings": 3,
        "spread": {"h": 2, "n": 3, "pct": 0.667}, "moneyline": {"h": 2, "n": 3, "pct": 0.667}, "total": {"h": 1, "n": 3, "pct": 0.333},
        "team_total": {"h": 0, "n": 0, "pct": null}, "h1_spread": {"h": 1, "n": 2, "pct": 0.5}, "h1_moneyline": {"h": 2, "n": 3, "pct": 0.667}, "h1_total": {"h": 1, "n": 2, "pct": 0.5},
        "games": [{"cbbd_id": 24967, "season": 2021, "date": "2020-11-27", "opp": "Austin Peay", "opp_id": 17, "is_home": true, "neutral": true, "conference": false,
                   "game_type": "TRNMNT", "tournament": null, "team_pts": 80, "opp_pts": 72, "total_points": 152, "h1_team_pts": 43, "h1_opp_pts": 26,
                   "spread": 2.0, "total": 144.0, "ml": 115, "tt_line": null, "h1_spread": null, "h1_total": null, "h1_ml": null,
                   "su": "W", "ats": "W", "ou": "O", "tt": null, "h1_su": "W", "h1_ats": null, "h1_ou": null,
                   "cover_margin": 10.0, "ou_margin": 8.0, "tt_margin": null, "h1_cover_margin": null, "h1_ou_margin": null}]}}
```
`h` = hits from THAT team's side (covers / wins / overs), `n` excludes pushes, `games` newest first (max 10). Every letter and line in `games` is
from the row-owner's perspective (`spread: 2.0` = that team was +2). First-half and team-total lines exist from 2023-24; older meetings carry
`null` there — show "—", not 0. `game_log` entries have the same fields. `splits` = `{market: {overall|home|away|neutral|favorite|underdog|conference:
{"3"|"5"|"7": {h,l,p,n,pct}}}}` for the 7 markets, cross-season trailing windows.

### Sections of the game detail pane, top to bottom
1. **Header / time block.** Under the date and tip time: a **NEUTRAL SITE** pill whenever `neutral_site` is true (no sport shows this today — this is
   the first), the `tournament` name when present ("Maui Invitational"), the `broadcasts` network, a CONF pill when `conference_game`, and the AP
   rank as "#12" before the team name when `home/away_ranking` is set. `time_tbd` → "Time TBD" instead of a clock. On a neutral game do not say
   "at"; use "vs".
2. **Model — full game and first half.** Two stacked blocks from `ncaab_model_preds` (+ `ncaab_predictions` for the moneyline):
   *Full game*: model spread vs posted spread with `disagreement` and the `bet` / `pass` badge on the spread row; model total vs posted total as
   information (never badge a total from the model — totals come from the signals); moneyline / win probability from `ncaab_predictions`.
   *First half*: the same two rows from the `h1_spread` / `h1_total` rows, labeled "1st Half", the posted first-half moneyline from the feed
   (`h1_home/away_moneyline`). When the game has no `h1_*` rows yet, show the block collapsed with "First-half lines post closer to tip-off" (the
   capture runs inside 36h). The team totals (`home/away_team_total`) go in the lines table under the full game. Cards must not assume a two-day
   horizon: during the opening window (through Nov 14) predictions exist for every priced game however far out.
3. **Signals strip + Signals section.** Same shape as the NBA signals card (doc 26). For each flag on the game: `side` as the headline,
   `trigger_text` as the sentence, then the def's `record_text` and `season_record_text`. `market = h1_spread` flags render inside the first-half
   block with a "1H" tag. `tier = tracking` means show the read, do not badge it as a play. Two signals can fire on one game; show both.
4. **Head-to-head.** From `ncaab_team_trends`: read the home team's row, take `matchups[String(away_team_id)]`. Market tabs **Spread · Total ·
   Moneyline · 1H Spread · 1H Total · 1H Moneyline** (team totals as a seventh if room). Each tab: the summary chip from the home side ("Home
   team 2-1 ATS in the last 3 meetings") and the meetings list newest first — date, venue (home / away / neutral), score, that market's line and
   result letter for BOTH teams (flip the letter for the away team: W↔L, O/U are shared). `meetings = 0` → "First meeting since 2020". Never badge
   head-to-head as a signal; the research found it carries no edge.
5. **Last 5 and season records, per market.** Two columns (away, home) from the two `ncaab_team_trends` rows, exactly as the football team-trends
   section does: the `last5_*` chips for Spread / Total / Moneyline / 1H Spread / 1H Total / 1H Moneyline / Team Total, and under each the season
   record (`ats_w-ats_l-ats_p`, `ou_o-ou_u`, `su_record`, `h1_ats_*`, `h1_ou_*`, `h1_su_*`, `tt_o-tt_u`). Before Nov 1 the season records read 0-0
   and the last-5 chips show last season's tail — that is intended (cross-season), label the chips "Last 5" not "This season".
6. **Ratings table.** Title it **Ratings** — never name the provider anywhere in the UI, help text or alt text. Rows = metrics, columns = away and
   home, each cell the value plus the national rank in small type, and the BETTER cell highlighted. Direction per metric:
   higher is better → `rating`, `adj_offense`, `efg_pct`, `or_pct`, `ft_rate`, `d_to_pct` (forcing turnovers), `fg3_pct`, `fg2_pct`, `ft_pct`,
   `avg_height_in`, `eff_height`, `experience`, `continuity`; lower is better → `adj_defense`, `to_pct`, `d_efg_pct`, `d_or_pct`, `d_ft_rate`,
   `opp_fg3_pct`, `opp_fg2_pct`; no highlight (descriptive) → `tempo`, `luck`, `sos`, `bench_pct`, `three_rate`, `opp_three_rate`, `pythag`.
   Suggested row order: Rating · Adj. Offense · Adj. Defense · Tempo · Luck · Schedule strength · Effective FG% · Turnover% · Off. rebound% ·
   FT rate · (defensive four factors in a collapsed "Defense" group) · Height · Effective height · Experience · Bench minutes · Continuity.
   NULL → "—" (before the first game every in-season stat is NULL; the rating, offense, defense and tempo are real preseason projections). Show
   `data_through` as a footnote ("through games of Nov 12"; "Preseason" when it reads "Beginning of season").
7. **Thrill score.** From `ncaab_fanmatch_daily` for the game: a small "Thrill 72" pill in the header next to the TV network, and in the model
   block a secondary line "Projected 78-71, home 68%" from `home_pred` / `away_pred` / `home_win_prob`. It is a watchability score, never a pick;
   absent until the morning of the game.
8. **Agent consensus row** — the generic component, keyed by the college `game_id`.
9. **Early-season note** on the model block through Nov 14: "Early season: the model is running on last season and roster data until this
   season's games accumulate." Then remove it.
10. **Signals index page** — one row per def (16 today): `display_name`, `one_liner`, `market`, `tier`, back-test record + ROI, current-season
    record; expand to `definition` and `why_it_works`. The table is the source of truth, do not hardcode the list.

### Timing the UI can rely on
Feed rows and full-game lines: hourly 4pm–10pm ET plus 7am/11am/2pm. First-half and team-total lines: same passes, for games inside 36h. Model
rows: 8:30am / 12:30pm / 4:30pm / 6:30pm ET. Signals: 10am and 4pm ET, updated in place; a flag whose game stopped qualifying before tip is
deleted. Ratings, team trends, head-to-head: 6:30am ET. Thrill score: 6:30am, 10am, 4pm ET. Grading: 7:30am ET the morning after. The Odds API
lists neutral-site games home/away the other way round about half the time; every job already resolves that, so every table is in CBBD's
orientation, which matches the feed.

### Logos and names
Flags carry CBBD team names (`game`, `bet_team`, `side`); `ncaab_team_trends` and `ncaab_team_ratings` carry CBBD `team_id` + name. Map through
`ncaab_team_mapping` (`api_team_id` / `api_team_name` → `espn_team_id`, `team_abbrev`) for logos, exactly as the feed does today.
