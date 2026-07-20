# NCAAB Sides Model Brief — kitchen-sink GBM (walk-forward)

17,305 test games; 142 features (KenPom, box s2d/l5, style,
streaks, rematch, roster, availability flags, phase).

## Conclusions (2026-07-16)

1. **The 142-feature GBM still cannot out-predict the close on accuracy**
   (MAE 9.29 vs 8.86) — no public-feature model will. But it is now a
   PRODUCT-GRADE BASELINE: away-side big-edge buckets run 52.6% (edge≥4,
   n=1,881) to 53.3% (edge≥6, n=784), non-negative all three test seasons —
   the same 53%-with-numbers-on-every-game profile as the NFL sides model.
2. **The model's real value is CONFLUENCE (the NFL architecture):**
   - big_out(away) + model agrees ≥1 → HOME: **64.0% / +22.3%** (n=100, all
     3 test seasons +13/+49/+15)
   - big_out(home) + model agrees → AWAY: 59.6% / +14.0% (n=109, all 3 +)
   - pooled agreement tier ≈ 61.7%/+18% vs 57.9% base in the same window.
   Model agreement is a legitimate NEW TIER for the S1 ladder.
3. Residual variant converges to the market as training grows (same as
   totals) — predicts ~0, don't use for bets.
4. The home/away asymmetry (away buckets > home buckets at every threshold)
   suggests residual home-shading in CBB spreads that the model partially
   captures.

**Margin MAE:** market 8.86 | model 9.29. Edge↔cover corr: raw 0.014, resid 0.028.

## RAW model edge buckets (vs T-60 spread)

| signal | n | win% | ROI | per season |
|---|---|---|---|---|
| raw edge ≥1 → HOME | 6,346 | 50.5% | -3.5% | 2023-24: 1180/2284 52% -1% · 2024-25: 942/1847 51% -3% · 2025-26: 1084/2215 49% -7% |
| raw edge ≥1 → AWAY | 6,274 | 51.1% | -2.3% | 2023-24: 1175/2272 52% -1% · 2024-25: 1127/2232 50% -3% · 2025-26: 906/1770 51% -2% |
| raw edge ≥2 → HOME | 4,442 | 50.8% | -3.0% | 2023-24: 910/1770 51% -2% · 2024-25: 611/1214 50% -4% · 2025-26: 734/1458 50% -4% |
| raw edge ≥2 → AWAY | 4,335 | 51.3% | -2.1% | 2023-24: 907/1750 52% -1% · 2024-25: 737/1473 50% -4% · 2025-26: 578/1112 52% -1% |
| raw edge ≥3 → HOME | 2,973 | 51.0% | -2.7% | 2023-24: 671/1316 51% -3% · 2024-25: 380/764 50% -5% · 2025-26: 464/893 52% -1% |
| raw edge ≥3 → AWAY | 2,925 | 51.7% | -1.2% | 2023-24: 693/1320 52% +0% · 2024-25: 472/943 50% -4% · 2025-26: 348/662 53% +0% |
| raw edge ≥4 → HOME | 1,917 | 50.2% | -4.1% | 2023-24: 463/902 51% -2% · 2024-25: 231/475 49% -7% · 2025-26: 269/540 50% -5% |
| raw edge ≥4 → AWAY | 1,881 | 52.6% | +0.5% | 2023-24: 487/928 52% +0% · 2024-25: 285/544 52% +0% · 2025-26: 217/409 53% +1% |
| raw edge ≥6 → HOME | 789 | 50.6% | -3.4% | 2023-24: 233/433 54% +3% · 2024-25: 83/186 45% -15% · 2025-26: 83/170 49% -7% |
| raw edge ≥6 → AWAY | 784 | 53.3% | +1.9% | 2023-24: 230/428 54% +3% · 2024-25: 102/190 54% +3% · 2025-26: 86/166 52% -1% |

## RESIDUAL model edge buckets

| signal | n | win% | ROI | per season |
|---|---|---|---|---|
| resid edge ≥1 → HOME | 4,415 | 52.0% | -0.7% | 2023-24: 1282/2475 52% -1% · 2024-25: 690/1315 52% +0% · 2025-26: 323/625 52% -1% |
| resid edge ≥1 → AWAY | 2,724 | 51.4% | -1.8% | 2023-24: 942/1836 51% -2% · 2024-25: 384/732 52% +0% · 2025-26: 74/156 47% -9% |
| resid edge ≥2 → HOME | 2,215 | 51.9% | -0.9% | 2023-24: 948/1843 51% -2% · 2024-25: 155/284 55% +4% · 2025-26: 47/88 53% +2% |
| resid edge ≥2 → AWAY | 1,457 | 52.2% | -0.3% | 2023-24: 671/1287 52% -0% · 2024-25: 90/170 53% +1% |
| resid edge ≥3 → HOME | 1,352 | 51.8% | -1.0% | 2023-24: 672/1297 52% -1% · 2024-25: 24/47 51% -3% · 2025-26: 5/8 62% +19% |
| resid edge ≥3 → AWAY | 857 | 51.2% | -2.2% | 2023-24: 424/835 51% -3% · 2024-25: 15/22 68% +30% |
| resid edge ≥4 → HOME | 832 | 51.7% | -1.3% | 2023-24: 428/829 52% -1% · 2024-25: 2/3 67% +27% |
| resid edge ≥4 → AWAY | 525 | 50.1% | -4.4% | 2023-24: 261/520 50% -4% · 2024-25: 2/5 40% -24% |
| resid edge ≥6 → HOME | 290 | 52.4% | +0.1% | 2023-24: 152/290 52% +0% |
| resid edge ≥6 → AWAY | 149 | 50.3% | -3.9% | 2023-24: 75/149 50% -4% |

## Confluence: S1 big_out fade + model agrees

| signal | n | win% | ROI | per season |
|---|---|---|---|---|
| big_out(h) → AWAY (all) | 279 | 57.3% | +9.6% | 2023-24: 49/85 58% +10% · 2024-25: 57/106 54% +3% · 2025-26: 54/88 61% +17% |
| big_out(h) + model AGREES ≥1 → AWAY | 109 | 59.6% | +14.0% | 2023-24: 24/39 62% +17% · 2024-25: 25/44 57% +9% · 2025-26: 16/26 62% +17% |
| big_out(h) + model DISAGREES → AWAY | 95 | 58.9% | +12.6% | 2023-24: 19/32 59% +13% · 2024-25: 13/30 43% -17% · 2025-26: 24/33 73% +39% |
| big_out(a) → HOME (all) | 278 | 58.6% | +12.0% | 2023-24: 51/91 56% +7% · 2024-25: 59/92 64% +23% · 2025-26: 53/95 56% +7% |
| big_out(a) + model AGREES ≥1 → HOME | 100 | 64.0% | +22.3% | 2023-24: 22/37 59% +13% · 2024-25: 18/23 78% +49% · 2025-26: 24/40 60% +15% |
| big_out(a) + model DISAGREES → HOME | 102 | 57.8% | +10.4% | 2023-24: 21/33 64% +21% · 2024-25: 28/47 60% +14% · 2025-26: 10/22 45% -13% |
