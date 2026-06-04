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
