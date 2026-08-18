# NBA six-season — shipping models on the bought seasons; COVID in/out

8 nulls, pre-registered feature sets (spread CORE hl120, total T1 hl180).

**spread paired MAE shared (n=3,962): SIX 11.3043 vs NOCOV 11.3027, t +0.75** (positive = COVID inclusion hurts).
**total paired MAE shared (n=3,962): SIX 14.5145 vs NOCOV 14.5104, t +0.58** (positive = COVID inclusion hurts).

| market | config | window | cut | n | win% | base% | ROI | z |
|---|---|---|---|---|---|---|---|---|
| spread | SIX | SHARED 23-26 | ≥5 | 1,040 | 53.7 | 52.5 | +2.47 | +2.79 |
| spread | SIX | SHARED 23-26 | ≥8 | 282 | 57.8 | 52.5 | +10.43 | +7.54 |
| spread | SIX | NEW 21-23 | ≥5 | 577 | 52.5 | 52.5 | +0.28 | -0.19 |
| spread | SIX | NEW 21-23 | ≥8 | 123 | 52.0 | 50.4 | -0.63 | +1.02 |
| spread | NOCOV | SHARED 23-26 | ≥5 | 1,035 | 53.3 | 52.0 | +1.85 | +3.25 |
| spread | NOCOV | SHARED 23-26 | ≥8 | 280 | 56.8 | 51.4 | +8.49 | +8.20 |
| spread | NOCOV | NEW 21-23 | ≥5 | 273 | 48.0 | 52.7 | -8.37 | -4.87 |
| spread | NOCOV | NEW 21-23 | ≥8 | 63 | 50.8 | 50.8 | -2.99 | +1.54 |
| total | SIX | SHARED 23-26 | ≥5 | 1,142 | 57.6 | 50.5 | +9.99 | +12.63 |
| total | SIX | SHARED 23-26 | ≥8 | 399 | 61.4 | 53.9 | +17.20 | +10.01 |
| total | SIX | NEW 21-23 | ≥5 | 749 | 52.7 | 52.2 | +0.69 | -0.16 |
| total | SIX | NEW 21-23 | ≥8 | 282 | 56.0 | 50.7 | +6.97 | +3.96 |
| total | NOCOV | SHARED 23-26 | ≥5 | 1,159 | 57.1 | 50.5 | +9.04 | +10.23 |
| total | NOCOV | SHARED 23-26 | ≥8 | 412 | 62.4 | 53.9 | +19.07 | +12.01 |
| total | NOCOV | NEW 21-23 | ≥5 | 418 | 51.4 | 51.4 | -1.80 | -1.13 |
| total | NOCOV | NEW 21-23 | ≥8 | 152 | 52.0 | 50.7 | -0.77 | +0.23 |
