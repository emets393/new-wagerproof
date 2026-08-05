# CBB — is the model more right where it disagrees more?

`cbb_market_models.py --stage bands`. Every game sits in exactly one band by |model − line|. **Nothing is filtered and no band is a subset of another**, so unlike the ROI ladder these rows cannot inherit each other's selection.

`model better by` is the market's mean absolute error minus the model's, inside that band, paired per game. **Positive means the model beat the line on those games.** The claim under the whole bet rule is that this column RISES down the table.

Watch `market MAE` too: if it rises with the band, the market is finding those games harder and part of any gain is the market getting worse rather than the model better.


## Team total

| band (|model − line|, pts) | games | model MAE | market MAE | model better by | paired t | win% | ROI |
|---|---|---|---|---|---|---|---|
| 0–0.5 | 10,541 | 7.968 | 7.977 | **+0.008** | **+3.02** | 50.9 | **-4.3** |
| 0.5–1 | 8,809 | 7.971 | 7.979 | **+0.008** | **+0.96** | 51.6 | **-3.1** |
| 1–1.5 | 6,216 | 7.860 | 7.864 | **+0.004** | **+0.29** | 52.4 | **-1.9** |
| 1.5–2 | 3,602 | 8.067 | 8.038 | **-0.029** | **-1.03** | 52.2 | **-2.6** |
| 2–3 | 2,875 | 7.869 | 7.894 | **+0.025** | **+0.58** | 55.5 | **+3.1** |
| 3–4 | 565 | 8.576 | 8.402 | **-0.174** | **-1.29** | 54.0 | **+0.2** |


## Full-game total

| band (|model − line|, pts) | games | model MAE | market MAE | model better by | paired t | win% | ROI |
|---|---|---|---|---|---|---|---|
| 0–0.5 | 3,601 | 12.954 | 12.960 | **+0.006** | **+1.20** | 50.4 | **-3.7** |
| 0.5–1 | 3,371 | 13.146 | 13.155 | **+0.009** | **+0.73** | 51.3 | **-2.0** |
| 1–1.5 | 2,928 | 12.817 | 12.829 | **+0.013** | **+0.55** | 51.5 | **-1.6** |
| 1.5–2 | 2,234 | 13.211 | 13.171 | **-0.040** | **-1.09** | 50.4 | **-3.8** |
| 2–3 | 2,913 | 13.428 | 13.415 | **-0.013** | **-0.30** | 52.1 | **-0.5** |
| 3–4 | 1,375 | 13.103 | 12.898 | **-0.205** | **-2.29** | 51.3 | **-2.0** |
| 4+ | 871 | 13.705 | 13.371 | **-0.333** | **-2.05** | 53.2 | **+1.5** |


## Full-game spread

| band (|model − line|, pts) | games | model MAE | market MAE | model better by | paired t | win% | ROI |
|---|---|---|---|---|---|---|---|
| 0–0.5 | 5,327 | 9.076 | 9.080 | **+0.004** | **+1.06** | 50.9 | **-2.8** |
| 0.5–1 | 4,414 | 8.932 | 8.944 | **+0.012** | **+1.05** | 51.3 | **-2.1** |
| 1–1.5 | 3,082 | 8.833 | 8.862 | **+0.029** | **+1.30** | 52.9 | **+1.1** |
| 1.5–2 | 2,005 | 8.845 | 8.907 | **+0.062** | **+1.62** | 54.2 | **+3.6** |
| 2–3 | 1,775 | 8.893 | 9.030 | **+0.137** | **+2.46** | 56.2 | **+7.4** |
| 3–4 | 468 | 9.064 | 9.258 | **+0.194** | **+1.30** | 59.2 | **+13.1** |
| 4+ | 125 | 9.359 | 8.760 | **-0.599** | **-1.60** | 54.4 | **+3.9** |


## First-half spread

| band (|model − line|, pts) | games | model MAE | market MAE | model better by | paired t | win% | ROI |
|---|---|---|---|---|---|---|---|
| 0–0.5 | 5,857 | 7.416 | 7.416 | **+0.000** | **+0.01** | 49.9 | **-5.5** |
| 0.5–1 | 4,736 | 7.254 | 7.254 | **+0.000** | **+0.00** | 50.9 | **-3.4** |
| 1–1.5 | 3,169 | 7.119 | 7.128 | **+0.009** | **+0.43** | 52.5 | **-0.5** |
| 1.5–2 | 1,771 | 7.339 | 7.402 | **+0.063** | **+1.57** | 55.2 | **+4.6** |
| 2–3 | 1,238 | 7.524 | 7.580 | **+0.057** | **+0.86** | 55.7 | **+5.4** |
| 3–4 | 196 | 8.376 | 8.163 | **-0.213** | **-0.94** | 53.1 | **+0.5** |

