What is Kalshi? Kalshi is a U.S. prediction market, regulated by the Commodity Futures Trading Commission (CFTC), where you buy and sell yes-or-no contracts on real events, from election results to NFL games. Each contract trades between 1 cent and 99 cents and pays $1 if the event happens, so every price doubles as a rough probability.

That one idea explains most of how Kalshi works. It also explains why the conversation around it is so noisy: some people call it the smartest way to bet on sports, others call it gambling with a federal license. This guide covers what the platform is, how the prices and fees actually work, where the legal fight stands, and how to research a contract instead of guessing.

**Prefer to watch?** The companion video walks through the same material in about four minutes: [What is Kalshi? How it works for sports, explained simply](https://www.youtube.com/watch?v=-27XDMjpqPU).

This is education, not legal or financial advice, and nothing here is a recommendation to trade any contract.

## What is Kalshi?

Kalshi is an exchange for event contracts. An event contract asks one question with a yes-or-no answer, such as "Will the Lions beat the Jets?" If the answer turns out to be yes, each yes contract settles at $1. If the answer is no, each yes contract settles at $0, and the no side collects instead.

The company behind it, KalshiEX LLC, was [designated as a contract market by the CFTC in November 2020](https://www.cftc.gov/PressRoom/PressReleases/8302-20) and opened to the public in 2021. For its first few years most of its markets were about economics, weather, politics and culture. Sports contracts arrived in early 2025.

Kalshi is not a sportsbook. There is no house taking the other side of your position. When you buy a yes contract at 70 cents, another participant is on the no side at 30 cents, and the two sides together fund the $1 payout. Kalshi makes its money mainly from trading fees, which we cover below.

## How Kalshi prices work

Every contract trades in whole cents from 1 to 99. [Kalshi's help center](https://help.kalshi.com/en/articles/13823836-how-are-prices-determined) describes the mechanics: a yes buyer and a no buyer together put up $1, and the winning side collects it. That makes the price easy to read.

| Yes price | Rough market-implied chance | Profit if yes wins, per contract, before fees | Loss if no wins |
| ---: | ---: | ---: | ---: |
| 10 cents | about 10% | 90 cents | 10 cents |
| 50 cents | about 50% | 50 cents | 50 cents |
| 70 cents | about 70% | 30 cents | 70 cents |
| 90 cents | about 90% | 10 cents | 90 cents |

So if a yes contract on the Bills costs 70 cents, the market is saying the Bills have roughly a 70% chance. If you buy it and the Bills win, you get $1 back: a 30-cent profit on a 70-cent stake. A 10-cent contract implies about a 10% chance, and a win returns ten times the stake.

Two cautions keep this honest. First, the displayed price is the last trade or the best current offer, not a promise that you can buy a large amount at that number. Thin markets have wide gaps between the bid and the ask. Second, "70 cents means 70%" is shorthand. The price reflects what traders are willing to pay after their own costs and biases, which is exactly why research can matter. Our guide to [implied probability and no-vig prices](/blog/implied-probability-vs-true-probability/) explains the difference between a price and a true probability in more detail.

## Is Kalshi legit and legal?

Kalshi is a real exchange operating under federal oversight in the United States, not an unlicensed offshore site. That is the short answer most people want when they search "is Kalshi legit" or read Kalshi reviews. Legitimacy of the company, though, is not the same thing as legality of every contract in every state.

**Federal status.** The CFTC is the agency that oversees U.S. futures and options markets. Its 2020 designation lets Kalshi list event contracts under federal commodities law, subject to CFTC rules. [Kalshi's own explanation of its regulation](https://help.kalshi.com/en/articles/13823765-how-is-kalshi-regulated) is a good first-party summary.

**The election case.** In 2023 the CFTC blocked Kalshi's contracts on which party would control Congress, and Kalshi sued. A federal judge in Washington, D.C., ruled for Kalshi in September 2024, the appeals court refused to pause that ruling, and [the CFTC dropped its appeal in May 2025](https://www.cnbc.com/2025/05/05/cftc-kalshi-election-betting-commodities.html). That ruling cleared the way for Kalshi to list contracts on election results.

**The state fight over sports.** Sports contracts are a different battle. Many states say a contract on a game is sports wagering and belongs under state gaming law. As of late September 2026, [DLA Piper's tracker](https://www.dlapiper.com/en-us/insights/publications/2026/09/legal-status-at-odds-tracking-developments-in-prediction-markets-and-sports-betting) counts 19 states involved in prediction-market litigation, and the federal appeals courts disagree:

| Court | Case | Result as of September 26, 2026 |
| --- | --- | --- |
| Third Circuit | New Jersey | Sided with Kalshi (April 2026); New Jersey has asked the Supreme Court to review |
| Ninth Circuit | Nevada | Sided with Nevada (August 28, 2026) |
| Sixth Circuit | Ohio and Tennessee | Sided with the states (September 25, 2026) |
| Fourth Circuit | Maryland | Pending |

A split between appeals courts is the classic path to the Supreme Court, so this is still moving. Kalshi also faces civil suits in several other states. The practical takeaway: access to sports contracts depends on where you live, and it can change. Check Kalshi's current availability for your state before signing up, and treat any summary, including this one, as dated.

## Is Kalshi gambling? How it differs from a sportsbook

Legally, Kalshi's position is that its contracts are federally regulated derivatives, not bets. Several states disagree for sports contracts, and courts have split. That question will be settled in court, not in a blog post.

For your own decisions, the more useful answer is this: if you buy a contract on a game, you are risking money on an uncertain sports outcome. Treat it with the same budget, limits and caution you would use for any sports wager, whatever the legal label.

The mechanics do differ from a sportsbook in ways that matter for research:

| | Kalshi | A typical U.S. sportsbook |
| --- | --- | --- |
| Who is on the other side | Another trader | The sportsbook itself |
| How the price is set | Orders from buyers and sellers | The book sets and moves the line |
| How the operator earns | Trading fees | Margin built into the odds |
| Price format | 1 to 99 cents, pays $1 | American odds such as -300 or +240 |
| Exit before the game | You can sell your contract if there is a buyer | Cash-out only if the book offers one |
| Regulator | CFTC (federal) | State gaming regulator |

So how does Kalshi sports betting work in practice? You pick a market such as a game winner, buy yes or no at the current price, and either hold to settlement or sell to another trader before the result. The [prediction markets vs. sportsbook odds guide](/blog/prediction-markets-vs-sportsbook-odds/) shows how to convert both formats onto one scale without mixing up margin, fees and timing.

## Kalshi fees explained

Kalshi charges a trading fee rather than building a margin into the price. For a taker order on a standard market, the fee schedule we checked (a July 2026 update) uses this formula, rounded up to the next cent:

`fee = 0.07 × number of contracts × price × (1 − price)`

Price is in dollars, so 70 cents is 0.70. The `price × (1 − price)` term is largest at 50 cents, which means the fee per contract peaks in the middle and shrinks toward the extremes. What matters more to your return, though, is the fee as a share of what you spend. Here is the arithmetic for 100 contracts:

| Price | Cost of 100 contracts | Fee | Fee as a share of stake |
| ---: | ---: | ---: | ---: |
| 10 cents | $10.00 | $0.63 | 6.3% |
| 50 cents | $50.00 | $1.75 | 3.5% |
| 70 cents | $70.00 | $1.47 | 2.1% |
| 90 cents | $90.00 | $0.63 | 0.7% |

The fee bites a 10-cent long shot about three times harder, as a share of the stake, than a 70-cent favorite. Rounding up to the next cent makes very small orders proportionally more expensive: a single 10-cent contract still pays a full 1-cent fee, which is 10% of the stake. Resting (maker) orders and some market types are priced differently, so always read the current [Kalshi fee schedule](https://kalshi.com/docs/kalshi-fee-schedule.pdf) before you rely on these numbers.

## Kalshi vs Polymarket

Kalshi and Polymarket are the two names most people compare, and the core idea is the same: yes and no shares priced between $0 and $1 that settle at $1 for the correct side. [Polymarket's documentation](https://docs.polymarket.com/polymarket-learn/trading/markets) describes prices the same way, as the market's implied probability.

The differences are mostly about structure and access. Kalshi has operated as a CFTC-designated U.S. exchange since its launch. Polymarket built its main exchange on crypto rails and served users outside the United States. In late 2025 its U.S. arm received [an amended CFTC order of designation](https://www.cftc.gov/media/12806/Polymarket%20US%20Amended%20Order%20of%20Designation/download) and began rolling out a U.S. app. Fees, market lists, deposit methods and state availability differ between the two and change often, so compare them at the source on the day you decide. For research purposes, the useful habit is to check more than one market: when two exchanges price the same game differently, that is a question worth asking.

## Can you get an edge on Kalshi?

If there is no house setting the line, is everyone just trading coin flips with each other? Not quite. The price only tells you what the crowd is currently willing to pay. An edge, if one exists, is the gap between that price and a better estimate of the real chance. If a contract costs 70 cents and careful research says the real chance is closer to 80%, that gap is the thing you are looking for. If your research says 68%, the same contract is a pass.

Getting a better estimate than the market is hard, and most people who try do not manage it consistently. It takes a process, not a hunch:

1. **Get an independent estimate.** A statistical model, a rating system or your own documented method, built before you look at the price.
2. **Compare it with more than one market.** Check the prediction-market price and the sportsbook line converted to probability. If the markets agree with each other and disagree with your estimate, ask why before assuming you are right.
3. **Look for the reason.** Injury news, weather, schedule spots or public money leaning one way can explain a gap. So can your model missing something.
4. **Include the costs.** Subtract fees and the bid-ask spread. A four-point gap on a thin market can disappear once you pay to cross it.
5. **Record the decision, including passes.** Then review the results over many decisions, not one. The [closing line value guide](/blog/closing-line-value-sports-betting/) explains one way to judge a process before the sample is large.

This is the work WagerProof is built to organize. It shows prediction market odds next to the public betting percentages on each side at the sportsbooks, then adds machine learning models, historical trends and the real bets people are placing on one screen. Automatic research agents scan the board and flag spots where the model and the market disagree. [How WagerProof analysis works](/guides/how-wagerproof-analysis-works/) explains what the model and market views do and do not tell you. WagerProof does not accept trades or wagers, and a flagged gap is a starting point for research, not a pick.

## A real example: Jets at Lions, before kickoff

Here is what that comparison looked like on a real game, using WagerProof data pulled on September 25, 2026, before kickoff of the Jets at the Lions in Week 3 of the 2026 NFL season.

| Source | Lions price or estimate | Lions win chance |
| --- | --- | ---: |
| Prediction market (Polymarket) | 72 cents to win | about 72% |
| Sportsbooks (Vegas moneyline) | -300 | about 72% after removing the margin |
| WagerProof model | Projected margin: Lions by 13.3 | about 83% |

The two markets agreed with each other at roughly 72%. The model had the Lions winning about 83% of the time. That is an 11-point gap between the price and the model, and it is exactly the kind of spot worth a closer look.

A note on the source: the market price here comes from Polymarket, because that is the prediction-market feed WagerProof tracks. Kalshi's price on the same game may have been slightly different. The research method is identical on either exchange.

What the gap does not mean matters just as much. It does not make the Lions a lock, and it is not a recommendation to buy anything. An 83% estimate still loses about one time in six. The model could also be wrong in a way the market has already priced, such as late injury news. The gap tells you where your research should start: confirm the lineups, check whether the price has moved, compare Kalshi's current quote, and include the fee before deciding whether there is anything there at all. This example is an illustration of the process, not a pick, and the result of the game does not validate or refute it.

## Why long shots have been overpriced

Most new traders are drawn to 10-cent contracts, because a small stake can return ten times. The best public evidence says that has been an expensive habit on Kalshi.

Economists Bürgi, Deng and Whelan studied Kalshi's own trading data in [Makers and Takers: The Economics of the Kalshi Prediction Market](https://www2.gwu.edu/~forcpgm/2026-001.pdf). Their sample covers 2021 through April 2025: more than 46,000 contracts from about 12,400 events. Among their findings:

- Buyers of contracts priced at 10 cents and under lost more than 60% of the money they put in, on average.
- For contracts priced above 70 cents, there was statistically significant evidence of small positive returns after fees.
- Across all contracts, the average return was about negative 20%.

This is the favorite-longshot bias, a pattern that has shown up in horse racing and sports betting for decades: people overpay for small chances at big payouts. The fee structure makes it worse, since the fee takes a larger share of a cheap contract.

Keep the limits of the study in view. Most of its data predates Kalshi's sports markets, which launched in early 2025, so it is mostly about non-sports events. Past averages across thousands of contracts say nothing certain about the next one. A high price is not an edge by itself: a 75-cent contract on something with a 70% chance is still a losing trade. The lesson is narrower and more useful. Be skeptical of cheap long shots, and let research, not the size of the payout, decide what you look at.

## A short checklist before you trade any contract

- Read the contract rules: what exactly settles yes, the settlement source, and what happens if a game is postponed.
- Note the time, the bid, the ask and the depth, not just the headline price.
- Convert your estimate and the price onto the same probability scale.
- Subtract the fee for your actual order size.
- Compare at least one other market, such as a sportsbook line or another exchange.
- Decide your stake in advance, inside a budget you can afford to lose.
- Write down the reason, and review the decision later whatever the result.

Prediction markets can be a useful research signal. They are also real money on uncertain outcomes. Set time and spending limits before you start, and keep them separate from any model or market signal; our [responsible research guide](/guides/responsible-sports-betting-research/) covers how. If trading or betting stops feeling like a choice, in the United States you can call or text **1-800-MY-RESET** for free, confidential support at any hour, or visit [1800myreset.org](https://1800myreset.org/).
