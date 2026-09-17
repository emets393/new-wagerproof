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
