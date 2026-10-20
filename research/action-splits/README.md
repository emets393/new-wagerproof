# Action Network public-betting splits

Ticket/handle splits from Action Network, joined to our graded results and tested against the
standard public-betting theses.

Football research lives here; the NBA study is in `research/nba-splits/` off the same feed
(`fetch_nba.py`, date-based). The hourly capture below covers all four leagues at once.

## Pipeline

Two paths off the same parser. The RESEARCH BASE is a file, rebuilt a week at a time; the
CAPTURE is a database change log, written hourly by a GitHub Action.

```
fetch_action.py <nfl|ncaaf> <season> <weeks>   weeks = 6 | 1-7 | 1,3,5 | current
  -> data/action_splits.csv                    one row per game-market
  -> join_results.py                           name crosswalk + results + orientation
  -> data/action_joined.parquet
  -> analyze_action.py                         the four theses, with nulls

snapshot_action.py                             NFL + CFB + NBA + NCAAB, hourly
  -> action_public_splits (CFB Supabase)       a row only when something MOVED
  -> action_public_splits_latest               DISTINCT ON view, one row per game-market
```

To add a week: `python3 fetch_action.py nfl 2026 current && python3 join_results.py`.
The fetcher replaces only the (sport, season, week) blocks it fetched and leaves every other
row alone, so it is safe to re-run and was safe to introduce alongside the pastes.

### The hourly capture

`.github/workflows/action-splits-hourly.yml`, :07 past the hour, August through June — the
union of four seasons (CFB Aug-Jan, NFL Sep-Feb, NCAAB Nov-Apr, NBA Oct-Jun). July is the
only month with nothing on any board.

**Four leagues, two shapes.** Football is week-based (`season=YYYY&week=N`, current week);
basketball is date-based (`date=YYYYMMDD` on the ET slate date) and takes **today and
tomorrow**, because a line posts the day before and the pre-tip arc is the point of going
hourly. ⛔ The basketball date travels ALONE — adding `season=` returns zero games. Adding
a league is one line in `LEAGUES`.

⛔ **`season` is the END year for basketball.** Action Network labels an NBA/NCAAB season by
its start year, so a January 2027 game arrives as `season: 2026` and is stored as 2027 to
match every other piece of basketball work in the repo. Football is unshifted. Same trap as
`fetch_nba.py`, which documents it at length.

⛔ **The key is `(game_id, market)`**, not the team names and not the week. Football is keyed
by week and basketball has no week at all; two NBA teams meet several times a season, so a
name-and-week key silently collapses different games into one row. The CSV path still matches
names fuzzily because the hand-pasted era carried no id — this path has one, so it uses it.

**In Actions and not on Render**, because the repo is public (free minutes) and the job is
~20 seconds of stdlib Python against one JSON endpoint — no build, no service, no 2Gi.
⛔ Do not migrate it to Render, and do not move anything timing-critical the other way:
GitHub's scheduled triggers run 5-20 minutes late routinely and are dropped under load.
That is fine for an hourly change log and NOT fine for a T-60 closing capture.

**A change log, not a snapshot log.** A full hourly dump would be ~210 game-markets × 2
leagues × 24h with 95% of it identical to the row before. A row is written only when that
game-market moved since its last stored row — measured at 34 of 210 over four minutes on a
Tuesday, so the cadence is earning its keep. Consecutive rows bracket every interval
observed, so the last row before kickoff IS the closing state. The diff reads one row per
key from `action_public_splits_latest`, so its cost is flat in season length instead of
growing with the log. ⛔ Do not turn this into an unconditional insert.

**It fails loud, without crying wolf.** Games-but-no-rows exits non-zero rather than writing
blanks — see the `bookIds` note in `fetch_action.py`, where a bad query returns games with
`markets: {}`, no odds and no error. The one case that is NOT a defect is a date whose games
are too far out for any book to have posted a market, which is real on an NCAAB November
morning, so the hard failure needs a game tipping inside 36 hours; further out prints a
warning and moves on. A failed scheduled workflow emails the repo owner, and
`health_sweep.py` carries a staleness probe besides, because an Actions failure does not
reach the Render alert channel the other football jobs use. ⛔ That probe is PER SPORT: one
overall `max(snap_ts)` would let a live NBA slate mask the football endpoint having died.

Team names are trimmed on the way in (the feed ships `"Army "`); the CSV path keeps them raw,
because `join_results.py` matches names fuzzily anyway.

⚠ The capture stores percentages RAW, including the 0%/100% placeholders the feed serves for
some early-season slates. `derive()` in `fetch_nba.py` drops those per market and anything
reading this table should do the same — see the placeholder note there, where 17.2% of the
2023-24 NBA season was affected.

Needs `SUPABASE_SERVICE_KEY` in the repo's Actions secrets. The table is
`scripts/sql/action_public_splits.sql`.

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

As of 2026-10-20 the hourly capture above is that scheduled fetch, and it is the only way the
unbackfillable half ever gets recorded. Until then nothing was scheduled at all: every row on
file came from a manual run, and `data/action_splits.csv` still carries the mid-week values
for the weeks that were fetched before kickoff rather than their closing ones.

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

## ⛔ NFL heavy-public fade — TESTED OUT OF SAMPLE AND DEAD (2026-10-16)

```
nfl_fade.py        the in-sample work on 2026 wks1-6 (kept: the method is sound)
nfl_fade_oos.py    the same rule, unfitted, on 2023-2025. This is the verdict.
```

**The rule does not survive.** Applied unchanged (fade any side holding >=70% of spread
tickets, at -110, break-even 52.4%):

| season | record | rate | ROI |
|---|---|---|---|
| 2023 | 50-48 | 51.0% | −2.6% |
| 2024 | 49-56 | 46.7% | −10.9% |
| 2025 | 50-28 | 64.1% | +22.4% |
| **pooled 2023-25** | **149-132** | **53.0%** | **+1.2%** (n=281, CI [47%, 59%]) |
| 2026 (the fit sample) | 16-6 | 72.7% | +38.8% (n=22) |

Two of three prior seasons lose money and the pooled number is break-even. The continuous
correlation across 784 out-of-sample games is **−0.032** for tickets and −0.016 for money
— flat.

**★ The decisive in-sample test fails too.** The size-matched control was what made 2026
convincing: at the same line sizes, fading the favourite went 14-3 (82.4%) with a heavy
crowd vs 16-18 (47.1%) without, Fisher p=0.019. Out of sample on n=637 the same test
returns **51.3% vs 47.9%, Fisher p=0.456**. The separation was a 17-game cell.

The dose SHAPE repeats in only one prior season — 2025 declines monotonically (59/62/49/
42/36%) like 2026 does, while 2023 and 2024 are shapeless. ⚠ Two of four seasons is not
evidence of a regime change; it is what noise looks like. Do not revive this on that basis.

⛔ **A caveat I raised here was wrong and is withdrawn.** I claimed the 2026 fit sample
was captured mid-week while the prior seasons serve closing splits, which would have made
the comparison unfair. Owner correction, 2026-10-16: the pasted weeks were taken at
closing too. The evidence was already on file and I misread it — re-fetching the four
hand-pasted NFL weeks reproduced the splits on **94-97%** of rows, which only happens if
the pastes were already at closing. So the out-of-sample test is apples-to-apples and
there is no lifeline here. The fade is dead.

★ LESSON: the in-sample work was done carefully — monotone dose, week-by-week stability,
leave-one-out, a line-size control that it passed — and it was still a 22-game mirage.
Nothing short of out-of-sample data was going to catch it. Three seasons were one fetch away.

### The in-sample work, for reference

```
nfl_fade.py
```

⛔ **NFL ONLY.** Nothing in this file looks at CFB and a CFB result is not evidence about
it. Different talent dispersion, different roster turnover, softer college lines — an
effect can live in one league and not the other. Cross-league failure limits GENERALITY,
it does not refute. Standing owner instruction (2026-09-26), broken once on 2026-10-16
when a flat CFB number was used to wave this finding off. Do not repeat it.

**The dose, NFL 2026 wks 1-6, n=72 graded spread games** (in-sample only — see the verdict above):

| crowd ticket% on a side | n | that side covers | 95% CI |
|---|---|---|---|
| 50-54 | 13 | 53.8% | [29%, 77%] |
| 55-59 | 16 | 50.0% | [28%, 72%] |
| 60-64 | 12 | 41.7% | [19%, 68%] |
| 65-69 | 9 | 44.4% | [19%, 73%] |
| **70+** | **22** | **27.3%** | [13%, 48%] |

It is a THRESHOLD, not a line. The continuous slope is not significant (corr -0.168,
within-week permutation p=0.153; money -0.197, p=0.103) because the effect is concentrated
at 70%+, which a linear fit dilutes.

**It is not one week.** Heavy-crowd (>=60%) side covered 40 / 30 / 29 / 25 / 50% in weeks
1-5 — five of five below half. Leave-one-week-out on that cell stays inside 31.4-37.1%.

**★ It is not line size, which was the thing most likely to kill it.** Crowd share
correlates +0.521 with |spread|, so the obvious story is "the crowd sits on big favourites
and big favourites failed." Holding line size fixed at the sizes where heavy-crowd games
actually live (|spread| 2.5-10.0, n=51), fading the FAVOURITE went:

| | record | rate |
|---|---|---|
| crowd >= 70% | 14-3 | **82.4%** |
| crowd < 70% | 16-18 | 47.1% |

gap +35.3%, within-week null +7.3% ± 14.1%, **permutation p=0.048, Fisher exact p=0.019**.
Same bet, same line sizes, only the crowd varies — so the crowd is carrying something of
its own.

**Betting it at -110** (break-even 52.4%): crowd >=55% 36-23 (+16.5%), >=60% 28-15
(+24.3%), >=65% 21-10 (+29.3%), **>=70% 16-6 (72.7%, +38.8%, CI [52%, 87%])**.
Walk-forward, threshold picked on earlier weeks only: 9-5, +22.7%.

⚠ **What killed it:** n was 17-22 in the headline cells and the 95% lower bound at the 70%
threshold was 52% — exactly break-even. Three prior seasons settled it; see the verdict at
the top of this section. ⛔ Do not re-read the in-sample numbers above as a finding.

## NFL by kickoff slot, 2023-2026 (added 2026-10-16)

```
nfl_slots.py [--seasons 2023 2024 2025 2026]
```

893 completed NFL games across four seasons, pulled self-contained from Action Network
(splits, consensus close, final score, `start_time`, `broadcast.network`, conference and
division). Slots are derived from the ET kickoff, not guessed. Home cover 49.4% — guard OK.

**★ The descriptive table is the real content, and it kills a folk belief:**

| slot | n | med tickets | med \|spread\| | crowd share | crowd on fav | divisional |
|---|---|---|---|---|---|---|
| TNF | 63 | **284,651** | 4.5 | 66% | 67% | **57%** |
| Sun early | 417 | 122,244 | 4.0 | 66% | 65% | 35% |
| Sun late | 216 | 120,124 | 3.5 | 65% | 58% | 40% |
| SNF | 58 | 239,243 | 3.5 | **62%** | 57% | 16% |
| MNF | 63 | 256,499 | 4.5 | **61%** | 68% | 19% |

⛔ **Primetime does NOT draw a more lopsided public.** SNF (62%) and MNF (61%) are the
*least* lopsided slots on the board; Sunday early and TNF (66%) are the most. The common
claim that standalone national games pull heavier public money onto one side is false
here — they pull more VOLUME (TNF is the most-bet slot of all at 285k median tickets,
above SNF and MNF) without pulling more LEAN. Volume and lopsidedness are different things
and this dataset separates them cleanly.

TNF being 57% divisional, against 16-19% for SNF/MNF, explains much of its character.

**Predictive: nothing survives.** 24 cells (6 slots x 4 outcomes), corrected against the
best-of-N under a null that permutes the slot label within (season, week). Best cells were
Sunday-late favourite covers 56.0% (n=216, p_cell=0.058) and Sunday-late crowd covers
55.1% (p_cell=0.089) — neither close after correction. ⚠ A random relabelling puts its
most extreme cell **13.6 ± 3.4 points** off 50%; our most extreme is 6 points out, i.e.
well inside the noise band. This is a strong null, not an underpowered one.

⚠ The tempting story — primetime unders, SNF 42.4% and MNF 43.1% — **does not hold**,
because TNF goes the other way at 55.7% over. If primetime caused unders it would do it
in all three primetime slots. Reporting SNF+MNF while dropping TNF would be cherry-picking.

## NFL totals, 2023-2026 (added 2026-10-16)

```
nfl_totals.py
```

877 graded over/unders. Totals had only ever been a side-cell here; this is the dedicated pass.

**Base rate: the market is centred.** Over 440-437 (50.2%) pooled. Per season 45.6 / 53.2 /
52.1 / 49.3% — real year-to-year swing, no standing edge.

**★ The crowd's over-bias is real AND completely priced.** The public is on the over in
**65.9%** of games (median over-ticket share 62%), which is the folk claim confirmed. It
pays nothing: crowd-on-over → over hits **50.0%** (n=578); heavy crowd on the over (>=65%)
→ over hits **50.0%** exactly (n=394). A genuine, measurable behavioural bias that the
line has entirely absorbed. Knowing the public leans over is not the same as it being
exploitable.

**⛔ The recorded flip finding does not replicate.** The `action-network-splits` note
carried "tickets and money majorities on OPPOSITE sides of a total → back the MONEY" at
**NFL 78.6%**, off n=14. Unfitted across four seasons:

| season | record | rate |
|---|---|---|
| 2023 | 29-28 | 50.9% (n=57) |
| 2024 | 11-10 | 52.4% (n=21) |
| 2025 | 21-15 | 58.3% (n=36) |
| 2026 | 10-3 | 76.9% (n=13) — the original sample |
| **pooled** | **71-56** | **55.9%**, roi +6.7%, CI [47%, 64%], n=127 |

Break-even is 52.4%. The largest single season (2023, n=57) lands at 50.9% — below vig —
and the CI straddles break-even. ★ The dose kills it: if divergence drove this, bigger
gaps would pay more, and they do not — |money−tickets| of 10-15 gives 56.5% but **15+
gives exactly 50.0%** (n=232). Downgrade the recorded 78.6%; it was a 14-game artifact.
This says nothing about the CFB 65.2% leg, which is untested and needs its own fetch.

**Dead:** fading the crowd's totals side by lopsidedness (43.4 / 44.9 / 55.2 / 47.8 /
51.2% across bands, corr +0.028 — not monotone, no signal). And "big totals go under" is
**false**: 50.6 / 48.0 / 55.2 / 48.4 / 47.9% by line band, corr +0.031.

**Family correction:** most extreme cell is 6.6 points off 50%, a within-week reshuffle
gives **8.8 ± 2.9**, p_family=0.754. The whole family is inside noise — and note the
observed best is *below* the null's average best, which is what a genuinely dead family
looks like.

## ⛔ Money% minus tickets% — the sharp-money read. Dead in both markets (2026-10-16)

```
nfl_divergence.py
```

NFL 2023-2026, **858 graded spreads and 877 graded totals**. This is the dedicated pass
the divergence never had: `money_minus_bets_away` had been a column since the beginning
with zero downstream readers, and totals had only ever been tested for the strict flip.

Two constructs, kept apart. **FLIP** = ticket majority one side, money majority the other
(~15-17% of games). **TILT** = money% exceeds tickets% on a side without crossing 50 —
what a "67% of bets, 81% of money" headline actually describes, and far more common.

**★ Backing the money side LOSES on spreads in every single season:**

| season | record | rate |
|---|---|---|
| 2023 | 127-130 | 49.4% |
| 2024 | 126-135 | 48.3% |
| 2025 | 136-130 | 51.1% |
| 2026 | 34-40 | 45.9% |
| **all** | **423-435** | **49.3%** (n=858, roi −5.9%) |

Break-even is 52.4%. Not one season clears it. The continuous correlation between the
signed gap and the outcome is **+0.006** on 858 games — zero to three decimal places.
Totals are no better overall: back the money side 448-429, **51.1%**, also under vig.

**★ The dose is non-monotone in BOTH markets, which is the signature of noise.** If a
wider gap meant more sharp money, the widest band would be the best cell. It is not,
in either market:

| \|gap\| | spread | total |
|---|---|---|
| 0-5 | 47.8% | 50.8% |
| 5-10 | 50.7% | 49.3% |
| 10-15 | 44.7% | 46.6% |
| 15-20 | **55.7%** | **58.3%** |
| 20+ | 51.0% | 54.1% |

Both markets dip at 10-15, pop at 15-20, then fall back at 20+. Two independent markets
producing the same ragged shape is what a non-effect looks like, not a threshold.

**Everything else is flat too:** FLIP on spreads 50.7% (n=148) vs backing tickets 49.3% —
the two sides of a coin. Heavy crowd with money against it 52.0%, with money behind it
48.7%. Family correction: spreads p=0.756, totals p=0.326; in both the observed best cell
sits at or below what a within-week reshuffle produces.

The one survivor-ish cell is the totals FLIP at 55.9% (n=127), already downgraded in the
totals section above — its own dose contradicts it. ⚠ Nothing here speaks to CFB.

## NFL short moneylines, inside ±220 (added 2026-10-16)

```
nfl_short_ml.py [--cap 220]
```

Every moneyline read here had come back "the crowd side wins a lot" and been worthless,
because the ML crowd sits on favourites and favourites win. At -400 that is arithmetic.
Capping the favourite at -220 (~69/31) strips the chalk and asks the only version that
can carry information. 885 decided games, 2023-2026, **55% of them short**.

★ **Scored against the VIG-FREE implied probability of the exact side backed, never
against 50%**, with ROI settled at the real price. A crowd side winning 58% at a no-vig
59% is losing, and a 50% yardstick would call it an edge.

**The cut reverses the sign, which is why it was worth making:**

| | rate | no-vig | edge | ROI | n |
|---|---|---|---|---|---|
| all games | 65.8% | 64.3% | +1.4% | −1.7% | 885 |
| **short (fav ≥ −220)** | 60.1% | 56.3% | **+3.7%** | **+1.6%** | 491 |
| long (fav < −220) | 72.8% | 74.3% | **−1.4%** | −5.9% | 394 |

The crowd beats the price in competitive games and loses to it on heavy chalk. The full
sample averages the two into nothing. Within the short cut it is entirely the **favourite**
side carrying it (63.5% vs 58.8% no-vig, roi +3.8%, n=406); crowd-on-dog is −0.8%.

⚠ **Not a bet, for three reasons.** Permutation p=**0.056**. Vig eats most of it — a
+3.7% edge over the no-vig price nets **+1.6%** at the real one, because median vig is
4.21%. And the season ledger decays:

| 2023 | 2024 | 2025 | 2026 |
|---|---|---|---|
| +4.4% | +7.7% | +0.7% | −2.1% |

Two good seasons then two flat-to-negative is the shape of something fading, or of
something that was never there.

**Dead inside the cut:** the lopsidedness bands are non-monotone (55-59% edge +15.2% on
n=48, 60-64% +12.1%, then 65-69% **−2.3%**, 70+ +1.9%) — a hot patch with cold cells
either side is noise, and combining 55-64 after seeing it would be the same move that
produced the heavy-public fade. **★ THE ML FLIP FADE — the best cell in this directory.** ⛔ I first reported this as
"28-48, worse than dead". **A losing record from one side is a winning record from the
other** and that framing buried the finding. Read from the bet's side:

> **Short ML, tickets and money majorities on opposite sides → FADE the money side
> (= back the ticket side): 48-28 (63.2%), ROI +9.2%, beating the no-vig price by
> +7.1%, n=76.**

| season | record | ROI |
|---|---|---|
| 2023 | 19-9 | +19.9% |
| 2024 | 13-8 | +5.3% |
| 2025 | 15-5 | +29.0% |
| 2026 | 1-6 | −77.9% (n=7) |

Three profitable seasons out of four, and it only exists in the SHORT cut — the same
fade on long moneylines is **−11.5% roi**, so the price cap is load-bearing.

⚠ Not established: **p=0.208** (z=+1.26) against a correct null, n=76, and 2026 is 1-6.
⛔ My first p of 0.432 was from a BROKEN null that permuted within season-week — with 76
games over four seasons most groups hold one game, so the shuffle was near-identity and
manufactured a fake +6.5% baseline. The correct null draws a random side per game:
0.00% ± 5.63%. Check group sizes before trusting any within-stratum permutation.

Note the direction is OPPOSITE to the recorded totals note (which said back the money).
On short NFL moneylines the TICKET side is the one to be on.

The TILT dose is flat (+3.2 / −1.5 / +0.3 across gap bands), so this is the strict flip
or nothing.

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
