# NBA — every remaining market, projected from the full-game model

3,839 games, seasons ['2022', '2023', '2024', '2025'], predictions from `p_blend`. Nothing is refit here: the margin and total models are projected into each market and priced off their own empirical residual distribution, walk-forward.

**Only the moneyline has an opening price in this data.** The 1H and team-total sections are graded at T-60 and inherit all the difficulty of betting into the close; they are not open-line results and must not be read as such.


## MONEYLINE — open price (side A = home)

P(home win) = P(margin > 0) from the margin model's own residual CDF, against the de-vigged opening moneyline.

| cut | n | win% | ROI | edge sign | per-season |
|---|---|---|---|---|---|
| top100% | 2,973 | 44.7 | -3.6 | 45% A | -/41/44/47 |
| top50% | 1,487 | 41.8 | -3.1 | 41% A | -/34/41/45 |
| top25% | 744 | 39.9 | -0.6 | 38% A | -/28/37/47 |
| top10% | 298 | 43.3 | +11.3 | 35% A | -/31/39/51 |

## HOME TEAM TOTAL — T-60 (side A = over)

Predicted home score = (predicted total + predicted margin) / 2.

| cut | n | win% | ROI | edge sign | per-season |
|---|---|---|---|---|---|
| top100% | 2,973 | 51.0 | -3.1 | 52% A | -/54/50/51 |
| top50% | 1,487 | 48.7 | -7.5 | 51% A | -/56/47/48 |
| top25% | 744 | 50.8 | -3.5 | 52% A | -/60/49/51 |
| top10% | 298 | 50.0 | -5.0 | 65% A | -/61/45/52 |

## 1H TOTAL — T-60 (side A = over)

Full-game total scaled by the first-half share of the total, estimated walk-forward.

| cut | n | win% | ROI | edge sign | per-season |
|---|---|---|---|---|---|
| top100% | 2,561 | 51.5 | -1.7 | 48% A | -/-/50/53 |
| top50% | 1,281 | 50.3 | -4.0 | 51% A | -/-/49/52 |
| top25% | 641 | 48.8 | -6.7 | 50% A | -/-/46/51 |
| top10% | 257 | 47.5 | -9.4 | 56% A | -/-/48/47 |

## 1H SPREAD — T-60 (side A = home)

Full-game margin scaled by the first-half share of the margin, estimated walk-forward.

| cut | n | win% | ROI | edge sign | per-season |
|---|---|---|---|---|---|
| top100% | 2,561 | 50.5 | -3.5 | 42% A | -/-/51/50 |
| top50% | 1,281 | 50.5 | -3.5 | 33% A | -/-/49/52 |
| top25% | 641 | 52.1 | -0.4 | 31% A | -/-/50/55 |
| top10% | 258 | 49.6 | -5.2 | 24% A | -/-/48/51 |
