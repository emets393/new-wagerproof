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

---

## ★ VERDICT: there is no edge in NBA betting percentages

Everything below is the working. The conclusion, after ~3,300-3,900 graded games per
market, three seasons, and every framing the data supports:

| what was tested | result |
|---|---|
| fade/follow the crowd by lopsidedness, spread | corr **−0.006** (n=3,604). Pooled by band: 51 / 51 / 51 / 52% |
| same, totals | corr **+0.006** (n=3,687) |
| same, moneyline | priced at **every** band: edge vs no-vig +0.5 / +0.3 / −2.0 / +1.3 / +0.1% |
| short moneylines (±220) | edge **−0.3%**; long +0.4%. No version beats the price |
| lopsidedness by month | 51 / 51 / 51 / 52% — four bands, one number |
| money% − bet% (TILT and FLIP), spread + totals | flat in the current regime; the 2023-24 signal was a broken instrument |
| money% − bet% by month (the cross) | nothing, either regime, any market |
| money% − bet% x ticket volume | diagnostic only — it shows the 2023-24 gap was small-sample jitter |
| day of week | p=0.690 |
| tip time | p=0.513 |
| line movement and reverse line movement | 51.4% backing the line on RLM, **−1.9% roi**, p=0.726 |
| spread structure (line size, home/road, fav/dog) | every cell 50.3-51.6%, p=0.932 |
| total structure (line level) | p=0.688 |
| back-to-backs | priced in all three markets |

**The public's lean is large, consistent, and worth nothing.** The NBA crowd sits on the
over in 86-100% of games every single month and on 62-65% of one spread side every single
month. None of it pays.

### The two things that DID survive are not percentage effects

- **April regular-season OVER** — 57.6% (n=311), +9.9% roi, **3 of 3 seasons**, family
  p=0.013, with a visible mechanism: the market shades totals DOWN into April (229.5 →
  226.0) while scoring goes UP (227 → 229). That is a calendar effect, not a crowd effect.
- **October FADE the favourite** / **April BACK the favourite** — a 14.8-point swing that
  clears a family correction (p=0.034) but whose April end loses in 2023-24. Also not a
  percentage effect.

### The one genuine percentage exception, and why it is still only a lead

**Fading the crowd on playoff spreads: 146-112 (56.6%), +8.0% roi, n=258**, and tight
across seasons — 55.3 / 57.0 / 57.5%. Against a correct random-side null that is z≈2.1,
p≈0.03 uncorrected (family p=0.052).

⚠ It has **no dose**, which is the mark against it: crowd 50-59% fades at 60.8%, 60-69% at
54.4%, 70-79% at 60.8%. If fading the crowd were the mechanism, heavier crowds would fade
better. And it concentrates in the first round (April 58.6%, May 52.6%). ⛔ Its
within-night permutation returned a null of 54.5%, not 50%, because playoff nights hold
one or two games and the shuffle is near-identity — the same trap documented twice below.
Worth tracking; not a system.

---

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

## Does ticket volume help the money% read?

Yes — but only as a *diagnostic*, and only inside the one usable regime.

⛔ First, raw volume is not comparable across seasons: median tickets fall 44,379 →
23,860 → 18,036. Any volume cut must be normalised within season or within slate date.

**★ Volume explains most of what the 2023-24 divergence was.** Median `|money% −
tickets%|` by ticket-volume quartile:

| | Q1 (low) | Q2 | Q3 | Q4 (high) |
|---|---|---|---|---|
| **NBA 2023-24** | **24.0** | 15.0 | 9.0 | **5.0** |
| NBA 2024-25 | 4.0 | 3.0 | 3.0 | 3.0 |
| NBA 2025-26 | 4.0 | 4.0 | 3.0 | 4.0 |
| **NFL (all 4 seasons)** | 6-7 | 6-8 | 7-8 | 7-8 |

In 2023-24 the gap collapses fivefold from the lowest to the highest volume quartile —
the signature of percentages computed on a small, unstable base. NFL's gap is flat at
6-8 across every quartile and always has been. That is a second, independent sign that
AN's NBA money% then was a different and noisier calculation.

**And it sorts noise from signal within that season.** Taking the totals `|gap|>=15`
cell and splitting it by volume:

| vol quartile | med \|gap\| | n | record | rate | roi |
|---|---|---|---|---|---|
| Q1 (low) | 24.0 | 212 | 112-100 | 52.8% | +0.9% |
| Q2 | 15.0 | 166 | 89-77 | 53.6% | +2.4% |
| Q3 | 9.0 | 125 | 74-51 | **59.2%** | +13.0% |
| Q4 (high) | 5.0 | 95 | 56-39 | **58.9%** | +12.5% |

The effect **strengthens** with volume, which is not how a small-sample artifact behaves.
On a well-bet game a 15-point gap is genuinely unusual (Q4's median gap is 5) and it
carries something; on a thin game it is jitter. High half: **130-90 (59.1%), +12.8% roi,
n=220**, against a within-night null of 53.9% ± 2.0%, **p=0.0094**, and holding in 5 of
6 months (60.0 / 51.2 / 56.2 / 62.0 / 72.2 / 59.1%).

⚠ **Why this still is not a bet.** It is one season on an instrument that no longer
exists — gaps that size are 0.2% of 2025-26 totals, so there is nothing to apply it to.
And the cell was reached through roughly five post-hoc choices (market → gap grouping →
season restriction → volume split → high half); p=0.0094 is the p-value of the last step,
not of the path. Treat it as an explanation of what the 2023-24 data was, not as a system.

**NFL, stable instrument, four seasons, does not show the interaction** — reported on its
own NFL evidence, and it neither confirms nor refutes the NBA read. Totals run 57.9 /
58.3 / 52.4 / 54.9% by volume quartile (low half 58.2%, high half 53.7%, Fisher p=0.51),
slightly the *opposite* direction. Spread is incoherent: 65.0 / 57.6 / **37.9** / 57.9% —
adjacent quartiles twenty points apart is noise, not structure.

## ★★ Season phases — and the best cell in this repo

```
nba_phases.py
```

### ⛔ First, a data defect this exposed

**The feed serves PLACEHOLDER splits for the start of 2023-24.** Every game in October
2023 has `tix_away` in {0, 100}; 225 of 304 Oct-Nov games are exactly 0.0; 74% have
money% identical to tickets%. That is 17.2% of the season, against 1.1% and 0.2% in the
two after it. A 0/100 split silently becomes "the crowd is 100% on one side" — a
maximally lopsided and entirely fictional point feeding every lopsidedness cut.

`derive()` now drops them per market. Spread gradable falls 3,846 → 3,604. ⚠ The earlier
2023-24 divergence contrast weakens once they are gone: `|gap|>=15` 55.4% vs `<15`
**50.0%** (was 49.4%), Fisher **p=0.078** (was 0.031). The headline cell is unchanged;
its control group was contaminated.

### Pooled outcomes by phase

| phase | n | home cover | over | fav cover | crowd spread | crowd totals |
|---|---|---|---|---|---|---|
| Oct-Nov | 596 | 49.7% | 51.5% | 48.2% | 49.5% | 50.9% |
| Dec-Jan | 1214 | 50.2% | 48.3% | 49.3% | 47.3% | 48.5% |
| Feb-Mar | 1188 | 49.8% | 50.0% | 50.9% | 53.7% | 50.0% |
| **Apr reg** | **306** | 50.0% | **57.6%** | 55.9% | 54.9% | 56.3% |
| playoffs | 258 | 51.2% | 50.0% | 46.9% | 43.4% | 49.6% |

Family tests: **over p=0.013 (SURVIVES)**, crowd spread p=0.052, crowd totals p=0.057.

### ★★ April regular-season OVER

> **179-132 (57.6%), +9.9% roi, n=311, 95% CI [52%, 63%]** — lower bound clears the
> 52.4% break-even.

| season | record | over | roi |
|---|---|---|---|
| 2023-24 | 67-45 | 59.8% | +14.2% |
| 2024-25 | 57-47 | 54.8% | +4.6% |
| 2025-26 | 55-40 | 57.9% | +10.5% |

**3 of 3 seasons profitable.** It is a spike, not a gradient — by month: Oct 54.7, Nov
50.5, Dec 52.8, Jan **44.4**, Feb 49.9, Mar 50.0, **Apr 57.6**.

**★ The mechanism is visible and it is the market moving the wrong way.** Mean over/under
margin by month: Jan −1.54, Feb −0.42, Mar +0.90, **Apr +3.03**. Meanwhile the median
total *falls* into April (229.5 in Jan → 226.0 in Apr) while actual points *rise*
(227 → 229). Teams rest starters and defensive intensity collapses; the market appears to
anchor on the missing stars and shades the number DOWN, in the wrong direction.

Widening the window keeps it: Mar 25 onward goes 263-207 (56.0%, +6.8%, n=470). That is
the robustness the 15-20 divergence band failed.

⚠ Caveats: n=311, three seasons, and the lower CI bound sits one point above break-even.
January unders (374-299, 55.6%, n=673) are a large opposite-signed cell but come from a
finer month-level slice that was not family-corrected — do not pair them into a story.

### ⛔ A permutation bug worth not repeating

The phase family test first returned null sd of **exactly 0.0** and p=1.000, which reads
as a clean null. It was a no-op: phase is derived from the slate DATE, so every game on a
night shares a phase and a within-night shuffle cannot move any game between phases. Fixed
to a within-SEASON shuffle, after which the same data gives p=0.013.

★ **The permutation unit must be able to move games between the cells being compared.**
This is the second time the same class of error appeared here — the first was a
within-week shuffle on strata holding one game each, which manufactured a fake baseline
and hid a real effect. Check that the null actually moves something.

## Month by month — percentages, tickets, outcomes

```
nba_months.py
```

⛔ Month rows are REGULAR SEASON only. April holds both the end of the regular season and
the first round of the playoffs; mixing them diluted April's over rate from 57.6% (n=311)
to 53.2% (n=450) — two different competitions in one row. The post-season has its own line.

### What the public did

| month | games | med tix | crowd% sp | crowd% ou | crowd% ml | on fav | on over | \|gap\| sp |
|---|---|---|---|---|---|---|---|---|
| Oct | 202 | 36,616 | 64% | 88% | 85% | **53%** | **100%** | 3.0 |
| Nov | 626 | 28,322 | 65% | 83% | 87% | 64% | 95% | 4.0 |
| Dec | 583 | 24,869 | 62% | 80% | 83% | 63% | 94% | 5.0 |
| Jan | 682 | 24,874 | 62% | 76% | 83% | 63% | 91% | 5.0 |
| Feb | 519 | 27,656 | 63% | 79% | 80% | 60% | 86% | 5.0 |
| Mar | 706 | 19,528 | 63% | 79% | 85% | 62% | 87% | 6.0 |
| Apr | 316 | 15,716 | 64% | 84% | 86% | **67%** | 95% | 6.5 |
| **playoffs** | 269 | **75,200** | 63% | 89% | — | 55% | 98% | — |

Three things that do move: **volume falls all season** (36.6k → 15.7k) then quadruples in
the playoffs; the crowd **gets chalkier** as the year goes on (53% on favourites in
October, 67% by April); and the **money-vs-tickets gap widens** (3.0 → 6.5). What does
*not* move is lopsidedness itself — the spread crowd sits at 62-65% every single month.
And the over lean is extreme throughout: 86-100% of games.

### What happened

| month | home cov | over | fav cov | crowd spread | crowd totals |
|---|---|---|---|---|---|
| Oct | 48.9% | 54.7% | **41.1%** | 76-65 53.9% | 81-67 54.7% |
| Nov | 49.9% | 50.5% | 50.3% | 219-236 48.1% | 238-241 49.7% |
| Dec | 49.5% | 52.8% | 48.6% | 256-300 **46.0%** | 295-269 52.3% |
| Jan | 50.8% | **44.4%** | 50.0% | 318-340 48.3% | 305-368 **45.3%** |
| Feb | 49.1% | 49.9% | 51.1% | 261-238 52.3% | 255-250 50.5% |
| Mar | 50.4% | 50.0% | 50.8% | 377-312 **54.7%** | 347-353 49.6% |
| Apr | 50.0% | **57.6%** | 55.9% | 168-138 54.9% | 175-136 56.3% |
| **playoffs** | 51.2% | 50.0% | **46.9%** | 112-146 **43.4%** | 132-134 49.6% |

### The four cells with season-by-season support

| cell | pooled | roi | 2023-24 | 2024-25 | 2025-26 | verdict |
|---|---|---|---|---|---|---|
| **April OVER** | 57.6% (n=311) | +9.9% | 59.8% | 54.8% | 57.9% | ★ 3/3, family **p=0.013**, mechanism |
| **playoffs FADE crowd spread** | 56.6% (n=258) | +8.0% | 55.3% | 57.0% | 57.5% | ★ 3/3 and very tight; family p=0.052 |
| March FOLLOW crowd spread | 54.7% (n=689) | +4.5% | 54.7% | 55.8% | 53.6% | 3/3 tight, big n, but CI [51%, 58%] straddles break-even |
| January UNDER | 55.6% (n=673) | +6.1% | 58.0% | **48.0%** | 60.8% | ⚠ one season LOSES; 58 → 48 → 61 is not stability |
| Oct FADE favourite | 58.9% (n=141) | +12.4% | — | 58.2% | 59.5% | ⚠ only 2 seasons — Oct 2023 is entirely placeholder data and was filtered out |

⚠ These are month-level cells and the month family (7 cells x 3 markets x several outcome
columns) was **not** corrected as a family — only the 5-cell phase family was, which is
where April's p=0.013 and the playoff 0.052 come from. Treat March and January as leads,
not findings, and note January fails the one test that matters most here.

## ★ The cross-table: results BY MONTH, split by the money% − bet% difference

```
nba_gap_months.py
```

This is the question asked directly — rows are months, columns are gap buckets, cells are
the record from backing the money side. ⛔ Split by regime, never pooled: median |gap| on
totals runs 12.0 / 2.0 / 1.0 across the three seasons, so in a pooled table the wide-gap
columns would be almost entirely 2023-24 and the narrow ones almost entirely the later
seasons — the gap column and the season would be the same variable.

### Column totals, current regime (2024-25 + 2025-26)

back the money side:

| market | no gap | 1-4 | 5-9 | 10-19 | 20+ |
|---|---|---|---|---|---|
| spread (n=2477) | 56% *fade* | 53% | 52% | 52% | 62% (n=26) |
| totals (n=2551) | 54% *fade* | 51% *fade* | 51% | 56% (n=45) | (n=3) |
| **ml — edge vs no-vig** | −4.1% | **+1.1%** | **−0.3%** | **+2.8%** | **−2.0%** |

### Column totals, 2023-24 (old regime)

| market | no gap | 1-4 | 5-9 | 10-19 | 20+ |
|---|---|---|---|---|---|
| spread (n=1085) | (n=13) | 55% *fade* | **59%** (n=205) | 52% | 50% *fade* (n=410) |
| totals (n=1095) | 58% (n=26) | 53% | 50% | 51% | **55%** (n=483) |
| ml — edge vs no-vig | (n=21) | −3.9% | −2.5% | −2.0% | +1.8% |

**Nothing. In either regime, in any market.** No column beats its neighbours coherently,
and month by month the cells flip sign at random — the spread 1-4 column across the
current regime reads 51/57/51/50/56/50/60%, the ML 1-4 edge reads −10.9 / +2.8 / −5.8 /
+4.0 / +8.0 / +4.6 / −7.7%. The two best-looking cells contradict each other: 2023-24
spread peaks at 5-9 (59%) and dies at 20+ (50%), while 2023-24 totals does the opposite.

### ⛔ The ML column is the lesson, and my own first table fell for it

Before pricing, fading the ML money side across widening gaps reads:

> **51% → 59% → 62% → 71%**, and it holds in **7 of 7 months** (Nov 65, Dec 74, Jan 72,
> Feb 70, Mar 73, Apr 78, playoffs 69).

A perfect monotone dose with month-level consistency — it looks like the find of the
season. It is **entirely the price**: a bigger money-share gap means the money sat on a
longer dog, and longer dogs lose more often. Scored against the vig-free probability of
the side actually backed, the same four cells are **+1.1 / −0.3 / +2.8 / −2.0%** — flat
and sign-flipping, roi negative, permutation p=0.417 on the pooled `|gap|>=20` cell.

`ml_cell()` now prints the edge over no-vig with the win rate only in brackets, so the
raw rate can never be read as the result again.

## Spreads, month by month

```
nba_spread_months.py
```

3,304 regular-season graded spreads. Four crosses, each family-corrected with a
**within-season** shuffle. ⚠ October 2023 is placeholder data, so October rows carry two
seasons, not three.

### 1. Base rates — the one cross that survives (family p=0.034)

| month | n | home cover | **fav cover** | road fav | home fav |
|---|---|---|---|---|---|
| Oct | 141 | 48.9% | **41.1%** | 41.3% | 41.0% |
| Nov | 455 | 49.9% | 50.3% | 50.6% | 50.2% |
| Dec | 556 | 49.5% | 48.6% | 48.9% | 48.4% |
| Jan | 658 | 50.8% | 50.0% | 49.0% | 50.6% |
| Feb | 499 | 49.1% | 51.1% | 52.3% | 50.2% |
| Mar | 689 | 50.4% | 50.8% | 50.5% | 51.0% |
| Apr | 306 | 50.0% | **55.9%** | 57.5% | 54.8% |

A 14.8-point swing from October to April, and the cross clears the family correction.
Both ends then have to face the season ledger, and only one holds:

| | pooled | roi | 2023-24 | 2024-25 | 2025-26 |
|---|---|---|---|---|---|
| Oct — FADE the favourite | 83-58 (58.9%) | +12.4% | *(no data)* | 58.2% | 59.5% |
| Apr — BACK the favourite | 171-135 (55.9%) | +6.7% | **48.2%** | 59.0% | 61.7% |

⚠ **April's favourite lean fails in 2023-24** (48.2%, −8.0% roi) — 2 of 3 seasons, the
same failure mode as the January under. October is 2 for 2 but only two seasons exist and
n=141. Neither is established; the cross surviving is not the same as either end holding.

★ Note April's two signals are separate columns of the same story: favourites cover 55.9%
AND overs hit 57.6%. Tanking teams getting blown out in games with no defence is one
mechanism producing both. But the over is 3/3 seasons and the favourite is 2/3, so the
over is the one to track. Last ten days only (Apr 5 onward): favourite 128-93 (57.9%).

### 2-4. Everything else is noise

| cross | best cell | null | p |
|---|---|---|---|
| month x crowd lopsidedness | 9.6 pts | 11.6 ± 3.2 | 0.710 |
| month x line size | 14.6 pts | 12.3 ± 3.2 | 0.193 |
| month x line movement | 10.3 pts | 9.7 ± 2.9 | 0.356 |

★ **The cleanest negative in this directory**: crowd lopsidedness on NBA spreads carries
nothing, in any month, at any intensity. Pooled by band — 50-59% **51%**, 60-69% **51%**,
70-79% **51%**, 80%+ **52%** on 3,304 games. Four bands, one number. Whatever the public's
spread lean is worth, it is not worth 0.4 points of vig.

Line movement by month is equally flat: backing the side the line moved toward is 52%
overall and 51-56% in every month, and the reverse-line-movement column (51% overall) is
no better than the line-moves-with-the-crowd column (53%).

## Reading any cell here

Read every record **from the bet's side**: a 28-48 is a 48-28 fade, and the fade is the
bet. `ml_score()` prints the fade of any cell that loses to its price, re-priced at the
other side's odds. ⛔ Never score a moneyline against 50% — the ML crowd sits on
favourites, so a bare rate restates that favourites win.

⚠ Needs `../.venv/bin/python` — there is no system pandas on this machine.
