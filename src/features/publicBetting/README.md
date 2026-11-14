# Public Betting (`/public-betting`)

Tickets versus money for every upcoming game on the board, across NFL, CFB,
NBA, and NCAAB, for spread, total, and moneyline. The detail header labels
the source as Action Network. The page describes the market. It does not
issue a pick, show a conviction, or attach a betslip, and it never treats an
Action Network price as a number you can bet.

## Layout

Same shell as `/todays-trends`: `SplitViewLayout`, feed on the left, detail on
the right, URL state, React Query. `/public-betting` is in `SPLIT_VIEW_ROUTES`
so the panels scroll on their own.

URL: `?sport=all|nfl|cfb|nba|ncaab&market=spread|total|ml&signal=sharp|all&sort=sharp|time|tickets|money|diff&game=<id>`.

`sort` defaults to the sharp rank. Time is soonest first. Tickets is the
count on that market. Money is the bigger side's share of the dollars, which
is a percentage. Difference is how far that money share sits from the ticket
share.

When `sport` is absent, the page lands on the league that is actually in
season and present on the board:

1. NFL from September through February, when any NFL row exists. That is the
   landing league on 20 Oct 2026.
2. CFB from August through December.
3. NBA from October through June.
4. NCAAB, then whatever is left, then All.

An explicit `sport=all` stays on All. Sport pills are built from leagues in
the response, so a league with no rows does not get a dead chip. Market
defaults to spread. "Sharp money only" is the first signal option; the
default signal is All.

Changing sport clears the selected game. Search is local to the feed.

## Data

One query against `action_public_splits_board` on the CFB Supabase client,
ordered by `start_time`. The view is already the newest row per
`(game_id, market)`. Do not read `action_public_splits` and do not reduce
latest-per-key in the client — that log is the whole season and grows every
week.

Rows are grouped into games. A market the view did not return is absent.
`snap_ts` is per row; the header shows the newest of them as
"Action Network · captured {relative} ago" and never an average.

React Query `staleTime` is 5 minutes, with refetch on focus. The writer runs
hourly.

The away slot is the away team on spread and moneyline, and the OVER on a
total. `bets_away` on a total is the over.

Basketball `season` is the end year. The page does not filter on season.

## The read

All of it is in `signals.ts`, behind `THRESHOLDS`. Do not copy those cuts
into a component.

A sharp read is three things at once: the tickets are on one side, the other
side's money share exceeds its ticket share by at least 10 points, and the
line moved toward that other side. The ticket percentage only changes how
the sentence describes the crowd. It does not decide whether a money read
exists. Boise State @ Washington St (tickets 52/48, money 15/85, line −16.5
→ −13) is Sharp Money on Washington St.

The current line is `away_cons` / `home_cons`, the consensus book. Movement
is consensus minus opener. `away_close` / `home_close` are best odds per
side and are never averaged into a line. A missing opener is null. American
odds go through no-vig implied probability and are never subtracted.

Nine categories, first match wins. The first five are spread and total
only; moneyline starts at consensus.

1. `sharp_money` — money on the quiet side, line moved toward it. Loud chip.
2. `money_no_move` — same money split, line has not moved.
3. `line_fights_money` — same money split, line moved toward the tickets.
4. `hammered` — money piled onto the ticket side and the line followed. The
   sentence says this is the public with volume, not sharp action.
5. `public_loading` — money piled on, and the line did not move against it.
6. `consensus` — 60%+ of tickets, line moved with them.
7. `line_pushes_back` — line moved against the tickets while the money stayed
   with them. Muted on purpose. It is the most common read on a full board.
8. `public` — 60%+ of tickets, nothing else.
9. `split` — anything left. The chip text is "Leaning {side}" when the lead
   is over `LEAN_TICKETS` (55). That cut is a label, never a gate. The feed
   does not render a chip for this category.

A move under `CONFIRM_MOVE` is collapsed to no move once, before any
category looks at it. A row is left off the feed when either side is 0% or
100%, or there are fewer than 200 tickets. A moneyline whose quieter side
is under 15% is also left off. That floor does not apply to spreads or totals.

Sort is category rank, then tilt, then move size. `strong` is a 20-point
tilt and a wide move on `sharp_money`. It does not change the sentence.

## Graphics

Inline SVG and CSS. No chart library.

- Divergence bar: tickets and money share one axis, each split at its own
  percentage. The gap between those splits is a translucent wedge in the
  color of the side the money favors, and the line under it says that gap
  in words ("19% more money than tickets on S. Carolina"). On a spread or
  moneyline the away logo sits on the left and the home logo on the right.
  Totals stay Over and Under. A team color that falls under 4:1 on the dark
  card is lightened just enough to clear it. Over is `#10b981`, under is
  `#3b82f6`, spread and moneyline use team colors.
- Line-move rail: the opener is a hollow cell, the current number is filled
  when the line moved, and the arrow takes the color of the side it moved
  toward. Spreads and moneylines name the team on every figure. A missing
  opener is the current number alone, with no arrow.
- When `sharp_money` fires, the wedge and the arrow are the same color, they
  sit next to each other, and the chip wears a ring in that color.

Bars may animate their width. Nothing else does.

## Access

Percentages and both graphics are free. Category chips and sentences are wrapped
in `ProGate`. The route uses `allowFreemium` and does not set a premium
minimum, so the page itself is not walled. The gate is a client check. The
view is meant to be readable by the anon key, and this gate is not a security
boundary.

## Before the board renders

`action_public_splits_board` has to exist, with `select` granted to anon, or
the client gets zero rows and shows the unavailable state. The SQL is in
`.claude/docs/31_public_betting_page_brief.md` §3. Do not apply it from the
app, and do not fall back to the raw log.
