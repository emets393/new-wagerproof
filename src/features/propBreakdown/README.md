# NFL Player Prop Breakdown (web)

Orbit layout for a single NFL player's weekly prop page. Route:
`/nfl/player/:playerId` (e.g. Justin Jefferson → `/nfl/player/00-0036322`).

Render-only against two sports-data tables on the college-football Supabase
client (`jpxnjuwglavsjbgbasnl`):

| Table | Role |
|---|---|
| `nfl_prop_player_pages` | One row per player per week: headshot, markets, baseline, NGS, scheme, highlights |
| `nfl_player_prop_trends` | Career `recent_game_log`, `matchups`, situational `splits` |

No client math (percentiles / identities / highlights are precomputed). No
`*_slate_*` references. Market toggles come strictly from each player's
`markets[]` — a WR only sees Rushing Yards if that key is in the array.

## Layout

Edge-first stack (not a sparse 4-cluster orbit):

1. Sticky market pills (`markets[]` only)
2. Compact hero (headshot + chips)
3. **Highlight ribbons** — precomputed edge voice for the selected market
4. **Overall vs this look** — baseline + career ypt on the left; focus coverage
   splits (with served `delta_ypt`) + look hit-rates on the right
5. Defense identity (full mix expandable)
6. Vs this team + last-10 + situations

## Scheme contract extras (served)

| Field | Meaning |
|---|---|
| `scheme.player_overall` | Career ypt / targets / pctile (man+zone blend) |
| `scheme.player_splits.*.delta_ypt` | Split ypt − overall ypt |
| `scheme.look_focus` | Looks matching opponent identity |
| `scheme.look_hit_rates` | Career O/U vs teams sharing that identity |

Generator: `research/nfl-extreme-outcomes/gen_nfl_prop_player_pages.py`
