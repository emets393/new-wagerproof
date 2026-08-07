# NBA spread by phase — seed stability

The early-season result rests entirely on the MLP and the playoff result entirely on the random forest. Both are seeded. This refits each across 12 seeds on identical folds and reports the DISTRIBUTION, because a finding that only exists at seed 0 is a story, not an edge.

Breakeven at -110 is 52.4%. The column that matters is `p25 ROI` — if a quarter of the seed draws are under water, the finding is not bettable regardless of its mean.

| phase | family | cut | seeds | n | median win% | mean ROI | p25 ROI | min ROI | max ROI | % seeds > breakeven |
|---|---|---|---|---|---|---|---|---|---|---|
| early | mlp | top25% | 12 | 162 | 56.48 | +6.63 | +1.34 | -5.75 | +15.46 | 83% |
| early | mlp | top50% | 12 | 324 | 53.40 | +1.44 | -0.87 | -6.32 | +7.24 | 67% |
| playoffs | rf | top25% | 12 | 71 | 57.75 | +12.48 | +9.57 | +7.55 | +21.00 | 100% |
| playoffs | rf | top50% | 12 | 141 | 57.45 | +10.80 | +7.98 | +1.55 | +19.15 | 100% |
