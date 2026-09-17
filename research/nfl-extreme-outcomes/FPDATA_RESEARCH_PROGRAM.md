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
