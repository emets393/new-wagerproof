A parlay calculator multiplies the decimal odds of every leg to give you one price. The [calculator above](#calculator) does that for 2 to 12 legs, in American, decimal or fractional odds, and shows the payout, the profit and the chance the price implies.

It also does something most parlay calculators skip. If you enter the other side of each leg, it removes the sportsbook's margin and shows the fair parlay price, the expected value at your stake and how much vig you are paying. That last number is usually the one that matters.

## How to use the parlay calculator

1. Type the odds for each leg. `-110`, `2.50` and `5/2` all work, and the format is detected per price. If a number is ambiguous, pick the format from the menu.
2. Add or remove legs. You can have up to 12.
3. Set your stake. Payout, profit, combined odds and implied probability update as you type.
4. Optional: put the opposite side's price in "Other side" for every leg to see the no-vig numbers.
5. If a leg pushed or was voided, tick "Push / void" and it drops out of the math.

Each leg shows its decimal odds, American odds and implied probability, so the calculator doubles as an odds converter.

## How parlay odds are calculated

Every leg has to win, so the payout compounds. The calculation has four steps, and the calculator's default example walks through all of them: three legs at -110, -110 and +150, with a $10 stake.

**Step 1: convert each leg to decimal odds.** Decimal odds include your stake, which makes them easy to multiply.

| Leg | American odds | Decimal odds | Implied probability |
| --- | ---: | ---: | ---: |
| 1 | -110 | 1.9091 | 52.38% |
| 2 | -110 | 1.9091 | 52.38% |
| 3 | +150 | 2.5000 | 40.00% |

For negative odds, the conversion is `1 + 100 / 110 = 1.9091`. For positive odds, it is `1 + 150 / 100 = 2.50`.

**Step 2: multiply the decimal odds.** `1.9091 × 1.9091 × 2.50 = 9.1116`. Keep the unrounded values while you calculate. Rounding each leg to two decimals first would give 9.11 and a payout a few cents off.

**Step 3: multiply by the stake.** `$10 × 9.1116 = $91.12` total payout. Subtract the stake and the profit is $81.12.

**Step 4: convert back to American odds.** When the decimal price is 2.00 or higher, subtract 1 and multiply by 100: `(9.1116 - 1) × 100 = 811`. The parlay is +811.

The implied probability is `1 / 9.1116 = 10.98%`, about 1 in 9.1. That is the hit rate you would need just to break even at this price. It is not an estimate of the real chance, because each leg still carries the book's margin.

## Converting American, decimal and fractional odds

You can use the calculator as a plain odds calculator: enter a price as one leg and read the conversions under it. The formulas are short.

| From | To decimal | Example |
| --- | --- | --- |
| American, negative (-A) | `1 + 100 / A` | -125 becomes 1.80 |
| American, positive (+A) | `1 + A / 100` | +250 becomes 3.50 |
| Fractional (N/D) | `1 + N / D` | 5/2 becomes 3.50, 10/11 becomes 1.9091 |
| Decimal (D) | already decimal | 2.50 stays 2.50 |

To go from decimal back to American: if the price is 2.00 or more, use `(D - 1) × 100`. Below 2.00, use `-100 / (D - 1)`. So 1.80 becomes -125 and 3.50 becomes +250.

Implied probability is always `1 / decimal`. At 1.80 that is 55.56%, at 3.50 it is 28.57%. The [no-vig odds guide](/blog/implied-probability-vs-true-probability/) covers these conversions and their edge cases in more detail.

## Why parlays cost more than they look: the vig compounds

A single bet at -110 on both sides has a small margin built in. Each side implies 52.38%, the pair adds up to 104.76%, and the extra 4.76 points is the book's cut. Remove it proportionally and each side is a fair 50%, or +100.

Now parlay two of those coin flips. If both legs really are 50/50, the chance both win is `0.5 × 0.5 = 25%`, and the fair price is decimal 4.00, or +300. The book pays `1.9091 × 1.9091 = 3.6446`, which is +264. On $10, that is $36.45 back instead of a fair $40.00.

| Legs at -110 (fair 50% each) | Offered price | Fair price | Offered payout on $10 | Fair payout on $10 | Vig you pay |
| ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | -110 | +100 | $19.09 | $20.00 | 4.55% |
| 2 | +264 | +300 | $36.45 | $40.00 | 8.88% |
| 3 | +596 | +700 | $69.58 | $80.00 | 13.03% |
| 4 | +1228 | +1500 | $132.83 | $160.00 | 16.98% |

"Vig you pay" here is the expected loss per dollar staked if the no-vig probabilities were exactly right. At two legs, $10 has an expected value of about -$0.89 under that assumption. At four legs, it is about -$1.70. The margin roughly adds up with every leg, which is why long parlays pay a lot and cost a lot.

The calculator does this for any mix of prices. Back at the default example, enter -110 as the other side of the first two legs and -170 against the +150 leg. The fair chance all three hit becomes 9.71% (fair odds +930, a fair payout of $102.96), while the offered +811 implies 10.98%. Expected value at $10 is -$1.15 and the vig is 11.51%.

These no-vig numbers are estimates. Proportional margin removal is one method among several, and it assumes the legs are independent.

## Pushes, voids and same-game parlays

**Pushes and voids.** FanDuel's [house rules](https://www.fanduel.com/fanduel-sportsbook-house-rules-co) say that when a parlay selection is void, the remaining selections decide the bet and the odds are recalculated. If every selection but one is void, the bet settles as a straight wager. The same rules treat a refunded whole-number line as an excluded parlay leg in some sports, and most U.S. books handle pushes the same way. Boosted parlays can be the exception: FanDuel voids the entire Odds Boost if any selection is void.

In the example, if one of the -110 legs pushes, the parlay becomes -110 and +150: `1.9091 × 2.50 = 4.7727`, or +377, and $10 pays $47.73. Tick the push box on that leg to see it.

**Same-game parlays.** Multiplying legs assumes each result has nothing to do with the others. Legs from one game break that assumption. A quarterback's passing yards and his top receiver's yards tend to rise and fall together, so the chance both hit is higher than the product of the two. FanDuel's rules only allow correlated selections where they are explicitly offered, such as its Same Game Parlay, and books price those with their own adjustments. Treat the calculator as a rough reference for same-game parlays, not the price you should expect.

**Round robins.** A round robin splits your picks into every smaller parlay of a chosen size. Three legs "by 2s" is three two-leg parlays, each with its own stake. At $10 each on the default legs, that is $30 staked: the -110/-110 pair pays $36.45 and each -110/+150 pair pays $47.73. All three winning returns $131.90. Run each combination through the calculator separately.

## How WagerProof fits

The calculator shows what a price implies and what it costs. It cannot tell you whether a leg is worth taking. For that you need a separate estimate of each outcome and a price that beats it after the margin.

In WagerProof, model probabilities sit beside current sportsbook lines, so you can see where the model and the market disagree before you build anything. The [analysis guide](/guides/how-wagerproof-analysis-works/) explains what those numbers are and are not. Models are wrong often, and a parlay multiplies the error along with the odds.

If you do bet parlays, record the price you took and the no-vig price at the time, then review them against the [closing line](/blog/closing-line-value-sports-betting/) and a complete record, as in the [performance tracking checklist](/blog/accurate-betting-performance-tracking-checklist/). A few big parlay wins are easy to remember. The losing tickets are easy to forget.

Set a budget before you open the calculator, and treat a parlay's small hit rate as the real cost of the big number. If betting stops feeling like entertainment, the [responsible research guide](/guides/responsible-sports-betting-research/) lists practical limits, and free, confidential help is available at [1-800-MY-RESET](https://1800myreset.org/) by call, text or chat.
