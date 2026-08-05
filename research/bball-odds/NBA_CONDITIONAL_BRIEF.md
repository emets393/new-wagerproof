# NBA model as a conviction layer on S7 / S8

3,173 games with a T-60 1H line AND a rolling-origin model prediction, seasons [2023, 2024, 2025]. BE 52.4%. Model edges are the honest walk-forward ones.

## A — do the validated signals reproduce on this frame?

| signal | n | win% | ROI | per-season |
|---|---|---|---|---|
| S7 shared 3+ 1H o/u streak -> FADE (1H total) | 106 | 62.3 | +18.8 | 54/62/67 |
| ...shared OVER streak -> bet UNDER | 52 | 63.5 | +21.2 | -/-/73 |
| ...shared UNDER streak -> bet OVER | 54 | 61.1 | +16.5 | -/-/62 |
| S8 moderate fresh absence -> BACK depleted (1H spread) | 178 | 64.6 | +23.1 | 64/66/63 |

## B — model AGREEMENT as a second filter

| population | model | tier | n | win% | ROI | per-season |
|---|---|---|---|---|---|---|
| S7 (1H total) | ens_share | AGREE | 56 | 60.7 | +15.7 | -/-/67 |
| S7 (1H total) | ens_share | DISAGREE | 50 | 64.0 | +22.2 | -/-/- |
| S7 (1H total) | ens_anch | AGREE | 65 | 61.5 | +17.5 | -/67/67 |
| S7 (1H total) | ens_anch | DISAGREE | 41 | 63.4 | +20.9 | -/-/- |
| S7 (1H total) | ens_all | AGREE | 58 | 63.8 | +21.8 | -/-/68 |
| S7 (1H total) | ens_all | DISAGREE | 48 | 60.4 | +15.2 | -/-/- |
| S8 (1H spread) | ens_share | model |edge| high | 90 | 60.0 | +14.4 | 52/60/68 |
| S8 (1H spread) | ens_share | low | 88 | 69.3 | +32.0 | 80/70/58 |

## C — is the model's own edge better INSIDE the mispriced populations?

| population | cut | n | win% | ROI | per-season |
|---|---|---|---|---|---|
| ALL games | all | 3142 | 48.9 | -6.7 | 45/50/49 |
| ALL games | top50% | 1575 | 48.3 | -7.9 | 43/49/50 |
| ALL games | top25% | 786 | 47.7 | -9.0 | 42/49/50 |
| S7 shared-streak | all | 106 | 49.1 | -6.5 | 35/57/51 |
| S7 shared-streak | top50% | 53 | 56.6 | +7.9 | -/-/- |
| S7 shared-streak | top25% | 27 | 48.1 | -8.1 | -/-/- |
| either team 3+ 1H o/u streak | all | 1027 | 48.5 | -7.5 | 42/50/51 |
| either team 3+ 1H o/u streak | top50% | 512 | 47.9 | -8.7 | 41/47/54 |
| either team 3+ 1H o/u streak | top25% | 256 | 47.7 | -9.1 | 38/52/52 |
| either team 18+ppg fresh out | all | 618 | 50.2 | -4.3 | 48/49/53 |
| either team 18+ppg fresh out | top50% | 309 | 49.5 | -5.5 | 43/47/56 |
| either team 18+ppg fresh out | top25% | 155 | 49.7 | -5.2 | 36/47/59 |
| no absence, no streak | all | 1547 | 48.2 | -7.9 | 46/50/47 |
| no absence, no streak | top50% | 777 | 47.1 | -10.0 | 43/49/47 |
| no absence, no streak | top25% | 388 | 46.6 | -11.0 | 47/47/46 |
