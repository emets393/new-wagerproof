# Cursor Build: NFL Player Prop Breakdown page (web)

Build a full-page **Player Prop Breakdown** for NFL player props on the web app. This is
the flagship reference implementation — the native apps will copy it later. Futuristic,
sleek, on-brand with the existing site (dark glass, glows, iOS-style primitives). The
player's headshot is the **center of the page** with stat clusters branching off it.

**ALL data is served, pre-computed, from two tables on the sports-data Supabase
(`jpxnjuwglavsjbgbasnl`, the college-football-client instance). The page computes NOTHING —
no percentiles, no highlights, no derived stats. It renders what the tables provide.**
Never reference any `*_dryrun_*` table or view — the only sources are the two tables below.

---

## 1. Data contract

### Table A — `nfl_prop_player_pages` (one row per player per week; ~670 rows for wk1)

Fetch: `.from('nfl_prop_player_pages').select('*').eq('season', S).eq('week', W).eq('player_id', id).single()`
(For the player index/search, select light columns: `player_id, player_name, position, team, opponent, headshot_url`.)

| column | type | notes |
|---|---|---|
| player_id | text | GSIS id — join key to Table B |
| season, week | int | current slate |
| player_name, position, team, opponent | text | team/opponent are abbreviations (MIN, GB) |
| is_home | bool | |
| game_label | text | e.g. "Green Bay Packers @ Minnesota Vikings" |
| kickoff | timestamptz | may be null |
| headshot_url | text | official NFL headshot (transparent PNG) |
| markets | jsonb | THE market toggle source — see below |
| baseline | jsonb | 2025 per-game averages |
| ngs | jsonb | position-appropriate advanced profile w/ percentiles |
| scheme | jsonb | opponent defense profile + player-vs-coverage splits |
| highlights | jsonb | pre-computed "what matters most" callouts |

**`markets`** (array — RENDER ONLY THESE; a player without a market never shows that tab):
```json
[{ "key": "player_receptions", "label": "Receptions", "line": null,
   "over_price": null, "under_price": null, "status": "pending" }]
```
`status` is `"pending"` (books haven't posted — show the toggle with a subtle
"line pending" badge) or `"posted"` (render line + prices). Rushing yards appears for a
WR **only if present in this array** — exactly the owner's requirement.

**`baseline`** (may be null for rookies — render "No NFL sample yet · 2026 rookie"):
```json
{ "season": 2025, "games": 17, "receptions": 4.94, "rec_yds": 61.65, "targets": 8.29,
  "rush_att": 0.24, "rush_yds": 1.65, "pass_att": 0, "pass_yds": 0,
  "total_td": 2, "pass_td": 0 }
```

**`ngs`** — `kind` is `receiving` | `rushing` | `passing`; every metric is `{v, pctile}`
(pctile = league percentile, higher = better positioned EXCEPT cushion/time_to_los which
are descriptive — render those without a good/bad color):
```json
{ "kind": "receiving",
  "separation": {"v": 3.2, "pctile": 61}, "cushion": {"v": 5.75, "pctile": 44},
  "adot": {"v": 10.08, "pctile": 66}, "air_share": {"v": 41.11, "pctile": 97},
  "yac_above_exp": {"v": 0.89, "pctile": 78} }
```
rushing kind: `efficiency, ryoe_per_att, eight_box_pct, time_to_los`.
passing kind: `time_to_throw, completed_air_yds, intended_air_yds`.

**`scheme`**:
```json
{ "opponent": "GB",
  "defense": { "identity": "ZONE-HEAVY · TWO-HIGH SHELL",
    "two_high": {"rate": 0.51, "pctile": 81}, "man": {"rate": 0.16, "pctile": 3},
    "pressure": {"rate": 0.33, "pctile": 66}, "blitz": {"rate": 0.29, "pctile": 16},
    "heavy_box": {"rate": 0.06, "pctile": 75}, "light_box": {"rate": 0.67, "pctile": 25} },
  "player_splits": { "zone": {"ypt": 9.63, "targets": 546, "pctile": 91},
    "man": {"ypt": 9.71, "targets": 333, "pctile": 92},
    "two_high": {"ypt": 9.01, "targets": 341, "pctile": 87},
    "one_high": {"ypt": 10.14, "targets": 516, "pctile": 93} } }
```
`player_splits` is ABSENT for ~1/3 of players (rookies / low sample). Render the
designed empty state: *"Not enough NFL sample vs this look yet."* Never blank cells.
`defense` can rarely be null → hide the defense cluster.

**`highlights`** (array; the glow layer — each names its `markets`):
```json
[{ "kind": "scheme", "direction": "up", "markets": ["player_receptions","player_reception_yds"],
   "text": "Top-9% in the NFL vs zone coverage (9.6 yds/target) — GB is one of the most zone-heavy defenses." },
  { "kind": "matchup", "direction": "down", "markets": ["player_anytime_td"],
   "text": "Scored in only 1 of 4 career games vs GB." }]
```

### Table B — `nfl_player_prop_trends` (career history; join by `player_id`)

Already serves the Outliers prop trends. Relevant fields:
- `recent_game_log`: array (newest first) `{season, week, opp, is_home, is_div, is_primetime,
  markets: {"player_receptions": "O"|"U"|"P", "player_anytime_td": "Y"|"N", ...}}` —
  drives the LAST-10 strip for the selected market.
- `matchups`: `{ "GB": { "meetings": 4, "player_receptions": {"h": 3, "n": 4, "pct": 0.75}, ... } }` —
  the VS THIS TEAM cluster (only show entries for `scheme.opponent`; require n ≥ 2).
- `splits`: per-market situational records (overall/home/away/division/primetime + last-3/5/7
  windows) — power the expandable "situations" drawer per market.

---

## 2. Page design — "the orbit"

Route: `/nfl/player/:playerId` (React Router; also openable as a full-page overlay from any
future props list). New feature module: `src/features/propBreakdown/` with its own README.

**Desktop (≥1024px): radial layout.**
- **Center**: circular headshot in a glowing team-accent ring (soft outer glow, thin inner
  ring), name in display weight, chip row: `WR · MIN`, `vs GB · Sun 1:00`, home/away.
  Subtle animated connector lines (SVG, low-opacity, slight pulse) from the center to each
  cluster — this is the "branching off" the owner wants. Respect `prefers-reduced-motion`.
- **Top**: the **market toggle** — pill row from `markets[]` only. Selected pill glows;
  posted lines show the number in the pill (`Receptions 4.5`); pending shows the label +
  small "line pending" dot. Toggle switches every cluster below with a 150ms crossfade.
- **Four orbit clusters** (glass cards, `GlassCard`-style):
  1. **WHO HE IS** (upper-left) — baseline per-game numbers relevant to the selected
     market (map below) + 2-3 NGS metrics as small percentile rings (ring fill = pctile).
  2. **THE DEFENSE HE FACES** (upper-right) — `scheme.defense.identity` as a gold tag +
     the 2-3 defense dims relevant to the market as horizontal percentile bars with
     plain-role labels ("Two-high shell · 51% · 81st %ile").
  3. **VS THIS LOOK** (lower-right) — `player_splits` rows relevant to the defense's
     identity, each `9.6 yds/target · TOP 9%` badge; highlight-glow if a scheme highlight
     targets the selected market.
  4. **VS THIS TEAM** (lower-left) — `matchups[opponent]` for the selected market:
     `3 of 4 over vs GB` + meetings count.
- **Bottom strip**: **LAST 10 GAMES** — from `recent_game_log`, one square per game colored
  by the selected market's result (green O/Y, red U/N, gray P/absent), opponent code under
  each, newest on the right. Tooltip: week/season/home-away.
- **Highlights**: any highlight whose `markets` includes the selected market renders (a) a
  glowing border on its source cluster and (b) its `text` in a compact callout ribbon under
  the hero (max 2 visible, "+N more" expands). `direction` colors it (up=green, down=red).

**Mobile (<1024px)**: hero on top (headshot smaller, centered), toggle sticky under it,
clusters stack vertically in the order 2 → 3 → 1 → 4 → last-10. No connector lines.

**Market → content map** (which stats/dims each toggle shows):

| market | WHO HE IS | DEFENSE dims | VS THIS LOOK |
|---|---|---|---|
| player_receptions | receptions, targets, (+NGS separation, air_share) | man vs zone, pressure | zone, man splits |
| player_reception_yds | rec_yds, targets, (+adot, air_share, yac_above_exp) | two_high, man | two_high, one_high, zone |
| player_rush_yds / rush_attempts | rush_att, rush_yds (+efficiency, ryoe_per_att, eight_box_pct) | heavy_box, light_box | — (hide cluster 3; widen 2) |
| player_anytime_td | total_td, rec_yds or rush_yds (+air_share) | two_high, heavy_box | zone, two_high |
| player_pass_yds / pass_tds / attempts / completions | pass_att, pass_yds, pass_td (+time_to_throw, intended_air_yds) | pressure, blitz, two_high | — (hide 3; widen 2) |

Same stats appearing under multiple markets is expected and fine (owner-approved).

---

## 3. Hard rules

1. **Render-only.** No client-side math beyond formatting. Percentiles, highlights,
   identities all come precomputed. If a field is null/absent → designed empty state,
   never NaN/undefined/blank.
2. **Markets come from `markets[]` only.** Never hardcode a market list. Lines/prices only
   from this table (they originate from The Odds API — the only line source, ever).
3. **No `*_dryrun_*` references anywhere.**
4. **Highlights are the only "edge" voice.** Do not add leans, projections, or verdicts
   client-side. Pass-TD markets will never carry a lean by policy — don't invent one.
5. **Brand**: reuse `src/components/ios/` primitives (GlassCard, FilterPill, shimmer),
   Tailwind tokens, dark+light themes. Match the games split-view aesthetic; skeleton
   shimmer for both fetches; React Query with `staleTime: 5m`, keys
   `['nflPropPage', id, season, week]` / `['nflPropTrends', id]`.
6. Season/week: read the current values from the latest row in `nfl_prop_player_pages`
   (max season+week present) — do not hardcode 2026/1.
7. Files: new module `src/features/propBreakdown/` (page, hooks, components, README),
   route added in `src/App.tsx`. Do not modify native apps or existing props surfaces.
   Write the module README per repo doc standards.

## 4. QA against real data (Justin Jefferson, player_id `00-0036322`)

- Hero: headshot renders, `WR · MIN`, `Green Bay Packers @ Minnesota Vikings`, home.
- Toggles: exactly 4 pills (Anytime TD, Receiving Yards, Receptions, Rushing Yards), all
  "pending" until books post.
- Receptions tab: WHO HE IS shows 4.9 rec / 8.3 targets; DEFENSE shows "ZONE-HEAVY ·
  TWO-HIGH SHELL" with man at 3rd %ile; VS THIS LOOK shows zone 9.6 ypt TOP 9%; VS THIS
  TEAM shows 3 of 4 vs GB; two green highlight ribbons + one red (ATD tab only).
- Last-10 strip ends at 2025 wk18 vs GB.
- A rookie (no baseline/splits) renders all empty states cleanly.
