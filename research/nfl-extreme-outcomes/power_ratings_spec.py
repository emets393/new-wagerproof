#!/usr/bin/env python3
"""STATUS: RETRACTED AS A BETTING MODEL (2026-09-17, power_ratings_anchor_check.py).

The record below was CLV, not model edge. The model anchors on the CLOSE (nflverse spread_line
= T-60) and was graded vs the OPENER — it "knew" where the line ended up. Honest settings:
  close-anchored, graded vs CLOSE   48.0% (n=196)   <- the model's own opinion loses
  OPEN-anchored,  graded vs OPEN    53.8% (n=208, 55/64/45 by year, +5.8u)  <- what production could do
  OPEN-anchored,  graded vs CLOSE   48.9%           <- it does not predict the move
  no model, bet opener toward close 56.8% (n=440)   <- the whole "edge"
Everything derived from the close-anchored fit is void: dose-response, weather modulator (honest
fit: outdoor 55.6% n=54, dome 44.8%), signal confluence (honest: production align 59.1% vs oppose
56.4% — no validator effect; spot-rule totals align 52.9% n=17), starter-QB-out subset, the Week 2
2026 board. The four composites still describe matchups; they are not a bet.
This is the exact violation named in memory nfl-backtest-grading-framework ("close-line metrics
-> grade vs CLOSE"). Kept on disk as the record of what was tested; nothing below is shippable.

Original spec text follows, unchanged, for the audit trail.

  FEATURES   power_ratings.KEEPF (18 reliability-gated FP units + 7 production CORE + 9
             offense-vs-this-defense differentials + home) + market anchor
  BLEND      every unit enters week w as (4 x prior-season mean + this season's games) / (4 + n):
             week 2 = 20% this season, week 5 = 50%, week 9 = 67%. One blowout week cannot
             flip a rating. CORE comes from data/team_week_seasonal.parquet (rebuilt from pbp,
             same K=4 rule) — the prod table nfl_pregame_advanced_team_week labels columns
             `_s2d` but NEVER resets by season (Buffalo 2025 = 1,565 drives since 2018).
             Swapping it in was a wash (spreads 59.3 -> 59.7%, totals 63.0 -> 60.6%, 2023-25);
             CORE removed entirely is 58.4% / 66.0% — the FP units carry the model.
             + PLAYED-ONLY QB/SKILL injury counts for both teams (Out/Doubtful/IR, pregame-
             verified): skill players counted only if usage>0 this/last season, QBs only if
             they were the FIRST PASSER of the team's most recent game (pbp) — handles
             start-then-hurt (Darnold) and backup-on-report (Gabriel) correctly. Beats crude count and usage-weighted (60.0/62.2/56.4).
  EXCLUDED   split_recv_adv_x_coverage (no coverage dimension); team-specific HFA (not a
             trait, r=-0.10); Elo, Madden, precipitation, referee, rest, recency form,
             weather (all null or harmful — Elo/Madden correlate >0.5 with the market)
  MODEL      ridge lambda=80, walk-forward, predicts team points; composite = prediction
  SPREADS    play when |model line - opener| >= 2.  HOME leans 61.4% (core tier),
             AWAY leans 56.7% (extended tier, only with injuries in the model)
  TOTALS     within-season ROLLING calibration (mean residual of this season's prior weeks,
             >=24 games, else prior-season offset); play at |gap| >= 3 after calibration.
             WEATHER TIER (modulator, not feature): OUTDOOR totals = core (69.9% n=73, every
             season 66-73%; UNDER leans 76.2%); DOME totals = lean only (51.3% n=39). Placebo
             p=0.048, one variable (wind == dome). First 2026 forward-test item.
  RECORD     spreads both sides 59.7% (288) +40.3u; totals 60.3% thr2 / 66.1% thr3
  WATCH      2025 is the weak year everywhere; thr3 spread symmetry ~2.0 on small n;
             bye-week spreads 46.7% (n=30, 60/44/36 by year); starter-QB-out games 65.6% (n=32)
  NULL       divisional (feature, split, AND stratified fit — all null); referee as offset or
             feature (market prices the crew); primetime; rest; recency form
"""
INJ_FEATS = ["p_inj_skill", "opp_p_inj_skill"]   # PLAYED-ONLY skill counts. QB flags DROPPED:
#   49 historical cases, own-team coefficient wrong-signed (+1.5 pts), market already prices a
#   starter out; skill-only is 59.3%/+39.0u vs 59.7%/+40.3u — inside noise. Starter identity
#   (first passer, pbp) is still computed for the NARRATIVE layer only.
# WATCH: games with a starting QB out are the model's BEST subset (65.6%, n=32, home 72.2%) —
#   consistent with market over-adjustment to QB injuries. Too thin to act on; track it.
QB_STARTER_RULE = "first passer of team's most recent game (pbp), not dropback share"
SKILL_MIN_USAGE = 0.0   # strictly > 0
LAMBDA = 80.0
SPREAD_THR = 2.0
TOTAL_THR = 3.0
TOTAL_CAL_MIN_GAMES = 24
SKILL_POS = ["WR", "TE", "RB", "FB"]
INJ_STATUS = ["Out", "Doubtful", "Injured Reserve"]

TOTALS_DOME_TIER = "lean"        # dome totals downgraded; outdoor totals are core
DOSE_RESPONSE = "monotone both markets: spreads 54.5/59.3/60.3/61.3/75.0 @>=1/2/3/4/5; totals 59.6/63.4/67.4 @>=2/3/4"
