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

## For Cursor — the full wiring brief (2026-10-28)

**Status:** the backend is complete and live. 15 signal defs, the originator model, the grader and every cron run in production; nothing on
the app side renders them yet. Everything below reads from the CFB Supabase project (`jpxnjuwglavsjbgbasnl`). No new backend work is needed to
wire the UI; if a field is missing, ask rather than guess.

### Tables, exactly as written
| table | one row per | key columns the UI needs |
|---|---|---|
| `ncaab_signal_defs` | signal (15 rows) | `signal_key`, `display_name`, `market` (spread/total), `tier` (active/candidate), `one_liner`, `definition`, `why_it_works`, `bet_direction`, `typical_hit`, `record_text` (back-test, plain language), `backtest_wins/losses/pushes/roi/seasons`, `season_label`, `season_wins/losses/pushes/roi`, `season_record_text` (current season, rewritten every morning by the grader) |
| `ncaab_slate_flags` | signal × game × market (unique `(espn_game_id, signal_key, market)`) | `espn_game_id`, `game_id` (CBBD), `game_date`, `game` ("AWAY @ HOME"), `signal_key`, `market`, `side` ("Siena +6.5" / "OVER 141.5"), `bet_team` (spreads), `bet_direction` (totals: over/under), `bet_line`, `conviction` (low/med/high), `tier` (tracking), `trigger_text` (the sentence to show), `trigger_value`, `record_text`, `result`/`actual_value`/`graded_at` (null until graded), `updated_at` |
| `ncaab_model_preds` | game × market (spread, total), latest `run_id` | model line vs posted line, `edge`, `tier` (`bet` = inside the 1.5–4 band on the spread; `pass` otherwise; totals are always pass by design) |
| `ncaab_predictions` | game, latest `run_id` | moneyline/win-prob surface derived from the model spread (`model_fair_*`, `home_win_prob`, `vegas_*`), `model_version = cbb_originator_v1` |
| `v_cbb_input_values` / `cbb_game_schedule` | game | the feed row (213 games for Nov 1–3 today); `game_id` is the CBBD id — **join flags and preds on `game_id`** (both tables carry it alongside `espn_game_id`; the feed view has no ESPN id); `adj_*`, `*_experience_index`, `*_continuity_index` are null until games are played (see Data pipeline) |

### Cards
1. **Game card signal strip + Signals section** — same shape as the NBA signals card (doc 26). For each flag on the game: `side` as the headline,
   `trigger_text` as the sentence, then the def's `record_text` and `season_record_text`. Join flags to the feed on `game_id` (CBBD id). `tier = tracking`
   means show the read, do not badge it as a play. Totals flags carry `bet_direction` and no `bet_team`. Two signals can fire on one game (e.g. `ncaab_small_vs_big_d_over` and
   `ncaab_bad_o_great_d_over` both over): show both; when they agree the historical record of the pair is 66-27, so it is fine to stack visually.
2. **Model section** — from `ncaab_model_preds`: model spread vs posted spread with the edge and the `bet`/`pass` badge; model total vs posted total
   shown as information only (never badge a total bet from the model; totals come from the two over signals). Cards must not assume a two-day
   horizon: during the opening window (through Nov 14) predictions exist for every priced game however far out.
3. **Signals index page** — one row per def: `display_name`, `one_liner`, `market`, `tier`, back-test record + ROI, current-season record. Expand to
   `definition` and `why_it_works`. 15 rows today; the table is the source of truth, do not hardcode the list.
4. **Season record semantics** — `season_record_text` reads "no graded bets yet in 2026-27" until the grader has finals (first on Nov 2 morning).
   Keep back-test and season separate; never add them.

### Timing the UI can rely on
Flags for a game appear once a spread/total is posted (10am and 4pm ET passes) and update in place as the line moves; a flag whose game stopped
qualifying before tip is deleted. Grading happens 7:30am ET the morning after. The Odds API lists neutral-site games home/away the other way round
about half the time; every job already resolves that, so `game` and `side` are in CBBD's orientation, which matches the feed.

### Logos and names
Flags carry CBBD team names (`game`, `bet_team`, `side`); map through `ncaab_team_mapping` (`api_team_name` → `espn_team_id`, `team_abbrev`) for
logos, exactly as the feed does today.
