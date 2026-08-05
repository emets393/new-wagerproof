# Combining the NBA full-game spread signals

n = 4,742 games. S9 fires on 328, HEAT on 579, xEFG on 949.

## Overlap and conflict — before any combined number

| pair | co-fire | agree | conflict | overlap as % of the smaller signal |
|---|---|---|---|---|
| S9 x HEAT | 23 | 12 | 11 | 7.0% |
| S9 x xEFG | 80 | 60 | 20 | 24.4% |
| HEAT x xEFG | 112 | 58 | 54 | 19.3% |

## Each signal alone, on this sample

| signal | bets | OPEN win% | OPEN ROI | T-60 win% | T-60 ROI | base% | fav in-sub% | T-60 by season |
|---|---|---|---|---|---|---|---|---|
| S9 dead-home fav | 326 | 61.9 | +18.2 | 58.3 | +11.3 | 53.4 | 58.3 | 2022:59 2023:52 2024:66 2025:57 |
| HEAT conc fade | 569 | 54.3 | +3.7 | 54.1 | +3.3 | 50.8 | 51.5 | 2022:53 2023:53 2024:53 2025:58 |
| xEFG process | 931 | 55.3 | +5.6 | 54.9 | +4.8 | 50.5 | 50.5 | 2022:49 2023:54 2024:63 2025:55 |

## Portfolio — the union of S9 and HEAT, contradictions dropped

A game where the two disagree has no defensible side and is not bet.

| signal | bets | OPEN win% | OPEN ROI | T-60 win% | T-60 ROI | base% | fav in-sub% | T-60 by season |
|---|---|---|---|---|---|---|---|---|
| S9 ∪ HEAT (union) | 862 | 56.8 | +8.4 | 55.3 | +5.6 | 51.3 | 53.0 | 2022:55 2023:52 2024:57 2025:57 |
|   S9 leg only | 315 | 61.5 | +17.5 | 57.8 | +10.3 | 53.3 | 57.8 | 2022:57 2023:50 2024:68 2025:57 |
|   HEAT leg only (non-overlapping) | 547 | 54.0 | +3.2 | 53.9 | +3.0 | 50.1 | 50.3 | 2022:53 2023:54 2024:51 2025:57 |

## Confluence — where both fire and AGREE

The NFL lesson is that aligned signals sharing an information source are redundant, not confirming. These two do not share one (standings vs shot-location regression), so this is the case where confluence can legitimately work. Small n is the binding constraint, and it is reported rather than smoothed over.

| signal | bets | OPEN win% | OPEN ROI | T-60 win% | T-60 ROI | base% | fav in-sub% | T-60 by season |
|---|---|---|---|---|---|---|---|---|

## Does the process feature add to S9?

xEFG is a feature, not a rule. The useful question is whether it GATES S9: back the favourite only when shot-quality process also favours it.

| signal | bets | OPEN win% | OPEN ROI | T-60 win% | T-60 ROI | base% | fav in-sub% | T-60 by season |
|---|---|---|---|---|---|---|---|---|
| S9 + xEFG agrees | 213 | 64.6 | +23.4 | 61.0 | +16.5 | 53.5 | 61.0 | 2022:63 2023:53 2024:71 2025:58 |
| S9 + xEFG disagrees | 113 | 56.8 | +8.4 | 53.1 | +1.4 | 53.1 | 53.1 | 2022:52 2023:50 2024:57 2025:55 |

## Per-season bet volume of the portfolio

| season | S9 | HEAT | union | conflicts dropped |
|---|---|---|---|---|
| 2022 | 80 | 95 | 163 | 5 |
| 2023 | 86 | 177 | 252 | 3 |
| 2024 | 80 | 158 | 232 | 2 |
| 2025 | 82 | 149 | 226 | 1 |
