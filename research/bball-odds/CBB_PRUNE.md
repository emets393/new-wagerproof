# CBB — pruning the team-points model

> ## ⭐ VERDICT — read this before the tables
>
> **TWO CUTS, AND NEITHER IS JUSTIFIED BY ITS ROI.** Both are structural facts that happen to be
> free; the ROI table below is not resolvable and must not be mined.
>
> **CUT 1 — `impl`, the market anchor.** The full-game-implied team total, i.e. the posted total and
> spread rotated, was a model INPUT. That breaks the owner's standing originator rule, and the
> panel's own docstring falsely claimed it did not happen. Removing it moves the live conference rule
> **+10.31% → +10.66%** and the model's correlation with the realised residual **+0.0438 → +0.0434**.
> It costs nothing. **Take it out and the panel is a true originator.**
>
> **CUT 2 — one of the two identical copies of the style percentiles.** `cbb_blocks.py` re-attaches
> `sty_pct_*`, which the sides table already carried as `pct_*`. Verified directly: **32 of 32 column
> pairs are numerically identical, maximum absolute difference exactly 0.00e+00.** The ablation says
> the same thing — dropping either copy produces identical results (+0.0439 corr, +8.38% pooled,
> +11.37% conference, in both rows). Two copies take twice the shrinkage budget of a single family,
> so this quietly upweighted style against everything else. Drop one copy; the other stays.
>
> **WHY NOTHING ELSE GETS CUT.** **13 of the 17 drop-one ablations IMPROVE the live rule.** You cannot
> cut 13 families, and that pattern is the tell. The conference top-10% cell holds 1,077 bets, where
> one sigma of ROI noise is ±2.89%; the entire observed delta range is −1.41 to +3.18. The *ranking*
> inside that table is a re-roll of the dice, and taking its top row (`form_l5`, +3.18) would be
> exactly the unpriced selection [[nba-blind-sweep-fails]] warns about.
>
> **BUT THE AGGREGATE IS A REAL FINDING.** Mean drop-one delta **+0.73** (sd 1.26 across 17 families,
> t ≈ 2.4) — nearly *any* cut helps slightly. That is **dilution**, not a bad family: 269 features is
> more than 46k rows of a noisy target can support, so every family is paying shrinkage for the
> others. The diagnosis is over-parameterisation; the table cannot name the culprit. Acting on it
> needs a pre-registered cut re-graded with nulls, not a scan of this ranking.
>
> **WHAT IS LOAD-BEARING** — the four families whose removal HURTS the live rule:
> **lineup (−1.41)**, schedule (−0.88), **availability (−0.72)**, roster (−0.19). Two of those answer
> owner questions directly:
> - **The injury data is being used and it earns its place.** `availability` (12 cols) is one of only
>   four families that hurt when removed, and it carries +2.26% solo at corr +0.0161.
> - **`lineup` is the single most load-bearing family**, independently replicating `ncaab-model-lab`'s
>   finding that lineup profiles were "the largest single-group gain in the entire lab" — found there
>   on a different target, a different row layout and a different fitting method.
>
> **AND THE SOLO COLUMN DISAGREES WITH THE LAB ON KENPOM.** KenPom scores **−7.26% solo** (corr
> +0.0071) here, against the lab's "backbone, alone within 0.11 MAE of the full model" — while style
> percentiles carry +8.88% solo (corr +0.0366). That is not a contradiction: this panel predicts a
> residual against `impl`, so KenPom's team-strength LEVEL already sits inside the anchor and only its
> residual survives. **Which means cut 1 and the KenPom reading interact — with `impl` gone, KenPom
> must be re-measured, not assumed.** Left open deliberately.

`cbb_prune.py`. Family-level ablation of the full-game team-points model, graded through the same `cbb_panel.markets()` as every other document here. **Graded at fixed selectivity** — each configuration bets the same top-N% of disagreements, so a smaller feature set cannot win by simply making fewer, more extreme predictions.

**The conference columns are the ones that decide.** The only rule that survived `CBB_CONFIRM.md` is the full-game spread inside conference play, so a cut that helps the pooled number and hurts the live rule is not a cut.

Baseline: **269 features**, corr with the realised residual +0.0438, spread **+8.50%** ROI on the top 10% of all disagreements and **+10.31%** on the top 10% inside conference play.

## Drop-one — does the model improve without this family?

**A positive delta means cutting the family HELPS.** This column decides what gets removed; `solo` below only says whether the information exists at all.

| family | cols | spread top 20% | Δ | spread top 10% | Δ | CONF top 10% | Δ | corr |
|---|---|---|---|---|---|---|---|---|
| form_l5 | 28 | +7.83 | **+3.00** | +8.71 | **+0.22** | +13.49 | **+3.18** | +0.0448 |
| context | 9 | +5.72 | **+0.89** | +7.39 | **-1.11** | +13.14 | **+2.83** | +0.0445 |
| adv | 6 | +4.88 | **+0.06** | +8.04 | **-0.45** | +12.61 | **+2.30** | +0.0434 |
| possession | 32 | +6.16 | **+1.33** | +9.16 | **+0.66** | +11.72 | **+1.42** | +0.0439 |
| star | 4 | +4.99 | **+0.17** | +7.84 | **-0.66** | +11.38 | **+1.08** | +0.0438 |
| heat | 20 | +5.55 | **+0.73** | +8.49 | **-0.00** | +11.37 | **+1.06** | +0.0449 |
| style_pctile | 32 | +4.99 | **+0.17** | +8.38 | **-0.11** | +11.37 | **+1.06** | +0.0439 |
| pctile | 32 | +4.99 | **+0.17** | +8.38 | **-0.11** | +11.37 | **+1.06** | +0.0439 |
| style_raw | 32 | +5.61 | **+0.79** | +7.17 | **-1.33** | +11.20 | **+0.89** | +0.0451 |
| market_anchor | 1 | +5.05 | **+0.23** | +7.28 | **-1.22** | +10.66 | **+0.36** | +0.0434 |
| kenpom | 10 | +5.44 | **+0.62** | +7.94 | **-0.56** | +10.49 | **+0.18** | +0.0404 |
| starters | 4 | +4.98 | **+0.16** | +5.04 | **-3.45** | +10.47 | **+0.16** | +0.0430 |
| season_s2d | 24 | +6.66 | **+1.83** | +7.39 | **-1.11** | +10.31 | **+0.01** | +0.0462 |
| roster | 10 | +4.72 | **-0.11** | +6.49 | **-2.01** | +10.12 | **-0.19** | +0.0401 |
| availability | 12 | +4.16 | **-0.67** | +7.61 | **-0.88** | +9.59 | **-0.72** | +0.0409 |
| schedule | 7 | +4.21 | **-0.61** | +7.06 | **-1.44** | +9.42 | **-0.88** | +0.0442 |
| lineup | 6 | +3.77 | **-1.05** | +5.84 | **-2.66** | +8.90 | **-1.41** | +0.0433 |

## Solo — does the family carry anything by itself?

A family can look fine here and still be worth cutting: that is what redundancy looks like. It can also look dead here and be load-bearing in combination.

| family | cols | spread top 10% | CONF top 10% | corr |
|---|---|---|---|---|
| style_pctile | 32 | +8.83 | +8.88 | +0.0366 |
| pctile | 32 | +8.83 | +8.88 | +0.0366 |
| style_raw | 32 | +7.37 | +6.93 | +0.0346 |
| lineup | 6 | +1.16 | +6.41 | +0.0036 |
| heat | 20 | -0.39 | +4.99 | +0.0118 |
| possession | 32 | +1.59 | +4.78 | +0.0214 |
| season_s2d | 24 | -1.61 | +4.28 | +0.0210 |
| availability | 12 | +1.65 | +2.26 | +0.0161 |
| form_l5 | 28 | -1.62 | +0.21 | +0.0240 |
| schedule | 7 | -0.96 | -1.66 | -0.0058 |
| starters | 4 | -4.72 | -4.06 | +0.0059 |
| context | 9 | -4.76 | -4.98 | -0.0016 |
| adv | 6 | -6.39 | -6.37 | +0.0086 |
| star | 4 | -3.95 | -6.37 | -0.0027 |
| kenpom | 10 | -3.32 | -7.26 | +0.0071 |
| roster | 10 | -5.54 | -7.46 | +0.0132 |

## The market anchor

`impl` is the full-game-implied team total — the posted total and spread, rotated. It was in the feature list while `cbb_panel.py`'s docstring claimed the model never sees a line on the input side. Removing it moves the live conference rule from **+10.31%** to **+10.66%** (+0.36) and the model's correlation with the realised residual from +0.0438 to +0.0434.

