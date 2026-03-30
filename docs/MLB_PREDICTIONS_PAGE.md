# MLB predictions page — technical reference

This document describes the **web** MLB predictions experience in Wagerproof: routing, Supabase data sources, field meanings, team/logo resolution, derived scores, the signals view, and UI structure. Use it when implementing **parity in the Wagerproof mobile app** or when extending the backend schema.

**Source of truth (code):**

| Area | Path |
|------|------|
| Page implementation | [`src/pages/MLB.tsx`](../src/pages/MLB.tsx) |
| Supabase client | [`src/integrations/supabase/college-football-client.ts`](../src/integrations/supabase/college-football-client.ts) |
| Route | [`src/App.tsx`](../src/App.tsx) — `path="/mlb"` |
| Navigation | [`src/nav-items.tsx`](../src/nav-items.tsx) — MLB nav item |

---

## 1. Purpose and scope

The MLB page lists **upcoming games** in a **rolling three-calendar-day window** (today through today+2 in the **browser’s local timezone** for the date filter). Each non-postponed game is shown as a card with:

- Game date/time (display time in **Eastern Time**)
- Away @ home matchup with **logos**, **moneylines**, **full-game spreads** in parentheses, **total**, **starting pitchers** and confirmation flags
- **Status** (e.g. Scheduled)
- **Signals** (only for games whose `official_date` is **today in Eastern Time**): supplemental situational/trend messages from `mlb_game_signals`, or a fixed empty-state message
- **Full Game / 1st 5** toggle controlling projected score and projection copy
- **Moneyline** and **total (O/U)** projection blocks with model picks, edges, and confidence styling
- **Weather** footer when columns exist on the row

The TypeScript interface `MLBPredictionRow` documents the **minimum** fields the UI expects; the game query uses `select('*')`, so **any additional columns** returned by `mlb_games_today` are still present at runtime (e.g. weather fields).

---

## 2. Authentication and routing

- **URL:** `/mlb`
- **Guard:** `ProtectedRoute` with **`allowFreemium={true}`** (same pattern as other sports hub pages in `App.tsx`).
- **Nav:** Sidebar/shell entry uses `to: "/mlb"` and renders `<MLB />` as the page component.

Unauthenticated users follow the same rules as other `ProtectedRoute` + `allowFreemium` routes.

---

## 3. Supabase project and client

All MLB queries use **`collegeFootballSupabase`** from `college-football-client.ts`. The export name is **historical** (college football); the **same Supabase project** hosts MLB tables/views.

- **URL and anon key** are defined in that file. **Do not commit secrets** to this doc; for mobile, use the **same project URL and anon key** (or env vars that mirror the web app).
- Access is subject to **Supabase RLS** for the `anon` role. If a table returns empty in the browser but has data in the SQL editor, check policies.

---

## 4. Data sources (tables / views)

| Source | Role | Query (conceptual) | Join key |
|--------|------|--------------------|----------|
| **`mlb_games_today`** | Primary row per game; lines, probs, F5 fields, starters, flags, etc. | `select('*')` with filters below | `game_pk` |
| **`mlb_team_mapping`** | Map team names / MLB IDs → display **abbrev** + **logo_url** | `select('*')` | `team_name` (normalized) or `mlb_api_id` ↔ game `*_team_id` |
| **`mlb_predictions_current`** | Authoritative **`is_final_prediction`** and **F5 ML edge %** per game when a row exists | `select('game_pk, is_final_prediction, f5_home_ml_edge_pct, f5_away_ml_edge_pct').in('game_pk', gamePks)` | `game_pk` |
| **`mlb_game_signals`** | Optional **signals** arrays per game | `select('game_pk, home_signals, away_signals, game_signals')` (full result set; no client-side `.in('game_pk')`) | `game_pk` (in-memory, string-normalized) |

### 4.1 `mlb_games_today` — fetch and filters

**Date window:** `official_date` between `startDate` and `endDate` inclusive, where:

- `startDate = toYMD(new Date())` (local calendar)
- `endDate = toYMD(today + 2 days)` (local calendar)

**Primary (strict) query:**

- `.or('is_active.eq.true,is_active.is.null')`
- `.or('is_completed.eq.false,is_completed.is.null')`
- Ordered by `official_date`, then `game_time_et` ascending.

**Fallback when strict returns zero rows:**

- Same date range, **without** the `is_active` / `is_completed` OR filters.
- Client-side filter: drop rows where `is_postponed === true` or `is_completed === true`.

### 4.2 Merge from `mlb_predictions_current`

After loading games, the client loads one row per `game_pk` from `mlb_predictions_current` for all `game_pk` values in the result set.

- **`is_final_prediction`:** If a current row exists for that `game_pk`, the merged object uses `!!row.is_final_prediction`. If no current row exists, the value from `mlb_games_today` is kept (`row.is_final_prediction ?? null`).
- **`f5_home_ml_edge_pct` / `f5_away_ml_edge_pct`:** If a current row exists, these columns from the table are written onto the game object (null if the column is null). If no current row exists, the game row’s existing values are left unchanged. The UI **does not** recompute F5 moneyline edge from win probability or market MLs; it only displays these stored percentages.

### 4.3 `mlb_game_signals`

- The view is assumed to be **scoped server-side** (e.g. relevant games only).
- The client **does not** filter by `game_pk` in the query so that rows still match even if ID types differ; joining happens in memory (see §5).

---

## 5. Primary key: `game_pk`

- **Identity:** Every card logic path uses **`game_pk`** as the stable game identifier.
- **Final prediction merge:** keyed by `Number(game_pk)`.
- **Signals map:** keyed by **`gamePkMapKey(game_pk)`** → string (e.g. `Math.trunc(Number(pk))` for numbers, string fallback for other PostgREST types). This avoids misses when the API returns numeric vs string IDs.
- **Per-card “Full Game / 1st 5” state:** React state key `gameKey` is `String(prediction.game_pk ?? prediction.id ?? \`${away}-${home}-${official_date}\`)`.

---

## 6. Game row field reference (conceptual schema)

The UI TypeScript type is `MLBPredictionRow` in `MLB.tsx`. Below is the **intended meaning** of fields used in the UI (plus optional dynamic fields).

### 6.1 Identity and schedule

| Field | Meaning |
|-------|---------|
| `game_pk` | Unique game id (MLB primary key in your pipeline). |
| `id` | Optional numeric row id; used only as fallback for React keys / `gameKey`. |
| `official_date` | Calendar date string `YYYY-MM-DD` (game day). Used for labels, date filter, and **Signals “today” gate** (compared to **ET** “today”, see §10). |
| `game_time_et` | Timestamp string; **display** uses `America/New_York` → localized time + `" ET"`. |

### 6.2 Teams

| Field | Meaning |
|-------|---------|
| `away_team_name`, `home_team_name` | Primary names for mapping and display. |
| `away_team`, `home_team`, `away_team_full_name`, `home_team_full_name` | Aliases read in code when building display names. |
| `away_team_id`, `home_team_id` | Preferred MLB team ids for mapping → `mlb_team_mapping.mlb_api_id`. |
| `away_mlb_team_id`, `home_mlb_team_id`, `away_id`, `home_id` | Aliases tolerated when reading team ids from the row. |

### 6.3 Status

| Field | Meaning |
|-------|---------|
| `status` | Shown in the status pill (default text `"Scheduled"` if null). |
| `is_postponed` | If `true`, a **minimal** postponed card is shown (no full projection layout). |
| `is_completed`, `is_active` | Used in strict/relaxed fetch logic. |

### 6.4 Market lines (full game)

| Field | Meaning |
|-------|---------|
| `away_ml`, `home_ml` | Moneyline; formatted with `+` for positive. |
| `away_spread`, `home_spread` | Team spreads; shown in parentheses next to the corresponding ML. |
| `total_line` | Market total; shown in center pill and in projection copy. |

### 6.5 Full-game model outputs

| Field | Meaning |
|-------|---------|
| `ml_home_win_prob`, `ml_away_win_prob` | Win probabilities (0–1). Drive ML pick side, displayed percentages, and **derived full-game runs** (see §8). |
| `home_ml_edge_pct`, `away_ml_edge_pct` | ML edge %; pick uses the edge for the **favored ML side** (higher win prob). |
| `home_ml_strong_signal`, `away_ml_strong_signal` | Booleans; mapped to ML confidence label **Strong** vs **Weak** (no moderate tier in ML block). |
| `ou_edge` | Used as magnitude `Math.abs(...)` for display in the total projection line (see code nuance: UI prefixes `+` in one place). |
| `ou_direction` | `'OVER'` or `'UNDER'` (or shown as `N/A` if missing). |
| `ou_fair_total` | Model fair total; used in **full-game projected runs** and displayed. |
| `ou_strong_signal`, `ou_moderate_signal` | Drive total confidence **Strong** / **Moderate** / **Weak** (Weak if neither flag). |

### 6.6 First five (F5)

| Field | Meaning |
|-------|---------|
| `f5_fair_total`, `f5_pred_margin` | Used to derive **F5 projected runs** (§8). |
| `f5_total_line` | F5 market total in UI. |
| `f5_ou_edge` | Sign determines OVER vs UNDER; magnitude shown as edge. |
| `f5_home_win_prob`, `f5_away_win_prob` | F5 win probs and pick side. |
| `f5_home_spread`, `f5_away_spread` | May be present on the row; **not** shown in the 1st 5 moneyline section (UI shows F5 win prob and F5 ML edge only). |
| `f5_home_ml_edge_pct`, `f5_away_ml_edge_pct` | F5 moneyline edge % per team. **Source of truth** for the card is `mlb_predictions_current` when merged (see §4.2); the client maps them with `toNum` for display only—no client-side edge formula. |
| `f5_home_ml_strong_signal`, `f5_away_ml_strong_signal` | Strong-edge flags; the **pick row** shows **Strong edge** only when the picked side’s flag is truthy (`true`, or coerced `1` / `"true"` / `"1"`). If false/absent, no badge. |

### 6.7 Starters and metadata

| Field | Meaning |
|-------|---------|
| `home_sp_name`, `away_sp_name` | Starting pitcher names. |
| `home_sp_confirmed`, `away_sp_confirmed` | Shown as “SP ✓” vs “SP TBD” (with title tooltips). |
| `projection_label` | Optional small line under the time pill. |
| `is_final_prediction` | **Final** vs **Preliminary** pill (with lock icon when final). Merged from `mlb_predictions_current` when available. |

### 6.8 Weather and quality flags

| Field | Meaning |
|-------|---------|
| `weather_confirmed`, `weather_imputed` | Footer copy: estimated vs awaiting confirmed inputs. |
| `temperature_f`, `wind_speed_mph`, `wind_direction`, `sky` | Read via `(prediction as any)` in the UI if present; not on the strict TS interface. |

### 6.9 Other flags on the interface

Fields such as `odds_available`, `prediction_available`, `starters_available`, `within_lockout_window` exist on the type for schema alignment; **current card rendering does not gate sections on them** (verify in `MLB.tsx` if you add gating).

---

## 7. Team abbreviation and logo matching

Function: **`resolveTeamMapping(teamId, teamNameFromGame)`** (defined inside the `MLB` component, uses maps built from `mlb_team_mapping`).

### 7.1 Normalization: `normalizeTeamNameKey`

- Trim, lowercase, replace ASCII/curly apostrophes with nothing, collapse whitespace.

### 7.2 Resolution order

1. **Exact name:** `teamMapByTeamName.get(nameKey)` where keys come from mapping `team_name` normalized the same way. Match game `away_team_name` / `home_team_name` (after alias resolution) to mapping `team_name`.
2. **ID match:** `teamId` from the game row (see §6.2 aliases) → `teamMapByMlbApiId.get(id)` where mapping key is `mlb_api_id` (with ingestion tolerating `team_id` / `id` in raw rows).
3. **Fuzzy name:** Scan all mapping rows; if normalized game name equals, contains, or is contained by normalized mapping `team_name`, keep the match with the **largest** `min(len(gameKey), len(mappingKey))` score.
4. **Hardcoded fallback:** `MLB_FALLBACK_BY_NAME` — a full map of **normalized** full club names (e.g. `new york yankees`) → `{ team: 'NYY', logo_url: ESPN 500px URL }` for all 30 MLB clubs. Used when the mapping table is empty or unreadable (e.g. RLS).

If still unresolved: **`fallbackAbbrevFromTeamName`** builds a 3-letter initialism from the display name (first letter of each word, max 3).

### 7.3 Mapping row ingestion (from Supabase)

Each raw mapping row is normalized to:

- `mlb_api_id`: `Number(raw.mlb_api_id ?? raw.team_id ?? raw.id)`
- `team`: `String(raw.team ?? raw.abbreviation ?? raw.team_abbrev ?? '')`
- `team_name`: `String(raw.team_name ?? raw.name ?? raw.full_name ?? '')`
- `logo_url`: `raw.logo_url ?? raw.logo ?? null` (empty string treated as no logo)

### 7.4 Images

- **Matchup logos:** `<img referrerPolicy="no-referrer" />`; on error, set `src` to `https://a.espncdn.com/i/teamlogos/mlb/500/{abbrev}.png` (lowercase abbrev); on second failure, inject a text node with the abbrev inside the circle.
- **Projected score row** uses the same URL sources and a similar fallback chain (class `mlb-score-logo-fallback`).

---

## 8. Derived projected scores (client-side)

These are **not** stored as final box scores; they are **derived for display** from model fields.

### 8.1 Full game — `getFullGameRuns(prediction)`

**Requires:**

- `ml_home_win_prob` strictly between 0 and 1
- `ou_fair_total` numeric

**Formula** (exponent **1.83**, Pythagorean-style split of the fair total):

Let `p = ml_home_win_prob`, `total = ou_fair_total`, `exp = 1.83`.

- `ratio = (p / (1-p))^(1/exp)`
- `home_runs = total * ratio / (ratio + 1)`
- `away_runs = total / (ratio + 1)`

If inputs are invalid, the UI shows **“Projection unavailable”** for that mode.

**Note:** The derivation uses **home** win probability only (not away) to split the total.

### 8.2 First five — `getF5Runs(prediction)`

**Requires:** `f5_fair_total` and `f5_pred_margin` (both numeric).

- `home_runs = (f5_fair_total + f5_pred_margin) / 2`
- `away_runs = (f5_fair_total - f5_pred_margin) / 2`

### 8.3 Projected score presentation

Layout: **away logo** — **away runs** — **home runs** — **home logo** (one decimal place). Toggle **Full Game** vs **1st 5** switches which derived pair is used (`fullRuns` vs `f5Runs`).

---

## 9. Full Game vs 1st 5 toggle

- **State:** `projectionViewByGame[gameKey]` with values `'full'` | `'f5'`; default `'full'`.
- **Affects:**
  - Section title “Projected Score (Full Game | 1st 5)”
  - Derived runs (`activeRuns`)
  - **Moneyline projection** block (full vs F5 pick, probs, edges; in **1st 5** mode: per-team **F5 win prob** + **F5 ML edge**, pick-row **F5 ML edge** + optional **Strong edge** if the picked side’s `f5_*_ml_strong_signal` is true)
  - **Total projection** block (full vs F5 fair total, market total, O/U pick/edge)
- **Does not change:** Header moneylines/spreads (always **full-game** `home_ml` / `away_ml` / `home_spread` / `away_spread`). F5 spreads are not shown in the card body.

---

## 10. Signals — `mlb_game_signals`

### 10.1 Row shape

Each row includes:

- `game_pk`
- `home_signals`, `away_signals`, `game_signals` — JSON **arrays** of objects in the ideal case; the client tolerates **stringified JSON**, **objects** (values coerced via `Object.values`), and alternate property names.

### 10.2 Item shape (per signal)

- **`message`** (required for UI): human-readable text; also accepts `Message`, `text`, `body`, `summary`.
- **`category`**: `pitcher` | `bullpen` | `batting` | `schedule` | `weather` | `park` (or aliases `Category`, `type`) — used for **icon only**, not shown as raw text.
- **`severity`**: `negative` | `positive` | `over` | `under` (or `Severity`, `level`) — drives **pill colors** only; not shown as raw text.

### 10.3 Merge order

When rendering, concatenate in this order:

1. `game_signals`
2. `home_signals`
3. `away_signals`

### 10.4 When the Signals **section** appears

The entire **Signals** block (pills **or** empty state) is shown **only** if:

`isOfficialDateToday(official_date)` **== true**

**Definition of “today”:** Compare `official_date`’s first 10 characters (`YYYY-MM-DD`) to the current date in **`America/New_York`**, formatted with `toLocaleDateString('en-CA', { timeZone: 'America/New_York' })` (ISO-like `YYYY-MM-DD`). This aligns “game day” with ET-first-pitch semantics used for time display.

Games **not** on ET-today **do not** show the Signals section at all (no empty state either).

### 10.5 Empty arrays

If the section is shown but all three arrays parse to zero items, display this copy (paraphrase allowed in other locales):

> No supplemental betting signals for this matchup right now. Your projections and edges above are the same full model outputs—this block only adds extra situational or trend context when our system surfaces it.

### 10.6 Severity → styling

| `severity` | Intent |
|------------|--------|
| `negative` | Headwind for that side — orange/red tint |
| `positive` | Tailwind for that side — green tint |
| `over` | Lean over on total — amber |
| `under` | Lean under — blue |
| other | Neutral slate |

### 10.7 Category → icon (Lucide)

| `category` | Icon |
|------------|------|
| `pitcher` | `User` |
| `bullpen` | `Flame` |
| `batting` | `Activity` |
| `schedule` | `Calendar` |
| `weather` | `CloudSun` |
| `park` | `MapPin` |
| default | `Target` |

### 10.8 Errors

If the `mlb_game_signals` query fails, the client logs a **warning** and uses an **empty map**; the page still loads.

---

## 11. Postponed games

If `is_postponed === true`, render a **simple** `Card` with matchup abbreviations, date/time, and a **Postponed** badge — **not** the full `NFLGameCard` layout (no projections/signals/weather in that branch).

---

## 12. Sorting and search

- **Search:** Case-insensitive substring on concatenated away + home display names.
- **Sort:**
  - **Time:** `official_date` then `game_time_et` string compare.
  - **ML Edge:** `max(|home_ml_edge_pct|, |away_ml_edge_pct|)` descending, tie-break time.
  - **O/U Edge:** `|ou_edge|` descending, tie-break time.
- **Reverse:** Clicking the active sort button toggles ascending/descending (Time only flips when Time is active).

---

## 13. Layout and components

- **Card shell:** `NFLGameCard` (hover props wired for parity with NFL cards) wrapping `CardContent`.
- **Visual sections:** CSS constants `MLB_CARD_SECTION` (outer bordered panels) and `MLB_CARD_INNER` (nested Moneyline / Total panels).
- **Typical vertical order:** Header (date, time, preliminary/final pill) → Matchup (logos, ML+spread, SP) → Status → **Signals** (if ET-today) → Projections (toggle, score, ML inner, Total inner) → Weather.
- **Loading / error / empty:** Skeleton grid, `Alert` for fetch errors, empty state card when no games in window.

---

## 14. Mobile app implementation checklist

- [ ] Use the **same Supabase project** (URL + anon key) or equivalent env config.
- [ ] Replicate the **four queries** and merge logic (`mlb_games_today` strict → relaxed fallback, `mlb_team_mapping`, `mlb_predictions_current` merge, `mlb_game_signals` full fetch + string-key map).
- [ ] Implement **`resolveTeamMapping`** with the same **four-step** order and **`MLB_FALLBACK_BY_NAME`** (or ship the map in shared module).
- [ ] Match **derived runs** formulas exactly (`exp = 1.83`, F5 split).
- [ ] Match **Signals** merge order, parsing tolerance, **ET-today** gate, empty copy, and severity/category behavior.
- [ ] Use **referrer policy** / image fallback strategy appropriate for React Native (CDN URLs unchanged).
- [ ] Key list rows and toggles by **`game_pk`** (and the same `gameKey` fallback strategy if needed).
- [ ] Replicate **postponed** simplified UI vs full card.

---

## 15. Changelog pointer

When behavior changes, update **this file** and [`src/pages/MLB.tsx`](../src/pages/MLB.tsx) together so mobile and web stay aligned.
