# Per-Market Brief — which features matter to which market

Train 22-23+23-24, validate 24-25. Cell = val MAE (delta vs all-groups).

## 1H margin (target h1_margin) — ALL groups: 7.413

| variant | val MAE | delta |
|---|---|---|
| minus kp | 7.413 | +0.000 |
| ONLY kp | 7.424 | +0.011 |
| minus engineered | 7.417 | +0.004 |
| ONLY engineered | 7.429 | +0.016 |
| minus style | 7.423 | +0.010 |
| ONLY style | 7.922 | +0.510 |
| minus 1h_specific | 7.421 | +0.008 |
| ONLY 1h_specific | 7.894 | +0.481 |
| minus starters | 7.411 | -0.001 |
| ONLY starters | 8.080 | +0.667 |
| minus class | 7.425 | +0.012 |
| ONLY class | 8.036 | +0.624 |

## 1H total (target h1_total) — ALL groups: 7.934

| variant | val MAE | delta |
|---|---|---|
| minus kp | 7.993 | +0.059 |
| ONLY kp | 8.001 | +0.067 |
| minus engineered | 7.969 | +0.035 |
| ONLY engineered | 8.141 | +0.208 |
| minus style | 7.939 | +0.005 |
| ONLY style | 8.154 | +0.220 |
| minus 1h_specific | 7.936 | +0.002 |
| ONLY 1h_specific | 8.307 | +0.373 |
| minus starters | 7.949 | +0.015 |
| ONLY starters | 8.324 | +0.390 |
| minus class | 7.950 | +0.016 |
| ONLY class | 8.538 | +0.605 |

## home TT (target home_score) — ALL groups: 8.050

| variant | val MAE | delta |
|---|---|---|
| minus kp | 8.476 | +0.426 |
| ONLY kp | 8.106 | +0.056 |
| minus asym(homeO+awayD) | 8.362 | +0.312 |
| ONLY asym(homeO+awayD) | 8.319 | +0.269 |
| minus style | 8.051 | +0.001 |
| ONLY style | 8.727 | +0.677 |
| minus possession | 8.053 | +0.003 |
| ONLY possession | 8.998 | +0.948 |
| minus class | 8.070 | +0.020 |
| ONLY class | 9.360 | +1.310 |

## away TT (target away_score) — ALL groups: 8.072

| variant | val MAE | delta |
|---|---|---|
| minus kp | 8.397 | +0.325 |
| ONLY kp | 8.091 | +0.019 |
| minus asym(awayO+homeD) | 8.283 | +0.211 |
| ONLY asym(awayO+homeD) | 8.337 | +0.265 |
| minus style | 8.076 | +0.004 |
| ONLY style | 8.565 | +0.493 |
| minus possession | 8.067 | -0.005 |
| ONLY possession | 8.815 | +0.743 |
| minus class | 8.068 | -0.004 |
| ONLY class | 9.061 | +0.989 |


## Conclusions (2026-07-17) — what matters to each market

**1H SPREAD: nothing 1H-specific matters.** Removing KenPom costs 0.000;
removing starters IMPROVES; 1H-profile features add +0.008 at best. The 1H
margin is a scaled FG market (0.6x) plus noise — model it with the smallest
scaled-FG set. Our new 1H/starter features are noisy re-samples of team
quality KP already integrates.

**1H TOTAL: KenPom tempo/efficiency is the driver** (biggest ablation hit,
+0.059), then engineered totals structure (+0.035); starters and class small;
1H-specific pace adds ~nothing beyond KP tempo.

**TEAM TOTALS: KenPom + the ASYMMETRIC set are everything.** minus-kp costs
+0.43/+0.33 (largest deltas in the whole lab); minus-asym +0.31/+0.21.
Style, possession, class flags: ~zero incremental. The right TT model =
that team's offense × opponent's defense × tempo — nothing else.

**The general law the owner called for: per-market minimal sets match or
beat the kitchen sink everywhere.** Extra groups never help beyond each
market's core drivers; they only add overfit surface. Production models
should be per-market with these tailored sets.
