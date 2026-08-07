# NCAAB player regression, phase by phase

Who has been shooting above or below their OWN shrunk talent, aggregated by share of team shots, graded inside each season phase. Direction is pre-registered: a team due for positive regression scores more, so it covers and goes over.

## 0 — the phases are not the same market

Before any signal. If these rows were identical, pooling would be harmless.

| phase | games | home covers T-60 % | over T-60 % | favourite covers % |
|---|---|---|---|---|
| NONCONF | 6,885 | 50.5 | 50.9 | 49.7 |
| MTE | 1,146 | 52.7 | 49.6 | 48.9 |
| CONF_EARLY | 6,566 | 48.9 | 50.3 | 49.3 |
| CONF_LATE | 6,706 | 50.2 | 51.7 | 49.9 |
| CONF_TOURN | 1,232 | 49.5 | 46.6 | 49.6 |
| NCAAT | 324 | 54.4 | 46.2 | 54.2 |
| POST_OTHER | 173 | 49.1 | 55.5 | 46.7 |

## PLAYER — efg

| signal | phase | market | bets | win % | base % | edge | ROI % | p | by season |
|---|---|---|---|---|---|---|---|---|---|
| efg | NONCONF | FG spread OPEN | 1,979 | 51.0 | 50.8 | **+0.2** | -2.5 | 0.437 | 23:51 24:51 25:51 26:51 |
| efg | MTE | FG spread OPEN | 286 | 50.7 | 54.5 | **-3.8** | -3.1 | 0.916 | 23:50 24:50 25:50 26:53 |
| efg | CONF_EARLY | FG spread OPEN | 1,947 | 52.2 | 51.6 | **+0.7** | -0.2 | 0.281 | 23:52 24:51 25:54 26:52 |
| efg | CONF_LATE | FG spread OPEN | 1,888 | 48.0 | 50.7 | **-2.6** | -8.2 | 0.991 | 23:49 24:46 25:48 26:50 |
| efg | CONF_TOURN | FG spread OPEN | 307 | 46.6 | 50.2 | **-3.6** | -11.0 | 0.904 | 23:51 24:49 25:38 26:49 |
| efg | NCAAT | FG spread OPEN | 76 | 57.9 | 52.6 | **+5.3** | +10.6 | 0.211 |  |
| efg | NONCONF | FG spread T-60 | 1,966 | 51.0 | 50.6 | **+0.5** | -2.6 | 0.348 | 23:51 24:50 25:51 26:52 |
| efg | MTE | FG spread T-60 | 286 | 50.0 | 55.2 | **-5.2** | -4.5 | 0.967 | 23:47 24:50 25:51 26:52 |
| efg | CONF_EARLY | FG spread T-60 | 1,936 | 51.5 | 51.1 | **+0.4** | -1.7 | 0.377 | 23:52 24:50 25:53 26:51 |
| efg | CONF_LATE | FG spread T-60 | 1,884 | 48.0 | 50.1 | **-2.1** | -8.4 | 0.970 | 23:49 24:46 25:48 26:50 |
| efg | CONF_TOURN | FG spread T-60 | 307 | 44.3 | 50.8 | **-6.5** | -15.4 | 0.990 | 23:49 24:49 25:34 26:43 |
| efg | NCAAT | FG spread T-60 | 76 | 57.9 | 52.6 | **+5.3** | +10.6 | 0.209 |  |
| efg | NONCONF | FG total OPEN | 2,046 | 50.3 | 50.3 | **-0.0** | -4.0 | 0.526 | 23:50 24:48 25:52 26:51 |
| efg | MTE | FG total OPEN | 333 | 51.1 | 53.8 | **-2.7** | -2.6 | 0.852 | 23:49 24:49 25:47 26:62 |
| efg | CONF_EARLY | FG total OPEN | 1,812 | 49.5 | 51.2 | **-1.7** | -5.5 | 0.924 | 23:52 24:51 25:50 26:46 |
| efg | CONF_LATE | FG total OPEN | 1,894 | 51.2 | 51.6 | **-0.4** | -2.3 | 0.651 | 23:51 24:50 25:51 26:53 |
| efg | CONF_TOURN | FG total OPEN | 348 | 50.6 | 57.5 | **-6.9** | -3.5 | 0.995 | 23:46 24:54 25:49 26:52 |
| efg | NCAAT | FG total OPEN | 75 | 56.0 | 61.3 | **-5.3** | +6.8 | 0.859 | 23:70 |
| efg | NONCONF | FG total T-60 | 2,041 | 48.7 | 50.1 | **-1.4** | -7.0 | 0.907 | 23:48 24:47 25:50 26:49 |
| efg | MTE | FG total T-60 | 332 | 50.6 | 53.3 | **-2.7** | -3.4 | 0.852 | 23:49 24:49 25:48 26:59 |
| efg | CONF_EARLY | FG total T-60 | 1,815 | 48.9 | 51.1 | **-2.2** | -6.6 | 0.971 | 23:51 24:50 25:49 26:45 |
| efg | CONF_LATE | FG total T-60 | 1,887 | 50.7 | 50.9 | **-0.2** | -3.2 | 0.583 | 23:51 24:50 25:50 26:52 |
| efg | CONF_TOURN | FG total T-60 | 351 | 49.3 | 57.0 | **-7.7** | -5.9 | 0.998 | 23:46 24:52 25:49 26:50 |
| efg | NCAAT | FG total T-60 | 75 | 53.3 | 61.3 | **-8.0** | +1.7 | 0.936 | 23:63 |
| efg | NONCONF | 1H spread | 1,588 | 49.8 | 52.1 | **-2.3** | -5.6 | 0.969 | 24:49 25:48 26:52 |
| efg | MTE | 1H spread | 217 | 51.6 | 52.1 | **-0.5** | -2.1 | 0.587 | 24:55 25:54 26:45 |
| efg | CONF_EARLY | 1H spread | 1,437 | 49.5 | 52.2 | **-2.7** | -6.1 | 0.981 | 24:47 25:50 26:51 |
| efg | CONF_LATE | 1H spread | 1,445 | 49.3 | 51.6 | **-2.3** | -6.3 | 0.962 | 24:49 25:46 26:54 |
| efg | CONF_TOURN | 1H spread | 219 | 49.8 | 52.5 | **-2.7** | -5.5 | 0.812 | 24:53 25:44 26:53 |
| efg | NONCONF | 1H total | 1,637 | 48.4 | 50.2 | **-1.8** | -8.4 | 0.926 | 24:47 25:50 26:48 |
| efg | MTE | 1H total | 243 | 48.1 | 51.0 | **-2.9** | -9.0 | 0.828 | 24:48 25:49 26:47 |
| efg | CONF_EARLY | 1H total | 1,307 | 48.3 | 53.4 | **-5.1** | -8.6 | 1.000 | 24:48 25:51 26:46 |
| efg | CONF_LATE | 1H total | 1,442 | 49.9 | 50.1 | **-0.1** | -5.4 | 0.546 | 24:52 25:50 26:48 |
| efg | CONF_TOURN | 1H total | 270 | 50.7 | 54.1 | **-3.3** | -3.9 | 0.874 | 24:56 25:45 26:51 |
| efg | NONCONF | team total HOME | 1,415 | 47.9 | 50.0 | **-2.1** | -10.3 | 0.949 | 24:43 25:48 26:52 |
| efg | MTE | team total HOME | 201 | 50.7 | 50.2 | **+0.5** | -5.0 | 0.475 | 24:63 25:48 26:50 |
| efg | CONF_EARLY | team total HOME | 1,420 | 48.6 | 50.8 | **-2.3** | -8.6 | 0.959 | 24:52 25:47 26:47 |
| efg | CONF_LATE | team total HOME | 1,443 | 47.9 | 50.5 | **-2.6** | -9.9 | 0.975 | 24:51 25:45 26:48 |
| efg | CONF_TOURN | team total HOME | 271 | 55.4 | 50.6 | **+4.8** | +4.4 | 0.063 | 24:59 25:50 26:58 |
| efg | NONCONF | team total AWAY | 1,531 | 50.4 | 52.2 | **-1.8** | -5.4 | 0.921 | 24:51 25:50 26:50 |
| efg | MTE | team total AWAY | 210 | 53.8 | 52.9 | **+1.0** | +0.7 | 0.417 | 24:59 25:51 26:56 |
| efg | CONF_EARLY | team total AWAY | 1,344 | 49.3 | 50.9 | **-1.6** | -7.2 | 0.880 | 24:48 25:48 26:51 |
| efg | CONF_LATE | team total AWAY | 1,369 | 51.7 | 51.8 | **-0.1** | -2.5 | 0.530 | 24:51 25:49 26:56 |
| efg | CONF_TOURN | team total AWAY | 240 | 47.1 | 50.8 | **-3.7** | -11.4 | 0.889 | 24:39 25:49 26:54 |

## PLAYER — three

| signal | phase | market | bets | win % | base % | edge | ROI % | p | by season |
|---|---|---|---|---|---|---|---|---|---|
| three | NONCONF | FG spread OPEN | 1,898 | 50.5 | 51.2 | **-0.7** | -3.6 | 0.736 | 23:49 24:51 25:50 26:51 |
| three | MTE | FG spread OPEN | 317 | 52.7 | 55.8 | **-3.2** | +0.6 | 0.881 | 23:54 24:57 25:50 26:51 |
| three | CONF_EARLY | FG spread OPEN | 1,869 | 52.9 | 52.6 | **+0.3** | +0.9 | 0.417 | 23:53 24:54 25:51 26:53 |
| three | CONF_LATE | FG spread OPEN | 1,909 | 49.7 | 50.9 | **-1.2** | -5.1 | 0.861 | 23:50 24:50 25:49 26:50 |
| three | CONF_TOURN | FG spread OPEN | 334 | 47.3 | 52.1 | **-4.8** | -9.6 | 0.965 | 23:49 24:51 25:39 26:51 |
| three | NCAAT | FG spread OPEN | 90 | 50.0 | 57.8 | **-7.8** | -4.4 | 0.947 | 23:52 |
| three | NONCONF | FG spread T-60 | 1,889 | 50.4 | 50.0 | **+0.4** | -3.7 | 0.360 | 23:50 24:51 25:49 26:51 |
| three | MTE | FG spread T-60 | 315 | 52.7 | 57.5 | **-4.8** | +0.6 | 0.959 | 23:53 24:57 25:52 26:49 |
| three | CONF_EARLY | FG spread T-60 | 1,868 | 51.9 | 52.2 | **-0.3** | -0.8 | 0.619 | 23:52 24:53 25:50 26:52 |
| three | CONF_LATE | FG spread T-60 | 1,903 | 49.2 | 51.4 | **-2.2** | -6.0 | 0.974 | 23:50 24:49 25:48 26:49 |
| three | CONF_TOURN | FG spread T-60 | 335 | 46.9 | 51.9 | **-5.1** | -10.5 | 0.970 | 23:49 24:52 25:38 26:49 |
| three | NCAAT | FG spread T-60 | 91 | 48.4 | 57.1 | **-8.8** | -7.5 | 0.960 | 23:46 |
| three | NONCONF | FG total OPEN | 1,932 | 50.3 | 51.9 | **-1.7** | -4.1 | 0.933 | 23:47 24:49 25:52 26:52 |
| three | MTE | FG total OPEN | 332 | 52.1 | 50.6 | **+1.5** | -0.6 | 0.307 | 23:52 24:46 25:54 26:56 |
| three | CONF_EARLY | FG total OPEN | 1,858 | 49.2 | 52.0 | **-2.9** | -6.1 | 0.994 | 23:53 24:48 25:48 26:48 |
| three | CONF_LATE | FG total OPEN | 1,907 | 51.1 | 51.0 | **+0.2** | -2.4 | 0.462 | 23:52 24:50 25:54 26:49 |
| three | CONF_TOURN | FG total OPEN | 320 | 49.7 | 55.6 | **-5.9** | -5.1 | 0.987 | 23:46 24:48 25:53 26:51 |
| three | NCAAT | FG total OPEN | 72 | 50.0 | 56.9 | **-6.9** | -4.6 | 0.904 | 23:52 |
| three | NONCONF | FG total T-60 | 1,929 | 49.1 | 51.8 | **-2.7** | -6.3 | 0.992 | 23:47 24:48 25:51 26:50 |
| three | MTE | FG total T-60 | 330 | 52.4 | 51.2 | **+1.2** | +0.1 | 0.352 | 23:54 24:47 25:55 26:52 |
| three | CONF_EARLY | FG total T-60 | 1,863 | 48.3 | 52.1 | **-3.8** | -7.8 | 1.000 | 23:51 24:48 25:48 26:46 |
| three | CONF_LATE | FG total T-60 | 1,905 | 50.2 | 50.1 | **+0.1** | -4.2 | 0.496 | 23:51 24:49 25:52 26:48 |
| three | CONF_TOURN | FG total T-60 | 322 | 47.8 | 53.4 | **-5.6** | -8.7 | 0.981 | 23:44 24:45 25:53 26:49 |
| three | NCAAT | FG total T-60 | 72 | 51.4 | 55.6 | **-4.2** | -2.0 | 0.802 | 23:56 |
| three | NONCONF | 1H spread | 1,539 | 51.1 | 51.1 | **+0.0** | -3.2 | 0.509 | 24:50 25:51 26:52 |
| three | MTE | 1H spread | 233 | 51.5 | 52.8 | **-1.3** | -2.4 | 0.676 | 24:57 25:49 26:49 |
| three | CONF_EARLY | 1H spread | 1,392 | 49.9 | 52.7 | **-2.8** | -5.3 | 0.984 | 24:51 25:49 26:50 |
| three | CONF_LATE | 1H spread | 1,464 | 49.7 | 52.3 | **-2.6** | -5.6 | 0.978 | 24:50 25:47 26:52 |
| three | CONF_TOURN | 1H spread | 250 | 50.8 | 52.8 | **-2.0** | -3.6 | 0.758 | 24:50 25:48 26:55 |
| three | NONCONF | 1H total | 1,561 | 48.4 | 50.7 | **-2.2** | -8.3 | 0.963 | 24:48 25:49 26:48 |
| three | MTE | 1H total | 243 | 50.2 | 50.2 | **+0.0** | -5.0 | 0.519 | 24:49 25:53 26:46 |
| three | CONF_EARLY | 1H total | 1,348 | 48.7 | 51.9 | **-3.2** | -7.7 | 0.990 | 24:50 25:49 26:47 |
| three | CONF_LATE | 1H total | 1,493 | 49.1 | 50.7 | **-1.6** | -6.9 | 0.894 | 24:51 25:49 26:48 |
| three | CONF_TOURN | 1H total | 246 | 49.2 | 52.8 | **-3.7** | -6.7 | 0.886 | 24:54 25:46 26:48 |
| three | NONCONF | team total HOME | 1,391 | 48.9 | 52.8 | **-4.0** | -8.5 | 0.999 | 24:47 25:48 26:51 |
| three | MTE | team total HOME | 198 | 50.5 | 51.5 | **-1.0** | -5.1 | 0.635 | 24:50 25:49 26:54 |
| three | CONF_EARLY | team total HOME | 1,407 | 49.0 | 51.8 | **-2.8** | -7.8 | 0.984 | 24:50 25:50 26:47 |
| three | CONF_LATE | team total HOME | 1,469 | 48.0 | 52.8 | **-4.8** | -9.6 | 1.000 | 24:49 25:48 26:47 |
| three | CONF_TOURN | team total HOME | 269 | 53.2 | 50.9 | **+2.2** | +0.2 | 0.254 | 24:55 25:49 26:56 |
| three | NONCONF | team total AWAY | 1,445 | 51.1 | 52.3 | **-1.2** | -4.1 | 0.834 | 24:48 25:53 26:52 |
| three | MTE | team total AWAY | 227 | 52.4 | 50.2 | **+2.2** | -1.6 | 0.277 | 24:60 25:50 26:52 |
| three | CONF_EARLY | team total AWAY | 1,361 | 50.7 | 51.4 | **-0.7** | -4.5 | 0.714 | 24:51 25:49 26:52 |
| three | CONF_LATE | team total AWAY | 1,405 | 51.4 | 51.4 | **+0.0** | -3.2 | 0.509 | 24:51 25:50 26:53 |
| three | CONF_TOURN | team total AWAY | 255 | 49.8 | 52.5 | **-2.7** | -6.4 | 0.825 | 24:45 25:52 26:53 |

## PLAYER — ft

| signal | phase | market | bets | win % | base % | edge | ROI % | p | by season |
|---|---|---|---|---|---|---|---|---|---|
| ft | NONCONF | FG spread OPEN | 1,872 | 48.9 | 52.8 | **-3.8** | -6.6 | 1.000 | 23:48 24:48 25:50 26:50 |
| ft | MTE | FG spread OPEN | 294 | 52.0 | 53.7 | **-1.7** | -0.7 | 0.742 | 23:47 24:48 25:56 26:57 |
| ft | CONF_EARLY | FG spread OPEN | 1,893 | 45.9 | 51.8 | **-5.9** | -12.4 | 1.000 | 23:44 24:42 25:45 26:51 |
| ft | CONF_LATE | FG spread OPEN | 1,866 | 50.3 | 50.8 | **-0.5** | -4.0 | 0.668 | 23:49 24:54 25:49 26:49 |
| ft | CONF_TOURN | FG spread OPEN | 303 | 50.8 | 51.5 | **-0.7** | -2.9 | 0.615 | 23:59 24:52 25:45 26:46 |
| ft | NONCONF | FG spread T-60 | 1,863 | 49.6 | 52.0 | **-2.4** | -5.3 | 0.979 | 23:48 24:49 25:50 26:51 |
| ft | MTE | FG spread T-60 | 290 | 51.7 | 53.8 | **-2.1** | -1.2 | 0.779 | 23:46 24:48 25:56 26:56 |
| ft | CONF_EARLY | FG spread T-60 | 1,887 | 45.8 | 51.5 | **-5.7** | -12.5 | 1.000 | 23:44 24:43 25:46 26:50 |
| ft | CONF_LATE | FG spread T-60 | 1,870 | 50.2 | 50.7 | **-0.5** | -4.1 | 0.672 | 23:50 24:53 25:48 26:49 |
| ft | CONF_TOURN | FG spread T-60 | 308 | 51.9 | 51.9 | **+0.0** | -0.7 | 0.519 | 23:62 24:53 25:46 26:46 |
| ft | NONCONF | FG total OPEN | 1,844 | 48.2 | 50.8 | **-2.7** | -8.1 | 0.988 | 23:51 24:46 25:50 26:48 |
| ft | MTE | FG total OPEN | 279 | 48.7 | 53.0 | **-4.3** | -6.9 | 0.932 | 23:51 24:41 25:49 26:57 |
| ft | CONF_EARLY | FG total OPEN | 1,924 | 48.2 | 50.9 | **-2.7** | -8.0 | 0.991 | 23:48 24:46 25:47 26:51 |
| ft | CONF_LATE | FG total OPEN | 1,893 | 48.4 | 52.2 | **-3.8** | -7.5 | 1.000 | 23:48 24:49 25:51 26:45 |
| ft | CONF_TOURN | FG total OPEN | 323 | 48.9 | 57.0 | **-8.0** | -6.6 | 0.999 | 23:53 24:49 25:46 26:48 |
| ft | NCAAT | FG total OPEN | 62 | 50.0 | 69.4 | **-19.4** | -4.6 | 1.000 |  |
| ft | NONCONF | FG total T-60 | 1,845 | 48.2 | 50.6 | **-2.3** | -7.9 | 0.979 | 23:51 24:46 25:48 26:48 |
| ft | MTE | FG total T-60 | 278 | 48.2 | 53.6 | **-5.4** | -8.0 | 0.967 | 23:51 24:40 25:49 26:56 |
| ft | CONF_EARLY | FG total T-60 | 1,926 | 47.9 | 50.9 | **-3.1** | -8.6 | 0.997 | 23:48 24:46 25:46 26:51 |
| ft | CONF_LATE | FG total T-60 | 1,892 | 48.3 | 52.0 | **-3.6** | -7.8 | 0.999 | 23:48 24:49 25:51 26:44 |
| ft | CONF_TOURN | FG total T-60 | 321 | 48.3 | 54.8 | **-6.5** | -7.8 | 0.994 | 23:51 24:47 25:44 26:52 |
| ft | NCAAT | FG total T-60 | 62 | 48.4 | 67.7 | **-19.4** | -7.7 | 0.999 |  |
| ft | NONCONF | 1H spread | 1,503 | 48.7 | 50.4 | **-1.7** | -7.7 | 0.909 | 24:49 25:48 26:49 |
| ft | MTE | 1H spread | 210 | 51.4 | 52.9 | **-1.4** | -2.4 | 0.683 | 24:53 25:51 26:50 |
| ft | CONF_EARLY | 1H spread | 1,402 | 49.6 | 53.0 | **-3.4** | -5.8 | 0.994 | 24:50 25:49 26:50 |
| ft | CONF_LATE | 1H spread | 1,446 | 50.7 | 51.9 | **-1.2** | -3.8 | 0.831 | 24:52 25:52 26:48 |
| ft | CONF_TOURN | 1H spread | 230 | 47.0 | 51.3 | **-4.3** | -10.9 | 0.919 | 24:48 25:47 26:46 |
| ft | NONCONF | 1H total | 1,443 | 49.8 | 50.3 | **-0.6** | -5.9 | 0.673 | 24:52 25:48 26:50 |
| ft | MTE | 1H total | 211 | 47.9 | 54.0 | **-6.2** | -9.3 | 0.969 | 24:40 25:49 26:58 |
| ft | CONF_EARLY | 1H total | 1,415 | 49.9 | 52.7 | **-2.8** | -5.6 | 0.983 | 24:50 25:51 26:49 |
| ft | CONF_LATE | 1H total | 1,465 | 47.8 | 50.5 | **-2.7** | -9.5 | 0.984 | 24:48 25:49 26:46 |
| ft | CONF_TOURN | 1H total | 244 | 45.1 | 52.5 | **-7.4** | -14.6 | 0.991 | 24:46 25:43 26:47 |
| ft | NONCONF | team total HOME | 1,308 | 46.3 | 51.1 | **-4.7** | -13.4 | 1.000 | 24:44 25:47 26:47 |
| ft | MTE | team total HOME | 192 | 52.1 | 52.6 | **-0.5** | -2.0 | 0.595 | 24:57 25:50 26:51 |
| ft | CONF_EARLY | team total HOME | 1,432 | 47.1 | 50.6 | **-3.4** | -11.2 | 0.996 | 24:43 25:46 26:52 |
| ft | CONF_LATE | team total HOME | 1,496 | 49.1 | 51.1 | **-1.9** | -7.5 | 0.935 | 24:48 25:52 26:47 |
| ft | CONF_TOURN | team total HOME | 253 | 49.8 | 55.3 | **-5.5** | -6.1 | 0.968 | 24:44 25:51 26:54 |
| ft | NONCONF | team total AWAY | 1,452 | 50.8 | 51.0 | **-0.1** | -4.6 | 0.554 | 24:50 25:52 26:50 |
| ft | MTE | team total AWAY | 185 | 49.2 | 50.8 | **-1.6** | -7.6 | 0.700 | 24:40 25:50 26:55 |
| ft | CONF_EARLY | team total AWAY | 1,377 | 51.1 | 50.6 | **+0.4** | -4.0 | 0.387 | 24:49 25:49 26:55 |
| ft | CONF_LATE | team total AWAY | 1,432 | 49.0 | 52.6 | **-3.6** | -7.8 | 0.997 | 24:51 25:48 26:47 |
| ft | CONF_TOURN | team total AWAY | 228 | 45.6 | 52.6 | **-7.0** | -14.2 | 0.987 | 24:51 25:43 26:45 |

## TEAM CONTROL — team_efg

| signal | phase | market | bets | win % | base % | edge | ROI % | p | by season |
|---|---|---|---|---|---|---|---|---|---|
| team_efg | NONCONF | FG spread OPEN | 695 | 52.9 | 52.7 | **+0.3** | +1.1 | 0.463 | 23:48 24:51 25:54 26:57 |
| team_efg | CONF_EARLY | FG spread OPEN | 2,108 | 48.9 | 50.6 | **-1.7** | -6.7 | 0.944 | 23:49 24:51 25:49 26:48 |
| team_efg | CONF_LATE | FG spread OPEN | 2,273 | 49.8 | 50.2 | **-0.4** | -5.0 | 0.670 | 23:48 24:51 25:49 26:51 |
| team_efg | CONF_TOURN | FG spread OPEN | 423 | 45.9 | 51.8 | **-5.9** | -12.4 | 0.993 | 23:45 24:45 25:40 26:52 |
| team_efg | NCAAT | FG spread OPEN | 140 | 57.9 | 52.1 | **+5.7** | +10.4 | 0.103 | 23:47 24:61 25:59 26:70 |
| team_efg | POST_OTHER | FG spread OPEN | 60 | 51.7 | 55.0 | **-3.3** | -1.2 | 0.741 |  |
| team_efg | NONCONF | FG spread T-60 | 690 | 52.6 | 51.9 | **+0.7** | +0.5 | 0.364 | 23:48 24:52 25:55 26:55 |
| team_efg | CONF_EARLY | FG spread T-60 | 2,096 | 48.4 | 50.4 | **-2.0** | -7.6 | 0.969 | 23:48 24:50 25:48 26:47 |
| team_efg | CONF_LATE | FG spread T-60 | 2,267 | 49.4 | 50.3 | **-0.9** | -5.7 | 0.800 | 23:48 24:51 25:49 26:50 |
| team_efg | CONF_TOURN | FG spread T-60 | 426 | 44.6 | 51.4 | **-6.8** | -14.8 | 0.998 | 23:46 24:45 25:38 26:49 |
| team_efg | NCAAT | FG spread T-60 | 139 | 58.3 | 52.5 | **+5.8** | +11.1 | 0.104 | 23:44 24:64 25:61 26:70 |
| team_efg | POST_OTHER | FG spread T-60 | 60 | 51.7 | 53.3 | **-1.7** | -1.3 | 0.650 |  |
| team_efg | NONCONF | FG total OPEN | 664 | 46.5 | 53.3 | **-6.8** | -11.2 | 1.000 | 23:48 24:44 25:46 26:48 |
| team_efg | CONF_EARLY | FG total OPEN | 2,056 | 49.4 | 50.7 | **-1.3** | -5.7 | 0.889 | 23:49 24:50 25:49 26:50 |
| team_efg | CONF_LATE | FG total OPEN | 2,352 | 52.7 | 52.2 | **+0.5** | +0.6 | 0.317 | 23:53 24:55 25:51 26:53 |
| team_efg | CONF_TOURN | FG total OPEN | 462 | 51.5 | 56.1 | **-4.5** | -1.7 | 0.977 | 23:50 24:54 25:50 26:52 |
| team_efg | NCAAT | FG total OPEN | 113 | 51.3 | 53.1 | **-1.8** | -2.1 | 0.676 | 23:70 24:48 25:46 |
| team_efg | POST_OTHER | FG total OPEN | 60 | 55.0 | 56.7 | **-1.7** | +4.9 | 0.654 |  |
| team_efg | NONCONF | FG total T-60 | 666 | 46.1 | 52.7 | **-6.6** | -12.0 | 1.000 | 23:48 24:45 25:44 26:48 |
| team_efg | CONF_EARLY | FG total T-60 | 2,063 | 49.0 | 50.8 | **-1.7** | -6.5 | 0.947 | 23:48 24:50 25:48 26:49 |
| team_efg | CONF_LATE | FG total T-60 | 2,346 | 52.4 | 51.4 | **+0.9** | -0.0 | 0.186 | 23:53 24:54 25:50 26:53 |
| team_efg | CONF_TOURN | FG total T-60 | 464 | 50.2 | 54.7 | **-4.5** | -4.1 | 0.977 | 23:50 24:51 25:48 26:52 |
| team_efg | NCAAT | FG total T-60 | 114 | 49.1 | 56.1 | **-7.0** | -6.3 | 0.947 | 23:63 24:48 25:43 |
| team_efg | POST_OTHER | FG total T-60 | 60 | 56.7 | 58.3 | **-1.7** | +8.3 | 0.653 |  |
| team_efg | NONCONF | 1H spread | 549 | 49.7 | 51.4 | **-1.6** | -5.8 | 0.789 | 24:47 25:43 26:59 |
| team_efg | CONF_EARLY | 1H spread | 1,520 | 48.3 | 51.7 | **-3.4** | -8.4 | 0.997 | 24:48 25:50 26:47 |
| team_efg | CONF_LATE | 1H spread | 1,752 | 50.6 | 51.0 | **-0.4** | -3.9 | 0.632 | 24:51 25:49 26:52 |
| team_efg | CONF_TOURN | 1H spread | 315 | 47.6 | 51.1 | **-3.5** | -9.6 | 0.903 | 24:42 25:49 26:51 |
| team_efg | NCAAT | 1H spread | 80 | 56.2 | 52.5 | **+3.7** | +6.6 | 0.291 | 24:56 25:59 26:54 |
| team_efg | NONCONF | 1H total | 500 | 50.4 | 50.4 | **+0.0** | -4.8 | 0.522 | 24:52 25:49 26:51 |
| team_efg | CONF_EARLY | 1H total | 1,533 | 49.2 | 52.0 | **-2.7** | -6.7 | 0.985 | 24:49 25:49 26:50 |
| team_efg | CONF_LATE | 1H total | 1,820 | 51.0 | 50.8 | **+0.2** | -3.4 | 0.430 | 24:53 25:50 26:50 |
| team_efg | CONF_TOURN | 1H total | 346 | 52.6 | 51.2 | **+1.4** | -0.3 | 0.315 | 24:58 25:46 26:53 |
| team_efg | NCAAT | 1H total | 73 | 57.5 | 56.2 | **+1.4** | +8.6 | 0.459 | 25:57 |
| team_efg | NONCONF | team total HOME | 480 | 47.3 | 51.2 | **-4.0** | -11.2 | 0.963 | 24:39 25:49 26:54 |
| team_efg | CONF_EARLY | team total HOME | 1,566 | 49.0 | 51.7 | **-2.6** | -7.8 | 0.981 | 24:52 25:47 26:48 |
| team_efg | CONF_LATE | team total HOME | 1,799 | 49.5 | 52.4 | **-2.9** | -7.0 | 0.993 | 24:52 25:47 26:50 |
| team_efg | CONF_TOURN | team total HOME | 337 | 53.7 | 50.4 | **+3.3** | +1.4 | 0.125 | 24:54 25:48 26:59 |
| team_efg | NCAAT | team total HOME | 70 | 54.3 | 54.3 | **+0.0** | +2.4 | 0.553 | 26:63 |
| team_efg | NONCONF | team total AWAY | 566 | 53.0 | 50.9 | **+2.1** | -0.2 | 0.170 | 24:56 25:50 26:53 |
| team_efg | CONF_EARLY | team total AWAY | 1,529 | 49.4 | 50.9 | **-1.6** | -7.1 | 0.895 | 24:51 25:48 26:50 |
| team_efg | CONF_LATE | team total AWAY | 1,778 | 52.7 | 51.0 | **+1.7** | -0.6 | 0.075 | 24:53 25:50 26:56 |
| team_efg | CONF_TOURN | team total AWAY | 318 | 49.1 | 52.5 | **-3.5** | -7.8 | 0.897 | 24:46 25:50 26:51 |
| team_efg | NCAAT | team total AWAY | 77 | 57.1 | 51.9 | **+5.2** | +7.0 | 0.211 | 24:46 25:61 |

## PLACEBO — fga_rate (placebo)

| signal | phase | market | bets | win % | base % | edge | ROI % | p | by season |
|---|---|---|---|---|---|---|---|---|---|
| fga_rate (placebo) | NONCONF | FG spread OPEN | 2,021 | 49.6 | 51.9 | **-2.3** | -5.3 | 0.985 | 23:48 24:48 25:52 26:51 |
| fga_rate (placebo) | MTE | FG spread OPEN | 336 | 50.0 | 52.1 | **-2.1** | -4.5 | 0.790 | 23:48 24:53 25:50 26:49 |
| fga_rate (placebo) | CONF_EARLY | FG spread OPEN | 1,897 | 51.6 | 51.3 | **+0.3** | -1.5 | 0.399 | 23:52 24:55 25:46 26:54 |
| fga_rate (placebo) | CONF_LATE | FG spread OPEN | 1,878 | 50.9 | 50.8 | **+0.1** | -2.9 | 0.491 | 23:51 24:53 25:46 26:53 |
| fga_rate (placebo) | CONF_TOURN | FG spread OPEN | 279 | 47.7 | 50.5 | **-2.9** | -8.9 | 0.846 | 23:43 24:41 25:65 26:39 |
| fga_rate (placebo) | NCAAT | FG spread OPEN | 60 | 51.7 | 61.7 | **-10.0** | -1.4 | 0.955 |  |
| fga_rate (placebo) | NONCONF | FG spread T-60 | 2,004 | 49.5 | 50.5 | **-1.0** | -5.5 | 0.823 | 23:50 24:47 25:50 26:51 |
| fga_rate (placebo) | MTE | FG spread T-60 | 332 | 50.9 | 51.8 | **-0.9** | -2.8 | 0.656 | 23:48 24:55 25:50 26:52 |
| fga_rate (placebo) | CONF_EARLY | FG spread T-60 | 1,894 | 52.0 | 51.2 | **+0.8** | -0.7 | 0.241 | 23:53 24:55 25:46 26:55 |
| fga_rate (placebo) | CONF_LATE | FG spread T-60 | 1,877 | 51.1 | 51.1 | **+0.0** | -2.3 | 0.512 | 23:51 24:53 25:47 26:54 |
| fga_rate (placebo) | CONF_TOURN | FG spread T-60 | 280 | 47.5 | 51.4 | **-3.9** | -9.2 | 0.918 | 23:42 24:41 25:65 26:40 |
| fga_rate (placebo) | NCAAT | FG spread T-60 | 61 | 52.5 | 62.3 | **-9.8** | +0.2 | 0.957 |  |
| fga_rate (placebo) | NONCONF | FG total OPEN | 1,980 | 49.8 | 50.6 | **-0.8** | -4.9 | 0.756 | 23:49 24:52 25:47 26:51 |
| fga_rate (placebo) | MTE | FG total OPEN | 284 | 47.5 | 52.8 | **-5.3** | -9.2 | 0.968 | 23:51 24:45 25:47 26:46 |
| fga_rate (placebo) | CONF_EARLY | FG total OPEN | 1,805 | 50.4 | 50.0 | **+0.3** | -3.8 | 0.395 | 23:50 24:55 25:49 26:49 |
| fga_rate (placebo) | CONF_LATE | FG total OPEN | 2,031 | 53.0 | 52.5 | **+0.4** | +1.1 | 0.351 | 23:52 24:54 25:54 26:52 |
| fga_rate (placebo) | CONF_TOURN | FG total OPEN | 310 | 47.1 | 55.8 | **-8.7** | -10.1 | 0.999 | 23:51 24:50 25:43 26:45 |
| fga_rate (placebo) | NCAAT | FG total OPEN | 99 | 44.4 | 60.6 | **-16.2** | -15.2 | 1.000 | 24:43 25:46 |
| fga_rate (placebo) | NONCONF | FG total T-60 | 1,986 | 49.4 | 50.6 | **-1.2** | -5.6 | 0.855 | 23:48 24:52 25:46 26:51 |
| fga_rate (placebo) | MTE | FG total T-60 | 283 | 48.1 | 53.7 | **-5.7** | -8.2 | 0.976 | 23:49 24:46 25:47 26:51 |
| fga_rate (placebo) | CONF_EARLY | FG total T-60 | 1,798 | 50.6 | 50.4 | **+0.2** | -3.5 | 0.452 | 23:49 24:55 25:48 26:50 |
| fga_rate (placebo) | CONF_LATE | FG total T-60 | 2,025 | 53.0 | 52.8 | **+0.1** | +1.2 | 0.457 | 23:53 24:54 25:55 26:51 |
| fga_rate (placebo) | CONF_TOURN | FG total T-60 | 311 | 47.3 | 54.3 | **-7.1** | -9.8 | 0.995 | 23:52 24:49 25:41 26:48 |
| fga_rate (placebo) | NCAAT | FG total T-60 | 100 | 46.0 | 59.0 | **-13.0** | -12.2 | 0.997 | 24:43 25:46 |
| fga_rate (placebo) | NONCONF | 1H spread | 1,601 | 48.7 | 50.4 | **-1.7** | -7.7 | 0.918 | 24:49 25:48 26:49 |
| fga_rate (placebo) | MTE | 1H spread | 248 | 50.4 | 51.6 | **-1.2** | -4.5 | 0.670 | 24:54 25:54 26:40 |
| fga_rate (placebo) | CONF_EARLY | 1H spread | 1,445 | 50.4 | 53.8 | **-3.3** | -4.3 | 0.994 | 24:54 25:48 26:50 |
| fga_rate (placebo) | CONF_LATE | 1H spread | 1,457 | 51.7 | 51.5 | **+0.1** | -1.9 | 0.471 | 24:53 25:51 26:52 |
| fga_rate (placebo) | CONF_TOURN | 1H spread | 215 | 46.5 | 50.7 | **-4.2** | -11.7 | 0.898 | 24:49 25:49 26:41 |
| fga_rate (placebo) | NONCONF | 1H total | 1,549 | 51.0 | 51.4 | **-0.4** | -3.6 | 0.634 | 24:52 25:51 26:50 |
| fga_rate (placebo) | MTE | 1H total | 202 | 48.0 | 53.0 | **-5.0** | -9.1 | 0.930 | 24:45 25:48 26:51 |
| fga_rate (placebo) | CONF_EARLY | 1H total | 1,365 | 49.2 | 51.8 | **-2.6** | -6.9 | 0.975 | 24:54 25:47 26:47 |
| fga_rate (placebo) | CONF_LATE | 1H total | 1,537 | 51.7 | 50.1 | **+1.6** | -2.0 | 0.103 | 24:53 25:53 26:49 |
| fga_rate (placebo) | CONF_TOURN | 1H total | 233 | 45.5 | 53.2 | **-7.7** | -13.7 | 0.993 | 24:47 25:38 26:51 |
| fga_rate (placebo) | NCAAT | 1H total | 69 | 53.6 | 50.7 | **+2.9** | +1.5 | 0.367 | 24:48 |
| fga_rate (placebo) | NONCONF | team total HOME | 1,389 | 49.9 | 50.8 | **-0.9** | -6.7 | 0.750 | 24:45 25:52 26:52 |
| fga_rate (placebo) | MTE | team total HOME | 194 | 43.8 | 54.1 | **-10.3** | -18.3 | 0.998 | 24:54 25:41 26:39 |
| fga_rate (placebo) | CONF_EARLY | team total HOME | 1,440 | 52.0 | 52.3 | **-0.3** | -2.1 | 0.596 | 24:55 25:54 26:48 |
| fga_rate (placebo) | CONF_LATE | team total HOME | 1,524 | 53.1 | 54.1 | **-1.0** | +0.1 | 0.782 | 24:54 25:53 26:52 |
| fga_rate (placebo) | CONF_TOURN | team total HOME | 241 | 52.3 | 54.4 | **-2.1** | -1.5 | 0.765 | 24:49 25:61 26:46 |
| fga_rate (placebo) | NONCONF | team total AWAY | 1,479 | 47.6 | 51.7 | **-4.1** | -10.6 | 0.999 | 24:47 25:48 26:48 |
| fga_rate (placebo) | MTE | team total AWAY | 185 | 52.4 | 55.1 | **-2.7** | -1.7 | 0.796 | 24:43 25:54 26:57 |
| fga_rate (placebo) | CONF_EARLY | team total AWAY | 1,348 | 50.9 | 50.5 | **+0.4** | -4.2 | 0.405 | 24:52 25:49 26:52 |
| fga_rate (placebo) | CONF_LATE | team total AWAY | 1,436 | 51.4 | 52.5 | **-1.1** | -3.2 | 0.808 | 24:52 25:50 26:52 |
| fga_rate (placebo) | CONF_TOURN | team total AWAY | 213 | 47.9 | 52.1 | **-4.2** | -9.9 | 0.907 | 24:56 25:48 26:42 |

## PLACEBO — fta_rate (placebo)

| signal | phase | market | bets | win % | base % | edge | ROI % | p | by season |
|---|---|---|---|---|---|---|---|---|---|
| fta_rate (placebo) | NONCONF | FG spread OPEN | 1,915 | 49.6 | 50.9 | **-1.3** | -5.4 | 0.880 | 23:49 24:48 25:53 26:49 |
| fta_rate (placebo) | MTE | FG spread OPEN | 301 | 50.2 | 53.2 | **-3.0** | -4.1 | 0.866 | 23:52 24:50 25:50 26:49 |
| fta_rate (placebo) | CONF_EARLY | FG spread OPEN | 1,841 | 51.2 | 50.0 | **+1.2** | -2.2 | 0.163 | 23:48 24:50 25:52 26:55 |
| fta_rate (placebo) | CONF_LATE | FG spread OPEN | 1,990 | 49.9 | 50.3 | **-0.3** | -4.6 | 0.618 | 23:50 24:49 25:50 26:51 |
| fta_rate (placebo) | CONF_TOURN | FG spread OPEN | 343 | 51.3 | 50.1 | **+1.2** | -2.0 | 0.359 | 23:46 24:59 25:46 26:55 |
| fta_rate (placebo) | NCAAT | FG spread OPEN | 82 | 53.7 | 53.7 | **+0.0** | +2.5 | 0.544 | 23:55 |
| fta_rate (placebo) | NONCONF | FG spread T-60 | 1,909 | 49.7 | 50.7 | **-1.0** | -5.1 | 0.817 | 23:49 24:49 25:52 26:49 |
| fta_rate (placebo) | MTE | FG spread T-60 | 298 | 52.0 | 52.7 | **-0.7** | -0.7 | 0.613 | 23:51 24:49 25:54 26:54 |
| fta_rate (placebo) | CONF_EARLY | FG spread T-60 | 1,842 | 51.7 | 51.0 | **+0.8** | -1.2 | 0.266 | 23:49 24:51 25:52 26:55 |
| fta_rate (placebo) | CONF_LATE | FG spread T-60 | 1,980 | 50.1 | 50.6 | **-0.5** | -4.4 | 0.682 | 23:50 24:48 25:51 26:51 |
| fta_rate (placebo) | CONF_TOURN | FG spread T-60 | 342 | 52.6 | 50.6 | **+2.0** | +0.5 | 0.238 | 23:51 24:59 25:46 26:55 |
| fta_rate (placebo) | NCAAT | FG spread T-60 | 83 | 54.2 | 53.0 | **+1.2** | +3.5 | 0.462 | 23:56 |
| fta_rate (placebo) | NONCONF | FG total OPEN | 1,769 | 50.1 | 50.9 | **-0.7** | -4.3 | 0.735 | 23:50 24:50 25:52 26:48 |
| fta_rate (placebo) | MTE | FG total OPEN | 280 | 53.9 | 50.7 | **+3.2** | +2.9 | 0.157 | 23:52 24:50 25:55 26:56 |
| fta_rate (placebo) | CONF_EARLY | FG total OPEN | 1,911 | 51.2 | 50.3 | **+0.9** | -2.2 | 0.218 | 23:52 24:53 25:51 26:49 |
| fta_rate (placebo) | CONF_LATE | FG total OPEN | 2,061 | 48.7 | 52.1 | **-3.4** | -7.1 | 0.999 | 23:49 24:45 25:49 26:51 |
| fta_rate (placebo) | CONF_TOURN | FG total OPEN | 375 | 47.5 | 54.4 | **-6.9** | -9.4 | 0.997 | 23:53 24:39 25:51 26:49 |
| fta_rate (placebo) | NCAAT | FG total OPEN | 86 | 52.3 | 53.5 | **-1.2** | -0.1 | 0.631 |  |
| fta_rate (placebo) | NONCONF | FG total T-60 | 1,773 | 50.2 | 50.1 | **+0.1** | -4.2 | 0.467 | 23:50 24:50 25:52 26:49 |
| fta_rate (placebo) | MTE | FG total T-60 | 280 | 53.2 | 51.4 | **+1.8** | +1.6 | 0.301 | 23:52 24:48 25:56 26:54 |
| fta_rate (placebo) | CONF_EARLY | FG total T-60 | 1,919 | 50.4 | 50.3 | **+0.1** | -3.8 | 0.491 | 23:51 24:52 25:51 26:48 |
| fta_rate (placebo) | CONF_LATE | FG total T-60 | 2,058 | 49.3 | 52.4 | **-3.1** | -6.0 | 0.998 | 23:50 24:47 25:50 26:51 |
| fta_rate (placebo) | CONF_TOURN | FG total T-60 | 374 | 46.0 | 53.7 | **-7.8** | -12.2 | 0.999 | 23:48 24:38 25:49 26:49 |
| fta_rate (placebo) | NCAAT | FG total T-60 | 86 | 54.7 | 52.3 | **+2.3** | +4.3 | 0.378 |  |
| fta_rate (placebo) | NONCONF | 1H spread | 1,545 | 48.5 | 50.3 | **-1.8** | -8.1 | 0.927 | 24:50 25:48 26:47 |
| fta_rate (placebo) | MTE | 1H spread | 224 | 51.8 | 52.2 | **-0.4** | -1.7 | 0.580 | 24:51 25:50 26:57 |
| fta_rate (placebo) | CONF_EARLY | 1H spread | 1,340 | 52.9 | 50.2 | **+2.7** | +0.3 | 0.026 | 24:50 25:54 26:54 |
| fta_rate (placebo) | CONF_LATE | 1H spread | 1,513 | 50.5 | 52.9 | **-2.4** | -4.2 | 0.969 | 24:52 25:52 26:48 |
| fta_rate (placebo) | CONF_TOURN | 1H spread | 240 | 54.2 | 50.0 | **+4.2** | +2.9 | 0.106 | 24:55 25:48 26:60 |
| fta_rate (placebo) | NONCONF | 1H total | 1,424 | 51.5 | 50.8 | **+0.6** | -2.7 | 0.324 | 24:49 25:56 26:50 |
| fta_rate (placebo) | MTE | 1H total | 214 | 57.5 | 54.2 | **+3.3** | +8.8 | 0.186 | 24:55 25:56 26:61 |
| fta_rate (placebo) | CONF_EARLY | 1H total | 1,415 | 50.3 | 50.7 | **-0.4** | -4.7 | 0.618 | 24:57 25:48 26:48 |
| fta_rate (placebo) | CONF_LATE | 1H total | 1,519 | 50.1 | 50.4 | **-0.3** | -5.1 | 0.610 | 24:49 25:48 26:53 |
| fta_rate (placebo) | CONF_TOURN | 1H total | 275 | 45.1 | 54.9 | **-9.8** | -14.6 | 1.000 | 24:46 25:42 26:46 |
| fta_rate (placebo) | NONCONF | team total HOME | 1,354 | 49.3 | 50.7 | **-1.3** | -7.6 | 0.843 | 24:43 25:54 26:51 |
| fta_rate (placebo) | MTE | team total HOME | 198 | 57.1 | 52.5 | **+4.5** | +6.7 | 0.113 | 24:55 25:58 26:57 |
| fta_rate (placebo) | CONF_EARLY | team total HOME | 1,387 | 49.8 | 51.4 | **-1.6** | -6.3 | 0.888 | 24:47 25:53 26:49 |
| fta_rate (placebo) | CONF_LATE | team total HOME | 1,506 | 48.8 | 50.3 | **-1.5** | -8.1 | 0.876 | 24:50 25:50 26:47 |
| fta_rate (placebo) | CONF_TOURN | team total HOME | 254 | 50.8 | 53.9 | **-3.1** | -4.3 | 0.857 | 24:44 25:58 26:51 |
| fta_rate (placebo) | NONCONF | team total AWAY | 1,354 | 48.6 | 51.0 | **-2.4** | -8.7 | 0.966 | 24:51 25:48 26:48 |
| fta_rate (placebo) | MTE | team total AWAY | 206 | 53.9 | 53.9 | **+0.0** | +1.3 | 0.528 | 24:44 25:61 26:47 |
| fta_rate (placebo) | CONF_EARLY | team total AWAY | 1,313 | 47.6 | 50.3 | **-2.7** | -10.3 | 0.976 | 24:48 25:50 26:46 |
| fta_rate (placebo) | CONF_LATE | team total AWAY | 1,526 | 50.1 | 52.2 | **-2.1** | -5.8 | 0.955 | 24:48 25:49 26:53 |
| fta_rate (placebo) | CONF_TOURN | team total AWAY | 264 | 44.3 | 53.0 | **-8.7** | -16.6 | 0.999 | 24:44 25:41 26:49 |

## D — roster experience by phase (the development curve)

Role-weighted career games of the rotation. Pre-registered: inexperienced teams improve fastest across a season, so if the market lags that, backing the LESS experienced side should pay LATE and not early. Sides markets only.

| signal | phase | market | bets | win % | base % | edge | ROI % | p | by season |
|---|---|---|---|---|---|---|---|---|---|
| back less experienced | NONCONF | FG spread OPEN | 1,931 | 50.4 | 51.9 | **-1.5** | -3.8 | 0.909 | 24:48 25:51 26:51 |
| back less experienced | MTE | FG spread OPEN | 266 | 50.0 | 50.4 | **-0.4** | -4.5 | 0.577 | 24:52 25:51 26:47 |
| back less experienced | CONF_EARLY | FG spread OPEN | 1,813 | 48.9 | 52.0 | **-3.1** | -6.6 | 0.997 | 24:50 25:47 26:50 |
| back less experienced | CONF_LATE | FG spread OPEN | 2,026 | 53.2 | 51.2 | **+2.0** | +1.6 | 0.039 | 23:48 24:53 25:53 26:54 |
| back less experienced | CONF_TOURN | FG spread OPEN | 370 | 53.0 | 50.5 | **+2.4** | +1.2 | 0.187 | 24:51 25:55 26:52 |
| back less experienced | NCAAT | FG spread OPEN | 118 | 50.0 | 54.2 | **-4.2** | -4.5 | 0.845 | 24:43 25:51 26:51 |
| back less experienced | NONCONF | FG spread T-60 | 1,917 | 51.2 | 50.3 | **+0.8** | -2.3 | 0.241 | 24:49 25:51 26:52 |
| back less experienced | MTE | FG spread T-60 | 265 | 51.3 | 50.2 | **+1.1** | -2.0 | 0.381 | 24:56 25:51 26:47 |
| back less experienced | CONF_EARLY | FG spread T-60 | 1,804 | 49.1 | 51.3 | **-2.2** | -6.2 | 0.967 | 24:50 25:48 26:50 |
| back less experienced | CONF_LATE | FG spread T-60 | 2,027 | 53.3 | 50.9 | **+2.5** | +1.9 | 0.014 | 23:47 24:54 25:53 26:54 |
| back less experienced | CONF_TOURN | FG spread T-60 | 368 | 53.8 | 50.3 | **+3.5** | +2.8 | 0.096 | 24:52 25:55 26:54 |
| back less experienced | NCAAT | FG spread T-60 | 118 | 49.2 | 55.1 | **-5.9** | -6.1 | 0.915 | 24:43 25:49 26:51 |
| back less experienced | NONCONF | 1H spread | 1,912 | 50.7 | 51.2 | **-0.5** | -3.8 | 0.677 | 24:50 25:52 26:51 |
| back less experienced | MTE | 1H spread | 265 | 49.1 | 50.6 | **-1.5** | -7.1 | 0.711 | 24:60 25:49 26:42 |
| back less experienced | CONF_EARLY | 1H spread | 1,783 | 50.6 | 52.6 | **-2.0** | -4.0 | 0.955 | 24:51 25:52 26:50 |
| back less experienced | CONF_LATE | 1H spread | 1,968 | 54.0 | 50.9 | **+3.1** | +2.5 | 0.003 | 24:56 25:52 26:54 |
| back less experienced | CONF_TOURN | 1H spread | 349 | 47.3 | 53.3 | **-6.0** | -10.2 | 0.989 | 24:51 25:44 26:49 |
| back less experienced | NCAAT | 1H spread | 90 | 52.2 | 52.2 | **+0.0** | -0.7 | 0.544 | 25:57 26:49 |

## E — family-wise permutation over the PLAYER grid

Best |edge| in STANDARD ERRORS anywhere in the player grid (cells of at least 400 bets): **5.15**. Shuffling the signal inside each phase 300 times, the best cell anywhere reaches a mean of **4.23** by chance alone (95th pct 5.27). **Family-wise p = 0.073.**

Anything below 0.05 here is worth a second look. Anything above it means the grid produced exactly what noise produces, however good an individual cell looks.
