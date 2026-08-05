# NBA usage concentration — which window, and does the CHANGE matter?

The per-feature audit made `a_l5_top_min_share` the best column in the total model and `a_l10_top_min_share` the worst. This file decides whether that is a real short-window effect or an artefact of two near-identical columns splitting one coefficient.

## 1. How collinear are the windows?

If two windows of the same stat correlate above about 0.9, permutation importance cannot separate them: shuffling one leaves the other to carry the prediction. That would make the audit's L5-vs-L10 split a coin flip, not a finding.

| stat | n | l3~l5 | l5~l10 | l3~l10 | l10~s2d |
|---|---|---|---|---|---|
| `top_min_share` | 10,324 | 0.897 | **0.897** | 0.795 | 0.851 |
| `min_hhi` | 10,324 | 0.900 | **0.899** | 0.800 | 0.849 |
| `pts_hhi` | 10,324 | 0.881 | **0.881** | 0.769 | 0.845 |
| `adv_usg_max` | 10,324 | 0.875 | **0.868** | 0.750 | 0.836 |
| `adv_rot_n` | 10,324 | 0.898 | **0.896** | 0.795 | 0.831 |
| `adv_usage_percentage` | 10,324 | 0.815 | **0.797** | 0.653 | 0.757 |

## 2a. Mechanism — forecasting the stat itself next game

Correlation between each pregame window and what the team actually does in the next game. `t change` is the t-statistic on `l5 − l10` in a regression that already contains the `l10` level: it asks whether *concentration just moved* carries anything beyond *concentration is high*. |t| above ~2.6 is real at this sample size.

| stat | n | L3 | L5 | L10 | season-to-date | t change |
|---|---|---|---|---|---|---|
| `top_min_share` | 10,324 | +0.3592 | +0.3910 | **+0.4049** | +0.3825 | +7.01 |
| `min_hhi` | 10,324 | +0.3770 | +0.4031 | **+0.4161** | +0.3906 | +7.40 |
| `pts_hhi` | 10,324 | +0.2932 | +0.3238 | +0.3445 | **+0.3482** | +4.65 |
| `adv_usg_max` | 10,322 | +0.2755 | +0.3011 | +0.3198 | **+0.3355** | +5.08 |
| `adv_rot_n` | 10,322 | +0.3773 | +0.4034 | **+0.4175** | +0.3771 | +7.39 |
| `adv_usage_percentage` | 10,322 | +0.0906 | +0.1021 | +0.1299 | **+0.1445** | -0.25 |

## 2b. Mechanism — forecasting the team's own points next game

Correlation between each pregame window and what the team actually does in the next game. `t change` is the t-statistic on `l5 − l10` in a regression that already contains the `l10` level: it asks whether *concentration just moved* carries anything beyond *concentration is high*. |t| above ~2.6 is real at this sample size.

| stat | n | L3 | L5 | L10 | season-to-date | t change |
|---|---|---|---|---|---|---|
| `top_min_share` | 10,324 | **-0.0581** | -0.0560 | -0.0520 | -0.0454 | -2.15 |
| `min_hhi` | 10,324 | **-0.0523** | -0.0475 | -0.0396 | -0.0221 | -2.77 |
| `pts_hhi` | 10,324 | **-0.0210** | -0.0119 | -0.0079 | -0.0060 | -1.06 |
| `adv_usg_max` | 10,324 | -0.0015 | **-0.0061** | -0.0049 | -0.0052 | -0.37 |
| `adv_rot_n` | 10,324 | **+0.0155** | +0.0091 | +0.0065 | -0.0004 | +0.76 |
| `adv_usage_percentage` | 10,324 | +0.0015 | +0.0008 | -0.0077 | **-0.0230** | +1.17 |

## 3. Window ablation — restrict the usage block to ONE window

Each row keeps the whole incumbent model but allows the usage-concentration family only one lookback. Within an arm there is no collinearity between windows, so this measures the window directly instead of measuring how the ridge split a coefficient between two copies of the same number.

| usage window | cols | oos corr | n | win% | base% | edge | ROI |
|---|---|---|---|---|---|---|---|
| l3 only (24 usage cols) | 383 | +0.0446 | 2193 | 52.3 | 50.8 | **+1.5** | -0.2 |
| l5 only (24 usage cols) | 383 | +0.0580 | 2245 | 53.3 | 50.4 | **+2.9** | +1.8 |
| l10 only (24 usage cols) | 383 | +0.0512 | 2197 | 52.4 | 50.6 | **+1.8** | +0.0 |
| s2d only (24 usage cols) | 383 | +0.0474 | 2182 | 52.6 | 51.1 | **+1.5** | +0.4 |
| all four windows (incumbent, 96 usage cols) | 455 | +0.0653 | 2301 | 53.5 | 50.0 | **+3.5** | +2.2 |
| usage block REMOVED | 359 | +0.0407 | 2139 | 52.0 | 50.9 | **+1.1** | -0.7 |

## 4. The change features, and dropping the dead blocks

`cw_d510_*` is the five-game mean minus the ten-game mean: concentration just moved. The dead blocks are the three the audit found with a zero or near-zero hit rate — the situational interactions, the schedule theme, and the four structural columns.

| feature set | cols | oos corr | n | win% | base% | edge | ROI |
|---|---|---|---|---|---|---|---|
| incumbent | 455 | +0.0653 | 2301 | 53.5 | 50.0 | **+3.5** | +2.2 |
| incumbent + change features | 503 | +0.0684 | 2351 | 53.3 | 50.0 | **+3.2** | +1.7 |
| incumbent − dead blocks (19 cols) | 436 | +0.0652 | 2295 | 53.5 | 50.0 | **+3.4** | +2.1 |
| both: − dead blocks + change features | 484 | +0.0683 | 2332 | 53.3 | 50.2 | **+3.1** | +1.7 |

## 5. Label-shuffle null (6 draws, within season) — how big is 'nothing'?

Nineteen feature sets were tried against one label above. The null prices that search: an arm has to clear the shuffle band, not zero.

| statistic | real | null mean | null sd | z |
|---|---|---|---|---|
| oos corr | +0.0683 | +0.0065 | 0.0096 | **+6.44** |
| edge @ ≥2 | +3.09 | -0.55 | 0.93 | **+3.92** |

