## The analysis contract

WagerProof's public product describes model probabilities across NFL, college football, NBA, college basketball, and MLB, placed beside live sportsbook lines. It also describes Outliers, historical trend filters and Systems, configurable AI agents, and automatic grading.

Those features are different views over a common contract:

1. Define the event and market.
2. Preserve the currently available line and price.
3. Produce or retrieve a versioned probability estimate.
4. Compare estimate and market on a common probability scale.
5. Add current context and explicit assumptions.
6. Record the selection rule before the event.
7. Grade every result and review the process over time.

The system is easier to audit when those layers remain separate.

## 1. Define the market before the model

An NBA moneyline, first-half spread, and player points prop are different prediction targets. The market definition includes the league, event, side, period, line, price, sportsbook, timestamp, and settlement rules.

If the target changes, the old probability no longer answers the new question. A projection at 24.5 cannot be presented unchanged after the line moves to 25.5.

## 2. Translate the available price

The current price can be converted to raw implied probability. At -105, the calculation is `105 / (105 + 100) = 51.22%`. For a multi-outcome market, the displayed probabilities generally include margin, so a named no-vig method is needed before calling the result a market estimate.

The [implied-probability guide](/blog/implied-probability-vs-true-probability/) explains why that normalized number still is not objective truth.

## 3. Keep the model estimate versioned

A model probability should carry the model version and an information cutoff. Inputs available after that cutoff cannot be used to justify the earlier estimate. When a model changes, its forecasts should not be blended invisibly with the previous version.

WagerProof does not publish proprietary model code in this guide, and this page does not claim an undisclosed accuracy rate. The observable promise is narrower: show an estimate, preserve the market context, and maintain a record that can be inspected.

## 4. Read disagreement as a research queue

Suppose a model estimate is 54% while a -105 market price implies 51.22% before margin adjustment. The displayed difference is 2.78 percentage points. That arithmetic does not establish a 2.78-point true edge.

It creates a queue for questions:

- Is the model and market definition identical?
- Did the market move after the model cutoff?
- Is new lineup, injury, weather, or roster information available?
- How uncertain is the estimate around 54%?
- Does the book's margin treatment change the comparison?
- Is another book offering a materially different price?

WagerProof calls larger model-to-market disagreements Outliers. The name describes the comparison, not an outcome guarantee.

## 5. Add context without double counting it

Historical trends, public percentages, weather, rest, travel, player status, and market movement can all add context. They can also repeat information already captured by the model or by each other.

State the role of each signal. Is it an input to the model, a post-model diagnostic, or a separate human note? Treat a filtered historical sample as descriptive evidence with explicit selection rules. Saving the filter as a System makes future grading possible, but a strong past record does not remove selection bias or regime change.

## 6. Separate agent reasoning from the underlying evidence

WagerProof agents are configurable research workers that review the slate and provide selections with reasoning. Their settings and outputs do not create a new source of truth. The agent should point back to the model, market, and context that supported its selection.

Consensus among public agents is also descriptive. If many agents share inputs or configuration patterns, their agreement is not independent evidence.

## 7. Grade the complete record

Every published agent pick and saved System should be graded consistently. Keep wins, losses, pushes, prices, and units. Review probability calibration separately from price quality and realized return:

- **Calibration:** did events forecast near 60% occur near 60% across a meaningful comparable sample?
- **Price quality:** did the recorded price compare favorably with a defined later market reference?
- **Result:** what happened after stakes and settlement?

One measure cannot stand in for the others. Use the [tracking template and checklist](/blog/accurate-betting-performance-tracking-checklist/) to preserve all three.

## Known limitations

Sports conditions change, data can arrive late, markets can move, and models can be miscalibrated. Historical filters are exposed to selection bias. Public agent records can be too small for a firm conclusion. A market can be informative without being perfectly efficient, while a model can disagree without being right.

WagerProof is a research and information product. It does not accept wagers or handle money. The useful output is a more inspectable decision process, not certainty.
