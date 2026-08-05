# NCAAB availability from our own lineup data

FADE the team with more valued role missing (pre-registered: college underprices absences -- S1 is +10.4%). `_vl` is impact-valued, `_mn` is raw role missing, `_hc` is a plain headcount. The controls decide this: if they match the valued version, the valuation is not doing the work.

**FEED rows read tonight's absences and are therefore NOT a bettable backtest** -- they are the upper bound on what buying a pregame injury feed is worth. **LAGGED rows read only the previous game** and are fully observable before tip.

Bets the top 30% of |home-minus-away differential|. `base` is the max-side rate INSIDE each selection, never 50%. Breakeven at -110 is 52.4%.

| signal | market | bets | win % | base % | edge | ROI % | p | by season |
|---|---|---|---|---|---|---|---|---|
| FEED fresh (needs a feed) IMPACT-VALUED | FG spread OPEN | 468 | 56.0 | 51.3 | **+4.7** | +6.9 | 0.023 | 24:58 25:55 26:54 |
| FEED fresh (needs a feed) IMPACT-VALUED | FG spread T-60 | 466 | 55.4 | 51.1 | **+4.3** | +5.7 | 0.035 | 24:59 25:53 26:53 |
| FEED fresh (needs a feed) IMPACT-VALUED | FG total OPEN | 471 | 55.6 | 50.5 | **+5.1** | +6.2 | 0.016 | 24:56 25:55 26:56 |
| FEED fresh (needs a feed) IMPACT-VALUED | FG total T-60 | 473 | 56.2 | 51.0 | **+5.3** | +7.4 | 0.011 | 24:58 25:55 26:56 |
| FEED fresh (needs a feed) IMPACT-VALUED | 1H spread | 467 | 51.4 | 51.6 | **-0.2** | -2.5 | 0.557 | 24:50 25:52 26:53 |
| FEED fresh (needs a feed) IMPACT-VALUED | 1H total | 468 | 56.6 | 50.9 | **+5.8** | +7.2 | 0.007 | 24:58 25:55 26:57 |
| FEED fresh (needs a feed) raw minutes (ctrl) | FG spread OPEN | 873 | 58.8 | 50.5 | **+8.2** | +12.2 | 0.000 | 24:61 25:59 26:55 |
| FEED fresh (needs a feed) raw minutes (ctrl) | FG spread T-60 | 872 | 57.6 | 50.9 | **+6.7** | +10.0 | 0.000 | 24:60 25:57 26:54 |
| FEED fresh (needs a feed) raw minutes (ctrl) | FG total OPEN | 877 | 53.9 | 52.3 | **+1.6** | +3.0 | 0.185 | 24:51 25:61 26:50 |
| FEED fresh (needs a feed) raw minutes (ctrl) | FG total T-60 | 879 | 53.0 | 52.8 | **+0.2** | +1.2 | 0.456 | 24:50 25:59 26:50 |
| FEED fresh (needs a feed) raw minutes (ctrl) | 1H spread | 870 | 52.1 | 52.8 | **-0.7** | -1.2 | 0.665 | 24:54 25:54 26:48 |
| FEED fresh (needs a feed) raw minutes (ctrl) | 1H total | 872 | 52.9 | 50.6 | **+2.3** | +0.1 | 0.093 | 24:54 25:56 26:48 |
| FEED fresh (needs a feed) headcount (ctrl) | FG spread OPEN | 2,736 | 53.3 | 50.3 | **+3.0** | +1.8 | 0.001 | 24:56 25:52 26:52 |
| FEED fresh (needs a feed) headcount (ctrl) | FG spread T-60 | 2,736 | 53.0 | 50.0 | **+3.0** | +1.2 | 0.001 | 24:56 25:51 26:52 |
| FEED fresh (needs a feed) headcount (ctrl) | FG total OPEN | 2,748 | 51.8 | 50.3 | **+1.5** | -1.1 | 0.066 | 24:53 25:54 26:49 |
| FEED fresh (needs a feed) headcount (ctrl) | FG total T-60 | 2,757 | 51.8 | 50.5 | **+1.3** | -1.1 | 0.086 | 24:53 25:53 26:50 |
| FEED fresh (needs a feed) headcount (ctrl) | 1H spread | 2,726 | 51.1 | 52.2 | **-1.1** | -3.0 | 0.872 | 24:53 25:50 26:51 |
| FEED fresh (needs a feed) headcount (ctrl) | 1H total | 2,734 | 51.4 | 51.2 | **+0.3** | -2.7 | 0.403 | 24:52 25:53 26:49 |

| FEED durable (needs a feed) raw minutes (ctrl) | FG spread OPEN | 400 | 52.0 | 51.2 | **+0.8** | -0.7 | 0.403 | 24:51 25:53 26:52 |
| FEED durable (needs a feed) raw minutes (ctrl) | FG spread T-60 | 398 | 50.8 | 51.8 | **-1.0** | -3.1 | 0.669 | 24:50 25:51 26:51 |
| FEED durable (needs a feed) raw minutes (ctrl) | FG total OPEN | 400 | 54.2 | 52.8 | **+1.5** | +3.6 | 0.289 | 24:57 25:51 26:54 |
| FEED durable (needs a feed) raw minutes (ctrl) | FG total T-60 | 401 | 52.6 | 50.9 | **+1.7** | +0.5 | 0.260 | 24:55 25:50 26:51 |
| FEED durable (needs a feed) raw minutes (ctrl) | 1H spread | 397 | 46.1 | 53.1 | **-7.1** | -12.6 | 0.997 | 24:46 25:52 26:38 |
| FEED durable (needs a feed) raw minutes (ctrl) | 1H total | 399 | 53.6 | 55.9 | **-2.3** | +1.5 | 0.830 | 24:51 25:54 26:58 |
| FEED durable (needs a feed) headcount (ctrl) | FG spread OPEN | 1,305 | 52.3 | 50.3 | **+1.9** | -0.2 | 0.088 | 24:50 25:54 26:53 |
| FEED durable (needs a feed) headcount (ctrl) | FG spread T-60 | 1,299 | 50.8 | 50.1 | **+0.7** | -3.0 | 0.317 | 24:48 25:53 26:51 |
| FEED durable (needs a feed) headcount (ctrl) | FG total OPEN | 1,307 | 50.1 | 52.2 | **-2.1** | -4.3 | 0.935 | 24:51 25:51 26:49 |
| FEED durable (needs a feed) headcount (ctrl) | FG total T-60 | 1,311 | 49.4 | 51.6 | **-2.2** | -5.6 | 0.950 | 24:50 25:51 26:47 |
| FEED durable (needs a feed) headcount (ctrl) | 1H spread | 1,297 | 48.8 | 52.3 | **-3.5** | -7.5 | 0.994 | 24:47 25:54 26:45 |
| FEED durable (needs a feed) headcount (ctrl) | 1H total | 1,303 | 52.8 | 53.7 | **-0.9** | -0.1 | 0.758 | 24:52 25:53 26:53 |

| LAGGED fresh (shippable) IMPACT-VALUED | FG spread OPEN | 327 | 47.4 | 50.2 | **-2.8** | -9.5 | 0.854 | 24:46 25:46 26:51 |
| LAGGED fresh (shippable) IMPACT-VALUED | FG spread T-60 | 327 | 46.2 | 50.5 | **-4.3** | -11.8 | 0.949 | 24:45 25:44 26:51 |
| LAGGED fresh (shippable) IMPACT-VALUED | FG total OPEN | 328 | 48.2 | 51.2 | **-3.0** | -8.1 | 0.877 | 24:50 25:47 26:47 |
| LAGGED fresh (shippable) IMPACT-VALUED | FG total T-60 | 329 | 47.4 | 51.1 | **-3.6** | -9.5 | 0.914 | 24:51 25:44 26:46 |
| LAGGED fresh (shippable) IMPACT-VALUED | 1H spread | 327 | 49.5 | 51.1 | **-1.5** | -6.1 | 0.727 | 24:48 25:43 26:59 |
| LAGGED fresh (shippable) IMPACT-VALUED | 1H total | 326 | 50.6 | 57.4 | **-6.7** | -4.1 | 0.993 | 24:52 25:52 26:47 |
| LAGGED fresh (shippable) raw minutes (ctrl) | FG spread OPEN | 599 | 52.9 | 50.3 | **+2.7** | +1.1 | 0.099 | 24:51 25:51 26:58 |
| LAGGED fresh (shippable) raw minutes (ctrl) | FG spread T-60 | 598 | 51.3 | 50.3 | **+1.0** | -2.0 | 0.331 | 24:50 25:49 26:57 |
| LAGGED fresh (shippable) raw minutes (ctrl) | FG total OPEN | 600 | 52.2 | 51.8 | **+0.3** | -0.4 | 0.456 | 24:55 25:47 26:54 |
| LAGGED fresh (shippable) raw minutes (ctrl) | FG total T-60 | 602 | 50.8 | 50.7 | **+0.2** | -2.9 | 0.478 | 24:53 25:46 26:52 |
| LAGGED fresh (shippable) raw minutes (ctrl) | 1H spread | 596 | 49.8 | 51.8 | **-2.0** | -5.5 | 0.853 | 24:51 25:48 26:51 |
| LAGGED fresh (shippable) raw minutes (ctrl) | 1H total | 597 | 52.3 | 53.8 | **-1.5** | -1.0 | 0.781 | 24:51 25:51 26:56 |
| LAGGED fresh (shippable) headcount (ctrl) | FG spread OPEN | 1,943 | 52.0 | 51.5 | **+0.5** | -0.7 | 0.335 | 24:53 25:49 26:55 |
| LAGGED fresh (shippable) headcount (ctrl) | FG spread T-60 | 1,937 | 50.8 | 51.6 | **-0.8** | -3.0 | 0.775 | 24:51 25:48 26:54 |
| LAGGED fresh (shippable) headcount (ctrl) | FG total OPEN | 1,945 | 49.0 | 50.8 | **-1.9** | -6.5 | 0.951 | 24:49 25:48 26:50 |
| LAGGED fresh (shippable) headcount (ctrl) | FG total T-60 | 1,950 | 48.6 | 50.5 | **-1.9** | -7.2 | 0.956 | 24:49 25:48 26:50 |
| LAGGED fresh (shippable) headcount (ctrl) | 1H spread | 1,930 | 50.1 | 51.9 | **-1.9** | -5.1 | 0.950 | 24:50 25:50 26:51 |
| LAGGED fresh (shippable) headcount (ctrl) | 1H total | 1,934 | 51.6 | 52.3 | **-0.7** | -2.3 | 0.742 | 24:50 25:51 26:53 |


