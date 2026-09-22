No-vig odds are a market's prices with the displayed margin removed using a chosen calculation. The simplest method is to convert every outcome to implied probability, add those probabilities, then divide each one by the total.

At -110 on both sides, that turns 52.38% and 52.38% into 50% and 50%. The no-vig price is +100 on each side. You have a cleaner comparison, not proof that either side really has a 50% chance.

That distinction matters when an AI Agent finds a game worth researching. A model can disagree with the market and still not justify the price you would actually pay. Here is how to check the numbers before getting carried away by the signal.

## Keep these three numbers separate

| Number | What it tells you | What it does not tell you |
| --- | --- | --- |
| Raw implied probability | The break-even win rate at the offered price for a win-or-loss bet | The objective chance of winning |
| No-vig probability | A market-derived estimate after a named margin adjustment | A guaranteed fair valuation |
| Model probability | An estimate based on that model's inputs and assumptions | Whether today's offered price is worth taking |

I want all three written down. If a research note only says "58%," I cannot tell whether that came from a price, a model, or a past hit rate. Those are different things.

The examples below are fictional, use two mutually exclusive outcomes with no push or tie, and ignore fees. They are calculation examples, not picks or WagerProof results.

## 1. Convert the offered odds

For decimal odds, divide 1 by the price. At 2.20, that is 45.45%.

American odds need one of two formulas. Use the positive magnitude of A in each:

- **Positive odds +A:** `100 / (A + 100)`
- **Negative odds -A:** `A / (A + 100)`

Multiply the result by 100 to display a percentage. At +130, the calculation is `100 / 230 = 43.48%`. At -150, it is `150 / 250 = 60%`.

Keep the unrounded values while calculating. Round the displayed result at the end.

Use decimal odds greater than 1, or standard American odds of +100 or higher and -100 or lower. A missing price or zero is not a valid input.

You can convert one price on its own. To remove margin, you need the other outcome prices too. One side at -150 does not tell you how the rest of that market was priced.

## 2. Remove the margin from a matched market

Take a fictional market with Side A at -150 and Side B at +130. Both prices come from the same sportsbook, at the same time, for the same event and settlement rules.

| Step | Side A | Side B |
| --- | ---: | ---: |
| Offered American odds | -150 | +130 |
| Raw implied probability | 60.00% | 43.48% |
| Divide by the combined 103.48% | 60 / 103.48 | 43.48 / 103.48 |
| Proportional no-vig probability | 57.98% | 42.02% |
| No-vig decimal odds | 1.7246 | 2.3800 |
| No-vig American odds | -138 | +138 |

The table rounds intermediate numbers for readability. The calculation uses the full values.

The two raw probabilities total 103.48%. That total is the **booksum**. The 3.48 percentage points above 100% are the **overround**. They are not the same number, and overround is not a promise about the sportsbook's eventual profit.

If your total is exactly 100%, there is no positive overround to remove. If it is below 100%, check for a missing outcome, mismatched timestamps, or mixed books before drawing a conclusion. Dividing by the total still rescales the numbers, but it does not explain why that total is low.

For the proportional method:

`No-vig probability = raw probability / sum of all raw probabilities`

This is also called basic normalization. It scales the probabilities to total 100%; it does not establish that the margin was distributed proportionally in the first place. [Koning and Zijm's research](https://link.springer.com/article/10.1007/s10479-022-04722-3) explains this method and why the resulting estimates can still be biased.

To get back to decimal odds, use `1 / no-vig probability`, with probability expressed as a fraction. For American odds:

- Below 50%: `+100 × (1 - p) / p`
- Above 50%: `-100 × p / (1 - p)`
- Exactly 50%: +100

That is where the -138 and +138 above come from. These are calculated reference prices, not offers you can necessarily place a bet on.

## 3. Compare the model with the price you can get

Here is the mistake I would watch for: our fictional model gives Side A a 59% chance. The proportional no-vig estimate is 57.98%. That looks encouraging. The model is about one percentage point higher.

But the available price is still -150, which needs 60% to break even.

At -150, a $100 stake wins $66.67 in profit or loses $100. Using the model's 59% estimate:

`0.59 × $66.6667 - 0.41 × $100 ≈ -$1.67`

So the model can sit above the no-vig market estimate while the offered bet still has negative expected value under that very same model.

| Assumed chance for Side A | Expected profit per $100 at -150 |
| --- | ---: |
| 58% | -$3.33 |
| 59% | -$1.67 |
| 60% | $0.00 |
| 61% | +$1.67 |

None of those probabilities is a measured forecast. The table shows how little the input needs to change to flip the conclusion.

A positive result in the last row would not prove the estimate was right. If the model is stale or poorly calibrated, the calculation is neatly measuring the wrong assumption. Check the exact market, latest price, information cutoff, and reason for the disagreement.

Our [model and market analysis guide](/guides/how-wagerproof-analysis-works/) goes deeper on that review. The arithmetic here is a manual check, not a claim that every WagerProof screen uses this particular no-vig method.

## When the shortcut gives you the wrong comparison

The formula is easy. Matching the inputs is where mistakes creep in.

**Different lines are not opposite sides.** Over 24.5 points and under 25.5 points can both win. Do not put those prices into a two-outcome normalization. The same warning applies to main lines and alternates.

**Two prices may not cover the whole market.** A three-way result market needs home, draw, and away prices. Leaving out the draw does not remove margin. It removes an outcome.

**A push changes the interpretation.** For a bet that refunds the stake on a push, win and loss are not the only possible results. The usual break-even rate refers to wins among settled wins and losses. To estimate unconditional expected profit, include the push probability and its zero net return.

**Mixed books are a different question.** Combining Side A from one sportsbook and Side B from another can help compare available offers, but the sum is not either book's original margin. Keep a same-book reference separately.

**Stale prices do not make a current market.** Record both prices together. If an injury update or a line move lands between screenshots, fetch a fresh matched pair.

**A parlay needs joint probability.** Removing margin from individual legs does not tell you the chance they all win. Do not multiply the leg estimates unless independence is justified. Two props tied to the same offense can depend on the same game script.

## Use WagerProof to find what deserves this check

The math should be the quick part. Finding the games and reading the context takes longer.

In WagerProof, you can set an AI Agent's sports, markets, and risk preferences, then read the reasoning behind its selections. Model probabilities sit beside sportsbook lines, and Outliers surfaces larger model-to-market disagreements. Published Agent picks are graded with wins, losses, pushes, and units, so you can inspect the record beyond one good day. [Explore WagerProof](https://apps.apple.com/us/app/wagerproof-sports-research-ai/id6757089957).

I would use that workflow to build a short list, then check the price before going any further:

1. Open the candidate and read why it was selected.
2. Confirm the exact side, market, period, and line.
3. Record a matched pair of current sportsbook prices.
4. Keep the raw break-even rate, your no-vig reference, and the model estimate in separate fields.
5. Write down what could make the estimate wrong, including new player-status information or a changed line.
6. Save the note before the result, including a decision to pass.

For individual props, start with the [player-prop research checklist](/guides/player-prop-research-guide/). A recent hit rate is historical context, not a substitute for an estimated chance at today's line.

WagerProof helps organize the research. It does not accept wagers, and neither an Agent nor a no-vig number makes a bet safe.

## A no-vig worksheet you can reuse

Copy these fields into your notes, or open the [plain-text no-vig worksheet](/guides/implied-probability-vs-true-probability/no-vig-review-sheet-v1.txt). It includes the completed -150/+130 example so you can check your math. This is a manual worksheet, not an automatic calculator.

| Field | What to save |
| --- | --- |
| Market identity | Event, sportsbook, period, exact line, settlement rules |
| Capture time | Timestamp and time zone for the matched prices |
| All outcome prices | Every outcome, not just the side you prefer |
| Raw probabilities | Each conversion and the combined booksum |
| Margin method | Proportional normalization, or another named method |
| No-vig reference | Adjusted probabilities and calculated reference odds |
| Separate estimate | Model or other estimate, source and information cutoff |
| Offered-price check | Break-even rate and expected value under that estimate |
| Decision | Pass, investigate further, or a recorded action with reasons |
| Later review | What changed, final result, and any missing information |

Keep the original note when you review the result. If you also record a closing price, use a consistent reference as explained in the [closing line value guide](/blog/closing-line-value-sports-betting/).

The takeaway is simple: no-vig odds help you compare prices, but the offered price still sets the hurdle. Let an Agent help find the candidates. Check the assumptions yourself, keep the losing results in the record, and keep your [time and spending limits](/guides/responsible-sports-betting-research/) separate from whatever the model says.
