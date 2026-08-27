## What CLV actually compares

Closing line value compares the price you captured with a defined later price on the same outcome. If you recorded +120 and the comparable market later closed +105, you held a more favorable payout for the same winning event.

Converted to raw implied probability, +120 is 45.45% and +105 is 48.78%. The market's price moved 3.33 implied-probability points toward the side you held. That does not mean the event was truly 48.78% likely, but it preserves a useful fact: your ticket carried a better number than the later reference.

## Define close before measuring it

There is no universal closing line across every book. One sportsbook may move earlier, another may accept wagers later, and a consensus screen may blend prices with different limits. Choose a reference policy and keep it fixed.

A defensible record includes:

- sportsbook or exchange
- sport, league, event, market, side, and period
- line and price at entry
- entry timestamp and time zone
- closing line and price
- closing timestamp and source
- settlement rule differences
- model or research version used at entry

Compare like with like. A player prop at 24.5 is not directly comparable with the same player at 25.5. A moneyline and a spread are different markets. A promotional boost is not the unboosted closing price.

## Three ways people report CLV

Some trackers compare American-odds points, some compare decimal prices, and some compare odds-implied probability. The last method is easier to aggregate across positive and negative prices, but it still needs a stated margin treatment.

For a two-outcome market, you can compare your entry with the later raw implied probability or normalize both sides to a no-vig estimate. Record which method you chose. [The implied-probability guide](/blog/implied-probability-vs-true-probability/) explains why a proportional no-vig number should not be called objective truth.

## Why CLV is useful

Win-loss results are volatile in small samples. Price is observable immediately and can reveal whether a repeatable process tends to capture numbers that later become less favorable. That makes CLV a useful diagnostic for timing, stale inputs, and whether a signal is already reflected in the market.

Academic evidence does not support the simple story that every market becomes perfectly smarter as start time approaches. A college-basketball study found closing lines more accurate than opening lines in some lower-profile markets, while higher-profile movement could contain more noise. A later Major League Baseball study found prices did not always improve monotonically and sometimes overreacted.

The careful conclusion is that close is a useful benchmark, not a law of nature.

## What positive CLV cannot prove

Positive CLV cannot prove that the underlying probability estimate was calibrated. It cannot repair missing wagers, selective timestamps, or a sample that includes only recommendations you acted on. It does not show that the same process will work after market participants adapt. It cannot make one losing wager a bad decision or one winning wager a good decision by itself.

Use it as one column in the [complete performance record](/blog/accurate-betting-performance-tracking-checklist/), alongside price, stake, result, market, model version, and decision notes.

## A repeatable review cadence

Review CLV in batches, not after every loss. Separate sports and market types before aggregating. Report the share of records with positive, zero, and negative CLV, plus median movement and sample size. Inspect missing closes rather than dropping them silently. Finally, compare the record with calibration and results while keeping the questions separate: Did the forecast probabilities behave well? Did the process capture a better price? What happened after normal variance?
