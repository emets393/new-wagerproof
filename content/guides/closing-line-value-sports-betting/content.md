Closing line value, or CLV, compares the odds you took with the closing odds for the same selection. If you took +120 and that exact market closed at +105, you got a better payout than someone taking the closing price. Your selection can still lose.

To calculate a simple price-based CLV percentage, convert both prices to decimal odds, divide your entry price by the closing price, subtract one and multiply by 100. In that example, `(2.20 / 2.05 - 1) × 100 = 7.32%`.

The important part is what that number means. It describes the price difference. It does not say you had a 7.32% expected return, and it is not a prediction of the result.

## Pick your closing reference before the game

There is no single closing price shared by every sportsbook. Choose the book or documented reference you will use, and decide when you will record it. Do that before seeing which reference makes your results look best.

For a manual log, one workable policy is: "Record the last available pregame price from my chosen reference book before the scheduled start. Save the actual capture time. If I miss it, mark the close missing."

A screenshot from five minutes before kickoff is a five-minutes-before-kickoff snapshot. It might be useful, but do not quietly label it the final close. Keep scheduled start time, actual capture time and time zone in the record so you can tell the difference later.

Use the same policy for good weeks and bad ones. If you change your reference, start a new clearly labeled series instead of mixing it into the old one.

## Three calculations that should not share one label

People use CLV to describe several calculations. Here is the same fictional moneyline example worked three ways:

- Your entry: **+120**, or **2.20** decimal odds.
- Closing price on your side: **+105**, or **2.05**.
- Closing price on the opposing side: **-125**, or about **1.80**.

Assume a two-outcome market with no push outcome, matching settlement rules and no commission. These are invented prices for teaching the calculation, not an actual WagerProof pick.

To convert positive American odds, divide by 100 and add one: +120 becomes `1 + 120 / 100 = 2.20`. For negative odds, divide 100 by the absolute odds value and add one: -125 becomes `1 + 100 / 125 = 1.80`. Decimal odds include the returned stake.

### 1. Price-based CLV

Divide the entry decimal odds by the closing decimal odds, then subtract one:

`2.20 / 2.05 - 1 = 0.07317`

**Price-based CLV: +7.32%.** You captured a better quoted payout for the same outcome. This comparison does not remove the bookmaker's margin.

### 2. Raw implied-probability movement

Convert each decimal price to its reciprocal:

- Entry: `1 / 2.20 = 45.45%`
- Close: `1 / 2.05 = 48.78%`

Subtract entry from close: **+3.33 percentage points**.

That is a different unit from the 7.32% price ratio. It is also not an increase in the event's known true probability. Both numbers came from offered prices.

### 3. A no-vig closing benchmark

If both closing sides are available, you can remove the margin proportionally. Divide your side's raw implied probability by the sum for both sides:

`(1 / 2.05) / ((1 / 2.05) + (1 / 1.80)) = 46.75%`

Using that estimate as a benchmark gives:

`2.20 × 0.467532 - 1 = 2.86%`

Call this **entry return versus the proportional no-vig closing benchmark**. Some trackers include it under CLV, but write down the formula so nobody mistakes it for the price ratio.

The estimate depends on your margin-removal method and on treating the closing market as a useful reference. It is not a measured true probability. A three-way market needs all three outcomes, and a market that can push needs an explicit treatment of pushes; do not copy this two-outcome example unchanged. Our [implied-probability guide](/blog/implied-probability-vs-true-probability/) explains why removing margin is not the same as discovering the correct forecast.

| Calculation | Result | What it describes |
| --- | --- | --- |
| Entry decimal / close decimal - 1 | +7.32% | Relative quoted-price improvement |
| Close implied probability - entry implied probability | +3.33 points | Raw probability-price movement |
| Entry decimal × no-vig close estimate - 1 | +2.86% | Return relative to a chosen closing benchmark |

Keep unrounded numbers in the calculation. Round only the displayed answer.

## You can beat the posted close and still trail a no-vig benchmark

Here is the trap worth remembering. Suppose you take **-110**, and both sides later close at **-115**.

Your price improved relative to the same side's posted close: `1.90909 / 1.86957 - 1` is about **+2.11%**.

But removing the closing margin proportionally gives each side a 50% estimate. Your -110 entry against that benchmark is `1.90909 × 0.50 - 1`, or **-4.55%**.

The two calculations have different signs because they answer different questions. You beat the quoted close. You did not beat the proportional no-vig closing benchmark.

That does not prove the selection was wrong. It shows why a green CLV number is incomplete without a formula and a reference.

## Do not compare different lines as though they were identical

Price-based CLV works cleanly when the outcome stays the same. A spread or total moving to a different threshold changes the event being priced.

| Entry and close | How to record it |
| --- | --- |
| Same moneyline side, +120 to +105 | Compare prices if settlement rules match. |
| Team +3 at -110 to +2.5 at -105 | Record both the half-point change and price change. Do not use a price-only ratio as the full comparison. |
| Player over 24.5 to over 25.5 | Mark different thresholds. Find a closing price at 24.5 if you want a like-for-like price comparison. |
| Same selection, close not captured | Mark missing. Do not fill it with a convenient later number. |
| Boosted entry versus ordinary close | Label the promotion and keep it separate from ordinary-price records. |

If you cannot recover a matching closing threshold, leave the price-based CLV field blank and explain why. A transparent missing value is more useful than an exact-looking number for the wrong market.

Our [line-movement guide](/guides/how-to-read-line-movement/) covers the separate question of what a changing line can tell you.

## Copy this CLV recordkeeping sheet

[Open the plain-text CLV sheet](/guides/closing-line-value-sports-betting/clv-recordkeeping-sheet-v1.txt) and make one copy per selection. It includes the formulas and a completed fictional example.

At minimum, keep:

- Event, league, market, side, period and settlement rules.
- Entry book, line, odds and timestamp.
- Chosen closing reference and capture policy.
- Closing line, odds, timestamp and source.
- Opposing closing odds if using a two-outcome no-vig estimate.
- Formula used, result and any reason the comparison is invalid.
- Final outcome, including pushes or voids.
- Research or Agent settings in effect when the selection was made.

The entry should be the price you actually recorded or received, not an earlier price that would have looked better. If you are auditing an Agent's published selection, use its recorded price and label that series separately from your own bets.

## Use WagerProof's Agent record as the starting point

We built WagerProof Agents to keep the research and its results together. You choose the sports, markets and risk preferences; the Agent produces selections with reasoning, and picks are graded into a record that includes wins, losses, pushes and units. You can inspect public Agent records instead of judging a strategy from a winning screenshot. [WagerProof features](https://apps.apple.com/us/app/wagerproof-sports-research-ai/id6757089957).

Keep that record beside your CLV notes. The Agent's recorded selection and a price you found later are not necessarily the same thing. Save the exact reference you are comparing.

You fill in the closing prices and calculate CLV yourself in the worksheet. Keep those notes separate from the Agent's automatically graded results.

That boundary matters. Automatic result grading answers "what happened?" Your closing-price notes answer "how did the recorded price compare with my chosen reference?" You need both questions if you want to review timing without hiding losses.

## Review the whole record, not the nicest number

At your review date, count the total selections, valid matching closes, missing closes and mismatched markets. Then inspect positive, flat and negative CLV separately by sport and market. Do not discard a missing close just because the selection lost.

For example, if you logged 20 selections but only captured 12 valid closes, report **12 of 20 covered**, not "our average CLV across 20 picks." Missing data may change the story.

CLV is useful, but the close is not infallible. A study of 3,681 MLB games found that market forecasts did not always improve as game time approached. That finding qualifies the benchmark; it does not invalidate every closing-price comparison or prove a WagerProof advantage. [Read the study's abstract](https://pubsonline.informs.org/doi/abs/10.1287/mnsc.2022.00456).

Keep CLV alongside your full [performance-tracking record](/blog/accurate-betting-performance-tracking-checklist/), not in place of results, uncertainty or sample size. One winning ticket cannot validate a method, and a positive price comparison cannot make the next selection safe.

The habit worth building is simple: save the entry, define the close, compare the same market and keep every result. Do not raise your stakes to chase a good-looking CLV number.
