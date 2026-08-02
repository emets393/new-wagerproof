# CBB — one model per market: which features does each market actually want?

`cbb_market_models.py --stage ablate`. Every configuration is fitted ONCE and graded on ALL SEVEN markets, so the tables below are seven readings of the same 17 ablations — which is the whole point: a family that carries the spread and a family that carries the total do not have to be the same family, and on the NBA they were not.

**Graded at fixed selectivity, per market.** Each configuration bets the same top-N% of *that market's own* disagreements, so a smaller feature set cannot win by making fewer, more extreme predictions.

**σ is one sigma of ROI noise on the bet count in that column.** A delta smaller than σ is not a finding. This is printed because the first college prune had 13 of 17 families 'improving' the model — the dilution fingerprint, not a menu.

**No nulls here.** This is a ranking, not a claim; the winning configuration per market goes back through `cbb_panel.py`'s null grading before it is believed.

## Baseline — the single shared model, on every market

This is the model `CBB_PANEL_ALL.md` grades: one feature set, one half-life, all seven markets. Everything below is measured against this row.

| market | bets (top 10%) | win% | base% | ROI | σ |
|---|---|---|---|---|---|
| tt | 3,270 | 54.7 | 52.0 | **+1.95** | ±1.67 |
| fg_total | 1,730 | 53.0 | 50.3 | **+1.17** | ±2.29 |
| fg_spread | 1,720 | 56.2 | 50.1 | **+7.28** | ±2.30 |
| fg_ml | 1,732 | 60.5 | 57.0 | **+3.08** | ±2.29 |
| h1_total | 1,703 | 54.8 | 53.3 | **+3.57** | ±2.31 |
| h1_spread | 1,701 | 54.2 | 51.7 | **+2.68** | ±2.31 |
| h1_ml | 1,651 | 54.4 | 53.3 | **+0.83** | ±2.34 |

## The target question — raw team points, or the residual against the implied total?

Neither variant sees a posted line as a FEATURE; they differ only in what the model is asked to predict. `predict-the-raw-quantity-not-the-residual` found on the NBA that raw-quantity-with-the-line-as-a-feature beat residual-vs-line — but the line cannot be a feature under the originator rule, so this third combination is the one college has never measured.

| market | residual ROI | raw ROI | Δ | σ |
|---|---|---|---|---|
| tt | +1.95 | -0.01 | **-1.96** | ±1.67 |
| fg_total | +1.17 | -0.79 | **-1.96** | ±2.29 |
| fg_spread | +7.28 | +3.98 | **-3.30** | ±2.30 |
| fg_ml | +3.08 | +1.76 | **-1.32** | ±2.29 |
| h1_total | +3.57 | -3.03 | **-6.59** | ±2.31 |
| h1_spread | +2.68 | -0.74 | **-3.42** | ±2.31 |
| h1_ml | +0.83 | -3.48 | **-4.32** | ±2.34 |

## tt

Baseline +1.95% on 3,270 bets (σ ±1.67). **A positive Δ means cutting that family HELPS this market.**

| family | cols | top 20% | Δ | top 10% | Δ | CONF top 10% | Δ |
|---|---|---|---|---|---|---|---|
| context | 9 | +0.38 | **+0.61** | +2.49 | **+0.55** | +1.16 | **-1.33** |
| lineup | 6 | -0.21 | **+0.02** | +1.88 | **-0.07** | +2.16 | **-0.33** |
| starters | 4 | -1.05 | **-0.82** | +1.83 | **-0.12** | +0.63 | **-1.86** |
| season_s2d | 24 | +0.50 | **+0.73** | +1.80 | **-0.14** | +1.98 | **-0.50** |
| star | 4 | -0.74 | **-0.51** | +1.58 | **-0.36** | +2.30 | **-0.19** |
| roster | 10 | -0.22 | **+0.01** | +1.58 | **-0.37** | +0.72 | **-1.76** |
| heat | 20 | -0.02 | **+0.21** | +1.51 | **-0.43** | +0.43 | **-2.06** |
| schedule | 7 | -0.46 | **-0.23** | +1.48 | **-0.47** | +2.06 | **-0.42** |
| pctile | 32 | -0.66 | **-0.43** | +1.47 | **-0.48** | +1.36 | **-1.13** |
| adv | 6 | -0.30 | **-0.07** | +1.30 | **-0.65** | +1.61 | **-0.87** |
| style_raw | 32 | +0.13 | **+0.36** | +0.91 | **-1.04** | +1.73 | **-0.76** |
| availability | 12 | -0.01 | **+0.22** | +0.59 | **-1.35** | +1.05 | **-1.44** |
| form_l5 | 28 | -0.58 | **-0.35** | +0.53 | **-1.41** | +1.56 | **-0.92** |
| kenpom | 10 | -0.51 | **-0.28** | +0.39 | **-1.55** | +0.64 | **-1.85** |
| possession | 32 | -1.16 | **-0.93** | -0.86 | **-2.81** | -0.11 | **-2.60** |

Mean drop-one Δ **-0.71** (sd 0.81, 1 of 15 families improve the market when removed). A mean well above zero with a scattered ranking is dilution — read it as 'this market carries too many features', not as a shopping list.


### tt — solo

Does the family carry this market by itself? Redundant families look fine here and change nothing when dropped; load-bearing ones can look dead here.

| family | cols | top 10% | CONF top 10% |
|---|---|---|---|
| style_raw | 32 | +1.61 | +0.77 |
| pctile | 32 | +1.58 | +1.17 |
| possession | 32 | -0.18 | -0.61 |
| availability | 12 | -0.36 | +0.64 |
| heat | 20 | -1.06 | -1.94 |
| lineup | 6 | -1.34 | -2.97 |
| schedule | 7 | -1.70 | -1.45 |
| star | 4 | -1.76 | -2.54 |
| adv | 6 | -1.85 | -2.84 |
| season_s2d | 24 | -2.24 | -0.54 |
| roster | 10 | -2.55 | -2.23 |
| context | 9 | -2.65 | -1.99 |
| starters | 4 | -2.71 | -2.64 |
| kenpom | 10 | -2.85 | -2.94 |
| form_l5 | 28 | -3.11 | -3.12 |

## fg_total

Baseline +1.17% on 1,730 bets (σ ±2.29). **A positive Δ means cutting that family HELPS this market.**

| family | cols | top 20% | Δ | top 10% | Δ | CONF top 10% | Δ |
|---|---|---|---|---|---|---|---|
| style_raw | 32 | -0.56 | **+0.01** | +2.72 | **+1.55** | -0.50 | **+0.71** |
| starters | 4 | -0.79 | **-0.22** | +2.16 | **+0.99** | +0.03 | **+1.24** |
| context | 9 | -2.16 | **-1.59** | +1.61 | **+0.45** | -0.68 | **+0.53** |
| lineup | 6 | -0.24 | **+0.33** | +1.17 | **-0.00** | -0.50 | **+0.71** |
| pctile | 32 | -1.45 | **-0.88** | +1.07 | **-0.10** | +0.56 | **+1.77** |
| availability | 12 | -1.61 | **-1.04** | +1.06 | **-0.11** | -2.79 | **-1.58** |
| kenpom | 10 | -2.05 | **-1.48** | +1.05 | **-0.11** | -0.50 | **+0.71** |
| form_l5 | 28 | -1.83 | **-1.26** | +0.73 | **-0.44** | -1.57 | **-0.36** |
| adv | 6 | +0.04 | **+0.61** | +0.50 | **-0.67** | -0.51 | **+0.70** |
| roster | 10 | -0.29 | **+0.28** | +0.40 | **-0.77** | +1.08 | **+2.30** |
| schedule | 7 | -0.62 | **-0.05** | +0.18 | **-0.99** | -2.80 | **-1.59** |
| season_s2d | 24 | -0.90 | **-0.33** | -0.15 | **-1.32** | -1.73 | **-0.52** |
| heat | 20 | -0.79 | **-0.22** | -0.37 | **-1.54** | -1.39 | **-0.17** |
| possession | 32 | -2.33 | **-1.76** | -1.59 | **-2.76** | -1.39 | **-0.18** |
| star | 4 | -0.46 | **+0.11** | -2.69 | **-3.86** | -3.85 | **-2.64** |

Mean drop-one Δ **-0.65** (sd 1.37, 3 of 15 families improve the market when removed). A mean well above zero with a scattered ranking is dilution — read it as 'this market carries too many features', not as a shopping list.


### fg_total — solo

Does the family carry this market by itself? Redundant families look fine here and change nothing when dropped; load-bearing ones can look dead here.

| family | cols | top 10% | CONF top 10% |
|---|---|---|---|
| style_raw | 32 | +1.84 | -1.21 |
| roster | 10 | +0.63 | +0.20 |
| form_l5 | 28 | +0.09 | -1.55 |
| pctile | 32 | -0.93 | -1.75 |
| context | 9 | -1.47 | -1.56 |
| availability | 12 | -1.60 | +0.02 |
| heat | 20 | -2.24 | +0.37 |
| schedule | 7 | -2.35 | +0.70 |
| starters | 4 | -2.45 | -0.85 |
| adv | 6 | -2.56 | -1.91 |
| possession | 32 | -3.00 | -4.37 |
| star | 4 | -3.48 | -2.78 |
| kenpom | 10 | -4.23 | -2.64 |
| season_s2d | 24 | -4.56 | -5.97 |
| lineup | 6 | -5.97 | -9.85 |

## fg_spread

Baseline +7.28% on 1,720 bets (σ ±2.30). **A positive Δ means cutting that family HELPS this market.**

| family | cols | top 20% | Δ | top 10% | Δ | CONF top 10% | Δ |
|---|---|---|---|---|---|---|---|
| heat | 20 | +5.61 | **+0.61** | +8.60 | **+1.32** | +10.49 | **-0.53** |
| season_s2d | 24 | +6.38 | **+1.38** | +7.95 | **+0.67** | +10.48 | **-0.53** |
| form_l5 | 28 | +6.49 | **+1.50** | +7.49 | **+0.22** | +12.07 | **+1.06** |
| possession | 32 | +6.43 | **+1.43** | +7.27 | **-0.00** | +11.54 | **+0.53** |
| kenpom | 10 | +5.22 | **+0.23** | +7.16 | **-0.11** | +9.95 | **-1.06** |
| adv | 6 | +5.27 | **+0.27** | +7.16 | **-0.12** | +11.19 | **+0.17** |
| star | 4 | +5.49 | **+0.50** | +7.06 | **-0.21** | +11.91 | **+0.90** |
| style_raw | 32 | +4.72 | **-0.28** | +7.06 | **-0.22** | +10.14 | **-0.88** |
| pctile | 32 | +6.32 | **+1.33** | +6.49 | **-0.78** | +11.19 | **+0.18** |
| availability | 12 | +4.55 | **-0.45** | +6.28 | **-1.00** | +9.95 | **-1.06** |
| context | 9 | +5.60 | **+0.60** | +6.05 | **-1.23** | +11.54 | **+0.53** |
| roster | 10 | +5.11 | **+0.11** | +6.05 | **-1.23** | +8.70 | **-2.31** |
| lineup | 6 | +4.71 | **-0.28** | +5.28 | **-2.00** | +7.47 | **-3.54** |
| schedule | 7 | +4.55 | **-0.44** | +5.27 | **-2.00** | +10.12 | **-0.89** |
| starters | 4 | +5.15 | **+0.16** | +4.38 | **-2.90** | +9.40 | **-1.61** |

Mean drop-one Δ **-0.64** (sd 1.11, 3 of 15 families improve the market when removed). A mean well above zero with a scattered ranking is dilution — read it as 'this market carries too many features', not as a shopping list.


### fg_spread — solo

Does the family carry this market by itself? Redundant families look fine here and change nothing when dropped; load-bearing ones can look dead here.

| family | cols | top 10% | CONF top 10% |
|---|---|---|---|
| pctile | 32 | +8.83 | +8.88 |
| style_raw | 32 | +7.37 | +6.93 |
| availability | 12 | +1.65 | +2.26 |
| possession | 32 | +1.59 | +4.78 |
| lineup | 6 | +1.16 | +6.41 |
| heat | 20 | -0.39 | +4.99 |
| schedule | 7 | -0.96 | -1.66 |
| season_s2d | 24 | -1.61 | +4.28 |
| form_l5 | 28 | -1.62 | +0.21 |
| kenpom | 10 | -3.32 | -7.26 |
| star | 4 | -3.95 | -6.37 |
| starters | 4 | -4.72 | -4.06 |
| context | 9 | -4.76 | -4.98 |
| roster | 10 | -5.54 | -7.46 |
| adv | 6 | -6.39 | -6.37 |

## fg_ml

Baseline +3.08% on 1,732 bets (σ ±2.29). **A positive Δ means cutting that family HELPS this market.**

| family | cols | top 20% | Δ | top 10% | Δ | CONF top 10% | Δ |
|---|---|---|---|---|---|---|---|
| heat | 20 | +2.94 | **-0.63** | +5.18 | **+2.10** | +7.30 | **+2.10** |
| style_raw | 32 | +5.38 | **+1.81** | +4.39 | **+1.31** | +5.10 | **-0.10** |
| pctile | 32 | +4.04 | **+0.47** | +4.35 | **+1.27** | +5.39 | **+0.19** |
| context | 9 | +4.07 | **+0.50** | +3.93 | **+0.85** | +6.94 | **+1.74** |
| form_l5 | 28 | +5.46 | **+1.90** | +3.78 | **+0.71** | +6.07 | **+0.87** |
| possession | 32 | +5.72 | **+2.15** | +3.38 | **+0.30** | +5.39 | **+0.19** |
| adv | 6 | +3.56 | **-0.01** | +3.33 | **+0.25** | +5.39 | **+0.19** |
| kenpom | 10 | +3.98 | **+0.41** | +2.92 | **-0.16** | +4.85 | **-0.34** |
| schedule | 7 | +2.11 | **-1.46** | +2.85 | **-0.23** | +6.16 | **+0.96** |
| availability | 12 | +3.55 | **-0.02** | +2.52 | **-0.56** | +5.02 | **-0.17** |
| roster | 10 | +3.35 | **-0.22** | +2.35 | **-0.73** | +4.97 | **-0.23** |
| star | 4 | +4.95 | **+1.38** | +2.12 | **-0.96** | +5.23 | **+0.03** |
| season_s2d | 24 | +4.39 | **+0.83** | +2.05 | **-1.03** | +3.98 | **-1.21** |
| lineup | 6 | +2.48 | **-1.09** | +0.95 | **-2.13** | +1.11 | **-4.08** |
| starters | 4 | +2.41 | **-1.16** | +0.49 | **-2.59** | +5.46 | **+0.26** |

Mean drop-one Δ **-0.11** (sd 1.29, 7 of 15 families improve the market when removed). A mean well above zero with a scattered ranking is dilution — read it as 'this market carries too many features', not as a shopping list.


### fg_ml — solo

Does the family carry this market by itself? Redundant families look fine here and change nothing when dropped; load-bearing ones can look dead here.

| family | cols | top 10% | CONF top 10% |
|---|---|---|---|
| pctile | 32 | +3.14 | +5.46 |
| style_raw | 32 | +1.22 | +3.93 |
| heat | 20 | +0.99 | +2.14 |
| context | 9 | +0.39 | -3.94 |
| lineup | 6 | +0.32 | +1.22 |
| roster | 10 | +0.11 | -1.16 |
| star | 4 | -0.11 | -3.48 |
| availability | 12 | -0.34 | -0.72 |
| possession | 32 | -0.40 | -1.06 |
| starters | 4 | -1.63 | -3.80 |
| season_s2d | 24 | -1.73 | +1.29 |
| schedule | 7 | -1.95 | -0.97 |
| adv | 6 | -2.15 | -5.92 |
| kenpom | 10 | -2.41 | -4.01 |
| form_l5 | 28 | -3.47 | -3.06 |

## h1_total

Baseline +3.57% on 1,703 bets (σ ±2.31). **A positive Δ means cutting that family HELPS this market.**

| family | cols | top 20% | Δ | top 10% | Δ | CONF top 10% | Δ |
|---|---|---|---|---|---|---|---|
| form_l5 | 28 | +1.58 | **-0.71** | +7.54 | **+3.98** | +7.45 | **+1.94** |
| adv | 6 | +3.12 | **+0.84** | +5.88 | **+2.31** | +6.76 | **+1.25** |
| style_raw | 32 | +1.31 | **-0.97** | +5.80 | **+2.23** | +7.52 | **+2.01** |
| pctile | 32 | +1.80 | **-0.48** | +4.44 | **+0.88** | +5.52 | **+0.01** |
| availability | 12 | +1.98 | **-0.30** | +4.03 | **+0.46** | +4.67 | **-0.84** |
| roster | 10 | +1.86 | **-0.42** | +4.01 | **+0.44** | +8.18 | **+2.67** |
| season_s2d | 24 | +2.36 | **+0.08** | +3.90 | **+0.33** | +5.19 | **-0.32** |
| star | 4 | +3.01 | **+0.73** | +3.90 | **+0.33** | +6.92 | **+1.42** |
| context | 9 | +0.91 | **-1.37** | +3.84 | **+0.27** | +2.20 | **-3.31** |
| starters | 4 | +1.95 | **-0.33** | +3.68 | **+0.11** | +6.03 | **+0.52** |
| schedule | 7 | +1.85 | **-0.43** | +3.44 | **-0.13** | +7.47 | **+1.96** |
| lineup | 6 | +3.42 | **+1.14** | +2.80 | **-0.77** | +3.60 | **-1.91** |
| heat | 20 | +1.49 | **-0.79** | +2.79 | **-0.78** | +4.30 | **-1.21** |
| possession | 32 | +3.30 | **+1.02** | +2.39 | **-1.17** | +2.84 | **-2.67** |
| kenpom | 10 | +1.57 | **-0.71** | +1.90 | **-1.66** | +3.26 | **-2.25** |

Mean drop-one Δ **+0.46** (sd 1.46, 10 of 15 families improve the market when removed). A mean well above zero with a scattered ranking is dilution — read it as 'this market carries too many features', not as a shopping list.


### h1_total — solo

Does the family carry this market by itself? Redundant families look fine here and change nothing when dropped; load-bearing ones can look dead here.

| family | cols | top 10% | CONF top 10% |
|---|---|---|---|
| form_l5 | 28 | +2.46 | +0.70 |
| pctile | 32 | +1.63 | -0.47 |
| adv | 6 | +1.59 | +4.12 |
| heat | 20 | +1.38 | +0.24 |
| style_raw | 32 | +0.59 | +0.71 |
| kenpom | 10 | -0.33 | -1.92 |
| context | 9 | -0.79 | +0.58 |
| roster | 10 | -1.41 | -0.79 |
| season_s2d | 24 | -1.68 | +5.02 |
| lineup | 6 | -1.73 | -3.30 |
| possession | 32 | -2.12 | -0.60 |
| star | 4 | -2.31 | -3.31 |
| schedule | 7 | -3.01 | -2.99 |
| starters | 4 | -3.09 | -4.15 |
| availability | 12 | -4.63 | -2.07 |

## h1_spread

Baseline +2.68% on 1,701 bets (σ ±2.31). **A positive Δ means cutting that family HELPS this market.**

| family | cols | top 20% | Δ | top 10% | Δ | CONF top 10% | Δ |
|---|---|---|---|---|---|---|---|
| context | 9 | +4.94 | **+0.31** | +5.23 | **+2.55** | +9.16 | **-0.92** |
| season_s2d | 24 | +4.52 | **-0.11** | +4.68 | **+2.01** | +8.48 | **-1.61** |
| kenpom | 10 | +3.47 | **-1.16** | +4.54 | **+1.86** | +7.26 | **-2.82** |
| possession | 32 | +4.08 | **-0.55** | +4.14 | **+1.46** | +9.87 | **-0.21** |
| form_l5 | 28 | +2.81 | **-1.83** | +4.09 | **+1.41** | +7.45 | **-2.63** |
| star | 4 | +4.07 | **-0.56** | +3.88 | **+1.21** | +7.43 | **-2.65** |
| style_raw | 32 | +4.26 | **-0.37** | +3.58 | **+0.90** | +8.67 | **-1.41** |
| availability | 12 | +4.51 | **-0.12** | +3.30 | **+0.62** | +10.27 | **+0.19** |
| adv | 6 | +4.02 | **-0.61** | +3.12 | **+0.45** | +9.20 | **-0.88** |
| roster | 10 | +3.41 | **-1.23** | +2.88 | **+0.20** | +8.67 | **-1.42** |
| schedule | 7 | +5.14 | **+0.51** | +2.79 | **+0.11** | +9.34 | **-0.74** |
| lineup | 6 | +2.25 | **-2.39** | +2.75 | **+0.08** | +7.95 | **-2.13** |
| heat | 20 | +2.36 | **-2.27** | +2.12 | **-0.56** | +5.85 | **-4.23** |
| pctile | 32 | +4.20 | **-0.44** | +1.48 | **-1.19** | +6.40 | **-3.68** |
| starters | 4 | +3.52 | **-1.11** | +1.21 | **-1.47** | +7.07 | **-3.01** |

Mean drop-one Δ **+0.64** (sd 1.16, 12 of 15 families improve the market when removed). A mean well above zero with a scattered ranking is dilution — read it as 'this market carries too many features', not as a shopping list.


### h1_spread — solo

Does the family carry this market by itself? Redundant families look fine here and change nothing when dropped; load-bearing ones can look dead here.

| family | cols | top 10% | CONF top 10% |
|---|---|---|---|
| style_raw | 32 | +4.16 | -2.41 |
| roster | 10 | +2.36 | -1.45 |
| lineup | 6 | +2.35 | +1.73 |
| season_s2d | 24 | +1.61 | +0.70 |
| schedule | 7 | +1.58 | -3.92 |
| pctile | 32 | +1.56 | -1.36 |
| context | 9 | +1.47 | -4.01 |
| heat | 20 | +1.44 | +3.54 |
| adv | 6 | +0.57 | -0.58 |
| availability | 12 | +0.45 | -1.49 |
| possession | 32 | +0.19 | -3.33 |
| star | 4 | +0.12 | -1.09 |
| starters | 4 | +0.01 | -2.08 |
| form_l5 | 28 | -0.31 | +3.54 |
| kenpom | 10 | -1.21 | -1.89 |

## h1_ml

Baseline +0.83% on 1,651 bets (σ ±2.34). **A positive Δ means cutting that family HELPS this market.**

| family | cols | top 20% | Δ | top 10% | Δ | CONF top 10% | Δ |
|---|---|---|---|---|---|---|---|
| style_raw | 32 | +1.50 | **-0.48** | +2.11 | **+1.27** | +5.61 | **-1.72** |
| context | 9 | +0.90 | **-1.08** | +1.72 | **+0.89** | +6.61 | **-0.72** |
| adv | 6 | +0.44 | **-1.54** | +1.37 | **+0.54** | +6.84 | **-0.49** |
| availability | 12 | +1.39 | **-0.59** | +1.19 | **+0.36** | +7.72 | **+0.39** |
| roster | 10 | +1.01 | **-0.97** | +0.46 | **-0.37** | +6.10 | **-1.23** |
| season_s2d | 24 | +0.74 | **-1.24** | +0.39 | **-0.44** | +6.10 | **-1.23** |
| form_l5 | 28 | -0.60 | **-2.58** | +0.33 | **-0.50** | +5.75 | **-1.58** |
| star | 4 | +2.06 | **+0.08** | +0.11 | **-0.73** | +5.41 | **-1.93** |
| possession | 32 | -0.05 | **-2.03** | +0.05 | **-0.78** | +4.30 | **-3.03** |
| pctile | 32 | +2.42 | **+0.43** | -0.16 | **-0.99** | +6.73 | **-0.61** |
| starters | 4 | -0.53 | **-2.51** | -0.25 | **-1.09** | +5.37 | **-1.96** |
| kenpom | 10 | +0.61 | **-1.37** | -0.33 | **-1.16** | +5.21 | **-2.12** |
| schedule | 7 | +1.33 | **-0.65** | -0.42 | **-1.26** | +7.77 | **+0.44** |
| heat | 20 | -1.64 | **-3.62** | -1.04 | **-1.88** | +2.73 | **-4.61** |
| lineup | 6 | -1.27 | **-3.25** | -3.23 | **-4.06** | +1.65 | **-5.68** |

Mean drop-one Δ **-0.68** (sd 1.27, 4 of 15 families improve the market when removed). A mean well above zero with a scattered ranking is dilution — read it as 'this market carries too many features', not as a shopping list.


### h1_ml — solo

Does the family carry this market by itself? Redundant families look fine here and change nothing when dropped; load-bearing ones can look dead here.

| family | cols | top 10% | CONF top 10% |
|---|---|---|---|
| pctile | 32 | -2.01 | -4.15 |
| style_raw | 32 | -2.33 | -5.00 |
| possession | 32 | -3.43 | -4.44 |
| heat | 20 | -4.32 | +2.36 |
| lineup | 6 | -6.13 | -3.27 |
| form_l5 | 28 | -6.42 | -3.09 |
| kenpom | 10 | -6.68 | -1.62 |
| starters | 4 | -8.88 | -7.85 |
| roster | 10 | -9.24 | -7.68 |
| availability | 12 | -9.73 | -11.94 |
| adv | 6 | -9.85 | -14.32 |
| season_s2d | 24 | -10.55 | -3.07 |
| context | 9 | -11.44 | -13.21 |
| star | 4 | -13.09 | -13.01 |
| schedule | 7 | -14.06 | -15.07 |
