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

## Fantasy-Points layer (`research`)

`FpResearchStrip` renders `research[marketKey]` directly under the WagerProof projection. It is
**additive and never a replacement**, because the two cover very different ground:

| | Coverage (a full week) |
|---|---|
| `projection` | ~770 of ~930 players, all markets |
| `research` | ~130 of ~370 pages, 5-6 markets |

That gap is deliberate. The prop model only covers the markets that survived backtesting on
2023-25 priced lines — passing yards, passing TDs, completions, receptions, receiving yards.
Rushing markets and anytime TD were tested and killed (RB rush yds 50-52%, QB rush yds 50-51%,
dead at every threshold), so **a market with no `research` entry is the expected state, not
missing data**. The strip returns `null` in that case; never show an empty shell.

| Field | Meaning |
|---|---|
| `research.<mkt>.fp_model.pred` / `.line` / `.edge` | Projection, the line it scored against, and `pred - line` — the sign IS the side |
| `research.<mkt>.fp_model.threshold` / `.fires` | That market's backtested threshold, and whether `\|edge\|` clears it |
| `research.<mkt>.fp_model.tier` | Backtested hit rate at the threshold, or `"robust"` where no rate was pinned — only render it when it reads as a rate |
| `research.<mkt>.prop_report` | The weekly Player Prop Report read: side, score, `n_for`/`n_against` **independent** tells, and the tell list |

Ports: iOS `NFLPropResearchStrip.swift`, Android `NflPropResearchStrip.kt`. Agents get the same
payload as `fp_research` from `get_prop_player_page` (`agents-v3/src/loop/tools/readTools.ts`).
Built by `research/nfl-extreme-outcomes/fp_prop_layer.py` from `nfl_prop_model_preds` +
`nfl_prop_narratives`.

Generator: `research/nfl-extreme-outcomes/gen_nfl_prop_player_pages.py`
