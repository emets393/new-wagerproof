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

## Reading any cell here

Read every record **from the bet's side**: a 28-48 is a 48-28 fade, and the fade is the
bet. `ml_score()` prints the fade of any cell that loses to its price, re-priced at the
other side's odds. ⛔ Never score a moneyline against 50% — the ML crowd sits on
favourites, so a bare rate restates that favourites win.

⚠ Needs `../.venv/bin/python` — there is no system pandas on this machine.
