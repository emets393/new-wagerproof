# NCAAB look-ahead spots — regular season, six seasons

Owner question (2026-10-26): a top-25 matchup next, a conference rival next, two ranked teams facing off next — does the
game BEFORE that give us anything? Regular season only.

```
lookahead_study.py    builds the next game per team-season from the panel; spots A-L  -> data/LOOKAHEAD_RUN.txt
lookahead_robust.py   first robustness pass (BEFORE the bracket fix; kept as the record of the leak) -> data/LOOKAHEAD_ROBUST_LEAKY.txt
data/LOOKAHEAD_CLEAN.txt   every spot re-run with bracket games excluded
data/LOOKAHEAD_DOG.txt     the one cell that survives, with its checks
```

Frame: `../bball-odds/data/parquet/cbb_sit_panel.parquet`, one row per team-game, T-60 close, 2020-21 .. 2025-26.

## Two things that would have fooled us

1. **Ranks as of tonight.** The AP poll published between tonight and the next game already contains tonight's
   result. Using the next game's rank columns made "ranked vs ranked next" read 55.3%; with every rank taken from the
   team's latest game on or before tonight it is 52.8%.
2. **Brackets leak the result.** In a tournament the next opponent depends on whether you won tonight (winners play the
   top seed, losers play the consolation). "Top-10 opponent next, next day" read 102-32 (76%) and 90% of those teams
   had won tonight. Conference tournaments, the NCAA tournament AND the November bracket events (MTEs) are out of
   every number below, for both tonight's game and the next one.

## The owner's spots, clean (regular season, no brackets, look-ahead team's side at the close)

| next game is… | n | look-ahead team covers |
|---|---|---|
| any top-25 opponent | 3,094 | 1603-1491 (51.8%) |
| ranked vs ranked (team ranked tonight too) | 755 | 395-360 (52.3%) |
| a conference showdown (conference game vs a ranked opponent) | 2,491 | 1289-1202 (51.7%) |
| a rivalry (curated list of 64) | 911 | 473-438 (51.9%) |
| top-10 opponent, within 3 days | 610 | 325-285 (53.3%) |
| top-10 opponent, 4-7 days out | 616 | 304-312 (49.4%) |

Everything is inside the vig in both directions. The look-ahead team does not flatten; if anything it covers a touch
more than its blind baseline (ranked teams with nothing next cover 48.5%). Totals and first halves show nothing either.
A favorite of 15+ the game before a rivalry is 52-67 (43.7%, n=119) — the classic trap read — but four of six seasons
and too thin to carry.

## ★ The one cell: the look-ahead UNDERDOG

The team with a ranked opponent next, when it is a dog of 7 or more TONIGHT, covers:

| | record | win% | ROI |
|---|---|---|---|
| dog 7+, ranked opponent next (as of tonight) | **367-295-10** | 55.4% (lower 51.7%) | +5.9% |
| by season | 42-37 / 65-42 / 53-44 / 64-55 / 67-58 / 76-59 | six of six | |
| dog +3.5 to +7 / +7.5 to +15 / +15.5 or more | 52.7% / 56.0% / 55.8% | rises with the number | |
| dog +0.5 to +3 | 157-189 (45.4%) | the small dog does NOT carry it | |
| next game within 3 days / 4-7 days | 57.2% / 53.6% | | |
| conference game / non-conference | 56.3% / 53.2% | | |
| blind baseline: all dogs 7+ with nothing ranked next | 5112-4892 (51.1%) | | |
| placebo: ranked opponent TWO games out, next game unranked | 297-316 (48.5%) | | |
| within-night permutation among dogs of 7+ | null 51.9% ± 1.8%, p = 0.021 | | |

Not one program: Georgetown 15-4 leads, then Kansas State 12-9, Vanderbilt 10-4, Oklahoma State 10-3. Mechanism that fits:
the market already shades a dog that has a bigger game next, and the shade is too much — the side that would flatten is
the favorite's, not the dog's. First half 52.5%, totals 344-320, nothing there.

Verdict: a CANDIDATE on the hype-fade's footing (six of six, placebo passes, permutation p=0.02, dose rises from +3.5
up but the smallest dogs break it). One more season of live grading before a bet tier.

## Conference play only (December-February, tonight and the next game both conference games) — `data/LOOKAHEAD_CONF.txt`

Owner's framing. 32,623 team-games, baseline exactly 50.0%. Look-ahead team's side: top-25 next 51.8% (n=2,228),
top-10 next 50.6%, ranked-vs-ranked next 52.0%, rivalry next 52.6%; favored 7+ before a ranked opponent 51.0%, favored
12+ 48.0% (n=150), favored before a rivalry 49.7%. Priced. The look-ahead DOG of 7+ holds in this window: 243-191-6
(56.0%, +6.9%), six of six seasons (32-27, 46-28, 33-31, 40-35, 43-36, 49-34) against a dogs-7+ baseline of 51.9%; the
same games from the favorite's side are 133-185 (41.8%). The small dog (+0.5 to +3) is 45.2% again.
