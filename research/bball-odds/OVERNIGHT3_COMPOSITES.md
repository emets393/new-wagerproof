# Overnight 3 — composites, props mechanism, 1H gate


## P1 CBB assembled rule — marginal value of each layer

| layer | n | win% | ROI | per season |
|---|---|---|---|---|
| L0 ship band (baseline) | 7,533 | 54.9% | +4.9% | 21-: 679/1236 +5% · 22-: 947/1722 +5% · 23-: 870/1555 +7% · 24-: 893/1639 +4% · 25-: 749/1381 +4% |
| L1 + steam filter (CONFIRMED) | 5,563 | 55.8% | +6.5% | 21-: 590/1048 +7% · 22-: 749/1347 +6% · 23-: 628/1107 +8% · 24-: 629/1157 +4% · 25-: 506/904 +7% |
| L2 + ≥1 signal agrees (menu) | 1,575 | 59.0% | +12.6% | 21-: 193/319 +15% · 22-: 218/364 +14% · 23-: 179/310 +10% · 24-: 173/302 +9% · 25-: 166/280 +13% |
| L3 + ≥2 signals agree (menu) | 249 | 59.0% | +12.8% | 21-: 32/54 +13% · 22-: 39/64 +16% · 23-: 32/57 +7% · 24-: 27/42 +21% · 25-: 17/32 +2% |
| [dropped by L1] | 1,970 | 52.6% | +0.4% | 21-: 89/188 -10% · 22-: 198/375 +1% · 23-: 242/448 +3% · 24-: 264/482 +5% · 25-: 243/477 -3% |

P2: no team column on props frame — columns: date, season_x, pkey, actual, cons_line, y_cons, y_best_over, y_best_under, cons_over_dec, cons_under_dec, best_over_dec, best_under_dec, lgbm, ridge, avg5, sd10, prev_line, layoff, run_over, run_under, vs_form, vs_prev_line, z_form, z_prev_line, ok, edge, model_over, market, prio

## P3 NCAAB — FG total model gates the 1H total (3 odds seasons)

| cell | n | win% | ROI | per season |
|---|---|---|---|---|
| [ctl] FG model <5 → 1H follow sign | 16,749 | 51.6% | -2.5% | 23-: 2755/5466 -4% · 24-: 2950/5642 -1% · 25-: 2933/5641 -2% |

## P3 NBA — FG total model gates the 1H total (3 odds seasons)

| cell | n | win% | ROI | per season |
|---|---|---|---|---|
| FG model ≥8 OVER → 1H OVER | 229 | 51.5% | -1.7% | 23-: 32/69 -11% · 24-: 37/81 -13% · 25-: 49/79 +18% |

## P3 NBA — FG total model gates the 1H total (3 odds seasons)

| cell | n | win% | ROI | per season |
|---|---|---|---|---|
| FG model ≥8 UNDER → 1H UNDER | 170 | 57.1% | +9.2% | 23-: 16/30 +2% · 24-: 37/60 +18% · 25-: 44/80 +5% |

## P3 NBA — FG total model gates the 1H total (3 odds seasons)

| cell | n | win% | ROI | per season |
|---|---|---|---|---|
| [ctl] FG model <5 → 1H follow sign | 2,779 | 49.3% | -5.9% | 23-: 477/973 -6% · 24-: 467/927 -4% · 25-: 427/879 -7% |
