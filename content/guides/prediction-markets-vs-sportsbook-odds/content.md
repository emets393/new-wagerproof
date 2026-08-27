## Start with the contract, not the percentage

A prediction-market contract usually has a defined payout if a stated event resolves yes or no. A price of 60 cents for yes is often read as roughly 60% market-implied probability before transaction costs and market structure.

A sportsbook offers odds on a defined outcome. +150 converts to 40% raw implied probability; -150 converts to 60%. Across every side, those raw probabilities often sum above 100% because the book includes margin.

Both numbers look like probabilities after conversion. Neither is objective truth.

## Match the event definition exactly

Two markets can mention the same game and still settle differently. Check:

- event and participant names
- start and end time
- full game, period, or series scope
- overtime treatment
- postponement and cancellation rules
- official resolution source
- void, push, and disputed-result rules

A prediction contract about who wins a championship is not equivalent to a sportsbook future if one includes a qualifying condition or resolves from a different authority.

## Compare costs on both sides

Sportsbook prices embed margin across the offered outcomes. The simple no-vig normalization described in our [implied-probability guide](/blog/implied-probability-vs-true-probability/) can put them on a common scale, but it assumes a particular margin allocation.

Prediction markets can have trading fees, withdrawal or network costs, and bid-ask spread. The last traded price may not be available for the amount you need. Official fee schedules can change, so record the fee policy and accessed date rather than copying an undated number.

## Liquidity changes what a price means

A midpoint in a deep market carries different execution information from a last trade in a thin market. Preserve best bid, best ask, last trade, available size, and timestamp where the interface provides them.

At a sportsbook, preserve the actual available line, price, limit context, and timestamp. A consensus display can hide that only one book still offers the favorable number.

## Access and legal treatment are product-specific

Event contracts and sportsbooks operate under different legal and regulatory structures. Access varies by country and state, and a contract available to one user may be unavailable to another. The Commodity Futures Trading Commission warns customers to understand the platform, contract, and risk before participating in event contracts.

This guide cannot determine legality for a reader. Use the current regulator and product rules in your jurisdiction, not an old article or a social post.

## A repeatable comparison worksheet

For each observation, record:

| Field | Prediction market | Sportsbook |
| --- | --- | --- |
| Event definition | Exact contract text | Exact market and side |
| Price | Bid, ask, last, size | Line and associated odds |
| Timestamp | UTC with market state | UTC with sportsbook |
| Costs | Fee schedule and spread | Margin and any promotion |
| Resolution | Named source and rule | House settlement rule |
| Access | Jurisdiction and account | Jurisdiction and account |

Convert the executable prices, not a stale headline. Keep the original data beside the normalized probability.

## What a disagreement can tell you

A sustained, executable difference can prompt research into information timing, participant mix, liquidity, or market rules. It can also disappear once fees and spread are applied. If the event definitions differ, the gap may be correct rather than inefficient.

Use [line-movement discipline](/guides/how-to-read-line-movement/) to preserve the sequence and [closing-line-value discipline](/blog/closing-line-value-sports-betting/) to review price quality. Do not use the outcome to decide afterward which market was supposedly smarter.

## The numbered duplicate is consolidated here

The former `/blog/prediction-markets-vs-sportsbook-odds-2` page repeated nearly the same title, description, and body as this legacy canonical. It now redirects here so readers and crawlers see one maintained explanation instead of two competing versions.
