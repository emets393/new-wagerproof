# CFB Model Rebuild — research log

Goal: rebuild the College Football prediction model (totals first, then sides) as a
per-game prediction product for the WagerProof site + a spots overlay, mirroring the
NFL methodology (honest grading vs the signal's own line, permutation-null FP control,
walk-forward, per-season breakdowns).

## Why the old model failed (diagnosed 2026-06-01)
- Old model trained on `cfb_training` (VSIN power ratings + betting splits) — weak inputs.
- The good purchased data (`cfb_api_training_data`, opponent-adjusted EPA suite) was a
  separate, richer table. Stored predictions (`cfb_api_predictions`) were empty.
- Root cause ≈ **train/serve mismatch**: the purchased features couldn't be recreated live.
  User won't re-buy the weekly data package, so we must regenerate it ourselves from the CFBD API.

## Data foundation (all leak-checked)
- **Purchased training table**: 4,520 games, 8 seasons (2016-19, 2021-24; 2020 COVID absent),
  filtered to games with betting lines. Cached `data/cfb_api_training_data.parquet`.
- **Leakage audit (leak_audit.py)**: CLEAN. Adjusted stats are pregame season-to-date —
  current-week EPA predicts its own game only +0.008 better than the lagged value (n=8420).
- **Signal**: net adjusted-EPA corr 0.544 w/ margin (market 0.627); sum-EPA 0.275 w/ total
  (market 0.434). Strong fundamentals below the market = healthy starting point.
- **2025**: held-out forward-test season. Results+lines in `data/cfb_games.parquet` (1,688 games).

## Recreation pipeline (the core deliverable)
- `cfbd.py` — CFBD API client (key in repo-root `.env.local`, gitignored).
- `fetch_cfbd.py` — bulk puller -> `data/cfbd/{game_advanced,games,lines}_<year>.parquet`, all seasons.
- CFBD `/stats/season/advanced` = RAW (week-cutoffs OK); `/ppa/*` = adjusted but 2-dec rounded.
  Purchased = custom full-precision opponent-adjusted suite -> **can't exactly clone**.
- **Decision**: build our OWN opponent adjustment, train+serve on it consistently (kills the
  train/serve gap permanently). Purchased table is a validation reference only.
- `adjust_prototype.py` — iterative opponent adjustment (Connelly-style). Validated vs purchased
  week-6 2025: ~0.9 corr (off 0.82-0.92, def 0.73-0.90). Play-weighting no help.
  Field position needs no adjustment (matched raw exactly).

## Metric -> CFBD source map
- EPA/rush/pass, success (+ std/passing down), explosiveness (+rush/pass), line/2nd-level/
  open-field yards → `/stats/game/advanced` (per-game raw, full precision) → opponent-adjust.
- Havoc (total/front7/db), points-per-opportunity → `/stats/season/advanced` (raw, endWeek loop).
- Field position avg start → `/stats/season/advanced` raw (no adjustment).
- ELO → `/ratings/elo` (weekly); talent → `/talent`. Lines → `/lines`.

## TODO
- [ ] Production adjust module → leak-safe season-to-date feature table, all seasons.
- [ ] Early-week prior (weeks 1-3): blend talent/ELO/prior-year (purchased clearly used a prior).
- [ ] Pull havoc/PPO (season/advanced endWeek loop) + ELO/talent + extra signal features
      (returning production, recruiting, transfer portal, pace, weather).
- [ ] Totals baseline model (walk-forward, grade vs over_line honestly, per-season).
- [ ] Spot-mining for high-confidence totals plays.

## TOTALS BASELINE RESULT (2026-06-01, totals_baseline.py)
Walk-forward (train seasons < test), predict actual_total from fundamentals+situational
(NO line feature), bet at OPEN when |pred-open|>=thr, grade vs open. Eval 2021-2025 (opens
exist 2021+). Model MAE 13.3 > market 12.6 (worse on raw prediction, as expected).

Monotonic dose-response, per-season at edge>=10: 2021 59.9 / 2022 51.6 / 2023 56.1 /
2024 59.4 / 2025 58.0 / ALL 57.3% (~100 bets/season). Clears 52.4% breakeven 4/5 seasons
incl. both recent years. **TRUE edge, not CLV**: vs open 55.8%/+6.5% ~ vs close 56.1%/+7.1%
(edge>=8), avg CLV only +0.12. Model finds totals the CLOSING market also misprices.

Data caveat: opening totals exist 2021-2025 only (CFBD). 2016-2019 train-only (close only).
2022 is the weak season. Next: feature importance, spots layer, refine adjustment, add
havoc/PPO + returning-production/recruiting/portal/pace/weather.

## FEATURE IMPORTANCE + SPOT MINING (2026-06-01)
feature_importance.py (perm imp, OOS 2024-25): sum_off_epa dominates (0.29), then elo_diff,
recent form (last_pts_against, last_total), home_days_rest, and **next_opp_net (look-ahead) ranks
16th** — situational signal real, model already absorbs look-ahead.

spots_scan.py (31 conditions, permutation null FP control): real passers 6 vs null95 8 =>
standalone situational totals trends are NOISE (NFL b3 lesson reconfirmed). EXCEPT a structural
high-total->UNDER effect (season-consistent, huge n).

spot_model_combo.py — THE KEY FINDINGS:
1. **Directional asymmetry**: model's OVER bets ~worthless (edge>=5 OVER 51.5%/-1.7%), UNDER bets
   strong (edge>=5 UNDER 58.8%/+12.3%). The baseline edge is ENTIRELY the under side.
2. **High-total->UNDER dose-response** (standalone, vs open): open>=60 56.8% / >=62 58.0%/+10.6% /
   >=68 62.7% / >=70 66.7%. Monotonic, all seasons above breakeven.
3. **PRODUCT (model + spot align)**: model-UNDER (edge>=3) AND open>=62 => 60.3%/+15.1% ROI vs open
   (n=282 ~56/yr), per-season 65/56/65/55/61 (ALL above breakeven). Holds vs CLOSE 58.6%/+11.8%
   (CLV +0.22) = TRUE edge, beats the closing market.
Blanket under is NOT an edge (per-season under-rate 50-54% vs open ~ breakeven). Edge is selective.
CAVEAT: 2023 clock rules cut scoring; selective combo still holds 2024-25 (market hasn't priced it out).

NEXT: OVER-side has no edge yet (mine over-specific spots: pace/dome/tempo, or accept unders-only);
add havoc/PPO + returning-production/recruiting/portal/pace/weather (may unlock over signal);
market-anchored variant; then sides model.

## OVER-SIDE RE-TEST after adding pace/weather/havoc/PPO (2026-06-01)
Added: season-to-date havoc/PPO/pace (plays,drives,field pos) [season_advanced_asof.parquet] +
historical weather [weather_<year>.parquet] (temp/wind/precip/snow/indoors). model_games now 171 cols.
Features modestly improved the model + UNDER side. **OVER SIDE STILL DEAD (market prices it):**
fast pace 49.3%, high PPO 47.2%, many drives 49.6%, calm+warm 50.4%, dome 40.8% over — all <=breakeven.
Model OVER bets edge>=5 52.3%/-0.2%. Nothing rescues overs (best low-total-env 53.1%, not worth it).
CONCLUSION: CFB totals is an UNDER-ONLY product (mirrors NFL: durable totals edges are unders).

## LOCKED TOTALS PRODUCT (under-only, enriched features, grade vs open / vs close)
- model UNDER edge>=5:            58.3% /+11.4% ROI (vs close 56.7%) [62/59/65/49/54]
- model UNDER edge>=3 & open>=62: 58.0% /+10.7% ROI (vs close 56.0%) [70/55/56/53/53] (most consistent)
- model UNDER edge>=5 & open>=60: 58.7% /+12.1% ROI (vs close 55.3%) [66/58/62/54/50]
All beat the CLOSING line (true edge). DO NOT bet overs. ~50-100 plays/yr per tier.

## SHOOTOUT/OVER HYPOTHESIS TEST (2026-06-02, shootout_test.py)
User theory: pass-heavy O vs weak pass D / low QB pressure -> shootout OVER; + situational
(first conf game, primetime, travel). Added box-score tendencies (teamgame_box, build_tendencies.py:
pass_rate/tempo/pressure) + primetime/night/first_conf_game. model_games now 191 cols.
MECHANISM CONFIRMED (these games DO score more): both_pass_heavy avg total 57.0 vs base 53.7 (+3.3).
BUT MARKET PRICES IT (over-prices): both_pass_heavy 49.3% over, both_weak_pass_D 44.2%, BOTH_air_
mismatch ('obvious shootout') 43% = goes UNDER. Situational all dead (first_conf 48/primetime 47.8/
night 47.3/travel 46.1). FP control: within chance. OVER side remains unbeatable (confirmed again).
BONUS UNDER TRIGGER: both_weak_pass_D -> UNDER 55.8%/+6.5% standalone (4/5 seasons). Expands locked rule:
model-UNDER edge>=3 & (open>=62 OR both_weak_pass_D) = 58.2%/+11.0%, n=294 (+64 bets), all seasons positive.
Lesson: 'obvious shootout' spots are an UNDER trap (inflated total), not an over.

## OVER SIDE CRACKED — low total + fast pace (2026-06-02, over_dig.py / over_lowtotal_fast.py)
Dug deeper (conference, early-season, team over-tendency, extreme tempo, low-total). FP control: ENRICHED.
KEY REFRAME: overs live in LOW totals w/ pace (market underprices tempo when posting a low number),
NOT obvious-shootout high totals (those over-priced -> unders). Mirror images.
- CONFERENCE shootout reputation is PRICED (Big12 49.5%, Pac12 48.2%, Amer 49.1% over ~ base). Only flag:
  FBS Independents 53% (heterogeneous, recent uptick). Mountain West 44% (under lean).
- Early season wk1-3 -> UNDER (45% over). 'Over-machine' teams regress -> UNDER (41%).
- **OVER SPOT: open<=48 & pace>=p66 => 54.7%/+4.5% vs open, 57.8% vs CLOSE, [62/55/55/50/53] all>=50.**
  +model agree (edge>=0) 56.1%/+7.2%; edge>=2 58.7%/+12.1% but 2024 fragile (33). Robust core = unfiltered.
  Modest n (~55/yr), cutoffs tuned -> forward-track 2026 to confirm. pace=expected_plays (leak-safe as-of wk-1).

## TOTALS PRODUCT IS BIDIRECTIONAL
OVER: open<=48 & pace>=p66 (~55%, beats close). UNDER: model-UNDER edge>=3 & (open>=62 OR both_weak_pass_D)
(~58%, beats close). Overs in low-total+tempo, unders in high-total/over-priced-scoring.

## CREATIVE SPOT MINING — week/travel/emotional/lookahead (2026-06-02, situational_over.py)
TRAVEL: dead (all buckets 45-49% over, even 2500+ mi; market prices it).
WEEK NUMBER (big): wk1 opener 37% over = MASSIVE UNDER (n=340, beats close 39%); wk1-2 40%; wk8 43%.
  **wk13 (rivalry/conf week, 90% conf games) 56.6% over = OVER (n=311, beats close 58%) [52/66/63/53/48]**.
EMOTIONAL (either team): off OT loss 45% (mild under, n=148); off close/blowout/home-loss-to-ranked all
  priced ~50%; lookahead trap 48% (priced). **ranked team UPSET by unranked last wk -> 38% over = UNDER
  (n=175, 5/5 seasons, beats close 41%)** = refocus/clampdown (user guessed spot, dir=under not over).

## FINAL TOTALS SPOT LIBRARY (all grade vs open, beat the close)
OVER: (open<=48 & fast pace) 54.7% | week13 56.6% | combined ~54.2%/+3.5% (~100/yr, all seasons>=50).
UNDER: model-UNDER edge>=3 & (open>=62 OR both_weak_pass_D) ~58% | week1 opener 37%over | ranked-upset 38%over.
Overs = market underprices pace on modest numbers + rivalry week. Unders = overpriced scoring (high totals,
obvious shootouts, openers, exposed-ranked-team). Travel/conference-reputation/blowout/lookahead = PRICED.
Caveats: over spots modest n + some cutoff tuning -> forward-track 2026. Under side firmer.

## CONFERENCE / TIER ANALYSIS (2026-06-02, conference_deep.py)
STYLE is real & large (intra-conf avg total): American 60.5, Big12 58.0, Pac12 57.9 (shootout) vs
Big Ten 49.5 (smashmouth); SEC 53.3, SunBelt 55.3, MAC 53.3. BUT priced (over-rates all 46-52%) AND
the model already captures it via team EPA/pace (conference target-encoded feature: MAE 13.15->13.14,
no lift). MACtion (MAC Tue-Thu wk>=9) 54% vs CLOSE but only 48% vs OPEN [56/41/53/29/62] = NOT bettable.
*** TIER IS A SPOT FILTER (the real value) ***:
  OVER spot (open<=48 & fast): both-P5 56.2%/+7.3% > both-G5 52.8%/+0.8% -> prefer Power-5.
  UNDER spot (edge<=-3 & open>=62): both-P5 59.1% / both-G5 58.6% / MIXED P5-vs-G5 51.2%/-2.3% (FAILS).
  -> Apply OVER spot in P5 games; apply UNDER spot only in same-tier (P5-P5 or G5-G5), NOT mixed.

## LOOK-AHEAD / LETDOWN SPOTS (2026-06-02, lookahead_letdown.py)
LOOK-AHEAD = PRICED: team facing ranked opp NEXT week shows no totals effect this week (48.2%, dead).
General letdown (after ranked / ranked-v-ranked / any primetime) = PRICED (~48-50%).
*** NEW UNDER SPOT (user pre-specified, validated): team played a PRIMETIME RANKED-vs-RANKED game LAST
week -> UNDER. Strict: 56.2% under vs open / 54.4% vs close (n=130 ~26/yr, [50/44/45/40/42] over%, 4/5 szn).
Looser (primetime vs ranked last wk): 53.4% under (n=412 ~82/yr). Mechanism: emotional/physical letdown
after a peak primetime battle. primetime = Sat night kickoff (no TV-network data; ABC/ESPN not distinguishable).
Rivalry spots untested (no rivalry table) — proxied by 'ranked'.

## RIVALRY SPOTS (2026-06-02, rivalry_spots.py — 74 hardcoded major FBS rivalries)
Rivalry GAME itself: PRICED (51.4% over, coin-flip, per-season volatile). "rivalry games go under" = myth.
Rival LETDOWN (rival last week): weak under (47.7%).
*** RIVAL LOOK-AHEAD (rival NEXT week) -> UNDER 54.9% vs open / +4.8% ROI, all 5 seasons consistent
(under% 51/61/51/54/58, n=492 ~98/yr; conf-game-now 55.3%). BUT vs CLOSE only ~52% = partly CLV (market
also lowers total open->close). Bettable at OPEN (how site posts); moderate conviction, not a beat-close edge.
NOTE: rival look-ahead WORKS where ranked look-ahead was PRICED -> the rivalry is the truly-circled game.
(FIU unmatched in CFBD naming - 1 pair dropped.)

## TRAPPY LINES — recent scoring form vs total (2026-06-02, recent_form_trap.py)
Tested follow-vs-fade the gap between recent/season scoring form and the open total.
- LAST-3 recent form: FOLLOW mostly LOSES (hot scoring regresses, line right).
- SEASON-TO-DATE: only clean signal is UNDER side: form_s2d gap<=-7 (season scoring << line) -> UNDER
  56.2% vs open / 55.6% vs close, all 5 seasons. OVER side (form>>line) volatile/priced (regression).
- BUT ~50% overlap with model-under; form-only (non-model) games just 51.6% -> raw form mostly ALREADY
  in the model (EPA~scoring). BEST USE = confirmation filter: model-under edge<=-3 & form gap<=-3 ->
  58.2%/+11.0% vs open (n=239, all seasons), sharper than model-under alone (56.5%).
ASYMMETRY REconfirmed: 'line too high vs scoring -> UNDER' real; 'line too low -> OVER' = trap.

## SIDES (SPREAD) BASELINE (2026-06-02, sides_baseline.py)
*** CAUGHT LEAK: CFBD weekly /ratings/elo is POST-game; elo joined on current week leaked margin
(elo_diff corr 0.781 > market 0.654). FIXED: join elo as-of week-1 (entering elo); elo_diff now 0.594.
build_features.py corrected + model_games rebuilt. Re-verify any elo-dependent result.
Honest sides: model margin MAE 13.01 ~ market 12.41. ATS ~52-53% overall (marginal, like NFL).
EDGE = AWAY side (home-favorite public bias): bet away edge<=-4 -> 55.3%/+5.5% vs open, 53.7% vs close,
all 5 seasons (188/yr). away FAVORITE edge<=-3 54.7%/+4.5% (cleanest). HOME side dead (51%).
Mirrors totals: marginal model + one public-bias directional edge (totals=UNDER, sides=AWAY).

## SIDES SPOT MINING (2026-06-02, sides_spots.py)
Standalone ATS situational/market spots = NOISE (FP ~1, chance): fade-home-favorite (all sizes 49-52%),
back-away-fav blanket 49%, off-bye 50%, fade-ranked 50%, blowout-win-fade 50%. Only off-blowout-loss
bounce-back flickers (53%, watch). Classic ATS trends are noise (NFL Brief #3 reconfirmed).
THE SIDES EDGE = MODEL away-selection, sharpened by TIER (like totals):
  - Power-5 away, model edge<=-4 -> 58.6%/+11.9% vs open, 56.1% vs close, all seasons (~75/yr).
  - Power-5 away FAVORITE, edge<=-3 -> 60.3%/+15.2% vs open, 56.8% vs close (~36/yr, premium tier).
  - G5 away-fav DEAD (48%); mixed DEAD (51%). Public home-favorite bias concentrated in P5.
SIDES PRODUCT = model spread for every game + bet P5 away teams (model-selected). No standalone ATS spots.

## WEIRD SPREADS / power-rating vs line divergence (2026-06-02, weird_spreads.py)
Built fair_margin = net_rating_diff scaled + HFA (~3.7 pts), walk-forward; divergence vs spread.
fair corr 0.487 < market 0.642 (no leak). BET PR-SIDE at high divergence = NOT exploitable (all bins
50-53%, no dose-response). FADE PR = worse (47.5%). => 'line is wrong vs rating' is an ABSTAIN signal
(market prices the info the rating lacks), NOT a bet trigger -- NFL lesson reconfirmed for CFB.
ONLY exploitable divergence is directional = the away-bias we already have: PR favors away by >=8 ->
bet away 53.8%/+2.8% (trending up 2023-25). Full GBM captures this better (P5 away edge<=-4 58.6%).
No NEW edge from weird spreads beyond the home-favorite/away-value bias.

## DEEP SIDES DIG + MODEL-IMPROVEMENT EXPERIMENT (2026-06-02, sides_deep.py, build_priors.py)
TIGHT SPREADS: efficient (pick'em<=3 ~50%, 3-7 ~51%; no edge — market sharp on close games).
ATS situational spots: mostly noise/volatile (ranked-upset bounce 55% but [68/33/73/41/74]; PT-letdown
fade 64% but n=72 volatile; rival look-ahead doesn't translate to ATS). FP borderline.
SIDES EDGE is the MODEL, sharper on BIGGER P5 spreads: P5 away edge<=-4 & |spread|>7 -> 60.3%, all seasons.
*** KEY FINDING — MORE DATA HURTS BETTING ***: added SP+/FPI(prior-yr)/returning-production/recruiting
(build_priors.py, all leak-safe). A/B: priors IMPROVE prediction (sides MAE 13.01->12.92) but HURT the
betting edge (P5 away 58.6->55.6, +spr>7 60.3->53.7). WHY: market already prices these -> model converges
to the (biased) line -> fewer exploitable divergences. The sides edge is FADING PUBLIC HOME-FAV BIAS, not
out-predicting. LEAN model = the edge. Priors EXCLUDED from production model (build_priors.py kept as research).
Same pattern weaker for totals (under 56.7->55.6). LESSON: for the BETTING layer, naive-to-market beats
feature-rich. Realistic sides ceiling ~58-60% on selective P5-away tier; ATS won't go higher (bias-capped).

## QB AVAILABILITY EDGE (2026-06-02, fetch_qb.py + qb_analysis.py) — the unpriced angle, BEATS CLOSE
Detected backup/changed-QB starts from /games/players (top passer per team-game vs season-established
starter, leak-safe through wk-1). 2021-25, ~278 backup-start games/yr.
*** ATS: FADE the backup-QB team -> 54.1% vs open, 54.0% vs CLOSE (true info edge, market slow on CFB QB
news), all 5 seasons [55/57/54/51/54]. Sharpest: fade HOME backup (bet away) 56.3% (stacks w/ away-value).
Fade away backup (bet home) weaker 52.2% (fights away-bias). ~248/yr. ***
TOTALS: UNDER on backup 54.7% vs open / 52.4% close (partly CLV); backup & open>=50 -> 55.7%/+6.4%.
NEW AVENUE independent of away-favorite bias. OPERATIONAL: live bet needs starter known PREGAME (CFB
usually available via depth charts/injury news; game-time decisions excluded) -> need a QB-status feed for 2026.

## PRODUCTION FORECAST HARNESS (2026-06-02, cfb_forecast.py)
Trains LEAN totals+sides models (no priors) walk-forward; for the target season generates a per-game
predicted total + spread (DISPLAY: out/cfb_predictions_<season>.csv) and fires the curated SPOT library
(BETS: out/cfb_bets_<season>.csv). Per-spot CLV grading when results exist.
Spot library = TIER1 (beats close): under model+high-total/weakD, over low-total+fast(P5), away P5 edge<=-4,
fade-home-backup(bet away). TIER2 (lean at open): over week13(WEAK-2025 fail), under week1/ranked-upset/
PT-letdown/backup-QB.
*** 2025 OUT-OF-SAMPLE (trained on 2016-2024, model never saw 2025): TOTALS 363 bets 59.5%/+13.6%;
SIDES 260 bets 57.7%/+10.1%. *** Strong honest forward-test.
USAGE: dry-run `python3 cfb_forecast.py`; weekly `python3 cfb_forecast.py --season 2026 --week N`
(after pulling that week: fetch_cfbd.py/_extra/_extra2/_qb -> build_ratings -> build_features).
WEEK13 over is a weak spot (failed 2025) -> demote/watch. QB spots need pregame starter feed for live 2026.
REMAINING PRODUCTION: Supabase write-path (predictions to site) + weekly orchestration + CLV ledger persistence.

## MATCHUP FEATURES TEST (2026-06-02, matchup_test.py)
Built explicit offense-facet-vs-opponent-defense-allowed matchups for all 12 EPA/success/explosiveness/
line-yard facets + PPO + field position (per-facet sum for totals, diff for sides). A/B both ADDED on top
and REPLACING raw facets. RESULT: negligible accuracy change (MAE 13.18->13.16 totals, 13.02->12.97 sides)
and betting edge NEUTRAL-to-WORSE (totals under 56.7->55.0; sides P5-away 58.6->55.1 when replacing).
WHY: GBM already extracts matchups from raw facet cols; net_rating_diff & sum_off_epa (= aggregate matchups)
are already the TOP-2 features. Granular matchups redundant; field position priced. NOT wired in.
THIRD confirmation of meta-lesson (after priors, weird-spreads): feature engineering on existing EPA data
doesn't add BETTING edge. Model is near its data-bound ceiling; remaining levers = unpriced data (QB) + spots/bias.

## DEEP DIG ROUND (2026-06-03): conference calibration, coaching, bye, public splits
USER PUSH: model isn't "real", dig deeper into more data. Findings:
1. CONFERENCE CALIBRATION (conf_calibration.py): CONFIRMED real flaw — model over-rates G5 by ~2.5 pts in
   cross-conf games (model P5 margin 14.1 vs actual 16.7; market 16.4). MAE gap by tier P5 +0.28/G5 +0.81/
   MIXED +1.31. Adding conf-strength (prior SP+ by conf) PARTLY fixes bias (-2.18->-1.74) but HURTS betting
   (G5 away 55.9->52.1) = 4th confirmation market-known features erode edge. -> keep BETTING model lean.
   NEW AVENUE surfaced: lean model already has G5 away edge (edge<=-4) ~55.9% (was only using P5 away).
2. COACHING (coach_analysis.py): /coaches pulled. First-year/experience/career-winpct/veteran ATS ALL priced
   (48-50%). Coaching quality priced. (H2H untested = likely noise per NFL coach research.)
3. BYE (bye_deep.py): post-bye/bye-mismatch priced. FADE pre-bye HOME (bet away) 53.6% beats close, all 5 szn
   BUT 47.3% on games model doesn't already flag away -> mostly redundant with away-edge, not independent.
4. PUBLIC SPLITS (public_splits.py, ncaaf_betting_lines 2025 wk2-6 n=403): *** naive FADE-PUBLIC LOSES (public
   side covered ~58%!) — CFB != NFL. Sharp bets/handle divergence ~neutral. Only flicker: public-under -> bet
   over 56.7% (thin). Inconclusive small sample; need full multi-season splits (capture live 2026).
META (now 4x): market-known features improve PREDICTION, erode BETTING (edge = divergence). Additive edges
need UNPRICED data (QB = proven). Diversified avenues we HAVE: sides P5-away/G5-away/fade-backup-QB; 8 totals spots.

## SHARP WRITEUPS ANALYSIS + LUCK SIGNAL (2026-06-03)
Analyzed a CFB sharp's 1.5u+ plays w/ reasoning. His recurring signals mapped to our data:
- LUCK/REGRESSION (his #1 fade): built pythag_luck + one-score-record luck (luck_regression.py). FADING lucky
  teams ALL 47-50% ATS = PRICED. Market accounts for regression. (His dWIN is performance-based + he never
  fades luck alone — always synthesized w/ 7 other factors.)
- TRENCH play, AP-overrating-vs-power-rating, QB-under-pressure, coaching, pace: all things we tested = PRICED
  individually. His edge = SYNTHESIS of priced factors + JUDGMENT (not mechanizable as single signals).
- *** THE UNPRICED EDGE he cites constantly = PLAYER AVAILABILITY: "Tennessee without 4 DBs", "Eli Stowers
  opt out", "Isaac Brown injured - model can't account for it", "Arizona opt-outs", "Mateer rushed back".
  He literally says "a model can't calculate this." -> CONFIRMS QB finding; EXTEND to key skill players +
  bowl opt-outs. This is the avenue. ***
TAKEAWAY: our model's away-edge already = mechanical "fade overrated/lucky teams" (priced divergence). The
additive edge is player availability (QB done; build skill-player out + opt-outs next).

## SKILL-PLAYER AVAILABILITY (2026-06-03, fetch_skill.py/skill_analysis.py) — DETECTION FLAWED, retest needed
Pulled top RB/WR per team-game; flagged "out" = different leader than established primary. PROBLEM: fires on
64% of games (2394 RB / 2971 WR of 3723) = detecting committee/rotation noise, NOT real absences. Results
null (47-52%) but INVALID test. QB worked because top-passer = clean starter; RB/WR need full per-player
usage to detect genuine ~0-usage absence + bell-cow filter (only trust when star normally dominates touches).
Sharp validates the idea (cites skill injuries/opt-outs constantly). TODO: re-pull FULL player usage per game,
track each established star's week usage, flag true absences (esp. bell-cow RBs, target-hog WRs) + bowl opt-outs.
PROVEN player-availability edge so far = QB (fade backup). Skill = promising but needs proper data.

## FULL SKILL-PLAYER + OPT-OUT BUILD (2026-06-03, fetch_player_usage.py/build_player_availability.py)
Pulled FULL per-player usage (156k player-games, regular+postseason). Genuine absence detection (established
workhorse RB avg>=12 car / target WR avg>=4.5 rec records ~0 usage in week W). RESULT: true single-skill
absences TOO RARE to bet — workhorse RB out 6x in 5 seasons, target WR out 16x; even "reduced" (<=3) only 233
(conflates blowout-rest + mid-game injury, not pregame-knowable). VERDICT: skill-player availability NOT a
viable CFB edge — not priced, just doesn't happen enough. QB worked because singular/indispensable/detectable;
RB/WR are committee + durable. PLAYER-AVAILABILITY EDGE = QB ONLY. Opt-outs = bowl-only, multi-player, mostly
DEFENSIVE (can't detect from offensive box), priced by bowl season; would need separate bowl pipeline (model_games
is regular-season only). player_usage.parquet kept for any future use.

## LINE-ORIENTATION AUDIT + FIX (2026-06-03) — user-flagged, REAL BUG FOUND
CFBD /lines has SIGN-FLIPPED spreads on ~1-4% of rows (Bovada 3.1%, DK 0.7%, ESPN 0.4%); confirmed via
spread-vs-moneyline mismatch + provider-sign-disagreement. Median consensus already fixed CLOSE (0.2% residual
vs purchased) but OPEN had 1.25% flips. FIX in consensus_lines(): ML-anchor each row -> majority-sign vote ->
orient open to close. Now 0 open/close sign mismatches. *** Away edge SURVIVES fix (P5 away 58.6->58.2) = real,
not a line artifact. *** Lines now clean & locked in pipeline.

## DEEP-DIG ROUND 3 (user push, all ideas tested) — all PRICED except the line fix
- consistently-mispriced (ATS persistence): NULL (cover history doesn't predict next cover; market corrects).
- home/away PERFORMANCE splits: PRICED (big home-team at home 49.8%). ATS-by-venue not persistent.
- game-to-game REGRESSION (overperf->fade / bounce-back): PRICED (51.7%/49.7%).
- TRENCH mismatch (sharp's #1 factor): PRICED (run-block edge team covers 46.5%!).
- ARCHETYPE matchups (off-cluster x def-cluster): noise (multiple-comparisons, no stable cell).
META (final): CFB sides market efficient on performance/style/situation/trench/regression/home-away. Edges =
model quality-vs-line divergence (away P5/G5) + QB availability + totals structural spots. Confirmed ~18 ways.

## MONEYLINE INVESTIGATION (2026-06-03, moneyline_value.py) — MARKET EFFICIENT, no edge
ML data also corrupted (homeML to -100000 placeholders, 3.8% same-sign/flipped rows); cleaned (valid odds,
opposite signs, vig 1.0-1.15, ML-favorite=spread-favorite orientation). FINDINGS:
- MARKET ML WELL-CALIBRATED: implied vs actual 0.15->0.16, 0.73->0.73, 0.86->0.87; overall 0.551->0.558.
- Bet ALL favorites ML -5.4% ROI; ALL dogs -4.6%; every favorite tier negative -> just pay the vig. NO
  favorite-longshot edge (the ~1.8pp fav undervaluation < vig).
- Our model OVERCONFIDENT on win-prob (says 0.815, actual 0.677; market 0.659) — logistic calibrated on
  overfit-train preds. Initial +27%/+75% ROIs were ARTIFACTS (corrupt ML + overconfidence). No real ML value.
- Ensemble (ML+spread agree): ML = same win-prob info as spread, both efficient -> no independent signal.
CONCLUSION: CFB ML market efficient; no ML edge. Spread away-edge is a COVER-margin phenomenon (survives),
not win-prob (efficient). Note: GBM win-prob is overconfident OOS — don't trust raw model probabilities for
display without recalibration on a holdout (the spread cover-edge uses margin edge, not probs, so it's fine).

## cfbfastR EP-MODEL ARTICLE -> GARBAGE-TIME-EXCLUDED test (2026-06-03, fetch_gt_excluded.py/gt_test.py)
Article = the EPA/EP-model foundation (multinomial logit on down/dist/yardline -> next-score -> EP) we already
consume. NEW reachable: excludeGarbageTime WORKS on /stats/season/advanced (ignored on /game/advanced); /plays
available (situational/leverage/WP). Tested GT-excluded season-to-date as features: A/B NO betting improvement
(P5 away 58.2->58.4, totals under 56.7->56.0; MAE flat). Market prices GT-excluded quality (SP+ uses it).
Nth confirmation: rating refinement != betting edge. PBP situational/leverage = still team-quality slices (likely
priced). ONLY genuine PBP value = CALIBRATED win-probability model for DISPLAY (fixes GBM overconfidence found
in ML work) — a product fix, not a betting edge.

## EDGE DOSE-RESPONSE -> NEW PREMIUM SIDES TIER (2026-06-04, user question)
Q: does bigger model-vs-line gap = higher ATS accuracy? YES, strongly in P5 (clean ratings):
gap 0-1 ~50% / 3-4 54% / 6-8 56% / 8-10 61% / 10-14 68.6%. Small gaps (0-1) actually <50% (noise).
*** KEY REFRAME: EDGE MAGNITUDE is the real filter, NOT home/away. Prior 'home side dead' was only true at
LOW edge (<4, public home bias). At |edge|>=8 P5, model hits BOTH sides: away 65.5%, home 61.6%. ***
PREMIUM TIER: |model edge|>=8 & P5 (either side) -> 63.7% vs open / 60.0% vs CLOSE (+14.5% roi), +0.93 CLV,
all 5 seasons, n=212 (~42/yr). |edge|>=10 P5 -> 66.4%. BEATS THE CLOSE = real edge. Supersedes away-only rule.
Mechanism: large divergence flags genuinely soft openers; in P5 (clean ratings) those are right ~60-64%.

## HIGH-EDGE GAME DIG (2026-06-04, high_edge_dig.py) -> conviction tiering + favorite insight
Dug into |edge|>=8 P5 games (n=212, 63.7%/60% close, all 5 szn>=59). No single feature separates correct/wrong
calls (max std-diff 0.34 = uniform tier). BUT posture matters: model BACKING THE FAVORITE -> 68.6%/62.5% close
(+31% roi, all szn) vs taking the DOG 60.3%/58.3%. INSIGHT: market under-rates strong favorites (line 7-21) when
fundamentals strongly agree (opposite of public 'fade chalk'). Edge BREAKS at line 21+ (53.8%, can't price blowouts).
Wired tiered into cfb_forecast.py: PREMIUM lay-fav (edge>=8, fav, line<21) > T2 high-edge dog > T3 moderate-away+QB.

## LINE-MOVEMENT DATA + PHASE 1 (2026, The Odds API 2021-25, all books, pre-game only)
Pulled ~1.31M book-game-snapshot rows (Supabase ncaaf_odds_history + data/odds_history/*.parquet), ~78.6k
credits. build_odds_frame.py -> per-game open/close/movement + no-vig ML, 3,707 clean games (close median
1.1h pre-kick, open ~6 days out). NO public splits (can't get) -> no RLM-vs-public.
PHASE 1 (phase1_movement.py): CFB lines VOLATILE (|spread move| 1.70 avg, 62%>=1pt). STEAM doesn't beat
close (line-moved side covers close 48-51% = efficient at close; movement is a CLV play not a close-edge,
mirrors NFL). *** CLV CONFIRMATION: our PREMIUM |edge|>=8 P5 picks get +2.99 pts CLV, line moves our way 65%
(betting-fav 70%). Real-edge signature — market moves TO us by close. BET AT OPEN to capture ~+3 CLV. ***
All |edge|>=4 picks: +0.93 CLV. Books declined 23->10-11 over time (market consolidation, not error).

## PHASE 2 — no-vig ML vs spread divergence (phase2_ml_divergence.py): NO EDGE
Built CFB walk-forward spread->home-winprob table (logistic, seasons<Y). divergence = open no-vig ML winp -
spread-implied winp. mean |divergence| = 1.9pp = ML & spread tightly coherent in CFB. Follow/fade divergence
all 46-51% ATS; NFL 'tight + soft-ML fade home' does NOT transfer (n thin, ~51%). No usable ML-vs-spread edge.
Consistent w/ earlier ML-efficiency finding (99% fav-agreement). LINE-DATA NET: Phase1 CLV confirmation
(premium edge +3 CLV, bet at open) = POSITIVE & actionable; Phase2 + steam = no NEW standalone edge (priced).
Line data's value = CLV confirmation + execution (bet open, best number), not a new edge source.

## PHASE 2b — ML-spread inconsistency, exhaustive re-test (phase2b_ml_spread_gap.py)
gap = ML-implied fair spread - actual open spread (pts). Inconsistency REAL: 40% games >=1pt, 12% >=2pt.
Tested 4 ways: follow-ML / fade-ML / straight-up winner / does-spread-move-to-ML. RESULTS: follow-ML ATS
51.9->42.3% (worse w/ gap); ML side wins more only b/c it's the favorite (priced); spread does NOT move toward
ML (%moveToML 41-48% <50 = no CLV, ML doesn't lead). Apparent fade-ML edge (|gap|>=2 = 55.6%) was a BIG-FAVORITE
artifact: extreme-ML->spread inversion is unstable; restrict |spread|<=14 -> 51.9% DEAD, and all-spread crashed
to 38% in 2025. CONCLUSION: NO exploitable ML-spread inconsistency edge in CFB (books keep them coherent;
residuals = noise or big-fav math artifact). Confirms ML-market efficiency. Chased the flicker to its source.

## PHASE 1b — DEEP movement (magnitude x timing x market, build_movement_windows.py / phase1b)
Line captured at open(144h)/72h/24h/6h/close(1.1h) per market. Graded at close.
- Spread by MAGNITUDE: efficient (48-51% all buckets). Timing (early/late/v-late steam): all ~49% =
  close prices in the move regardless of when. Totals/ML same (priced).
- *** SPREAD LATE-REVERSAL = real signal: spread moves >=1pt EARLY (open->24h) then REVERSES >=1pt LATE
  (24h->close); FOLLOW the late move -> 55.2% ATS, ALL 5 seasons >=54% (n=201 ~40/yr, +5.4% roi). Sharp money
  correcting an early/public move. Raw late move w/o reversal = 49.6% (efficient) -> it's the REVERSAL that
  matters. ***
- TOTALS reversal: DEAD (51/45/36% by magnitude). ML reversal: n/a (priced).
Orthogonal to fundamentals model (line-behavior signal) -> usable as standalone spot + confluence overlay.

## PHASE 1c — ODDS/JUICE movement (phase1c_juice.py) — NOT just line number
Analyzed spread/total PRICE (juice) asymmetry + movement, consensus AND per-book. FINDING: CFB juice is
overwhelmingly -110/-110. DraftKings spread juice 77% at ~-110, only 1% shaded <=-120; over 81% at -110.
FanDuel a bit looser (46% at -110) but still mostly -110. Consensus juice asymmetry at close ~always 0.50.
Juice movement / hidden-steam (number flat + juice moved) all tiny-n (11-47), no usable signal.
STRUCTURAL CFB!=NFL: CFB books move the NUMBER (margins dispersed, key numbers weak) rather than shade JUICE
(NFL shades at sticky 3/7). => juice/RLM-via-price is a DEAD END in CFB. All line action is in the NUMBER ->
spread LATE-REVERSAL is the one line-behavior signal. ML odds movement = priced (Phase 1b).

## PHASE 1d — dedicated DEEP totals movement (phase1d_totals_movement.py): NO SIGNAL
Magnitude: 50-53% (big moves overshoot to 47%). Direction asymmetry (up->over 49%/down->under 51%): no
reliable sharp-under-steam, per-season volatile. Timing (early/late/v-late): 48-53%, no edge. REVERSAL (the
spread winner): DEAD for totals (47.7/51.3/44.9%, per-season volatile) — does NOT transfer from spread. Steam
(total dropped/rose >=1.5 -> under/over): 49.5/49.4% efficient. + Phase1c totals juice flat -110.
=> TOTALS line+odds movement = COMPLETE DEAD END in CFB. Spread has late-reversal (sharp side money); totals
movement = pace/weather/injury already priced by close. Totals EDGE = structural spots (high-total under,
low-total+fast over, week1), NOT movement.

## DK SPECIFIC-NUMBER / KEY-NUMBER ANALYSIS (DraftKings only, dk_numbers.py / dk_keynumbers.py)
Margin dist confirms key numbers: 3=10.6%, 7=8.8%, then 10/14/17/21/4/6. Totals SMOOTH (no key clusters).
Overall DK close dog cover 50.6% = EFFICIENT (no blanket dog edge; earlier 'dog lean' was push-as-loss artifact).
REAL key-number edges (push-excluded, per-season, DK close):
 1. SMALL DOGS +2.5/+3/+3.5 -> 54.1% (n=628, +3.4% roi, [51/57/57/57/48]); both home(54.3) & away(53.9) =
    fade-small-chalk effect (public over-bets small favs + 3 is dominant margin). +2.5 also 54.8% so it's
    broad small-dog, not purely the 3-push.
 2. LAY FAV -6.5 -> 57.3% (n=143, +9.5% roi, [63/50/65/56/52]); -7/-7.5 -> 54.6%. Mechanism: -6.5 wins ON the
    7-margin (8.8%). Consistent.
NOISE (rejected): -8.5/-9.5 'fav covers' = multiple-comparisons (adjacent -5.5 dog 61%, -8.5 dog 57% alternate).
TOTALS: no key-number edge (exact closing totals 33-63% scattered, smooth dist). CROSSING: crossed-3 nothing,
crossed-7 56.6% (n=145) WATCH. Edges are DK-close, structural, independent of model -> standalone spots/overlays.

## BOOK SHARPNESS / SOFT-BOOK EXPLOIT (book_sharpness.py, book_softness_test.py, book_disagreement.py)
Per-book close spread MAE vs outcome is ~identical (12.0-12.7) across ALL books (everyone converges by close)
-> MAE does NOT discriminate. Deviation-from-consensus does, BUT deviation alone != soft (sharp books like
Circa/WilliamHill deviate by LEADING). Real test = grade a book's LEAN (when off consensus) at consensus #:
  SHARP (lean covers >52%): williamhill_us 53.0 [53/54/56/51/49], twinspires 53.8 (gone post-2023).
  SOFT  (lean covers <48%): MYBOOKIEAG 45.6 [51/43/42/--/45] = LEAST SHARP; bovada 48.2, biggest off-#s (~0.8).
  NEUTRAL NOISE (high deviation but NOT directional): fanduel 50.8, draftkings 51.8, betmgm, betrivers ->
  their wide lines are noise, NOT fadeable. (Corrects naive 'fade FanDuel' read.)
EXPLOIT (book_disagreement.py): when SHARP (WilliamHill) & SOFT book disagree on close spread, bet SHARP side
AT THE SOFT #, grade at soft # (real). Edge SCALES with gap (= genuine mispricing) and holds EVERY season:
  WH vs BOVADA  gap>=0.5: 53.9% n=1027 [53/57/54/51/57] +3% roi ; gap>=1.0: 61.6% n=138 [65/69/60/59/61] +17.6%
  WH vs MYBOOKIE gap>=0.5: 57.6% n=736 [55/59/62/60/56] +10% ; gap>=1.0: 66.9% n=148 [62/63/71/--/71] +27.7%
Caveats: grades @ soft-book CLOSE (need accounts at sharp ref + soft book; Bovada mainstream, MyBookie offshore
w/ limits, no 2024 mybookie data). Closing-snapshot disagreement -> live = compare both books at bet time.
NEXT: build sharp-CONSENSUS (WH+DK+twinspires) vs soft-CONSENSUS; fold into harness; test totals & ML same way.

## SOFT-BOOK EXPLOIT — TOTALS & ML (book_disagreement_totals_ml.py)
TOTALS: WH-vs-Bovada 49.0/50.7% = DEAD. WH-vs-MyBookie 52.2/55.0% [56/60/48/--/50]; gap>=1.5/2.0 spikes 65-76%
but n=41-57 ALL 2022 = single-season noise, NOT signal. => NO totals soft-book edge.
MONEYLINE: ROIs +286/+821/+46% = ARTIFACT (big-dog variance + stale/mis-scraped ML), tiny n(30-96), per-season
[43/74/89] inconsistent. Same ML data-quality trap as phase2. REJECT.
THESIS (confirmed 5 ways: key#, soft-book, movement, juice, ML-divergence): CFB exploitable line microstructure
is ENTIRELY on the SPREAD. Totals efficient (edge only via fundamentals model spots). Moneyline efficient.

## SHARP-CONSENSUS vs SOFT-CONSENSUS BLEND (book_consensus_blend.py) -- PRODUCTION FORM of soft-book exploit
SHARP blend = median close spread {williamhill_us, twinspires, draftkings}; SOFT blend = median {bovada,
mybookieag}. Require >=2 sharp + >=1 soft/game (n=3611 paired). Bet sharp-favored side @ soft #.
Grade @ SOFT-CONSENSUS (conservative): gap>=0.5 56.4% n738 +7.6% [53/63/54/50/63]; gap>=1.0 61.8% n110 +18% [65/64/59/50/69].
Grade @ BEST soft # on side bet (real-world line-shop): gap>=0.5 56.8% +8.4%; gap>=1.0 64.2% n109 +22.6% [70/69/59/50/69].
Best-# line-shop adds +2.4 cover/+4.6 roi over median => keep BOTH soft accounts. 2024 weak (50%) = MyBookie data
absent that yr (soft collapsed to Bovada-only); all yrs w/ both soft books 59-69%. Trigger gap>=1.0 ~22 bets/yr,
gap>=0.5 ~150/yr. Robust vs single-book (survives outages). TIERS: VOLUME gap>=0.5 56.8%/+8.4%; SELECTIVE gap>=1.0
64.2%/+22.6%. Both every-season-positive. -> fold into harness as spot. NEXT: timing/lag (snipe soft # pre-close).

## SOFT-BOOK TIMING / LAG (book_lag_analysis.py) -- partial confirm
A. GENERAL LAG HYPOTHESIS REJECTED: @gap>=0.5, soft moves TOWARD sharp's 24h line only 49.1% (coin flip);
   both books drift, no clean leader/follower. Cannot blanket-snipe soft on convergence assumption.
B. @24h bet sharp side at soft#: gap>=0.5 = 50.0%/51.4%best (VOLUME edge VANISHES early -> must wait for CLOSE);
   gap>=1.0 = 58.1% med / 65.2% best [89/67/63/--/62] (SELECTIVE edge survives early).
C. CLV: gap>=1.0 bet @24h gave better # than soft CLOSE 71% of time, avg +1.75 pts.
SYNTHESIS: VOLUME tier (gap>=0.5) = closing-line play only. SELECTIVE tier (gap>=1.0) = can bet 24h EARLY,
~65% either way + lock +1.75 CLV. Timing = upgrade to selective tier, not a new edge. (gap>=1.0@24h n=92,
2024 absent, 2021 lumpy -> treat as 'can bet early w/o losing edge', not standalone.)

## MODEL x LINE-SIGNAL STACK (combo_model_lines.py) -- KEY RESULT: edges are INDEPENDENT & STACK
Walk-forward (train<S, predict S; no 2025->2025 leak), graded @ CONSENSUS CLOSE (strict).
MODEL ALONE @close |edge|>=2: 50.8% / -3% roi = confirms model is +CLV/website product, NOT standalone
close-beater. The SOFT-BOOK GAP turns it bettable:
  SOFT-BOOK GAP>=0.5: AGREE 55.0% n311 +5% / DISAGREE 47.8% n293 -9%  [2025: AGREE 61.9% n42 / DIS 35.1% n37]
  SOFT-BOOK GAP>=1.0: AGREE 72.7% n55 +39% / DISAGREE 48.2% n56 -8%   [2025: AGREE 77.8% n9 / DIS 25% n4]
  FULL LINE MOVE dir: 50.1 vs 47.9 = NO INFO (discard as confirm)
  LATE REVERSAL: AGREE 51.6 / DISAGREE 40.2% n82 -23% = DANGER FLAG (reversal-contradicts-model -> model wrong);
    use as VETO not confirm.
RULE: bet model side ONLY when soft-book gap AGREES (>=0.5 volume ~55%, >=1.0 thin ~73%); PASS when gap
disagrees (model sub-50); VETO model bet contradicted by a late reversal. gap>=1.0 AGREE thin (n55 OOS/9 in
2025) high-conviction; gap>=0.5 AGREE robust (n311). Two INDEPENDENT edges (fundamentals + market microstructure)
confirm each other.

## CONFERENCE-SPECIFIC NUMBER EDGES (conf_numbers.py) -- user theory CONFIRMED (selectively)
Baselines efficient (fav cover 49.2%, over 49.0%). Tested ~190 conf x band x loc cells; survivors pass
per-season consistency + recent-years(2021-25) validation + mechanism. VALIDATED (recent-yr stats):
  Sun Belt total 59-66 UNDER 67.9% n56 +29.5% (run-heavy, overpriced high)
  Big Ten AWAY fav >=14.5 COVER 62.2% n37 +18.7% (road favs undervalued) [thin]
  Sun Belt FADE HOME FAV (dog) 57.7% n156 +19.2% (home favs overvalued) [robust n]
  SEC total 52+ UNDER 56.7% n141 +8.3% (defensive, totals too high) [robust n]
  AAC total 52-59 OVER 56.7% n104 +8.3% (up-tempo pass-happy G5) [robust n]
  Big Ten AWAY fav any COVER 55.2% n145 +5.3% [robust n]
RECONCILES 'totals dead': those edges were market-microstructure (movement/key#/softbook). THESE are STRUCTURAL
(conf style/pace/defense) = different mechanism, consistent w/ model structural totals spots.
CAVEAT: multiple comparisons (~190 cells); thin ones (SunBelt 59-66 n56, BigTen14.5 n37) higher variance;
robust = SunBelt-fade-homefav, SEC-under, AAC-over, BigTen-awayfav. Most other conf cells = noise.

## LINE MOVEMENT by LIQUIDITY: P5 vs G5 (conf_movement.py) -- user theory CONFIRMED
P5 spreads move more (avg |move| 1.84) than thin G5 (1.38). FOLLOWING moves fails everywhere (P5 coinflip,
G5 sub-50=overshoot). KEY: FADE the spread move (bet side line moved AWAY from, grade @ close):
  G5 fade move>=0.5: 53.2% n1150 [50/54/53/54/55] recent23-25 54.0% n726 (EVERY season +); move>=1.5: 54.3% n571
  P5 fade: 50.1% (EFFICIENT - heavy 2-sided action prices it); MIX: 50.4% (nothing)
TIMING: P5 LATE move mildly predictive (53%); G5 early+late both ~45% (uninformative). REVERSAL follow-late
liquidity-INDEPENDENT: P5 54.8% n104, G5 55.7% n70 (already in harness). TOTALS: P5 mild (small-move follow 55%,
down->under 53%), G5 nothing, MIX noisy.
=> NEW SPOT candidate: FADE G5 spread move>=1.0 ~53%, every season +, mech=thin-market overshoot. Grade @ close.
   (not yet wired; needs consensus sp_open/sp_close move in line_signals.)

## SIGNAL CONDITIONING: sharpening signals with team stats/matchups (signal_conditioner.py)
Cross each signal with bet-team-oriented stats (EPA/OL-DL/explosiveness/pace/field-pos/bye/rank/talent).
Filter: lift>=6pts, n>=20, per-season consistency>=60%. ~200 cells tested (multiple-comparisons -> HYPOTHESES).
HEADLINE = EXPLOSIVENESS is the master conditioner for spread signals (mechanism: explosive=high-variance=
unreliable ATS; methodical low-expl=covers predictably):
 - STACK (base 55%) x bet-team LOW explosiveness -> 69% (+14, n100, every season>50). Holds within FAV (63%,n30)
   & DOG (71%,n70) separately = NOT a favorite proxy (confound-checked). HIGH-expl STACK = FADE (expl fav 41.6%).
   Correlated cuts (slow pace 66%, good field-pos 64%, low EPA 64%) = same 1 underlying 'methodical team' factor.
 - SOFT-BOOK GAP (base 54%) x bet-team good field-position 60.5% (n271,100%) OR low explosiveness 60.4% (n255,100%).
 - MODEL high-edge |edge_close|>=6 (base 52%) x bet-team RANKED -> 60% (+8, n271, every season); high-talent 60% (soft 2025).
 - KEY dog+3: CANNOT be sharpened (uniform across all conditions = honest null).
2 real factors found (not 9): team VARIANCE (explosiveness/pace) + team QUALITY (ranked/talent). ACTIONABLE:
add explosiveness filter to STACK (prefer low-expl bet team, avoid/fade high-expl) -> 55%->66-69%. Track as
hypotheses (sub-buckets n=30-100).

## SIGNAL CONDITIONING — HOLDOUT VERIFICATION (FAILED): explosiveness sharpener REJECTED
Verified the explosiveness conditioner on 2025 holdout + blanket. RESULTS DISCONFIRM:
 - Blanket low-expl team ATS 2025 = 48.1% (226-244) ~ high-expl 48.9% -> NOT a standalone edge.
 - 2025 soft-gap split by bet-team expl: LOW 62.5%(15-9) vs HIGH 61.8%(47-29) = NO sharpening.
 - 2025 STACK split: LOW 66.7%(n9) vs HIGH 60.0%(n30) -> n too thin, not confirmation.
=> The pooled 69%-vs-47% explosiveness lift was 2021-24 in-sample / multiple-comparisons artifact; does NOT
replicate 2025. REJECTED, do NOT wire. Lesson: treat ALL conditioning-sweep hits (ranked/field-pos/pace) as
likely-overfit unless each passes a 2025 holdout split. The BASE signals DID hold in 2025 (soft-gap ~62%,
STACK ~60-67% regardless of expl) -- those remain the product; the conditioning layer added nothing verifiable.

## ARCHETYPE MATCHUP MIXTURES (archetypes.py + matchup_archetypes.py)
Built as-of/walk-forward archetype engine: 6 OFF axes (identity[car/(car+rec) since `tar` field broken], OL,
style, pass, QB-mobility[from qb_starts+player_usage], tempo) + 5 DEF axes (front7, secondary, runD, aggression,
bigplay) from model_games adj_* + player data. Sanity-checked vs known team identities (Iowa/AirForce/OSU/etc -> correct).
MATCHUP findings (graded ATS@close, baseline 50.0%, holdout discipline = pooled 21-24 AND 2025 both required):
  BACKING obvious mismatches = DEAD (market prices them): run+OL vs soft-runD 50.5/50.0; vert-WR vs weak-sec 49.3/49.7.
  FADING NEUTRALIZED-STRENGTH teams = WORKS & HOLDS OUT (mild ~52-53%):
   - Pocket-QB vs Blitz-D: FADE 52.1%(21-24)/55.8%(2025) [49/61/53/46/56]
   - Pocket-QB vs Dominant-front: FADE 51.6%/60.2% [54/56/51/46/60]   (these 2 = one factor: pocket QB vs pressure)
   - Run-heavy+Elite-OL vs Stout-runD: FADE 52.7%/52.4% [58/54/55/49/52]
  TOTALS archetype clashes: ALL fail holdout (both-uptempo over 51.8/45.5; methodical-under 39.6/49.0 etc).
MECHANISM: market overvalues teams whose paper-strength (pocket passing / power run) is canceled by opp's matching
strength. MILD leans (~breakeven 52.4) -> best use = conditioner/tiebreaker on soft-gap/STACK, not standalone.
2 real factors: (a) fade pocket-QB vs pressure, (b) fade run-team vs stout-runD. 2024 soft for pocket fades.

## ARCHETYPE MIXTURES -> TOTALS (matchup_totals.py): mostly DEAD (totals efficient, consistent w/ all prior).
Game-level mixture counts (n explosive/leaky-D/stout/etc), graded @close, baseline over 49.6%, holdout-disciplined.
NOTHING clears 52.4% breakeven in BOTH pool(21-24) AND 2025 w/ adequate n. Closest:
 - PROMISING but UNDERSIZED: 2 explosive O + >=1 leaky D -> OVER 55.1% (pool 55.2/2025 53.8) [52/70/57/46/54] but
   2025 n=13 too thin. Clean shootout mechanism. TRACK, not bettable yet.
 - Stable but SUB-breakeven: 2 vertical-WR -> over 52.0% (pool=2025=52.0 exactly); >=3 strong-D + 0 explosive ->
   under ~51-52%. Real leans, not profitable.
 - FAILED holdout: 2-lockdown-sec under (58.6 2025 but 50.5 pool=mirage), 2-uptempo over, 2-methodical under.
CONCLUSION: only surviving totals edges remain STRUCTURAL CONFERENCE spots (SEC under/AAC over/SunBelt under).
Archetype mixtures echo shootout->over / rockfight->under faintly but don't beat market OOS. Don't re-mine.

## ARCHETYPE MIXTURES x CONFERENCE (conf_archetype_trends.py) -- EXPLORATORY (tiny cells, no usable holdout)
Smallest-sample cut. Findings: (1) conf-level archetype TOTALS just RE-EXPRESS existing conference spots -
SEC rockfight under 56%(n164)/BigTen 53%(n167) = same SEC/BigTen under; AAC rockfight only 37% under = AAC
over-friendly (already known). Archetypes add ~nothing on top of conference identity for totals.
(2) NEW interaction leads (theory-fit but thin, TRACK not bet): BigTen fade run+OL-vs-stout-runD 63.8%(n47)
[--/64/--/60/59] (run conference -> run brand overvalued vs stout run-D); G5 (MAC 58.5/CUSA 59/AAC 55) fade
pocket-QB-vs-pressure (weak G5 passers exposed). All cells n<70, bouncy per-season, 2025 cells n<15 = unconfirmable.
CONCLUSION: conference identity already captures most archetype info at conf level; interaction samples too thin.

## GAME-ENVIRONMENT vs POSTED TOTAL (game_env_totals.py) -- REAL totals edge (holds out), user reframing
Archetype env score (shootout<->rockfight) -> walk-forward linear archetype-IMPLIED total; resid=implied-posted.
Bet when posted DISAGREES with archetype environment. UNDER side is the edge (books shade totals UP -> one-directional):
  UNDER resid<=-3.5: 55.1% n720 +5.3% roi, pool 55%/2025 55% [52/58/58/55] HOLDS every recent season.
  UNDER resid<=-4.5: 54.8% holds; resid<=-1.5: 53.7% holds. OVER side weak (~53%, fails 2025 holdout=public loves overs).
NOT redundant w/ model (corr env_resid vs model_resid only 0.52). ADDS MOST where it DISAGREES w/ model:
  env-under>=3.5 & model NOT under -> 57.6% n264 +9.9% (orthogonal 'game-type' info EPA model misses);
  both-under = 52.2% (already priced). Game-type conditional: rockfight(env<=-2) priced-high -> under 54.1% (pool54/2025 54).
ACTIONABLE: add archetype-env-residual UNDER spot to harness (complement to model totals, strongest when model disagrees).
First archetype-totals edge to survive holdout -- the RELATIVE-to-environment framing unlocked it (blanket archetype totals were dead).

## CAN WE PUT ARCHETYPE/ENV INTO THE MODEL? (model_archetype_test.py) -> NO, keep it as a SEPARATE overlay
Walk-forward 2022-25 totals, BASE vs adding archetype features:
  BASE MAE 13.163, UNDER<=-3.5 53.2% | +player(QB mob/identity) ONLY: MAE 13.170, under 51.0% (HURT) |
  +env ONLY: 13.134, 52.4% | +both: 13.124, 54.1%. Gains marginal/noisy; player-alone hurt.
Decisive: env IN-model 54.1% < env as OVERLAY 55.1% < overlay-on-DISAGREEMENT 57.6%. Dissolving the signal into
the 180-feature booster AVERAGES it away (correlated feats -> down-weighted); the edge is specifically the
DISAGREEMENT between qualitative game-type and quantitative model, which is impossible to capture inside one model.
ARCHITECTURE DECISION: keep EPA model as-is (do NOT add archetype feats); keep archetype-env as separate overlay
spot; bet under hardest when env & model DISAGREE. Ensemble of 2 different views @ decision layer > 1 bigger model.

## *** CORRECTION (user challenge): ARCHETYPE-ENV TOTALS "EDGE" RETRACTED -> it was MEAN REVERSION ***
Decisive within-band test: within each posted-total band, env does NOT separate over/under (total 0-50 lowEnv
53.4/highEnv 52.2; 50-57 51.5/49.2; 57+ 45.0/44.9). env adds NOTHING beyond posted-total LEVEL. The earlier
"archetype-env residual under 55% / disagreement 57.6%" was ~entirely fading extreme posted totals (env only
moves a total +-3pts -> residual ~= mean-posted). game_env_totals/model_archetype_test edges = mean reversion mislabeled.
HONEST TOTALS EFFECT = FADE EXTREME POSTED TOTALS:
  HIGH total >=60 -> UNDER 55.1% n709 +5.3% roi [57/52/58/55/53] every season (SOLID, bettable).
  LOW total <=50 -> OVER 52.5% n1319 [51/47/53/57/53] (WEAK/near-breakeven but REAL -> there IS an over signal).
Asymmetry real: under(55%)>over(52.5%) bc books shade totals UP (public over-bias). Archetypes do NOT improve either.
FLAG: re-check conference totals spots (SEC under/AAC over) for same total-level confound.

## CONFERENCE TOTALS CONFOUND AUDIT (vs same-total-band baseline) -> SEC retracted, AAC/SunBelt survive
Marginal effect beyond same-band baseline: SEC total52+ under +1.6pts (=MEAN REVERSION, retract); AAC 52-59 over
+8.7pts (REAL, goes OVER in an under-leaning band); SunBelt 59-66 under +13.5pts (REAL). HARNESS UPDATED: removed
"CONF SEC total 52+ UNDER"; added generic "TOTAL fade high>=60 UNDER" (55%) + "TOTAL fade low<=50 OVER" (weak 52.5%);
kept CONF AAC over + CONF SunBelt under. (Other conf SPREAD spots: SunBelt fade-home-fav, BigTen away-fav unaffected.)

## WALK-FORWARD TEAM FORM (team_form.py) -> O/U form is CONTRARIAN (mean-reverts), NOT persistent. REAL EDGE:
As-of season-to-date team over-rate/cover-rate/avg-total (>=4 prior games). Tested form persistence:
 - HYPOTHESIS (both teams hot to over -> over) is FALSE/backwards: over-hot teams REGRESS -> game goes UNDER.
 - **BEST TOTALS EDGE: over-hot (comb over-rate>=.60) & posted total<=58 -> UNDER 58.4% n373, pool 58.1/2025 60.3,
   +11.6% roi [76/69/52/56/60] every season >50.** total<=55 version 59.3% n253 +13.2%. Survives total-level
   confound (within-band marginal +9.5pts at totals<=58, so NOT just fade-high-total) AND 2025 holdout.
 - Mechanism: over-streak partly luck -> teams regress; cleanest where total NOT inflated (<=58). Asymmetric:
   reverse (under-hot->over) FAILS (49%) = books shade totals UP, exploitable side is always toward UNDER.
 - ATS form: NO edge (ATS-hot revert only ~52%, market prices streaks). Form-implied-total>posted->over also fails (contrarian).
TODO: wire as spot (needs as-of team over-rate in a form module / line_signals).

## STRENGTH OF SCHEDULE (sos_analysis.py) -- we had NONE explicit; built as-of SOS (overall + home/away split)
Had: implicit opp-adjustment in adj_* feats + adjacent-opp net (last/next/cur). MISSING: cumulative season SOS,
home/away SOS split. Built from each model_games row carrying BOTH teams' as-of net_rating (leak-free).
FINDINGS (ATS @close, holdout-disciplined):
 - ROAD-SOS hypotheses FAILED: road-tested away teams (high road-SOS) cover only 47% (every season 40-46) = NOT
   battle-tested, overvalued. "Tougher-schedule team covers" also false (46%).
 - REAL EDGE (survives confound + holdout): FADE THE PADDED ROAD TEAM = away team net_rating>median & SOS bottom-40%
   -> bet HOME 55.1% n361 +5.2roi [49/52/55/55/61] (2025 61.3%). Confound check: within good-away-teams, weak-SOS
   55.1% vs strong-SOS 50.7% (SOS adds +4.4pts beyond rating; vs plain fade-good-away-team 51.5%). net_rating only
   0.58 corr w/ SOS (distinct info). Mechanism: gaudy rating vs cupcakes -> overvalued, exposed on road.
TODO: wire as spot (needs as-of SOS module like form_signals.py). Note: the ROAD-specific SOS split didn't pay; OVERALL SOS did.

## PADDED ROAD TEAM x POWER-RATING-vs-LINE (sos_pr_line.py) -- SHARPENS the SOS fade to 62.5%
PR calibration: ~56.5 pts per net_rating unit, HFA intercept 2.47pts. PR_margin = HFA + 56.5*net_rating_diff.
resid = market_margin(-spread_close) - PR_margin. Within padded-road spots (away rating>median & SOS bottom40%):
avg market road spread +4.3 vs PR-implied -5.3 -> market already discounts padding ~1pt ON AVERAGE. BUT the split:
 - market TRUSTS padding (resid<=-1, line>=PR on road) -> bet HOME 62.5% n72 pool61/2025 75 +19roi [55/63/62/67/75] EVERY season
 - market NEUTRAL 56.8% n37 ; market DISCOUNTS (resid>=+1) -> 47.9% n94 NO EDGE (priced in, pass)
CREDIBILITY: resid ALONE predicts nothing (all-games 50.5/49.2) -> edge is the INTERACTION (padded + market still
trusts it), not generic line-vs-PR. Sharpens SOS fade 54.7%->62.5%. Mechanism: padded rating + market buying it = double overvaluation, exposed on road.
TODO: wire (needs SOS module + net_rating_diff PR calibration in harness). Pass when market already discounts (line<PR).

## AFTER-BIG-GAME bounce-back / regression (team_bigame.py) -> THEORY FAILS, efficiently priced. NEGATIVE.
Team ranked(P5)/top-2 conf PR(G5) whose prior opp was ranked/high-PR; split by win/loss of that big game.
Theory: LOST->bounce(cover), WON->regress(fade). RESULT: P5 LOST->team covers 48.3%(pool46.8), WON->fade 49.2%
(pool48.5) = neither works, ~noise, mild MOMENTUM not regression. 2025 spikes (60%) = small-sample, pool fails.
G5 top-2: after loss cover only 38% (gets worse); "fade after loss" ~62% but per-season inconsistent [2021=43 opp]
and just RE-EXPRESSES padded-good-G5-team overvaluation (sos_pr_line). No new edge. Bounce/letdown is the most
PUBLIC narrative in CFB -> market prices it. (Contrast: our edges exploit UNwatched things-SOS padding, season over-rate.)

## *** CORRECTION (user pushback): G5 fade-after-loss IS a real candidate (dissected) ***
Earlier dismissed citing 2021 (=only n=7, meaningless) + "overlap padded-road" WITHOUT checking. Dissection:
BASE fade G5 top-2 after loss to hi-PR opp -> opp covers 61.6% n151 +17.6roi, per-season 43(7)/69(26)/69(29)/60(25)/52(21)
= strong+well-sampled 2022-24, 2025 soft(52). 2025 softness splits CLEANLY: when NEXT opp also strong(PR>=med) ->
61.8% holds 2025 (63.6% n11); next opp weak -> 2025 fails (40%). G5-dog-next holds 2025 (60%). DISTINCT from padded-road
(works home 60% n75 AND away). ROBUST FORM = user's original framing: fade G5 top-2 after loss to hi-PR opp WHEN next
game ALSO vs strong team (two high-PR teams) ~62%, holds every well-sampled season incl 2025. Thin (robust cut n76,
2025 n11) -> wire-and-track. Mechanism: deflated top-G5 team, market still respects name, faces another strong team -> overvalued.

## G5 fade-after-loss: P5 CHECK -> G5-ONLY (P5 doesn't work). Tested P5 with SAME next-opp-strong filter:
P5 ranked lostToHiPR + next-opp-strong = 52.3% pool55 but 2025=38% (FAILS holdout) [57/53/52/61/38]; P5 won/regress
= 50.3% nothing. G5 robust = 60.7% pool62. -> edge is G5-specific (soft/thin market over-respects top-2 name team
post-loss). P5 efficient bc bounce/letdown is the most public CFB narrative. Wired spot correctly G5-only. Same theme:
edges live in G5 + unwatched signals; P5 + popular narratives are priced.

## G5 fade x SOFT-BOOK GAP stacking -> DOES NOT STACK (keep G5 fade standalone)
G5 fade base n=153 (60.8%). By soft-gap state: gap CONFIRMS fade -> 40.0% (n15, worse!); small/no gap (books agree)
-> 65.1% (n83, consistent); nogap 59.6%. No positive synergy; requiring soft-book confirmation HURTS (and shrinks n to 15).
Reason: both signals = "team overvalued" (overlap, not independent) + tiny intersection. Contrast model x soft-book STACK
which works (fundamentals view + market view = truly independent). KEEP G5 fade standalone (no soft-book filter).

## G5 fade SETTLED-LINE refinement (saved): fade works on settled lines, fails when sharp money already moving it
Among G5-fade games WITH odds (n106): settled line (|soft_gap|<0.5) -> 65.1% (n83, per-season [50/72/67/65/61]);
soft sharp-side ALREADY on fade (gap confirms) -> 40.0% (n15); soft against fade -> 62.5% (n8). Principled filter:
SKIP fading into a line already moving your way (value bid out). Wired as exclusion on G5 fade spot.
NOTE: settled-line (base+settled, 65% n83) is a DIFFERENT/larger cut than next-opp-strong (wired, 62% n56);
both refine base (60.8% n153). Combining all -> n38. Decision pending: make settled-line the PRIMARY filter (bigger n+higher hit)?

## PACE / POSSESSION ADAPTATION (pace_adaptation.py, pace_model_test.py) -> REAL football, FULLY PRICED. NEGATIVE.
Theory: ball-control team drags tempo vs fast team -> fewer possessions -> under. CONFIRMED mechanism: slow team
controls tug-of-war (regress actual game drives ~ slow_norm coef +0.95 vs fast_norm +0.66; mismatch games run
~0.5 drives below naive avg). BUT: (1) betting edge DECAYED - mismatch->under [61/54/54/46/47] per-season = market
caught up, fails 2025; (2) MODEL test: adding drives-based pace norms (slow/fast/gap/sum) does NOT improve totals
MAE (13.107->13.060 noise) or game-type ranking (corr 0.288->0.286, tercile 41.4->40.6 WORSE) - model already has
pace_off_plays + EPA. (3) possessions corr only 0.26 w/ total (efficiency dominates). (4) MARKET MAE 12.47 < model
13.1 = market out-predicts us on totals. Pace is industry-modeled -> priced. Edges live in unwatched/structural spots.

## IMPOSER vs ADAPTER at scale (adaptation_scale.py) -> ADAPTABILITY IS NOT A RELIABLE TEAM TRAIT. NEGATIVE.
Built flexibility metric = z(std run-rate)+z(std pace) per team-season (FBS-only). KEY: split-half reliability
(odd vs even games) run-flex r=0.16, pace-flex r=0.11 = MOSTLY NOISE -> cannot classify imposer/adapter from
variance, any # of games (first-K-vs-full 0.8 was illusion=overlapping sample). Coach: same-coach YoY flex corr
0.15 vs changed -0.06 (faint coach signal). CONTRAST: MEAN run-rate (IDENTITY) YoY corr 0.69 = identity IS stable.
Scaled bet adapter-vs-explosive->under FAILS (49.6%, adapter class = noise). CONCLUSION: adaptation is a per-game
RESPONSE (real, case-study confirmed for OU) not a stable TRAIT; identity persists (0.69, schedule/game-flow drive
variance). We already use identity (season-avg archetype/form) = right abstraction level. Don't build imposer/adapter
classifier. Boundary finding: can predict WHO a team is, not HOW MUCH they morph.

## *** CORRECTION (user pushback): adaptation IS real, I tested it wrong ***  (responsiveness_scale.py)
Earlier I scaled with VARIANCE (wrong - contaminated by blowouts) + concluded "doesn't work". Correct test =
directional RESPONSIVENESS (within-team deviation vs opponent trait). RESULTS:
 Q1 AGGREGATE: teams DO run more vs soft run-D: r=+0.125 p=6e-44 (REAL, +3.1pts run-rate soft vs stout). BUT
   pace-vs-explosive (the totals theory): r=+0.005 p=0.58 = does NOT generalize (OU case study was 12-game eyeball).
 Q2 PER-TEAM TRAIT: run-responsiveness split-half reliability r=0.01 = NOT classifiable per team.
RESOLUTION of "3 worked but all didn't": run/pass adaptation is real league-wide (validates user) but (a) PACE
adaptation (what drives totals) doesn't generalize, (b) can't classify individual adapters, (c) effect small + about
play-TYPE not points. Identity stable (0.69). So phenomenon real, just not in the dimension/form that yields a totals edge.

## IDENTITY x DEFENSE MATCHUP (identity_matchup.py) -> run/pass adaptation REAL but PRICED. NEGATIVE (closes adaptation thread).
Identity is stable (0.69) so reliable; tested forced-off-identity -> underperform. ALL quadrants dead:
run-heavy vs stout-run-D (fade) 49.1%, run-heavy vs soft (back) 51.0%, pass-heavy vs lockdown (fade) 50.8%,
pass-heavy vs weak-sec (back) 49.6%. Totals identity-mismatch -> under 49.6% dead. P5/G5 split: dead BOTH (49.4/48.7)
-> not a P5-efficiency thing, genuinely priced everywhere (G5 2025 61% = small-sample bounce, pool 47%).
WHY real-but-priced: adaptation = OPTIMAL play (attack weakness -> perform AT expectation not above); forced-off-identity
DOES lose efficiency but spread/total already price the obvious matchup. ADAPTATION THREAD CLOSED: real football, fully
priced (like pace/bounce-back). Map reinforced: edges = market-structure/behavioral (soft books, G5, form/SOS mean-rev),
NOT football-fundamental matchups (market prices those well).

## TEAM TOTALS contrived from total+spread (team_totals.py) -> EFFICIENT, no edge. NEGATIVE (but points to real move).
implied_team_total=(total_close - team_spread)/2. baseline OVER 49.0%. ALL features dead: fav/dog (50.2/48.1),
identity-matchup isolated on offense (49-51%, none hold), G5/P5 cuts nothing. KEY MATH: team-total-over == (game
total result)+(team ATS result)>0 = RECOMBINATION of totals+sides (both efficient) -> contrived team total is
efficient by construction. Adaptation doesn't show even isolated bc SPREAD already prices the matchup.
REAL MOVE (user instinct correct): the ACTUAL posted team-total market is softer/thinner -> would need to SCRAPE
team-total lines (Odds API team_totals market) and find where posted team total deviates from contrived/model value.
Contriving from main lines CANNOT find it (efficient algebra). Fits 'edges live in soft markets' thesis.

## TEAM-TOTAL MODEL (team_total_model.py) -> REAL UNDER EDGE (user was right; few-feature test was wrong)
Built proper team-points model: self-offense + opp-defense fundamentals + adaptation (id_run, id_pace) + market
anchor (open lines), walk-forward, target=team points. Overall MAE 9.13 vs market implied 8.75 (market sharper
on avg) BUT the UNDER side is a real edge: MARKET-ANCHORED edge(pred-implied)<=-3 -> team-total UNDER 54.5% n1179
[57/51/57/53/59] roi+4.1; edge<=-4 -> 56.3% n746 [58/53/58/58/59] roi+7.5. Every season >50, 2025 strong (59%).
CONFOUND SURVIVED (vs implied-team-total band baseline): low +3.8, MID +6.7, high +1.9 -> NOT just fade-high-total,
real team-specific signal (strongest mid-band 24-30). Over side dead (one-directional under bias). Graded vs CONTRIVED
(efficient) team total -> on ACTUAL (softer) team-total market should be better. LESSON: build the model before
declaring dead; few hand-picked features != a test. TODO: isolate adaptation's marginal contribution; wire spot;
consider scraping actual team-total lines.

## OVERS — proper investigation (user pushed on under-only concern). OVERS ARE FINDABLE (weaker than unders).
Sanity: grading symmetric (over% by season 46.5-52, baseline 49, mean line-miss +0.37 ~ balanced; 2023-24 were
OVER-leaning). EXTREME overs (>=+14, 20.0%) vs extreme unders (<=-14, 19.6%) = SYMMETRIC freq but STATISTICALLY
IDENTICAL on all pre-game features (pace/expl/def/wx/ppo) -> extreme scoring = VARIANCE, unpredictable. (elo_diff
'even matchup' lead was signed-mean artifact; pickem-by-spread over 48.9% = dead.)
KEY: overs found via UNANCHORED (pure-fundamentals) model, NOT market-anchored. pure-fund edge(pred-implied)>=+6
-> team-total OVER 53.6% n591 [52/54/56/49/57] 2025 57% +2.4roi; survives confound (+2.0/+2.5 low/mid band).
RESOLUTION: under edge (anchored model, 56%) > over edge (unanchored, 54%) - asymmetry REAL (books shade totals UP,
public over-bias -> too-high mispricing bigger). NOT a bug. Two sides need DIFFERENT models: ANCHORED for unders
(catch over-shading), UNANCHORED for overs (catch lines set too low). Both holdout-validated.

## TEAM-TOTAL PRODUCTION RULE (over vs under model assignment) -- the two triggers are MUTUALLY EXCLUSIVE
Q: run both over+under models and pick better number? -> NO NEED. Tested both on 7393 team-games:
  UNDER trigger (ANCHORED model edge<=-3): fires 1179, 54.5% (2025 59%)
  OVER  trigger (UNANCHORED fund model edge>=+6): fires 591, 53.6% (2025 57%)
  BOTH fire (conflict): 0 games. neither: 5623.
ZERO conflicts (mechanical: anchored-under needs fund BELOW line, unanchored-over needs fund FAR ABOVE line;
shared inputs -> can't be both). PRODUCTION RULE: run both models; anchored edge<=-3 -> UNDER; unanchored edge>=+6
-> OVER; else no bet. At most one fires -> NO per-game cherry-picking/selection bias. ~24% of team-games bet
(~354/yr, 2/3 under 1/3 over) @ ~54%. Two specialized detectors for opposite line errors (over-shaded->under, under-set->over).

## EXTREME OVERS - game totals (extreme_over.py) -> FOUND (user pushed again; earlier univariate test missed it)
Single features don't separate extreme overs (confirmed earlier) but UNANCHORED model + conjunctive archetype recipe DO:
 1. UNANCHORED game-total model over edge>=+6 -> OVER 54.9% n741 (~148/yr) [53/56/54/56/58] 2025 58% +4.9roi;
    survives confound (+1.7/+6.0/+5.2 by total band). edge>=+8 54.2%, edge>=+12 54.6% n130 (rarer tail).
 2. SHOOTOUT RECIPE (the rare ~10/yr trigger): 2 explosive offenses + BOTH up-tempo -> OVER 56.5% n46 (~9/yr)
    [50/60/50/62/60] +7.9roi (recent strong 60/62/60; 2021/23 were 50). 2expl+>=1weak-sec 54.4% n136.
    env COMPOSITE alone DEAD (~50%) - needs specific 2expl+2uptempo stack.
KEY: overs need UNANCHORED model (anchored pinned to shaded line, can't see overs) + conjunctive stack (no single
feature works). Parallels team-total over finding. 3rd time pushing found over signal i'd dismissed.

## *** CORRECTION: shootout RECIPE (2expl+2uptempo) is NOISE; only the MODEL over-edge is real ***
Recency check on 2016-2025 (2x sample, components from model_games): recipe over% by yr 33/58/50/23/46/44/48/54/33,
ALL=45.4% (94/207) = UNDER, dead. 2025 flips 60%(archetype-tag n46) vs 33%(component n24) on cosmetic definition
change = noise signature. Game-evolution premise BACKWARDS: CFB avg total FELL 58.2(2016)->52.4(2025), scoring DOWN
not up, market tracks it. Recent "good" years (2024/25) were ~1-game swings on n~9. RECIPE RETRACTED.
ROBUST over edge STANDS: UNANCHORED model edge>=+6 -> over 54.9% n741 [53/56/54/56/58] confound-survived. Use MODEL not recipe.
NOTE: discipline cuts both ways - earlier today proper tests found MORE (rescued G5/teamtotal/over); here finds LESS (recipe=noise).

## RECURRING-MATCHUP / SERIES HISTORY (matchup_history.py) -> DEAD (watched narrative, priced). NEGATIVE.
Linked prior meeting (within 2yr) per game, 2016-2025. Revenge ATS (lost last->cover): 50.5% priced. SPECIFIC
(blown out 21+ by ranked-away -> avenge): 33.3% n33 = OPPOSITE (blown-out teams KEEP losing; too thin anyway).
Keep-losing SU 46.8% (priced in spread). Coach: same(50.8)≈changed(49.7)=no series trend. TOTALS style persistence:
prior-high->over 49.5%, prior-low->under 50.7% = NO persistence (rosters/coordinators turn over, market prices
current teams). Rivalry over/under 49/51 nothing. Flickers: winner-regress-ATS (fade won-last ~52% but FAILS 2025
holdout 48); prior-total>>line->under 53.6% = just fade-high-total confound. VERDICT: series memory priced or absent.
Confirms: watched narratives (revenge/avenge) priced; edges live in unwatched mechanical corners.

## RANKED-vs-RANKED -> BET HOME ATS (matchup_history/rank exploration) -> REAL EDGE
User spot (ranked AWAY vs unranked HOME, home favored) = DEAD (49% n98, coin flip, priced). BUT pivot found:
BOTH AP-RANKED -> HOME covers 57.3% n398 +9.4roi, per-season 2021-25 [55/56/64/56/53] every season, 8/9 yrs
(only 2019=47). CONFOUND-CLEAN: general home cover 49.7% (home fav 49.1) -> both-ranked home +7.6pt specific lift,
NOT generic HFA. Home FAV 60.0% (n245) > home DOG 52.6% (n152); independent of which team ranked higher (56.6/57.9).
MECHANISM: HFA underpriced in marquee games (public backs ranked road 'name' team; crowd impact underweighted in
big games). ~44/yr. Exception to 'watched=priced' (structural HFA mispricing not narrative). WIRE: both ranked -> HOME, Tier 2.

## TEAM / COACH ATS RECORDS (by side, threshold, home/away) -> NOISE, NO EDGE. DEFINITIVE NEGATIVE.
Screened every D1 team + coach: ATS as dog/fav, overall + by spread tier (+0-3/3-7/7-10/10-14/14+, fav mirror).
"Best/worst" lists exist (Marshall 71% dog, Duke 86% small-dog, Temple 87% +3-7, etc.) BUT they are PURE SAMPLING
NOISE, proven 3 ways:
 1. PERSISTENCE: team ATS first-half vs second-half corr = -0.073 (n=130 teams) = ZERO. A good-ATS team does NOT
    stay one. No skill.
 2. SPREAD-vs-CHANCE: std of team ATS records = 4.8%, std expected if EVERY team were a 50% coin flip (n~98) = 5.0%.
    IDENTICAL -> the entire Marshall(71)->UTEP(35) range is exactly what random produces.
 3. WITHIN-TEAM TIER CONTRADICTIONS: Duke 86% as +0-3 dog but 17% as +14+ dog; Temple 87% +3-7 but 29% +14+; Mike
    Norvell 31% small-fav but 67% big-fav. A real skill can't flip 86%<->17% across adjacent tiers -> noise fingerprint.
Tier cells are n=12-24 (had to drop min-n to populate) = far too small. VERDICT: per-team/per-coach ATS at any
threshold has ZERO predictive value; market prices teams/coaches efficiently. This is the deepest bettor rabbit hole.
DON'T build team/coach-history ATS systems. (Same answer as the Mississippi State single-team check.) Edges live in
STRUCTURAL/MARKET signals (soft-book gaps, mean-reversion, marquee-HFA, padded-SOS), never "who covers as a dog."

## COLLEGE GAMEDAY analysis (gameday_raw.txt, gameday_analysis.py, gameday_movement.py)
GameDay games (ESPN editorial pick) sourced from Wikipedia -> data/gameday/gameday_raw.txt (123 reg-season FBS,
93% matched to model_games). GameDay = peak public attention = purest public-bias filter.
ATS/totals (full 2016-25, n~110): HOME cover 53.5% (mostly the ranked-vs-ranked HFA effect, GameDay=marquee both-ranked);
totals lean UNDER 53.6%; night/day no diff; both-ranked vs one no diff. Streaks=trivia (away went 4-in-a-row 3x).
spread-vs-PR within GameDay: efficient (PR side ~46-50%; only |resid|>=6 hints 56% n32). First-GameDay-of-season: n=9, too small.
*** LINE MOVEMENT (2021-25, n~55-94) - PROMISING, mechanism-backed: ***
  FADE the spread move: 55.9% (n68); line-moved-toward-away -> away covers only 38.9% (fade hard).
  TOTALS heavy UNDER: over 34.5% (UNDER 65.5%, n55); total-moved-UP -> over only 30.8% (public over-bias, fade to under).
MECHANISM: GameDay public hammers marquee fav + over -> line/total inflate -> FADE move, bet UNDER. Stronger than
broad findings bc GameDay concentrates public bias. CAVEAT: small n (movement only 2021-25), ~13 games/yr -> TRACK LIVE,
sample grows slowly. Real lead, not noise (clean mechanism + directionally strong). RvR home edge is the bigger-sample cousin.

## RIVALRY BIG-DOG (+14 to +21) trends (rivalry_bigdog.py) -- strong findings, small n
Rivalry games (RIVALRIES list) where underdog gets +14 to +21, regular season. n=95 ATS / 96 totals (~11/yr).
ATS (dog cover) flips HARD by dog location:
  AWAY dog -> BACK it: 63.5% (40-23, n63) +21roi; per-season mostly + (strong 2022-24: 18-3), down 2016/2021/2025.
  HOME dog -> FADE it (lay road favorite): dog covers only 31.2% (10-22, n32) -40roi; MOST CONSISTENT - dog failed
    to cover 7 of 9 seasons (per-season 2-1/0-3/1-3/1-5/1-3/1-2/2-1/1-3/1-1).
  ALL dogs 52.6% (coin flip - the split cancels).
TOTALS: UNDER 60.4% (38-58, n96) +15roi; under 7/9 seasons (huge 2017 2-11, 2019 4-10, 2021 2-7) but 2023-25
  flattened (mild recency cooloff). Mechanism: rivalry mismatch -> favorite grinds w/ lead, overmatched dog can't score.
SAVE/TRACK: home-dog-fade most consistent; away-dog-back + under real but streakier. Small n (~11/yr) -> track live.

## EVENT-ODDS ARCHIVE: TEAM TOTALS + 1H MARKETS (fetch_event_odds.py) — 2023-2025 pulled (~270k credits)
Historical EVENT endpoint (10cr x 4mkts x 1region per event-snapshot; additional-markets history starts May 2023).
Markets: team_totals (incl laddered alts), spreads_h1, totals_h1, h2h_h1. Snapshots: T-72h/T-24h/T-2h.
data/event_odds/events_<yr>.parquet (~417k rows, 97-98% pull success). PROBE findings (2024 wk6-7): coverage 100%
all markets incl G5; TT books = DK/FD/BetRivers/BetOnline/BOVADA; TT main lines |dev vs contrived| 0.68 avg but
32% >=1pt off + cross-book range 1.18 avg (30% >=2pts = soft-book raw material); 1H spreads 42% >=1pt off
half-spread (not formulaic); 1H totals level formulaic (50.7%+-1.7) but books disagree >=1pt in 70%.
PARSING NOTES: outcome name/description use FULL Odds-API team names (map via to_db); team_totals includes
ALTERNATE lines -> main line = point w/ price closest to -110 per (game,team,book).
NEXT: grade team-total model vs POSTED lines; TT soft-book gap; build 1H model (targets free via line scores).

## DERIVATIVES TEST BATTERY (test_derivatives.py) — full sweep of TT/1H markets
A. TT SOFT-BOOK FADE: every book's deviant main TT (>=1 off others) loses faded at its own line: betonline 54.5%
(n903 [56/53/55]), WH 55.4, MGM 55.7, Bovada 53.9, DK 53.4; FanDuel 51.1 (again not fadeable). UNIVERSAL ~53-55%
= mostly the better-number effect -> already harvested by TT line-shop grading; do NOT wire as separate spot.
B. 1H MODELS (targets=Q1+Q2 line scores, walk-forward): 1H totals @consensus 52-53% weak; LINE-SHOP 54.3% under
/ 54.8% over (+3.6/+4.5 roi). 1H spreads 52-52.8% = WEAK (below breakeven, not a product).
C. 1H STRUCTURAL: blanket 1H under 49.7% = books do NOT over-shade 1H. BUT fade-extreme extends: 1H total>=31
-> UNDER 55.7% (n246, [53/59/56] consistent) = REAL, mirrors full-game fade-high.
D. TT MOVEMENT (72h->close): follow dead (48-51%) — totals movement dead in every market, again.
NEW PRODUCT VERDICT: TT model + line-shop (58.4U/55.7O) = the flagship; 1H high-total fade (55.7%) + 1H total
model shop (~54.5) = secondary; 1H spreads & TT movement & TT soft-book-as-spot = negatives.

## DERIVATIVES ROUND 2 (test_deriv2.py): movement windows + P5/G5 + matchup conditions
1. MOVEMENT: TT + 1H totals, all windows (72->24, 24->2, full), follow AND fade = 48-52% DEAD. Totals-style
   movement now dead in EVERY market ever tested (game/TT/1H). Final negative.
2. *** P5/G5 SPLIT — INVERSE of spreads: TT/1H edges are P5-CONCENTRATED ***
   TT UNDER shop: P5 59.9% (n379 +14.3) vs G5 56.6% | TT OVER shop: P5 62.0% (n192 +18.3 [58/60/73]) vs G5 51.3% DEAD
   1H total>=31 UNDER: both-P5 63.4% (n82 +21.1) vs both-G5 49.0% DEAD.
   MECHANISM: spread edges = market softness (G5 thin); TT/1H edges = MODEL-vs-derivative-market, which needs
   model precision -> P5 (richer data, less garbage-time noise). Two edge families, opposite habitats.
3. MATCHUP CONDITIONS: TT OVER + team over-COLD form (over_rate<=.4) -> 61.2% (n165 +16.9) = form mean-reversion
   stacks with TT over. TT UNDER conditions add nothing beyond base.
REFINED PRODUCT: TT OVER -> P5 ONLY (62%); TT UNDER -> both, P5 preferred (60/57); 1H>=31 under -> P5 ONLY (63%);
TT over x over-cold form = high-conviction stack (61%).

## ML CONVERSION OF VALIDATED SPOTS (user pushback #5 — correct again). ML market unbeatable head-on (derived
price) BUT validated spot edges convert: **RvR HOME-DOG ML: 42% outright, avg +235, ROI +15.4%, 4/5 seasons +
[19/47/13/12/-19] n92** — spot mechanism (HFA underpriced -> dog WINS) implies outright edge -> ML pays > ATS.
KEY small-dog ML +1.9% (cover-mechanism, doesn't convert). RULE: convert spot->ML only when mechanism = outright
wins. TODO: full conversion sweep (mammoth dogs, padded-road, G5-fade dog-side, rivalry away-dog [n=0 merge bug
to fix]); 1H conversions once 2026 hourly data. 'Dead' verdicts on ML/1H markets = dead AS STANDALONE PRICING
markets; alive as EXPRESSION layers for spot edges.

## 1H MODEL v3 — PRUNED (h1_prune.py; user pushback #6 correct: prune, don't kitchen-sink)
Permutation importance on h1_total -> top-15: poss_secs_pg #1, pass_yds_pg, points_pg, sum_off_epa, expected_plays,
wx_wind = 1H totals are a TEMPO problem (no garbage time/script in 1H). TOP-15 PRUNED beats v1(185f) and v2(+feats):
UNDER @best-shop 55.8% n464 +6.6roi [55/54/58]; OVER @best+2 54.8% n975 +4.6 [56/51/58]. v2 retracted (profiles=noise).
1H product now: pruned-15 model both sides ~55-56% shopped + structural >=31 both-P5 under 63%. LESSON LOGGED:
for noisy/short-horizon targets, PRUNE to mechanism features; kitchen-sink dilutes.

## 1H SPREAD SOLVED — NOSTR model (h1_grid.py/h1_confirm.py; user pushback #7 correct: wrong metrics, not dead market)
Grid: P15 53.4 declining / NETS 49.8 / ANCH 50.9 / recal no-help. WINNER = NOSTR: REMOVE all strength features
(elo/talent/net_rating) + nets -> model forced onto tempo/style/situational = the info the half-spread formula
discards. PRE-REGISTERED CONFIRM PASSED (5-seed): gate2 53.5 [54/52/54], gate3 53.7 [54/53/54], gate4 52.9,
2025@g3=54.0%. Flat per-season, all gates >52.4. MECHANISM: 1H line = strength (priced) -> alpha = non-strength.
Mirrors totals (tempo) finding. 1H ledger: totals 55.8U/54.8O + >=31-P5 under 63% + spread 53.7 NOSTR. TODO: wire
NOSTR 1H spread; retry 1H ML dog-conversion w/ calibrated NOSTR margin. Recal tested (isotonic): no lift (MLB-style
recalibration addressed; flat zones are sample noise not miscalibration here).

## 1H ML SOLVED — dog-conversion off NOSTR margin (h1_ml_conv.py). LAST FRONTIER CLOSED.
NOSTR predicts ML-dog WINS half outright by >=gate -> bet dog ML @ best posted. MONOTONIC dose-response:
gate .5/1/2 -> win 46.4/47.6/49.7% @ avg +160-175 -> ROI consensus +12/+14/+19.6%, BEST +16/+18.2/+24.4%
(n=143 @gate2, ~48/yr). Breakeven @+175=36.4% vs 49.7% won = real, not dog-variance. Per-season [2023 flat
0/+4 | 2024 +32/36 | 2025 +30/36]. Wired: h1_ml_bet col (pm>=2, dog<=+1200, best price). TRACK-LIVE caveat:
n modest, 2023 flat — bet small yr1. ALL 7 BET TYPES NOW POSITIVE (full-game ML via spot-conversion RvR +15.4%).
