# NBA — the originator total model

Predict own-team points with **no market column anywhere**, add the two rows, bet the disagreement with the posted total. `nba_total_prune.py`. Run fresh rather than inheriting the spread's `CORE`, because the two markets do not share an information set.

Baseline: **739 features**, corr with the realised residual +0.0781, **+4.91%** ROI on the top 15% of disagreements and **+6.94%** on the top 9%.

## Drop-one — does the model improve without this family?

**Positive delta means cutting the family HELPS.** This column decides what gets cut; solo only says whether the information exists at all.

| family | cols | ROI top 15% | delta | ROI top 9% | delta |
|---|---|---|---|---|---|
| raw_box | 96 | +7.80 | **+2.89** | +9.08 | **+2.14** |
| travel | 10 | +7.16 | **+2.25** | +9.61 | **+2.67** |
| rot_flags | 21 | +7.16 | **+2.25** | +9.07 | **+2.14** |
| usage | 24 | +6.52 | **+1.61** | +4.80 | **-2.14** |
| pl_regr | 18 | +6.52 | **+1.61** | +8.54 | **+1.60** |
| nets | 48 | +6.19 | **+1.28** | +6.40 | **-0.53** |
| rapm | 170 | +5.89 | **+0.98** | +3.20 | **-3.73** |
| standings | 4 | +5.88 | **+0.97** | +9.07 | **+2.14** |
| talent | 33 | +5.56 | **+0.65** | +8.00 | **+1.07** |
| style | 66 | +4.92 | **+0.01** | +9.62 | **+2.68** |
| ratings | 9 | +4.92 | **+0.01** | +7.47 | **+0.54** |
| adj_eff | 54 | +4.59 | **-0.32** | +4.79 | **-2.14** |
| schedule | 8 | +4.59 | **-0.32** | +6.40 | **-0.53** |
| dims | 12 | +4.28 | **-0.63** | +6.94 | **+0.00** |
| absence | 32 | +4.27 | **-0.64** | +5.34 | **-1.60** |
| pace_ix | 7 | +3.95 | **-0.96** | +6.40 | **-0.53** |
| misc | 47 | +3.95 | **-0.96** | +7.48 | **+0.54** |
| form | 80 | +3.95 | **-0.96** | +3.20 | **-3.73** |

## Solo — does the family carry anything by itself?

| family | cols | corr | ROI top 15% | ROI top 9% |
|---|---|---|---|---|
| adj_eff | 54 | +0.0116 | +4.31 | +9.66 |
| pl_regr | 18 | -0.0037 | +3.65 | +4.29 |
| style | 66 | -0.0012 | +3.32 | +4.29 |
| dims | 12 | -0.0033 | +2.04 | +2.68 |
| travel | 10 | -0.0006 | +0.76 | +6.42 |
| form | 80 | +0.0038 | +0.43 | +2.14 |
| ratings | 9 | +0.0159 | +0.12 | -4.27 |
| talent | 33 | -0.0033 | -0.84 | -5.34 |
| rapm | 170 | +0.0261 | -0.85 | -0.53 |
| rot_flags | 21 | -0.0034 | -1.33 | -0.00 |
| raw_box | 96 | +0.0101 | -1.48 | -2.66 |
| schedule | 8 | -0.0041 | -1.81 | +4.29 |
| usage | 24 | +0.0012 | -1.81 | -1.60 |
| standings | 4 | -0.0208 | -2.78 | -5.88 |
| absence | 32 | +0.0021 | -3.10 | +3.74 |
| misc | 47 | +0.0104 | -4.37 | -2.11 |
| pace_ix | 7 | -0.0015 | -4.38 | -1.07 |
| nets | 48 | +0.0085 | -5.01 | +1.61 |

---

# Grading the pruned total

`nba_total_prune2.py`. Five pre-registered configurations, 20 game-level null shuffles, compared at fixed selectivity so the comparison is between feature sets and not between strategies.

| config | features | corr | bets (top 15%) | win% | base% | ROI | z | ROI top 9% | z |
|---|---|---|---|---|---|---|---|---|---|
| ALL | 739 | +0.0781 | 595 | 55.0 | 51.9 | **+4.91** | +2.69 | **+6.94** | +2.47 |
| **T1** | 612 | +0.0843 | 595 | 58.8 | 52.4 | **+12.29** | +5.49 | **+14.42** | +5.17 |
| T2 | 482 | +0.0641 | 595 | 56.1 | 53.6 | **+7.17** | +2.00 | **+9.09** | +1.42 |
| TCORE | 240 | +0.0265 | 595 | 51.8 | 50.6 | **-1.18** | +1.40 | **+3.20** | +1.42 |
| TCORE_R | 410 | +0.0608 | 595 | 56.1 | 51.8 | **+7.17** | +3.79 | **+10.69** | +1.56 |

## T1 on the points ladder

Disagreement with the posted total, in points. Nulls are the same 20 game-level shuffles graded at the same rung.

| cut (pts) | bets | win% | base% | edge | ROI | null mean | null sd | z |
|---|---|---|---|---|---|---|---|---|
| ≥1 | 3,408 | 52.7 | 50.7 | **+2.0** | **+0.6** | -0.25 | 0.62 | **+3.56** |
| ≥2 | 2,843 | 54.1 | 50.3 | **+3.7** | **+3.2** | -0.26 | 0.69 | **+5.81** |
| ≥3 | 2,332 | 54.3 | 50.5 | **+3.8** | **+3.6** | -0.28 | 0.84 | **+4.84** |
| ≥4 | 1,886 | 54.7 | 50.9 | **+3.8** | **+4.4** | -0.35 | 0.89 | **+4.64** |
| ≥5 | 1,489 | 54.5 | 51.2 | **+3.3** | **+4.1** | -0.49 | 0.83 | **+4.55** |
| ≥6 | 1,147 | 54.6 | 50.5 | **+4.1** | **+4.2** | -0.61 | 0.89 | **+5.26** |
| ≥7 | 885 | 56.6 | 51.2 | **+5.4** | **+8.1** | -0.74 | 0.85 | **+7.27** |
| ≥8 | 675 | 58.7 | 52.0 | **+6.7** | **+12.0** | -0.75 | 0.80 | **+9.31** |
| ≥10 | 359 | 59.9 | 52.9 | **+7.0** | **+14.3** | -0.56 | 1.06 | **+7.08** |
| ≥12 | 204 | 60.3 | 53.4 | **+6.9** | **+15.1** | -0.62 | 1.72 | **+4.34** |


## T1 broken out at the ≥12 cut

Pooled numbers hide a signal that lives in one season or decays out.

| season | bets | win% | base% | edge | ROI |
|---|---|---|---|---|---|
| 2023 | 109 | 57.8 | 58.7 | **-0.9** | **+10.3** |
| 2024 | 37 | 59.5 | 56.8 | **+2.7** | **+13.5** |
| 2025 | 56 | 66.1 | 50.0 | **+16.1** | **+26.0** |

| phase | bets | win% | base% | edge | ROI |
|---|---|---|---|---|---|
| EARLY | 113 | 58.4 | 53.1 | **+5.3** | **+11.5** |
| MID | 34 | 55.9 | 55.9 | **+0.0** | **+6.6** |
| LATE | 45 | 64.4 | 53.3 | **+11.1** | **+23.0** |


## T1 at ≥12, split by which side the model takes

| side | bets | win% | ROI |
|---|---|---|---|
| model OVER | 142 | 59.9 | **+14.3** |
| model UNDER | 62 | 61.3 | **+17.0** |

---

# ⭐ THE RUNG TO STAND ON IS ≥8, NOT THE ≥12 ARGMAX

`nba_total_prune2.py` auto-selects the ladder's best ROI, which is ≥12. **That is the wrong
reading of the ladder.** ≥12 is 204 bets against a null sd of 1.72; ≥8 is 675 bets against a null
sd of 0.80, and its **z of +9.31 is the highest on the entire ladder** — more than double ≥12's
+4.34. Nearly the same ROI, three times the sample, half the noise. Breakouts below are ≥8.

| | bets | win% | base% | edge | ROI |
|---|---|---|---|---|---|
| **≥8 pooled** | **675** | **58.7** | **52.0** | **+6.7** | **+12.0** |
| 2023 | 250 | 57.6 | 57.6 | +0.0 | **+10.0** |
| 2024 | 186 | 60.8 | 54.3 | +6.5 | **+16.0** |
| 2025 | 230 | 59.1 | 51.3 | +7.8 | **+12.9** |
| EARLY | 254 | 57.5 | 53.5 | +3.9 | **+9.7** |
| MID | 179 | 60.3 | 50.3 | +10.1 | **+15.2** |
| LATE | 209 | 57.9 | 52.2 | +5.7 | **+10.5** |
| POST | 33 | 63.6 | 51.5 | +12.1 | **+21.4** |
| model OVER | 376 | 59.6 | — | — | **+13.7** |
| model UNDER | 299 | 57.5 | — | — | **+9.8** |

Every season, every phase and both sides are positive, and in the 2×3 side×season grid only one
cell loses (UNDER in 2023, n=52, −4.5%). **Drop to ≥6 and that stops being true** — 2023 goes to
−1.0% and POST to +0.3%. So ≥8 is where the model starts being right, not where the ROI happens
to peak.

**2023 makes its money on PRICE, not on hit rate** — 57.6% against a 57.6% in-slice base is an
edge of exactly zero, yet +10.0% ROI, meaning the model kept landing on the cheaper side of games
that were going to go that way anyway. That is a real way to profit but it is a different
mechanism from the other two seasons, and it is the one cell here I would not extrapolate.

**Postseason INVERTS the spread's behaviour.** The originator spread is ~zero in the playoffs;
the total is +21.4% on 33 bets. Thirty-three bets is nothing — this is a note to check later, not
a claim.

