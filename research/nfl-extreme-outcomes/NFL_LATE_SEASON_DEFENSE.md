# Late-season defense theory — verdict (2026-08-23, nfl_late_season_defense.py)

Owner theory: from late November good defenses peak and bad/average offenses regress -> the
better-defense side covers, games go under, team totals go under. Tested by THRESHOLDS on
entering-week EPA (2018-2025, 3,236 team-games wk5+, regular season; TT lines 2023-25 only).

## Mechanism: TRUE
Top-25% defenses allow 22.8 -> 21.7 -> 20.9 -> 20.8 ppg across wk5-8 / 9-11 / 12-14 / 15-18
(-2.0). Bottom-third offenses 21.0 -> 20.2 (-0.8). Bad defenses and good offenses are flat.
Good D really does tighten late and bad O really does fade.

## Spreads: the market prices it — and OVER-prices it early
Team whose defense ranks >=40 percentile points better than the opponent's:
wk5-8 **40.0%** ATS (n=185, losing in 7/8 seasons) -> wk9-14 ~50% -> wk15-18 **54.4%** (n=182,
+3.8%). The seasonal arc is real but the *bettable* side is the opposite of the theory:
**FADE the better-defense team midseason (wk5-11): 56.1%, +7.1%, n=312, 7/8 seasons >=51%.**
The late-season follow (wk12+: 52.8% / wk15+: 54.4%) is breakeven-to-thin.

## Totals: league-wide the theory is BACKWARDS; the matchup version is real
Late-season games go OVER more, not under (blind under 49.9% late vs 53.5% mid; lines fall
to 44.5 while games score 45.6). "Both defenses good" = nothing (50.7%). But
**top-25% DEFENSE vs bottom-25% OFFENSE, late: UNDER 58.9% (n=95, +12.5%, 6/8 seasons)**
vs 47.2% for the same matchup midseason. It is a matchup effect, not a good-defense effect.

## Team totals (2023-25): the strongest cell in the study
- **Bottom-third offense facing a top-25% defense, wk12+: TEAM TOTAL UNDER 69.6%**
  (n=46, +32.8% @-110, 69/69/71 by season) vs 52.0% midseason.
- Mirror: **top-third offense facing a bottom-25% defense, wk12+: TT OVER 64.9%** (n=57,
  +23.9%, 59/75/60) vs 54.2% midseason.
- Plain "facing a top-25% D" late: 56.3% under (n=158) — the offense quality is what sharpens it.
Caveat: three seasons of TT lines, n=46/57. Per-season consistency is the tell; tracking
tier for 2026 is the honest first step.

## Candidate signals (not wired — owner call)
1. mid_fade_good_defense (spread, wk5-11): fade the team whose D ranks >=40 pct pts better.
2. late_bad_o_vs_good_d_tt_under (team_total, wk12+): bottom-third O facing top-25% D.
3. late_good_o_vs_bad_d_tt_over (team_total, wk12+): top-third O facing bottom-25% D.
4. late_matchup_under (total, wk12+): top-25% D vs bottom-25% O in the game.
