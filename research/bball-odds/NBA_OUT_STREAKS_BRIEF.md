# NBA absence signal — where the edge lives, and whether any of it is free

Grid: 169,335 player-team-games, 17.8% of them reconstructed (the player was absent and not listed on the box score at all — these are the rows the old shift-over-listed-rows approach silently skipped).

Rotation-player absences: 17,916. Prior-streak mix: fresh(0-1) 47%, mid(2-4) 20%, long(5+) 32%.

## Decomposition by how long the player has already been out

Same rule throughout: value each side's absent rotation players in RAPM margin pts/48 weighted by rotation-minute share, back the side whose opponent is more depleted. The ONLY thing changing between blocks is which absences count.

### FRESH (out tonight + last game, played before that)

| rule / min gap | n | win % | slice base % | ROI % | by season |
|---|---|---|---|---|---|
| FG spread (open) ≥1.0 | 897 | 53.1 | 53.7 | +1.3 | 2022:54/158 2023:53/204 2024:53/278 2025:53/257 |
| FG spread (open) ≥1.5 | 629 | 55.0 | 53.9 | +5.0 | 2022:58/106 2023:55/147 2024:53/184 2025:55/192 |
| FG spread (open) ≥2.0 | 427 | 55.3 | 53.9 | +5.5 | 2022:60/72 2023:54/109 2024:53/119 2025:56/127 |
| FG spread (T-60) ≥1.0 | 900 | 51.7 | 52.1 | -1.4 | 2022:54/156 2023:50/208 2024:53/279 2025:51/257 |
| FG spread (T-60) ≥1.5 | 632 | 53.6 | 51.7 | +2.4 | 2022:58/106 2023:52/151 2024:53/185 2025:53/190 |
| FG spread (T-60) ≥2.0 | 432 | 53.0 | 51.6 | +1.2 | 2022:61/72 2023:50/112 2024:50/122 2025:54/126 |
| 1H spread (T-60) ≥1.0 | 740 | 50.8 | 51.9 | -3.0 | 2023:51/204 2024:48/279 2025:53/257 |
| 1H spread (T-60) ≥1.5 | 526 | 51.0 | 52.3 | -2.7 | 2023:49/149 2024:49/186 2025:54/191 |
| 1H spread (T-60) ≥2.0 | 358 | 48.9 | 53.4 | -6.7 | 2023:48/111 2024:47/121 2025:52/126 |

### MID (2-4 straight missed)

| rule / min gap | n | win % | slice base % | ROI % | by season |
|---|---|---|---|---|---|
| FG spread (open) ≥1.0 | 1,226 | 51.1 | 50.2 | -2.4 | 2022:52/202 2023:50/261 2024:51/387 2025:51/376 |
| FG spread (open) ≥1.5 | 887 | 51.3 | 50.8 | -2.1 | 2022:52/136 2023:50/186 2024:51/275 2025:52/290 |
| FG spread (open) ≥2.0 | 632 | 51.7 | 50.2 | -1.2 | 2022:56/93 2023:51/142 2024:51/199 2025:51/198 |
| FG spread (T-60) ≥1.0 | 1,217 | 49.9 | 50.1 | -4.8 | 2022:51/201 2023:48/260 2024:50/384 2025:50/372 |
| FG spread (T-60) ≥1.5 | 883 | 50.2 | 50.7 | -4.2 | 2022:51/136 2023:49/186 2024:49/273 2025:52/288 |
| FG spread (T-60) ≥2.0 | 629 | 50.1 | 50.6 | -4.4 | 2022:54/94 2023:51/142 2024:48/197 2025:50/196 |
| 1H spread (T-60) ≥1.0 | 1,020 | 47.8 | 52.0 | -8.6 | 2023:49/263 2024:46/383 2025:49/374 |
| 1H spread (T-60) ≥1.5 | 745 | 48.9 | 52.5 | -6.7 | 2023:49/185 2024:46/271 2025:52/289 |
| 1H spread (T-60) ≥2.0 | 533 | 49.0 | 54.8 | -6.5 | 2023:52/141 2024:44/194 2025:52/198 |

### LONG (5+ straight missed)

| rule / min gap | n | win % | slice base % | ROI % | by season |
|---|---|---|---|---|---|
| FG spread (open) ≥1.0 | 1,688 | 48.6 | 50.0 | -7.1 | 2022:52/330 2023:49/402 2024:44/459 2025:51/497 |
| FG spread (open) ≥1.5 | 1,247 | 48.3 | 51.3 | -7.8 | 2022:47/211 2023:50/299 2024:45/355 2025:50/382 |
| FG spread (open) ≥2.0 | 894 | 48.7 | 52.2 | -7.1 | 2022:45/146 2023:52/196 2024:45/265 2025:52/287 |
| FG spread (T-60) ≥1.0 | 1,688 | 48.1 | 50.5 | -8.1 | 2022:51/326 2023:48/406 2024:45/457 2025:49/499 |
| FG spread (T-60) ≥1.5 | 1,244 | 47.5 | 51.9 | -9.3 | 2022:46/207 2023:48/303 2024:46/352 2025:49/382 |
| FG spread (T-60) ≥2.0 | 892 | 47.2 | 52.6 | -9.9 | 2022:43/143 2023:49/200 2024:44/263 2025:51/286 |
| 1H spread (T-60) ≥1.0 | 1,357 | 50.3 | 51.6 | -4.0 | 2023:53/400 2024:48/458 2025:51/499 |
| 1H spread (T-60) ≥1.5 | 1,039 | 50.0 | 50.7 | -4.4 | 2023:52/301 2024:48/355 2025:50/383 |
| 1H spread (T-60) ≥2.0 | 748 | 51.5 | 50.5 | -1.7 | 2023:54/197 2024:49/265 2025:52/286 |

### ALL durable (the original feature)

| rule / min gap | n | win % | slice base % | ROI % | by season |
|---|---|---|---|---|---|
| FG spread (open) ≥1.0 | 2,546 | 50.7 | 50.9 | -3.1 | 2022:54/495 2023:50/621 2024:49/711 2025:52/719 |
| FG spread (open) ≥1.5 | 2,033 | 51.5 | 50.4 | -1.8 | 2022:53/369 2023:51/505 2024:50/572 2025:52/587 |
| FG spread (open) ≥2.0 | 1,593 | 51.5 | 50.5 | -1.6 | 2022:51/275 2023:52/389 2024:50/458 2025:52/471 |
| FG spread (T-60) ≥1.0 | 2,540 | 49.3 | 50.6 | -5.8 | 2022:52/488 2023:48/625 2024:48/709 2025:50/718 |
| FG spread (T-60) ≥1.5 | 2,030 | 49.9 | 50.1 | -4.7 | 2022:52/363 2023:50/511 2024:48/570 2025:51/586 |
| FG spread (T-60) ≥2.0 | 1,594 | 49.6 | 50.4 | -5.3 | 2022:50/271 2023:50/394 2024:48/458 2025:51/471 |
| 1H spread (T-60) ≥1.0 | 2,050 | 50.2 | 50.9 | -4.1 | 2023:52/622 2024:48/708 2025:51/720 |
| 1H spread (T-60) ≥1.5 | 1,663 | 50.4 | 50.8 | -3.8 | 2023:52/505 2024:48/571 2025:52/587 |
| 1H spread (T-60) ≥2.0 | 1,318 | 50.7 | 50.2 | -3.2 | 2023:52/391 2024:49/458 2025:52/469 |

## The free version — tonight is never inspected

Availability is predicted from the streak alone. `persistence` is the share of those predictions that were correct (the player really was out tonight); it bounds how much of the signal survives the substitution.

- missed the last 3: persistence 83.9% (n=31,758 player-games)
- missed the last 5: persistence 87.9% (n=22,434 player-games)
- missed the last 8: persistence 90.4% (n=15,127 player-games)

| rule / min gap | n | win % | slice base % | ROI % | by season |
|---|---|---|---|---|---|
| predict from last 3 — FG open ≥1.0 | 2,217 | 49.3 | 50.1 | -6.0 | 2022:49/424 2023:52/531 2024:45/616 2025:51/646 |
| predict from last 3 — FG open ≥2.0 | 1,308 | 48.0 | 50.2 | -8.3 | 2022:43/214 2023:50/313 2024:45/387 2025:52/394 |
| predict from last 5 — FG open ≥1.0 | 1,840 | 48.9 | 50.1 | -6.7 | 2022:51/357 2023:49/436 2024:45/501 2025:51/546 |
| predict from last 5 — FG open ≥2.0 | 995 | 48.4 | 51.0 | -7.5 | 2022:45/166 2023:52/221 2024:45/295 2025:51/313 |
| predict from last 8 — FG open ≥1.0 | 1,372 | 48.2 | 51.3 | -8.0 | 2022:49/287 2023:49/340 2024:46/347 2025:50/398 |
| predict from last 8 — FG open ≥2.0 | 693 | 47.5 | 53.4 | -9.3 | 2022:46/123 2023:48/149 2024:45/193 2025:51/228 |

