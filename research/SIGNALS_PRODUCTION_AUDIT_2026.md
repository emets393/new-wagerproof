# NFL + CFB Signals — Production Audit (2026-08-17)

Every signal registered in `nfl_signal_defs` (57) and `cfb_signal_defs` (45), its
plain-language definition, validated record, and production status. **Wiring check:**
every key below was verified present in live emitter code (flags/props generators +
spot libraries) — zero orphaned definitions, zero unregistered emitters. Records are
the validated backtests shown to users; per-season splits appear where a multi-season
revalidation exists (all prop signals were re-validated on 3 seasons on 2026-08-17;
CFB core/early/tt on 3-5 seasons). Tier meanings: T1/T2/T3 = active bets by stake;
track = paper-traded, shown as context, never a bet reason.


## NFL (57 signals)


### h1_spread

| Signal | What it is | Validated record | Tier | Notes |
|---|---|---|---|---|
| **1H Steam Follow (small spread)** (`K3_h1_steam_follow_small`) | Follow 1H spread steam in small-spread games. | tracking | low |  |
| **Slow-Start Dog Fade (1H, market)** (`K7_slow_start_dog_fade_1h`) | Fade the slow-starting dog on the 1H spread. | tracking | low |  |
| **Primetime 1H Favorite** (`K8_primetime_1h_fav`) | Primetime favorite on the 1H spread. | tracking | low |  |
| **Primetime 1H Favorite (model-confirmed)** (`M3_primetime_fav_tilt`) | Back the favorite in the first half of a primetime game, with the model agreeing. | ~58% | med |  |
| **Slow-Start Dog Fade (1H)** (`M4_slow_start_dog_fade`) | Back the favorite 1H against a chronically slow-starting underdog. | ~58% | med |  |

### h1_total

| Signal | What it is | Validated record | Tier | Notes |
|---|---|---|---|---|
| **1H Over — Model Edge + Hot Team Totals** (`M1_window_over_k1`) | Our first-half projection beats the posted 1H total, and the team totals agree. | ~57% | med |  |

### player_prop

| Signal | What it is | Validated record | Tier | Notes |
|---|---|---|---|---|
| **Receptions Line Raised Under** (`P10_receptions_raised_under`) | Receptions line raised two straight weeks -> Under. | 64.4% / +8.4% ROI (n=135, 3 seasons: 70/65/62%) | low |  |
| **Featured Receiver Yds Over** (`P12_featured_wr_over`) | A star receiver's line is set below what he's actually been doing -> Over. | 65.6% / +22.8% ROI (n=346, 3 seasons: 62/70/66%) | high |  |
| **Featured Rusher Yds Over** (`P13_featured_rb_over`) | A workhorse back's line is set below what he's been doing -> Over. | 65.0% / +22% ROI (n=60, 3 seasons; 2023 weak on tiny n) | med | 2023 weak on n=18; 74% both seasons since |
| **Volume Model — Attempts Under** (`P14_attempts_model_under`) | Our model projects fewer attempts/carries than the posted line -> Under. | 55.1% / +1-5% ROI (n=1482, 3 seasons; 2023 flat — watch) | med | WATCH: 2023 flat (50%), 2024-25 strong |
| **Attempts Line Jumped — Under** (`P15_attempts_steam_under`) | The attempts line rose sharply before kickoff -> fade it to the Under. | 56.5% / +1.9% ROI (n=855, 3 seasons: 52/55/62%) | med | thin margin (+1.9% real prices), positive 3/3 pooled |
| **Attempts Under — Model AND Market Agree** (`P16_attempts_confluence`) | Our model AND the line movement both say the attempts line is too high -> premium Under. | 61.5% / +12.8% ROI (n=340, 3 seasons: 54/62/68%) | high |  |
| **Volume Model — Rush Yds Under** (`P17_rush_yds_model_under`) | Our model projects a rusher's yards well below the posted line -> Under. | 58.5% / +10% ROI [55,63] | med |  |
| **Volume Model — Pass TDs Over** (`P18_pass_tds_model_over`) | Our model projects a QB's passing TDs well above the posted line -> Over. | 63-69% / +5-9% ROI [67,63] | high |  |
| **QB Pass Yds — Line Above Form Over** (`P1_pass_yds_form_over`) | QB's posted passing line sits above his recent form -> Over. | +6-21% ROI (2yr) | med |  |
| **QB Pass Yds — Line Below Form Under** (`P2_pass_yds_form_under`) | QB's posted passing line sits modestly below his form -> Under. | +8-12% ROI (2yr) | med |  |
| **QB Pass TDs — Line Above Form Over** (`P3_pass_tds_form_over`) | QB's passing-TD line is set well above recent form -> Over. | +EV both seasons (validated) | low |  |
| **No-History QB Under** (`P4_no_history_qb_under`) | Season-debut / no-history QB -> passing Under. | +11-37% ROI (Wk1, thin) | low |  |
| **Anytime TD Drift-Down Yes** (`P5_atd_drift_yes`) | ATD yes-price drifted down into the close -> back Yes. | +5-6% ROI (n~1600/yr) | low |  |
| **Rush Yds vs Tough Run D Under** (`P7_rush_yds_tough_d_under`) | Rusher faces a very tough run defense -> rushing Under. | +EV both seasons (validated) | low |  |
| **Pass TDs Bounce-Back Over** (`P9_pass_tds_regression_over`) | QB under his pass-TD line two straight weeks -> Over next. | +11-14% ROI (n~100/yr) | low |  |

### spread

| Signal | What it is | Validated record | Tier | Notes |
|---|---|---|---|---|
| **TTs Imply Away Cover** (`K12_tt_implies_away_cover`) | Team totals imply home less dominant than the spread -> back away ATS. | 60% / +14% [-,57,55] (thin) | low |  |
| **Bye Collision (tracking)** (`bye_collision`) | Bye-week rest mismatch, unproven. | thin sample | low |  |
| **Divisional Dog-to-Road-Favorite (tracking)** (`div_dog_to_roadfav`) | Home underdog in the first division meeting, now a road favorite in the rematch -> back them. | 61.8% (n=34; 72% if won g1) -- thin | low |  |
| **DK Heavy Home Juice** (`dk_heavy_home_juice`) | Book-specific heavy home juice tell. | 61% | high |  |
| **Fade Power-Rating in Tight Game** (`fade_pr_in_tight_game`) | Bet against the 'better team on paper' in a coin-flip game. | ~64% | med |  |
| **Legacy Model Fade** (`legacy_fade`) | Bet against our older model when it is overconfident in a daytime game. | ~58% backtest | high |  |
| **Legacy Model — Primetime Follow** (`legacy_primetime`) | In primetime, follow our older model instead of fading it. | 61.8% [2025] | high |  |
| **Primetime Tight Favorite (tracking)** (`primetime_tight_favorite`) | Primetime tight-favorite angle, on probation. | regressed 2025 | low |  |
| **Sides Model** (`sides_model`) | Our main spread model's pick. | ~53% product-style, +CLV | med | base-model key (drives pick cards, not a badge) |
| **Dog-Cover Regression: Buy the Away Favorite** (`spread_dog_cover_fade_away`) | Back a cold away favorite against a hot home dog. | ~63-70% (small n) | med |  |
| **Dog-Cover Regression: Buy the Home Favorite** (`spread_dog_cover_fade_home`) | Back a cold home favorite against a hot away dog. | ~60% | med |  |
| **Cold-Team Buy-Low ATS (tracking)** (`streak_buylow_ncover`) | Back a team that hasn't covered in 5+ straight -> tracked only. | regressed (56% pre-2019 -> 51% since) | low |  |
| **Cold Dog vs Hot Team ATS (tracking)** (`streak_cold_vs_hot_ats`) | Cover-streak team vs non-cover-streak team -> back the cold one, tracked. | 56-64% (thin, noisy) | low |  |
| **Tight Soft-ML Fade Home** (`tight_soft_ml_fade_home`) | Fade the home side when the moneyline is soft in a tight game. | 62% / +18% ROI | high |  |
| **Top-vs-Top Points Home** (`top_vs_top_pt_home`) | Back the home side when two strong teams meet. | 65% | high |  |

### team_total

| Signal | What it is | Validated record | Tier | Notes |
|---|---|---|---|---|
| **Home TT Steam Over** (`K10_home_tt_steam_over`) | Home team total steamed up open->close -> home TT Over. | 55% / +6% [54,59,52] | low |  |
| **Home TT Over-Juiced Fade** (`K11_home_tt_over_juiced_fade`) | Market over-juices the home TT Over -> fade to the Under. | 55% / +4% [50,59,55] | low |  |
| **Big-Favorite Home TT Over** (`K2_bigfav_home_tt_over`) | Heavy home favorite -> home team total Over. | tracking | low |  |
| **TT Cut Bounce-Back Over** (`K5_tt_cut_bounceback_over`) | Team total cut after a big miss -> bounce-back Over. | tracking | low |  |
| **TT Raise Momentum Over** (`K6_tt_raise_momentum_over`) | Team total raised after a big over -> momentum Over. | tracking | low |  |
| **High Home TT Over** (`K9_home_tt_high_over`) | Home team total set at 24+ -> home TT Over. | 55% / +6% [54,60,51] | low |  |

### total

| Signal | What it is | Validated record | Tier | Notes |
|---|---|---|---|---|
| **Team Totals Running Hot — Over** (`K1_tt_sum_q5_over`) | Both team totals add up to more than the game total -> Over. | ~56% | med |  |
| **Game Over — Hot Team Totals + Model Lean** (`M2_k1_model_lean`) | Team totals run hot and our first-half projection leans high -> game Over. | tracking 2026 | med |  |
| **TD Market Implies More Scoring — Over** (`P11_atd_implied_over`) | The touchdown-scorer market implies more points than the posted total. | 58-61% / +11-16% ROI | med |  |
| **Bottom-vs-Bottom Under (tracking)** (`bot_vs_bot_under`) | Two weak offenses -> Under, on probation. | regressed 2025 | low |  |
| **Totals Model (High Conviction)** (`consensus_totals_HC`) | Our totals model's strongest bets. | ~57% / +8% ROI | high | the totals model bet tier (3-7 pt sweet spot) |
| **DK Giant-Favorite Over** (`dk_giant_fav_over`) | Over when a giant favorite shows on DraftKings. | 65% | high |  |
| **Primetime Tight Under (tracking)** (`primetime_tight_under`) | Primetime tight-game Under, on probation. | regressed 2025 | low |  |
| **Receiver Over** (`receiver_over`) | Receiving-environment Over signal. | ~58% | med |  |
| **Receiver Over (High Conviction)** (`receiver_over_HC`) | Stronger-tier receiving Over. | 60%+ | high |  |
| **Colliding Under-Streaks Over (tracking)** (`streak_both_under_over`) | Both teams on under streaks meet -> Over, tracked only. | ~59% (thin, n=29) | low |  |
| **Long Under-Streak Over** (`streak_long_under_over`) | A team riding a long run of unders -> take the Over. | ~60% (67% since 2019, ~4-5/yr) | med |  |
| **High-Line Under** (`total_high_line_under`) | Under on an inflated total. | ~58% | med |  |
| **Low-Line Over** (`total_low_line_over`) | Over on a suspiciously low total. | ~58% | med |  |
| **Week 1 Defense Under (tracking)** (`week1_def_under`) | Week 1 defensive Under, unproven. | thin sample | low |  |
| **Wind Under** (`wind_under`) | Under in high-wind outdoor games. | ~60% | high |  |

## CFB (45 signals)


### h1_ml

| Signal | What it is | Validated record | Tier | Notes |
|---|---|---|---|---|
| **1st-Half Moneyline (dog conversion)** (`h1_ml`) | Underdog to lead at the half | +24% ROI (small sample) | track |  |

### h1_spread

| Signal | What it is | Validated record | Tier | Notes |
|---|---|---|---|---|
| **1st-Half Spread (model)** (`h1_spread`) | Half-game model edge | ~54% | T3 |  |

### h1_total

| Signal | What it is | Validated record | Tier | Notes |
|---|---|---|---|---|
| **1st-Half Total (tempo model)** (`h1_total`) | Half-game pace edge | ~55–56% | T3 |  |

### ml

| Signal | What it is | Validated record | Tier | Notes |
|---|---|---|---|---|
| **Small Home-Dog Moneyline** (`home_dog_ml`) | Home underdog outright value | ~48% win / +5.9% ROI, 4/5 seasons | T3 |  |

### spread

| Signal | What it is | Validated record | Tier | Notes |
|---|---|---|---|---|
| **Big Ten Road Favorite** (`conf_bigten_road_fav`) | Back the road chalk | ~55% | T2 |  |
| **Sun Belt Home-Favorite Fade** (`conf_sunbelt_fade`) | Fade the home chalk | ~58% | T2 |  |
| **Backup-QB Fade (Home)** (`fade_home_backup_qb`) | Bet against the backup | ~60% | T3 | needs covers.com pregame feed (not live yet) |
| **Week-1 G5 Dog vs Big P5 Favorite** (`g5_dog_wk1_bigfav`) | Take the G5 getting a big Week-1 number | ~76% ATS (small sample, ~41 games) | T3 |  |
| **Group-of-5 Bounce-Back Fade** (`g5_fade_after_loss`) | Fade the overreaction | ~65% | T1 |  |
| **Key-Number Dog (+2.5/3/3.5)** (`key_dog`) | Points around the 3 | ~54% | T3 |  |
| **Key-Number Favorite (−6.5 to −7.5)** (`key_lay_fav`) | Win on the touchdown margin | ~55% (−7/−7.5 ~58%), 4/5 seasons | T2 |  |
| **Model High-Edge Underdog** (`model_highedge_dog`) | Strong dog edge | ~58–60% | T2 | suppressed wks1-3 (cold model) |
| **Model Lean** (`model_lean`) | Model number only | ~50-53% | track | base-model key (renders as model output, not a per-game signal) |
| **Model Road Value** (`model_road_value`) | Public fades the road team | ~52–54% | T3 | suppressed wks1-3 (cold model) |
| **Padded Road-Team Fade** (`padded_road_fade`) | Fade an inflated road rating | ~62–64% | T1 |  |
| **Week 1-3 Portal Talent Influx** (`portal_talent_influx`) | Back a big blue-chip portal haul early | ~57% ATS wk1-3 (2021-25, small sample — track-plus) | T3 |  |
| **Premium Lay-the-Favorite** (`premium_lay_fav`) | Strong edge on a contained favorite | ~63–69% | T2 | suppressed wks1-3 (cold model) |
| **Regime Fade: New Coach Overrated** (`regime_fade_hc`) | Fade the rating, trust the market | ~58% backtest, tracking | track |  |
| **Regime Fade: Roster Teardown** (`regime_fade_teardown`) | Ratings can't see a gutted roster | ~56% backtest, tracking | track |  |
| **Regime Follow: Ride vs New Coach** (`regime_follow_hc`) | Ratings right when the opponent rebuilds | ~62% backtest, tracking | track |  |
| **Week 1-3 Returning-Production Edge** (`ret_prod_edge`) | Back the more-experienced roster early | ~54% ATS, 9 of 9 seasons (+3.9%) | T2 |  |
| **Week 1 Roster-Hype Fade** (`roster_hype_fade`) | Fade the loaded roster in the opener | ~61% vs open wk1 (2024-25, n=83 — tracking) | track | wk1-3 contextual |
| **Ranked-vs-Ranked Home Edge** (`rvr_home`) | Home edge in marquee games | ~57–60% | T2 |  |
| **Soft-Book Line Gap** (`soft_book_gap`) | Beat the slow book | ~57–64% | T2 |  |
| **Model + Sharp-Book Stack** (`stack`) | Two independent edges agree | ~72% | T1 |  |

### team_total

| Signal | What it is | Validated record | Tier | Notes |
|---|---|---|---|---|
| **Week-1 G5 Team-Total Under** (`g5_tt_under_wk1`) | Fade the G5 offense in the opener | ~73% under (small sample, 2023+ only) | T3 |  |
| **Team Total (model)** (`team_total`) | Projected points vs the posted team total | ~57% under / ~62% over (P5) | T2 |  |
| **Road Team Under** (`tt_away_under`) | The total looks inflated, and the road team's number is where the extra points hide | 61.3% (n=271, 3/3 seasons 60-62%), +16.9% @ -110 | T2 | NEW 2026-08-17 — wks1-3 via early blend (T3) / wk5+ via ratings (T2); needs posted TT line |

### total

| Signal | What it is | Validated record | Tier | Notes |
|---|---|---|---|---|
| **Backup-QB Under** (`backup_qb_under`) | Backup offense scores less | ~60% | T3 | needs covers.com pregame feed (not live yet) |
| **Weeks 1-3 New Fast-Coach Under** (`coach_pace_under`) | New up-tempo coach, market too high | ~67% under wk1-3 (pace gap >=+4, n=21 — tracking) | track | early-season contextual |
| **American Conference Over** (`conf_aac_over`) | Up-tempo points | ~57% | T2 |  |
| **Sun Belt Under** (`conf_sunbelt_under`) | Ground-and-pound | ~68% (small sample) | T2 |  |
| **In-Season Ratings vs the Total** (`core_total_edge`) | Our in-season scoring ratings disagree with the posted total | 54.1% base 5/5 seasons; +steam >=1.5: ~61% (+16%) | track | wk5+ (needs 4 played weeks of ratings); hourly steam re-tier inside T-24 |
| **Weeks 1-3 Early Total Edge** (`early_total_edge`) | Our preseason projections disagree with the posted total | 55.1% (n=352, 5/5 seasons); >=6 pts: 57.9% | T3 | wks 1-3 only (preseason blend) |
| **Inflated High Total (Under)** (`fade_high_total`) | Fade a bloated number | ~57% (60+), 4/5 seasons | T3 |  |
| **Low Total (Over)** (`fade_low_total`) | Mild low-total bounce | ~52% (track-only) | track |  |
| **Hot-Over Regression (Under)** (`form_over_hot_under`) | Scoring cools off | ~58% | T2 |  |
| **Model Over Edge** (`model_total_over`) | Model projects more points | ~55% | T3 | suppressed wks1-3 (cold model) |
| **Model Over — Pace** (`model_total_over_pace`) | Underpriced tempo | ~56% | T2 | suppressed wks1-3 (cold model) |
| **Model Under Edge** (`model_total_under`) | Model projects fewer points | ~58% | T2 | suppressed wks1-3 (cold model) |
| **Week 1 Opener Under** (`opener_under`) | Slow starts | ~55% | T3 |  |
| **Primetime Rivalry Letdown Under** (`primetime_rivalry_letdown_under`) | Post-rivalry dip | ~56% | T3 |  |
| **Post-Upset Letdown Under** (`ranked_upset_letdown_under`) | Emotional hangover | ~56% | T3 |  |
| **Rivalry-Week Over** (`rivalry_week_over`) | Late-season points | ~52% (track-only) | track |  |
| **Style-Underperformance Under** (`style_offense_under`) | Offense keeps struggling vs a defense type | ~54% game / ~56-61% team total (dose-responsive) | T3 |  |


## Production chain — verified end to end

**Emission** — NFL: `run_nfl_week.sh` (Tuesdays, Render) writes games/flags/picks/props with
the sign guard refusing contradictory writes; CFB: daily chain games→flags→picks, same guard.
Both regenerated clean for 2026 wk1 today.

**Rendering** — every flag carries structured `bet_team`/`bet_direction`/`bet_line`; web/app
render logo+direction; contradicting signals render (counter_signal_keys); every key resolves
to the plain-language definition + record above (101-signal audit, all rewritten).

**Grading** — daily `nfl-cfb-grade-daily` cron: finals → props (DNP=push) → picks →
`refresh_all_signal_performance` builds each signal's public season-to-date record. Gap found
+ fixed today: team-total pick cards now attach real flag keys (tt_away_under would otherwise
never have accrued a record).

**Live cadence** — all odds captures every 15 min for today's games until kickoff (3 crons,
deployed); core_total_edge re-tiers hourly→15-min inside T-24 (late steam confirms, stalled
early steam demotes, ≥2.5 never chase).

**Agents** — get_signals serves every firing flag with stance + both records (all-time
validated vs season-to-date live), tracking-only discipline enforced in the tool description.

**Known constraints** — CFB backup-QB signals wait on the covers.com feed; NFL K/M team-total
and 1H micro-signals default to tracking tier (thin-n cells building live records);
week-1 CFB team-total flags need books to post TT lines (auto-fires when they do).
