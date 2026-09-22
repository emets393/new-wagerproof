# Action Network public-betting splits

Ticket/handle splits the owner copies out of Action Network, parsed, joined to our graded results,
and tested against the standard public-betting theses.

## Pipeline

```
raw/<sport>_<season>_wk<N>_<market>.txt      one paste = one sport, week and market
  -> parse_action.py <sport> <season> <week> <market> <file>
  -> data/action_splits.csv                  one row per game-market
  -> join_results.py                         name crosswalk + results + orientation
  -> data/action_joined.parquet
  -> analyze_action.py                       the four theses, with nulls
```

To add a week, save the paste and run the three steps. Nothing else needs touching.

## What the paste looks like

Each game is a `Final` line, both team names (each appears twice, the first with a `Team Icon`
suffix, and big games add a 3-digit rotation number), then a numeric block, then bets%/money% for
the away side and the home side, an optional diff, and the ticket count. The numeric block is
market-specific: spreads and totals carry open/close/price for both sides (totals prefix the line
`o49.5` / `u50.5`), moneylines carry four prices and no line. Moneyline blocks often contain `N/A`
where a book never posted a side, and a game with no action has no percentage rows at all.

## Joining

There is no game id in the paste and the two feeds name teams differently (`VA Tech` vs
`Virginia Tech`). Games are matched on the PAIR inside a week — best combined similarity across
both names, assigned one-to-one, best first. The one-to-one rule matters: without it
`Sac State @ E. Michigan` and `San Jose St @ E. Michigan` both grab the San José State row.

Roughly half an early-season CFB board is an FBS team hosting an FCS team. Those games are not in
`model_games`, so they drop out. 99 pasted week-1 games become 50 graded ones; that is the slate,
not a matching failure.

## Orientation and grading

Everything is oriented to the AWAY side of the board, and for a total "away" means OVER, so the
three markets read the same direction. `model_games` stores the HOME spread (negative = home
favoured) and `actual_margin` as home-minus-away.

`join_results.py` asserts an oracle that re-derives every result from the raw scoreboard
(`homePoints` / `awayPoints`) by an independent route, plus a floor requiring the home cover rate
to land near half. The first version of this join computed the away spread as "points received"
and then subtracted it, which flipped the sign and printed a 77% home cover rate; an assertion
written off the graded column itself passed it happily. Grade from the scoreboard, never from the
column you are checking.

## Current state

CFB 2026 weeks 1-3, all three markets: 726 parsed rows, 153 distinct graded games. Read the
verdict block at the bottom of `analyze_action.py` before running anything new — fading the public,
reverse line movement, and every moneyline cell are dead, and two candidates (C1 spread by ticket
count, C2 heavy public totals) are pre-registered with frozen thresholds for the next block of
weeks. Do not re-scan; test those two.
