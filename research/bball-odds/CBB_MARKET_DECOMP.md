# CBB — separating the two confounds

`cbb_market_models.py --stage decomp`. Part A splits the first-half improvement into its feature-set half and its half-life half. Part B asks whether the conference restriction dies on the UNCUT spread model too, or only under a cut the gate run could not separate from no-cut at matched bet count.

**n is printed everywhere on purpose.** A configuration with fewer features makes less volatile predictions and so places fewer bets at a fixed points cut; a ROI gap that arrives with a big bet-count gap is a strategy difference, not a feature-set one.


## A. The first-half markets — was it the cut or the memory?


### First-half total

| features | half-life | cut | bets | win% | base% | edge | ROI | z |
|---|---|---|---|---|---|---|---|---|
| 202 | 240d | adv, season_s2d, star | 2,311 | 55.2 | 51.9 | +3.3 | **+4.4** | **+2.62** |
| 202 | 365d | adv, season_s2d, star | 2,055 | 55.7 | 51.2 | +4.5 | **+5.3** | **+2.72** |
| 236 | 240d | nothing | 2,454 | 54.7 | 53.1 | +1.6 | **+3.4** | **+1.70** |
| 236 | 365d | nothing | 2,183 | 55.6 | 52.8 | +2.8 | **+5.1** | **+1.96** |

| config | season | bets | win% | base% | edge | ROI |
|---|---|---|---|---|---|---|
| CUT 240d | 2023-24 | 881 | 54.6 | 51.2 | +3.4 | **+3.5** |
| CUT 240d | 2024-25 | 775 | 57.0 | 54.3 | +2.7 | **+7.4** |
| CUT 240d | 2025-26 | 655 | 53.9 | 53.3 | +0.6 | **+1.9** |
| CUT 365d | 2023-24 | 834 | 54.9 | 52.0 | +2.9 | **+4.1** |
| CUT 365d | 2024-25 | 666 | 57.7 | 54.1 | +3.6 | **+8.6** |
| CUT 365d | 2025-26 | 555 | 54.6 | 52.6 | +2.0 | **+3.1** |
| ALL 240d | 2023-24 | 938 | 53.6 | 50.6 | +3.0 | **+1.7** |
| ALL 240d | 2024-25 | 805 | 56.6 | 55.9 | +0.7 | **+6.7** |
| ALL 240d | 2025-26 | 711 | 53.9 | 53.2 | +0.7 | **+1.8** |
| ALL 365d | 2023-24 | 888 | 53.9 | 50.1 | +3.8 | **+2.3** |
| ALL 365d | 2024-25 | 697 | 58.1 | 55.8 | +2.3 | **+9.5** |
| ALL 365d | 2025-26 | 598 | 55.2 | 53.2 | +2.0 | **+4.2** |


### First-half spread

| features | half-life | cut | bets | win% | base% | edge | ROI | z |
|---|---|---|---|---|---|---|---|---|
| 220 | 240d | context, schedule | 3,600 | 55.4 | 53.5 | +1.9 | **+5.0** | **+2.45** |
| 220 | 365d | context, schedule | 3,241 | 55.3 | 53.9 | +1.4 | **+4.8** | **+2.71** |
| 236 | 240d | nothing | 3,422 | 55.3 | 52.8 | +2.5 | **+4.7** | **+3.27** |
| 236 | 365d | nothing | 3,062 | 55.4 | 52.6 | +2.8 | **+5.0** | **+3.19** |

| config | season | bets | win% | base% | edge | ROI |
|---|---|---|---|---|---|---|
| CUT 240d | 2023-24 | 1,205 | 52.3 | 51.0 | +1.2 | **-0.9** |
| CUT 240d | 2024-25 | 1,179 | 56.1 | 54.5 | +1.7 | **+6.5** |
| CUT 240d | 2025-26 | 1,216 | 57.8 | 55.1 | +2.7 | **+9.3** |
| CUT 365d | 2023-24 | 1,164 | 52.6 | 51.5 | +1.0 | **-0.3** |
| CUT 365d | 2024-25 | 1,032 | 55.3 | 55.0 | +0.3 | **+4.9** |
| CUT 365d | 2025-26 | 1,045 | 58.4 | 55.4 | +3.0 | **+10.3** |
| ALL 240d | 2023-24 | 1,125 | 51.9 | 51.1 | +0.8 | **-1.6** |
| ALL 240d | 2024-25 | 1,115 | 56.6 | 53.7 | +2.9 | **+7.3** |
| ALL 240d | 2025-26 | 1,182 | 57.2 | 53.5 | +3.7 | **+8.1** |
| ALL 365d | 2023-24 | 1,085 | 52.2 | 51.3 | +0.8 | **-1.1** |
| ALL 365d | 2024-25 | 969 | 57.2 | 53.3 | +3.9 | **+8.4** |
| ALL 365d | 2025-26 | 1,008 | 57.2 | 53.5 | +3.8 | **+8.2** |


## B. Does non-conference come alive without the cut?

The same three slices `CBB_MARKET_CONFIRM.md` graded on the 164-feature CUT spread model, graded again on the 236-feature UNCUT one. If non-conference is only alive under the cut, and the cut is not separable from no-cut, the restriction stays.


### UNCUT (236)

| cut | slice | bets | win% | base% | edge | ROI | z |
|---|---|---|---|---|---|---|---|
| ≥1.5 | all games | 5,372 | 54.9 | 50.8 | +4.1 | **+4.8** | **+5.15** |
| ≥1.5 | CONFERENCE | 3,087 | 56.9 | 50.6 | +6.3 | **+8.8** | **+4.21** |
| ≥1.5 | non-conference | 2,285 | 52.1 | 51.0 | +1.1 | **-0.5** | **+1.78** |
| ≥2 | all games | 3,170 | 55.0 | 50.2 | +4.8 | **+5.1** | **+4.03** |
| ≥2 | CONFERENCE | 1,732 | 57.2 | 50.2 | +7.0 | **+9.2** | **+2.26** |
| ≥2 | non-conference | 1,438 | 52.5 | 50.7 | +1.8 | **+0.3** | **+1.50** |
| ≥3 | all games | 909 | 57.2 | 51.5 | +5.7 | **+9.3** | **+2.22** |
| ≥3 | CONFERENCE | 408 | 60.3 | 52.2 | +8.1 | **+15.2** | **+1.29** |
| ≥3 | non-conference | 501 | 54.7 | 50.9 | +3.8 | **+4.5** | **+1.76** |


### CUT (164)

| cut | slice | bets | win% | base% | edge | ROI | z |
|---|---|---|---|---|---|---|---|
| ≥1.5 | all games | 4,373 | 55.6 | 50.3 | +5.2 | **+6.1** | **+5.37** |
| ≥1.5 | CONFERENCE | 2,625 | 56.5 | 50.7 | +5.7 | **+7.8** | **+3.24** |
| ≥1.5 | non-conference | 1,748 | 54.2 | 50.3 | +3.9 | **+3.6** | **+2.62** |
| ≥2 | all games | 2,368 | 56.7 | 50.3 | +6.4 | **+8.3** | **+3.28** |
| ≥2 | CONFERENCE | 1,358 | 57.7 | 50.3 | +7.4 | **+10.1** | **+2.45** |
| ≥2 | non-conference | 1,010 | 55.4 | 50.4 | +5.0 | **+5.9** | **+2.39** |
| ≥3 | all games | 593 | 58.2 | 50.9 | +7.3 | **+11.1** | **+1.70** |
| ≥3 | CONFERENCE | 281 | 57.7 | 54.8 | +2.8 | **+10.1** | **+1.67** |
| ≥3 | non-conference | 312 | 58.7 | 52.6 | +6.1 | **+12.1** | **+1.00** |

