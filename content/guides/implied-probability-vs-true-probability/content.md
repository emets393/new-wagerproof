## Start with the conversion

Decimal odds are the simplest form. Divide 1 by the decimal price. Decimal odds of 2.20 imply `1 / 2.20 = 45.45%` before any margin adjustment.

American odds use two formulas:

- For positive odds `+A`: `100 / (A + 100)`
- For negative odds `-A`: `A / (A + 100)`, using the absolute value

That makes +120 equal to 45.45% and -150 equal to 60%. These are raw odds-implied probabilities. They describe the break-even rate associated with the displayed price before considering the full market margin.

## Why a market can add up to more than 100%

Imagine a two-outcome market priced -110 on both sides. Each side has a raw implied probability of 52.38%. Added together, the market is 104.76%, not 100%. The amount above 100% is often called the overround or booksum.

A common no-vig shortcut divides each outcome's raw probability by the total. Here, `52.38 / 104.76` makes each side 50%. That is a useful normalization when comparing a price with an estimate. It is not a finding that both sides are objectively 50% likely.

Research by Ruud Koning and Henk Zijm explains how odds, booksum, and expected loss relate, while newer work cautions that proportional normalization can obscure differences in how margin is allocated across outcomes. The practical lesson is modest: the simplest no-vig method is a tool, not an oracle.

## Where true probability would have to come from

The true probability of a future sports outcome is not directly observable before the event. A model can estimate it from injuries, lineups, player and team performance, context, and current market information. A liquid market can aggregate information from many participants. Neither source becomes truth merely by producing a precise decimal.

Treat an estimate as a distribution with uncertainty. Ask what data was available, when it was captured, how the model was calibrated, whether the conditions resemble the training period, and how sensitive the estimate is to a lineup or price change. [WagerProof's methodology guide](/guides/how-wagerproof-analysis-works/) shows the questions we use around model and market outputs.

## A worked expected-value example

Suppose your independent estimate is 50% and the available price is +120. A $1 stake wins $1.20 or loses $1. The arithmetic is:

`0.50 × $1.20 - 0.50 × $1.00 = $0.10`

The expected value under that estimate is $0.10 per $1 staked. The fragile part is not the multiplication. It is the 50% input. If the estimate is poorly calibrated or misses new information, the calculated edge is not real.

## A better research checklist

1. Record the exact book, market, side, line, price, and timestamp.
2. Convert every price to raw implied probability.
3. Choose and name the margin-removal method if you use one.
4. Keep the market-derived number separate from your model estimate.
5. Record the estimate's version and information cutoff.
6. Compare the offered price again at close, without treating one result as validation.
7. Review calibration across many comparable forecasts, not just wagers that won.

The same discipline helps when reading [line movement](/guides/how-to-read-line-movement/) or [closing line value](/blog/closing-line-value-sports-betting/). In each case, preserve the price and timestamp before telling a story about what it means.

## Common mistakes

Do not compare probabilities from different market definitions. A full-game moneyline and a first-five-innings line are different events. Do not remove margin from one book and compare it with a stale price from another without keeping the timestamps. Do not call a no-vig result true probability. And do not interpret a positive expected value calculation as a guarantee that the next wager, or even the next small sample, will win.
