# NBA public-betting splits

Ticket and money percentages from Action Network, 2023-24 through 2025-26, with the
consensus close, the opener and the final score — all from one payload per slate date.

```
fetch_nba.py --seasons 2023 2024 2025     AN START-year labels; writes data/nba_splits.parquet
nba_study.py                              the battery
```

**3,976 completed games** (spread gradable 3,846, totals 3,920, ml 3,948). Orientation
guard passes every season: home covers 48.7 / 49.9 / 51.3%.

Neither `data/nba_splits.parquet` nor the response cache is in git — `research/.gitignore`
excludes `**/*.parquet`, and the cache is 91MB. Both rebuild from `fetch_nba.py`; with the
cache warm that is seconds, from cold about 15 minutes for ~1,000 slate dates.

⛔ **NBA ONLY.** An NFL or CFB result is not evidence about anything here, and nothing
here is evidence about them. Cross-league failure limits GENERALITY; it does not refute.

## The four endpoint traps

Documented in full in `fetch_nba.py`. Short version:

1. `bookIds` is camelCase and the full ten-id list is load-bearing. `book_ids=` returns
   `games: []`; a short list returns games with `markets: {}` and **no error**.
2. NBA is DATE-based: `date=YYYYMMDD` (ET slate date), passed **alone**. Adding
   `season=` returns zero games.
3. Book `30` = opener (no `bet_info`), book `15` = consensus line + the percentages the
   page prints. Percentages are game-level and repeat on every book — read once, from 15.
4. ⛔ **AN labels NBA seasons by START year** (a Jan-2025 game carries `season: 2024`).
   The rest of this repo uses END year, so the frame converts. `start_time` is UTC, so
   slate day comes from the `date` parameter, never from slicing the timestamp.

Money% coverage is 99-100% in every season, so the divergence work is comparable across
seasons — checked, not assumed.

## Results

**Base rates are centred.** Home cover 49.9%, over 50.5%, favourite cover 49.9% pooled.

**★ The NBA crowd's over-bias is enormous and completely priced.** The crowd is on the
over in **86.5%** of games, and 2,245 of 3,920 totals have it at 80%+ on one side. It
pays 50.9%. (NFL's equivalent lean is 65.9% — the NBA public is far more one-directional,
and it buys nothing.)

**Fading the crowd is flat in both markets.** Spread by lopsidedness band: 49.4 / 49.7 /
53.9 / 47.2 / 50.2 / 49.3%, **continuous corr −0.006** on 3,846 games. Totals corr
+0.006. Family p=0.202 and p=0.644.

**Moneyline is exactly priced.** Scored against the vig-free price of the side backed,
backing the crowd gives edge +0.1% overall, −0.3% in short games (fav ≥ −220, n=1,809),
+0.4% in long ones. Median vig 4.23%, so all three lose ~4% ROI. There is no version of
"follow the NBA moneyline crowd" that beats the price.

**Back-to-backs are fully priced** — the canonical NBA situational variable, and the
market has it in all three markets. Rested side covers 52.1% (n=866, roi −0.6%); the
crowd's side covers 51.3% when a B2B is involved; over hits 51.3% with a B2B vs 50.2%
without.

## ⛔ The cell that survived, and why it did not

NBA spread, back the money side on a **15-20 point** money-minus-tickets gap:
**112-74 (60.2%), +15.0% roi, n=186**, lower CI bound clearing break-even, and it
**survived the family correction at p=0.011** — the only cell in this work to do so. It
held 3 of 3 seasons (58.9 / 66.7 / 60.0%).

It is noise, and two checks show it.

**Band edges.** Those 5-point bins were an arbitrary choice. Slide the window:

| window | n | rate | roi |
|---|---|---|---|
| 15-20 | 186 | 60.2% | +15.0% |
| 15-21 | 212 | 59.9% | +14.4% |
| 16-22 | 181 | 54.1% | +3.4% |
| 12-18 | 332 | 53.6% | +2.4% |
| 10-25 | 701 | 51.8% | **−1.1%** |

At 2-point resolution it is a sawtooth: gap 12-14 is **45.2%**, gap 14-16 is **63.3%**
(n=109). One bin carries the whole thing, and no real dose-response jumps 18 points
between adjacent bins.

**★ The cross-market "corroboration" is an artifact, and it is the better lesson.** The
15-20 band is elevated in NFL spread, NFL total, NBA spread AND NBA total — four for
four, which reads like a mechanism. It is not. 15-20 is the **smallest bin in all four**:

| | 0-5 | 5-10 | 10-15 | **15-20** | 20+ |
|---|---|---|---|---|---|
| NBA spread | 1937 | 894 | 388 | **186** | 441 |
| NBA total | 2691 | 447 | 173 | **121** | 488 |
| NFL spread | 320 | 227 | 123 | **88** | 100 |
| NFL total | 311 | 203 | 131 | **84** | 148 |

The band most likely to throw an extreme value by chance threw it, in every market.
⛔ When the same cell "replicates" across datasets, check whether it is the thinnest cell
in all of them before believing the replication.

## The NFL moneyline flip, tested here

NFL has a live candidate: on short moneylines, when ticket and money majorities split,
fading the money side went 48-28 (63.2%, +9.2% roi, n=76, p=0.208). NBA is an independent
test of the same construct, with 335 short-ML flips — 4.4x the sample.

**It is flat here.** Back the money side 155-180, which is 46.3% against a no-vig 46.2%:
edge **+0.1%**. Fading it is −0.1%, permutation **p=0.981**, and no season clears +1% roi
(2024 −3.9%, 2025 +1.0%, 2026 −8.1%).

⚠ This does **not** refute the NFL result and must not be written up as if it does. It
says the effect is not present in NBA. The NFL candidate still rests on its own NFL
evidence — n=76, p=0.208, three profitable seasons of four — and only more NFL games can
settle it.

## Depth pass — day, time, line movement, per-market structure

```
nba_deep.py
```

Six families, each corrected best-of-N against a null that permutes outcomes **within
slate date**. Near-uniformly null. Family p-values: day-of-week spread 0.690, day-of-week
over 1.000, tip-window spread 0.513, tip-window over 0.121, RLM 0.726, spread structure
0.932, total structure 0.688.

**★ Reverse line movement is worth nothing in NBA.** The most-cited sharp indicator in
betting folklore, tested here for the first time (the openers had been sitting unused in
the frame). 2,511 games with an opener, line moved in 87%:

| | record | rate | roi |
|---|---|---|---|
| back the side the line moved TOWARD | 1128-1057 | 51.6% | −1.4% |
| RLM — line moves AGAINST the crowd, back the line | 594-562 | 51.4% | −1.9% |
| line moves WITH the crowd, back them | 534-495 | 51.9% | −0.9% |

Flat by size of move (52.9 / 50.5 / 51.4 / 51.0) and by crowd heaviness (50.2 / 50.3 /
54.0). Family p=0.726. ⚠ Note RLM happens in **53%** of moved games — the line moves
against the public majority more often than with it, which is what you would expect if
books shade against public money. It just does not predict anything.

Totals movement is the same story: total moved up → over 53.6% (n=1,213, +2.3%), moved
down → under 51.9%, totals RLM 52.1%.

**Spread and total structure are flat.** Every |spread| band 50.6-51.6%; road favourite
50.4%, home favourite 50.4%, road dog 50.3%, home dog 51.2%. Total bands 50.2-53.1%.
**The moneyline is efficient at every price band** — edges vs the vig-free number of
+0.5 / +0.3 / −2.0 / +1.3 / +0.1% from pick'em out to −320 and longer.

### ★ The one lead worth tracking: afternoon unders

Games tipping before 7pm ET (almost all Sat/Sun matinees) go under at **54.9%**
(258-212, +4.8% roi, n=470), and it is the best-behaved cell found anywhere in this work:

- **3 of 3 seasons**: 55.4 / 53.9 / 55.4%
- **stable across the cutoff**: under rate 54.4 / 54.4 / 53.8 / 54.9% for tip < 16:00 /
  17:00 / 18:00 / 19:00, then collapsing to 50.8% at < 20:00 — which is exactly where the
  7pm Eastern slate floods in. The boundary sits where the mechanism says it should.
- **a visible mechanism**: the market *does* adjust, just not enough. Afternoon totals
  average 226.66 vs 227.63 in the evening (−0.96), while actual points average 225.96 vs
  228.31 (−2.34). It under-adjusts by about 1.4 points.

⚠ **Not established.** Family-corrected p=0.121, and the mechanism test itself is
p=0.116 (Welch t=−1.58; permutation −1.38 pts, null 0.00 ± 0.87). The 95% CI is
[50%, 59%] — the lower bound is under break-even. 1.4 points on a 227 total is a thin
edge that vig can eat.

Saturday afternoons are the stronger half (58.9%, n=107) against Sunday (52.9%, n=312),
but that split was not pre-registered and Saturday is thin — do not trade on it.

⛔ Two descriptive notes worth keeping even though nothing bets on them: ticket volume
swings hard by day (Tue median 30,779 down to Sun 17,054), and the 10pm+ West Coast
window draws the **most** money per game (29,146) while being the least-watched slot.

## ⛔ THE MONEY% INSTRUMENT CHANGED BETWEEN 2023-24 AND 2024-25

This is the most important thing in this directory and it invalidates any pooled
bets-vs-money analysis across NBA seasons.

Distribution of `|money% − tickets%|`:

| | median | p90 | share >=15 | games with gap >60 |
|---|---|---|---|---|
| **totals 2023-24** | **12.0** | **50.0** | **45.2%** | **89** |
| totals 2024-25 | 2.0 | 6.0 | 0.7% | 2 |
| totals 2025-26 | 1.0 | 4.5 | 0.2% | 1 |
| **spread 2023-24** | **11.0** | **36.8** | **40.7%** | — |
| spread 2024-25 | 3.0 | 10.0 | 3.2% | — |
| spread 2025-26 | 4.0 | 11.0 | 4.1% | — |

A step change, not drift. A 60-point gap between money% and tickets% is not a market
phenomenon, and 2023-24 has 89 of them on totals while the next two seasons have three
between them. ⚠ NFL over the same span shows **no such break** (spread medians 7 / 6 /
7 / 8, share>=15 between 12.6% and 31.9%), so this is specific to AN's NBA feed, not to
the endpoint.

**What this invalidates.** Every pooled NBA divergence cell earlier in this file mixes
two incompatible measurements. The spread 15-20 band that "survived at p=0.011" is
535 of 627 games from 2023-24; the totals `|gap|>=15` cell is **598 of 609** from it.
⛔ Coverage was checked (99-100% non-null every season) and that was not enough — the
values changed, not their presence. Check the DISTRIBUTION of a feature by season, not
just whether it is populated.

**Within 2023-24 alone** the totals effect does separate: `|gap|>=15` back the money side
331-267 (55.4%) against 358-367 (49.4%) for smaller gaps, Fisher p=0.031 with no regime
mixing. But it is one season, uncorrected for the many cells tested here, and **it cannot
be traded** — gaps that size occur in 0.2% of 2025-26 totals.

**On current-regime data** divergence survives only on the moneyline (share>=15 is 28.5%
then 22.8%). There it is dead once scored properly. Fading the money side looks
spectacular on raw rate — 45.8% / 37.9% / 29.8% backing it across widening gaps, a clean
monotone collapse — and it is **entirely the money side sitting on longer dogs**:

| \|gap\| | fade rate | no-vig | edge | roi | n |
|---|---|---|---|---|---|
| 0-10 | 54.1% | 54.2% | −0.1% | −3.6% | 1494 |
| 10-20 | 62.1% | 64.6% | −2.5% | −9.2% | 676 |
| 20-40 | 70.2% | 67.7% | +2.6% | −0.6% | 363 |
| 40+ | 68.5% | 71.1% | −2.7% | −6.1% | 73 |
| **>=20 pooled** | **70.0%** | **68.2%** | **+1.7%** | **−1.5%** | **436** |

Permutation p=0.417; by season +2.1% then −6.1% roi. ★ A 70% hit rate that loses money
is the cleanest illustration in this repo of why a moneyline is never scored against 50%.

## Reading any cell here

Read every record **from the bet's side**: a 28-48 is a 48-28 fade, and the fade is the
bet. `ml_score()` prints the fade of any cell that loses to its price, re-priced at the
other side's odds. ⛔ Never score a moneyline against 50% — the ML crowd sits on
favourites, so a bare rate restates that favourites win.

⚠ Needs `../.venv/bin/python` — there is no system pandas on this machine.
