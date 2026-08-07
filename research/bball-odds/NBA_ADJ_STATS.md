# NBA opponent-adjusted stats

## 1. Mechanism — does adjustment forecast the team's NEXT game better?

Correlation between a pregame estimate of a team's stat and what that team actually does in the game being predicted. No market involved, thousands of rows per stat, so this is where the question has power. If the adjusted rating does not beat the plain rolling mean here, it cannot help anything downstream.

| stat | n | rolling L10 | season-to-date | opponent-adjusted | adjusted + recency |
|---|---|---|---|---|---|
| `off_eff` | 10,084 | +0.2037 | +0.2103 | **+0.1960** | +0.1037 |
| `efg` | 10,084 | +0.1666 | +0.1844 | **+0.1755** | +0.0665 |
| `tov_rate` | 10,084 | +0.1957 | +0.2139 | **+0.2101** | +0.1184 |
| `ftr` | 10,084 | +0.1931 | +0.1918 | **+0.1960** | +0.1533 |
| `oreb_pct` | 10,084 | +0.2879 | +0.3014 | **+0.2921** | +0.1095 |
| `three_rate` | 10,084 | +0.5027 | +0.4941 | **+0.4743** | +0.2452 |
| `three_pct` | 10,084 | +0.0601 | +0.0855 | **+0.0856** | +0.0156 |
| `two_pct` | 10,084 | +0.1585 | +0.1717 | **+0.1635** | +0.0699 |
| `poss` | 10,084 | +0.3304 | +0.3306 | **+0.3413** | +0.2223 |

Opponent-adjusted beats both unadjusted estimates on **3 of 9** stats.

