# NCAAB: the game after the total went way over (or way under)

Study 2026-10-30 (`study_total_overreaction.py`). Owner theory: after a huge over the book and the public shade the next total up and the
teams do not score as much → UNDER.

## Verdict: the theory runs the other way. The book UNDER-reacts, and the OVER is the side.

The shade is real: after a 30+ over the next total closes +4.5 above the two teams' prior average (ordinary game +2.1). But the teams
score even more than that: actual total +6.5 above prior average, so the line is about 2 points short. The gap grows with the size of the
over (over by 0–10: +0.8 · 10–20: +0.9 · 20–30: +1.1 · 30+: +2.0). The UNDER loses at every rung, monotone: 48.7% (10+) → 48.2 → 47.9
→ 47.2 → 46.1% (30+). Records below are from the OVER side, graded at the close, one row per game.

| spot (either team's LAST game went over the total by …) | bet | record | ROI | seasons | z vs 50.8% over base |
|---|---|---|---|---|---|
| 20+ | OVER | 2,997-2,748-47 (52.2%) | −0.4% | 6 of 6 | +2.1 |
| 25+ | OVER | 1,931-1,707-28 (53.1%) | +1.3% | 5 of 6 | +2.7 |
| **30+** | **OVER** | **1,166-994-17 (54.0%)** | **+3.1%** | 5 of 6 | +3.0 |
| 35+ | OVER | 664-575-12 (53.6%) | +2.3% | 6 of 6 | +2.0 |

**Sharpened: the book did NOT raise the total** (tonight's close within +3 of the two teams' prior average). When the book does raise it 3+,
the edge is gone (30+: 52.1%). When it does not, the edge doubles:

| either team over by … AND total not raised | bet | record | ROI | seasons | z |
|---|---|---|---|---|---|
| 15+ | OVER | 2,345-1,995-38 (54.0%) | +3.2% | 6 of 6 | +4.3 |
| 20+ | OVER | 1,478-1,259-25 (54.0%) | +3.1% | 6 of 6 | +3.3 |
| 25+ | OVER | 920-745-16 (55.3%) | +5.5% | 5 of 6 | +3.6 |
| **30+** | **OVER** | **535-405-10 (56.9%)** | **+8.7%** | 5 of 6 | +3.8 |

First-half total carries weakly (30+ & not raised: 1H over 221-182, 54.8%, 3 seasons). Team total of the team that did the scoring: nothing
(48–49% under, i.e. ~51% over). Both-teams-over-by-X: same direction, thinner.

**Mirror** (last game went UNDER by 25+/30+): the full-game total is a coin flip (49.8% / 50.0%), but that team's TEAM TOTAL goes OVER
770-664 (53.7%, +2.5%) and 373-312 (54.5%, +4.0%), 3 of 3 seasons each — the book drops a team's own number too far after a dead night.

Ship as: `ncaab_big_over_carry` (either team's last game over by 30+, regular season → OVER; 1,166-994, 54.0%, +3.1%) with the
"not raised" variant as the premium tier, and `ncaab_dead_night_team_total` (team's last game under by 25+ → that team's TEAM TOTAL over;
770-664, 53.7%, 2023-24→) as tracking. Owner decides.

---

Owner theory: a huge over makes the book and the public shade the next total up, and the teams do not score as much. Universe: regular-season team-games 2020-21 → 2025-26 with a same-season previous game that had a closing total (n = 53,999). Graded at the consensus close. Records from the bet's side (UNDER for the over-reaction cells, OVER for the mirror). 'Shade' = tonight's closing total minus the average of the two teams' prior closing totals this season (both teams need 3+ prior games).

Base rates: FG under 49.2% · 1H under 51.1% · team total under 49.1%. Over-margin deciles: p5=-25, p10=-20, p25=-10, p50=+0, p75=+12, p90=+22, p95=+28


## 1. ONE team's last game went over by X+ → bet UNDER tonight


### This team's previous game went over the total by 10+

n = 15,162 team-games · shade of tonight's total vs the two teams' prior average: +3.23 pts (n=14,313)

| market | under record (bet side) | per season |
|---|---|---|
| FG total | 6980-7360-120 (48.7%, -7.1%) | 0/6] 21:804-842 · 22:1105-1173 · 23:1306-1435 · 24:1249-1352 · 25:1243-1251 · 26:1273-1307 |
| 1H total | 3844-3788-81 (50.4%, -3.8%) | 2/3] 24:1261-1319 · 25:1260-1228 · 26:1323-1241 |
| Team total (this team) | 3653-3745-38 (49.4%, -5.7%) | 1/3] 24:1142-1211 · 25:1241-1234 · 26:1270-1300 |

### This team's previous game went over the total by 15+

n = 10,246 team-games · shade of tonight's total vs the two teams' prior average: +3.49 pts (n=9,657)

| market | under record (bet side) | per season |
|---|---|---|
| FG total | 4666-5020-78 (48.2%, -8.0%) | 0/6] 21:546-586 · 22:750-794 · 23:864-967 · 24:827-930 · 25:784-835 · 26:895-908 |
| 1H total | 2550-2600-47 (49.5%, -5.5%) | 1/3] 24:838-906 · 25:787-825 · 26:925-869 |
| Team total (this team) | 2425-2551-26 (48.7%, -7.0%) | 0/3] 24:752-825 · 25:777-824 · 26:896-902 |

### This team's previous game went over the total by 20+

n = 6,519 team-games · shade of tonight's total vs the two teams' prior average: +3.82 pts (n=6,130)

| market | under record (bet side) | per season |
|---|---|---|
| FG total | 2952-3206-49 (47.9%, -8.5%) | 0/6] 21:339-354 · 22:467-527 · 23:563-629 · 24:493-575 · 25:500-522 · 26:590-599 |
| 1H total | 1628-1632-28 (49.9%, -4.7%) | 1/3] 24:503-559 · 25:499-516 · 26:626-557 |
| Team total (this team) | 1539-1611-22 (48.9%, -6.7%) | 1/3] 24:452-508 · 25:491-515 · 26:596-588 |

### This team's previous game went over the total by 25+

n = 4,026 team-games · shade of tonight's total vs the two teams' prior average: +4.13 pts (n=3,786)

| market | under record (bet side) | per season |
|---|---|---|
| FG total | 1797-2012-30 (47.2%, -9.9%) | 1/6] 21:199-218 · 22:271-353 · 23:332-379 · 24:310-357 · 25:300-326 · 26:385-379 |
| 1H total | 1016-1027-19 (49.7%, -5.1%) | 1/3] 24:323-341 · 25:296-325 · 26:397-361 |
| Team total (this team) | 964-1011-16 (48.8%, -6.8%) | 1/3] 24:284-318 · 25:295-318 · 26:385-375 |

### This team's previous game went over the total by 30+

n = 2,367 team-games · shade of tonight's total vs the two teams' prior average: +4.53 pts (n=2,233)

| market | under record (bet side) | per season |
|---|---|---|
| FG total | 1033-1210-19 (46.1%, -12.1%) | 0/6] 21:122-125 · 22:145-208 · 23:173-223 · 24:178-204 · 25:160-195 · 26:255-255 |
| 1H total | 606-633-11 (48.9%, -6.6%) | 1/3] 24:184-196 · 25:156-197 · 26:266-240 |
| Team total (this team) | 583-619-8 (48.5%, -7.4%) | 1/3] 24:155-189 · 25:170-180 · 26:258-250 |

## 2. BOTH teams' last games went over by X+ → UNDER


### Both teams' previous games went over by 10+

n = 4,184 team-games · shade of tonight's total vs the two teams' prior average: +3.94 pts (n=4,144)

| market | under record (bet side) | per season |
|---|---|---|
| FG total | 2030-2120-32 (48.9%, -6.6%) | 2/6] 21:356-344 · 22:338-354 · 23:378-402 · 24:312-360 · 25:328-290 · 26:318-370 |
| 1H total | 976-996-20 (49.5%, -5.5%) | 0/3] 24:332-338 · 25:308-308 · 26:336-350 |
| Team total (this team) | 936-975-9 (49.0%, -6.5%) | 1/3] 24:290-318 · 25:312-305 · 26:334-352 |

### Both teams' previous games went over by 15+

n = 1,998 team-games · shade of tonight's total vs the two teams' prior average: +4.31 pts (n=1,972)

| market | under record (bet side) | per season |
|---|---|---|
| FG total | 972-1008-18 (49.1%, -6.3%) | 2/6] 21:196-208 · 22:168-162 · 23:178-164 · 24:146-166 · 25:126-134 · 26:158-174 |
| 1H total | 450-454-8 (49.8%, -5.0%) | 1/3] 24:154-160 · 25:128-132 · 26:168-162 |
| Team total (this team) | 413-455-8 (47.6%, -9.2%) | 0/3] 24:137-144 · 25:117-140 · 26:159-171 |

### Both teams' previous games went over by 20+

n = 830 team-games · shade of tonight's total vs the two teams' prior average: +4.79 pts (n=815)

| market | under record (bet side) | per season |
|---|---|---|
| FG total | 408-418-4 (49.4%, -5.7%) | 2/6] 21:106-102 · 22:64-66 · 23:68-68 · 24:46-66 · 25:60-46 · 26:64-70 |
| 1H total | 182-166-2 (52.3%, -0.2%) | 2/3] 24:52-60 · 25:60-44 · 26:70-62 |
| Team total (this team) | 166-176-4 (48.5%, -7.3%) | 0/3] 24:52-56 · 25:50-54 · 26:64-66 |

### Both teams' previous games went over by 25+

n = 346 team-games · shade of tonight's total vs the two teams' prior average: +4.77 pts (n=340)

| market | under record (bet side) | per season |
|---|---|---|
| FG total | 180-162-4 (52.6%, +0.5%) | 4/6] 21:54-52 · 22:30-20 · 23:24-32 · 24:12-16 · 25:26-14 · 26:34-28 |
| 1H total | 72-56-2 (56.2%, +7.4%) | 2/3] 24:12-16 · 25:24-14 · 26:36-26 |
| Team total (this team) | 65-62-1 (51.2%, -2.3%) | 1/3] 24:13-13 · 25:17-23 · 26:35-26 |

## 3. EITHER team's last game went over by X+ → UNDER (game-level read)


### Either team's previous game went over by 15+

n = 17,547 team-games · shade of tonight's total vs the two teams' prior average: +3.37 pts (n=16,916)

| market | under record (bet side) | per season |
|---|---|---|
| FG total | 8118-8803-136 (48.0%, -8.4%) | 0/6] 21:869-935 · 22:1284-1377 · 23:1512-1741 · 24:1463-1652 · 25:1408-1504 · 26:1582-1594 |
| 1H total | 4526-4622-83 (49.5%, -5.5%) | 1/3] 24:1479-1611 · 25:1409-1489 · 26:1638-1522 |
| Team total (this team) | 4292-4552-52 (48.5%, -7.4%) | 0/3] 24:1308-1490 · 25:1415-1465 · 26:1569-1597 |

### Either team's previous game went over by 20+

n = 11,596 team-games · shade of tonight's total vs the two teams' prior average: +3.72 pts (n=11,174)

| market | under record (bet side) | per season |
|---|---|---|
| FG total | 5343-5844-93 (47.8%, -8.8%) | 0/6] 21:554-590 · 22:837-955 · 23:1034-1170 · 24:914-1050 · 25:920-983 · 26:1084-1096 |
| 1H total | 2999-3016-52 (49.9%, -4.8%) | 1/3] 24:927-1027 · 25:919-972 · 26:1153-1017 |
| Team total (this team) | 2831-2982-38 (48.7%, -7.0%) | 0/3] 24:828-932 · 25:932-948 · 26:1071-1102 |

### Either team's previous game went over by 25+

n = 7,330 team-games · shade of tonight's total vs the two teams' prior average: +4.06 pts (n=7,066)

| market | under record (bet side) | per season |
|---|---|---|
| FG total | 3316-3768-56 (46.8%, -10.6%) | 1/6] 21:330-372 · 22:488-663 · 23:631-713 · 24:589-677 · 25:563-630 · 26:715-713 |
| 1H total | 1914-1949-34 (49.5%, -5.4%) | 1/3] 24:614-648 · 25:558-627 · 26:742-674 |
| Team total (this team) | 1800-1940-25 (48.1%, -8.1%) | 0/3] 24:538-604 · 25:569-606 · 26:693-730 |

### Either team's previous game went over by 30+

n = 4,349 team-games · shade of tonight's total vs the two teams' prior average: +4.50 pts (n=4,204)

| market | under record (bet side) | per season |
|---|---|---|
| FG total | 1932-2276-34 (45.9%, -12.3%) | 1/6] 21:195-213 · 22:272-394 · 23:330-421 · 24:341-387 · 25:308-381 · 26:486-480 |
| 1H total | 1151-1218-20 (48.6%, -7.2%) | 1/3] 24:351-375 · 25:298-387 · 26:502-456 |
| Team total (this team) | 1101-1197-15 (47.9%, -8.5%) | 0/3] 24:307-347 · 25:325-355 · 26:469-495 |

## 4. Who did the scoring: the team itself vs what it allowed (prev game over by 20+)


### Over by 20+ AND this team beat its own team total by 10+ (it did the scoring)

n = 2,487 team-games · shade of tonight's total vs the two teams' prior average: +6.21 pts (n=2,383)

| market | under record (bet side) | per season |
|---|---|---|
| FG total | 1135-1233-15 (47.9%, -8.5%) | 0/3] 24:330-386 · 25:349-391 · 26:456-456 |
| 1H total | 1153-1201-21 (49.0%, -6.5%) | 1/3] 24:324-389 · 25:346-388 · 26:483-424 |
| Team total (this team) | 1120-1199-18 (48.3%, -7.8%) | 1/3] 24:308-371 · 25:353-378 · 26:459-450 |

### Over by 20+ AND this team was UNDER its own team total (the opponent did the scoring)

n = 37 team-games · shade of tonight's total vs the two teams' prior average: +5.65 pts (n=35)

| market | under record (bet side) | per season |
|---|---|---|
| FG total | 16-19-0 (45.7%, -12.7%) | 0/3] 24:6-8 · 25:5-6 · 26:5-5 |
| 1H total | 17-16-1 (51.5%, -1.7%) | 1/3] 24:5-8 · 25:7-3 · 26:5-5 |
| Team total (this team) | 16-17-0 (48.5%, -7.4%) | 1/3] 24:6-7 · 25:4-6 · 26:6-4 |

### Over by 20+, one team only (the opponent's last game did NOT go over by 10+)

n = 4,100 team-games · shade of tonight's total vs the two teams' prior average: +3.45 pts (n=4,060)

| market | under record (bet side) | per season |
|---|---|---|
| FG total | 1910-2151-35 (47.0%, -10.2%) | 1/6] 21:165-196 · 22:278-341 · 23:367-444 · 24:343-391 · 25:352-383 · 26:405-396 |
| 1H total | 1144-1109-21 (50.8%, -3.1%) | 1/3] 24:348-380 · 25:358-371 · 26:438-358 |
| Team total (this team) | 1075-1112-13 (49.2%, -6.2%) | 1/3] 24:311-351 · 25:357-368 · 26:407-393 |

## 5. Over by 20+, by rest and venue


### Over by 20+, 1-2 days rest

n = 1,384 team-games · shade of tonight's total vs the two teams' prior average: +2.97 pts (n=1,288)

| market | under record (bet side) | per season |
|---|---|---|
| FG total | 627-682-11 (47.9%, -8.6%) | 1/6] 21:116-112 · 22:116-124 · 23:118-132 · 24:91-102 · 25:91-98 · 26:95-114 |
| 1H total | 300-289-4 (50.9%, -2.8%) | 2/3] 24:97-95 · 25:92-96 · 26:111-98 |
| Team total (this team) | 279-293-4 (48.8%, -6.9%) | 1/3] 24:82-94 · 25:94-92 · 26:103-107 |

### Over by 20+, 3-4 days rest

n = 3,135 team-games · shade of tonight's total vs the two teams' prior average: +4.16 pts (n=2,956)

| market | under record (bet side) | per season |
|---|---|---|
| FG total | 1408-1554-23 (47.5%, -9.3%) | 2/6] 21:117-112 · 22:238-274 · 23:266-323 · 24:244-289 · 25:237-261 · 26:306-295 |
| 1H total | 808-814-13 (49.8%, -4.9%) | 1/3] 24:249-283 · 25:238-256 · 26:321-275 |
| Team total (this team) | 764-797-10 (48.9%, -6.6%) | 1/3] 24:225-248 · 25:237-255 · 26:302-294 |

### Over by 20+, 5-7 days rest

n = 1,674 team-games · shade of tonight's total vs the two teams' prior average: +3.95 pts (n=1,588)

| market | under record (bet side) | per season |
|---|---|---|
| FG total | 777-811-13 (48.9%, -6.6%) | 3/6] 21:77-102 · 22:92-93 · 23:155-154 · 24:137-157 · 25:156-146 · 26:160-159 |
| 1H total | 458-452-10 (50.3%, -3.9%) | 2/3] 24:141-150 · 25:152-148 · 26:165-154 |
| Team total (this team) | 427-451-8 (48.6%, -7.2%) | 1/3] 24:125-140 · 25:141-154 · 26:161-157 |

### Over by 20+, 8+ days rest

n = 326 team-games · shade of tonight's total vs the two teams' prior average: +3.36 pts (n=298)

| market | under record (bet side) | per season |
|---|---|---|
| FG total | 140-159-2 (46.8%, -10.6%) | 2/6] 21:29-28 · 22:21-36 · 23:24-20 · 24:21-27 · 25:16-17 · 26:29-31 |
| 1H total | 62-77-1 (44.6%, -14.8%) | 1/3] 24:16-31 · 25:17-16 · 26:29-30 |
| Team total (this team) | 69-70-0 (49.6%, -5.2%) | 1/3] 24:20-26 · 25:19-14 · 26:30-30 |

### Over by 20+, tonight at home

n = 3,344 team-games · shade of tonight's total vs the two teams' prior average: +3.78 pts (n=3,016)

| market | under record (bet side) | per season |
|---|---|---|
| FG total | 1414-1615-27 (46.7%, -10.9%) | 0/6] 21:170-181 · 22:222-264 · 23:255-314 · 24:232-297 · 25:255-266 · 26:280-293 |
| 1H total | 791-825-13 (48.9%, -6.6%) | 2/3] 24:233-296 · 25:259-258 · 26:299-271 |
| Team total (this team) | 764-800-11 (48.8%, -6.7%) | 1/3] 24:219-259 · 25:259-255 · 26:286-286 |

### Over by 20+, tonight on the road

n = 3,056 team-games · shade of tonight's total vs the two teams' prior average: +3.79 pts (n=3,002)

| market | under record (bet side) | per season |
|---|---|---|
| FG total | 1475-1538-22 (49.0%, -6.5%) | 1/6] 21:166-170 · 22:239-257 · 23:293-301 · 24:246-263 · 25:237-254 · 26:294-293 |
| 1H total | 797-778-15 (50.6%, -3.4%) | 2/3] 24:254-249 · 25:233-255 · 26:310-274 |
| Team total (this team) | 741-783-11 (48.6%, -7.2%) | 1/3] 24:221-238 · 25:224-258 · 26:296-287 |

### Over by 20+, tonight's total is HIGHER than the two teams' prior average by 3+ (the shade happened)

n = 3,183 team-games · shade of tonight's total vs the two teams' prior average: +9.55 pts (n=3,183)

| market | under record (bet side) | per season |
|---|---|---|
| FG total | 1568-1593-22 (49.6%, -5.3%) | 4/6] 21:115-110 · 22:180-179 · 23:244-258 · 24:324-344 · 25:294-292 · 26:411-410 |
| 1H total | 1070-997-14 (51.8%, -1.2%) | 2/3] 24:330-341 · 25:301-280 · 26:439-376 |
| Team total (this team) | 1010-983-17 (50.7%, -3.3%) | 2/3] 24:297-309 · 25:291-281 · 26:422-393 |

### Over by 20+, tonight's total is NOT shaded (within ±3 of prior average)

n = 1,828 team-games · shade of tonight's total vs the two teams' prior average: +0.21 pts (n=1,828)

| market | under record (bet side) | per season |
|---|---|---|
| FG total | 832-982-14 (45.9%, -12.4%) | 0/6] 21:120-147 · 22:151-193 · 23:184-200 · 24:116-163 · 25:139-153 · 26:122-126 |
| 1H total | 384-428-9 (47.3%, -9.7%) | 1/3] 24:120-152 · 25:135-156 · 26:129-120 |
| Team total (this team) | 364-418-3 (46.5%, -11.1%) | 0/3] 24:107-136 · 25:141-148 · 26:116-134 |

### Over by 20+, tonight's total is LOWER than prior average by 3+

n = 1,120 team-games · shade of tonight's total vs the two teams' prior average: -6.60 pts (n=1,120)

| market | under record (bet side) | per season |
|---|---|---|
| FG total | 511-597-12 (46.1%, -12.0%) | 0/6] 21:66-66 · 22:133-154 · 23:135-169 · 24:53-68 · 25:67-77 · 26:57-63 |
| 1H total | 174-207-5 (45.7%, -12.8%) | 0/3] 24:53-66 · 25:63-80 · 26:58-61 |
| Team total (this team) | 165-210-2 (44.0%, -16.0%) | 0/3] 24:48-63 · 25:59-86 · 26:58-61 |

## 6. Mirror: last game went UNDER by X+ → bet OVER tonight


### This team's previous game went under by 10+

n = 14,026 team-games · shade of tonight's total vs the two teams' prior average: +1.16 pts (n=13,259)

| market | over record (bet side) | per season |
|---|---|---|
| FG total | 6644-6590-130 (50.2%, -4.2%) | 3/6] 21:794-796 · 22:1065-1089 · 23:1177-1078 · 24:1189-1158 · 25:1166-1134 · 26:1253-1335 |
| 1H total | 3571-3628-86 (49.6%, -5.3%) | 1/3] 24:1185-1155 · 25:1142-1149 · 26:1244-1324 |
| Team total (this team) | 3577-3401-35 (51.3%, -2.1%) | 2/3] 24:1117-997 · 25:1173-1106 · 26:1287-1298 |

### This team's previous game went under by 15+

n = 9,093 team-games · shade of tonight's total vs the two teams' prior average: +0.97 pts (n=8,612)

| market | over record (bet side) | per season |
|---|---|---|
| FG total | 4305-4278-88 (50.2%, -4.2%) | 3/6] 21:529-510 · 22:677-724 · 23:744-682 · 24:789-741 · 25:726-740 · 26:840-881 |
| 1H total | 2347-2344-58 (50.0%, -4.5%) | 1/3] 24:781-745 · 25:719-741 · 26:847-858 |
| Team total (this team) | 2352-2198-19 (51.7%, -1.3%) | 3/3] 24:734-642 · 25:750-706 · 26:868-850 |

### This team's previous game went under by 20+

n = 5,273 team-games · shade of tonight's total vs the two teams' prior average: +0.91 pts (n=5,005)

| market | over record (bet side) | per season |
|---|---|---|
| FG total | 2492-2498-55 (49.9%, -4.7%) | 3/6] 21:305-309 · 22:373-430 · 23:432-384 · 24:447-425 · 25:443-435 · 26:492-515 |
| 1H total | 1379-1370-32 (50.2%, -4.2%) | 2/3] 24:434-435 · 25:443-435 · 26:502-500 |
| Team total (this team) | 1391-1281-11 (52.1%, -0.6%) | 3/3] 24:415-371 · 25:458-418 · 26:518-492 |

### This team's previous game went under by 25+

n = 2,816 team-games · shade of tonight's total vs the two teams' prior average: +0.93 pts (n=2,663)

| market | over record (bet side) | per season |
|---|---|---|
| FG total | 1324-1332-32 (49.8%, -4.8%) | 3/6] 21:155-175 · 22:180-218 · 23:233-201 · 24:258-232 · 25:240-232 · 26:258-274 |
| 1H total | 760-731-16 (51.0%, -2.7%) | 2/3] 24:259-228 · 25:241-231 · 26:260-272 |
| Team total (this team) | 770-664-6 (53.7%, +2.5%) | 3/3] 24:241-189 · 25:246-223 · 26:283-252 |

### This team's previous game went under by 30+

n = 1,350 team-games · shade of tonight's total vs the two teams' prior average: +0.72 pts (n=1,277)

| market | over record (bet side) | per season |
|---|---|---|
| FG total | 638-638-13 (50.0%, -4.5%) | 4/6] 21:69-89 · 22:87-110 · 23:103-99 · 24:126-103 · 25:119-106 · 26:134-131 |
| 1H total | 363-354-7 (50.6%, -3.3%) | 1/3] 24:122-106 · 25:108-115 · 26:133-133 |
| Team total (this team) | 373-312-1 (54.5%, +4.0%) | 3/3] 24:111-87 · 25:118-103 · 26:144-122 |

### Both teams' previous games went under by 15+

n = 1,578 team-games · shade of tonight's total vs the two teams' prior average: -0.53 pts (n=1,571)

| market | over record (bet side) | per season |
|---|---|---|
| FG total | 770-786-20 (49.5%, -5.5%) | 3/6] 21:156-180 · 22:100-124 · 23:120-110 · 24:130-116 · 25:124-132 · 26:140-124 |
| 1H total | 380-376-10 (50.3%, -4.0%) | 2/3] 24:136-110 · 25:108-146 · 26:136-120 |
| Team total (this team) | 392-344-2 (53.3%, +1.7%) | 2/3] 24:127-93 · 25:129-129 · 26:136-122 |

### Both teams' previous games went under by 20+

n = 560 team-games · shade of tonight's total vs the two teams' prior average: -1.73 pts (n=558)

| market | over record (bet side) | per season |
|---|---|---|
| FG total | 274-276-10 (49.8%, -4.9%) | 3/6] 21:86-84 · 22:38-48 · 23:38-34 · 24:36-28 · 25:34-38 · 26:42-44 |
| 1H total | 114-108-2 (51.4%, -2.0%) | 2/3] 24:36-28 · 25:34-40 · 26:44-40 |
| Team total (this team) | 111-101-0 (52.4%, -0.0%) | 1/3] 24:34-20 · 25:36-36 · 26:41-45 |

## 7. Control: the shade on an ordinary game


### All games (both teams 3+ prior games)

n = 53,545 team-games · shade of tonight's total vs the two teams' prior average: +2.14 pts (n=51,083)

| market | under record (bet side) | per season |
|---|---|---|
| FG total | 24892-25780-467 (49.1%, -6.2%) | 1/6] 21:2750-2825 · 22:3998-4140 · 23:4332-4833 · 24:4553-4717 · 25:4514-4572 · 26:4745-4693 |
| 1H total | 14124-13524-310 (51.1%, -2.5%) | 3/3] 24:4624-4600 · 25:4627-4421 · 26:4873-4503 |
| Team total (this team) | 13149-13605-166 (49.1%, -6.2%) | 0/3] 24:4046-4312 · 25:4422-4561 · 26:4681-4732 |
