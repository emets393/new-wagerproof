# Action Network public-betting splits

Ticket/handle splits from Action Network, joined to our graded results and tested against the
standard public-betting theses.

## Pipeline

```
fetch_action.py <nfl|ncaaf> <season> <weeks>   weeks = 6 | 1-7 | 1,3,5 | current
  -> data/action_splits.csv                    one row per game-market
  -> join_results.py                           name crosswalk + results + orientation
  -> data/action_joined.parquet
  -> analyze_action.py                         the four theses, with nulls
```

To add a week: `python3 fetch_action.py nfl 2026 current && python3 join_results.py`.
The fetcher replaces only the (sport, season, week) blocks it fetched and leaves every other
row alone, so it is safe to re-run and was safe to introduce alongside the pastes.

### Verifying it

`verify_fetch.py <league> <season> <weeks>` diffs a fetch against the rows already on file.
`--live` fetches twice 60s apart, which is the real regression test for an undocumented
endpoint: the failure to catch is the silent one, where the response shape changes and we
start writing blanks into the research base. Measured 2026-10-16 — two reads a minute apart
agreed on 100% of every settled column; a re-fetch of the four hand-pasted NFL weeks agreed
on 94-97%.

### ⛔ What cannot be backfilled

`bets_*`, `money_*` and the opening line settle, so they re-read the same later. **The best-odds
columns do not.** `away_close` / `home_close` / `*_price` are the best price available AT THE
MOMENT YOU LOOK, and `tickets` climbs until kickoff — re-reading a finished week gives the
closing figures, not what was on screen when that week was pasted. A re-fetch of NFL weeks 1-4
reproduced the splits on ~95% of rows and the best-odds columns on only ~58%, and that gap is
capture time, not a defect. So the hand-pasted weeks were deliberately left alone: refetching
them would silently rewrite mid-week history with closing numbers.

The practical consequence is that a scheduled fetch is *better* data than the paste ever was,
because it captures a DEFINED moment every week instead of whenever the owner got to it.

## The manual paste path (superseded, still works)

NFL weeks 1-4 and CFB weeks 1-6 were pasted by hand through `parse_action.py`, which still runs.

### What the paste looks like

Each game is a `Final` line, both team names (each appears twice, the first with a `Team Icon`
suffix, and big games add a 3-digit rotation number), then a numeric block, then bets%/money% for
the away side and the home side, an optional diff, and the ticket count. The numeric block is
market-specific: spreads and totals carry open/close/price for both sides (totals prefix the line
`o49.5` / `u50.5`), moneylines carry four prices and no line. Moneyline blocks often contain `N/A`
where a book never posted a side, and a game with no action has no percentage rows at all.

## Joining

The two feeds name teams differently (`VA Tech` vs `Virginia Tech`), and the paste carried no
game id, so games are matched on the PAIR inside a week — best combined similarity across
both names, assigned one-to-one, best first. The one-to-one rule matters: without it
`Sac State @ E. Michigan` and `San Jose St @ E. Michigan` both grab the San José State row.

Roughly half an early-season CFB board is an FBS team hosting an FCS team. Those games are not in
`model_games`, so they drop out. 99 week-1 games become 50 graded ones; that is the slate, not a
matching failure.

Worth doing when someone next touches this: the API rows carry Action Network's own `game_id` and
numeric team ids, which the paste never had. Carrying those through would retire the similarity
match entirely for fetched weeks — it is only still here because the pasted weeks need it.

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

## The moneyline x spread cross (added 2026-10-10)

Owner's question: ML says "this team wins", the spread says "wins by X" — does joining the two
public reads on the SAME game find anything neither finds alone?

```
cross_ml_spread.py <sport>   build the per-game cross -> data/cross_<sport>.parquet
cross_pass2.py               residualise the confounds and re-test
cross_pass3.py               does the cross condition C1 / a plain fade?
cross_pass4.py               try to BREAK the one survivor (bands, weeks, placebo)
cross_walkforward.py         fit on earlier weeks only, bet the next
apply_wk6.py                 freeze the rule onto an unplayed board
oracle_wk6.py                re-grade played games off the raw scoreboard
```

**One cell survived.** Residualise the crowd's ML lopsidedness `|fav_ml_bets - 50|` on spread
magnitude (quadratic), tercile it, and split the crowd's SPREAD side by it: FOLLOW the crowd in
the relatively-split third, FADE it in the relatively-lopsided third. Walk-forward 85-66 (56.3%),
+7.5% at -110, 5 of 5 weeks above break-even, against a 48.3% unconditioned-crowd null on the
same games. Pooled p=0.14 on n=151 — a live candidate, not established.

**The obvious construct is dead.** The gap itself (`fav_spread% - fav_ml%`) correlates **-0.593**
with spread magnitude, so every raw gap cell is a line-size cell. Residualised, its terciles are
51.2 / 45.2 / 53.6 (p=0.877). An apparent 85.6%-vs-70.0% outright split was pure line size and
reverses inside spread bands. Quadrants, the money version, totals and NFL all failed too; the
"contradiction" cell (bets that cannot both win) is only 2 of 258 games. Full verdict with every
dead cell is in the `cfb-ml-spread-cross` memory.

## Game timing inside a slate day (added 2026-10-16)

Owner's question: if the public loses early, do they win late? If a big underdog covers
while the crowd was all over the favourite, do more favourites cover later? Sharper on the
notable high-ticket games?

```
timing_study.py [--sport nfl|cfb]
```

A prior game is one on the same day that kicked off >= 3h earlier, so it had actually
FINISHED when this game's number went live. Four pre-registered tests; kickoffs come from
Action Network's own `start_time`, converted to ET so a Sunday-night game does not start
its own UTC day.

**Verdict: null, both sports.** Best p was 0.200 (CFB T1) across eight tests.

| | CFB (310 games, 24 days, 196 targets) | NFL (72 games, 15 days, 23 targets) |
|---|---|---|
| T1 crowd cold early -> late | 50.5% vs 52.6%, z=-1.27, p=0.200 | 64.3% vs 22.2%, z=+0.60, p=0.533 |
| T2 early dog shock -> late fav | 42.5% vs 52.3%, z=-1.06, p=0.282 | 46.7% vs 50.0%, z=+0.29, p=0.833 |
| T3 notable games only | 69.6% vs 56.0%, z=+0.49, p=0.618 | 60.0% vs 0.0%, z=+0.82, p=0.455 |
| T4 dose, tercile lo vs hi | 54.4% vs 50.8%, z=-0.43, p=0.657 | 75.0% vs 25.0%, z=+0.98, p=0.380 |

If anything CFB leans the OPPOSITE way to the hypothesis — early crowd pain is followed by
more crowd pain, not a bounce, consistently across T1 and T2 at z≈-1.1 to -1.3. Momentum,
not reversal. Still inside noise; do not bet it.

★ **The reason to read this file even though the answer is no.** The NFL T1 cell reads
64.3% vs 22.2% — a forty-two point gap — and it is pure arithmetic. Shuffling kickoff
times inside the same days, same games, same results, produces a +33 point gap on average,
because a game is excluded from its own conditioning variable and a day holds roughly a
fixed number of crowd wins. Tested against 50% this "finds" a massive edge in both sports.
Always read z and the permutation p here, never the raw rate.

⚠ The effective sample is DAYS: 24 CFB Saturdays and 15 NFL days. Re-run as weeks accrue.

## The noon-ET CFB window (added 2026-10-16)

```
noon_cfb.py [--hour 12]
```

Owner's question: what do tickets and percentages do in the noon window, across all three
markets, with moneyline and spread read together since they are two readings of one opinion.

**n=59 graded noon games. The 95% band around a coin flip is ±13 points**, so nothing under
~63% is readable and a tercile cell (n~20) needs ~72%. Read that before any rate below.

**Descriptive — the window really is different:**

| | 12:00 ET | rest of slate |
|---|---|---|
| favourite covers | **61.0%** | 47.5% |
| over hits | **62.3%** | 48.5% |
| crowd is on the favourite (spread) | 52.5% | 59.1% |
| spread and ml crowds agree | 52.5% | 60.2% |
| median tickets | 18,559 | 15,923 |

Coherent story: at noon the crowd drifts to dogs more than it usually does, and favourites
cover more than they usually do — so the noon crowd is on the wrong side. Its spread side
covers 44.1% and its totals side 41.0%.

**Predictive — nothing survives.** 13 pre-registered cells, family-corrected by shuffling
the noon label across all CFB games and comparing against the best-of-13 null. Best cell
p_family=0.114. ⚠ A random 61-game slice produces a best cell **29.6 ± 5.2 points** off 50%,
so a 75%+ cell in a slice this size is the expected amount of noise, not a finding.

⛔ **Two traps in these numbers:**
1. `ml: crowd side wins 85.7%` is NOT an edge. The ML crowd sits on 96% of its own side —
   it is on heavy favourites — so this just restates that heavy favourites win outright.
   Same blind-favourite confound already recorded for the full slate.
2. The 61.0% favourite cover is substantially ONE WEEK. By week: 60 / 44 / **91** / 67 / 45
   / 56. Drop week 3 and it falls to **54.2%** (26-22). Over is the same shape: 62.3%
   overall, 58% without week 3. Four of six weeks above half in both — not a trend yet.

The favourite/over lean is the only thing worth re-testing as weeks accrue, and it is a
slate-structure read, not a ticket read — the crowd cells were all dead.

## Per-team ticket/money correlation (added 2026-10-16)

```
team_tickets.py [--min-games 4]
```

Owner's question: does the crowd's % on a TEAM relate to that team's outcome, and the same
for over/unders. Asked in three steps so it is not 166 separate tests — pooled dose, then a
DISPERSION test on whether team identity carries anything at all, then names with a
family-corrected p attached.

**1. Pooled dose — flat everywhere that matters.**

| | n | corr(ticket%, side wins) | p |
|---|---|---|---|
| CFB spread | 319 | +0.017 | 0.761 |
| CFB total | 325 | +0.021 | 0.694 |
| NFL spread | 73 | **-0.244** | 0.041 |
| NFL total | 80 | -0.054 | 0.635 |
| NFL ml | 78 | +0.259 | 0.018 |

The NFL spread cell is the only negative one and it does not survive: it is 1 of 6 dose
tests, so family p ≈ 0.22, n=73, and CFB with **four times the data shows nothing**
(+0.017). A real fade-the-public effect would show up more clearly in the bigger sample,
not vanish. Both ml cells are the blind-favourite confound again — the crowd sits on
favourites, favourites win outright.

**2. Dispersion — team identity carries nothing.** Spread of per-team rates vs a null that
permutes outcomes within sport, keeping every team's game count:

| | observed | null | p |
|---|---|---|---|
| CFB spread | 0.232 | 0.232 ± 0.013 | 0.492 |
| CFB total | 0.218 | 0.230 ± 0.013 | 0.824 |
| NFL spread | 0.214 | 0.238 ± 0.029 | 0.794 |
| NFL total | 0.209 | 0.222 ± 0.025 | 0.682 |
| NFL ml | 0.264 | 0.229 ± 0.025 | 0.080 |

CFB spread sitting at exactly the null (0.232 vs 0.232) is the market working: ATS cover
rates are ~50% for every team. ⚠ The one "significant" cell, CFB ml at p=0.000, is
**team quality, not an edge** — good teams win games outright. Any dispersion test on
moneyline outcomes detects that and it is worth nothing to a bettor.

**3. ⛔ The leaderboards are noise, and the script says so.** UCLA 5-0 ATS, Nebraska 5-0,
Utah 4-0, West Virginia 5-0 to the over. Every one carries `p_family = 1.00`, because
**a random relabelling puts its most extreme team 50 points off 50% on average** — with
129 teams at 4-5 games each, somebody goes perfect every single season in random data.

With ~4-5 graded games per team there is no power to measure a team effect at all;
detecting a true 10-point edge would need on the order of 100 games per team. This is the
same verdict the NBA reached for team x situation records — see `nba-team-spots`.

⚠ These scripts need `../.venv/bin/python` — there is no system pandas on this machine.

## Current state

CFB 2026 weeks 1-7 and NFL 2026 weeks 1-6: 1,742 rows, 408 distinct games matched, 1,207 joined
game-market rows. NFL is graded through week 5 plus week 6's Thursday game; CFB week 7 is only
partly played. Read the two verdict blocks at the bottom of `analyze_action.py` before running
anything new.

⛔ **Results come from the LIVE nflverse feed, pulled every run** — not from
`games_enriched.parquet` or `nflverse_games.parquet`, which are caches with no writer on this
path and have silently under-graded this join twice (wk3 on 2026-10-03, wks 5-6 on 2026-10-16).
`nflverse_games.parquet` is not even tracked in git. The join now prints the week range its
results actually cover, and warns when the splits file holds a week with no graded games.

Short version: nothing here is tradeable. Fading the public, reverse line movement and every
moneyline cell were dead on CFB; the two candidates that did survive there (C1 spread by ticket
volume, C2 heavy public totals) were frozen, then both INVERTED on NFL weeks 1-2. Four good-looking
cells have now each moved when new games arrived.

Do not re-scan this data for new cells. If more weeks arrive, test C1 and C2 at their frozen
thresholds, pooled, with the CFB and NFL halves reported separately.

Adding NFL: `games_enriched.parquet`, joined by an exact nickname-to-abbreviation lookup rather
than string similarity. Note `spread_line` there is positive when the HOME team is favoured, the
opposite sign to `model_games`, so `nfl_frame()` negates it.
