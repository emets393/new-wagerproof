# NBA player props — the verdict

Hand-written. The two briefs beside it (`NBA_PROPS_ORIGINATOR_BRIEF.md`,
`NBA_PROPS_CONFLUENCE.md`) are regenerated wholesale by their scripts and will destroy anything
typed into them; this file is the one to edit.

**This supersedes `NBA_PROPS_MODEL_BRIEF.md` and the "no edge in NBA player props" conclusion built
on it.** That conclusion was not wrong so much as unearned — the question had not actually been
asked. See §5.

474,732 prop rows, 3,923 games, seasons 2023-24 / 2024-25 / 2025-26, T-60 prices, ten markets.
Walk-forward: refit every two months on everything strictly earlier, never on anything concurrent.

---

## 1. THE BET

Top 25% by |model − line|, best available price, LightGBM. `need` is the win rate the price you
actually take requires to break even; `vs_blind` is ROI minus the better of a blind over and a
blind under on the same rows.

| market | median line | n | win% | need | **ROI** | vs blind | seasons up |
|---|---|---|---|---|---|---|---|
| **points_rebounds_assists** | 20.5 | 10,685 | 59.65 | 53.58 | **+11.25** | +9.39 | 3/3 |
| **points_rebounds** | 18.5 | 10,218 | 58.26 | 53.41 | **+9.09** | +7.61 | 3/3 |
| **points_assists** | 16.5 | 9,658 | 57.45 | 53.60 | **+7.16** | +6.78 | 3/3 |
| **points** | 12.5 | 10,938 | 57.17 | 53.30 | **+7.09** | +7.90 | 3/3 |
| **rebounds** | 4.5 | 10,714 | 58.11 | 55.42 | **+4.44** | +5.05 | 3/3 |
| **rebounds_assists** | 8.5 | 9,529 | 56.54 | 54.35 | **+3.91** | +5.36 | 3/3 |
| assists | 2.5 | 10,114 | 57.70 | 57.34 | −0.14 | +3.76 | 3/3 |
| threes | 1.5 | 9,668 | 59.96 | 60.22 | −1.03 | +0.46 | 2/3 |
| blocks | 0.5 | 8,677 | 69.07 | 67.23 | −1.23 | +1.04 | 3/3 |
| steals | 0.5 | 6,596 | 64.08 | 64.55 | −1.31 | +1.14 | 2/3 |

One sigma on a 10,000-bet cell is ±0.94 ROI points.

**Read the `win%` and `need` columns as a pair — they are the whole story.** The model hits 57–60%
in nearly every market. What changes is the toll: a 0.5-block line is quoted at odds that demand
67.2%, a 20.5 PRA line at odds that demand 53.6%. The model is not worse at blocks. There is simply
no room on a half-point line, and all of the skill is spent inside the vig.

So the losing markets are a PRICING verdict, not a modelling one. Do not read the bottom four rows
as "the model can't predict threes" — §2 shows it predicts threes better than the book does.

## 2. THE PRODUCT — it beats the closing line on nine markets of ten

Paired per row, model MAE against the posted line's, over every row, nothing filtered. The line IS
the market's point forecast, so this is like-for-like, and pairing differences out the "how did the
game go" noise that dominates both. Unfiltered, it is far higher-powered than any ROI cell.

| market | model MAE better by | paired t |
|---|---|---|
| blocks | +0.070 | **+46.14** |
| steals | +0.051 | +21.54 |
| threes | +0.033 | +13.73 |
| rebounds | +0.020 | +6.58 |
| assists | +0.013 | +6.03 |
| points_rebounds_assists | +0.030 | +3.66 |
| points_rebounds | +0.020 | +2.94 |
| rebounds_assists | +0.010 | +1.67 |
| points_assists | +0.008 | +1.17 |
| ⚠ points | **−0.007** | −1.12 |

The one market it does not out-forecast is points — and points is one of the best bets on the
board. The two tables are answering different questions and it is worth being precise about which:
MAE asks *are we a better forecaster on the average prop*, ROI asks *are we right where we
disagree*. On points the model is at parity overall and only pulls ahead in the top band
(+0.26 MAE inside the top 3% of edges). It is not out-predicting the book; it is picking its
arguments.

## 3. WHAT FIXED IT — the information, not the target

`nba_props_model.py` classified the sign of the residual. Three moves changed: raw target, line as
a feature, and the opponent context the panel never had. They were graded separately on points, top
25%, best price:

| configuration | ROI | vs blind | seasons |
|---|---|---|---|
| old residual classifier | −1.09 | — | — |
| raw target, **panel features only** | +0.46 | +1.45 | +1.2 / +0.3 / +3.5 |
| raw target **+ attached context** | **+7.09** | +7.90 | +5.5 / +7.6 / +10.0 |

**Changing the target bought +1.5. The information bought the other +6.5.** Same split on the
forecast test: panel-only sits 0.057 MAE worse than the line (t −9.93); with context that closes to
0.007 (t −1.12).

This replicates [[feature-pruning-drop-one-vs-solo]] rule 1 for the third time — inventory the disk
before doing anything clever. The panel had 235 columns, 45 of them opponent-side, and **every one
of those 45 was an injury count.** Not one column described how good the opponent was at stopping
anybody. The panel was also frozen at 12:02 on 07-30 while `nba_player_team_agg` and
`nba_rapm_team_agg` were written at 14:25 and 19:35 the same day, so the player tables could not
have been wired in even in principle.

What `nba_props_blocks.py` adds: 381 team-context base names rotated into own/opponent orientation
(including the `adj_def_*` opponent-ADJUSTED defensive family), the RAPM / player-regression /
style / flags blocks, a positional-defence table built here from raw box scores because it existed
nowhere in the repo, and player position, height and weight.

**No leak.** The leak screen flagged one column (`rapm_sem_n_s`, the known repeat offender) and it
was dropped. The positional-defence build asserts its own shift. And the shape of the result is
the shape a clean model has: if something knew the box score, model MAE would sit far BELOW the
line's, not 0.007 above it.

## 4. THE LINE IS A FEATURE HERE, ON PURPOSE, AND ONLY HERE

This breaks the standing originator rule. It is the documented exception in
[[predict-the-raw-quantity-not-the-residual]]: predicting the raw quantity requires the anchor in
the features, and withholding it kills the route. The originator discipline still holds where it
does the work — the BET is |model − line|, and §2 is a straight model-versus-line forecast contest.

**Do not copy this into the team models.** NBA spread, NBA total, the 1H pair and the CBB panel all
stay clean, and one of them (`impl` on CBB) has already had to have a line quietly removed from its
feature set once.

## 5. WHY THE OLD ANSWER WAS UNEARNED

The old classifier never beat a blind under at any cut or venue: top100% −2.52 vs −1.18, top50%
−1.86 vs −1.23, top25% −1.09 vs −0.92, top10% −0.53 vs −0.55, top5% +0.19 vs +0.38. A model with
real information separates from the blind baseline SOMEWHERE. This one never did, at any
selectivity, which is the signature of an information problem rather than a pricing one — and an
information problem is a statement about the panel, not about the market.

Two things the old grading did right and that are carried forward: prices were graded at both the
consensus and the best available book, and the blind under was always shown. Two things it got
wrong:

- **The blind-under column is degenerate on half the bets.** Where the model itself says under,
  betting under IS the blind under, so that comparison reads exactly 0 by construction. Every side
  must be scored against its OWN unconditional rate. Points, top 25%, best price:

  | side | n | win% | ROI | that side blind, all rows | vs base |
  |---|---|---|---|---|---|
  | over | 6,713 | 55.25 | +3.69 | −4.90 | **+8.58** |
  | under | 4,225 | 60.21 | +12.49 | −0.69 | **+13.18** |

- **The alternate-lines theory was wrong and worth clearing.** The raw JSON carries exactly ten
  market keys and no `_alternate` anywhere. Median consensus hold is 6.88% (≈ −116/−116), 5.87% at
  best price, and it is 6.91% where books agree on the line versus 6.80% where they disagree — so
  the three-independent-medians construction in `build_nba_props.py` is not inflating it either.
  The juice was real, correctly handled, and not the problem.

## 6. ONE POSITION PER PLAYER, AND MAKE IT PRA

PRA is points + rebounds + assists; pts+reb and pts+ast are sub-sums. Where they overlap, the four
points-family markets take the same side **98–99%** of the time. They are not four bets.

- All four fire on the same player-game (2,694 games): +17.48 / +17.73 / +17.48 / **+20.06**.
- A market fires alone: +2.42 / −2.70 / **−0.39** / +4.67. **A single-market fire is not a bet.**
- Controlled against a matched-count pure-magnitude cut, confluence wins every row by +1.1 to +3.4
  against a one-sigma of ±1.80. **That is about one sigma — not enough to call confluence the
  better selector**, only enough to say the two rules pick different sets (they share ~55% of rows)
  of about equal quality. The load-bearing finding is the negative on the alone rows.

Express the opinion on PRA: same games, same view, +20.06 versus +17.48 on points, because the
bigger line is priced closest to even.

Rebounds and assists are the genuinely independent additions — they agree with points only 70–81%
of the time.

## 7. STILL OPEN

1. **No feature pruning has been done.** 1,396 features against ~50k rows per market is exactly the
   over-parameterisation [[feature-pruning-drop-one-vs-solo]] rule 9 describes. Run the family
   drop-one, apply the rule-9-bis aggregate gate per market.
2. **No half-life sweep.** The team models needed 120–365d and the answer differed per market;
   props are fit on flat weights.
3. **The positional-defence block is a keep, but it is not what carries this.** Ablated on the two
   headline markets (`--features noposdef`, top 25%, best price):

   | market | with posdef | without | Δ | product MAE Δ |
   |---|---|---|---|---|
   | points | +7.09 | +6.74 | **+0.35** | −0.0070 → −0.0077 |
   | points_rebounds_assists | +11.25 | +10.35 | **+0.90** | +0.030 → +0.018 |

   Positive in both, both markets and both metrics agreeing on the sign, so by the rule-9-bis
   aggregate gate it stays. But one sigma on those cells is ±0.94 — each delta is inside it, and
   the mean of the two is +0.62. **Read it as "helps a little, direction consistent," not as a
   pillar.** The 381 rotated team-context bases are doing the heavy lifting; a table built from
   scratch getting only this far is itself the argument for §7.1, that 1,396 features is too many.
4. Ridge is positive everywhere but loses to LightGBM in every market; it has not been tuned.
5. `player_threes` at −1.03 is 0.03 MAE better than the book. Whether a 1.5-line market can ever be
   monetised at 60% breakeven is a pricing question — best-of-N book shopping across more books
   than we hold is the only lever.
6. **Nothing is wired to production**, and per the standing instruction nothing should be yet. No
   props pipeline, no slate table, no live prop capture. Live T-60 prop capture has the same
   October deadline as the 1H/TT team odds.

## File map

| file | what |
|---|---|
| `nba_props_blocks.py` | builds `_props_team_ctx` / `_props_posdef` / `_props_pattr` |
| `nba_props_originator.py` | the model; `--features all\|panel\|noposdef\|ctxonly` |
| `nba_props_report.py` | writes `NBA_PROPS_ORIGINATOR_BRIEF.md` |
| `nba_props_confluence.py` | writes `NBA_PROPS_CONFLUENCE.md` |
| `nba_props_model.py` | **superseded** — the residual classifier |
| `NBA_PROPS_MODEL_BRIEF.md` | **superseded** — its conclusion is retracted by §5 |
