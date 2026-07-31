# NBA team-luck regression — exhaustive market sweep

5,278 games, **352 cells** tested: 13 luck families x 2 windows x all/competitive minutes x 2 selection sizes x 8 markets.

## The multiplicity result — read this before any table below

Best edge found anywhere: **+3.85 pts**. Under 300 shuffles of the outcomes, the best edge a sweep of this size finds by luck alone averages **+3.18** and exceeds the observed best **17.3%** of the time (95th pct of the null = +4.39).

**Family-wise p = 0.173.**

## Top 25 cells (uncorrected — expect several to be noise)

| market | feature | win | frac | n | win % | base % | edge | ROI % |
|---|---|---|---|---|---|---|---|---|
| team total HOME | off_eff | 5 | 20% | 779 | 53.9 | 50.1 | **+3.9** | +2.2 |
| team total HOME | efg | 5 | 20% | 780 | 54.1 | 50.5 | **+3.6** | +2.5 |
| FG total | efg_c | 5 | 33% | 1637 | 53.9 | 50.5 | **+3.4** | +2.9 |
| FG spread T-60 | close | 10 | 33% | 1861 | 53.4 | 50.1 | **+3.2** | +1.9 |
| FG spread T-60 | pyth | 5 | 33% | 1687 | 53.5 | 50.3 | **+3.1** | +2.1 |
| FG total | off_eff | 5 | 20% | 992 | 53.6 | 50.5 | **+3.1** | +2.4 |
| FG total | efg | 10 | 20% | 993 | 53.1 | 50.1 | **+3.0** | +1.3 |
| FG total | efg | 5 | 33% | 1637 | 53.1 | 50.2 | **+3.0** | +1.5 |
| 1H spread | three_rate *(control)* | 5 | 20% | 774 | 53.5 | 50.5 | **+3.0** | +2.1 |
| FG spread OPEN | close | 10 | 33% | 1864 | 53.5 | 50.6 | **+2.9** | +2.1 |
| FG spread OPEN | pyth | 5 | 33% | 1693 | 53.8 | 50.9 | **+2.8** | +2.6 |
| team total AWAY | def_eff | 10 | 20% | 780 | 53.5 | 50.6 | **+2.8** | +1.1 |
| 1H total | efg_c | 10 | 33% | 1277 | 52.8 | 50.2 | **+2.6** | +0.7 |
| team total AWAY | efg_alwd_c | 10 | 20% | 781 | 53.4 | 50.8 | **+2.6** | +1.0 |
| FG spread OPEN | close | 5 | 33% | 1348 | 53.5 | 51.1 | **+2.4** | +2.1 |
| FG spread OPEN | close | 5 | 20% | 1348 | 53.5 | 51.1 | **+2.4** | +2.1 |
| FG spread OPEN | pyth | 5 | 20% | 1026 | 53.0 | 50.7 | **+2.3** | +1.2 |
| team total HOME | efg | 5 | 33% | 1287 | 52.4 | 50.0 | **+2.3** | -0.7 |
| FG total | efg | 10 | 33% | 1637 | 52.5 | 50.2 | **+2.3** | +0.3 |
| team total AWAY | def_eff | 5 | 20% | 781 | 53.5 | 51.2 | **+2.3** | +1.3 |
| team total AWAY | efg_alwd_c | 5 | 20% | 781 | 54.0 | 51.9 | **+2.2** | +2.3 |
| FG spread T-60 | close | 5 | 33% | 1337 | 53.0 | 50.9 | **+2.1** | +1.1 |
| FG spread T-60 | close | 5 | 20% | 1337 | 53.0 | 50.9 | **+2.1** | +1.1 |
| team total AWAY | ft_pct | 5 | 20% | 781 | 52.1 | 50.1 | **+2.0** | -1.2 |
| FG total | off_eff | 10 | 33% | 1634 | 52.0 | 50.0 | **+2.0** | -0.7 |

## Controls — shot RATES, which are skill and should be null

| market | feature | win | n | edge | ROI % |
|---|---|---|---|---|---|
| 1H spread | three_rate | 5 | 774 | **+3.0** | +2.1 |
| 1H spread | three_rate | 10 | 1276 | **+1.6** | -1.0 |
| 1H spread | three_rate | 10 | 774 | **+0.9** | -1.3 |
| FG spread OPEN | three_rate | 5 | 996 | **+0.9** | -0.9 |
| FG spread T-60 | three_rate | 5 | 993 | **+0.4** | -1.4 |
| 1H spread | three_rate | 5 | 1276 | **+0.3** | -3.3 |
| FG spread OPEN | three_rate | 10 | 996 | **+0.0** | -2.4 |
| FG spread T-60 | three_rate | 10 | 1638 | **-0.4** | -3.1 |
| FG spread T-60 | three_rate | 10 | 993 | **-0.5** | -3.3 |
| FG spread OPEN | three_rate | 10 | 1644 | **-0.6** | -2.6 |

## Best cell per market

| market | feature | n | win % | base % | edge | ROI % |
|---|---|---|---|---|---|---|
| FG spread OPEN | close w10 33% | 1864 | 53.5 | 50.6 | **+2.9** | +2.1 |
| FG spread T-60 | close w10 33% | 1861 | 53.4 | 50.1 | **+3.2** | +1.9 |
| FG moneyline | close w10 20% | 959 | 50.1 | 53.3 | **-3.2** | +1.2 |
| FG total | efg_c w5 33% | 1637 | 53.9 | 50.5 | **+3.4** | +2.9 |
| 1H spread | efg w5 33% | 1276 | 51.6 | 50.4 | **+1.2** | -1.6 |
| 1H total | efg_c w10 33% | 1277 | 52.8 | 50.2 | **+2.6** | +0.7 |
| team total HOME | off_eff w5 20% | 779 | 53.9 | 50.1 | **+3.9** | +2.2 |
| team total AWAY | def_eff w10 20% | 780 | 53.5 | 50.6 | **+2.8** | +1.1 |
