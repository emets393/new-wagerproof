# Fantasy Points Data — Research Program (owner mandate 2026-09-16)

Charted alignment/coverage/separation/trench data 2021+ (`data/fpdata/`). The most
granular dataset we hold; the mandate is edges EVERYWHERE — props AND sides. Every
study follows house law: grade vs the line the construct uses, entering-game features
only, placebo + mirror cells, per-season splits, pre-registration over blind sweeps.

## Layer 1 — Player conditional splits (content + prop volume)
Per-player profiles conditioned on opponent scheme: dropbacks/targets/production vs
man-heavy / zone-heavy / two-high-heavy / blitz-heavy opponents; alignment mix and
per-alignment production. Feeds `fp_matchup_card.py` (per-game breakdown cards for
video/Discord) and volume priors for prop models. STATUS: proof-of-concept ran
(Darnold two-high dropback drop; JSN 78% wide + elite separation).

## Layer 2 — Archetype models (players grouped by TYPE, not name)
Small-n player splits pooled into archetypes:
- Receiver types: separation tier × alignment identity × depth profile → performance
  vs defense scheme tiers. FIRST RESULT: elite-separator × man-heavy D → rec-yds
  over 55.7% (z=+2.1). Next: slot-separator vs slot-man; contested-catch types vs
  zone; speed/depth types vs single-high.
- QB types: pressure-resilient vs pressure-fragile (pressured stats) × opposing
  pressure-over-expected; processing types vs disguise-heavy (two-high-shifting) Ds.
- RB types: contact-balance (YAC/MTF) vs box-count tiers; receiving backs vs
  man (RB-vs-LB iso) — the classic man-beater.

## Layer 3 — Position-group edge aggregation → sides/totals
Per game, score each position-group matchup (QB vs coverage type, WR corps vs
scheme, OL vs DL pressure-over-expected, RB room vs box/run-scheme) → count/sum of
group edges as a game-level feature → test vs ATS and totals residuals. This is the
"how many position groups do we win" framing.

## Layer 4 — Team/coach/QB scheme-conditional efficiency (sides/totals core)
Own EPA (nflverse) per game conditioned on opponent scheme type: which offenses
over/under-perform their baseline vs man/zone/two-high/blitz; which defenses
struggle vs specific offense styles (alignment-spread vs condensed, PA-heavy,
motion-heavy). Coach-level: does the split follow the COACH across rosters?
Then: when a team's conditional strength meets a matching defense → ATS/total test.

## Layer 5 — The combined model
All layers as features in one regularized walk-forward model per market (rec yds,
receptions, pass yds, rush yds; then spread/total points models), market line
included as feature (predict-the-raw-quantity law). NO blind combinatorial sweeps.

## Data still landing / queued pulls
- gen-4: separation × alignment splits + receiving × coverage (11 files remaining)
- gen-5 wave: passing-advanced × coverage (QB vs defense type), rushing × box,
  alignment × coverage CROSS (slot-in-cover-2), shell-level dim (Cover 2/3/Quarters)
- Weekly refresh: same recipe, ~10 min after MNF (see memory: fantasypoints-data-suite)

## Kill list (tested, dead — do not resurrect)
- Raw "yards allowed to alignment X" funnels: split-half r=−0.48. Opp-adjusted +0.14
  (feature-only). FP-allowed-by-alignment tables are industry junk.

## Sides ledger (2026-09-17)
- Gap-model v1 (composite gaps + line, ridge walk-forward): does NOT beat close.
  No dose-response (52.9/51.8/48.8% at 1/2/3-pt edges); gap coefs wrong-signed
  after market conditioning. Unit quality is PRICED. exp_fp_gap_model.py.
- Repricing-lag (unit change vs last season, wk4-8 window): NULL. Dose fails
  (top decile 50.0%), decay pattern backwards, seasons incoherent.
  exp_fp_repricing_lag.py.
- Scheme-conditional EPA -> ATS: null first pass. exp_fp_scheme_sides.py.
CONCLUSION: sides edges from this data require timing/interaction constructs not
yet found — do NOT re-run level-based versions. Effort priority = PROPS (validated
domain: separator×man 55.7%) via the composite+alignment+coverage feature matrix.

## COMPOSITE-V2 TOTALS MODEL — FROZEN SPEC (2026-09-17)
exp_fp_composite_v2.py | 16 reliability-gated engineered composites -> 8 off-vs-def
DIFFERENTIALS + scheme + core EPA + market (36 feats) | ridge λ=50 (dose held at
10/50/200 — not a λ cherry-pick) | walk-forward 2023-25, wk4+:
totals 54.0% @2+ (261) / 58.2% @3+ (134) / 61.7% @4+ (60), monotone dose.
INDEPENDENCE CONFIRMED: 4/135 picks overlap consensus_totals; non-overlap 76-54 (58.5%).
Caveats: 2025 thr3 ran 7-10 (small n); grade-vs-T60 confirm pending.
STATUS: TRACKING — paper-trade 2026 weekly (score after each FP data refresh);
go-live decision after ~25 live picks. Spread pulse (54.4% @2, n~200) tracking-only.

## ★★ COMPOSITE-V3 — SPREADS CRACKED (2026-09-17)
exp_fp_composite_v3.py adds 4 DISSECTION FITS (opponent-mix-weighted expectations):
  fit_scheme_pass (QB efficiency per shell × opp shell diet) — LARGEST coef -1.07
  fit_run_concept (own man/zone rush success vs this front's concept success allowed) +0.37
  fit_sack_timing (QB hold time - D time-to-sack); fit_explosive
SPREADS vs close: 56.1%@1 / 60.6%@2 / 66.0%@3 / 68.8%@4, z up to +3.9, per-season
64/51/70 (no losing yr). FIRST spread edge in 6 constructs — dissection fits are why.
TOTALS held: 54.6%@2 / 56.3%@3. Calibration clean (2-4pt-better bucket → +2.9 realized).
STATUS: TRACKING — freeze v3 spec, T-60 grade confirm, paper 2026 both markets.
2024 soft (51%@2) = variance watch.

## ★★★ COMPOSITE-V4 — EARLY-SEASON SOLVED (2026-09-17)
exp_fp_v4_earlyseason.py. Problem: v3 fits reset each Sept -> weak wk1-6 (50%).
FIX (owner's Rodgers idea, at the FIT layer): seed entering-game values with
prior-season, shrink out as current games accrue:
  - fit_scheme_pass: team per-shell pass efficiency + opp shell diet BOTH prior-
    seeded (QB's 2024 vs-Cover-2 -> 2025 wk1). Shells coach/QB-driven, persist.
  - composites: SELECTIVE carry — only the 7 with YoY r>=0.35 (qb_hold, runblock,
    recv_playmaking, rz_usage, passrush, scheme_man, scheme_twohigh). Rest reset.
    (Naive carry-ALL failed — market prices team priors; carry only persistent+granular.)
SPREAD thr>=2 by week: wk1-3 61% / wk4-6 59% / wk7-11 59% / wk12-18 74% / ALL 66% (n=246).
Per-season wk1-6: 52/62/67 (no losing yr). Per-season ALL: 65/60/78. Volume ~2x v3.
This is the PRODUCTION spec. Freeze; T-60 grade confirm + 2026 paper both markets.
KEY LESSON: carry player/scheme traits into FITS (not team composites) for early season.

## v5 SITUATIONAL LAYER (2026-09-17) — owner idea, confirmed for totals
exp_fp_v5_situational.py: added referee scoring tendency (walk-forward prior-season
pts-over-expected, shrunk <20 games), rest/bye/short-week, primetime, weather, div.
ABLATION verdict: TARGETED helps, kitchen-sink HURTS (dilution).
  v4 baseline: SP3 71.2%, TOT3 58.2%
  +referee only: TOT3 60.0% | +rest/primetime only: TOT3 62.1% | +ALL: TOT3 54.5% (worse)
  BEST = v4 + referee + rest/bye/short-week/primetime: SP3 72.1%, TOT2 57.0%, TOT3 59.5%.
Situational helps TOTALS (scoring-environment context) more than spreads; weather/dome
add nothing (already in line). Per-season TOT thr3: 70/52/53. Fold targeted block into
production spec. Do NOT add weather or the full situational dump.

## SIGNAL x MODEL CONFLUENCE (2026-09-17) — the two systems reinforce
exp_fp_signal_confluence.py: joined 1261 graded NFL signal picks (forecast_ledger
23-25) to the composite model's side.
  ALL signals baseline: 56.4% +0.076u
  SPREADS: model-align 60.8% (+0.161u, n194) | neutral 56.8% | OPPOSE 44.0% (-0.161u!)
  TOTALS:  model-align 67.6% (+0.291u, n102) | oppose 59.0% | neutral 55.2%
Monotone align>neutral>oppose on BOTH markets. The composite model is a FILTER:
press signals it confirms, FADE/SKIP spread signals it opposes (44% = losing).
Best aligned cells: primetime_tight_under 77%, tight_soft_ml_fade_home 80%,
primetime_tight_favorite 75%, sides_model 58.6%. Caveat: 23-25 = build era (shared
info); confirm 2026 live. ACTION: add model-confluence tag to NFL flag surfacing.

## INJURY / AVAILABILITY FILTER (2026-09-17) — owner catch, quantified + built
Team composites blend whoever played → injury/roster contamination. QUANTIFIED:
19.4% of team-games (2023-25) had a NON-primary QB start; model spreads @2pt =
69.2% CLEAN (both primary QB, n130) vs 64.8% backup (n71). ~4.5pt degradation.
BUILT: availability flag from nfl_injuries_raw (live, 2026 wk2 present) + wk1-pbp
QB-starter baseline. Flag = QB out/change OR key skill/OL out → reduce confidence
or skip. ⚠ FILTER BUG FIXED (owner catch): a QB-out only flags if the OUT player is the
team STARTER (most-recent-wk primary passer). CLE (Gabriel) + SEA (Darnold) were
BACKUPS -> false positives, removed. Corrected wk2 flags: NO QB changes; key-skill
outs = ARI Conner/GB Jacobs/DET Pacheco/MIN Mason (RB), HOU Dell/NE A.J.Brown (WR).
3 total plays: CAR@ATL CLEAN, LV@LAC CLEAN, NO@BAL minor(RB). SEA@ARI = ARI RB flag only.
NEXT (the real fix): player-availability-WEIGHTED composites — build each team's
expected performance from PROJECTED-ACTIVE players' individual profiles (slot%,
sep, alignment already in warehouse), so a missing WR1/backup QB changes the number.


## STARTER-IDENTITY NUANCE (2026-09-17, owner catch #2)
QB starter = FIRST PASSER of the game, NOT most-attempts (starter can get hurt
early & backup out-throws him — e.g. Darnold started SEA wk1, hurt Q1, Lock threw
23-3). Attempt-count logic misclassifies every start-then-hurt game.
Rebuilt flags (_qb_situation_flags.parquet): starter_hurt_early (starter!=majority)
OR starter_change (game starter != prior game's starter). 12.8% of games.
Re-quantified w/ correct logic: CLEAN 69.0%/77.0% @2/3pt vs QB-situation 62.8%/71.4%
— consistent ~6pt gap both thresholds (earlier anomaly was the bad definition).
LIVE wk2 corrected: SEA@ARI IS flagged (Darnold=true starter, out -> Lock starts)
+ ARI RB; CLE clean (Watson starts, backup Gabriel out). Live starter = first
passer of most recent game, cross-checked vs injury report.

## PLAYER-ANCHORED QB — TESTED, DOES NOT WORK (2026-09-17)
exp_fp_player_v6.py. Replaced team passing composite with STARTING QB's own
profile (player_id keyed, carried across teams, first-passer starter). Result:
FULL model 70.1% ALL / 69.2% QB-situation → +QB anchor 65.8% / 55.2%. HURTS,
worst in QB-situation games. Why: (1) QB quality already priced by line + team
composites; (2) backups (the contamination cases) have no stable profile → anchor
= noise exactly where needed. VERDICT: the FILTER wins, not anchoring. For injury/
roster: identify + downgrade/skip QB-situation & key-injury games (clean 69% vs
contaminated 63%); do NOT try to re-predict them from thin backup data. Skill-
position availability-weighting untested but same mechanism (market prices stars)
makes it unlikely to beat the filter — test skeptically if at all.
PRODUCTION: FP-only full model + injury/availability FILTER (skip flagged games).

## PLAYER PROPS (2026-09-17) — receiving hard, RUSHING works via opportunity×matchup
exp_prop_receiving.py + exp_prop_cells.py + rushing cells.
- Global regression (predict stat w/ line as feature): reproduces line, 48-51%. DEAD.
- RECEIVING cells (lined rows only; 2023 close_line was NaN → must drop/rebuild):
  mostly ~50% (efficient market). separator×man modest 53.9% rec-yds (z1.3). Slot/
  first-read/TPRR/two-high cells all noise. Books price receiving granularity well.
- RUSHING (RB rush_yds) — owner's opportunity×matchup thesis CONFIRMED:
  ★ favorite RB (spread<=-3) vs SOFT run front (bot-third stuff) → OVER 55.9% (n195, z1.65)
  ★ underdog RB (spread>=+4) → UNDER 55.3% (z-2.15); baseline RB under ~52%.
  Volume(game script) × OL-DL matchup is the working combination.
CANDIDATES (paper 2026): rush favorite×soft-front OVER, underdog UNDER, sep×man rec.
NEXT: firm rushing combo (add dropback/pace volume proj), apply to upcoming slate.

## ★ DISTILLED PROP MODEL — 3-SEASON VERDICT (2026-09-17, REVISED with 2023 lines)
exp_prop_distilled.py / exp_prop_qb.py: per-player engineered composites (route/target
share, TPRR, YPRR, slot/wide/backfield%, aDOT, first-read, design%, separation, sep-wins;
QB: cpoe/acc/adot/deep/hero/sack/poe/ttt/firstread/checkdown/scramble) + player×defense
MATCHUP interactions + opportunity + line, ridge λ40, walk-forward, over/under vs close.

★★★ CRITICAL FIX: rebuilt 2023 close lines from props_rows snapshot warehouse
(data/fpdata/_close_2023.parquet, 19.5k lines, last pre-kickoff snapshot, median across
books). BEFORE this, the 2024 test fold trained on ZERO lined rows (panel close_line was
2024+ only), crippling the line-anchored model. Adding one real lined training season
FLIPPED the verdicts below — several earlier "edges" were small-sample noise.

WINNER (both clean test seasons agree, real selectivity, monotone dose-response):
  ★★★ WR/TE RECEPTIONS: 54.5/56.6/58.7% @4/8/12% edge, z+5.9, ~36% of board at 12%.
       Per-season 2024:58.2% / 2025:59.2% — STABLE. THE prop edge. (Earlier "2024 soft
       50.6%" was the un-lined-training artifact, now corrected.)

MARGINAL / WATCH (positive but weak or unselective):
  ~ QB pass_yds: 55-56% @8-12%, z+1.7, and the threshold DOES select (37%→21% of board);
    both seasons 55/56% at 8%. Genuine but modest — the one QB market with real selectivity.
  ~ QB pass_tds: 55-58% but threshold catches 70-89% of board (median line 1.5 → %-of-line
    thresholds don't select) = whole-board OVER lean, not a sharp filter; 2025 only 54%.

DOWNGRADED after 3rd season (were noise at ~1.5 seasons):
  ✗ RB receptions: 52.5-53.2% (was 56%) — modest, no longer a headline edge.
  ✗ QB rush_yds: flat ~52%, 2024:50%/2025:54% unstable (was 55-56% z+2.2) = small-sample.

DEAD / efficient (confirmed across 3 seasons):
  ✗ reception YARDS ~50% (z+0.1), pass_completions ~51%, pass_attempts 44-49% (negative
    at threshold), rush_attempts thin/~52%.

LESSON reaffirmed: market prices efficiency/marquee markets tight; the beatable edge is
opportunity/volume (WR/TE receptions) found only by the regularized composite, not cells.
%-of-median edge thresholds are meaningless for low-integer markets (pass_tds, rush att) —
they select nothing; use absolute thresholds or report bet-fraction there.

## ★★★ UNIFIED PROP ENGINE (prop_engine.py, 2026-09-17) — SUPERSEDES ALL ABOVE
Owner called it: the prop scripts above touched **3 of 79 FP tables**. This engine builds a
real feature library from the whole warehouse and fits per-market:
  PLAYER: rushing-advanced (YBC/YAC/MTF/success/stuff/explosive/zone-vs-man concept YPA/
  inside-5 share), rushing-bell-cow (market shares: rush att / snaps / routes / targets /
  xFP + team volume), receiving-advanced (role+alignment+read), separation, passing-advanced.
  OPPONENT: run defense (YPA/YBC/YAC/stuff/success/explosive/MTF/concept splits allowed),
  coverage diet, pass defense, receiving allowed.  TRENCH: lineMatchups OL-vs-DL pressure +
  pressure-over-expected + YBC.  GAME SCRIPT: PROE (dropbacks vs expected), pass/rush snap
  split, pace/volume, opponent volume allowed. + 18 engineered trait x matchup interactions.
  All entering-game with PRIOR-SEASON SEED blend (v4 lesson). 34-85 feats/market.

VERDICT (2024 AND 2025 both clean test seasons; frozen in prop_engine.SPECS):
  ★★★ QB PASS TDs   lam200 thr0.35: 61.0% n=351 (39% of board) 2024:61.0/2025:61.0 z+4.11
       Two-sided (OVER 59.8 / UNDER 61.2 — NOT a base-rate lean; board base over = 51.4%),
       beats 100% of 200 shuffled placebos, and STRENGTHENS as lambda rises (61.6% @lam600)
       => carried by a few robust features. THE find. Previously called "efficient".
  ★★  QB PASS YDS   lam60 thr20: 56.8% n=400 (45%) 2024:56.9/2025:56.6, two-sided, 100% placebo.
  ★★  WR/TE RECEPTIONS lam200 thr0.7 NARROW: 56.7% n=365 2024:54.9/2025:59.1 (thr0.4 = 55.3%
       on 36% of board) — the durable one across every spec tried.
  ★   WR/TE RECEPTION YDS lam200 thr12 NARROW: 56.8% n=310 2024:55.7/2025:60.9. Was declared
       DEAD twice under the wide feature set — narrow+heavy-lambda revives it.
  ★   RB RECEPTIONS lam600 thr0.7: 56.8% n=206 2024:54.1/2025:60.0 (thr1.0 = 61.0% but n=82).
  ★   RB RUSH ATTEMPTS lam200 thr1.8 NARROW: 56.7% n=277 2024:58.3/2025:54.8, two-sided, 97%
       placebo — but NON-MONOTONE dose and collapses to 51.6% at lam600 => lambda-fragile, size down.
  ⚠ UNSTABLE (pooled looks good, per-season fails — do NOT ship): QB completions (2024:51.5
       vs 2025:65.0), QB pass attempts (2024:52.5 vs 2025:58.0, negative at high thr). Both
       show the SAME 2024-bad/2025-good shape; plausible mechanism is the 2024 fold having
       only one lined training season. Needs 2026 forward test, not a ship decision.
  ✗ DEAD at every lambda/threshold: RB rush yds (50-52%), QB rush yds (50-51%).

METHOD LESSONS (expensive, don't relearn):
  1. MORE FEATURES CAN BREAK A GOOD MARKET. Adding rushing/game-script cols to receptions
     dropped 2024 from 54% to 50%. Feature set is a per-market choice, not a global one.
  2. LAMBDA IS A DISCOVERY AXIS, not a nuisance knob. pass_tds/rec_yds only appear at
     lam200-600. Always sweep {60,200,600} before calling a market dead.
  3. TWO-SIDED TEST is the base-rate guard: a real edge wins betting OVER *and* UNDER.
     Report board base-over rate + direction split every time ([[max-side-baseline-bias]]).
  4. Oracle-check the grader on every run ([[grading-sign-oracle-check]]) — a sign bug in
     the first direction-split diagnostic made both edges look one-sided and broken.
NEXT: wire the 3 CONFIRMED into the weekly prop board; longest-reception + anytime-TD untested
(no lines in panel); 2026 forward test for the two UNSTABLE QB volume markets.

## RB CHECKDOWN THESIS — KILLED, but it paid for itself (2026-09-17)
exp_rb_checkdown.py. Owner thesis: exploit RB receiving via (1) defense allowed to the
RB position + (2) offense's tendency to feed backs vs that defense + (3) QB checkdown rate.
Built the pieces the panel never had: TRUE RB-position-allowed by defense (aggregated from
charted player rows, incl. yards-per-RB-target), offense RB target/route share, team primary
QB checkdown%/TTT/pressure profile, opponent shell + pass-rush.

VERDICT: ✗ NO EDGE in any form. Judged against the CORRECT baseline (RB receiving props
lean UNDER: base OVER 48.4% yards / 46.9% receptions — a 54% UNDER cell is +1pt, not +4):
  - soft-to-RB defense alone: lift +2.7 / +1.1 (noise)
  - + offense feeds backs:    lift -5.4 / +4.3
  - + QB checkdown (the chain): lift -1.5 / -1.4; checkdown QB ALONE is NEGATIVE on receptions
  - only cell at |z|>=2: checkdown QB x two-high -> OVER recs 56.4% (lift +9.5, n=110) —
    REJECTED, see below.
MECHANISM CHECK KILLED IT (do this before believing any cell): if the story is "two-high /
pressure changes whether the back releases", it must move ROUTE PARTICIPATION. It does not —
two-high: RB routes 10.98->10.83 (t=-0.63), route share flat; pressure: routes +0.13 (t=+0.58).
The "back stays in to block vs pressure" story is FALSE. And two-high actually SUPPRESSES RB
production (targets t=-2.00, yards t=-2.67), i.e. the OPPOSITE direction to the 56.4% OVER cell.
Then: within the LINED RB population that effect vanishes entirely (corr two-high vs actual
-0.013; bucket OVER% 45.9/51.3/47.1). Classic trap — a real effect across ALL RBs (incl.
third-stringers) that does not exist in the population you can actually bet. 26 cells, one at
z~2.0 = exactly the noise rate.

## ★★ THE PAYOFF: SKEWED MARKETS — MODEL THE BET, NOT THE LEVEL (2026-09-17)
Found while killing the above. RB receiving actuals exceed the close line by +2.4 to +4.9 on
average while OVER hits only 45-51%. Right-skewed market (one screen = 40 yards): books price
near the MEDIAN, ridge minimises squared error and fits the conditional MEAN. Every level-model
we own is solving the wrong problem on skewed markets, biased toward OVER.
FIX (exp_prop_classifier.py): fit P(actual > line) DIRECTLY (linear-probability ridge on the
binary outcome), bet |p-0.5|. Head-to-head, same features/folds:
  - WR/TE receptions:    classifier 54.9% on 51.6% of board z+3.98 (24:53/25:57) vs mean-reg
                         55.3% on 36.1% z+3.65 — same quality, ~40% MORE volume, steadier.
  - WR/TE reception yds: classifier 53.3% on 76% of board z+3.48 (24:54/25:53) vs mean-reg's
                         narrow 57.0% spike on 8.6% (n=314). Broad+stable beats narrow+spiky.
  - RB rush attempts:    classifier 53.1% on 64% (24:53/25:53) — fixes the mean-model's
                         NON-MONOTONE dose problem.
  - RB rush yds / RB receiving: dead in BOTH framings. Genuinely hard, stop trying.
The classifier also self-corrects direction: it bets OVER only 31-43% on the under-leaning
receiving markets, where the mean-model over-bet OVER.
★ CONFLUENCE (exp_prop_confluence.py) — bet only where BOTH models fire AND agree:
  - RB RUSH ATTEMPTS: 58.4% n=197 (14.6% of board) 2024:62/2025:55 z+2.35 — clearly beats
    either alone (56.5 / 53.1) and repairs the lambda-fragility. Best RB-market result we have.
  - WR/TE receptions 55.4% (n=706, 21.7%), reception yds 54.0% (n=1049, 28.6%) — marginal gain
    over single models, but higher-confidence subsets for a board.
LESSON: for any skewed prop market, report mean-vs-median divergence FIRST, then fit the binary
target. Peak hit-rate is not the objective — volume x stability is.

## CAT & MOUSE STEP 1 — SCHEME ADAPTIVITY IS NOT A TRAIT (2026-09-17)
exp_cat_mouse_step1.py. Owner frame: who adapts scheme to the opponent (cat) vs who plays
their base (mouse). KEY DISTINCTION BUILT IN: movement != adaptation — a dial that swings
weekly may be reading the opponent or may be erratic (injury/game script), so we measured
adaptivity as the SLOPE of a defense's weekly dial on the opponent's LEAVE-ONE-OUT
league-wide "invitingness" (how much man/two-high that offense draws from all OTHER
defenses), alongside dispersion and an erratic residual. Dials: man/zone/single-high/
two-high/Cover1/Cover3 per team-game, 2021-25 (2,718 team-games, 80% dial coverage).

GATE RESULTS — FAILED:
  A) YoY persistence of adaptivity: r = +0.02 .. -0.07 across ALL six dials.
     (benchmark: base-rate scheme IDENTITY r = 0.38-0.62, i.e. identity IS stable)
  B) Split-half within season (odd vs even weeks): r = +0.06 .. -0.05. The score is not
     even self-consistent inside one season.
  C) DECISIVE permutation test (is the observed spread of slopes bigger than sampling
     noise?): observed SD / null SD = 0.91-1.12, p = 0.05-0.91. The between-team spread in
     adaptivity is EXACTLY what shuffled data produces. No real between-team variation.
  D) Richer instrument (specific opponent traits — slot rate, aDOT, route volume, RB
     targets — instead of generic invitingness): league-wide R^2 of opponent traits on the
     defense's dial = 0.010 (man) / 0.007 (two-high). Opponent identity explains ~1% of
     coverage choice.
  ⚠ Gate C's earlier-looking "coach explains 44% of adaptivity variance" is an ARTIFACT:
     69 coaches nested in 32 teams, only 3 HCs changed teams 2021-25 — many dummies fitting
     noise that Gate B already showed is noise. Do not cite it.

WHAT THIS MEANS (and it is useful, not just a null): NFL defenses play their scheme IDENTITY
largely REGARDLESS of opponent. Weekly dispersion is real (6-18pp) and mildly persistent
(YoY r~0.19) but is NOT opponent-driven. This REINFORCES why v3/v4's largest coefficient
(fit_scheme_pass = QB per-shell efficiency x opp shell DIET) works: the diet is predictable
precisely because coordinators do not re-scheme per opponent. Corollary: do NOT build
opponent-specific scheme-deviation features — model the stable diet instead.

NOT TESTED (the versions of the idea still alive — season-level only was tested):
  1. IN-GAME adaptation (1H->2H adjustments, by quarter) — the truest "cat and mouse".
     FP grouping dims playStartClockQuarter / playDownNumber EXIST and are pullable.
  2. Situational scheme by down/distance/red zone (same grouping dims).
  3. Adaptation to OPPONENT PERSONNEL EVENTS (backup QB -> blitz rate, WR1 out -> shells).
  4. OFFENSE-side adaptivity (PROE / pass rate / personnel vs defense type) — only the
     defensive dials were gated here.
  5. Blitz rate + offensive personnel are Yes/No LABELS in current pulls, not rates —
     both are re-pullable as rates via the grouping trick if a step needs them.
COORDINATOR DATA: not sourced (nflverse has HEAD COACHES only, 100% coverage, 69 distinct).
Do not buy/scrape OC-DC data until a variant above clears a reliability gate.

## CAT & MOUSE STEPS 2-3 — PROGRAM CLOSED (2026-09-17)
exp_cat_mouse_step2.py (in-game adaptation), exp_cat_mouse_step3.py (can it be bet?).
Step 1 killed SEASON-level scheme adaptation. Step 2 tested a different mechanism: does a
play-caller adjust DURING the game to what is working, using nflverse `pass_oe` (the xpass
model already conditions on down/distance/score/time, so pass_oe is what the caller did
BEYOND the situation — raw pass rate cannot separate adaptation from clock management).
  evidence(H1) = mean rush EPA - mean pass EPA   |   response(H2) = mean pass_oe deviation
  14 seasons (2012-2025), 477,559 plays, 7,545 usable team-games.

★ GATE 0 PASSES — THE LEAGUE ADAPTS, AND IT IS A LAW:
  slope -2.19, t = -10.37. Run outperforms pass in H1 -> caller calls MORE run than the
  situation warrants in H2. Stable in every era: -2.04 / -1.93 / -2.47 / -2.41 (2012->2025).

✗ BUT THERE IS NO CAT AND NO MOUSE — individual adaptivity is not a trait:
  A) split-half within season r = +0.073 | B) year-over-year r = -0.070
  C) permutation: observed slope SD 5.53 vs null 5.09 (ratio 1.09, p=0.013) — a real but
     tiny excess; ~85% of apparent between-team differences are noise
  D) COACH-CAREER pooling (63 HCs, median 80 games each — fixes Step 1's power problem):
     split-half r = +0.008 (Spearman-Brown 0.016); career-slope spread SD 1.81 vs null 2.11,
     ratio 0.86, p=0.927 — coaches vary LESS than noise. Everyone adapts about equally.
  ⚠⚠ PERMUTATION-CORRECTED VARIANCE (the trap that fooled Step 1 AND Step 2's first pass):
     COACH observed 15.9% vs RANDOM-LABEL NULL 23.3%+/-3.0 (p=0.997);
     TEAM observed 2.8% vs null 7.0%+/-1.7 (p=1.000). Both BELOW random. The raw
     "coach explains 15.9% vs team 2.8%" is a pure df artifact — more groups always explain
     more. ALWAYS permute the label before quoting variance-explained.
  ⛔ The coach leaderboard (Kubiak -6.99 ... Flores +2.67) is NOISE. Do not act on it.

STEP 3 — the league law vs REAL halftime lines (research/football-2h-odds, 824 NFL games
2023-25 matched, open+close). Hypothesis: run working in H1 -> more run in H2 -> clock
burns -> 2H UNDER.
  ✓ The relationship is REAL and INDEPENDENT: slope -1.14 pts per unit evidence (t=-2.38),
    and it STRENGTHENS under controls — +H1 total/line level/|H1 margin| -> t=-2.72;
    +H1 play volume -> t=-2.87. So it is NOT proxying for low-scoring or slow first halves.
    Market prices it only PARTIALLY (corr(evidence, closing halftime total) = -0.155).
    Bonus independent effect: high H1 total -> 2H under (t=-2.48).
  ✗ NOT TRADEABLE at current sample: walk-forward 2H-total model (7 feats, 541 gradeable)
    gives 51.9/52.8/55.3% at edge>=1.0/1.5/2.0 with 2024:41-46% vs 2025:57-63% — unstable,
    z<1, and BELOW the 54.7% always-OVER base of that subsample. Effect (~1 pt per SD) is
    too small vs halftime-total variance on 2 test seasons.
VERDICT: cat-and-mouse CLOSED as a betting program. Keep the league law as a FEATURE
candidate for any future 2H model; do not bet it standalone. Do NOT buy OC/DC data —
four independent tests (defense season, offense season, offense in-game, coach career)
all say adaptивity is not an identifiable trait.
KEEPER INSIGHT: what IS predictable is scheme IDENTITY, not adaptation — which is exactly
why v3/v4's largest coefficient (QB per-shell efficiency x opp shell DIET) works.

## ANYTIME TD — EFFICIENT AND UNBETTABLE (2026-09-17) ✗ KILL
exp_anytime_td_build.py + exp_anytime_td_model.py. Our LARGEST prop market (613,685 raw
rows). Graded correctly for a PRICE market: ROI at the actual closing price, not hit rate.
Panel: 22,802 player-games, 2023-25, 4 books, last pre-kickoff snapshot at/inside T-60, BEST
price across books (real line shopping — flatters any edge, so a negative here is conclusive).
Validation clean: 285 games/season, TD rates .142/.154/.154, top scorers Gibbs/Kyren/Henry/
McCaffrey/Allen with sensible implied probs, position rates RB .197 / WR .152 / TE .103.

MARKET CALIBRATION — YES is overpriced in EVERY implied bucket (textbook favourite-longshot):
   implied <=5%: actual 2.0% vs implied 3.7%, ROI -46.1%   | .05-.10: ROI -31.9%
   .10-.15: -27.2% | .15-.20: -14.9% | .20-.30: -9.8% | .30-.40: -5.3% (cheapest region)
   .40-.55: -9.7% | .55+: -5.6%   Flat-betting every YES = -21.9% ROI.

MODEL ADDS NOTHING. 22 features — inside-5 rush share, inside-20 targets, bell-cow shares,
own TD history, opponent TDs/inside-5 allowed, position dummies, goal-line x soft-defence
interactions — on top of the price as anchor:
   corr with outcome: MODEL +0.3846  vs  MARKET ALONE +0.3858  (model is marginally WORSE)
   per position, model vs market: RB +0.449/+0.450 | WR +0.349/+0.351 | TE +0.334/+0.333 |
   QB +0.293/+0.295 — identical to three decimals in every group.
   ROI negative at every threshold and every lambda (30/100/300): -4.4% to -19.1%, with wild
   season flips (lam100 edge>=2%: 2024 -15.1% vs 2025 +11.5%) = noise, not edge.
USAGE-SHOCK hypothesis (market slow to reprice a backup inheriting goal-line work) ALSO DEAD:
   goal-line share jump top decile ROI -11.6% (hit 35.3% vs implied 40.7%); rush-share jump
   -15.7%; snap-share jump -21.9%; model edge inside the shock subset -20.1%. The market
   prices usage changes correctly — hit rates track implied in every shock bucket.
By position everything loses: RB -25.4%, WR -24.2%, TE -23.5%, QB -10.3%.

VERDICT: ⛔ DO NOT BET ANYTIME TD (YES). The most efficiently-priced and most heavily vigged
market we have measured. Our entire granular warehouse adds ZERO incremental information over
the closing price. Do not revisit without a genuinely new information source.
⚠ CAVEAT / only open door: we scrape the YES side ONLY. The 1.7-4.5pp YES overpricing is
consistent with ordinary two-sided vig, so it does NOT imply NO is +EV — that cannot be tested
without NO prices. Pulling the NO side is the single thing that could reopen this market.

## ⛔ NESTED-BUCKET AUDIT (2026-09-17) — 773 hidden feature columns recovered
21 of 79 FP tables store their granularity in a nested `bucket`/`grid` STRUCT column.
Reading `schema_arrow.names` returns top-level fields only; `metadata.num_columns` gives the
true leaf count. Disagreement between the two = hidden data. Every model built this session
read top-level only, and man/zone splits were declared "unavailable" while sitting in a struct.
  ✅ NOT a correctness bug: top-level == bucketOverall at 100% match (22,753 separation rows;
     2,750 run-pass rows). All frozen results stand. Models were INCOMPLETE, not WRONG.
  FIX: fp_flatten_buckets.py -> data/fpdata/flat/ (20 tables, 773 columns). Re-run weekly.
  ⚠ Adding them DEGRADES the prop models (exp_prop_shellfit.py): receptions 56.7->54.5 full
    dump / 56.6 targeted fits; reception yds 56.8->50.8 / 55.6; RB recs 56.8->55.8/56.3.
    Per-shell splits cover only ~53% of lined rows on ~70 routes/season -> noise. KEEP FROZEN.
  ★ Value is the MATCHUP layer, not features. League yds/route base: man 1.49 / zone 1.66 /
    single-high 1.68 / two-high 1.48.
  🔜 UNTESTED: team run-pass Leading/Trailing/Neutral/FirstHalf/SecondHalf/Inside20/ThirdDown
    — never touched a model; charted game-script + charted in-game adaptation.

## ANYTIME TD v2 — red-zone stack tested, STILL DEAD (2026-09-17)
exp_anytime_td_v2.py. Added everything v1 lacked: red-zone SNAP SHARE (inside-5/10/20 player
snaps over team total), inside-10/20 rush share, inside-10 targets, team red-zone pass-vs-rush
split (flattened buckets), red-zone separation (flattened RedZone bucket), opp RZ volume allowed.
  ★ Red-zone snap share is the single best ATD feature: the ONLY variant reaching market parity
    (corr +0.3858 vs market +0.3858 exactly). v1 +0.3854. FULL stack WORSE (+0.3847) — ms_in10ru
    covers 29% of rows and adds noise. Lesson repeats: targeted > dump.
  ✗ Parity != edge. ROI negative at every threshold (-7.6% to -41%). Diagnostic reading: the
    market already prices red-zone snap share; we reproduced it, did not beat it.
  ★★ goal-line backs (top-quartile inside-5 snap share): hit 35.0% vs implied 41.5%,
     ROI -22.3% (n=778) — most overpriced group measured; the popular bet is the worst price.
  Per position: RB -25.4% (corr .450 vs .450), WR -24.2%, TE -23.5%, QB -10.3%.
VERDICT: ATD stays killed. Only reopener = pulling NO-side prices (we scrape YES only).

## V5 ROUTE + RED-ZONE FITS ON SIDES/TOTALS — TESTED, NO IMPROVEMENT (2026-09-17)
exp_fp_v5_routefits.py. Owner asked whether the recovered bucket layer (route-level, red
zone, situational) should improve the sides/totals model, reasoning that red-zone conversion
is worth ~4 pts/game. Built as DISSECTION FITS in the proven fit_scheme_pass shape:
  fit_route_sep/yds = SUM over 10 route types of (offense's usage share of route R)
                      x (this defense's separation / yards allowed on route R)
  fit_rz_sep        = own red-zone receiver separation + opp red-zone separation allowed
  rz20/rz10_pass, rz20_plays, lead_pass, trail_pass  (Inside10/20 + game-script buckets)
Tested against the REAL v4 script (baseline reproduces: SPREAD ALL 66% n=246, TOT thr3 58.2%):
  add            | SP ALL | n   | TOT2  | TOT3  | TOT4
  none (v4)      |  66%   | 246 | 55.2% | 58.2% | 56.2%
  route fits     |  65%   | 260 | 55.4% | 56.7% | 58.6%
  red-zone fits  |  63%   | 281 | 57.0% | 57.3% | 51.7%
  both           |  63%   | 287 | 53.9% | 55.5% | 57.9%
✗ NO RELIABLE GAIN. Gains appear at one threshold and vanish at the next (route: better at
TOT4, worse at TOT3; red zone: better at TOT2, collapses at TOT4) = noise, not signal. A real
feature improves monotonically. Spreads degrade cleanly with every addition.
~ One real consolation for "more bettable games": volume rises 246 -> 260 -> 287 spread bets;
  route fits = 260 bets at 65% vs 246 at 66% ~ unit-neutral (62.7u vs 63.9u at -110).
KEEP V4 AS THE FROZEN SPEC.

★★ PATTERN NOW CONFIRMED FOUR TIMES IN ONE DAY (props narrow-vs-wide, prop shell fits, ATD
red-zone stack, sides/totals route+RZ fits): **the FP granular split layer is excellent for
NARRATIVE/matchup analysis and consistently useless as MODEL FEATURES.** Cells are thin, the
market already prices them, and coarser aggregates already capture the signal. The same data
overturned three live reads in matchup_report.py / route_matchup.py. Build reports with it,
not features.

## ⛔⛔ V4 2025 FOLD IS LEAKING — 66% HEADLINE IS INVALID (2026-09-17)
Per-season ATS thr>=2: 2023 64.7% (n=102) | 2024 59.5% (84) | 2025 78.3% (60). At thr>=4,
2025 = 92.6% (27). FORENSIC PROOF: 2025 thr>=4 winners cover by an average +11.4 while losers
miss by only -3.5 — 2.9x the claimed edge and wildly ASYMMETRIC. A model finding true 4-pt
edges cannot produce winners that cover by eleven; it was identifying eventual blowouts.
  HONEST v4 = ~62% at thr>=2 (clean 2023-24 folds only).
  NOT team_week (leak screen clean, 2025 lowest same-week corr .134). Suspect = composites_v2 /
  fit_scheme_pass season-to-date windows including the current game in the latest season.
  ROOT CAUSE OPEN. composite-v2/v3 totals share the pipeline -> also suspect.
  Model-agreement study (93%/100% on "both agree") DISCARDED — built on the leaky fold.
★ STANDING LEAK DIAGNOSTIC (run on every model, cheap and decisive):
  1. per-season hit rate — a leak shows as ONE season wildly better than the rest
  2. winner-margin vs loser-margin SYMMETRY — real edges are symmetric
  3. ratio of winner margin to claimed edge
  PROPS PASSED ALL THREE and remain valid: pass TDs 61.0/61.0 (+1.09 vs -0.80, 1.82x);
  pass yds 56.9/56.6 (+59.7 vs -52.1, 1.66x); WR/TE recs 54.9/59.1 (+1.66 vs -1.00, 1.85x).
PRODUCTION MODELS GRADED: nfl_predictions_epa classifier, 240 games 2025 — ATS 51.9%, totals
47.5%, follow-on-disagreement 43.1% = no edge. nfl_slate_picks 2026 wk1: spread 4-11-1, total
3-13, own has_play picks 3-7, but moneyline 11-5 / 1H ML 12-4 — picks winners, compresses
margins. Do not bet its spread/total numbers.

### REFINEMENT: leak is isolated to 2025 — spreads real, totals weak
Symmetry forensic (|win margin|/|loss margin|; real edge ~1.0-1.5):
  SPREADS thr2: 2023 0.91 (64.7%) CLEAN | 2024 1.31 (59.5%) CLEAN | 2025 2.23 (78.3%) LEAK
  TOTALS  thr3: 2023 0.79 (67.6%) | 2024 1.23 (58.3%) | 2025 1.20 (43.8%) — no leak, unstable
SPREADS are NOT fake: clean folds average ~62% at thr>=2. Use 62%, never 66%; discard 2025.
TOTALS have no leak but no dependable edge either (pooled 58.2% is carried by 2023 alone) —
do not treat as an edge until per-season stability is shown.
⚠ RATIO (winner margin / claimed edge) is 2-3x in EVERY season incl. clean ones (spread margin
sd ~14 vs 3.4 edge) — NOT diagnostic. SYMMETRY is the signal.

## ⛔ SIDES/TOTALS — DEFINITIVE NULL (sides_model_v6.py, 2026-09-17)
Root cause of v4: `fit_scheme_pass` carried the ENTIRE edge (remove it -> 51.9/51.4/41.9) and
FAILS the line-vs-result leak screen in every season (2023 corr vs line -0.062 vs result -0.212;
2025 -0.149 vs -0.208). It is built on split_recv_adv_x_coverage, whose coverage dimension does
not exist: **100% of team-games carry exactly ONE shell label (mean 1.00 distinct shells)**.
The label reflects in-game state, which is how outcome information entered. It was never
screened before being fitted — the process failure.

V6 REBUILD, leak-screened BEFORE fitting (screen on 2021-22 only so no test info leaks):
164 features — EPA/points-per-drive, composites, OL-vs-DL trenches, situational run/pass
(Leading/Trailing/Inside10/Inside20/ThirdDown/halves), PROE, coverage identity, red zone,
own-vs-opponent differentials. Screen dropped only 2 features, so nothing was over-filtered.
  SPREADS: 49.5% / 50.0% / 50.9% at thr 1/2/3
  TOTALS:  49.7% / 50.5% / 51.3% at thr 2/3/4  (per-season 2023 63.9% -> 2025 37.1% = noise)
  PLACEBO (shuffled training outcomes): 48.6% / 49.9% / 49.8%
=> THE MODEL EQUALS THE PLACEBO. This data does NOT beat the NFL sides/totals market. Not a
   tuning/threshold/feature-selection problem. STOP BUILDING SIDES MODELS FROM THIS DATA.
WHY IT IS COHERENT: the NFL spread is the most efficiently priced market in sports and every
participant buys the same charted feed. Shared information sets are already in the price.
Props are lower-limit, less attention per market, hundreds per slate — which is exactly where
our edge DOES survive (pass TDs 61.0/61.0, pass yds 56.9/56.6, WR/TE recs 54.9/59.1, all
placebo- and symmetry-clean).
★ MANDATORY ORDER OF OPERATIONS, LOCKED: leak-screen EVERY candidate feature (|corr vs result|
must not exceed |corr vs market|) BEFORE fitting, then per-season stability, margin symmetry,
and a shuffled-label placebo. A model that matches its placebo has no edge regardless of
headline hit rate.

## ★★★ CORRECTION TO THE "SIDES NULL" — WRONG BENCHMARK (2026-09-17)
The v6 null above was graded vs the CLOSING line. Production is explicitly OPEN-based
(NFL_SLATE_WK12_SPEC: `fg_total_edge` = pred − OPEN total; `fg_spread_pick` = "side at the
opener"; totals ensemble = "strict-open"), documented at sides 53.4% / totals ~57% vs OPENER.
Re-graded v6 on the SAME benchmark (odds_consensus.parquet, 765 joined games 2023-25):
  SPREADS vs OPEN 52.1 / 53.8 / 56.1% @thr1/2/3   (vs close 49.3 / 49.9 / 50.5)
  TOTALS  vs OPEN 55.4 / 57.5 / 62.1% @thr2/3/4   (vs close 48.8 / 52.3 / 50.4)
  break-even 52.4% => v6 MATCHES/BEATS production on production's own benchmark. NOT a null.
⚠ Caveats: 2025 much weaker (spreads 50.4%, totals 43.3% at thr2 vs 2023's 55.8%/66.1%).
⚠ Mechanism: ~50% vs close but 53.8% vs open => the gain IS the open→close line movement. The
model predicts WHERE THE MARKET MOVES (closing-line value), not outcomes better than the close.
Monetizable, but requires betting EARLY and must be described as such.
★★ LAW: GRADE AGAINST THE PRICE THE STRATEGY ACTUALLY BETS. Read the spec for the benchmark
BEFORE evaluating. Grading an open-based system vs the close understates it ~4 pts and
manufactures a false null.

## ★★★ MATCHUP POWER RATINGS — BUILT, VALIDATED, FROZEN (2026-09-17)
power_ratings.py → power_ratings_checks.py → power_ratings_situational.py → power_ratings_final.py
Four composites per game: each team's OFFENSE (expected pts vs THIS defense) and DEFENSE
(expected pts allowed vs THIS offense). Built in the locked order, every gate before the next:
  1. unit ratings from VERIFIED-CLEAN tables only (split_recv_adv_x_coverage excluded)
  2. RELIABILITY gate split-half r>=0.30: kept 18/28 FP units. Pressure metrics most stable
     (O_pass_press .64, O_ol_poe .58, D_dl_poe .54); dropped CPOE .21/.02, aDOT -.11, explosive
     .10-.17, D_pass_ypa .17 — noisy per-game, exactly the funnel lesson.
  3. LEAK screen (2021-22 only): 35 kept, 0 dropped.
  4. matchup differentials (offense unit − THIS opponent's matching defense unit), 9 pairs.
  5. ridge λ80, walk-forward 2023-25; composite = predicted points. + market anchor (blend).
RESULTS vs OPENER (production's benchmark):
  market-free (pure power rating): SP2 52.5% / TO2 53.8% — break-even; R² .091 vs market .168.
  BLEND (composite + market):      SP2 59.7% (238) SP3 63.3% (120) | TO2 60.1% TO3 58.5%
  vs CLOSE: SP2 54.2% (n=96) — above break-even, so NOT purely line movement (v6 was ~50%).
  matchup layer adds +0.5/+1.4 (59.2→59.7, 61.9→63.3) — real but the reliability gate is the driver.
★ SPREAD EDGE IS CONCENTRATED IN HOME PICKS (robust with OR without the `home` feature):
  HOME picks 63.6% (n=154) — 2023 66.0 / 2024 69.4 / 2025 56.9, all above break-even
  AWAY picks 52.4% (n=84)  — 2023 48.3 / 2024 60.9 / 2025 50.0 = coin flip
  ⇒ RULE: play spreads ONLY when the model likes the HOME side by >= 2 vs the opener.
★ TOTALS HAD A CALIBRATION BUG, NOW FIXED: raw model total drifts vs market by +1.71/-0.28/
  +1.33/+2.60 per season → the model called OVER on 84% (2024) and 97-100% (2025) of plays.
  Prior-season offset over/under-corrects. WITHIN-SEASON ROLLING offset (mean resid of this
  season's prior weeks, >=24 games, else prior-season) fixes it: OVER share 47-57%, hit rate
  HOLDS at TO2 60.3% (247) / TO3 66.1% (109). Spreads immune (level cancels in the margin).
  Explains why totals have looked unstable all day. Early-season calibration is weakest.
SITUATIONAL LAYER = NULL (all leak-clean): referee 0.0 / rest −0.1 / primetime+div +0.3 /
  weather −3.3 / recency form −0.9 on SP2; kitchen-sink −2.1 SP2, −4.7 TO2. Do not add.
ACCEPTANCE FORENSICS (final config):
  spread home-picks thr2 63.6% z+3.38 sym 1.65 (thr3 66.2% sym 2.07 n=80 — elevated, small)
  totals calibrated thr2 60.3% z+3.25 sym 1.24 | thr3 66.1% z+3.35 sym 1.23
  PLACEBO: spread home-picks 47.3-48.6% | totals 51.0-51.8%  → real model +12-15 / +8-9 pts.
CAVEATS THAT STAND: 2025 is the weak year everywhere (home-picks 56.9, totals 51.3 thr2);
thr3 spread symmetry 2.07 warrants a watch; early-season totals calibration uses the prior
season's offset (+2.52 for 2026) until ~3 weeks are in.
WEEK 2 2026 READS: spread HOME ★ = BAL -8.5 (+5.1), CHI -4.5 (+3.5), TB -8.5 (+3.0);
away leans not played (JAX +2.5 −6.5, CIN +2.5 −6.2). totals ★ after calibration = CIN@HOU
UNDER 46 (−3.1), CLE@TB UNDER 41.5 (−4.2). DET@BUF: BUF by 6.7 (+1.2 no play), total 56.9 (+2.4 no play).

## POWER RATINGS — ROUND 2: HFA, FAV/DOG, PRODUCTION FEATURES, INJURIES (2026-09-17)
power_ratings_prodfeats.py + power_ratings_spec.py (frozen). All vs OPENER, thr>=2.
TEAM-SPECIFIC HOME FIELD = NOT A TRAIT. split-half r -0.099, YoY r +0.006 (sd across teams 6.3
  pts is pure noise). Adding it: 59.7->58.4 (with home) / 57.8 (instead of home); away picks
  52.4->51.2->50.5. Dead. The universal `home` feature is correct.
THE ASYMMETRY IS HOME/AWAY, NOT FAV/DOG: HOME-FAV 65.1% (86) HOME-DOG 61.8% (68) | AWAY-FAV
  50.0% (30) AWAY-DOG 53.7% (54). FAV vs DOG overall 61.2 vs 58.2 — barely matters. Both home
  cells win, both away cells don't. Likely mechanism: away performance is noisier to predict.
PRODUCTION-SIDE FEATURES, one at a time (all leak-clean):
  ELO       59.7->57.6, HOME 63.6->59.7. Corr with market .62-.69 => redundant, collinear. DEAD.
  MADDEN    (properly joined via nickname map; raw team col mixes full names + nicknames)
            59.7->49.2 (2023: 45%). md_off_vs_def corr with market .63. DEAD, harmful.
  PRECIP    59.7->57.3, coef -0.29 pts/SD (sensible sign). DEAD.
  ★ INJURY  QB+SKILL Out/Doubtful/IR counts, own + opp: ALL 59.7% (288, +50 bets), HOME 61.4%,
            **AWAY 52.4->56.7%** (104; 54/63/55 by season, sym 1.02). Coefs sensible: opp skill
            out +0.38, own skill out -0.28, opp QB out +0.24. DEF injuries add nothing; QB alone
            doesn't help away. TIMING VERIFIED: median 47h before kickoff, 0.0% after kickoff
            every season; strict >=6h-pregame version identical (56.0 away). NOT a leak.
  combos with ELO all collapse to ~55%. Elo/Madden poison anything they touch.
★ LAW: a feature that correlates > ~0.5 with the market anchor HURTS the model (Elo .62-.69,
  Madden .63). The market already contains it; adding it is collinearity + noise.
UNITS at -110, 3 seasons: home-only baseline 63.6% on 154 = +33.1u | home-only + injury 61.4%
  on 184 = +31.7u | **BOTH SIDES + injury 59.7% on 288 = +40.3u** <- the config.
FORENSICS (final): ALL sym 1.39 z+3.30 (59/65/56) | HOME sym 1.65 | AWAY sym 1.02 | placebo
  46-48%. HOME thr3 sym 2.06 on n=96 — watch.
FROZEN SPEC (power_ratings_spec.py): KEEPF + market + QB/SKILL injuries, ridge λ80, spreads
  |gap|>=2 with HOME = core tier (61.4%) / AWAY = extended tier (56.7%); totals rolling-calibrated
  |gap|>=3 (60.3/66.1%). Excluded: coverage-split table, team HFA, Elo, Madden, precip, referee,
  rest, form, weather.
WEEK 2 2026 FINAL READS (with injuries): CORE ★★ CHI -4.5 (gap 4.7), TB -8.5 (4.1), BAL -8.5
  (4.0), KC -6.5 (2.3, IND 3 skill out). EXTENDED ★ JAX +2.5 (8.5), CIN +2.5 (7.9), MIA +13.5
  (2.9). TOTALS ★ CIN@HOU U46 (-4.8, HOU 2 skill out), CAR@ATL U44 (-3.8), MIA@SF O45 (+3.1).
  DET@BUF: BUF -6.0 vs -5.5 (gap 0.5), total 56.1 vs 54.5 — no play either market.

## INJURIES: BODY COUNT BEATS USAGE-WEIGHTED (2026-09-17) — owner's critique, tested
power_ratings_injury_usage.py + injury_name_crosswalk.py. Owner: "you're counting players who
don't even start." Built the correct version — each Out/Doubtful/IR player weighted by ENTERING-
GAME usage (max of route share / rush-attempt share; QB = dropback share, starter >= .5).
COVERAGE: props crosswalk matched only 23% of injured players. Name-based crosswalk against the
full FP roster (last-word-normalised, team+season scoped) → 64%, and **100% of the unmatched are
absent from FP that season under any name = never played → usage 0 is CORRECT**. 64% is the ceiling.
RESULT (vs open, thr>=2): crude count ALL 59.7 / HOME 61.4 / AWAY **56.7** (54/63/55 by season)
vs usage-weighted ALL 57.4 / HOME 60.3 / AWAY 52.7 (51/57/50). Usage+top-player 56.7/58.4/53.8.
Both together 58.2/61.7/52.6. Coefficients identical in sign and size (opp skill out +0.37 vs
+0.41) — same signal, worse discrimination.
WHY (consistent with the market-correlation law): the market PRICES star injuries — a WR1 out
moves the opener. What it does not price is DEPTH attrition (WR3+WR4+TE2 out = 0.3 on a usage
scale, 3 on a body count, practice squad on the field). The usage feature is redundant with the
anchor; the body count captures the unpriced part. SPEC UNCHANGED: crude QB+SKILL counts.
For NARRATIVE use, always print WHO is out (injury_name_crosswalk.py / live query), not the count.

### PLAYED-ONLY injuries = the spec (2026-09-17, final)
Owner's objection held on the live slate: crude count flagged CLE "QB out" (Dillon Gabriel = the
BACKUP; Watson starts) and IND "3 skill out" (Mallory/Montgomery/Towt = depth). PLAYED-ONLY =
skill players counted only if usage > 0 this/last season, QBs only if dropback share >= .5.
Drops 40% of injured skill (never played) + 45% of injured QBs (backups). RESULT vs open thr>=2:
ALL 60.0 / HOME 62.2 / AWAY 56.4 (crude 59.7/61.4/56.7; usage-weighted 57.4/60.3/52.7). Variants
within noise (played-skill+anyQB 60.2/62.5/56.4; anySkill+starterQB 60.1/61.3/58.1). Chosen
because it is correct BY CONSTRUCTION and loses nothing. power_ratings_spec.py updated;
INJ_FEATS = p_inj_qb/opp_p_inj_qb/p_inj_skill/opp_p_inj_skill. Live scoring name-matches the
weekly report to FP (2025 + current season) to attach usage.
QB STARTER RULE = FIRST PASSER (pbp), final. Dropback-share rules fail both ways: blended
(2025+2026 avg) counted CLE's Gabriel (2025 starter, 2026 backup); most-recent-game share
dropped SEA's Darnold (started wk1, hurt early, backup threw most passes). First-passer of the
team's most recent game resolves both by construction: Watson was CLE's first passer, Darnold
was SEA's. Historical: only 49/318 injured QBs are true starters by this rule (174 blended,
130 most-attempts). Backtest unchanged (59.7/61.5/56.5) => the QB flag carries little of the
edge; the PLAYED skill count does. Live scoring uses data/pbp_cache/_pbp2026.parquet.
Live week-2 name matching is TEAM-scoped first (A.J. Brown is on NE in 2026 at 0.33 route share
— a name-only lookup had given him PHI's 0.85), name-only fallback for traded players.
QB FLAGS DROPPED AS FEATURES (final). p_inj_qb coefficient was +1.50 pts per flag — WRONG SIGN (a
team missing its starter scores MORE?) — from 49 positive cases (1.8% of rows) with the market
anchor already pricing starter-out. It swung SEA@ARI's total +3.6 on one flag. Skill-only:
59.3% (297) +39.0u vs 59.7% (290) +40.3u with QB — inside noise, so drop the unidentifiable one.
Starter-out as a FILTER is the opposite of useful: starter-out games are the BEST subset
(65.6% n=32, home 72.2%) vs 58.5% for the rest — consistent with the market over-adjusting to
QB injuries (and would explain the positive sign). n=32 => WATCH, not a rule.
score_week_power.py = the reusable weekly scorer (SEASON WEEK args). First-passer starter
identity kept for the narrative layer so the report names who is out correctly.

## MODULATORS + DOSE-RESPONSE (2026-09-17) — power_ratings_modulators.py, _weather_check.py
Owner: situational data must help somehow (referee mattered in the old model; divisional games
"are different"). Additive features failed earlier; tested three OTHER methods on the final model.
DOSE-RESPONSE (vs open) — clean and MONOTONE in both markets, the strongest validation there is:
  spreads cumulative 54.5/59.3/60.3/61.3/75.0% @>=1/2/3/4/5 (n 506/297/151/80/36); the 1-2 bin
  is 47.8% (below break-even) => the 2-pt threshold is right. Home leans 61.5→61.9→65.5.
  totals cumulative 59.6/63.4/67.4% @>=2/3/4 (n 250/112/43); marginal 56.5/60.9/67.7.
DIVISIONAL = NULL, tested THREE ways: feature (earlier), conditional split (60.9% div vs 58.3%
  non-div spreads; 61.1 vs 64.5 totals — no difference), STRATIFIED separate models (55.7% vs
  59.3% pooled — WORSE). This model does not see divisional games as different.
REFEREE = NULL: as a direct offset on the calibrated total it HURTS at every k (k=0 best:
  59.6/63.4/67.4). Tercile split shows totals better under high crews (69.6%) but the direction-
  agreement test runs BACKWARDS (model agreeing with crew 57.8% vs opposing 67.6%) => noise.
  The market prices the crew. (The old model's referee effect was on an un-anchored total.)
★ WEATHER AS A TOTALS MODULATOR — the one thing the modulator method found:
  totals |gap|>=3: OUTDOORS 69.9% (n=73; 72.7/68.2/66.7 by season) vs DOME 51.3% (n=39;
  54.5/60.0/38.5). Holds at thr>=2 with more n (62.7 vs 53.1, n=169/81). Placebo p=0.048.
  ⚠ wind is NOT an independent confirmation: dome games carry wind=0, so "low wind" == dome
  (identical numbers); among outdoor games wind adds nothing (69.7 vs 71.4, n=7). ONE variable.
  Sharpest cell: outdoor UNDER leans 76.2% (n=42) vs outdoor overs 61.3%; dome unders 44.4% (n=9).
  Mechanism: weather uncertainty widens the market's total; the model's under-lean catches it.
  Weather as an ADDITIVE feature hurt (-3.3 SP2); as a MODULATOR it is the strongest totals
  filter we have. => SPEC: outdoor totals = CORE tier, dome totals = LEAN tier (soft, not an
  exclusion). First 2026 forward-test item.
OTHER SPLITS (exploratory, ~30 tested, treat as watch only): bye-week spreads 46.7% (n=30, 60/44/36
  by year); rest-diff extremes swing wildly on n<60; primetime -3.9 on n=47; temp high 46.9 (n=49).
WEEK 2 totals by roof: CIN@HOU (NRG, retractable) and CAR@ATL (Mercedes-Benz, dome) => LEAN;
  CLE@TB and MIA@SF outdoors => CORE.

## VENUE AUDIT — retractable roofs and neutral sites (2026-09-17, owner's check)
Owner: "all Texans home games should be in a dome — check for neutral/international games."
AUDIT (games_enriched, 2021-25): HOU — 43 home games, ALL at NRG Stadium, ALL location=Home; the
3 recorded 'open' (2021 wk14 SEA, 2023 wk2 IND, wk4 PIT) are genuine roof-OPEN days at a
retractable stadium, not neutral sites. ATL — 41 at Mercedes-Benz + 1 neutral (2021 wk5 NYJ at
Tottenham, recorded with ATL as home_team); the 10 'open' are genuine roof-open days.
=> The training label roof∈{dome,closed} is CORRECT for retractable stadiums: an open-roof game
   IS an outdoor game. HOU 93% / ATL 74% closed are real closed-roof rates. For LIVE scoring the
   roof status of a retractable stadium is unknown pregame => tier by historical closed-rate
   (HOU/ATL => dome/lean tier) and say "retractable, expected closed".
★ REAL CONTAMINATION FOUND: 26 neutral/international REG games 2021-25 (London ×11, Germany ×3,
   Mexico, Brazil, 2025 KC/LAC at SoFi, ATL/IND at Lucas Oil, etc.) carry a designated home_team;
   the panel had been giving that team home=1. 5 were in the spread play set (2-3). Removing all
   26: SP 59.3→59.0, HOME 61.5→61.2, AWAY unchanged, TO 63.4→62.7 — real but immaterial (2% of
   games). FIX by construction: power_ratings.py now sets home=0 for BOTH teams at neutral sites
   and carries a `neutral` flag.
Also: the nflverse games.csv release URL began 404ing; _load_games() in power_ratings.py and
power_ratings_situational.py now falls back to data/games_enriched.parquet (schema verified
complete). A first version of that helper recursed on itself — fixed.

## ★★★ SIGNAL × POWER-RATINGS CONFLUENCE (2026-09-17) — power_ratings_signals.py
Ledger: out/forecast_ledger_2023-25 (1,431 graded signal picks; 1,228 join to the power ratings).
`sides_model` (596 spread picks) IS the old production sides model; everything else = the
situational SPOT RULES (primetime_tight_under, wind_under, bot_vs_bot_under, receiver_over, ...).
REFEREE AS A SIGNAL = DEAD BEFORE TESTING: crew tendency is not a trait (YoY r -0.10 over rate,
  +0.07 home-cover; split-half .06/.02). Same verdict as team HFA and scheme adaptivity.
PRODUCTION sides_model × power ratings (spreads, |gap|>=2):
  baseline 53.7% (596) +14.9u | ALIGN 62.1% (132) +24.5u z+2.79 | OPPOSE 50.4% (115) -4.3u |
  neutral 51.6% (349) -5.4u  => production picks are ONLY profitable when the power ratings agree.
  The power ratings are a VALIDATOR for production: surface only aligned picks (22% of them).
SPOT RULES × power ratings, TOTALS (the "signals as direction motivators" question) — YES:
  strict |gap|>=3: ALIGN 87.9% (33) +22.4u z+4.35 | OPPOSE 45.7% (35) -4.5u | neutral 59.1% (296)
  loose |gap|>=1.5: ALIGN 74.0% (96) +39.5u z+4.69 | OPPOSE 47.2% (89) -8.8u | neutral 59.8%
  Monotone align > neutral > oppose. Inverse view (model's total picks by spot-rule state):
  spot rule AGREES 85.0% (20) | OPPOSES 53.1% (32) | silent 60.7% (56). Symmetric => real.
SPOT RULES × power ratings, SPREADS: model does NOT add to aligned (62.8 vs 62.6 neutral) but
  VETOES opposed (51.6%). Inverse: model spread picks with a spot rule opposing = 47.8% (46).
  Spot rules are a veto on the model and vice-versa on spreads; on totals they COMPOUND.
by rule: wind_under ALIGN 87.5% (8) — consistent with the outdoor-UNDER modulator (76.2%);
  primetime_tight_favorite ALIGN 66.7 / OPPOSE 54.5; fade_pr_in_tight_game OPPOSE 37.5 (8).
RULES TO SHIP: (1) production spread pick + power ratings ALIGN (|gap|>=2) => core;
  (2) spot-rule TOTAL + power ratings ALIGN (|gap|>=1.5) => core, strongest cell we have;
  (3) either market, power ratings OPPOSE a signal => do NOT play the signal (fade-eligible).

## RETRACTION — power ratings edge was closing-line information (2026-09-17, late)

Owner asked two things: justify the >=4-pt plays with a narrative + result, and confirm the
weekly ratings blend rather than over-react to one week. Answering the first exposed the leak.

**Gap split (power_ratings_explain.py).** For every 2025 game where the model was >=4 off the
opener, gap = (close - open) + (model - close). Top of the list: wk5 HOU@BAL opener BAL -9.5,
close HOU -2.5 (Lamar out), model HOU -0.5. wk16 KC@TEN opener TEN +11, close +3.5 (Mahomes
out), model +1.8. The model's "edge" on those games was the injury news the market had already
priced by T-60, inherited through its close_line/total/mkt_pts anchor. Across 2025 plays at
|gap|>=2: model ALSO beats the close by >=2 the same way -> 42.0% (n=50); gap is mostly the
close moving -> 69.5% (n=59).

**Anchor check (power_ratings_anchor_check.py), 2021-25 openers (2021-22 rebuilt from
odds_hist with build_odds.py's rule), same FINAL features, walk-forward:**

| setting | spreads >=2 | >=3 | totals >=3 | by year |
|---|---|---|---|---|
| A close-anchored, vs OPEN (reported) | 58.7% n=317 +38.1u | 56.8% | 60.4% | 58/65/54 |
| B close-anchored, vs CLOSE | 48.0% n=196 -16.6u | 46.9% | 54.1% n=37 | 48/55/43 |
| C OPEN-anchored, vs OPEN (production reality) | 53.8% n=208 +5.8u | 48.1% | 51.8% | 55/64/45 |
| D OPEN-anchored, vs CLOSE | 48.9% | 50.8% | 49.7% | 50/54/44 |
| no model: bet opener toward the close, move>=1 | 56.8% n=440 | 60.5% (move>=2) | | 59/57/54 |

Everything built on A is void: dose-response, weather modulator (honest: outdoor 55.6% n=54 /
dome 44.8% n=29), starter-QB-out subset, and the SIGNAL x POWER-RATINGS CONFLUENCE — re-run on
C: production sides_model align 59.1% (93) vs oppose 56.4% (78) vs neutral 52.0%; spot-rule
totals align 52.9% (17) vs oppose 61.5% (26). No validator effect. The 87.9% cell was CLV.
This is the violation named in memory nfl-backtest-grading-framework: close-line metrics ->
grade vs CLOSE. The composites remain a matchup description; they are not a bet.

**Blend audit.** FP units enter week w at (4 x prior + this season) / (4 + n): wk2 20%, wk5
50%, wk9 67% — one week cannot flip a rating. But the production CORE source
(nfl_pregame_advanced_team_week -> data/team_week.parquet) has `_s2d` columns that NEVER
reset by season through 2025 (Buffalo 2025 wk1 == 2024 wk18; 1,565 drives since 2018) and
then RAW single-season rows for 2026 (wk2 = one game: JAX ppd 3.78, BAL pass EPA 1.42, DEN
ppd 0.83). The first Week 2 2026 board fed those one-game values into a model trained on
8-season averages: CIN@HOU HOU +4.4, NO@BAL BAL -15.4, JAX@DEN DEN +4.2 were artifacts. Fixed by
build_team_week_seasonal.py (pbp -> true season-to-date, K=4 seeded, rows through last+1);
historical A/B was a wash (59.3 -> 59.7% spreads), so CORE was never doing much. The shipped
late-season-defense family in nfl_slate_games_build.py ranks on the same table: backtested on
the cumulative definition, live in 2026 on the raw one — needs re-validation on the seasonal
file before Week 4.

**Still standing:** the prop edges (pass TDs, pass yds, WR/TE receptions) — anchored and graded
on the same closing prop line; the ledger signals (graded by their own framework); the
production sides/totals model, untouched by any of this.

## PROP AUDIT — the props beat the line, not the price (2026-09-17, late)

Owner: "how do we know the props are even real?" Same battery as the power-ratings retraction
(prop_anchor_check.py), then ROI at real prices (prop_price_rebuild.py, prop_price_check2.py).

Structure is clean: feature line == graded line (T-60 close, last snapshot >= 60 min pre-kick),
recency features shift(1), no duplicate player-game-market rows, oracle grades 100%.

| spec | vs CLOSE (reported) | placebo (shuffled target) | OPEN-fed vs OPEN | line-only model |
|---|---|---|---|---|
| pass TDs thr.35 | 61.0% n=351 | mean 58.8%, max 64.8% — real beats 70% | 47.7% | 62.5% |
| pass yds thr20 | 56.8% n=400 | 48.8%, max 51.7% — beats 100% | 50.4% | 51.7% |
| WR/TE rec thr.7 | 56.7% n=365 | 52.7%, max 53.8% — beats 100% | 52.2% | 55.5% |

pass TDs is a base-rate lean: a shuffled-target model (= regress to the mean) gets 58.8% and a
model with no FP data gets 62.5%. pass yds and receptions are real vs the line, and only at T-60
(at the open they are 50-52%).

**Price.** The panel's over_px/under_px were MEDIANS OF AMERICAN ODDS across books (a +105/-115
split medians to -5; pass-TD over_px median was -4) with books on different lines pooled — the
earlier "price test" ran on garbage. Rebuilt: median implied probability across books posting
the consensus line, decimal payout (avg vig 6.8%). At those prices:

| spec | win | n | avg payout | breakeven | ROI | by season |
|---|---|---|---|---|---|---|
| pass TDs | 61.5% | 348 | 0.630 (-159) | 61.3% | -1.2% | +0.9 / -4.4 |
| pass yds | 53.6% | 181* | 0.871 | 53.4% | +0.2% | -1.6 / +3.1 |
| WR/TE rec | 56.5% | 363 | 0.800 (-125) | 55.6% | +0.0% | -2.0 / +2.7 |
| placebo | 52-58% | | | | -2 to -8% (the vig) | |

*pass yds: only 181 of 400 plays were at a line a book actually posted; the other 219 were
phantom half-lines from the median-of-lines construction and can't be priced.

The market has already juiced the side the model picks (85% overs at -125 on receptions, the
-159 side on pass TDs). The models recover the vig and nothing more. **No prop spec is
shippable.** Combined with the power-ratings retraction, nothing from the FP program today is a
bet; what stands is the data warehouse, the audit scripts, and the negative results.

## SCHEME PIPELINE — predict scheme, then production conditional on scheme (2026-09-17, late)

Owner's frame: (1) predict each side's scheme for the matchup from identity + opponent, (2) how
each side performs in / against that scheme, (3) roll up to points. Built on per-play data
(nflverse pbp + participation coverage/box/rushers 2022-25 + FTN blitz/box), market-free.

**Step 1 — scheme is predictable, modestly** (`exp_scheme_step1.py`, `exp_scheme_blitz_box.py`):
this week's share = identity + b × what the opponent pulls; walk-forward 2023-25. Out-of-sample
corr(predicted shift, actual shift): two-high/single-high .22 (b≈.6), man .11 (FP table) / .34
(per-play source), blitz .12, 5+ rushers .15, box-8 .15. Identity corr with actual .29-.45.
League-wide the mechanism is strong (defenses move .6 of the way toward what the offense invites,
t=13; offenses pass more vs two-high t=9). Josh Allen scrambles 7.0% vs man / 5.2% vs zone /
15.2% vs 2-man / 12.1% vs ≤3 rushers; blitz halves his EPA (+.25 → +.12) but he stays positive;
8+ box is the only thing that stops him (−.01, n=85). Defenses play him 42% man vs 31% league.
⚠ bug caught: entering() merge reset the index and mis-aligned every identity (fixed); on
scrambles nflverse lists the QB as RUSHER, passer null — filter on passer gives 0% scrambles.

**Step 2 — production conditional on scheme is DEAD at the data level** (`exp_scheme_step2.py`,
`exp_scheme_step2_checks.py`). Adjustment = Σ share_s × [(O_s − O_all) + (D_s − D_all)], entering,
K-seeded, deviations so situational selection can't leak as level.
  T1: corr(adj, residual) pass +.005 (t=.2), rush −.004; adding it LOWERS corr with actual
      (pass .288 → .211) because the pieces are noise.
  Reliability: (EPA in scheme − overall) split-half r ≈ 0 or negative for EVERY dim/level, both
      sides (shell −.08/−.11, man −.11/−.18, blitz −.09/+.02, box −.21/−.01); YoY same.
      200-400 plays per team-season per scheme does not identify a scheme-specific skill.
  Oracle: with the game's ACTUAL shares and K=4/8/16 shrinkage, still ≈0 (+.002/+.010/+.011).
  What survives is LEAGUE-LEVEL only: actual man share ↔ offense residual r=+.136, two-high
      r=−.132 (man gets beat, two-high suppresses); blitz and box ≈0. With predicted shares
      (corr .2-.3) that attenuates to ~.04 — not a per-game edge.
  T2: identity-only points model corr .30 with actual (market .415); (pred−market) vs
      (actual−market) ≈ 0 vs close and vs open.
VERDICT: "how does Buffalo do when it plays man / how does Detroit do against man" is not a
measurable team trait in this data; the number one would quote is noise. Scheme PREDICTION is
real and stays in the narrative layer (what shell/pressure to expect, what the QB does against
it). Scheme-conditioned MODELING is closed.

## THE POSITIVE RESULT — fix the production model's own season-to-date features (2026-09-17, night)

`exp_prod_plus_fp.py`, `exp_prod_fix_s2d.py`, `exp_prod_fix_s2d_robust*.py`. Same frame
(forecast_harness.build), same HistGBM/params, same walk-forward (train < season, wk>=4), same rule
(|p−.5|>=.03 at the OPENER), 5 seeds averaged. Only the feature list changes.

| arm | 2023-25 @.03 | @.06 | by yr | logloss |
|---|---|---|---|---|
| A production BASE | 53.0% n=681 +1.2% | 53.3% | 48/58/53 | .7209 |
| B + 9 FP matchup nets | 53.3% +1.8% | 54.9% | 50/54/57 | .7263 |
| C + all 50 FP units | 52.3% | 51.7% | 47/53/57 | — |
| D2 + TRUE season-to-date nets (pbp, K=4) | **55.9% n=673 +6.7%** | **57.4%** | 50/59/58 | **.7197** |
| E D + FP nets | 52.1% | 54.7% | | .7307 |

Permutation importance on arm B: the #1 feature was the correctly built seasonal points-per-drive
net; production's own net_ppd_s2d (cumulative-since-2018) ranked 8th. FP adds nothing on top of the
fix (E < D2) and the 50-unit dump hurts — the feature-bloat law held all day.
Robustness: leak screen ok (line corr .35-.83 >> result corr .15-.34); placebo (shuffled true nets)
52.6% mean, max 53.8%; vs CLOSE 54.2% vs 52.2%; flips (67 games where D2 takes the other side) 64.2%;
bootstrap D2−A +2.8 [+0.1, +5.4] p=.02; K sensitivity K2/4/8/16 = 54.0/55.9/54.1/53.6 (all > A, K=4
is the pre-set constant but also the peak); 2022 extra fold (openers rebuilt from odds_hist) A 52.8
→ D2 54.0; pooled 2022-25 A 53.0 → D2 55.4 (+5.8% ROI) / K-ensemble 54.5 (+4.0%), ensemble−A +1.6
[−0.8, +3.8] p=.087. HONEST SIZE: +1.5 to +2.5 pts of hit rate, 4/4 folds in the right direction,
marginal significance. It comes from FREE play-by-play, not the FP purchase. Ship candidate; needs
the weekly pbp→team_week_seasonal build in the live pipeline. Totals (b15/b55) untested — same
defect, next.

## SHIPPED — sides model + true season-to-date nets (2026-09-17, night). TOTALS NOT shipped.

**Totals (`exp_prod_fix_totals*.py`)**: b15 + true sums looked good at K=4 (3-7 HC band 52.7% →
57.4%, ensemble 51.3% → 59.6%) and then failed every robustness gate: K=2/8/16 = 55.5/52.3/52.8,
vs CLOSE 48.3% (the lift is line movement), 2022 fold 44.1% vs A 52.3%, bootstrap CI [−2.7, +12.4]
p=.105, placebo max 54.4. b55 unchanged (52.8 vs 53.1). Totals stay as locked.

**Sides — shipped:**
- `refresh_pbp_current.py <season>` pulls nflverse pbp for the prior + current season into
  `data/pbp_cache/_pbp<season>.parquet` (Render disk is ephemeral; ~60 MB/run; fails soft).
- `build_team_week_seasonal.py` reads `_pbp*` too, dedupes by play, emits rows through the season's
  last played week + 1 for EVERY team (bye-safe). Fresh-disk simulation matched the full build to 3e-5.
- `forecast_harness.build()` merges the 4 true nets (pass/rush EPA, pts-per-drive, PROE; home−away,
  offense + opponent-defense-allowed) and appends them to BASE; NaN columns if the file is missing.
- `run_nfl_week.sh`: two guarded steps after fetch, before the master frame.
- `data/sides_models_2026.pkl` retrained locally on 2018-25 with the 58-feature BASE (old pkl kept as
  `.pre_true_s2d_2026-09-17.bak`); the week-2 ledger was NOT regenerated (games under way). Live
  from the next Render run once committed — the pkl is git-tracked, the parquets are not.

## EXHAUSTIVE SEARCH — FP data as model input, pre-registered (2026-09-17 night; fp_exhaust.py, fp_exhaust2.py)

Protocol fixed before results: SEARCH = 2022-24 folds; HOLDOUT = 2025 touched once; NULL = identical
greedy search on shuffled targets ×3; metric = log-loss (primary), hit@.03 vs opener (secondary);
base = production BASE + true s2d nets (what ships). Bank: every rate column of every FP team/opponent
table (132 → 81 reliability-gated) in 4 forms (level / net / matchup / last-3 form) = 30 families;
wave 2 added tendency (13 situational pass rates), PROE, fantasy-pts efficiency + matchup + explicit
products, STARTER-KEYED QB rates, and a margin-regression target. 5 models (production HGB, shallow
HGB, logistic, random forest, blend). ~350 configurations.

| | search-window gain (log-loss) | null search gains (3 shuffled reps) | 2025 holdout |
|---|---|---|---|
| wave 1 best: BASE + pass:matchup + recv_O:net | +0.0027 | +0.0052 / +0.0030 / +0.0034 | WORSE (0.6909 vs 0.6888; hit 50.6 vs 54.5) |
| wave 2 best: BASE + tendency:form + qb:net + pass_D:net | +0.0034 | +0.0058 / +0.0013 / +0.0041 | WORSE log-loss (0.6903 vs 0.6888); hit 55.5 vs 54.5 n=146 |

No family improved log-loss on ≥4 of 5 models in either wave. Level forms hurt everywhere (feature
bloat). Random forest is best-calibrated but its probabilities are compressed (hit ~50% at .03, half
the plays) — production HGB stays. VERDICT: the best the search can find is indistinguishable from
what it finds on shuffled targets, and it does not hold on the holdout. Adding more configurations
only raises the chance maximum. The FP data is closed as a sides-model input. Content layer stands.

## APPENDIX — sections from the earlier committed snapshot (main, 2026-09-17 midday) not in the later doc
(kept verbatim so the merge loses nothing; the prop verdicts here were superseded by the PRICE AUDIT above: RB receptions / QB rush yds were never re-tested at matched prices)





















## ★ DISTILLED PROP MODEL (2026-09-17) — the approach that finally worked
exp_prop_distilled.py: per-player engineered composites (route/target share, TPRR,
YPRR, slot/wide/backfield%, aDOT, first-read, design%, separation, sep-wins) +
player×defense MATCHUP interactions (sep×man, slot×zone, deep×two-high, wide×man,
backfield×two-high) + opportunity + line, ridge λ40, walk-forward, over/under vs close.
RESULTS (dose-response):
  ★★ RB RECEPTIONS: 54.7/56.4/57.7% @4/8/12% edge, z+2.6; per-season 56.2%/56.4% STABLE.
     = owner's checkdown/two-high/RB-receiving thesis, validated. THE prop win.
  ★ WR/TE receptions: 53.3/54.2/56.3% pooled but 2024 50.6% / 2025 54.2% — candidate, 2024 soft.
  ✗ reception YARDS: ~49% (efficiency-driven, market efficient — don't bet).
LESSON: volume markets (receptions) beatable via distillation; efficiency (yards) not.
Single cells missed it — edge is DISTRIBUTED across dims, only the regularized combo finds it.
Same architecture as sides v3/v4. NEXT: rush attempts/yds distilled; pass TDs; wire RB-recs.

## QB PROP MARKETS (2026-09-17, distilled) — all 6 tested
exp_prop_qb.py. QB composites (cpoe/acc/adot/deep/hero/sack/poe/ttt/firstread/
checkdown/scramble) + opp coverage+pass-rush + matchup interactions + line, ridge WF.
  ★ QB RUSH YDS: 55.5/55.7/56.4% @4/8/12%, z+2.2, dose-response. THE QB edge (mobile
    QB rushing = stable identity market underprices). 
  ~ pass_yds: 55.5% @8% (z1.4) non-monotone — modest candidate.
  ✗ pass_tds 52.8% (weak), completions ~50%, attempts 48% (negative) = efficient.
PATTERN CONFIRMED: market prices marquee markets tight (pass yds/tds/att, rec yds),
leaves edges in secondary volume/mobility (RB recs, QB rush yds).
⚠ DATA: panel close_line only 2024+ → ~1.5 clean test seasons. Rebuild 2023 close from
props_rows (snapshot warehouse) for a 3rd validation season before trusting borderline.

## DOSSIER → POINTS: the two gates (2026-09-18)

`team_dossier.py TEAM` (8 sections, every unit, league percentiles) and `cross_dossier.py AWAY HOME`
(unit-vs-unit stacked EPA by coverage type / man-zone / shell / blitz / rushers / box / play action,
share-weighted by the defense's identity; receivers by route/alignment/coverage vs the defense;
QB pts/dropback by the defense's coverage mix; line vs rush). Built BUF and LAC, crossed for wk3.
The share-weighted stacked shift IS the "adjusted value" the owner described (LAC −.034/db ≈ −1.3
pts, BUF +.018 ≈ +0.6).

**Gate 1 — reliability of within-look deviations (`exp_cross_reliability.py`, 2022-25):** coverage
type ×7, rushers, play action, motion, box (pass and run), offense AND defense: split-half r all
between −.22 and +.20, none ≥ .30; YoY same. FP QB-by-coverage: Man .06, Cover2 .21, Cover3 .26,
Cover4 .19. Overall offense LEVEL split-half .60 (a real trait); defense level only .14. A team's
production inside a look, relative to itself, does not persist half-season to half-season.
**Gate 2 — opponent-ADJUSTED levels (`exp_prod_opp_adjusted.py`):** ridge off−def+home per week,
walk-forward, prior season half weight. Into the shipped model: A 55.4% → F (+adj nets) 54.0% →
G (adj replaces true) 54.4%; F−A −1.3 [−3.4, +0.9]; corr(adj, unadjusted true net) .82. No gain.
VERDICT: the dossier/cross layer is content and scouting; it cannot be converted to points because
the interaction terms are not estimable at 17 games/season and the level terms are already in
production (the true-s2d fix captured that gain).

## PROPS AT PRICE, CORRECTED — two markets survive with best-book execution (2026-09-18)

The 09-17 "dead at price" verdict was an artifact of the STRICT price set (plays where every book
posted the same consensus line). Reconciliation (`exp_prop_price_reconcile.py`): pass_yds thr20
strict subset 53.6% (n=181) vs the plays where books DISAGREED 59.4% (n=219). Book disagreement
= market uncertainty = where a model can be right; the strict filter removed exactly those.
BEST-BOOK execution (most favorable line among books posting at T-60 in the model's direction, at
that book's own price — coherent line+price, the bet you place):

| market | thr | win | n | ROI | 2024 / 2025 | sides | placebo @best-book | blanket base rate |
|---|---|---|---|---|---|---|---|---|
| pass_yds QB | 20 | 57.0% | 400 | +7.6% | +7.4 / +7.8 | OVER +5.8 (320), UNDER +14.6 (80) | −4.1% | OVER −0.4, UNDER −7.2 |
| reception_yds WR/TE | 12 | 58.0% | 312 | +9.6% | +6.6 / +21.1 | 99% overs | +1.1% | OVER −2.9 |
| pass_completions QB | 2.5 | 58.4% | 173 | +8.9% | +0.4 / +32.2 | | −5.7% | one-season mirage, NO |

pass_yds holds at thr 10/15/20/25 (+7.3/+6.5/+7.6/+8.0), fair-price subset (−115 or better) +8.6%,
both sides profitable — SHIPPABLE at T-60 (at the open it is ~50%). reception_yds is one-sided and
2025-heavy — CANDIDATE. Everything else stays dead at price. `data/fpdata/_prop_price_deep.parquet`.
Execution needs: T-60 pull of every book's line (props_rows already captures it), pick the best line
in the model's direction, stake at that book. score_slate_props.py currently prices at consensus.

## PROPS, FINAL — five markets at best-book with DNP removal and teammate-injury context (2026-09-18)

Owner's two objections were both right and both testable. (1) DNP: no lined player was himself
Out/Doubtful (T-60 lines exist only for actives); ~73 of 19,249 rows had zero snaps and zero stat —
now no-action. (2) Teammate injuries: never a feature. Built `CTX` = entering target / carry /
attempt share of same-team Out/Doubtful WR-TE / RB / QB that week + skill count
(exp_prop_injury_context.py, from data/injuries_raw.parquet, 3,771 team-weeks with a skill Out).

| market | thr | feats | win | n | ROI | 2024 / 2025 | placebo | blanket O / U | λ x0.5 / x2 |
|---|---|---|---|---|---|---|---|---|---|
| pass_yds QB | 20 | +CTX | 58.2% | 390 | +9.8% | +8.6 / +11.9 | −2.6 | −0.4 / −7.2 | +9.3 / +8.4 |
| pass_completions QB | 1.0 | +CTX | 59.9% | 531 | +11.9% | +4.9 / +21.0 | −6.4 | −4.4 / −0.3 | +7.9 / +11.5 |
| receptions WR/TE | 0.7 | base | 58.9% | 423 | +6.7% | +6.6 / +6.9 | +0.6 | −4.7 / −2.6 | +4.6 / +5.6 |
| reception_yds WR/TE | 12 | +CTX | 56.9% | 487 | +7.3% | +5.7 / +11.1 | +1.4 | −2.3 / −4.3 | +5.3 / +7.2 |
| rush_attempts RB | 1.8 | base | 57.9% | 278 | +7.4% | +10.4 / +3.8 | −4.1 | −9.9 / +2.2 | +8.9 / −0.4 |

CTX helps the QB markets (+2 pts pass_yds, +2.4 completions) and hurts receptions; the "teammate
out → over" subset alone is ~50-56% (not a standalone edge). rush_attempts is lambda-fragile →
candidate. pass_attempts, RB receptions, rush_yds, pass_tds stay out. Volume ≈ 11 + 14 + 11 + 13
plays/week. All T-60, best-book. Live wiring: score_slate_props.py needs CTX (from nfl_injuries_raw
ESPN feed) and best-book selection from the per-book props snapshot.

## PROPS — STRICT HOLDOUT VERDICT (2026-09-18 evening)

Everything above chose thresholds/lambdas/feature sets looking at 2024 AND 2025. `exp_prop_holdout.py`
selects on 2024 only (train 2023) and scores 2025 blind; the same selection on shuffled targets (3
reps) is the null. `exp_prop_holdout_audit.py`: best-book is not a stale-line artifact (gaps tiny,
book mix balanced, blanket O/U at best book negative both seasons; 2025 completions blanket UNDER
+4.0% is the one market lean).

| market | 2024-chosen config | 2024 | 2025 HOLDOUT | null 2025 | verdict |
|---|---|---|---|---|---|
| pass_completions QB | lam60 thr1.0 wide +CTX | +4.9% n=299 | **65.1% n=232 +21.0%** | −7.3/+0.3/−1.0 | REAL (every grid cell +16..+43% on 2025; holds at consensus −110) |
| pass_attempts QB | lam600 thr1.5 +CTX | +2.4% | 56.2% n=144 +5.5% | −6.5/−2.7/−5.1 | weak pass |
| receptions WR/TE | lam200 thr0.7 narrow | +6.6% | 60.0% n=185 +6.9% | +4.5/+3.8/+3.5 | marginal (~+2.5 over a mean-reversion null) |
| pass_yds QB | lam600 thr20 +CTX | +12.3% | 52.1% n=94 −1.5% | −16.6/−6.3/−17.7 | FAILS (lam60 was +8/+12 but chosen on both years) |
| rush_attempts RB | lam60 thr1.8 narrow | +15.4% | 50.5% n=107 −6.5% | negative | FAILS |
| reception_yds | thr18 selected → n=3 | | inconclusive | +2.9/+4.6/+3.7 | unproven |
| rush_yds, RB receptions | | | ≈0 | | fail |

Honest state: ONE market survives pre-registration cleanly (completions, season-variable: 2024
+5%, 2025 +21%), one weakly (attempts), the rest are in-sample selection. The earlier "five
markets" table is the in-sample view and is superseded by this one.

## PLAY-LEVEL MODEL v1 (2026-09-18 night, playlevel_model.py) — replicates the market, does not beat it

137,379 REG plays 2022-26 (dropbacks + designed runs) with look tags (coverage type/man-zone/shell
57% tagged; box/rushers/blitz/PA/motion ~100%) and ENTERING-WEEK FP profiles attached per play:
30 offense cols (18 gated units + CORE + tendencies + starting-QB FP passing profile), 22 defense
cols (units + coverage identity shares + box/blitz/rush5/man), 13 matchup differentials.
HistGBM on EPA/play, train 2022-24, HOLDOUT 2025, nested feature sets:
  context .0069 | +look .0066 | +profiles .0085 | +look+profiles .0070   (R², all plays)
EPA per play is ~99% noise; profiles add ~+0.002 R² at most; top features are man/zone and rushers
(in-game info), then down/distance. Roll-up (neutral contexts, integrating over the defense's
entering look shares): net rating correlates .69 with the OPENER and .31 with the margin, but with
the margin−opener residual only +.07 (2024 +.17, 2023/2025 ≈0); margin ~ opener + net: t = 0.79,
1 sd of net = +0.5 pts beyond the opener. Bets vs opener 50.7% (|edge|≥1, n=347). Into the
production sides model: 58.8% → 58.0%. VERDICT: v1 reconstructs the closing line from the same
inputs the market uses; no information beyond it. Limits: 57% coverage tagging, no per-play target
receiver, no hierarchical shrinkage. A v2 (pass plays only, targeted-receiver profiles, success/
yards targets, shrinkage) is the remaining untested variant; expected gain is small.

## PROPS — ALL CONFIGS, NO SELECTION (2026-09-18 night, exp_prop_config_robustness.py) — supersedes both prior verdicts

Owner: "how did you get 55% everywhere and then say it's all dead?" Because both answers were
single-config views: the first chose the best of 18 configs looking at both seasons; the strict
holdout chose the best on 2024 alone (one draw). The unbiased read is the share of ALL configs
profitable in each season at best-book:

| market | configs | 2024 %>0 / median | 2025 %>0 / median | both>0 | verdict |
|---|---|---|---|---|---|
| pass_yds QB | 16 | 100% / +7.6% | 81% / +6.9% | 81% | ROBUST — ship |
| reception_yds WR/TE | 24 | 92% / +2.9% | 79% / +2.5% | 71% | robust, small — ship-lean |
| pass_completions QB | 14 | 43% / −1.3% | 100% / +22.1% | 43% | real in 2025, flat 2024 — ship reduced |
| receptions WR/TE | 30 | 30% / −2.3% | 100% / +7.3% | 30% | 2025-only — candidate |
| pass_attempts QB | 12 | 25% / −3.5% | 100% / +9.1% | 25% | 2025-only — candidate |
| rush_attempts RB | 36 | 50% / +0.3% | 36% / −0.9% | 19% | no |
| rush_yds RB | 24 | 0% | 58% / +0.6% | 0% | no |
| receptions RB | 28 | 29% | 54% / +0.7% | 18% | no |

pass_yds' single 2024-best config that lost in 2025 was one of the unlucky 19%; 13 of 16 configs
were profitable both years. Lesson recorded: judge a market by the distribution over configs, not
by any one pick.

## TARGET SHARE MODEL (2026-09-18 night, target_share_model.py) — the owner's "reverse-engineer why" question, answered

16,796 WR/TE/RB player-games 2021-26 (>=8 routes; weekly target share verified = site export
1,119/1,119). Target = this game's target share. 55 pregame features in 6 groups. Walk-forward.

| features | 2023 R²/MAE | 2024 | 2025 |
|---|---|---|---|
| entering share (baseline) | .334 / 5.37 | .310 / 5.53 | .306 / 5.48 |
| last-3 share | .353 / 5.49 | .332 / 5.69 | .312 / 5.67 |
| PLAYER (role: route share, first-read share, aDOT, yprr…) | .410 / 5.19 | .392 / 5.28 | .409 / 5.14 |
| +PECKING (share/number of teammates above him) | .405 | .400 | .414 |
| +INJURY (teammates out above/below, QB out, QB change) | .414 | .402 | .416 |
| +TEAM +OPP +GAME (all 55) | .413 / 5.19 | .409 / 5.21 | .416 / 5.09 |

WHY (permutation, 2025): PLAYER .148, PECKING .055, INJURY .003, TEAM .0004, OPP .0001, GAME .0001.
Top: last-3 route share .063, n_above .039, first-read share .028, last-3 tsh .023, entering tsh .022.
Partial effects (share pts): teammate ABOVE him out (20% share) +0.27 (a vacated 20% spreads across
the whole corps); teammate below out 0; starting QB out 0; QB change 0; −7 fav → +7 dog +0.02;
opponent man 15→40% −0.07 (WR); two-high 35→65% −0.05; pressure over expected 0; +6 sep allowed at
his alignment +0.02. => Target share is ROLE (route share, read order, pecking) + noise; the
opponent, the script and the QB barely move it; injuries move it a fraction of the narrative.
~59% of weekly variance is in-game.
PAYOFF (all-configs, best-book): receptions WR/TE both-seasons-positive configs 53% → 67% with
pred target share (2024 median +0.1 → +1.6, 2025 +6.9 → +4.9); reception_yds no change (58%);
RB receptions no. Modest, real-looking help on receptions only.

## WEEKLY PLAYER BRIEFS — the product (2026-09-18 night)

Owner's spec (the St. Brown chain) is now a weekly pipeline:
- `player_dossier.py "Player" TEAM OPP --asof S W` — the long-form single-player report (7 sections).
- `player_chain.py` — the chain as a function keyed by FP player id (same-name players exist:
  two Justin Jeffersons in 2026 wk1); returns structured calls + the compact brief.
- `gen_player_briefs.py S W [--all]` — every receiver with a receptions/rec-yds line on the unplayed
  games (nfl_player_props × nfl_slate_games), name+team → FP id; writes
  `out/player_briefs_SwW.md` (grouped by game) and `data/fpdata/_chain_calls_SwW.parquet`.
  Week 2: 139/139 lined receivers matched, 130 briefs.
- `grade_player_briefs.py S W` — after the Tuesday FP pull: share direction, depth direction,
  primary alignment, coverage shift, pressure shift, and over/under the posted lines; appends to
  `data/fpdata/_chain_grades.parquet` (running track record).
Week-1 loop test (28 players, as-of week 1, base 2025): alignment call right 83%, coverage moved
toward the opponent's identity 100%, pressure moved as expected 80%; share direction 11% and depth
18% — the "flat within 2 pts" band is far tighter than weekly share noise (sd ≈ 5.5 pts), so
those two calls need a noise-aware band before they mean anything. Consistent with the
target-share model: role and structure are predictable, week-to-week share direction from
coverage is not. Do not widen the band to fit results; set it from the noise (±1 sd) up front.
Data notes: FP week rows land Tuesday/Thursday (fp-data-inseason), so Sunday briefs use the
Thursday pull; per-play coverage for the current season lags nflverse publication (FTN covers
blitz/box); 6 same-name player collisions in 2026 wk1 handled by id keying.

## Reception Perception paper (owner, 2026-09-18) — replicated, does not move the prop models
Harmon & Scott 2022 (RP charting, 308 WR-seasons, player+year fixed effects): success vs man +1.56%
yds/game per point, vs zone +0.59%; zone's effect doubles for slot-heavy receivers; man's is constant.
`exp_rp_coverage_success.py` re-runs the same panel on our FP data (420 WR-seasons 2021-25, FP
separation score vs man/zone as the success analog, player+season FE):
  - both coverage terms positive and significant (man t=4.4, zone t=4.9 on yards/game); slot
    interaction reproduces (zone effect +1.4% at 10% slot -> +2.4% at 70% slot; man ~flat)
  - our zone term is LARGER than man (opposite ordering) — FP separation vs zone is a lower-mean,
    lower-variance number than RP success, so "per point" is not on the same scale; the ordering
    is not comparable, the structure is
  - routes/game dominates everything (+5%/route, t=19-24) — volume, same as the target-share model
Matchup efficiency prior (p_man(opp)*sep_man + p_zone(opp)*sep_zone*(1+slot), K=4, plus a
yards/route version and a man-skill×man-faced gap) added to the prop models, all configs, best-book:
  reception_yds  both-seasons-positive 58% -> 50% | receptions 53% -> 40% | pass_yds 81% -> 88%
Noise both ways. Verdict: real description of WHO produces at the season level, already in the
posted line at the game level. Same shape as every other FP finding. Keep as brief content, not model input.

## Tail test — can the prop model sort the board? (owner reframe, 2026-09-18)
`exp_prop_tail.py` (+ `--null SEED`) and `exp_prop_tail_vs_null.py`. Weekly cross-market ranking by
edge vs best book (market-scaled); slices of the week's board; three stacks (base / +CTX / +FP);
shuffled-target nulls keep everything except the labels the model learned from.
  - extreme top 2% LOSES in every stack both seasons (low-line, juiced overs, 2x DNP rate)
  - 2-10% band wins 55-58% both seasons... but the NULL wins the same band in 2025 (57-59%):
    2024 model adds +4..+6 pts over null; 2025 adds -1..0. Consensus slice (top-10% under all 9
    settings minus top-2%, ~12/wk): real 54.4% / 58.2% vs nulls ~50% / 55-59%.
  - tail is ~90% overs. FP stack = base stack within noise.
Verdict: the sorting is not separable from a labels-free line-gap ranking across both seasons.
The model helps in 2024, not 2025; the line-gap effect helps in 2025, not 2024. Neither is a
shippable "these props are more probable" rule on two seasons. Do not present the tail as an edge.

## Stepwise bottom-up, STEP 1 = the run game (owner, 2026-09-18) — `exp_stepwise_run.py`
Team rushing advanced (zone vs man/gap concept success, stuffs, MTF, YBCO) offense × defense-allowed,
K=4-seeded entering values, walk-forward 2022-25, one row per team-game (2,540).
  - predicting THIS game's rush success: own+opp r=+.15..+.22 per season (single-game noise ceiling ~.35);
    the concept-matched split adds NOTHING over own+opp (r +.10..+.23); stuffs/YBCO/MTF add ≤.02.
  - does the run-game expectation move points past the CLOSE?  r with team-pts residual −.03..+.07,
    with margin residual −.04..+.09; top/bottom-decile bet 41-55% by season (chance).
Verdict: the run facet is predictable exactly as far as teams are stable, and the market has that.
STEP 2 (usage) / STEP 3 (expected points per facet) not built — step 1b fails the gate that would justify them.

## Facet composite → points (owner, 2026-09-18) — `exp_composite.py`
Six facets per team (pass off = passer rating, pass def = rating allowed, rush off/def = success %,
O-line = pressure allowed + YBCO, D-line = pressure generated + stuffs), entering-week K=4 seeded,
z-scored across the league each week; TEAM = OFF + DEF; gap = home − away. 1,017 games 2022-25.
  - one unit of gap ≈ +3.2 pts of margin (r=.30). The closing LINE moves +2.9 pts per unit (r=.66):
    the market prices this composite almost exactly, and better than the composite predicts results.
  - residual vs close r=+.02 pooled (2024 +.12, 2025 −.06); betting the better composite at any
    threshold: 47-49% vs close pooled, 39-42% in 2025.
  - totals: +1.7 pts per unit on the actual total, +1.8 on the line, residual r≈0; over/under bets 50%.
  - facet weights the market uses: pass offense dominates (r .67 with the line); rush defense and
    D-line stuffs ≈ 0. Decile table: gap decile 10 → margin +9.7 vs line +8.6; decile 1 → −4.2 vs −4.9.
Verdict: the composite is a good description of team quality and the line IS that composite. As a
model input it is redundant with the opener. Useful as a plain-language explainer of the line.
Confluence at the OPENER (`exp_composite_confluence.py`, 2023-25, clean model): model alone at conf≥.06
57.0% (n=474); model+composite AGREE 55-56%; DISAGREE → model side 55%, composite side 45%; composite
alone 49%; model-under-floor rescued by composite 46%; all-three-agree 57.8% (n=156) = model alone.
The composite neither confirms nor filters the model. Closed.
Variants (`exp_composite_variants.py`): 28-facet composite tracks the closing line at r=.70 (six-facet .63)
— built right — with residual vs open r=.05; weights fitted to margin r(resid)=.055; weights fitted DIRECTLY
to the opener residual (walk-forward): out-of-sample r=−.035, top-quintile bets 58%/38%. No build of a
team-quality composite has anything the opener lacks. Closed for good.

## Three-stage matchup (owner, 2026-09-18) — `exp_three_stage.py`
Stage 1 strategy: an offense's pass rate vs its own norm moves < ±1.6 PROE pts across every defense
scheme × tier cell, no consistent direction; run-defense tier GOOD +0.4 / BAD −1.0. Predicting this
game's pass rate: own tendency r .28-.36; + scheme +.00; + quality +.01-.03.
Stage 2 efficiency: pass YPA vs cell ±0.2; rush success −1.7 pts vs GOOD run D, +1.1 vs BAD (real, small).
Predicting this game's YPA: own norm r .24-.27; + opp D ≤ +.03; + scheme +.00; + own-history-vs-cell +.00.
Stage 3 expected points (usage × pass eff × rush eff, both teams): r with actual total .18-.20, with the
LINE .66-.70, residual −.03..+.01; spread r actual .30-.37, line .74-.78, residual .00-.09. Bets: totals
46-59% by season, spread vs opener 44-54%. Same verdict as the composite: it rebuilds the line.

## Study A — in-season regression / luck (owner, 2026-09-18) — `exp_luck_regression.py`
Ten facets (pass eff, YPA, rush success, pressure, pass D, run D, points-over-yards luck, turnover
margin, spread miss, margin), norm = K=4-seeded s2d EXCLUDING the last 2 games, deviation in sd.
(1) The bounce: after a VERY COLD game every facet is still BELOW norm the next game (−0.18 to −0.31 sd);
after VERY HOT still above (+0.15 to +0.32); r(last, next) +.10 to +.19. Regression toward the norm
happens; it never overshoots. Streaks persist mildly — the opposite of "unlucky team excels next week".
(2) Market: residual by bucket ±1 pt, sign flips between last-1/last-2 and open/close. Bets: back very
cold / fade very hot 42-62% by season, nothing consistent; best pooled cell (back a torched pass defense
vs open) 55.3% n=208 but 48/45/56/59 by season vs close. Totals: cold offense → over 41/38/62/52.
Verdict: no luck/regression edge in team facets; the market already discounts one bad week.

## Study B — familiarity (owner, 2026-09-18) — `exp_familiarity.py`
Per-play frame 2022-25 (pbp + FTN + participation): offense/QB exposure to blitz-heavy, 5+-rusher, man-heavy
defenses (dropback-weighted, prior games; QB across seasons) vs a HIGH-style opponent; defense exposure to
run-heavy / play-action-heavy offenses.
  - QB-level: unfamiliar QBs vs blitz/5+/man run 0.1-0.2 sd below familiar ones pooled (EPA vs own norm),
    but the sign flips by season (2022/2024 unfamiliar NOT worse); continuous walk-forward r −.07..+.16.
  - team-level: nothing (±0.05 sd).  ATS/UNDER bets vs close and open: 32-67% by season, no cell repeats.
  - defense unfamiliar with run-heavy offenses allowed +0.28 sd vs norm (familiar +0.10), direction holds
    3 of 4 seasons on the field; fade-D ATS 48/55/50/48, OVER 50/42/54/57. Play-action version: nothing.
Verdict: a faint, real on-field familiarity effect at the QB and run-defense level; zero against the line.

## SHIPPED — Featured Matchups in the NFL regression report (owner spec 2026-09-18)
`nfl_matchup_facts.py` scores every unplayed game on how many INDEPENDENT things are telling — Fantasy
Points / charting matchup facts (passing-game shift by coverage look ≥0.10, trench mismatch, QB vs this
coverage mix ≥15%, run game by box, QB familiarity with blitz/man-heavy defenses) and internal facts
(model play, active signals, weather, referee trend, Out/Doubtful) — keeps the top 4 with ≥2 matchup
tells and ≥1 internal tell, and writes a deterministic fact sheet per game to `nfl_matchup_facts`
(direction = aligned / tension / no model play / matchup even). `gen_nfl_regression_report.py` reads
the table into 'matchups' storylines (rank 5, quota 4) and the narrative LLM opens the report with a
"Featured Matchups" section, 120-180 words per game, no picks. Runs on the fp-data-inseason Render job
(Tue/Thu) after the pull; six lean FP parquets are git-tracked under data/fpdata_hist and merged with the pulled data.
Web: FootballRegressionPage renders the family with top billing. First run: 2026 week 2 (GB@NYJ aligned,
MIN@CHI even, NYG@LAR tension, NO@BAL no model play).

## SHIPPED — Player Prop Report (owner spec 2026-09-18)
`nfl_prop_narratives.py` evaluates every posted line on nfl_slate_props (receptions, receiving yards,
rush yards/attempts, pass yards/completions/attempts; QB rushing and non-QB passing excluded) and
gathers directional tells: receivers = player_chain route stack / coverage-identity yards-per-route
shift / target-share direction / alignment stack / pocket effect; QBs = QB vs this coverage mix,
trenches; backs = run-concept stack, before/after contact vs the front; everyone = last-5 vs line,
defense allowed to the position vs league, teammate Out/Doubtful share, QB out, DNP, game script from
the model spread, game-model total gap. Keep ≥3 tells one way and net ≥2; one card per player; quotas
QB 3 / WR-TE 5 / RB 3; max 10. Writes `nfl_prop_narratives` (replaces the week) with summary + markdown
rundown ("the numbers point toward the OVER — a read, not a pick"). Web: /nfl/regression-report/props
(PropNarrativesPage: headshot, logos, market + line + best over/under book, position filter, expandable
numbers); button on the NFL regression page header. Runs on fp-data-inseason after matchup facts.
FP tables it needs are tracked under data/fpdata_hist (fp_hist.read_fp merges hist + pull).
Graded like every prop card: grade_nfl_prop_narratives.py (grade_week.sh step 4c) sets actual_value / result from
nfl_player_props actuals; the page shows the season record and graded reads. Not yet in it: the prop MODEL projection — the live scorer
is not wired; add as a 'model' tell when it is. First run 2026 wk2: 467 props → 81 qualified → 10 shown,
9 over / 1 under (the tell set skews over: form-above-line and defense-allows fire more than their unders).

## Prop MODEL projections wired (2026-09-18) — `score_props_week.py`
Generalized the one-off wk2 scorer: board from nfl_player_props (consensus line, ≥2 books), spread/total
from nfl_slate_games, FP state carried forward (K=4, never joined on the unplayed week), season-to-date
szn/l3/l5 from the FP per-game tables, training = prop_engine's 2018-25 panel. Frozen configs: pass_yds
(λ60, thr 20), completions (λ60, 1.75), pass_tds (λ200, 0.35), receptions WR/TE (λ200, 0.7), rec_yds
WR/TE (λ200, 12), receptions RB (λ600, 0.7), rush_attempts RB (λ200, 1.8). Every projection is written
to `nfl_prop_model_preds` (parquet copy data/_prop_preds_SwW.parquet); nfl_prop_narratives.py adds a
'model' tell (weight 1.5) when the edge clears the market's threshold and shows the projection as
context otherwise. prop_engine.py now reads through fp_hist.read_fp (its FP inputs are tracked under
data/fpdata_hist) so the scorer runs on the fp-data-inseason job before the narratives.
Wk2 first run: 244 projections, 29 clear thresholds; the board went from 9 over / 1 under to 7 / 3
(Daniels completions UNDER 4/4, Geno Smith pass yards UNDER).

## One market, everything — PASS COMPLETIONS (owner, 2026-09-18) — `exp_completions_deep.py`
1,773 QB completions lines 2023-25 with 9 families (line, form, QB, team, opponent, receiver corps,
game context incl. total/spread/wind/temp/precip/dome/divisional/rest/primetime, QB play-by-play
splits × opponent tendency, injury context) and a per-QB shrunken residual.
  - ACCURACY: nothing beats the line. Line-only MAE 4.51 / 4.45 (2024 / 2025); every added family
    keeps or raises MAE (full stack 4.87 / 4.45). Drop-one on 2025: every family within ±0.05 MAE.
  - PLAYER-SPECIFIC residual: r .21→.26 (2024), bet 63.4→66.2% (2025) but 51.6→49.7% (2024). Noise.
  - PARTIAL EFFECTS vs the line (pooled): wind 18+ → −2.3 completions (n=67); short rest → +1.1
    (n=127); man-heavy opp −0.4; ≥15% WR/TE share out −0.4; spread NOT monotonic (fav 7+ +0.1,
    dog 7+ −0.6) — the blowout-runs-more story does not show in completions vs the line.
  - THE BET: 2025 63-65% at ≥1.75 for every stack, 2024 ~50% for every stack — the market's 2025
    miss is real and stack-independent; the frozen config (λ60, engine SETS) is as good as any
    (53.3%/229 −0.0% · 65.1%/146 +20.5%); "full minus context" is the only stack profitable in 62%
    of configs both seasons (context features add noise to ridge in 2024).
Verdict: completions is a line-efficient market; the extra families describe completions but the
line already carries them. Keep the frozen config; use wind/rest/man/injury as sheet context.
Rule check per season: wind ≥18 mph → completions UNDER 53.8%/26 · 100%/9 · 83.3%/30 (avg actual−line
−0.7 / −3.3 / −3.4) — small, direction holds, candidate to paper-track; wind ≥15 50/55/70; short rest
→ OVER 59/54/50 (fading); man-heavy → UNDER 52/52/56; WR/TE 15%+ out → UNDER 52/56/53. Only wind ≥18 survives.
Per-QB regressions (`exp_completions_player.py`, 12 factors, walk-forward, own games ≥12): every
per-player form is WORSE than the line and the universal fit — own slopes MAE 4.9-5.8 (line 4.5),
mixed (league slope + QB deviation) 5.2-5.7; bets 48-58% by season with no λ stable across both.
BUT the individual tendencies are real: split-half stability of per-QB slopes r=+.51 (man rate),
+.48 (wind), +.45 (pressure), +.44 (spread), +.36 (blitz); injury/rest/temp ~0. E.g. Allen's
completions fall 1.6/sd of opponent man rate, Mayfield's RISE 1.4/sd (league −0.2). Use these as
player-brief content ("he completes less vs man-heavy defenses"), not as a line-beating model.

## QB profiles — completions, 2026 starters (owner, 2026-09-18) — `qb_profiles.py`
Per starter (34 with priced 2023-25 history): line MAE / residual sd (predictability rank), over rate
and bias vs the line, and HIS tendencies = factor r with (completions − line) ≥ .30, permutation p<.10,
sign holding on odd/even halves. Output: data/_qb_profiles_2026.parquet, out/qb_profiles_2026.md.
Most predictable: Purdy (line MAE 2.7), C.Williams 3.3, Lawrence 3.4, B.Young 3.5; least: D.Jones 5.6,
Daniels 5.2, Maye 5.1, Herbert 5.1, G.Smith 5.0 (league 4.6). Tendencies are individual and mostly NOT
league-wide (league r ≈ 0): Stroud/Goff/Hurts −1.8..−2.0 per sd of opponent man rate; Mahomes/Rodgers/
Nix/Purdy +1.1..+2.1 per sd of blitz rate; Love +1.6 wind (!), Rodgers −2.8 wind; L.Jackson +1.7 per
sd of receivers' catchable rate, Love/Prescott/Herbert negative. Bias persistence (bet the prior-season
bias side): 2024 56.1%/139 +4.2%, 2025 52.3%/174 −4.0%; sign persisted 77% then 44% — a description,
not a bet. Next: wire the stable tendencies into the QB tells on the Player Prop Report.
FORECAST TEST (`exp_qb_forecast.py`): profiles learned through 2025 wk12 → 2025 wk13-22 (200 QB-games)
+ 2026 wk1 (31, rows built from the posted lines + graded actuals). Pooled MAE: LINE 4.34, universal
4.36, HIS own model 4.70, PROFILE (line + his stable tendencies) 4.91. Bets ≥1.5: HIS 52.2%/90 +1.0%,
PROFILE 54.2%/59 +9.0% (2026 wk1 55.6%/9 +57% carries it; 2025 wk13+ 54.0%/50 +0.3%). Per QB: 11 of
29 had HIS MAE below the line's on 4-10 test games each (Purdy 2.79 vs 3.25, Goff 4.12 vs 4.36, Stroud
3.23 vs 3.28), 18 were worse (Hurts 4.36 vs 3.07, Prescott 4.31 vs 2.92, Burrow 3.74 vs 1.79) — the
split a coin gives. Predictable QBs = the ones the LINE misses least (Burrow 1.8, Lawrence 2.4,
C.Williams 2.4, Prescott 2.9 on their test games), not the ones our profile predicts.
Verdict: per-QB profiles are true descriptions that do not forecast past the line. Closed.
Attempts-first decomposition (`exp_completions_twostage.py`, 1,598 QB-games with both lines):
attempts LINE × his entering completion rate vs the completions line: 2024 57.6%/33 +9.9%, 2025
32.0%/25 −42.5% (sign flips; r with the residual +.05 → −.12). Attempts model does NOT beat the
attempts line (MAE 6.43 vs 6.40; 6.63 vs 6.46); rate model ≈ his entering rate (.078 vs .078; .072 vs
.076). Every two-stage combination is worse than the direct completions model on the bet (two-stage
47.9% / 45.5%; att line × rate model 54.1 / 53.8; direct 56.1%/212 +5.4% · 59.0%/156 +10.0%).
Verdict: completions is NOT better modeled as attempts × rate; volume is line-efficient and the rate
is already his own rate. Direct model stays.

## PASS ATTEMPTS — same full pass (owner, 2026-09-18) — `exp_qb_market_deep.py player_pass_attempts`, `qb_profiles.py 2026 player_pass_attempts`, `exp_qb_forecast.py player_pass_attempts`
Universal: line-only MAE 6.50 / 6.59; no stack beats it; every family drop-one within ±0.05. Bet: frozen
config 53.1%/275 −0.6% (2024) · 58.7%/172 +10.5% (2025) — the "2025-only" attempts verdict stands.
Partial effects vs the line (pooled): short rest +1.8 (n=127); wind 18+ −1.8; opponent blitz rate
MONOTONIC low −0.57 / mid −0.26 / high +0.34; dog 7+ −1.24 and fav 7+ +0.43 (the market OVER-prices the
trailing script → removed the 'underdog = more attempts' tell from nfl_prop_narratives); WR/TE <15%
share out +1.26. Profiles (34 starters): most predictable Purdy 3.8, Lawrence 5.2, Stroud 5.2, Prescott
5.3 (league 6.5); least D.Jones 8.0, G.Smith 7.7, Cousins 7.2, Maye 7.1. Biases: Maye 33% over (−2.3),
D.Jones −2.7, Stroud 36% over; Nix +2.2, C.Williams 63% over, Goff +1.8. Fewer stable tendencies than
completions: Love (blitz +2.4, wind +2.5, total −2.7), Rodgers (blitz +3.2, wind −4.0), Hurts man −3.3,
Burrow total +4.0, Lawrence temp −3.4. Forecast (through 2025 wk12 → wk13-22 + 2026 wk1, 232 games):
LINE 6.77, universal 6.83, HIS 7.15 (bet 50.8%/118), PROFILE 7.45 (45.5%/66); 12 of 29 QBs beaten by
their own model, 17 not. Rodgers/Love/Stafford profiles helped on 5-8 games; most hurt.
Verdict: attempts behaves exactly like completions — line-efficient, individual tendencies real but
not forecastable past the book. Using attempts to help completions has no lift to give (see two-stage).

## CORRECTION (owner caught it, 2026-09-18): per-QB "stable tendencies" were tested on odd/even halves
POOLED ACROSS SEASONS, which lets two old seasons carry a pattern the latest season reversed. J.Love,
attempts vs opponent blitz rate: 2023 r +.43, 2024 +.61, 2025 −.35 (2025 table: −3.4 vs the line against
top-half blitz opponents, +5.8 against bottom-half). Rule changed in qb_profiles.py: a tendency must
hold the same sign in EVERY season with 8+ of his games (≥2 seasons). Survivors — attempts: Purdy rest,
Lawrence temp/rest, C.Williams catchable/rest, Stafford WR-out, Murray blitz, Love catchable(−), Rodgers
wind(−), Burrow total; completions: Purdy blitz/rest, C.Williams temp/rest, L.Jackson catchable, Stafford
WR-out, Rodgers blitz/wind, Prescott catchable(−), Stroud man(−), Goff man(−), Mahomes blitz/pressure/temp,
Nix blitz, Burrow total. Love's blitz claim and Hurts's man claim are GONE. Method rule for every
per-player tendency from here: stability = sign agreement across seasons, never pooled halves.

## Attempts vs completions profiles (2026-09-18) — `qb_profiles_compare.py`
26 starters with both: predictability rank correlation +.75, bias correlation +.80 — the same QBs are
predictable (or not) in both markets, and their bias vs the line points the same way in both.
Predictable in BOTH (top 10 each): Purdy, Lawrence, Tua, Darnold, B.Young, C.Williams, Stafford.
Unpredictable in BOTH: Daniels, Burrow, Maye, Cousins, G.Smith, D.Jones.
Same-direction bias in both (|att| ≥1, |cmp| ≥.75): under — Purdy, Stroud, Herbert, L.Jackson, Daniels,
Maye, G.Smith, D.Jones; over — Murray, Nix. Tendencies carrying across markets: Purdy rest(+),
C.Williams rest(−), Stafford WR-out(+), Rodgers wind(−), Burrow total(+).

## Forecast under the STRICT rule + bias predictor (2026-09-18) — `exp_qb_forecast.py <market>`
Learned through 2025 wk12 → 2025 wk13-22 + 2026 wk1. BIAS = line + his shrunken prior bias (k=8);
PROFILE = line + bias + per-season-stable tendencies.
  attempts   (232): LINE 6.77 | BIAS 6.72, bet≥1.5 60.0%/20 +10.7% (2025: 66.7%/18) | PROFILE 7.29, 47.4%/78 −8.2% | HIS 7.15
  completions(231): LINE 4.34 | BIAS 4.33, 75%/8 | PROFILE 4.72 but bet≥1.5 66.0%/50 +32.1% (2025 wk13+: 65.1%/43 +20.5%; wk1: 5/7)
                    profile winners: Burrow 7/7 (total+), Herbert 5/7, Prescott 4/5, Goff 3/5, Stroud 2/3, Hurts 2/3; losers Cousins 2/7, Lawrence 0/1
The shrunken BIAS is the first per-player thing to match/beat the line on MAE in both markets (tiny
margins). The completions PROFILE is worse on MAE yet 66% on 50 bets in one window (≈2 sd) — promising,
unproven: one test window, and the loose-rule version of the same idea was 54%/59. Attempts profile: no.
Decision: paper-track the strict completions profile reads weekly in 2026 before any card shows them.

## PASS YARDS — full pass + built from the other two (2026-09-18)
Universal (`exp_qb_market_deep.py player_pass_yds`): the robust market — every config profitable both
seasons (full stack 57.6%/288 +8.8% · 59.7%/201 +12.6% at thr 17.5; frozen engine config 58.9%/+11.4 ·
55.3%/+4.2). Partial effects vs the line: wind 18+ −31 yds (n=63), cold (≤50°F) −10, short rest +19,
dog 3-7 +11.5 but dog 7+ −9.6, receiver <15% share out +9, high-blitz opp +3.9.
Profiles (`qb_profiles.py 2026 player_pass_yds`): most predictable Murray 35, Tua 42, Mahomes 45,
Rodgers 47, Lawrence 48 (league 58); least Cousins 70, D.Jones 66, Burrow 65, Mayfield 63. Biases: Goff
+20 (71% over), Mayfield +16, Nix +15, Prescott +14; D.Jones −25, Herbert −17, Daniels −14, Tua −10.
Strict forecast (216): LINE 59.2 | BIAS 58.5 (61.5%/13 in 2025, 0/2 wk1) | PROFILE 65.1, 58.4%/77 +10.3%
in 2025 wk13+ but 1/7 in wk1 → 54.8%/84 pooled | HIS 63.6, 49%/104.
From the other two models (same window, 214 games): completions PROFILE × his yds/completion 53.9%/76
+10.7% (corr with the yards residual −.03); completions (line+bias) × yds/cmp 51.2%/41; attempts
(line+bias) × cmp rate × yds/cmp 52.1%/71; agreement of the two profiles 54.5%/33. Nothing beats the
direct yards model, which is the strongest prop model we have. Chaining adds no information.
Predictability rank correlations across the three markets: att-cmp +.75, att-yds +.36, cmp-yds +.42.

## RUNNING BACKS — rush yards + rush attempts, same pass (2026-09-18) — `exp_rb_market_deep.py <mkt>`, `qb_profiles.py 2026 <mkt>`, `exp_qb_forecast.py <mkt>` (RB factor sets; back-specific box splits from FTN)
RUSH YARDS (3,219 RB-games): SKEW — mean(actual − line) +3.5 but MEDIAN −1.0, over rate 48.2%, every season;
passing markets have no such gap. A mean-predicting model bets overs 77-98% and loses (frozen 42.7%/−19 ·
49.2%/−7); median-calibrated (shift −3) it lands 50-54% = break-even. Rush yards is a median market with a
long tail, not a modeling failure. Line-only MAE 22.8/22.7; no stack beats it. Profiles (34 backs, bias =
MEDIAN residual): predictable Spears 14.3, Gainwell 14.5, Perine, R.White, Allgeier; least Dowdle 28.6,
A.Jones 28.2, Henderson 27.4, K.Williams 27.1 (65% over, +17 mean). Forecast (407): LINE 21.95 | HIS 24.35
54.3%/173 +3.0% | BIAS(median) 50%/30 | PROFILE 50.9%/53. Nothing carries.
RUSH ATTEMPTS (2,547): line-only MAE 3.99/3.75; nothing beats it; frozen config 56.6%/205 +5.4% (2024)
then 50.8%/130 −6.5% (2025) — not stable. Partial effects: teammate RB with <25% of carries out → +1.0
(n=115), 25%+ out +0.6; soft run D +0.55, stout −0.25; big favorite ≈ 0 (the leading-script story is
priced). Profiles (29 backs): predictable Warren 2.6, Spears 2.8, Dobbins 3.1, Swift 3.3, Henderson,
R.White, Gibbs, McCaffrey; least Barkley 5.6, J.Taylor 4.9 (64% over, +2.0), Hubbard 4.7, Dowdle 4.5;
Breece Hall 23% over (−2.5). Forecast (362): LINE 3.72 | HIS 4.13 52.2%/159 | BIAS 5/7 | PROFILE 50.7%/71.
Verdict: both RB markets are line-efficient; per-back tendencies do not carry; the injury-out volume bump
and the median-skew fact are the two things worth carrying into the cards. RB profiles = description only.

## Owner hypothesis: inflated RB attempts line = market expects the favorite to run out the clock (2026-09-18)
1,306 lead-back team-games 2023-25; inflation = his attempts line − his entering average. The script IS in
the line: corr(inflation, spread) = −.19 (bigger favorites get more inflated lines). But it adds nothing to
the spread: cover ~ spread + inflation → inflation t = +0.22. Favorites with an inflated line (≥+1.5):
cover 61.0%/136 (2023), 53.1%/143 (2024), 49.6%/125 (2025) — decays to nothing; deflated favorites 45/55/48.
Under rate for inflated favorites 58% / 47% / 46%. Verdict: the attempts line encodes the same script the
spread already prices; no leak. Closed.
Follow-up (`exp_prop_market_leaks.py`): pre-registered family of 8 prop-vs-game signals × 3 outcomes × 3
seasons (72 cells) with a shuffled-outcome null. Largest real top-vs-bottom-quintile gap = 17.5 pts; the
null's largest gap has median 19.2, 95th pct 26.0 — the whole family is at chance. One cell keeps its sign
three seasons (lead-back rush-yards inflation → game over, +6/+5/+9) — ~2-3 such cells are expected by
chance among 72. The 2023 RB-attempts cover cell (61%) was a one-season draw. Closed.

## TARGETS — the foundation model (owner, 2026-09-18) — `exp_targets_deep.py`
9,784 WR/TE player-games 2022-25 (8+ routes); no line, so the baseline = his K=4-seeded entering average
(MAE 2.00). Families: role, volume, coverage (+ his share-vs-coverage sensitivity), injury, context.
  - ridge stacks ≈ baseline (MAE 1.92-2.06); HGB on the full stack BEATS it: MAE 1.91/1.94/1.80 vs
    1.95/2.06/1.95, r .64/.61/.64 vs .63/.57/.58, and DIRECTION (sign of pred−baseline vs actual−baseline,
    |gap|≥1) 66.5%/828 · 75.4%/484 · 79.2%/621. Forecast window (learn ≤2025 wk12 → wk13+ & 2026 wk1,
    921 games): HGB MAE 1.81 vs baseline 1.97, direction 81.3%/203.
  - what moves targets vs his baseline: teammate WR/TE share out +0.2 / +0.5 / +0.9 (<15 / 15-30 / 30%+
    out); mean reversion by share (<12% share +0.6, 28%+ share −1.25 — the K=4 baseline lags); dogs +0.3;
    man-heavy +0.2; wind 18+ −0.15. Drop-one: every family ≤ +0.01 MAE in ridge (the gain is in the
    HGB interactions, not any one family).
  - profiles (156 active receivers, 20+ games): raw MAE rank is dominated by low-volume TEs — use it
    relative to baseline. 71 of 156 carry a per-season-stable tendency (mostly WR/TE-out share, opp
    two-high/pressure, rest). data/_wr_profiles_targets_2026.parquet.
Verdict: targets are genuinely predictable past the naive baseline (no market prices them) — the HGB
targets model is the input for receptions and yards. Frame: data/_targets_deep_frame.parquet.

## RECEPTIONS with the targets model inside (2026-09-19) — `exp_receptions_targets.py`
Targets frame rebuilt on ANY played game (routes ≥ 1; the 8-route cut used same-game info and dropped 10%
of lines that went over only 31%). Targets HGB still beats the baseline: MAE 1.72/1.73/1.65 vs
1.80/1.91/1.83, direction 73/82/83%; forecast window 88.3%/290. Receptions frame = 5,558 WR/TE lines
2023-25 joined to a walk-forward targets projection + entering catch rate (91% of all lines; the 9% left
out = no FP id (over 50%) or no played row that week (over 28% — DNP/limited; the cards already skip
Out/Doubtful and grade DNP as no action, so results are conditional on the player suiting up).
  vs the line, ≥0.7 at best-book (2024 | 2025):
    TARGETS × catch rate (no fit)   58.2%/517 +5.6%  | 62.5%/613 +13.5%
    DIRECT frozen receptions model  58.8%/262 +7.8%  | 64.2%/349 +16.0%   (all 9 configs profitable both seasons)
    DIRECT + targets projection     61.2%/268 +11.6% | 65.7%/388 +18.9%   (all 9 configs profitable both seasons)
    both agree, same side           61.7%/154 +11.1% | 68.0%/256 +21.1%
  forecast window (≤2025 wk12 → wk13-22): DIRECT+targets 70.5%/112 +26.5%; everything-ridge 72.0%/107.
Why receptions looked "2025-only" before: the earlier frame included the no-FP / no-played rows; on
receivers with an FP baseline who play, it is robust both seasons. Decision: ship receptions with the
targets projection as a feature and the FP-history + active condition; agreement with TARGETS×CR = the
high-conviction tier. Next: receiving yards with targets + catch rate + yards/reception.

## RECEPTIONS — adversarial verification before shipping (owner asked, 2026-09-19) — `exp_receptions_verify.py`
Oracle 100%. Leak audit: max |corr(feature, this-game residual)| = .11 (a leak would be >.3); targets
projection trained on prior seasons; catch rate entering. Config table fully reported (9 configs, all >0 both
seasons). ⚠ The first null (shuffling actuals across players) was MALFORMED — it scored 72% because it hands a
low-line receiver another player's receptions. Proper null = permute (actual − line) within season × line
bucket, keeping each row's line and best-book lines: 53-59% (2024), 56-61% (2025); REAL 61.2 / 65.7.
What the null exposed: the receptions market has a STRUCTURAL OVER BIAS at low lines — over rate vs consensus
56-59% at lines ≤2.5 (right skew: the line sits near the median, receptions can't go below 0), and "bet OVER
every line ≤2.5 at best book" with no model = 57.1%/438 +8.1% · 59.9%/529 +13.5%. The model's edge is
SELECTION on top of that: within lines ≤3.5, model-picked overs 63.0/67.8% vs all overs 55.5/56.4% vs the
ones it passed on 52.4/49.8%. It has no under edge (34 and 3 under bets) and nothing at lines 4-5.5 (51/48%).
Honest statement: real, two-part — a market bias worth ~+5-8 pts at low lines plus ~+8-11 pts of model
selection within them; ~+6-8 pts over the proper null. Ship it AS THAT: low-line receiver overs the model
agrees with. Method rule: a prop null must keep the line–actual pairing (permute residuals within line
bucket), never shuffle actuals across players.

## RETRACTION — targets / receptions / receiving yards (2026-09-19, caught while building yards)
**The three sections above (TARGETS, RECEPTIONS with targets inside, RECEPTIONS verification) reported inflated numbers. A same-game leak.**
Fantasy Points omits the receptions / yards / targets stat when it is zero, so the row was NaN. The entering (cumulative-minus-this-game)
values in `exp_targets_deep.py` went NaN on exactly the games where the player caught nothing, the median fill then made those rows carry
one identical value (e_rec 2.51, e_yds 29.10), and the gradient-boosted targets model learned "fill value = he produced nothing today".
Found because 45 of the 56 receiving-yards UNDER picks were 0-yard games (96% winners) and the shuffled-residual null produced ZERO under
picks. Separately, the receptions frame's `e_cr.notna()` filter dropped every zero-catch game (min actual was 1) — an over-side leak.
Fix: `fillna(0)` on tgt/rec/yds/tsh/yprr/first before entering values; weight-zero rows contribute 0. Chain rerun.

**Corrected numbers (walk-forward, best book):**
- Targets model vs the naive baseline: direction 2024 72.6%/179, 2025 78.4%/185 (was 82-88%). Still beats a naive average — but the
  book's implied targets is as accurate as ours, so this is not a market edge.
- Receptions, DIRECT + targets ≥0.7: 2024 57.4%/204 +4.8%, 2025 58.1%/198 +3.2% (was 67.8% / 66.7%). Identical to the frozen DIRECT
  model alone (55.3% / 58.1%). All-configs both-season 67% (was 100%). Agreement cell 51-56%, losing. The targets model adds NOTHING.
- Low-line (1.5/2.5/3.5) receptions: blanket over at best book 51.3% (2024) / 52.4% (2025) — the "market skew" I reported (56-64%)
  was the dropped zero-catch games. Model overs ≥0.7 at those lines: 61.2%/147 +12.2% (2024), 57.1%/182 +1.7% (2025); by line, 3.5
  flips 62% → 48%. Not shippable on its own.
- Receiving yards, every model incl. targets features: 46-54% at ≥12, all-configs both-season 0% for anything with targets in it,
  frozen DIRECT 54.4%/226 and 53.1%/96. Proper null 39-60%. Line-shopping alone 55-57%. NOTHING here.
**Standing state for WR/TE: the pre-existing frozen receptions model (~56-58% overs at ≥0.7, modest ROI) is all there is. Targets as a
foundation did not transfer to any market.**
Lesson logged in memory (leak-screen): a feature that equals its fill constant on >1% of rows must be checked against the outcome on those rows;
the overall correlation screen (r 0.04) missed it, the proper null caught it (real found 56 unders, nulls found 0).

## RECEIVERS — the per-player pass, same system as QBs/RBs (owner, 2026-09-19) — `exp_wr_market_deep.py <mkt>`, `qb_profiles.py 2026 <mkt>`, `exp_qb_forecast.py <mkt>`
Owner: "with QBs you looked at specific player trends — cold, primetime, wind, opponent blitz rate — then you stopped." Correct. Receivers got a
pooled model only. Now run for player_receptions and player_reception_yds: deep frame (him: entering target/route share, depth, yards per route,
catch rate, man/two-high sensitivity; opponent man/blitz/pressure/two-high; context incl. PRIMETIME; injury), per-player profiles with the
STRICT rule (same sign every season with 8+ games), and the forecast (learn ≤2025 wk12 → 2025 wk13-22 + 2026 wk1) at best book.
**Everything pass (walk-forward, ≥0.7 rec / ≥12 yds):** receptions full stack 54.0%/287 −1.3% (2024), 58.3%/252 +5.8% (2025); all-configs
both-season 33%. Yards full stack 54.7%/417 +3.1%, 53.7%/244 +1.2%; frozen engine set 55.5%/362 +4.8%, 52.3%/155 −1.4%. Family drop-one: nothing
beyond the line moves either number (|ΔMAE| ≤ 0.007 rec, ≤ 0.14 yds; opponent/injury families HURT yards). Partial effects: receivers under
18+ mph wind and ≤50°F run below the line on yards (+0.8 / +3.4 vs +6.7 league mean residual — the yards line sits ~6 above the median, right-skewed),
28%+ target-share players run under both lines; blitz-heavy opponents slightly over. All small.
**Profiles (120 / 131 active receivers with 15+ priced games):** most predictable vs the line = low-volume TEs (Knox, Fant, Likely) and Keon Coleman;
stable tendencies exist for ~half (Reed/Kraft/Higbee/Hollins/Juwan Johnson: blitz +; Metcalf/Fant/Douglas/Engram: two-high −; Worthy: primetime −;
Otton/Pitts/Diggs: primetime +; Rice/Goedert/Doubs: rest −). Written to out/qb_profiles_receptions_2026.md, out/qb_profiles_reception_yds_2026.md.
**Forecast under the strict rule — FAILS for receivers:**
- receptions 2025 wk13-22 (n=758): HIS 50.6%/346 −5.8% | PROFILE 49.3%/213 −8.6% | BIAS 58.1%/31 +8.8% (tiny) | UNIV 77%/22 (tiny)
- receiving yards (n=850): HIS 48.3%/354 −8.8% | PROFILE 50.8%/179 −4.1% | BIAS 47.5%/59 −9.9%
- per player: HIS MAE beats the line for roughly a third of receivers, by a few tenths of a catch, with no bet edge; the tendencies that were stable
  through 2025 wk12 did not pay after it.
Verdict: the per-player tendency method transfers from QBs to receivers as a DESCRIPTION (profiles are real and stable in-sample) but not as a
FORECAST — receiver residuals vs the line are too noisy (resid sd 2.1 catches / 31 yds on lines of 4 / 45). Keep the profile sheets as card copy
("Reed catches more against blitz-heavy defenses, every season"), do not bet them.
