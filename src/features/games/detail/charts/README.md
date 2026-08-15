# Edge charts

Three charts shared by every sport's detail widgets, ported from
`wagerproof-ios-native/WagerproofKit/Sources/WagerproofDesign/Components/`
(`SpreadCoverBar.swift`, `ModelEdgeRail.swift`, `MoneylineEdgeBar.swift`,
`EdgeScale.swift`). Keep the two trees in step — the Swift files carry the same
reasoning in their doc comments.

They are one grammar: **a threshold you have to beat, where the model lands, and
the gap between them highlighted.**

| Component | Threshold | Model | Axis anchored at |
|---|---|---|---|
| `SpreadCoverBar` | the margin needed to cover | projected margin | a TIE |
| `ModelEdgeRail` | the market number | projected number | the market |
| `MoneylineEdgeBar` | break-even win rate at the price | projected win % | 50% |

`ModelVsMarketRow` is the fallback: the old three-column "model / gap / market"
row, kept for the places that have no threshold to plot.

## The three things that are easy to get wrong

**1. The spread bar works in MARGIN, never in line values.** `modelMargin =
-modelLine`. The negation happens exactly once, at the call site, and every call
site comments it. The whole point is to stop printing "+4.5" next to "−2.1" and
making the reader reconcile a line against a margin.

**2. Half lines can't push; whole lines must say they do.** A final margin is a
whole number, so `threshold = -line`, `coverMin = floor(threshold) + 1`,
`loseMax = ceil(threshold) - 1`, and a push exists **iff** the threshold is
integral. On a +3 dog, "covers unless they lose by 4+" is wrong unless you also
say a 3-point loss pushes. `spreadCover.ts` owns this and `charts.test.ts` pins
it.

**3. Scales are per sport.** MLB totals move in runs (~8.5), NBA totals in points
(~230). One threshold set across five sports makes MLB read `STRONG OVER` on
every game and NBA read `NO EDGE` on every game — confidently wrong rather than
obviously broken. Always pass the sport's `EdgeScale`; the default is NFL.

## No de-vigging on the moneyline

The break-even at a price is that price's RAW implied probability. De-vigging
answers a different question ("what does the market think") and stops being the
bar the bet has to clear. It is also the rule-10 trap: a marginally more
"correct" number that visibly contradicts the card above it.

## Rule 10 in practice

Every number a card prints has to reconcile with every other one, so:

- **Derive, don't recompute.** Round the two figures the card displays *first*,
  then subtract them for the edge. `CollegeSpreadSection` does this explicitly —
  before, the bar's cushion (full precision) and the recommendation's edge
  (`roundToHalf`) could differ by a quarter point.
- **Guard stale direction columns.** `ou_direction` (MLB) and `ou_result_prob`
  (NFL) are written at snapshot time and the posted line can move afterwards, so
  `sign(model − market)` can end up disagreeing with the recommended side. Those
  call sites render `ModelVsMarketRow` instead of a rail whose zone label would
  read "Over Lean" under an UNDER pick.
- **Plot the CLOSE, not the best-shopped line.** The football pick cards have
  both `vegas_line` and `best_line`; the card headline is written against the
  close, so the charts use the close too. The shopped price keeps its own slot in
  the book chip, labelled as a price.

## Wiring

| Sport | Spread | Total | Moneyline |
|---|---|---|---|
| NFL | dryrun pick rows + slate summary | dryrun pick rows + slate summary | dryrun pick rows |
| CFB | same file (`sections/cfb/CfbDryRunSections.tsx`) | same | same |
| NBA | `NbaSpreadSection` | `NbaTotalSection` | — (no ML card) |
| NCAAB | `CollegeModelCards` via `NcaabPredictionsSection` | same | — |
| MLB | — (no spread card) | `FullTotalPanel` / `F5TotalPanel` | `FullMlPanel` |

Not wired, deliberately:

- **Team totals** (NFL/CFB) keep the compact `MarketGapRow`. They sit around 24
  points where a game total sits at 45, and nothing upstream calibrates them, so
  borrowing the game-total bands would call every 3-point gap a lean.
- **MLB first-five moneyline** has no `f5_home_ml` / `f5_away_ml` on the row —
  there is no price, so there is no break-even to plot. It keeps
  `ModelVsMarketRow` with Vegas derived as model − edge.

## Adding a call site

1. Pick the sport's scale from `edgeScale.ts`.
2. Feed the chart values the component has ALREADY derived and rendered — the
   same rule the deterministic headlines follow (`../headlines/README.md`).
3. If the card also prints an edge number, derive it from the chart's two inputs.
4. If a direction column could disagree with `sign(model − market)`, guard it.
