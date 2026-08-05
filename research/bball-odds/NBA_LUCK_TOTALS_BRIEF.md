# NBA shooting-luck UNDER — the one stage-2 survivor, stress-tested

5,278 games, 10-game trailing window. The rule: both teams' recent finishing measured against THEIR OWN expanding baselines, summed. High = both have been shooting over their heads = play the under.

## 1. The dose ladder — does the correction grow with the luck?

Top X% by |combined shooting luck|; the lucky tail is bet UNDER, the unlucky tail OVER. `edge` is against this slice's own baseline, `p` is the chance that baseline throws this win rate at this bet count.

| composite | market | top % | n | win % | base % | edge | ROI % | p | by season |
|---|---|---|---|---|---|---|---|---|---|
| shooting luck | FG total | 50 | 2481 | 51.8 | 50.0 | **+1.8** | -1.1 | 0.040 | 23:54 24:51 25:49 26:54 |
| shooting luck | FG total | 33 | 1637 | 53.1 | 50.1 | **+3.0** | +1.4 | 0.008 | 23:57 24:53 25:52 26:51 |
| shooting luck | FG total | 20 | 993 | 52.7 | 51.2 | **+1.5** | +0.6 | 0.181 | 23:56 24:50 25:53 26:53 |
| shooting luck | FG total | 10 | 497 | 55.3 | 51.1 | **+4.2** | +5.6 | 0.034 | 23:60 24:51 25:55 26:56 |
| shooting luck | 1H total | 50 | 1935 | 51.6 | 51.0 | **+0.6** | -1.4 | 0.295 | 24:53 25:49 26:53 |
| shooting luck | 1H total | 33 | 1277 | 51.9 | 52.7 | **-0.8** | -0.9 | 0.724 | 24:55 25:49 26:52 |
| shooting luck | 1H total | 20 | 774 | 54.8 | 53.5 | **+1.3** | +4.6 | 0.248 | 24:54 25:54 26:57 |
| shooting luck | 1H total | 10 | 387 | 55.6 | 54.0 | **+1.6** | +6.1 | 0.287 | 24:49 25:56 26:63 |

| all luck | FG total | 50 | 2517 | 50.4 | 50.9 | **-0.5** | -3.8 | 0.697 | 23:50 24:50 25:50 26:52 |
| all luck | FG total | 33 | 1661 | 51.7 | 50.2 | **+1.4** | -1.4 | 0.124 | 23:54 24:49 25:51 26:53 |
| all luck | FG total | 20 | 1007 | 53.0 | 50.6 | **+2.4** | +1.2 | 0.071 | 23:56 24:50 25:52 26:55 |
| all luck | FG total | 10 | 504 | 51.8 | 52.6 | **-0.8** | -1.1 | 0.653 | 23:57 24:47 25:50 26:53 |
| all luck | 1H total | 50 | 1935 | 51.7 | 50.7 | **+1.0** | -1.3 | 0.192 | 24:51 25:52 26:53 |
| all luck | 1H total | 33 | 1277 | 53.4 | 50.5 | **+2.9** | +1.9 | 0.020 | 24:51 25:54 26:55 |
| all luck | 1H total | 20 | 774 | 51.3 | 50.6 | **+0.6** | -2.1 | 0.364 | 24:50 25:51 26:53 |
| all luck | 1H total | 10 | 387 | 49.6 | 51.2 | **-1.6** | -5.2 | 0.747 | 24:51 25:49 26:49 |

| RATE control | FG total | 50 | 2481 | 49.7 | 51.2 | **-1.5** | -5.1 | 0.938 | 23:51 24:49 25:49 26:50 |
| RATE control | FG total | 33 | 1637 | 50.0 | 51.0 | **-1.0** | -4.6 | 0.802 | 23:52 24:49 25:48 26:51 |
| RATE control | FG total | 20 | 993 | 49.9 | 50.9 | **-0.9** | -4.6 | 0.722 | 23:55 24:50 25:48 26:47 |
| RATE control | FG total | 10 | 497 | 50.3 | 50.1 | **+0.2** | -4.0 | 0.482 | 23:57 24:47 25:52 26:46 |
| RATE control | 1H total | 50 | 1935 | 51.3 | 50.3 | **+1.0** | -2.1 | 0.202 | 24:52 25:51 26:51 |
| RATE control | 1H total | 33 | 1277 | 50.7 | 50.6 | **+0.2** | -3.2 | 0.467 | 24:54 25:50 26:48 |
| RATE control | 1H total | 20 | 774 | 51.0 | 51.0 | **+0.0** | -2.6 | 0.515 | 24:54 25:51 26:48 |
| RATE control | 1H total | 10 | 387 | 48.8 | 51.2 | **-2.3** | -6.8 | 0.834 | 24:54 25:50 26:43 |

## 2. Direction control — back the OVER on the same games

Same selection, opposite side. Unders and overs are near-mirror bets, so this is close to arithmetic; it is here to catch a sample where unders simply won.

| market | top % | betting UNDER-side ROI | betting OVER-side ROI |
|---|---|---|---|
| FG total | 33 | +1.4 | -10.4 |
| FG total | 20 | +0.6 | -9.6 |
| 1H total | 33 | -0.9 | -8.3 |
| 1H total | 20 | +4.6 | -13.7 |

## 3. Walk-forward — thresholds from prior seasons only

For each test season the cut is the quantile of |luck| computed on earlier seasons ONLY and applied blind. Every number above used all four seasons at once; this one does not, and it is the only one that can be called a result.

| composite | market | top % | OOS n | win % | base % | edge | ROI % | by season |
|---|---|---|---|---|---|---|---|---|
| shooting luck | FG total | 33 | 1304 | 51.9 | 50.0 | **+1.9** | -0.9 | 24:52 25:52 26:51 |
| shooting luck | FG total | 20 | 742 | 51.2 | 50.9 | **+0.3** | -2.2 | 24:49 25:53 26:52 |
| shooting luck | 1H total | 33 | 805 | 50.8 | 53.2 | **-2.4** | -3.0 | 25:50 26:52 |
| shooting luck | 1H total | 20 | 464 | 56.2 | 55.0 | **+1.3** | +7.4 | 25:55 26:58 |
| RATE control | FG total | 33 | 1242 | 49.5 | 50.2 | **-0.7** | -5.5 | 24:49 25:48 26:51 |
| RATE control | FG total | 20 | 727 | 48.6 | 50.3 | **-1.8** | -7.3 | 24:50 25:49 26:47 |
| RATE control | 1H total | 33 | 878 | 49.9 | 51.8 | **-1.9** | -4.7 | 25:50 26:49 |
| RATE control | 1H total | 20 | 548 | 49.1 | 51.3 | **-2.2** | -6.3 | 25:51 26:47 |

## 4. Walk-forward, late season only

Stage 2 put the FG-total edge at its largest with both teams 55+ games in. Same prior-seasons-only cut, restricted to that phase.

| composite | market | top % | OOS n | win % | base % | edge | ROI % | by season |
|---|---|---|---|---|---|---|---|---|
| shooting luck | FG total | 50 | 639 | 52.7 | 50.4 | **+2.3** | +0.7 | 24:52 25:52 26:54 |
| shooting luck | FG total | 33 | 382 | 52.9 | 51.6 | **+1.3** | +1.0 | 24:50 25:56 26:52 |
| shooting luck | 1H total | 50 | 470 | 53.6 | 50.0 | **+3.6** | +2.4 | 25:54 26:54 |
| shooting luck | 1H total | 33 | 323 | 55.4 | 55.1 | **+0.3** | +5.8 | 25:57 26:54 |
| RATE control | FG total | 50 | 706 | 47.7 | 52.3 | **-4.5** | -8.9 | 24:43 25:48 26:51 |
| RATE control | FG total | 33 | 445 | 45.8 | 51.5 | **-5.6** | -12.5 | 24:37 25:45 26:52 |
| RATE control | 1H total | 50 | 516 | 52.1 | 51.0 | **+1.2** | -0.4 | 25:52 26:52 |
| RATE control | 1H total | 33 | 345 | 51.6 | 50.1 | **+1.4** | -1.4 | 25:52 26:51 |

